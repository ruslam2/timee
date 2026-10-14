"""Начальные данные для пустой базы: категории и стартовый курс юаня.

Запуск: docker compose exec backend python -m app.seed
"""

import asyncio
from decimal import Decimal

from sqlalchemy import select

from app import models  # noqa: F401
from app.core.db import SessionLocal
from app.modules.catalog.models import Category
from app.modules.catalog.pricing import current_cny_rate, set_cny_rate

CATEGORIES = [
    ("clothes", "Одежда", "Kiyim-kechak"),
    ("shoes", "Обувь", "Poyabzal"),
    ("electronics", "Электроника", "Elektronika"),
    ("home", "Дом и сад", "Uy va bog'"),
    ("kids", "Детские товары", "Bolalar tovarlari"),
    ("beauty", "Красота и здоровье", "Go'zallik va salomatlik"),
    ("auto", "Автотовары", "Avtotovarlar"),
]


async def main() -> None:
    async with SessionLocal() as session:
        existing = set(await session.scalars(select(Category.slug)))
        for slug, ru, uz in CATEGORIES:
            if slug not in existing:
                session.add(Category(slug=slug, name_ru=ru, name_uz=uz))
        await session.commit()
        if await current_cny_rate(session) is None:
            # примерный курс; администратор обновляет его из ЦБ в админке
            await set_cny_rate(session, Decimal("1750"), "seed")
    print("Seed complete")


if __name__ == "__main__":
    asyncio.run(main())
