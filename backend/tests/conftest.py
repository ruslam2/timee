import os

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://magazin:magazin@localhost:5432/magazin_test"
)
os.environ["ENVIRONMENT"] = "dev"
os.environ["SMS_PROVIDER"] = "console"
os.environ["ADMIN_PHONES"] = '["+998900000001"]'

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.db import Base, engine  # noqa: E402
from app.core.otp import MemoryOtpStore, get_otp_store  # noqa: E402
from app.main import app  # noqa: E402

ADMIN_PHONE = "+998900000001"
otp_store = MemoryOtpStore()
app.dependency_overrides[get_otp_store] = lambda: otp_store


@pytest.fixture(scope="session", autouse=True)
async def schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def clean_tables():
    yield
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def login(client: AsyncClient, phone: str) -> dict[str, str]:
    r = await client.post("/api/v1/auth/otp/request", json={"phone": phone})
    assert r.status_code == 200, r.text
    code = r.json()["debug_code"]
    r = await client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
