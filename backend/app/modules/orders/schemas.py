from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.orders.models import OrderStatus, PaymentKind, PaymentStatus


class CheckoutItem(BaseModel):
    variant_id: int
    quantity: int = Field(ge=1, le=1000)


class DeliveryChoice(BaseModel):
    organization_id: int
    tariff_id: int
    pickup_point_id: int


class CheckoutIn(BaseModel):
    items: list[CheckoutItem] = Field(min_length=1, max_length=200)
    deliveries: list[DeliveryChoice] = Field(min_length=1)
    comment: str | None = Field(default=None, max_length=1000)


class QuoteLine(BaseModel):
    variant_id: int
    product_id: int
    title: str
    attributes: dict[str, str]
    quantity: int
    price_uzs: int
    weight_g: int


class OrderQuote(BaseModel):
    organization_id: int
    organization_name: str
    tariff_id: int
    pickup_point_id: int
    lines: list[QuoteLine]
    exchange_rate: Decimal
    declared_weight_g: int
    goods_total_uzs: int
    delivery_estimate_uzs: int
    commission_uzs: int
    total_uzs: int


class QuoteOut(BaseModel):
    orders: list[OrderQuote]
    grand_total_uzs: int


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    variant_id: int
    product_id: int
    title: str
    attributes: dict[str, str]
    quantity: int
    price_cny_fen: int
    price_uzs: int
    weight_g: int


class TrackingEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: OrderStatus
    comment: str | None
    created_at: datetime


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: PaymentKind
    status: PaymentStatus
    provider: str
    amount_uzs: int
    created_at: datetime


class OrderOut(BaseModel):
    """Заказ для сотрудника карго: без кода выдачи."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    buyer_id: int
    organization_id: int
    status: OrderStatus
    tariff_id: int
    pickup_point_id: int
    exchange_rate: Decimal
    goods_total_uzs: int
    delivery_estimate_uzs: int
    delivery_adjustment_uzs: int
    commission_uzs: int
    total_uzs: int
    declared_weight_g: int
    actual_weight_g: int | None
    supplier_order_ref: str | None
    comment: str | None
    created_at: datetime
    items: list[OrderItemOut]
    events: list[TrackingEventOut]
    payments: list[PaymentOut]
    amount_due_uzs: int = 0


class BuyerOrderOut(OrderOut):
    pickup_code: str


class StatusChange(BaseModel):
    status: OrderStatus
    comment: str | None = Field(default=None, max_length=1000)
    supplier_order_ref: str | None = Field(default=None, max_length=200)


class WeighIn(BaseModel):
    actual_weight_g: int = Field(gt=0)
    comment: str | None = Field(default=None, max_length=1000)


class DeliverIn(BaseModel):
    pickup_code: str = Field(pattern=r"^\d{6}$")


class CommentIn(BaseModel):
    comment: str | None = Field(default=None, max_length=1000)


class DisputeIn(BaseModel):
    comment: str = Field(min_length=5, max_length=2000)


class PayIn(BaseModel):
    provider: str = Field(pattern=r"^(mock|payme|click)$")
