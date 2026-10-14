import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin


class ProductStatus(enum.StrEnum):
    draft = "draft"
    pending = "pending"  # на модерации
    active = "active"
    rejected = "rejected"
    archived = "archived"


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name_ru: Mapped[str] = mapped_column(String(200))
    name_uz: Mapped[str] = mapped_column(String(200))
    # код ИКПУ (МХИК) для фискального чека по умолчанию
    ikpu_code: Mapped[str | None] = mapped_column(String(30))


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    title_ru: Mapped[str] = mapped_column(String(300))
    title_uz: Mapped[str] = mapped_column(String(300))
    description_ru: Mapped[str | None] = mapped_column(Text)
    description_uz: Mapped[str | None] = mapped_column(Text)
    images: Mapped[list[str]] = mapped_column(JSON, default=list)
    supplier_url: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus, name="product_status", native_enum=False, length=20),
        default=ProductStatus.draft,
        index=True,
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductVariant.id"
    )


class ProductVariant(TimestampMixin, Base):
    __tablename__ = "product_variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    sku: Mapped[str] = mapped_column(String(100))
    attributes: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    # цена у поставщика в фэнях (1 юань = 100 фэней)
    price_cny_fen: Mapped[int]
    weight_g: Mapped[int]
    volume_cm3: Mapped[int | None]
    is_active: Mapped[bool] = mapped_column(default=True)

    product: Mapped[Product] = relationship(back_populates="variants")


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    currency: Mapped[str] = mapped_column(String(3), index=True)
    rate_uzs: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    source: Mapped[str] = mapped_column(String(50))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
