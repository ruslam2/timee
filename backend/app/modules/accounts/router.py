from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, Session
from app.core.otp import OtpStore, generate_code, get_otp_store
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.sms import send_sms
from app.modules.accounts.models import User
from app.modules.accounts.schemas import (
    OtpRequest,
    OtpRequestResult,
    OtpVerify,
    RefreshRequest,
    TokenPair,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])

Otp = Annotated[OtpStore, Depends(get_otp_store)]


@router.post("/otp/request", response_model=OtpRequestResult)
async def request_otp(body: OtpRequest, otp: Otp) -> OtpRequestResult:
    code = generate_code()
    await otp.save(body.phone, code)
    await send_sms(body.phone, f"MagazinAPI: kod {code}")
    debug = code if settings.sms_provider == "console" and settings.is_dev else None
    return OtpRequestResult(sent=True, debug_code=debug)


@router.post("/otp/verify", response_model=TokenPair)
async def verify_otp(body: OtpVerify, otp: Otp, session: Session) -> TokenPair:
    if not await otp.verify(body.phone, body.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired code")
    user = await session.scalar(select(User).where(User.phone == body.phone))
    if user is None:
        user = User(phone=body.phone, is_admin=body.phone in settings.admin_phones)
        session.add(user)
        await session.commit()
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User is blocked")
    return TokenPair(
        access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id)
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, session: Session) -> TokenPair:
    try:
        user_id = decode_token(body.refresh_token, "refresh")
    except TokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from exc
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return TokenPair(
        access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id)
    )


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(body: UserUpdate, user: CurrentUser, session: Session) -> User:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    session.add(user)
    await session.commit()
    return user
