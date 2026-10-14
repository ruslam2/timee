from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, Session
from app.modules.catalog.models import Product, ProductStatus
from app.modules.catalog.pricing import (
    current_cny_rate,
    fetch_cbu_cny_rate,
    set_cny_rate,
)
from app.modules.catalog.router import load_product, to_schema
from app.modules.catalog.schemas import ExchangeRateOut, ProductPrivate
from app.modules.organizations.models import Organization, OrganizationStatus
from app.modules.organizations.schemas import OrganizationOut

router = APIRouter(prefix="/admin", tags=["admin"])


class RejectIn(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class VerifyIn(BaseModel):
    commission_percent: Decimal | None = Field(default=None, ge=0, le=100)


class RateIn(BaseModel):
    rate_uzs: Decimal = Field(gt=0)


@router.get("/organizations", response_model=list[OrganizationOut])
async def list_organizations(
    _: AdminUser,
    session: Session,
    status_filter: OrganizationStatus | None = Query(None, alias="status"),
) -> list[Organization]:
    query = select(Organization).order_by(Organization.id.desc())
    if status_filter is not None:
        query = query.where(Organization.status == status_filter)
    return list(await session.scalars(query))


async def _get_org(session, organization_id: int) -> Organization:
    org = await session.get(Organization, organization_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return org


@router.post("/organizations/{organization_id}/verify", response_model=OrganizationOut)
async def verify_organization(
    organization_id: int, body: VerifyIn, _: AdminUser, session: Session
) -> Organization:
    org = await _get_org(session, organization_id)
    org.status = OrganizationStatus.verified
    org.rejection_reason = None
    if body.commission_percent is not None:
        org.commission_percent = body.commission_percent
    await session.commit()
    return org


@router.post("/organizations/{organization_id}/reject", response_model=OrganizationOut)
async def reject_organization(
    organization_id: int, body: RejectIn, _: AdminUser, session: Session
) -> Organization:
    org = await _get_org(session, organization_id)
    org.status = OrganizationStatus.rejected
    org.rejection_reason = body.reason
    await session.commit()
    return org


@router.post("/organizations/{organization_id}/block", response_model=OrganizationOut)
async def block_organization(
    organization_id: int, body: RejectIn, _: AdminUser, session: Session
) -> Organization:
    org = await _get_org(session, organization_id)
    org.status = OrganizationStatus.blocked
    org.rejection_reason = body.reason
    await session.commit()
    return org


@router.get("/products", response_model=list[ProductPrivate])
async def moderation_queue(
    _: AdminUser,
    session: Session,
    status_filter: ProductStatus = Query(ProductStatus.pending, alias="status"),
) -> list[ProductPrivate]:
    products = await session.scalars(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.status == status_filter)
        .order_by(Product.updated_at)
    )
    rate = await current_cny_rate(session)
    return [to_schema(p, rate, ProductPrivate) for p in products]


@router.post("/products/{product_id}/approve", response_model=ProductPrivate)
async def approve_product(product_id: int, _: AdminUser, session: Session) -> ProductPrivate:
    product = await load_product(session, product_id)
    if product.status != ProductStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "Product is not awaiting moderation")
    product.status = ProductStatus.active
    product.rejection_reason = None
    await session.commit()
    return to_schema(product, await current_cny_rate(session), ProductPrivate)


@router.post("/products/{product_id}/reject", response_model=ProductPrivate)
async def reject_product(
    product_id: int, body: RejectIn, _: AdminUser, session: Session
) -> ProductPrivate:
    product = await load_product(session, product_id)
    product.status = ProductStatus.rejected
    product.rejection_reason = body.reason
    await session.commit()
    return to_schema(product, await current_cny_rate(session), ProductPrivate)


@router.post("/exchange-rates", response_model=ExchangeRateOut, status_code=201)
async def set_rate(body: RateIn, _: AdminUser, session: Session):
    return await set_cny_rate(session, body.rate_uzs, "manual")


@router.post("/exchange-rates/refresh", response_model=ExchangeRateOut, status_code=201)
async def refresh_rate(_: AdminUser, session: Session):
    try:
        rate = await fetch_cbu_cny_rate()
    except Exception as exc:  # сеть, формат ответа
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"cbu.uz is unavailable: {exc}") from exc
    return await set_cny_rate(session, rate, "cbu.uz")
