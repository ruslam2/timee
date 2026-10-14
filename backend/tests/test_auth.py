from tests.conftest import ADMIN_PHONE, login

API = "/api/v1"


async def test_login_creates_user(client):
    headers = await login(client, "+998 90 123-45-67")
    r = await client.get(f"{API}/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["phone"] == "+998901234567"
    assert r.json()["is_admin"] is False


async def test_admin_phone_gets_admin(client):
    headers = await login(client, ADMIN_PHONE)
    r = await client.get(f"{API}/auth/me", headers=headers)
    assert r.json()["is_admin"] is True


async def test_wrong_code_rejected(client):
    r = await client.post(f"{API}/auth/otp/request", json={"phone": "+998901111111"})
    code = r.json()["debug_code"]
    wrong = f"{(int(code) + 1) % 1_000_000:06d}"
    r = await client.post(f"{API}/auth/otp/verify", json={"phone": "+998901111111", "code": wrong})
    assert r.status_code == 400
    # правильный код после одной ошибки всё ещё работает, но только один раз
    r = await client.post(f"{API}/auth/otp/verify", json={"phone": "+998901111111", "code": code})
    assert r.status_code == 200
    r = await client.post(f"{API}/auth/otp/verify", json={"phone": "+998901111111", "code": code})
    assert r.status_code == 400


async def test_refresh_and_profile_update(client):
    r = await client.post(f"{API}/auth/otp/request", json={"phone": "+998902222222"})
    code = r.json()["debug_code"]
    tokens = (
        await client.post(f"{API}/auth/otp/verify", json={"phone": "+998902222222", "code": code})
    ).json()
    r = await client.post(f"{API}/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    # access-токен нельзя использовать как refresh
    r = await client.post(f"{API}/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert r.status_code == 401
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    r = await client.patch(
        f"{API}/auth/me", json={"full_name": "Азиз", "language": "ru"}, headers=headers
    )
    assert r.json()["full_name"] == "Азиз"


async def test_requires_auth(client):
    r = await client.get(f"{API}/auth/me")
    assert r.status_code == 401
