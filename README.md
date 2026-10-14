# Magazin

Маркетплейс товаров из Китая для покупателей в Узбекистане. Продавцы и перевозчики на платформе — карго-компании: они выкладывают товары, выкупают их у поставщика, везут партиями и выдают на своих пунктах выдачи.

Архитектура и функционал описаны в документе [MagazinAPI: System Design и функционал](https://claude.ai/code/artifact/2dd9f1d6-bd5d-4e9c-9539-b8e294212b03).

## Запуск в Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec backend python -m app.seed   # категории и стартовый курс юаня
```

- Сайт: http://localhost:8080
- Документация API (Swagger): http://localhost:8080/api/docs

В режиме разработки (`ENVIRONMENT=dev`, `SMS_PROVIDER=console`) SMS не отправляются: код входа показывается прямо на странице входа и пишется в лог `docker compose logs backend`. Телефоны из `ADMIN_PHONES` при первом входе становятся администраторами платформы.

## Как пройти сценарий целиком

1. Войти с телефоном администратора (`+998900000001` по умолчанию) и в «Админке» проверить курс юаня.
2. Войти с другим номером, в «Кабинете карго» зарегистрировать компанию.
3. Администратором подтвердить компанию.
4. В кабинете карго добавить тариф, пункт выдачи и товар, отправить товар на модерацию.
5. Администратором опубликовать товар.
6. Покупателем положить товар в корзину, оформить и оплатить заказ (тестовая оплата).
7. В кабинете карго провести заказ по статусам: выкуплен → взвешен на складе в Китае → отправлен → таможня → склад в УЗ → ПВЗ → выдан по коду покупателя.

## Структура

```
backend/            FastAPI, SQLAlchemy 2 (async), Alembic, pytest
  app/core/         настройки, БД, JWT, SMS-коды
  app/modules/      accounts, organizations, catalog, orders, admin
  alembic/          миграции
  tests/            тесты API на реальном PostgreSQL
frontend/           React 18 + TypeScript + Vite, TanStack Query
  src/pages/        витрина, корзина, заказы, кабинет карго, админка
docker-compose.yml  PostgreSQL, Redis, backend, frontend (nginx)
```

## Разработка без Docker

```bash
# backend: нужен PostgreSQL и Redis
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL=postgresql+asyncpg://magazin:magazin@localhost:5432/magazin
export REDIS_URL=redis://localhost:6379/0
alembic upgrade head
uvicorn app.main:app --reload

# тесты: отдельная база magazin_test
DATABASE_URL=postgresql+asyncpg://magazin:magazin@localhost:5432/magazin_test pytest

# frontend: проксирует /api на localhost:8000
cd frontend && npm install && npm run dev
```

## Что готово и что дальше

Готово (этапы 1–2 плана): вход по SMS-коду, карго-компании с сотрудниками и ролями, проверка компаний администратором, склады и ПВЗ, тарифы доставки, каталог с вариантами и модерацией, пересчёт цен из юаней по курсу ЦБ, корзина и оформление с разбивкой по карго, заказы со всеми статусами от оплаты до выдачи, доплата или возврат по фактическому весу, отмена, спор, кабинет карго и админка, интерфейс покупателя на узбекском и русском.

Следующие шаги:

- оплата через Payme и Click с фискальными чеками (сейчас тестовая оплата);
- отправка SMS через Eskiz.uz и уведомления в Telegram-боте;
- загрузка фото в S3 (MinIO) вместо ссылок;
- партии и сканирование штрихкодов на складе;
- баланс и выплаты карго, чат с покупателем, отзывы;
- поиск на Meilisearch и автообновление курса по расписанию.
