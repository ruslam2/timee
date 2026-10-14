import logging
import secrets
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.modules.catalog.models import Product, ProductStatus, ProductVariant
from app.modules.catalog.pricing import (
    ceil_uzs,
    cny_fen_to_uzs,
    current_cny_rate,
    delivery_cost_uzs,
)
from app.modules.orders.models import (
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentKind,
    PaymentStatus,
    TrackingEvent,
)
from app.modules.orders.schemas import CheckoutIn, OrderQuote, QuoteLine
from app.modules.organizations.models import (
    MemberRole,
    Organization,
    OrganizationStatus,
    ShippingTariff,
    Warehouse,
    WarehouseKind,
)

logger = logging.getLogger("magazin.orders")

S = OrderStatus

# Переходы, которые выполняют сотрудники карго через общий эндпоинт смены статуса.
# Взвешивание, выдача, отмена и спор идут через отдельные эндпоинты со своими проверками.
STAFF_TRANSITIONS: dict[tuple[OrderStatus, OrderStatus], set[MemberRole]] = {
    (S.paid, S.purchased): {MemberRole.manager},
    (S.received_cn, S.shipped): {MemberRole.manager, MemberRole.warehouse_cn},
    (S.shipped, S.customs): {MemberRole.manager, MemberRole.warehouse_uz},
    (S.customs, S.arrived_uz): {MemberRole.manager, MemberRole.warehouse_uz},
    (S.arrived_uz, S.at_pickup): {MemberRole.manager, MemberRole.warehouse_uz},
}

CANCELLABLE = {S.created, S.paid}


def order_options():
    return (
        selectinload(Order.items),
        selectinload(Order.events),
        selectinload(Order.payments),
    )


async def load_order(session: AsyncSession, order_id: int) -> Order:
    order = await session.scalar(
        select(Order).options(*order_options()).where(Order.id == order_id)
    )
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


def amount_due(order: Order) -> int:
    return sum(
        p.amount_uzs
        for p in order.payments
        if p.status == PaymentStatus.pending
        and p.kind in (PaymentKind.payment, PaymentKind.surcharge)
    )


def has_pending_surcharge(order: Order) -> bool:
    return any(
        p.kind == PaymentKind.surcharge and p.status == PaymentStatus.pending
        for p in order.payments
    )


def add_event(order: Order, new_status: OrderStatus, actor_id: int | None, comment: str | None):
    order.status = new_status
    order.events.append(TrackingEvent(status=new_status, comment=comment, actor_id=actor_id))
    # Telegram и SMS подключаются на этапе логистики; пока событие пишется в лог
    logger.info("order %s -> %s", order.number, new_status)


async def build_quote(session: AsyncSession, body: CheckoutIn) -> list[OrderQuote]:
    rate = await current_cny_rate(session)
    if rate is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Exchange rate is not set")

    variant_ids = [i.variant_id for i in body.items]
    rows = await session.execute(
        select(ProductVariant, Product, Organization)
        .join(Product, Product.id == ProductVariant.product_id)
        .join(Organization, Organization.id == Product.organization_id)
        .where(ProductVariant.id.in_(variant_ids))
    )
    found = {v.id: (v, p, o) for v, p, o in rows.all()}

    by_org: dict[int, list[QuoteLine]] = defaultdict(list)
    orgs: dict[int, Organization] = {}
    for item in body.items:
        entry = found.get(item.variant_id)
        if entry is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Variant {item.variant_id} not found")
        variant, product, org = entry
        if (
            not variant.is_active
            or product.status != ProductStatus.active
            or org.status != OrganizationStatus.verified
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Variant {item.variant_id} is not available"
            )
        orgs[org.id] = org
        by_org[org.id].append(
            QuoteLine(
                variant_id=variant.id,
                product_id=product.id,
                title=product.title_ru,
                attributes=variant.attributes,
                quantity=item.quantity,
                price_uzs=cny_fen_to_uzs(variant.price_cny_fen, rate),
                weight_g=variant.weight_g,
            )
        )

    deliveries = {d.organization_id: d for d in body.deliveries}
    missing = set(by_org) - set(deliveries)
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Choose delivery for organizations: {sorted(missing)}",
        )

    quotes = []
    for org_id, lines in by_org.items():
        choice = deliveries[org_id]
        tariff = await session.get(ShippingTariff, choice.tariff_id)
        if tariff is None or tariff.organization_id != org_id or not tariff.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid tariff for org {org_id}")
        point = await session.get(Warehouse, choice.pickup_point_id)
        if (
            point is None
            or point.organization_id != org_id
            or point.kind != WarehouseKind.pickup_point
            or not point.is_active
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Invalid pickup point for org {org_id}"
            )
        org = orgs[org_id]
        weight = sum(line.weight_g * line.quantity for line in lines)
        goods = sum(line.price_uzs * line.quantity for line in lines)
        delivery = delivery_cost_uzs(weight, tariff.price_per_kg_uzs, tariff.min_weight_g)
        pct = commission_percent(org)
        commission = ceil_uzs(Decimal(goods) * pct / 100)
        quotes.append(
            OrderQuote(
                organization_id=org_id,
                organization_name=org.name,
                tariff_id=tariff.id,
                pickup_point_id=point.id,
                lines=lines,
                exchange_rate=rate,
                declared_weight_g=weight,
                goods_total_uzs=goods,
                delivery_estimate_uzs=delivery,
                commission_uzs=commission,
                total_uzs=goods + delivery + commission,
            )
        )
    return quotes


def commission_percent(org: Organization) -> Decimal:
    if org.commission_percent is not None:
        return org.commission_percent
    return settings.platform_commission_percent


