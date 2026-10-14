from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, Session, get_member_role, require_org_role
from app.modules.orders import service
from app.modules.orders.models import Order, OrderStatus, PaymentKind, PaymentStatus
from app.modules.orders.schemas import (
    BuyerOrderOut,
    CheckoutIn,
    CommentIn,
    DeliverIn,
    DisputeIn,
    OrderOut,
    PayIn,
    PaymentOut,
    QuoteOut,
    StatusChange,
    WeighIn,
)
from app.modules.organizations.models import MemberRole

router = APIRouter(tags=["orders"])


def buyer_view(order: Order) -> BuyerOrderOut:
    out = BuyerOrderOut.model_validate(order)
    out.amount_due_uzs = service.amount_due(order)
    return out


def staff_view(order: Order) -> OrderOut:
    out = OrderOut.model_validate(order)
    out.amount_due_uzs = service.amount_due(order)
    return out


async def load_own_order(session, user, order_id: int) -> Order:
    order = await service.load_order(session, order_id)
    if order.buyer_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


# --- покупатель ---


@router.post("/checkout/quote", response_model=QuoteOut)
async def quote(body: CheckoutIn, _: CurrentUser, session: Session) -> QuoteOut:
    orders = await service.build_quote(session, body)
    return QuoteOut(orders=orders, grand_total_uzs=sum(o.total_uzs for o in orders))


@router.post("/checkout", response_model=list[BuyerOrderOut], status_code=status.HTTP_201_CREATED)
async def checkout(body: CheckoutIn, user: CurrentUser, session: Session) -> list[BuyerOrderOut]:
    orders = await service.create_orders(session, body, user.id)
    return [buyer_view(o) for o in orders]


@router.get("/orders", response_model=list[BuyerOrderOut])
async def my_orders(user: CurrentUser, session: Session) -> list[BuyerOrderOut]:
    orders = await session.scalars(
        select(Order)
        .options(*service.order_options())
        .where(Order.buyer_id == user.id)
        .order_by(Order.id.desc())
    )
    return [buyer_view(o) for o in orders]


@router.get("/orders/{order_id}", response_model=BuyerOrderOut)
async def get_my_order(order_id: int, user: CurrentUser, session: Session) -> BuyerOrderOut:
    return buyer_view(await load_own_order(session, user, order_id))


@router.post("/orders/{order_id}/pay", response_model=PaymentOut)
async def pay(order_id: int, body: PayIn, user: CurrentUser, session: Session):
    order = await load_own_order(session, user, order_id)
    payment = next(
        (
            p
            for p in order.payments
            if p.status == PaymentStatus.pending
            and p.kind in (PaymentKind.payment, PaymentKind.surcharge)
        ),
        None,
    )
    if payment is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Nothing to pay")
    if body.provider != "mock":
        # Payme и Click подключаются на этапе платежей
        raise HTTPException(
            status.HTTP_501_NOT_IMPLEMENTED, f"{body.provider} is not connected yet"
        )
    if not settings.mock_payments_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Mock payments are disabled")
    payment.provider = "mock"
    await service.complete_payment(session, order, payment)
    return payment


@router.post("/orders/{order_id}/cancel", response_model=BuyerOrderOut)
async def cancel_my_order(
    order_id: int, body: CommentIn, user: CurrentUser, session: Session
) -> BuyerOrderOut:
    order = await load_own_order(session, user, order_id)
    service.cancel(order, user.id, body.comment or "Отменён покупателем")
    await session.commit()
    return buyer_view(await service.load_order(session, order_id))


@router.post("/orders/{order_id}/dispute", response_model=BuyerOrderOut)
async def open_dispute(
    order_id: int, body: DisputeIn, user: CurrentUser, session: Session
) -> BuyerOrderOut:
    order = await load_own_order(session, user, order_id)
    if order.status != OrderStatus.delivered:
        raise HTTPException(status.HTTP_409_CONFLICT, "Dispute is possible after delivery")
    service.add_event(order, OrderStatus.disputed, user.id, body.comment)
    await session.commit()
    return buyer_view(await service.load_order(session, order_id))


# --- кабинет карго ---


async def load_staff_order(session, user, order_id: int) -> tuple[Order, MemberRole]:
    order = await service.load_order(session, order_id)
    role = await get_member_role(session, user, order.organization_id)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order, role


@router.get("/organizations/{organization_id}/orders", response_model=list[OrderOut])
async def org_orders(
    organization_id: int,
    user: CurrentUser,
    session: Session,
    status_filter: OrderStatus | None = Query(None, alias="status"),
) -> list[OrderOut]:
    await require_org_role(session, user, organization_id)
    query = (
        select(Order)
        .options(*service.order_options())
        .where(Order.organization_id == organization_id)
        .order_by(Order.id.desc())
    )
    if status_filter is not None:
        query = query.where(Order.status == status_filter)
    return [staff_view(o) for o in await session.scalars(query)]


@router.get("/staff/orders/{order_id}", response_model=OrderOut)
async def staff_get_order(order_id: int, user: CurrentUser, session: Session) -> OrderOut:
    order, _ = await load_staff_order(session, user, order_id)
    return staff_view(order)


@router.post("/staff/orders/{order_id}/status", response_model=OrderOut)
async def staff_change_status(
    order_id: int, body: StatusChange, user: CurrentUser, session: Session
) -> OrderOut:
    order, role = await load_staff_order(session, user, order_id)
    service.staff_transition(
        order, body.status, role, user.id, body.comment, body.supplier_order_ref
    )
    await session.commit()
    return staff_view(await service.load_order(session, order_id))


@router.post("/staff/orders/{order_id}/weigh", response_model=OrderOut)
async def staff_weigh(
    order_id: int, body: WeighIn, user: CurrentUser, session: Session
) -> OrderOut:
    order, role = await load_staff_order(session, user, order_id)
    if role not in (MemberRole.owner, MemberRole.manager, MemberRole.warehouse_cn):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role for this step")
    service.weigh(order, body.actual_weight_g, user.id, body.comment)
    await session.commit()
    return staff_view(await service.load_order(session, order_id))


@router.post("/staff/orders/{order_id}/deliver", response_model=OrderOut)
async def staff_deliver(
    order_id: int, body: DeliverIn, user: CurrentUser, session: Session
) -> OrderOut:
    order, role = await load_staff_order(session, user, order_id)
    if role not in (MemberRole.owner, MemberRole.manager, MemberRole.warehouse_uz):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role for this step")
    service.deliver(order, body.pickup_code, user.id)
    await session.commit()
    return staff_view(await service.load_order(session, order_id))


@router.post("/staff/orders/{order_id}/cancel", response_model=OrderOut)
async def staff_cancel(
    order_id: int, body: CommentIn, user: CurrentUser, session: Session
) -> OrderOut:
    order, role = await load_staff_order(session, user, order_id)
    if role not in (MemberRole.owner, MemberRole.manager):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role for this step")
    service.cancel(order, user.id, body.comment or "Отменён карго-компанией")
    await session.commit()
    return staff_view(await service.load_order(session, order_id))
