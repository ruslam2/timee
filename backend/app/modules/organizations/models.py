import enum
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin


class OrganizationStatus(enum.StrEnum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"
    blocked = "blocked"


class MemberRole(enum.StrEnum):
    owner = "owner"
    manager = "manager"
    warehouse_cn = "warehouse_cn"
    warehouse_uz = "warehouse_uz"


class Country(enum.StrEnum):
    CN = "CN"
    UZ = "UZ"


class WarehouseKind(enum.StrEnum):
    warehouse = "warehouse"
    pickup_point = "pickup_point"


class ShippingMethod(enum.StrEnum):
    avia = "avia"
    auto = "auto"
    rail = "rail"


def _enum(e: type[enum.Enum], name: str) -> Enum:
    return Enum(e, name=name, native_enum=False, length=20)


class Organization(TimestampMixin, Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    inn: Mapped[str] = mapped_column(String(20), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[OrganizationStatus] = mapped_column(
        _enum(OrganizationStatus, "organization_status"), default=OrganizationStatus.pending
    )
    # индивидуальная ставка комиссии; если пусто, берётся ставка платформы
    commission_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    payout_details: Mapped[str | None] = mapped_column(Text)
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    members: Mapped[list["Membership"]] = relationship(back_populates="organization")


class Membership(TimestampMixin, Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "organization_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[MemberRole] = mapped_column(_enum(MemberRole, "member_role"))

    organization: Mapped[Organization] = relationship(back_populates="members")


class Warehouse(TimestampMixin, Base):
    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    country: Mapped[Country] = mapped_column(_enum(Country, "country"))
    kind: Mapped[WarehouseKind] = mapped_column(_enum(WarehouseKind, "warehouse_kind"))
    name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(500))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    working_hours: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(default=True)


class ShippingTariff(TimestampMixin, Base):
    __tablename__ = "shipping_tariffs"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    method: Mapped[ShippingMethod] = mapped_column(_enum(ShippingMethod, "shipping_method"))
    name: Mapped[str] = mapped_column(String(200))
    # суммы в UZS храним целыми сумами
    price_per_kg_uzs: Mapped[int]
    min_weight_g: Mapped[int] = mapped_column(default=0)
    days_min: Mapped[int]
    days_max: Mapped[int]
    is_active: Mapped[bool] = mapped_column(default=True)