def new_order_number() -> str:
    return f"MZ{datetime.now(UTC):%y%m%d}-{secrets.token_hex(3).upper()}"


async def create_orders(session: AsyncSession, body: CheckoutIn, buyer_id: int) -> list[Order]:
    quotes = await build_quote(session, body)
    orders = []
    for q in quotes:
        tariff = await session.get(ShippingTariff, q.tariff_id)
        org = await session.get(Organization, q.organization_id)
        order = Order(
            number=new_order_number(),
            buyer_id=buyer_id,
            organization_id=q.organization_id,
            status=S.created,
            tariff_id=q.tariff_id,
            pickup_point_id=q.pickup_point_id,
            exchange_rate=q.exchange_rate,
            price_per_kg_uzs=tariff.price_per_kg_uzs,
            min_weight_g=tariff.min_weight_g,
            commission_percent=commission_percent(org),
            goods_total_uzs=q.goods_total_uzs,
            delivery_estimate_uzs=q.delivery_estimate_uzs,
            commission_uzs=q.commission_uzs,
            total_uzs=q.total_uzs,
            declared_weight_g=q.declared_weight_g,
            pickup_code=f"{secrets.randbelow(1_000_000):06d}",
            comment=body.comment,
            items=[],
            events=[],
            payments=[],
        )
        variants = {
            v.id: v
            for v in await session.scalars(
                select(ProductVariant).where(
                    ProductVariant.id.in_([line.variant_id for line in q.lines])
                )
            )
        }
        for line in q.lines:
            order.items.append(
                OrderItem(
                    variant_id=line.variant_id,
                    product_id=line.product_id,
                    title=line.title,
                    attributes=line.attributes,
                    quantity=line.quantity,
                    price_cny_fen=variants[line.variant_id].price_cny_fen,
                    price_uzs=line.price_uzs,
                    weight_g=line.weight_g,
                )
            )
        order.payments.append(
            Payment(kind=PaymentKind.payment, provider="unselected", amount_uzs=q.total_uzs)
        )
        add_event(order, S.created, buyer_id, None)
        session.add(order)
        orders.append(order)
    await session.commit()
    return [await load_order(session, o.id) for o in orders]


async def complete_payment(session: AsyncSession, order: Order, payment: Payment) -> None:
    """Вызывается после подтверждения платёжной системой."""
    if payment.status == PaymentStatus.paid:
        return  # идемпотентность: повторное уведомление ничего не меняет
    payment.status = PaymentStatus.paid
    if payment.kind == PaymentKind.payment and order.status == S.created:
        add_event(order, S.paid, None, "Оплата получена")
    elif payment.kind == PaymentKind.surcharge:
        order.events.append(TrackingEvent(status=order.status, comment="Доплата за вес получена"))
    await session.commit()


def cancel(order: Order, actor_id: int, comment: str | None) -> None:
    if order.status not in CANCELLABLE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Order can no longer be cancelled")
    was_paid = order.status == S.paid
    for p in order.payments:
        if p.status == PaymentStatus.pending:
            p.status = PaymentStatus.cancelled
    if was_paid:
        paid = sum(
            p.amount_uzs
            for p in order.payments
            if p.status == PaymentStatus.paid and p.kind != PaymentKind.refund
        )
        order.payments.append(Payment(kind=PaymentKind.refund, provider="manual", amount_uzs=paid))
    add_event(order, S.cancelled, actor_id, comment)


def weigh(order: Order, actual_weight_g: int, actor_id: int, comment: str | None) -> None:
    if order.status != S.purchased:
        raise HTTPException(status.HTTP_409_CONFLICT, "Order must be purchased before weighing")
    actual = delivery_cost_uzs(actual_weight_g, order.price_per_kg_uzs, order.min_weight_g)
    diff = actual - order.delivery_estimate_uzs
    order.actual_weight_g = actual_weight_g
    order.delivery_adjustment_uzs = diff
    order.total_uzs = (
        order.goods_total_uzs + order.delivery_estimate_uzs + diff + order.commission_uzs
    )
    note = f"Фактический вес {actual_weight_g} г"
    if diff > 0:
        order.payments.append(
            Payment(kind=PaymentKind.surcharge, provider="unselected", amount_uzs=diff)
        )
        note += f", доплата {diff} сум"
    elif diff < 0:
        order.payments.append(Payment(kind=PaymentKind.refund, provider="manual", amount_uzs=-diff))
        note += f", возврат {-diff} сум"
    if comment:
        note += f". {comment}"
    add_event(order, S.received_cn, actor_id, note)


def staff_transition(
    order: Order,
    new_status: OrderStatus,
    role: MemberRole,
    actor_id: int,
    comment: str | None,
    supplier_order_ref: str | None,
) -> None:
    allowed = STAFF_TRANSITIONS.get((order.status, new_status))
    if allowed is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Cannot move order from {order.status} to {new_status}"
        )
    if role != MemberRole.owner and role not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role for this step")
    if new_status == S.shipped and has_pending_surcharge(order):
        raise HTTPException(status.HTTP_409_CONFLICT, "Weight surcharge is not paid yet")
    if new_status == S.purchased and supplier_order_ref:
        order.supplier_order_ref = supplier_order_ref
    add_event(order, new_status, actor_id, comment)


def deliver(order: Order, pickup_code: str, actor_id: int) -> None:
    if order.status != S.at_pickup:
        raise HTTPException(status.HTTP_409_CONFLICT, "Order is not at the pickup point")
    if not secrets.compare_digest(order.pickup_code, pickup_code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Wrong pickup code")
    add_event(order, S.delivered, actor_id, "Выдан покупателю")
