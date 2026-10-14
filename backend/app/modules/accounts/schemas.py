import re

from pydantic import BaseModel, ConfigDict, field_validator

PHONE_RE = re.compile(r"^\+\d{10,15}$")


def normalize_phone(value: str) -> str:
    phone = re.sub(r"[\s\-()]", "", value)
    if not phone.startswith("+"):
        phone = "+" + phone
    if not PHONE_RE.match(phone):
        raise ValueError("Phone must be in international format, e.g. +998901234567")
    return phone


class OtpRequest(BaseModel):
    phone: str

    _normalize = field_validator("phone")(normalize_phone)


class OtpRequestResult(BaseModel):
    sent: bool
    debug_code: str | None = None  # только при sms_provider=console


class OtpVerify(BaseModel):
    phone: str
    code: str

    _normalize = field_validator("phone")(normalize_phone)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    full_name: str | None
    language: str
    is_admin: bool


class UserUpdate(BaseModel):
    full_name: str | None = None
    language: str | None = None

    @field_validator("language")
    @classmethod
    def _lang(cls, v: str | None) -> str | None:
        if v is not None and v not in {"uz", "ru", "zh"}:
            raise ValueError("language must be uz, ru or zh")
        return v
