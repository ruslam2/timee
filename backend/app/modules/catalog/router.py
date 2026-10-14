from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, CurrentUser, Session, require_org_role
from app.modules.catalog.models import (
    Category,
    ExchangeRate,
    Product,
    ProductStatus,
    ProductVariant,
)
from app.modules.catalog.pricing import cny_fen_to_uzs, current_cny_rate
from app.modules.catalog.schemas import (
    CategoryIn,
    CategoryOut,
    ExchangeRateOut,
    ProductIn,
    ProductOut,
    ProductPage,
    ProductPrivate,
    VariantOut,
)
from app.modules.organizations.models import MemberRole, Organization, OrganizationStatus

router = APIRouter(tags=["catalog"])


def to_schema[P: (ProductOut, ProductPrivate)](
    product: Product, rate: Decimal | None, schema: type[P] = ProductOut
) -> P:
    out = schema.model_validate(product)
    if rate is not None:
        out.variants = [
            VariantOut.model_validate(v).model_copy(
                update={"price_uzs": cny_fen_to_uzs(v.price_cny_fen, rate)}
            )
            for v in product.variants
        ]
        prices = [v.price_uzs for v in out.variants if v.is_active and v.price_uzs is not None]
        out.min_price_uzs = min(prices) if prices else None
    return out


async def load_product(session: AsyncSession, product_id: int) -> Product:
    product = await session.scalar(
        select(Product).options(selectinload(Product.variants)).where(Product.id == product_id)
    )
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


# --- категории ---


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(session: Session) -> list[Category]:
    return list(await session.scalars(select(Category).order_by(Category.name_ru)))


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryIn, _: AdminUser, session: Session) -> Category:
    category = Category(**body.model_dump())
    session.add(category)
    await session.commit()
    return category


# --- курс ---


@router.get("/exchange-rates/current", response_model=ExchangeRateOut)
async def get_current_rate(session: Session) -> ExchangeRate:
    rate = await session.scalar(
        select(ExchangeRate)
        .where(ExchangeRate.currency == "CNY")
        .order_by(ExchangeRate.fetched_at.desc(), ExchangeRate.id.desc())
        .limit(1)
    )
    if rate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exchange rate is not set")
    return rate


# --- витрина ---


@router.get("/products", response_model=ProductPage)
async def list_products(
    session: Session,
    q: str | None = None,
    category_id: int | None = None,
    organization_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
) -> ProductPage:
    query = (
        select(Product)
        .join(Organization, Organization.id == Product.organization_id)
        .where(
            Product.status == ProductStatus.active,
            Organization.status == OrganizationStatus.verified,
        )
    )
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(or_(Product.title_ru.ilike(pattern), Product.title_uz.ilike(pattern)))
    if category_id is not None:
        query = query.where(Product.category_id == category_id)
    if organization_id is not None:
        query = query.where(Product.organization_id == organization_id)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    products = await session.scalars(
        query.options(selectinload(Product.variants))
        .order_by(Product.created_at.desc(), Product.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rate = await current_cny_rate(session)
    return ProductPage(
        items=[to_schema(p, rate) for p in products],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.get("/products/{product_id}", response_model=ProductOut)
async def get_product(product_id: int, session: Session) -> ProductOut:
    product = await load_product(session, product_id)
    org = await session.get(Organization, product.organization_id)
    if product.status != ProductStatus.active or org.status != OrganizationStatus.verified:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return to_schema(product, await current_cny_rate(session))


# --- кабинет карго ---

EDITORS = {MemberRole.manager}


@router.get("/organizations/{organization_id}/products", response_model=list[ProductPrivate])
async def list_org_products(
    organization_id: int,
    user: CurrentUser,
    session: Session,
    status_filter: ProductStatus | None = Query(None, alias="status"),
) -> list[ProductPrivate]:
    await require_org_role(session, user, organization_id, EDITORS)
    query = (
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.organization_id == organization_id)
        .order_by(Product.id.desc())
    )
    if status_filter is not None:
        query = query.where(Product.status == status_filter)
    rate = await current_cny_rate(session)
    return [to_schema(p, rate, ProductPrivate) for p in await session.scalars(query)]


@router.post(
    "/organizations/{organization_id}/products",
    response_model=ProductPrivate,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    organization_id: int, body: ProductIn, user: CurrentUser, session: Session
) -> ProductPrivate:
    await require_org_role(session, user, organization_id, EDITORS)
    if await session.get(Category, body.category_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown category")
    data = body.model_dump(exclude={"variants"})
    product = Product(
        organization_id=organization_id,
        **data,
        variants=[ProductVariant(**v.model_dump()) for v in body.variants],
    )
    session.add(product)
    await session.commit()
    product = await load_product(session, product.id)
    return to_schema(product, await current_cny_rate(session), ProductPrivate)


@router.put("/products/{product_id}", response_model=ProductPrivate)
async def update_product(
    product_id: int, body: ProductIn, user: CurrentUser, session: Session
) -> ProductPrivate:
    product = await load_product(session, product_id)
    await require_org_role(session, user, product.organization_id, EDITORS)
    if await session.get(Category, body.category_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown category")
    for field, value in body.model_dump(exclude={"variants"}).items():
        setattr(product, field, value)
    # варианты сопоставляются по SKU, чтобы не ломать ссылки из прошлых заказов
    existing = {v.sku: v for v in product.variants}
    incoming = {v.sku for v in body.variants}
    for v in body.variants:
        if v.sku in existing:
            for field, value in v.model_dump().items():
                setattr(existing[v.sku], field, value)
        else:
            product.variants.append(ProductVariant(**v.model_dump()))
    for sku, variant in existing.items():
        if sku not in incoming:
            variant.is_active = False
    # любое изменение активного товара отправляет его на повторную модерацию
    if product.status in (ProductStatus.active, ProductStatus.rejected):
        product.status = ProductStatus.pending
    await session.commit()
    product = await load_product(session, product.id)
    return to_schema(product, await current_cny_rate(session), ProductPrivate)


@router.post("/products/{product_id}/submit", response_model=ProductPrivate)
async def submit_product(product_id: int, user: CurrentUser, session: Session) -> ProductPrivate:
    product = await load_product(session, product_id)
    await require_org_role(session, user, product.organization_id, EDITORS, verified=True)
    if product.status not in (ProductStatus.draft, ProductStatus.rejected):
        raise HTTPException(status.HTTP_409_CONFLICT, "Product cannot be submitted now")
    product.status = ProductStatus.pending
    product.rejection_reason = None
    await session.commit()
    return to_schema(product, await current_cny_rate(session), ProductPrivate)


@router.post("/products/{product_id}/archive", response_model=ProductPrivate)
async def archive_product(product_id: int, user: CurrentUser, session: Session) -> ProductPrivate:
    product = await load_product(session, product_id)
    await require_org_role(session, user, product.organization_id, EDITORS)
    product.status = ProductStatus.archived
    await session.commit()
    return to_schema(product, await current_cny_rate(session), ProductPrivate)
