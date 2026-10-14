from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import TokenError, decode_token
from app.modules.accounts.models import User
from app.modules.organizations.models import (
    MemberRole,
    Membership,
    Organization,
    OrganizationStatus,
)

bearer = HTTPBearer(auto_error=False)

Session = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    session: Session,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        user_id = decode_token(credentials.credentials, "access")
    except TokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


AdminUser = Annotated[User, Depends(require_admin)]


async def get_member_role(
    session: AsyncSession, user: User, organization_id: int
) -> MemberRole | None:
    role = await session.scalar(
        select(Membership.role).where(
            Membership.user_id == user.id, Membership.organization_id == organization_id
        )
    )
    return role


async def require_org_role(
    session: AsyncSession,
    user: User,
    organization_id: int,
    roles: set[MemberRole] | None = None,
    *,
    verified: bool = False,
) -> MemberRole:
    """Проверяет, что пользователь состоит в организации и имеет одну из ролей.

    Владелец (owner) проходит любую проверку роли.
    """
    org = await session.get(Organization, organization_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    role = await get_member_role(session, user, organization_id)
    if role is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a member of this organization")
    if roles is not None and role != MemberRole.owner and role not in roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
    if verified and org.status != OrganizationStatus.verified:
        raise HTTPException(status.HTTP_409_CONFLICT, "Organization is not verified yet")
    return role
