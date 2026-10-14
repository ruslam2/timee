from tests.conftest import login
from tests.factories import API, place_order, setup_marketplace


async def advance(client, order_id, status, headers, **extra):
    r = await client.post(
        f"{API}/staff/orders/{order_id}/status", json={"status": status, **extra}, headers=headers
    )
    assert r.status_code == 200, r.text
    return r.json()


async def test_quote_splits_totals(client):
    m = await setup_marketplace(client)
    buyer = await login(client, "+998903333333")
    r = await client.post(
        f"{API}/checkout/quote",
        json={
            "items": [{"variant_id": m.variant_id, "quantity": 2}],
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
    assert r.status_code == 200, r.text
    q = r.json()["orders"][0]
    assert q["goods_total_uzs"] == 357000  # 2 * 178500
    assert q["declared_weight_g"] == 1600
    assert q["delivery_estimate_uzs"] == 96000  # 1.6 кг * 60000
    assert q["commission_uzs"] == 17850  # 5%
    assert q["total_uzs"] == 357000 + 96000 + 17850


async def test_full_order_lifecycle_with_weight_surcharge(client):
    m = await setup_marketplace(client)
    buyer = await login(client, "+998903333333")
    order = await place_order(client, m, buyer)
    assert order["status"] == "created"
    assert order["amount_due_uzs"] == order["total_uzs"]
    oid = order["id"]

    r = await client.post(f"{API}/orders/{oid}/pay", json={"provider": "mock"}, headers=buyer)
    assert r.status_code == 200, r.text

    await advance(client, oid, "purchased", m.owner, supplier_order_ref="1688-555")

    # склад в Китае: сотрудник с ролью warehouse_cn
    r = await client.post(
        f"{API}/organizations/{m.org_id}/members",
        json={"phone": "+8613800000000", "role": "warehouse_cn"},
        headers=m.owner,
    )
    assert r.status_code == 201
    cn = await login(client, "+8613800000000")
    r = await client.post(
        f"{API}/staff/orders/{oid}/weigh", json={"actual_weight_g": 2000}, headers=cn
    )
    assert r.status_code == 200, r.text
    weighed = r.json()
    assert weighed["status"] == "received_cn"
    assert weighed["delivery_adjustment_uzs"] == 120000 - 96000
    assert "pickup_code" not in weighed

    # отправить в партию нельзя, пока доплата не оплачена
    r = await client.post(
        f"{API}/staff/orders/{oid}/status", json={"status": "shipped"}, headers=cn
    )
    assert r.status_code == 409
    r = await client.get(f"{API}/orders/{oid}", headers=buyer)
    assert r.json()["amount_due_uzs"] == 24000
    r = await client.post(f"{API}/orders/{oid}/pay", json={"provider": "mock"}, headers=buyer)
    assert r.status_code == 200

    await advance(client, oid, "shipped", cn)
    # склад в Китае не может менять статусы узбекской стороны
    r = await client.post(
        f"{API}/staff/orders/{oid}/status", json={"status": "customs"}, headers=cn
    )
    assert r.status_code == 403
    await advance(client, oid, "customs", m.owner)
    await advance(client, oid, "arrived_uz", m.owner)
    await advance(client, oid, "at_pickup", m.owner)

    r = await client.post(
        f"{API}/staff/orders/{oid}/deliver", json={"pickup_code": "000000"}, headers=m.owner
    )
    code = (await client.get(f"{API}/orders/{oid}", headers=buyer)).json()["pickup_code"]
    if code != "000000":
        assert r.status_code == 400
    r = await client.post(
        f"{API}/staff/orders/{oid}/deliver", json={"pickup_code": code}, headers=m.owner
    )
    assert r.status_code == 200, r.text
    final = (await client.get(f"{API}/orders/{oid}", headers=buyer)).json()
    assert final["status"] == "delivered"
    assert [e["status"] for e in final["events"]][-1] == "delivered"
    assert final["amount_due_uzs"] == 0


async def test_lighter_parcel_creates_refund(client):
    m = await setup_marketplace(client)
    buyer = await login(client, "+998903333333")
    order = await place_order(client, m, buyer)
    oid = order["id"]
    await client.post(f"{API}/orders/{oid}/pay", json={"provider": "mock"}, headers=buyer)
    await advance(client, oid, "purchased", m.owner)
    r = await client.post(
        f"{API}/staff/orders/{oid}/weigh", json={"actual_weight_g": 1000}, headers=m.owner
    )
    body = r.json()
    assert body["delivery_adjustment_uzs"] == 60000 - 96000
    refunds = [p for p in body["payments"] if p["kind"] == "refund"]
    assert refunds[0]["amount_uzs"] == 36000
    await advance(client, oid, "shipped", m.owner)


async def test_cancel_paid_order_refunds_and_blocks_after_purchase(client):
    m = await setup_marketplace(client)
    buyer = await login(client, "+998903333333")
    first = await place_order(client, m, buyer)
    await client.post(f"{API}/orders/{first['id']}/pay", json={"provider": "mock"}, headers=buyer)
    r = await client.post(f"{API}/orders/{first['id']}/cancel", json={}, headers=buyer)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "cancelled"
    assert any(
        p["kind"] == "refund" and p["amount_uzs"] == first["total_uzs"] for p in body["payments"]
    )

    second = await place_order(client, m, buyer)
    await client.post(f"{API}/orders/{second['id']}/pay", json={"provider": "mock"}, headers=buyer)
    await advance(client, second["id"], "purchased", m.owner)
    r = await client.post(f"{API}/orders/{second['id']}/cancel", json={}, headers=buyer)
    assert r.status_code == 409


async def test_buyers_cannot_see_each_others_orders(client):
    m = await setup_marketplace(client)
    buyer = await login(client, "+998903333333")
    other = await login(client, "+998904444444")
    order = await place_order(client, m, buyer)
    r = await client.get(f"{API}/orders/{order['id']}", headers=other)
    assert r.status_code == 404
    r = await client.get(f"{API}/staff/orders/{order['id']}", headers=other)
    assert r.status_code == 404
    r = await client.post(
        f"{API}/staff/orders/{order['id']}/status", json={"status": "paid"}, headers=m.owner
    )
    assert r.status_code == 409  # оплату ставит только платёжная система


async def test_dispute_after_delivery_only(client):
    m = await setup_marketplace(client)
    buyer = await login(client, "+998903333333")
    order = await place_order(client, m, buyer)
    r = await client.post(
        f"{API}/orders/{order['id']}/dispute", json={"comment": "Не тот размер"}, headers=buyer
    )
    assert r.status_code == 409
