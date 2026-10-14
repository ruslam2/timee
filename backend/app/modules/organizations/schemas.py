from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.accounts.schemas import normalize_phone
from app.modules.organizations.models import (
    Country,
    MemberRole,
    OrganizationStatus,
    ShippingMethod,
    WarehouseKind,
)


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    inn: str = Field(pattern=r"^\d{9,14}$")
    description: str | None = None
    phone: str | None = None
    payout_details: str | None = None


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    phone: str | None = None
    payout_details: str | None = None


class OrganizationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    phone: str | None
    status: OrganizationStatus


class OrganizationOut(OrganizationPublic):
    inn: str
    commission_percent: Decimal | None
    payout_details: str | None
    rejection_reason: str | None


class MyOrganization(BaseModel):
    organization: OrganizationOut
    role: MemberRole


class MemberAdd(BaseModel):
    phone: str
    role: MemberRole

    _normalize = field_validator("phone")(normalize_phone)


class MemberOut(BaseModel):
    user_id: int
    phone: str
    full_name: str | None
    role: MemberRole


class WarehouseIn(BaseModel):
    country: Country
    kind: WarehouseKind
    name: str = Field(min_length=2, max_length=200)
    city: str = Field(min_length=2, max_length=100)
    address: str = Field(min_length=2, max_length=500)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    working_hours: str | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def _pickup_only_in_uz(self) -> "WarehouseIn":
        if self.kind == WarehouseKind.pickup_point and self.country != Country.UZ:
            raise ValueError("Pickup points must be in Uzbekistan")
        return self


class WarehouseOut(WarehouseIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int


class TariffIn(BaseModel):
    method: ShippingMethod
    name: str = Field(min_length=2, max_length=200)
    price_per_kg_uzs: int = Field(gt=0)
    min_weight_g: int = Field(default=0, ge=0)
    days_min: int = Field(ge=1)
    days_max: int = Field(ge=1)
    is_active: bool = True

    @model_validator(mode="after")
    def _days(self) -> "TariffIn":
        if self.days_max < self.days_min:
            raise ValueError("days_max must be >= days_min")
        return self


class TariffOut(TariffIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
