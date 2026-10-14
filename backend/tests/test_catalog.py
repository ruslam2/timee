from tests.conftest import login
from tests.factories import API, setup_marketplace


async def test_public_catalog_shows_approved_products_with_uzs_price(client):
    m = await setup_marketplace(client)
    r = await client.get(f"{API}/products", params={"q": "куртка"})
    assert r.status_code == 200
    page = r.json()
    assert page["total"] == 1
    item = page["items"][0]
    # 100 CNY * 1750 * 1.02 = 178500 сум
    assert item["variants"][0]["price_uzs"] == 178500
    assert item["min_price_uzs"] == 178500
    assert "supplier_url" not in item

    r = await client.get(f"{API}/products/{m.product_id}")
    assert r.status_code == 200


async def test_unverified_org_cannot_submit_and_is_hidden(client):
    m = await setup_marketplace(client)
    other = await login(client, "+998905555555")
    r = await client.post(
        f"{API}/organizations", json={"name": "New Cargo", "inn": "987654321"}, headers=other
    )
    org_id = r.json()["id"]
    r = await client.post(
        f"{API}/organizations/{org_id}/products",
        json={
            "category_id": 1,
            "title_ru": "Сумка",
            "title_uz": "Sumka",
            "variants": [{"sku": "B1", "price_cny_fen": 5000, "weight_g": 300}],
        },
        headers=other,
    )
    assert r.status_code == 201
    r = await client.post(f"{API}/products/{r.json()['id']}/submit", headers=other)
    assert r.status_code == 409
    r = await client.get(f"{API}/products")
    assert r.json()["total"] == 1
    assert m.product_id == r.json()["items"][0]["id"]


async def test_editing_active_product_sends_it_back_to_moderation(client):
    m = await setup_marketplace(client)
    r = await client.put(
        f"{API}/products/{m.product_id}",
        json={
            "category_id": 1,
            "title_ru": "Куртка зимняя 2",
            "title_uz": "Qishki kurtka 2",
            "variants": [{"sku": "J-M", "price_cny_fen": 12000, "weight_g": 800}],
        },
        headers=m.owner,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "pending"
    by_sku = {v["sku"]: v for v in body["variants"]}
    assert by_sku["J-M"]["price_cny_fen"] == 12000
    assert by_sku["J-L"]["is_active"] is False
    r = await client.get(f"{API}/products")
    assert r.json()["total"] == 0


async def test_only_members_manage_products(client):
    m = await setup_marketplace(client)
    stranger = await login(client, "+998907777777")
    r = await client.get(f"{API}/organizations/{m.org_id}/products", headers=stranger)
    assert r.status_code == 403
    r = await client.post(f"{API}/admin/products/{m.product_id}/approve", headers=stranger)
    assert r.status_code == 403
