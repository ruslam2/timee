from datetime import UTC, datetime
from decimal import ROUND_CEILING, Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.catalog.models import ExchangeRate


async def current_cny_rate(session: AsyncSession) -> Decimal | None:
    return await session.scalar(
        select(ExchangeRate.rate_uzs)
        .where(ExchangeRate.currency == "CNY")
        .order_by(ExchangeRate.fetched_at.desc(), ExchangeRate.id.desc())
        .limit(1)
    )


def ceil_uzs(amount: Decimal) -> int:
    return int(amount.to_integral_value(rounding=ROUND_CEILING))


def cny_fen_to_uzs(price_cny_fen: int, rate: Decimal) -> int:
    """Цена в сумах с наценкой на конвертацию, округлённая вверх до целого сума."""
    markup = 1 + settings.cny_markup_percent / 100
    return ceil_uzs(Decimal(price_cny_fen) / 100 * rate * markup)


def delivery_cost_uzs(weight_g: int, price_per_kg_uzs: int, min_weight_g: int) -> int:
    billable = max(weight_g, min_weight_g)
    return ceil_uzs(Decimal(billable) / 1000 * price_per_kg_uzs)


async def set_cny_rate(session: AsyncSession, rate: Decimal, source: str) -> ExchangeRate:
    entry = ExchangeRate(currency="CNY", rate_uzs=rate, source=source, fetched_at=datetime.now(UTC))
    session.add(entry)
    await session.commit()
    return entry


async def fetch_cbu_cny_rate() -> Decimal:
    """Официальный курс ЦБ РУз: https://cbu.uz/ru/arkhiv-kursov-valyut/json/CNY/"""
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(settings.cbu_rates_url)
        response.raise_for_status()
        data = response.json()
    item = data[0] if isinstance(data, list) else data
    return Decimal(str(item["Rate"]))
