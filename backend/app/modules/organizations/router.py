from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.deps import CurrentUser, Session, require_org_role
from app.modules.accounts.models import User
from app.modules.organizations.models import (
    MemberRole,
    Membership,
    Organization,
    OrganizationStatus,
    ShippingTariff,
    Warehouse,
)
from app.modules.organizations.schemas import (
    MemberAdd,
    MemberOut,
    MyOrganization,
    OrganizationCreate,
    OrganizationOut,
    OrganizationPublic,
    OrganizationUpdate,
    TariffIn,
    TariffOut,
    WarehouseIn,
    WarehouseOut,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])

MANAGERS = {MemberRole.manager}


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrganizationCreate, user: CurrentUser, session: Session
) -> Organization:
    org = Organization(**body.model_dump())
    session.add(org)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Organization with this INN exists") from exc
    session.add(Membership(user_id=user.id, organization_id=org.id, role=MemberRole.owner))
    await session.commit()
    return org


@router.get("/my", response_model=list[MyOrganization])
async def my_organizations(user: CurrentUser, session: Session) -> list[MyOrganization]:
    rows = await session.execute(
        select(Organization, Membership.role)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == user.id)
        .order_by(Organization.id)
    )
    return [
        MyOrganization(organization=OrganizationOut.model_validate(org), role=role)
        for org, role in rows.all()
    ]


@router.get("/{organization_id}", response_model=OrganizationPublic)
async def get_organization(organization_id: int, session: Session) -> Organization:
    org = await session.get(Organization, organization_id)
    if org is None or org.status != OrganizationStatus.verified:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return org


@router.patch("/{organization_id}", response_model=OrganizationOut)
async def update_organization(
    organization_id: int, body: OrganizationUpdate, user: CurrentUser, session: Session
) -> Organization:
    await require_org_role(session, user, organization_id, set())
    org = await session.get(Organization, organization_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    await session.commit()
    return org


@router.get("/{organization_id}/members", response_model=list[MemberOut])
async def list_members(
    organization_id: int, user: CurrentUser, session: Session
) -> list[MemberOut]:
    await require_org_role(session, user, organization_id, MANAGERS)
    rows = await session.execute(
        select(User, Membership.role)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.organization_id == organization_id)
        .order_by(User.id)
    )
    return [
        MemberOut(user_id=u.id, phone=u.phone, full_name=u.full_name, role=role)
        for u, role in rows.all()
    ]


@router.post(
    "/{organization_id}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED
)
async def add_member(
    organization_id: int, body: MemberAdd, user: CurrentUser, session: Session
) -> MemberOut:
    # добавлять сотрудников может только владелец
    await require_org_role(session, user, organization_id, set())
    if body.role == MemberRole.owner:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot add another owner")
    member = await session.scalar(select(User).where(User.phone == body.phone))
    if member is None:
        member = User(phone=body.phone)
        session.add(member)
        await session.flush()
    existing = await session.scalar(
        select(Membership).where(
            Membership.user_id == member.id, Membership.organization_id == organization_id
        )
    )
    if existing is not None:
        if existing.role == MemberRole.owner:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot change the owner's role")
        existing.role = body.role
    else:
        session.add(Membership(user_id=member.id, organization_id=organization_id, role=body.role))
    await session.commit()
    return MemberOut(
        user_id=member.id, phone=member.phone, full_name=member.full_name, role=body.role
    )


@router.get("/{organization_id}/warehouses", response_model=list[WarehouseOut])
async def list_warehouses(organization_id: int, session: Session) -> list[Warehouse]:
    result = await session.scalars(
        select(Warehouse)
        .where(Warehouse.organization_id == organization_id, Warehouse.is_active.is_(True))
        .order_by(Warehouse.id)
    )
    return list(result)


@router.post(
    "/{organization_id}/warehouses",
    response_model=WarehouseOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_warehouse(
    organization_id: int, body: WarehouseIn, user: CurrentUser, session: Session
) -> Warehouse:
    await require_org_role(session, user, organization_id, MANAGERS)
    warehouse = Warehouse(organization_id=organization_id, **body.model_dump())
    session.add(warehouse)
    await session.commit()
    return warehouse


@router.put("/{organization_id}/warehouses/{warehouse_id}", response_model=WarehouseOut)
async def update_warehouse(
    organization_id: int,
    warehouse_id: int,
    body: WarehouseIn,
    user: CurrentUser,
    session: Session,
) -> Warehouse:
    await require_org_role(session, user, organization_id, MANAGERS)
    warehouse = await session.get(Warehouse, warehouse_id)
    if warehouse is None or warehouse.organization_id != organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Warehouse not found")
    for field, value in body.model_dump().items():
        setattr(warehouse, field, value)
    await session.commit()
    return warehouse


@router.get("/{organization_id}/tariffs", response_model=list[TariffOut])
async def list_tariffs(organization_id: int, session: Session) -> list[ShippingTariff]:
    result = await session.scalars(
        select(ShippingTariff)
        .where(
            ShippingTariff.organization_id == organization_id,
            ShippingTariff.is_active.is_(True),
        )
        .order_by(ShippingTariff.price_per_kg_uzs)
    )
    return list(result)


@router.post(
    "/{organization_id}/tariffs", response_model=TariffOut, status_code=status.HTTP_201_CREATED
)
async def create_tariff(
    organization_id: int, body: TariffIn, user: CurrentUser, session: Session
) -> ShippingTariff:
    await require_org_role(session, user, organization_id, MANAGERS)
    tariff = ShippingTariff(organization_id=organization_id, **body.model_dump())
    session.add(tariff)
    await session.commit()
    return tariff


@router.put("/{organization_id}/tariffs/{tariff_id}", response_model=TariffOut)
async def update_tariff(
    organization_id: int, tariff_id: int, body: TariffIn, user: CurrentUser, session: Session
) -> ShippingTariff:
    await require_org_role(session, user, organization_id, MANAGERS)
    tariff = await session.get(ShippingTariff, tariff_id)
    if tariff is None or tariff.organization_id != organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tariff not found")
    for field, value in body.model_dump().items():
        setattr(tariff, field, value)
    await session.commit()
    return tariff
