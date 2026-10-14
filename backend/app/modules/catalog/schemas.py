from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.catalog.models import ProductStatus


class CategoryIn(BaseModel):
    parent_id: int | None = None
    slug: str = Field(pattern=r"^[a-z0-9-]{2,100}$")
    name_ru: str = Field(min_length=2, max_length=200)
    name_uz: str = Field(min_length=2, max_length=200)
    ikpu_code: str | None = None


class CategoryOut(CategoryIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class VariantIn(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    attributes: dict[str, str] = {}
    price_cny_fen: int = Field(gt=0)
    weight_g: int = Field(gt=0)
    volume_cm3: int | None = Field(default=None, gt=0)
    is_active: bool = True


class VariantOut(VariantIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    price_uzs: int | None = None


class ProductIn(BaseModel):
    category_id: int
    title_ru: str = Field(min_length=2, max_length=300)
    title_uz: str = Field(min_length=2, max_length=300)
    description_ru: str | None = None
    description_uz: str | None = None
    images: list[str] = Field(default_factory=list, max_length=20)
    supplier_url: str | None = None
    variants: list[VariantIn] = Field(min_length=1, max_length=100)


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    category_id: int
    title_ru: str
    title_uz: str
    description_ru: str | None
    description_uz: str | None
    images: list[str]
    status: ProductStatus
    variants: list[VariantOut]
    min_price_uzs: int | None = None
    created_at: datetime


class ProductPrivate(ProductOut):
    supplier_url: str | None
    rejection_reason: str | None


class ProductPage(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int


class ExchangeRateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    currency: str
    rate_uzs: Decimal
    source: str
    fetched_at: datetime
