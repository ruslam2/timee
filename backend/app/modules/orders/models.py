import enum
from decimal import Decimal

from sqlalchemy import JSON, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin


class OrderStatus(enum.StrEnum):
    created = "created"  # ждёт оплаты
    paid = "paid"
    purchased = "purchased"  # выкуплен у поставщика
    received_cn = "received_cn"  # принят и взвешен на складе в Китае
    shipped = "shipped"  # в партии, в пути
    customs = "customs"
    arrived_uz = "arrived_uz"
    at_pickup = "at_pickup"
    delivered = "delivered"
    cancelled = "cancelled"
    disputed = "disputed"


class PaymentKind(enum.StrEnum):
    payment = "payment"
    surcharge = "surcharge"  # доплата за вес
    refund = "refund"


class PaymentStatus(enum.StrEnum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    cancelled = "cancelled"


def _enum(e: type[enum.Enum], name: str) -> Enum:
    return Enum(e, name=name, native_enum=False, length=20)


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(30), unique=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    status: Mapped[OrderStatus] = mapped_column(
        _enum(OrderStatus, "order_status"), default=OrderStatus.created, index=True
    )
    tariff_id: Mapped[int] = mapped_column(ForeignKey("shipping_tariffs.id"))
    pickup_point_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))

    # курс CNY→UZS, зафиксированный при оформлении
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    price_per_kg_uzs: Mapped[int]
    min_weight_g: Mapped[int]
    commission_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2))

    goods_total_uzs: Mapped[int]
    delivery_estimate_uzs: Mapped[int]
    delivery_adjustment_uzs: Mapped[int] = mapped_column(default=0)
    commission_uzs: Mapped[int]
    total_uzs: Mapped[int]

    declared_weight_g: Mapped[int]
    actual_weight_g: Mapped[int | None]
    supplier_order_ref: Mapped[str | None] = mapped_column(String(200))
    pickup_code: Mapped[str] = mapped_column(String(6))
    comment: Mapped[str | None] = mapped_column(Text)

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id"
    )
    events: Mapped[list["TrackingEvent"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="TrackingEvent.id"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="Payment.id"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    title: Mapped[str] = mapped_column(String(300))
    attributes: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    quantity: Mapped[int]
    price_cny_fen: Mapped[int]
    price_uzs: Mapped[int]
    weight_g: Mapped[int]

    order: Mapped[Order] = relationship(back_populates="items")


class TrackingEvent(TimestampMixin, Base):
    __tablename__ = "tracking_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    status: Mapped[OrderStatus] = mapped_column(_enum(OrderStatus, "order_status"))
    comment: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    order: Mapped[Order] = relationship(back_populates="events")


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    kind: Mapped[PaymentKind] = mapped_column(_enum(PaymentKind, "payment_kind"))
    status: Mapped[PaymentStatus] = mapped_column(
        _enum(PaymentStatus, "payment_status"), default=PaymentStatus.pending
    )
    provider: Mapped[str] = mapped_column(String(20))
    amount_uzs: Mapped[int]
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True)

    order: Mapped[Order] = relationship(back_populates="payments")
