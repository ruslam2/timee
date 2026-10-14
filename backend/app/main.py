import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  регистрирует все модели
from app.core.config import settings
from app.modules.accounts.router import router as auth_router
from app.modules.admin.router import router as admin_router
from app.modules.catalog.router import router as catalog_router
from app.modules.orders.router import router as orders_router
from app.modules.organizations.router import router as organizations_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title=settings.app_name, version="0.1.0", openapi_url="/api/openapi.json", docs_url="/api/docs"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
for r in (auth_router, organizations_router, catalog_router, orders_router, admin_router):
    app.include_router(r, prefix=API_PREFIX)


@app.get("/api/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
