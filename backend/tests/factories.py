"""Сценарий подготовки данных: проверенное карго с тарифом, ПВЗ и активным товаром."""

from dataclasses import dataclass

from httpx import AsyncClient

from tests.conftest import ADMIN_PHONE, login

API = "/api/v1"


@dataclass
class Marketplace:
    admin: dict[str, str]
    owner: dict[str, str]
    org_id: int
    tariff_id: int
    pickup_id: int
    product_id: int
    variant_id: int


async def setup_marketplace(client: AsyncClient) -> Marketplace:
    admin = await login(client, ADMIN_PHONE)
    owner = await login(client, "+998901112233")

    r = await client.post(f"{API}/admin/exchange-rates", json={"rate_uzs": "1750"}, headers=admin)
    assert r.status_code == 201, r.text
    r = await client.post(
        f"{API}/categories",
        json={"slug": "clothes", "name_ru": "Одежда", "name_uz": "Kiyim"},
        headers=admin,
    )
    assert r.status_code == 201, r.text
    category_id = r.json()["id"]

    r = await client.post(
        f"{API}/organizations",
        json={"name": "Silk Road Cargo", "inn": "123456789"},
        headers=owner,
    )
    assert r.status_code == 201, r.text
    org_id = r.json()["id"]
    r = await client.post(f"{API}/admin/organizations/{org_id}/verify", json={}, headers=admin)
    assert r.status_code == 200, r.text

    r = await client.post(
        f"{API}/organizations/{org_id}/tariffs",
        json={
            "method": "auto",
            "name": "Авто 12-18 дней",
            "price_per_kg_uzs": 60000,
            "min_weight_g": 500,
            "days_min": 12,
            "days_max": 18,
        },
        headers=owner,
    )
    assert r.status_code == 201, r.text
    tariff_id = r.json()["id"]

    r = await client.post(
        f"{API}/organizations/{org_id}/warehouses",
        json={
            "country": "UZ",
            "kind": "pickup_point",
            "name": "ПВЗ Чиланзар",
            "city": "Ташкент",
            "address": "Чиланзар, 1",
        },
        headers=owner,
    )
    assert r.status_code == 201, r.text
    pickup_id = r.json()["id"]

    r = await client.post(
        f"{API}/organizations/{org_id}/products",
        json={
            "category_id": category_id,
            "title_ru": "Куртка зимняя",
            "title_uz": "Qishki kurtka",
            "variants": [
                {
                    "sku": "J-M",
                    "attributes": {"size": "M"},
                    "price_cny_fen": 10000,
                    "weight_g": 800,
                },
                {
                    "sku": "J-L",
                    "attributes": {"size": "L"},
                    "price_cny_fen": 11000,
                    "weight_g": 900,
                },
            ],
        },
        headers=owner,
    )
    assert r.status_code == 201, r.text
    product = r.json()
    r = await client.post(f"{API}/products/{product['id']}/submit", headers=owner)
    assert r.status_code == 200, r.text
    r = await client.post(f"{API}/admin/products/{product['id']}/approve", headers=admin)
    assert r.status_code == 200, r.text

    return Marketplace(
        admin=admin,
        owner=owner,
        org_id=org_id,
        tariff_id=tariff_id,
        pickup_id=pickup_id,
        product_id=product["id"],
        variant_id=product["variants"][0]["id"],
    )


async def place_order(client: AsyncClient, m: Marketplace, buyer: dict, quantity: int = 2) -> dict:
    r = await client.post(
        f"{API}/checkout",
        json={
            "items": [{"variant_id": m.variant_id, "quantity": quantity}],
            "deliveries": [
                {
                    "organization_id": m.org_id,
                    "tariff_id": m.tariff_id,
                    "pickup_point_id": m.pickup_id,
                }
            ],
        },
        headers=buyer,
    )
    assert r.status_code == 201, r.text
    return r.json()[0]
