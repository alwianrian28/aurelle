from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def api():
    from app import auth, orders
    from app.main import create_app

    auth.login_limiter._entries.clear()
    orders.track_limiter._entries.clear()
    from app import shipping

    shipping.rate_limiter._entries.clear()
    auth._last_sent.clear()
    with TestClient(create_app()) as client:
        yield client


def register(api, email="a@example.com", password="password123", verify=True):
    r = api.post("/api/auth/register", json={"email": email, "username": "Tester", "password": password})
    assert r.status_code == 201, r.text
    if verify:
        assert api.post("/api/auth/verify", json={"token": r.json()["devToken"]}).json() == {"result": "ok"}
    return r.json()


RING = "cincin-oval-0"  # seeded variant: IDR 3,250,000, 6 in stock
ADDRESS = {"recipient": "Tester", "phoneCountryCode": "+62", "phone": "8123456789", "country": "Indonesia", "state": "DKI Jakarta", "city": "Jakarta", "postalCode": "12345", "line1": "Jl. Uji 1"}


def order_body(oid="ord-12345678", qty=2, price=3_250_000, variant=RING):
    return {"id": oid, "items": [{"variantId": variant, "qty": qty, "expectedPriceIdr": price}], "address": ADDRESS, "shippingServiceId": "ship-standard", "paymentMethod": "qris", "currency": "IDR"}


def stock_of(api, variant=RING):
    return next(v["stock"] for p in api.get("/api/catalog").json()["products"] for v in p["variants"] if v["id"] == variant)


def make_admin(api, email="admin@example.com", password="admin-password-1"):
    from app.db import connect

    other = TestClient(api.app)
    register(other, email, password)
    db = connect()
    db.execute("UPDATE users SET role = 'admin' WHERE email = ?", (email,))
    db.commit()
    db.close()
    # The dashboard has its own sign-in; the shop session above does not open staff endpoints.
    assert other.post("/api/admin/auth/login", json={"email": email, "password": password}).status_code == 200
    return other


def test_register_login_logout(api):
    user = register(api)["user"]
    assert user["emailVerified"] is False and "password_hash" not in user
    assert api.get("/api/auth/me").json()["user"]["emailVerified"] is True
    api.post("/api/auth/logout")
    assert api.get("/api/auth/me").json()["user"] is None
    assert api.post("/api/auth/login", json={"email": "A@Example.com", "password": "password123"}).status_code == 200
    assert api.post("/api/auth/register", json={"email": "a@example.com", "username": "Dup", "password": "password123"}).status_code == 409


def test_login_errors_are_generic_and_throttled(api):
    register(api)
    api.post("/api/auth/logout")
    wrong = api.post("/api/auth/login", json={"email": "a@example.com", "password": "nope-nope"})
    unknown = api.post("/api/auth/login", json={"email": "nobody@example.com", "password": "nope-nope"})
    assert wrong.status_code == unknown.status_code == 401 and wrong.json()["error"] == unknown.json()["error"]
    for _ in range(4):
        api.post("/api/auth/login", json={"email": "a@example.com", "password": "nope-nope"})
    assert api.post("/api/auth/login", json={"email": "a@example.com", "password": "password123"}).status_code == 429


def test_password_reset_is_single_use_and_ends_sessions(api):
    register(api)
    assert "devToken" not in api.post("/api/auth/forgot", json={"email": "nobody@example.com"}).json()
    token = api.post("/api/auth/forgot", json={"email": "a@example.com"}).json()["devToken"]
    assert api.post("/api/auth/reset/inspect", json={"token": token}).json() == {"result": "ok"}
    assert api.post("/api/auth/reset", json={"token": token, "password": "new-password-1"}).json() == {"result": "ok"}
    assert api.get("/api/auth/me").json()["user"] is None
    assert api.post("/api/auth/reset", json={"token": token, "password": "another-pass-1"}).json() == {"result": "used"}
    assert api.post("/api/auth/login", json={"email": "a@example.com", "password": "password123"}).status_code == 401
    assert api.post("/api/auth/login", json={"email": "a@example.com", "password": "new-password-1"}).status_code == 200


def test_cross_origin_writes_are_refused(api):
    r = api.post("/api/auth/login", json={"email": "a@example.com", "password": "x"}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


def test_catalog_is_public_and_complete(api):
    data = TestClient(api.app).get("/api/catalog").json()
    assert len(data["products"]) == 30 and data["products"][0]["thumb"].startswith("/media/thumbs/")
    assert {s["id"] for s in data["shippingServices"]} == {"ship-standard", "ship-express"} and "Indonesia" in data["servedCountries"]


def test_quote_matches_checkout_rules(api):
    r = api.post("/api/catalog/quote", json={"items": [{"variantId": RING, "qty": 2}], "shippingServiceId": "ship-standard"})
    assert r.json()["costs"]["total"] == 7_110_000
    one = api.post("/api/catalog/quote", json={"items": [{"variantId": RING, "qty": 1}], "shippingServiceId": "ship-standard"}).json()["costs"]
    assert (one["duty"], one["total"]) == (163_000, 3_698_000)  # 162.5 thousand rounds up
    assert api.post("/api/catalog/quote", json={"items": [{"variantId": "nope", "qty": 1}], "shippingServiceId": "ship-standard"}).status_code == 400


def test_server_prices_the_order(api):
    register(api, verify=False)
    assert api.post("/api/orders", json=order_body()).status_code == 403  # unverified email
    api.post("/api/auth/logout")
    register(api, "b@example.com")
    cheap = api.post("/api/orders", json=order_body(price=1))  # client cannot name its own price
    assert cheap.status_code == 409 and cheap.json() == {"error": "price_changed", "variantIds": [RING]}
    abroad = order_body()
    abroad["address"] = {**ADDRESS, "country": "France"}
    assert api.post("/api/orders", json=abroad).json()["error"] == "country_not_served"
    first = api.post("/api/orders", json=order_body())
    order = first.json()["order"]
    assert first.status_code == 201 and order["status"] == "awaiting_payment"
    # 2 x 3,250,000 + shipping 285,000 + 5% duty estimate 325,000
    assert order["costs"] == {"subtotal": 6_500_000, "tax": 0, "shipping": 285_000, "duty": 325_000, "other": 0, "total": 7_110_000}
    assert order["items"][0]["unitPriceIdr"] == 3_250_000 and order["number"].startswith("AUR-RS-")
    again = api.post("/api/orders", json=order_body())  # retry: same order, not a duplicate
    assert again.status_code == 200 and len(api.get("/api/orders").json()["orders"]) == 1


def test_stock_is_reserved_and_never_oversold(api):
    register(api)
    assert stock_of(api) == 6
    assert api.post("/api/orders", json=order_body("ord-aaaaaaaa", qty=4)).status_code == 201
    assert stock_of(api) == 2
    over = api.post("/api/orders", json=order_body("ord-bbbbbbbb", qty=3))
    assert over.status_code == 409 and over.json()["error"] == "out_of_stock"

    # Two customers race for the last two units: exactly one wins.
    from concurrent.futures import ThreadPoolExecutor

    clients = []
    for i in range(2):
        c = TestClient(api.app)
        register(c, f"racer{i}@example.com")
        clients.append(c)
    with ThreadPoolExecutor(2) as pool:
        codes = sorted(pool.map(lambda pair: pair[1].post("/api/orders", json=order_body(f"ord-race000{pair[0]}", qty=2)).status_code, enumerate(clients)))
    assert codes == [201, 409] and stock_of(api) == 0


def test_orders_are_private_to_their_owner(api):
    register(api)
    api.post("/api/orders", json=order_body())
    stranger = TestClient(api.app)
    register(stranger, "c@example.com")
    assert stranger.get("/api/orders/ord-12345678").status_code == 404
    assert stranger.post("/api/orders/ord-12345678/demo-payment", json={"paymentStatus": "paid"}).status_code == 404
    assert stranger.get("/api/admin/orders").status_code == 401  # a shop session opens no staff endpoint
    assert TestClient(api.app).get("/api/admin/orders").status_code == 401


def test_admin_flow_with_payment_gate_and_tracking(api):
    register(api)
    api.post("/api/orders", json=order_body())
    admin = make_admin(api)
    listing = admin.get("/api/admin/orders").json()
    assert listing["summary"]["awaitingPayment"] == 1 and listing["orders"][0]["customer"]["email"] == "a@example.com"
    # Unpaid: cannot move into fulfilment.
    assert admin.patch("/api/admin/orders/ord-12345678", json={"status": "preparing"}).status_code == 409
    paid = api.post("/api/orders/ord-12345678/demo-payment", json={"paymentStatus": "paid"}).json()["order"]
    assert (paid["status"], paid["paymentStatus"]) == ("confirmed", "paid")
    assert api.post("/api/orders/ord-12345678/demo-payment", json={"paymentStatus": "failed"}).status_code == 409
    for step in ("preparing", "ready_to_ship", "shipped"):
        assert admin.patch("/api/admin/orders/ord-12345678", json={"status": step}).status_code == 200
    assert admin.patch("/api/admin/orders/ord-12345678", json={"status": "preparing"}).status_code == 409
    admin.put("/api/admin/orders/ord-12345678/shipment", json={"courier": "DHL", "trackingNumber": "JKT123456"})
    assert admin.post("/api/admin/orders/ord-12345678/tracking", json={"label": "Jakarta hub", "lat": -6.2, "lng": 106.8}).status_code == 201
    assert admin.post("/api/admin/orders/ord-12345678/tracking", json={"label": "Bad", "lat": 120, "lng": 0}).status_code == 400
    mine = api.get("/api/orders/ord-12345678").json()["order"]
    assert mine["status"] == "shipped" and mine["tracking"]["trackingNumber"] == "JKT123456"
    assert [p["label"] for p in mine["tracking"]["points"]] == ["Jakarta hub"]
    assert all("actor" not in e for e in mine["history"])  # staff identity is not shown to customers
    assert api.post("/api/admin/orders/ord-12345678/tracking", json={"label": "Hack", "lat": 0, "lng": 0}).status_code == 401


def test_unpaid_order_expires_and_releases_stock(api):
    import json

    from app.db import connect

    register(api)
    api.post("/api/orders", json=order_body(qty=2))
    assert stock_of(api) == 4
    db = connect()
    data = json.loads(db.execute("SELECT data FROM orders").fetchone()[0])
    data["reservationExpiresAt"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    db.execute("UPDATE orders SET data = ?", (json.dumps(data),))
    db.commit()
    db.close()
    order = api.get("/api/orders").json()["orders"][0]
    assert (order["status"], order["paymentStatus"], order["cancelReason"]) == ("cancelled", "expired", "payment_expired")
    assert stock_of(api) == 6


def test_admin_manages_products_prices_and_stock(api):
    register(api)
    assert api.get("/api/admin/products").status_code == 401
    assert api.patch(f"/api/admin/variants/{RING}", json={"priceIdr": 1}).status_code == 401
    admin = make_admin(api)
    api.post("/api/orders", json=order_body("ord-oldprice", qty=2))  # holds 2 of 6 at the old price

    listed = next(v for p in admin.get("/api/admin/products").json()["products"] for v in p["variants"] if v["id"] == RING)
    assert (listed["available"], listed["held"]) == (4, 2)
    assert admin.patch(f"/api/admin/variants/{RING}", json={"priceIdr": 0}).status_code == 400
    assert admin.patch(f"/api/admin/variants/{RING}", json={"priceIdr": 3_500_000, "available": 10}).status_code == 200
    assert stock_of(api) == 10  # the 2 reserved units stay reserved on top

    stale = api.post("/api/orders", json=order_body("ord-staleprice", qty=1))  # still quoting 3,250,000
    assert stale.json() == {"error": "price_changed", "variantIds": [RING]}
    assert api.post("/api/orders", json=order_body("ord-newprice", qty=1, price=3_500_000)).status_code == 201
    old = api.get("/api/orders/ord-oldprice").json()["order"]
    assert old["items"][0]["unitPriceIdr"] == 3_250_000  # placed orders keep their price

    assert admin.patch("/api/admin/products/cincin-oval", json={"nameId": "Cincin Oval Baru", "active": False}).status_code == 200
    assert all(p["id"] != "cincin-oval" for p in api.get("/api/catalog").json()["products"])  # hidden from the shop
    assert api.post("/api/orders", json=order_body("ord-hidden00", qty=1, price=3_500_000)).status_code == 409

    from app.db import connect

    db = connect()
    fields = [r[0] for r in db.execute("SELECT field FROM catalog_audit ORDER BY id")]
    db.close()
    assert fields == ["price_idr", "stock", "name.id", "active"]

    edit = {"descriptionEn": "A new description.", "materialsEn": "White gold", "category": "bracelet", "active": True}
    edited = next(p for p in admin.patch("/api/admin/products/cincin-oval", json=edit).json()["products"] if p["id"] == "cincin-oval")
    assert (edited["description"]["en"], edited["materials"]["en"], edited["category"]) == ("A new description.", "White gold", "bracelet")
    assert edited["description"]["id"] and edited["media"] and edited["thumb"]  # untouched fields stay
    shop = next(p for p in api.get("/api/catalog").json()["products"] if p["id"] == "cincin-oval")
    assert (shop["description"]["en"], shop["category"]) == ("A new description.", "bracelet")
    assert admin.patch("/api/admin/products/cincin-oval", json={"category": "watch"}).status_code == 400

    # Reserved (unpaid) and sold (paid) units are reported apart.
    api.post("/api/orders/ord-newprice/demo-payment", json={"paymentStatus": "paid"})
    split = next(v for p in admin.get("/api/admin/products").json()["products"] for v in p["variants"] if v["id"] == RING)
    assert (split["available"], split["held"], split["sold"]) == (9, 2, 1)


def test_admin_adds_products_and_variants(api):
    register(api)
    size = {"labelEn": "Size 6", "sku": "MOON-RING-6", "priceIdr": 2_900_000, "available": 4}
    new = {"nameEn": "Moon Ring", "category": "ring", "descriptionEn": "A crescent.", "media": ["https://cdn.example.com/moon.jpg", "/media/moon-2.jpg"], "collectionIds": ["col-aurora"], "variants": [size]}
    assert api.post("/api/admin/products", json=new).status_code == 401
    admin = make_admin(api)
    assert admin.post("/api/admin/products", json={**new, "variants": []}).status_code == 400
    assert admin.post("/api/admin/products", json={**new, "media": ["javascript:alert(1)"]}).status_code == 400
    assert admin.post("/api/admin/products", json={**new, "variants": [{**size, "sku": "oval-ring-0"}]}).json() == {"error": "sku_taken"}

    made = admin.post("/api/admin/products", json=new)
    assert made.status_code == 201 and made.json()["id"] == "moon-ring"
    product = next(p for p in made.json()["products"] if p["id"] == "moon-ring")
    assert (product["active"], product["thumb"], product["collectionIds"]) == (False, "https://cdn.example.com/moon.jpg", ["col-aurora"])
    assert product["variants"][0] == {"id": "moon-ring-0", "sku": "MOON-RING-6", "label": {"id": "Size 6", "en": "Size 6"}, "priceIdr": 2_900_000, "available": 4, "held": 0, "sold": 0}
    assert all(p["id"] != "moon-ring" for p in api.get("/api/catalog").json()["products"])  # hidden until switched on
    assert admin.post("/api/admin/products", json={**new, "variants": [{**size, "sku": "MOON-B"}]}).json()["id"] == "moon-ring-2"  # same name, new address

    assert admin.patch("/api/admin/products/moon-ring", json={"active": True, "media": ["/media/moon-2.jpg"], "collectionIds": []}).status_code == 200
    shop = next(p for p in api.get("/api/catalog").json()["products"] if p["id"] == "moon-ring")
    assert (shop["active"], shop["collectionIds"], [m["src"] for m in shop["media"]], shop["variants"][0]["size"]) == (True, [], ["/media/moon-2.jpg"], "6")
    assert api.post("/api/orders", json=order_body("ord-moon0000", qty=1, price=2_900_000, variant="moon-ring-0")).status_code == 201

    assert admin.post("/api/admin/products/moon-ring/variants", json=size).json() == {"error": "sku_taken"}
    added = admin.post("/api/admin/products/moon-ring/variants", json={**size, "labelEn": "Size 7", "sku": "MOON-RING-7"})
    assert added.status_code == 201
    assert [v["id"] for p in added.json()["products"] if p["id"] == "moon-ring" for v in p["variants"]] == ["moon-ring-0", "moon-ring-1"]
    assert admin.delete("/api/admin/variants/moon-ring-0").json() == {"error": "variant_in_orders"}
    assert admin.delete("/api/admin/variants/moon-ring-1").status_code == 200
    assert admin.delete("/api/admin/variants/kalung-bar-0").json() == {"error": "last_variant"}


def test_admin_edits_store_settings_and_shipping(api):
    register(api)
    assert api.patch("/api/admin/settings", json={"usdToIdr": 16_000}).status_code == 401
    assert api.patch("/api/admin/shipping/ship-standard", json={"costIdr": 1}).status_code == 401
    admin = make_admin(api)
    for bad in ({"usdToIdr": 0}, {"reservationMinutes": 1}, {"servedCountries": []}, {"servedCountries": ["<b>"]}):
        assert admin.patch("/api/admin/settings", json=bad).status_code == 400, bad

    saved = admin.patch("/api/admin/settings", json={"usdToIdr": 16_250, "reservationMinutes": 45, "servedCountries": ["Indonesia", " Japan ", "Indonesia"]}).json()
    assert (saved["usdToIdr"], saved["reservationMinutes"], saved["servedCountries"]) == (16_250, 45, ["Indonesia", "Japan"])
    shop = api.get("/api/catalog").json()
    assert (shop["usdToIdr"], shop["servedCountries"]) == (16_250, ["Indonesia", "Japan"])
    # Checkout follows at once: Singapore is no longer served, and the new window is the one that runs.
    assert api.post("/api/orders", json={**order_body("ord-nosg0000"), "address": {**ADDRESS, "country": "Singapore"}}).json() == {"error": "country_not_served"}
    order = api.post("/api/orders", json=order_body("ord-window00", qty=1)).json()["order"]
    left = datetime.fromisoformat(order["reservationExpiresAt"].replace("Z", "+00:00")) - datetime.now(timezone.utc)
    assert timedelta(minutes=44) < left <= timedelta(minutes=45)

    assert admin.patch("/api/admin/shipping/nope", json={"costIdr": 1}).status_code == 404
    assert admin.patch("/api/admin/shipping/ship-standard", json={"etaDays": "12-7"}).status_code == 400
    assert admin.patch("/api/admin/shipping/ship-standard", json={"etaDays": "soon"}).status_code == 400
    edited = admin.patch("/api/admin/shipping/ship-standard", json={"courier": "JNE", "nameEn": "Standard", "etaDays": "5-9", "costIdr": 250_000}).json()
    service = next(s for s in edited["shippingServices"] if s["id"] == "ship-standard")
    assert (service["courier"], service["name"]["en"], service["etaDays"], service["costIdr"]) == ("JNE", "Standard", "5-9", 250_000)
    assert service["name"]["id"]  # the Indonesian name was not sent, so it stays
    # The seeded services write their range with an en dash; saving one unchanged must still pass.
    express = next(s for s in edited["shippingServices"] if s["id"] == "ship-express")
    assert "–" in express["etaDays"] and admin.patch("/api/admin/shipping/ship-express", json={"etaDays": express["etaDays"], "costIdr": 500_000}).status_code == 200
    assert admin.patch("/api/admin/shipping/ship-express", json={"etaDays": "9–2"}).status_code == 400
    assert api.post("/api/catalog/quote", json={"items": [{"variantId": RING, "qty": 1}], "shippingServiceId": "ship-standard"}).json()["costs"]["shipping"] == 250_000
    assert order["costs"]["shipping"] == 285_000  # the order placed before the change keeps its price

    # Adding and removing services.
    same_day = {"courier": "GoSend", "nameEn": "Same Day", "etaDays": "1", "costIdr": 45_000}
    assert api.post("/api/admin/shipping", json=same_day).status_code == 401
    assert admin.post("/api/admin/shipping", json={**same_day, "etaDays": "3-1"}).status_code == 400
    made = admin.post("/api/admin/shipping", json=same_day)
    assert made.status_code == 201 and made.json()["id"] == "ship-same-day"
    assert [s["id"] for s in made.json()["shippingServices"]] == ["ship-standard", "ship-express", "ship-same-day"]
    assert admin.post("/api/admin/shipping", json=same_day).json()["id"] == "ship-same-day-2"
    placed = api.post("/api/orders", json={**order_body("ord-sameday0", qty=1), "shippingServiceId": "ship-same-day"})
    assert placed.status_code == 201 and placed.json()["order"]["costs"]["shipping"] == 45_000
    for sid in ("ship-same-day", "ship-same-day-2", "ship-express"):
        assert admin.delete(f"/api/admin/shipping/{sid}").status_code == 200
    assert admin.delete("/api/admin/shipping/ship-standard").json() == {"error": "last_service"}
    assert admin.delete("/api/admin/shipping/ship-express").status_code == 404
    kept = api.get("/api/orders/ord-sameday0").json()["order"]
    assert kept["shippingService"]["courier"] == "GoSend"  # the order keeps the service it was placed with

    from app.db import connect

    db = connect()
    logged = [tuple(r.values()) for r in db.execute("SELECT entity, entity_id FROM catalog_audit ORDER BY id")]
    db.close()
    assert logged[:3] == [("setting", "usd_to_idr"), ("setting", "reservation_minutes"), ("setting", "served_countries")] and ("shipping", "ship-standard") in logged


def test_admin_changes_own_name_and_password(api):
    admin = make_admin(api)
    assert api.patch("/api/admin/auth/profile", json={"username": "Mallory"}).status_code == 401
    assert admin.patch("/api/admin/auth/profile", json={"username": "  "}).status_code == 400
    assert admin.patch("/api/admin/auth/profile", json={"username": "Aurelle Owner"}).json()["user"]["username"] == "Aurelle Owner"

    elsewhere = TestClient(api.app)  # the same admin, signed in on another device
    assert elsewhere.post("/api/admin/auth/login", json={"email": "admin@example.com", "password": "admin-password-1"}).status_code == 200
    new = {"current": "admin-password-1", "password": "a-brand-new-password"}
    assert admin.post("/api/admin/auth/password", json={**new, "current": "wrong"}).json() == {"error": "wrong_password"}
    assert admin.post("/api/admin/auth/password", json={**new, "password": "short"}).status_code == 400
    assert admin.post("/api/admin/auth/password", json=new).json() == {"ok": True}
    assert admin.get("/api/admin/auth/me").json()["user"]["username"] == "Aurelle Owner"  # this session stays
    assert elsewhere.get("/api/admin/auth/me").json()["user"] is None  # every other one ends
    fresh = TestClient(api.app)
    assert fresh.post("/api/admin/auth/login", json={"email": "admin@example.com", "password": "admin-password-1"}).status_code == 401
    assert fresh.post("/api/admin/auth/login", json={"email": "admin@example.com", "password": "a-brand-new-password"}).status_code == 200


def test_catalog_speaks_of_white_gold_and_old_wording_is_migrated(api):
    import json

    from app.db import connect
    from app.wording import migrate

    shop = api.get("/api/catalog").json()
    said = json.dumps([{k: p[k] for k in ("description", "materials")} | {"alt": [m["alt"] for m in p["media"]]} for p in shop["products"]] + [c["story"] for c in shop["collections"]]).lower()
    assert "silver" not in said and "mixed material" not in said and "campuran" not in said
    ring = next(p for p in shop["products"] if p["id"] == "cincin-oval")
    assert ring["materials"] == {"id": "Emas putih 18K, berlapis rhodium", "en": "18K white gold, rhodium-plated"}
    assert ring["description"]["en"] == "A solitaire ring in white gold, engineered for maximum sparkle with a minimal silhouette."
    # The src of a photo is a file name and stays; only its description changes.
    assert any("silver" in m["src"].lower() for m in ring["media"])

    # A database seeded with the old wording is brought up to date once; an admin's own text is not touched.
    db = connect()
    data = json.loads(db.execute("SELECT data FROM products WHERE id = 'cincin-oval'").fetchone()[0])
    data["materials"] = {"id": "Tampilan silver \u00b7 material demo belum terverifikasi", "en": "Silver appearance \u00b7 demo material not yet verified"}
    data["description"]["en"] = "A solitaire ring in silver-colored metal, engineered for maximum sparkle with a minimal silhouette."
    db.execute("UPDATE products SET data = ? WHERE id = 'cincin-oval'", (json.dumps(data),))
    mine = json.loads(db.execute("SELECT data FROM products WHERE id = 'kalung-bar'").fetchone()[0])
    mine["description"]["en"] = "My own words about a silver lining."
    db.execute("UPDATE products SET data = ? WHERE id = 'kalung-bar'", (json.dumps(mine),))
    db.execute("DELETE FROM settings WHERE name = 'wording_white_gold_2'")
    migrate(db)
    db.commit()
    fixed = {p["id"]: p for p in api.get("/api/catalog").json()["products"]}
    assert fixed["cincin-oval"]["materials"]["en"] == "18K white gold, rhodium-plated" and "ring in white gold," in fixed["cincin-oval"]["description"]["en"]
    assert fixed["kalung-bar"]["description"]["en"] == "My own words about a silver lining."
    # Once done it does not run again: a later admin edit that mentions silver stays.
    data["materials"]["en"] = "Silver appearance \u00b7 demo material not yet verified"
    db.execute("UPDATE products SET data = ? WHERE id = 'cincin-oval'", (json.dumps(data),))
    migrate(db)
    db.commit()
    db.close()
    assert next(p for p in api.get("/api/catalog").json()["products"] if p["id"] == "cincin-oval")["materials"]["en"].startswith("Silver appearance")


def test_admin_uploads_photos(api):
    register(api)
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    assert api.post("/api/admin/media", content=png).status_code == 401
    admin = make_admin(api)
    assert admin.post("/api/admin/media", content=b"<svg onload=alert(1)>", headers={"Content-Type": "image/png"}).json() == {"error": "not_an_image"}
    assert admin.post("/api/admin/media", content=b"\xff\xd8\xff" + b"\x00" * (4 * 1024 * 1024)).status_code == 413

    made = admin.post("/api/admin/media", content=png, headers={"Content-Type": "text/html"})  # the header is not believed
    assert made.status_code == 201 and made.json()["src"].startswith("/api/media/") and made.json()["src"].endswith(".png")
    served = TestClient(api.app).get(made.json()["src"])  # public: the shop shows it to everyone
    assert (served.content, served.headers["content-type"], served.headers["x-content-type-options"]) == (png, "image/png", "nosniff")
    assert "immutable" in served.headers["cache-control"]
    assert api.get("/api/media/nope.png").status_code == 404 and api.get(f"/api/media/{'0' * 32}.png").status_code == 404

    # Added in front of the photos the product already has (whose file names contain spaces and commas).
    before = next(p for p in admin.get("/api/admin/products").json()["products"] if p["id"] == "cincin-oval")["media"]
    assert any(" " in src for src in before)
    edited = admin.patch("/api/admin/products/cincin-oval", json={"media": [made.json()["src"], *before]})
    assert edited.status_code == 200
    after = next(p for p in edited.json()["products"] if p["id"] == "cincin-oval")
    assert (after["thumb"], after["media"]) == (made.json()["src"], [made.json()["src"], *before])
    assert admin.patch("/api/admin/products/cincin-oval", json={"media": ['/media/x"onerror="alert(1)']}).status_code == 400


def test_order_lists_do_not_query_per_order(api, monkeypatch):
    """The database can be a continent away: a list must cost the same few queries for 1 order or 100."""
    from app import db as database

    register(api)
    for n in range(3):
        api.post("/api/orders", json=order_body(f"ord-batch-{n:04d}", qty=1))
    admin = make_admin(api)
    counted = []
    original = database.Database.execute
    monkeypatch.setattr(database.Database, "execute", lambda self, sql, params=(): (counted.append(sql), original(self, sql, params))[1])
    listed = admin.get("/api/admin/orders").json()["orders"]
    assert len(listed) == 3 and all(o["customer"]["email"] == "a@example.com" and len(o["history"]) == 1 for o in listed)
    for_three = len(counted)
    api.post("/api/orders", json=order_body("ord-batch-0003", qty=1))
    counted.clear()
    assert len(admin.get("/api/admin/orders").json()["orders"]) == 4 and len(counted) == for_three <= 8
    counted.clear()
    assert len(api.get("/api/orders").json()["orders"]) == 4 and len(counted) <= 6


def test_admin_manages_collections(api):
    register(api)
    seeded = api.get("/api/catalog").json()["collections"]
    assert [c["id"] for c in seeded] == ["col-aurora", "col-noir"] and seeded[0]["productIds"][:2] == ["cincin-oval", "kalung-solitaire"]
    assert "col-aurora" in next(p for p in api.get("/api/catalog").json()["products"] if p["id"] == "cincin-oval")["collectionIds"]
    assert api.post("/api/admin/collections", json={"nameEn": "Lumen"}).status_code == 401
    admin = make_admin(api)

    made = admin.post("/api/admin/collections", json={"nameEn": "Lumen", "storyEn": "Light.", "productIds": ["kalung-bar", "cincin-oval", "kalung-bar"]})
    assert made.status_code == 201 and made.json()["id"] == "col-lumen"
    lumen = next(c for c in made.json()["collections"] if c["id"] == "col-lumen")
    assert (lumen["slug"], lumen["productIds"], lumen["active"]) == ("lumen", ["kalung-bar", "cincin-oval"], True)
    assert admin.post("/api/admin/collections", json={"nameEn": "Lumen", "productIds": ["no-such-product"]}).status_code == 400

    edit = {"nameEn": "Lumen Edit", "banner": "/media/collections/aurora.jpg", "productIds": ["cincin-oval"]}
    assert admin.patch("/api/admin/collections/col-lumen", json=edit).status_code == 200
    public = next(c for c in api.get("/api/catalog").json()["collections"] if c["id"] == "col-lumen")
    assert (public["name"]["en"], public["banner"], public["productIds"]) == ("Lumen Edit", "/media/collections/aurora.jpg", ["cincin-oval"])
    admin.patch("/api/admin/products/cincin-oval", json={"active": False})  # its only product is hidden: nothing left to show
    assert all(c["id"] != "col-lumen" for c in api.get("/api/catalog").json()["collections"])
    admin.patch("/api/admin/products/cincin-oval", json={"active": True})
    assert admin.patch("/api/admin/collections/col-lumen", json={"active": False}).status_code == 200
    assert all(c["id"] != "col-lumen" for c in api.get("/api/catalog").json()["collections"])

    left = admin.delete("/api/admin/collections/col-lumen").json()
    assert [c["id"] for c in left["collections"]] == ["col-aurora", "col-noir"] and len(left["products"]) == 30  # products stay
    assert admin.delete("/api/admin/collections/col-lumen").status_code == 404


def test_admin_lists_customers_and_store_settings(api):
    register(api)
    assert api.get("/api/admin/customers").status_code == 401
    assert api.get("/api/admin/settings").status_code == 401
    api.post("/api/orders", json=order_body("ord-paid0000", qty=1))
    api.post("/api/orders/ord-paid0000/demo-payment", json={"paymentStatus": "paid"})
    api.post("/api/orders", json=order_body("ord-unpaid00", qty=1))
    admin = make_admin(api)
    customers = admin.get("/api/admin/customers").json()["customers"]
    assert [c["email"] for c in customers] == ["a@example.com"]  # staff accounts are not customers
    assert (customers[0]["orders"], customers[0]["paidIdr"], customers[0]["emailVerified"]) == (2, 3_250_000 + 285_000 + 163_000, True)
    settings = admin.get("/api/admin/settings").json()
    assert settings["reservationMinutes"] == 30 and "Indonesia" in settings["servedCountries"] and settings["shippingServices"]


def test_overview_counts_paid_revenue_and_low_stock(api):
    register(api)
    assert api.get("/api/admin/overview").status_code == 401
    api.post("/api/orders", json=order_body("ord-paid0000", qty=5))
    api.post("/api/orders/ord-paid0000/demo-payment", json={"paymentStatus": "paid"})
    api.post("/api/orders", json=order_body("ord-unpaid00", qty=1))
    data = make_admin(api).get("/api/admin/overview").json()
    paid_total = 5 * 3_250_000 + 285_000 + 813_000  # 5% duty of 16,250,000 = 812,500 -> 813,000
    assert data["today"] == {"orders": 2, "paidIdr": paid_total}
    assert data["period"] == {"days": 7, "orders": 2, "paidOrders": 1, "paidIdr": paid_total}
    assert (data["awaitingPayment"], data["toProcess"], data["customers"]) == (1, 1, 1)
    assert data["awaitingPaymentIdr"] == 3_250_000 + 285_000 + 163_000 and data["soldOutTotal"] >= 1
    assert data["latestOrders"][0]["customer"] == "Tester" and data["topProducts"][0]["productId"] == "cincin-oval"
    admin = make_admin(api, "b@example.com")
    assert len(admin.get("/api/admin/overview?days=30").json()["daily"]) == 30
    assert admin.get("/api/admin/overview?days=400").status_code == 400
    assert len(data["daily"]) == 7 and data["daily"][-1]["orders"] == 2
    assert data["topProducts"][0]["qty"] == 5 and len(data["latestOrders"]) == 2
    ring = next(i for i in data["lowStock"] if i["sku"] == "OVAL-RING-0")
    assert ring["available"] == 0  # 6 on hand, 5 sold + 1 reserved


def test_passwords_are_bcrypt_with_cost_12(api, monkeypatch):
    from app import security
    from app.db import connect

    monkeypatch.setattr(security, "BCRYPT_ROUNDS", 12)  # the production value
    register(api, "hash@example.com", "password123")
    db = connect()
    stored = db.execute("SELECT password_hash FROM users WHERE email = 'hash@example.com'").fetchone()[0]
    db.close()
    assert stored.startswith("$2b$12$") and len(stored) == 60 and "password123" not in stored
    assert security.verify_password("password123", stored) and not security.verify_password("password124", stored)
    assert security.hash_password("password123") != stored  # fresh salt every time
    assert not security.verify_password("x", "00ff:00ff")  # old scrypt-style hashes no longer log in
    too_long = api.post("/api/auth/register", json={"email": "long@example.com", "username": "Long", "password": "p" * 73})
    assert too_long.status_code == 400


def google(api, monkeypatch, claims):
    """Sign in with a Google credential whose verified claims are `claims` (None = rejected by Google)."""
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    monkeypatch.setattr("app.auth.verify_google_credential", lambda credential, client_id: claims)
    return api.post("/api/auth/google", json={"credential": "x" * 40})


def test_google_sign_in_creates_then_reuses_the_account(api, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    assert api.get("/api/auth/config").json() == {"googleClientId": None}
    assert api.post("/api/auth/google", json={"credential": "x" * 40}).status_code == 503  # switched off

    claims = {"email": "Maya@Gmail.com", "email_verified": True, "name": "Maya Putri"}
    user = google(api, monkeypatch, claims).json()["user"]
    assert (user["email"], user["username"], user["provider"], user["emailVerified"]) == ("maya@gmail.com", "Maya Putri", "google", True)
    assert api.get("/api/auth/config").json() == {"googleClientId": "test-client.apps.googleusercontent.com"}
    assert api.get("/api/auth/me").json()["user"]["id"] == user["id"]

    api.post("/api/auth/logout")
    assert google(api, monkeypatch, claims).json()["user"]["id"] == user["id"]  # same account, not a second one
    # No password was ever set, so the password form cannot open the account.
    assert api.post("/api/auth/login", json={"email": "maya@gmail.com", "password": "password123"}).status_code == 401


def test_google_sign_in_rejects_bad_or_unverified_tokens(api, monkeypatch):
    assert google(api, monkeypatch, None).status_code == 401
    assert google(api, monkeypatch, {"email": "maya@gmail.com", "email_verified": False}).status_code == 401
    assert google(api, monkeypatch, {"email_verified": True}).status_code == 401
    assert api.get("/api/auth/me").json()["user"] is None


def test_google_sign_in_links_a_verified_account_and_takes_over_an_unverified_one(api, monkeypatch):
    verified = register(api, "owner@gmail.com")["user"]
    api.post("/api/auth/logout")
    linked = google(api, monkeypatch, {"email": "owner@gmail.com", "email_verified": True, "name": "Owner"}).json()["user"]
    assert linked["id"] == verified["id"] and linked["provider"] == "email" and linked["username"] == "Tester"
    api.post("/api/auth/logout")
    assert api.post("/api/auth/login", json={"email": "owner@gmail.com", "password": "password123"}).status_code == 200  # password kept

    # Someone registered the victim's address with their own password but never verified it.
    squatter = TestClient(api.app)
    register(squatter, "victim@gmail.com", "squatter-pass-1", verify=False)
    taken = google(api, monkeypatch, {"email": "victim@gmail.com", "email_verified": True, "name": "Victim"}).json()["user"]
    assert taken["emailVerified"] is True
    assert squatter.get("/api/auth/me").json()["user"] is None  # their session is gone
    assert squatter.post("/api/auth/login", json={"email": "victim@gmail.com", "password": "squatter-pass-1"}).status_code == 401


def test_order_can_be_tracked_with_number_and_email_only(api):
    register(api)
    placed = api.post("/api/orders", json=order_body()).json()["order"]
    admin = make_admin(api)
    api.post("/api/orders/ord-12345678/demo-payment", json={"paymentStatus": "paid"})
    for step in ("preparing", "ready_to_ship", "shipped"):
        admin.patch("/api/admin/orders/ord-12345678", json={"status": step})
    admin.put("/api/admin/orders/ord-12345678/shipment", json={"courier": "DHL", "trackingNumber": "JKT123456"})
    admin.post("/api/admin/orders/ord-12345678/tracking", json={"label": "Jakarta hub", "lat": -6.2, "lng": 106.8})

    guest = TestClient(api.app)  # not logged in
    found = guest.post("/api/orders/track", json={"number": placed["number"].lower(), "email": " A@Example.com "})
    assert found.status_code == 200, found.text
    order = found.json()["order"]
    assert (order["status"], order["tracking"]["trackingNumber"], order["destination"]) == ("shipped", "JKT123456", {"city": "Jakarta", "country": "Indonesia"})
    assert [p["label"] for p in order["tracking"]["points"]] == ["Jakarta hub"] and order["items"][0]["qty"] == 2
    # Nothing private travels with it.
    text = found.text
    assert all(secret not in text for secret in ("Jl. Uji 1", "8123456789", "a@example.com", "unitPriceIdr", "userId", "ord-12345678"))

    # Wrong email and unknown number look the same, and guessing is throttled.
    assert guest.post("/api/orders/track", json={"number": placed["number"], "email": "other@example.com"}).status_code == 404
    for _ in range(9):
        assert guest.post("/api/orders/track", json={"number": "AUR-RS-000000-0000", "email": "a@example.com"}).status_code == 404
    assert guest.post("/api/orders/track", json={"number": placed["number"], "email": "a@example.com"}).status_code == 429


def test_shop_and_dashboard_sessions_are_separate(api):
    register(api, "buyer@example.com")
    staff = make_admin(api, "boss@example.com")

    # A customer cannot sign in to the dashboard, and a shop session opens no staff endpoint.
    assert api.post("/api/admin/auth/login", json={"email": "buyer@example.com", "password": "password123"}).status_code == 401
    assert api.get("/api/admin/auth/me").json() == {"user": None}
    assert api.get("/api/admin/orders").status_code == 401

    # One browser, two accounts: the shop shows the customer while the dashboard shows the admin.
    browser = TestClient(api.app)
    assert browser.post("/api/auth/login", json={"email": "buyer@example.com", "password": "password123"}).status_code == 200
    assert browser.post("/api/admin/auth/login", json={"email": "boss@example.com", "password": "admin-password-1"}).status_code == 200
    assert browser.get("/api/auth/me").json()["user"]["email"] == "buyer@example.com"
    assert browser.get("/api/admin/auth/me").json()["user"]["email"] == "boss@example.com"
    assert browser.get("/api/admin/orders").status_code == 200

    # Signing out of one leaves the other signed in.
    browser.post("/api/auth/logout")
    assert browser.get("/api/auth/me").json() == {"user": None}
    assert browser.get("/api/admin/auth/me").json()["user"]["email"] == "boss@example.com"
    browser.post("/api/admin/auth/logout")
    assert browser.get("/api/admin/orders").status_code == 401

    # An admin who signed in to the shop only is still a visitor to the dashboard.
    shop_only = TestClient(api.app)
    shop_only.post("/api/auth/login", json={"email": "boss@example.com", "password": "admin-password-1"})
    assert shop_only.get("/api/admin/orders").status_code == 401
    # A shop cookie's value does not work as a dashboard cookie.
    shop_only.cookies.set("aurelle_admin_sid", shop_only.cookies.get("aurelle_sid"))
    assert shop_only.get("/api/admin/orders").status_code == 401

    # Losing the role ends dashboard access immediately.
    from app.db import connect

    db = connect()
    db.execute("UPDATE users SET role = 'customer' WHERE email = ?", ("boss@example.com",))
    db.commit()
    db.close()
    assert staff.get("/api/admin/orders").status_code == 401


class FakeMidtrans:
    """Stands in for Midtrans: records what we send and answers like the Snap and status APIs."""

    def __init__(self):
        self.calls, self.status = [], None

    def __call__(self, method, url, body=None, headers=None):
        self.calls.append((method, url, body, headers))
        if url.endswith("/snap/v1/transactions"):
            n = sum(1 for c in self.calls if c[1].endswith("/snap/v1/transactions"))
            return 201, {"token": f"snap-token-{n}", "redirect_url": f"https://snap.test/{n}"}
        return (200, self.status) if self.status else (404, {"status_code": "404"})


def midtrans(monkeypatch):
    monkeypatch.setenv("MIDTRANS_SERVER_KEY", "SB-Mid-server-test")
    monkeypatch.setenv("MIDTRANS_CLIENT_KEY", "SB-Mid-client-test")
    fake = FakeMidtrans()
    monkeypatch.setattr("app.payments._midtrans", fake)
    return fake


def notification(order_id, status, gross="6785000.00", key="SB-Mid-server-test", **extra):
    import hashlib

    code = "200" if status in ("settlement", "capture") else "201" if status == "pending" else "202"
    signature = hashlib.sha512(f"{order_id}{code}{gross}{key}".encode()).hexdigest()
    return {"order_id": order_id, "status_code": code, "gross_amount": gross, "transaction_status": status, "signature_key": signature, **extra}


def test_snap_transaction_is_created_once_and_priced_by_the_server(api, monkeypatch):
    register(api)
    order = api.post("/api/orders", json=order_body()).json()["order"]
    monkeypatch.delenv("MIDTRANS_SERVER_KEY", raising=False)
    assert api.get("/api/payments/config").json() == {"midtransClientKey": None, "snapUrl": None, "cardForm": "midtrans", "qrisForm": "midtrans", "environment": "sandbox"}
    assert api.post("/api/payments/ord-12345678/snap").status_code == 503  # switched off

    fake = midtrans(monkeypatch)
    assert api.get("/api/payments/config").json() == {"midtransClientKey": "SB-Mid-client-test", "snapUrl": "https://app.sandbox.midtrans.com/snap/snap.js", "cardForm": "own", "qrisForm": "own", "environment": "sandbox"}
    assert api.post("/api/payments/ord-12345678/snap").json() == {"token": "snap-token-1", "redirectUrl": "https://snap.test/1", "method": "qris"}
    assert api.post("/api/payments/ord-12345678/snap").json()["token"] == "snap-token-1"  # reused, not created twice
    creates = [c for c in fake.calls if c[1].endswith("/snap/v1/transactions")]
    assert len(creates) == 1
    _, url, body, headers = creates[0]
    assert url == "https://app.sandbox.midtrans.com/snap/v1/transactions"
    assert body["transaction_details"] == {"order_id": f"{order['number']}-1", "gross_amount": order["costs"]["total"]}
    assert sum(i["price"] * i["quantity"] for i in body["item_details"]) == order["costs"]["total"]
    assert body["enabled_payments"] == ["other_qris", "gopay"] and body["customer_details"]["email"] == "a@example.com"
    assert headers == {"X-Override-Notification": "https://byaurelle.vercel.app/api/payments/midtrans/notification"}
    # The token never reaches the browser through the order itself.
    assert "midtrans" not in api.get("/api/orders/ord-12345678").json()["order"]

    stranger = TestClient(api.app)
    register(stranger, "b@example.com")
    assert stranger.post("/api/payments/ord-12345678/snap").status_code == 404

    # Switching method: the QRIS attempt is cancelled and a card one takes its place.
    assert api.post("/api/payments/ord-12345678/snap", json={"method": "qris"}).json()["token"] == "snap-token-1"  # same method, same token
    switched = api.post("/api/payments/ord-12345678/snap", json={"method": "card"}).json()
    assert (switched["token"], switched["method"]) == ("snap-token-2", "card")
    assert ("POST", f"https://api.sandbox.midtrans.com/v2/{order['number']}-1/cancel") in [(c[0], c[1]) for c in fake.calls]
    card = [c for c in fake.calls if c[1].endswith("/snap/v1/transactions")][-1][2]
    assert card["transaction_details"]["order_id"] == f"{order['number']}-2" and card["enabled_payments"] == ["credit_card"]
    assert api.get("/api/orders/ord-12345678").json()["order"]["paymentMethod"] == "card"
    assert api.post("/api/payments/ord-12345678/snap").json()["token"] == "snap-token-2"  # no method given: the current one
    assert api.post("/api/payments/ord-12345678/snap", json={"method": "bank"}).status_code == 400
    # QRIS stays an IDR-only method, also when switching.
    usd = api.post("/api/orders", json={**order_body("ord-usd00000", qty=1), "paymentMethod": "card", "currency": "USD"})
    assert usd.status_code == 201 and api.post("/api/payments/ord-usd00000/snap", json={"method": "qris"}).status_code == 400
    assert TestClient(api.app).post("/api/payments/ord-12345678/snap").status_code == 401


def test_own_card_form_pays_a_snap_transaction_with_a_card_token(api, monkeypatch):
    register(api)
    order = api.post("/api/orders", json={**order_body(), "paymentMethod": "card"}).json()["order"]
    fake = midtrans(monkeypatch)
    total = order["costs"]["total"]
    card = {"tokenId": "481111-1114-token-abc"}
    assert api.get("/api/payments/config").json()["cardForm"] == "own"
    monkeypatch.setenv("MIDTRANS_CARD_FORM", "midtrans")  # switched back to Midtrans' form
    assert api.get("/api/payments/config").json()["cardForm"] == "midtrans"
    assert api.post("/api/payments/ord-12345678/card", json=card).json() == {"error": "card_form_off"}
    monkeypatch.delenv("MIDTRANS_CARD_FORM")
    assert TestClient(api.app).post("/api/payments/ord-12345678/card", json=card).status_code == 401
    assert api.post("/api/payments/ord-12345678/card", json={"tokenId": "4811 1111 1111 1114"}).status_code == 400  # a card number is not a token

    replies = []
    real = fake.__call__

    def with_pay(method, url, body=None, headers=None):
        if url.endswith("/pay"):
            fake.calls.append((method, url, body, headers))
            return replies.pop(0)
        return real(method, url, body, headers)

    monkeypatch.setattr("app.payments._midtrans", with_pay)
    pays = lambda: [c for c in fake.calls if c[1].endswith("/pay")]  # noqa: E731
    creates = lambda: [c[2] for c in fake.calls if c[1].endswith("/snap/v1/transactions")]  # noqa: E731

    # Midtrans turns the card down before charging anything: the customer is told to check the card.
    replies.append((200, {"status_code": "402", "status_message": "Your transaction is denied.", "gross_amount": str(total)}))
    assert api.post("/api/payments/ord-12345678/card", json=card).json() == {"error": "card_rejected"}
    assert api.get("/api/orders/ord-12345678").json()["order"]["paymentStatus"] == "unpaid"

    # The bank wants an OTP: pending, with the page to show.
    replies.append((200, {"status_code": "201", "transaction_status": "pending", "fraud_status": "accept", "gross_amount": str(total), "redirect_url": "https://api.sandbox.midtrans.com/v2/3ds/redirect/x"}))
    pending = api.post("/api/payments/ord-12345678/card", json=card).json()
    assert (pending["redirectUrl"], pending["order"]["paymentStatus"], pending["order"]["paymentMethod"]) == ("https://api.sandbox.midtrans.com/v2/3ds/redirect/x", "pending", "card")
    created = creates()[-1]
    assert created["transaction_details"] == {"order_id": f"{order['number']}-2", "gross_amount": total}  # attempt 1 was the refused card
    assert created["enabled_payments"] == ["credit_card"] and created["credit_card"] == {"secure": True}
    assert sum(i["price"] * i["quantity"] for i in created["item_details"]) == total
    _, url, body, _headers = pays()[-1]
    assert url == "https://app.sandbox.midtrans.com/snap/v1/transactions/snap-token-2/pay"
    assert body == {"payment_type": "credit_card", "payment_params": {"card_token": "481111-1114-token-abc", "save_card": False}}

    # The bank refuses: failed, and the next try is a new attempt that cancels the old one.
    replies.append((200, {"status_code": "202", "transaction_status": "deny", "gross_amount": str(total)}))
    assert api.post("/api/payments/ord-12345678/card", json=card).json()["order"]["paymentStatus"] == "failed"
    replies.append((200, {"status_code": "200", "transaction_status": "capture", "fraud_status": "accept", "gross_amount": str(total)}))
    paid = api.post("/api/payments/ord-12345678/card", json=card).json()["order"]
    assert (paid["status"], paid["paymentStatus"]) == ("confirmed", "paid")
    assert ("POST", f"https://api.sandbox.midtrans.com/v2/{order['number']}-3/cancel") in [(c[0], c[1]) for c in fake.calls]
    assert creates()[-1]["transaction_details"]["order_id"] == f"{order['number']}-4"
    assert api.post("/api/payments/ord-12345678/card", json=card).status_code == 409  # already paid

    # A payment that claims another amount is never taken as payment.
    api.post("/api/orders", json={**order_body("ord-wrongamt", qty=1), "paymentMethod": "card"})
    replies.append((200, {"status_code": "200", "transaction_status": "capture", "fraud_status": "accept", "gross_amount": "1000"}))
    assert api.post("/api/payments/ord-wrongamt/card", json=card).json()["order"]["paymentStatus"] == "unpaid"
    # Switching to QRIS afterwards starts Midtrans' form on a new attempt, not on the card one.
    qris = api.post("/api/payments/ord-wrongamt/snap", json={"method": "qris"}).json()
    assert qris["method"] == "qris" and creates()[-1]["enabled_payments"] == ["other_qris", "gopay"]


def test_own_qris_code_is_one_per_attempt(api, monkeypatch):
    register(api)
    order = api.post("/api/orders", json=order_body()).json()["order"]
    fake = midtrans(monkeypatch)
    total = order["costs"]["total"]
    # A QRIS string as Midtrans sends it: merchant name in field 59, NMID in field 51 / 02.
    qr = lambda n: f"00020101021251370014ID.CO.QRIS.WWW0215AID43864334164{n}5204605153033605405100005802ID5917Aurelle Jewellery6304ABCD"  # noqa: E731
    real = fake.__call__
    made = []

    def with_pay(method, url, body=None, headers=None):
        if url.endswith("/pay"):
            fake.calls.append((method, url, body, headers))
            made.append(qr(len(made) + 1))
            return 200, {"status_code": "201", "transaction_status": "pending", "gross_amount": str(total), "payment_type": "qris", "qr_string": made[-1]}
        return real(method, url, body, headers)

    monkeypatch.setattr("app.payments._midtrans", with_pay)
    assert TestClient(api.app).post("/api/payments/ord-12345678/qris").status_code == 401
    monkeypatch.setenv("MIDTRANS_QRIS_FORM", "midtrans")
    assert api.post("/api/payments/ord-12345678/qris").json() == {"error": "qris_form_off"}
    monkeypatch.delenv("MIDTRANS_QRIS_FORM")

    first = api.post("/api/payments/ord-12345678/qris").json()
    assert (first["qrString"], first["merchant"], first["nmid"]) == (qr(1), "Aurelle Jewellery", "AID438643341641")
    assert (first["order"]["paymentStatus"], first["order"]["paymentMethod"]) == ("pending", "qris")
    assert "midtrans" not in first["order"] and "qrString" not in first["order"]
    created = [c[2] for c in fake.calls if c[1].endswith("/snap/v1/transactions")][-1]
    assert created["transaction_details"] == {"order_id": f"{order['number']}-1", "gross_amount": total}
    assert created["enabled_payments"] == ["other_qris"] and created["expiry"]["unit"] == "minute" and 28 <= created["expiry"]["duration"] <= 30
    assert [c[2] for c in fake.calls if c[1].endswith("/pay")] == [{"payment_type": "other_qris"}]

    # Reloading the page shows the same code; it is not a new transaction.
    assert api.post("/api/payments/ord-12345678/qris").json()["qrString"] == qr(1) and len(made) == 1
    # After a failed attempt the customer gets a new code, and the old transaction is cancelled.
    api.post("/api/payments/midtrans/notification", json=notification(f"{order['number']}-1", "deny", gross=f"{total}.00"))
    again = api.post("/api/payments/ord-12345678/qris").json()
    assert again["qrString"] == qr(2) and again["order"]["paymentStatus"] == "pending"
    assert ("POST", f"https://api.sandbox.midtrans.com/v2/{order['number']}-1/cancel") in [(c[0], c[1]) for c in fake.calls]
    # Another order, the same amount: a different code.
    api.post("/api/orders", json=order_body("ord-qrother0"))
    assert api.post("/api/payments/ord-qrother0/qris").json()["qrString"] == qr(3)
    # Paid: Midtrans says so, and the code is no longer handed out.
    api.post("/api/payments/midtrans/notification", json=notification(f"{order['number']}-2", "settlement", gross=f"{total}.00"))
    assert api.get("/api/orders/ord-12345678").json()["order"]["paymentStatus"] == "paid"
    assert api.post("/api/payments/ord-12345678/qris").status_code == 409
    # QRIS stays an IDR-only method.
    api.post("/api/orders", json={**order_body("ord-usdqris0", qty=1), "paymentMethod": "card", "currency": "USD"})
    assert api.post("/api/payments/ord-usdqris0/qris").status_code == 400


def test_payment_under_way_is_closed_at_midtrans_when_the_hold_runs_out(api, monkeypatch):
    import json

    from app.db import connect

    register(api)
    fake = midtrans(monkeypatch)

    def overdue(order_id, minutes):
        db = connect()
        data = json.loads(db.execute("SELECT data FROM orders WHERE id = ?", (order_id,)).fetchone()[0])
        data["reservationExpiresAt"] = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
        db.execute("UPDATE orders SET data = ? WHERE id = ?", (json.dumps(data), order_id))
        db.commit()
        db.close()

    def pending(order_id):
        order = api.post("/api/orders", json=order_body(order_id, qty=1)).json()["order"]
        api.post(f"/api/payments/{order_id}/snap")
        api.post("/api/payments/midtrans/notification", json=notification(f"{order['number']}-1", "pending", gross=f"{order['costs']['total']}.00"))
        return order

    mine = lambda order_id: next(o for o in api.get("/api/orders").json()["orders"] if o["id"] == order_id)  # noqa: E731
    expires = lambda: [c[1] for c in fake.calls if c[1].endswith("/expire")]  # noqa: E731

    # The customer name goes to Midtrans as first and last name, not as one long first name.
    first = pending("ord-overdue1")
    customer = [c[2] for c in fake.calls if c[1].endswith("/snap/v1/transactions")][-1]["customer_details"]
    assert customer["first_name"] == "Tester" and "last_name" not in customer and customer["shipping_address"]["first_name"] == "Tester"
    from app.payments import _names
    assert _names("Alwian Rianto") == {"first_name": "Alwian", "last_name": "Rianto"} and _names("Siti Nur Haliza") == {"first_name": "Siti Nur", "last_name": "Haliza"}

    assert stock_of(api) == 5 and mine("ord-overdue1")["paymentStatus"] == "pending"
    overdue("ord-overdue1", 2)  # past the hold, inside the grace period: an OTP may still be on screen
    assert mine("ord-overdue1")["status"] == "awaiting_payment" and expires() == []
    overdue("ord-overdue1", 6)
    fake.status = {"status_code": "201", "transaction_status": "pending", "gross_amount": f"{first['costs']['total']}.00"}
    real = fake.__call__

    def closes(method, url, body=None, headers=None):
        if url.endswith("/expire"):
            fake.calls.append((method, url, body, headers))
            return 200, {"status_code": "407", "transaction_status": "expire"}
        return real(method, url, body, headers)

    monkeypatch.setattr("app.payments._midtrans", closes)
    closed = mine("ord-overdue1")
    assert (closed["status"], closed["paymentStatus"]) == ("cancelled", "expired")
    assert expires() == [f"https://api.sandbox.midtrans.com/v2/{first['number']}-1/expire"]  # closed at Midtrans first
    assert stock_of(api) == 6

    # Paid at the last moment: the order is taken as paid, nothing is expired or released.
    second = pending("ord-overdue2")
    overdue("ord-overdue2", 6)
    fake.status = {"status_code": "200", "transaction_status": "settlement", "gross_amount": f"{second['costs']['total']}.00"}
    paid = mine("ord-overdue2")
    assert (paid["status"], paid["paymentStatus"]) == ("confirmed", "paid") and len(expires()) == 1 and stock_of(api) == 5

    # Midtrans cannot be reached: the order waits rather than release stock on a guess.
    pending("ord-overdue3")
    overdue("ord-overdue3", 6)

    def down(method, url, body=None, headers=None):
        from fastapi import HTTPException

        raise HTTPException(502, "payment_provider_unreachable")

    monkeypatch.setattr("app.payments._midtrans", down)
    assert mine("ord-overdue3")["status"] == "awaiting_payment" and stock_of(api) == 4


def test_midtrans_notification_is_the_only_way_to_paid(api, monkeypatch):
    register(api)
    order = api.post("/api/orders", json=order_body()).json()["order"]
    midtrans(monkeypatch)
    api.post("/api/payments/ord-12345678/snap")
    mid = f"{order['number']}-1"
    gross = f"{order['costs']['total']}.00"
    hook = TestClient(api.app)  # Midtrans: no session, no Origin header
    state = lambda: (lambda o: (o["status"], o["paymentStatus"]))(api.get("/api/orders/ord-12345678").json()["order"])  # noqa: E731

    # Forged, unknown or wrongly priced notifications change nothing (and are not retried).
    assert hook.post("/api/payments/midtrans/notification", json=notification(mid, "settlement", gross, key="guess")).json() == {"ok": True, "ignored": "bad_signature"}
    assert hook.post("/api/payments/midtrans/notification", json=notification("AUR-RS-000000-0000-1", "settlement", gross)).json() == {"ok": True, "ignored": "unknown_order"}
    assert hook.post("/api/payments/midtrans/notification", json=notification(mid, "settlement", "1000.00")).json() == {"ok": True}
    assert hook.post("/api/payments/midtrans/notification", content=b"not json").json() == {"ok": True, "ignored": "not_json"}
    assert state() == ("awaiting_payment", "unpaid")

    assert hook.post("/api/payments/midtrans/notification", json=notification(mid, "pending", gross)).status_code == 200
    assert state() == ("awaiting_payment", "pending")
    assert hook.post("/api/payments/midtrans/notification", json=notification(mid, "settlement", gross)).status_code == 200
    assert state() == ("confirmed", "paid")
    # Midtrans may send the same notification again; nothing is recorded twice.
    events = len(api.get("/api/orders/ord-12345678").json()["order"]["history"])
    hook.post("/api/payments/midtrans/notification", json=notification(mid, "settlement", gross))
    hook.post("/api/payments/midtrans/notification", json=notification(mid, "expire", gross))
    assert state() == ("confirmed", "paid") and len(api.get("/api/orders/ord-12345678").json()["order"]["history"]) == events
    assert stock_of(api) == 4  # the units stay sold


def test_failed_payment_gets_a_new_attempt_and_sync_reads_midtrans(api, monkeypatch):
    register(api)
    order = api.post("/api/orders", json=order_body()).json()["order"]
    fake = midtrans(monkeypatch)
    gross = f"{order['costs']['total']}.00"
    api.post("/api/payments/ord-12345678/snap")

    # Nothing chosen in Snap yet: Midtrans knows no transaction, the order is untouched.
    synced = api.post("/api/payments/ord-12345678/sync").json()["order"]
    assert (synced["status"], synced["paymentStatus"]) == ("awaiting_payment", "unpaid")

    fake.status = {"status_code": "202", "transaction_status": "deny", "gross_amount": gross}
    assert api.post("/api/payments/ord-12345678/sync").json()["order"]["paymentStatus"] == "failed"
    # Retrying needs a fresh Midtrans order id.
    assert api.post("/api/payments/ord-12345678/snap").json()["token"] == "snap-token-2"
    assert [c[2]["transaction_details"]["order_id"] for c in fake.calls if c[0] == "POST"] == [f"{order['number']}-1", f"{order['number']}-2"]

    fake.status = {"status_code": "200", "transaction_status": "capture", "fraud_status": "accept", "gross_amount": gross}
    paid = api.post("/api/payments/ord-12345678/sync").json()["order"]
    assert (paid["status"], paid["paymentStatus"]) == ("confirmed", "paid")
    assert api.post("/api/payments/ord-12345678/snap").status_code == 409  # nothing left to pay


# ---------------------------------------------------------------- Biteship


class FakeBiteship:
    """Stands in for api.biteship.com: remembers what was asked and answers like the real API."""

    def __init__(self):
        self.calls, self.orders, self.down, self.refuse = [], {}, False, None
        self.history = []

    def booked(self, reference=None):
        return [o for o in self.orders.values() if reference is None or o["reference_id"] == reference]

    def answer(self, order):
        return {"success": True, "id": order["id"], "status": order["status"], "price": order["price"], "reference_id": order["reference_id"],
                "courier": {"tracking_id": order["tracking"], "waybill_id": order["waybill"], "company": order["company"], "type": order["type"],
                            "link": f"https://track.test/{order['waybill']}", "insurance": {"amount": order["insured"], "fee": 6500}, "history": self.history}}

    def __call__(self, method, path, body=None):
        from fastapi import HTTPException

        self.calls.append((method, path, body))
        if self.down:
            raise HTTPException(502, "shipping_provider_unreachable")
        if path == "/v1/rates/couriers":
            common = {"shipment_duration_unit": "days", "available_collection_method": ["pickup"], "insurance_fee": 6500}
            return 200, {"success": True, "pricing": [
                {**common, "courier_code": "sicepat", "courier_name": "SiCepat", "courier_service_code": "best", "courier_service_name": "Besok Sampai", "price": 31500, "shipment_duration_range": "1 - 1", "shipping_type": "parcel"},
                {**common, "courier_code": "jne", "courier_name": "JNE", "courier_service_code": "jtr", "courier_service_name": "JNE Trucking", "price": 9000, "shipment_duration_range": "3 - 4", "shipping_type": "freight"},
                {**common, "courier_code": "jne", "courier_name": "JNE", "courier_service_code": "reg", "courier_service_name": "Reguler", "description": "Layanan reguler", "price": 24500, "shipment_duration_range": "2 - 3", "shipping_type": "parcel", "available_collection_method": ["pickup", "drop_off"]},
            ]}
        if (method, path) == ("POST", "/v1/orders"):
            if self.refuse:
                return 400, {"success": False, "code": self.refuse, "error": "Your balance is not enough"}
            if self.booked(body["reference_id"]):
                return 400, {"success": False, "code": 40002060, "error": "reference id used", "details": {"order_id": self.booked(body["reference_id"])[0]["id"]}}
            n = len(self.orders) + 1
            self.orders[f"bs-order-{n}"] = {"id": f"bs-order-{n}", "status": "confirmed", "price": 24500, "reference_id": body["reference_id"], "tracking": f"bs-track-{n}",
                                            "waybill": f"JNE000{n}", "company": body["courier_company"], "type": body["courier_type"], "insured": body["courier_insurance"]}
            return 200, self.answer(self.orders[f"bs-order-{n}"])
        if method == "GET" and path.startswith("/v1/orders/") and path.rsplit("/", 1)[1] in self.orders:
            return 200, self.answer(self.orders[path.rsplit("/", 1)[1]])
        if method == "GET" and path.startswith("/v1/trackings/"):
            order = next((o for o in self.orders.values() if o["tracking"] == path.rsplit("/", 1)[1]), None)
            if order:
                return 200, {"success": True, "id": order["tracking"], "waybill_id": order["waybill"], "status": order["status"], "link": f"https://track.test/{order['waybill']}", "history": self.history,
                             "courier": {"company": order["company"], "driver_name": "Budi", "driver_phone": "0812000111", "driver_plate_number": "B 1234 XY", "driver_photo_url": None}}
        return 404, {"success": False, "error": "not found"}


def biteship(monkeypatch):
    monkeypatch.setenv("BITESHIP_API_KEY", "biteship_test.key")
    monkeypatch.setenv("BITESHIP_COURIERS", "jne, sicepat")
    for name, value in (("NAME", "Aurelle Store"), ("PHONE", "0811111111"), ("ADDRESS", "Jl. Toko 1, Jakarta"), ("POSTAL_CODE", "12190")):
        monkeypatch.setenv(f"BITESHIP_ORIGIN_{name}", value)
    for name in ("BITESHIP_WEBHOOK_SECRET", "BITESHIP_WEBHOOK_TOKEN", "BITESHIP_AUTO_BOOK", "ORIGIN_POSTAL_CODE"):
        monkeypatch.delenv(name, raising=False)
    fake = FakeBiteship()
    monkeypatch.setattr("app.shipping._biteship", fake)
    return fake


JNE_REG = {"courier": "jne", "service": "reg", "expectedPriceIdr": 24500}


def live_order(api, oid="ord-12345678"):
    """Checkout with the JNE Reguler rate the fake offers."""
    body = {k: v for k, v in order_body(oid).items() if k != "shippingServiceId"}
    return api.post("/api/orders", json={**body, "shippingRate": JNE_REG})


def shipping_columns(oid="ord-12345678"):
    from app.db import connect

    db = connect()
    row = db.execute("SELECT courier_company, courier_type, shipping_cost, insurance_fee, biteship_order_id, waybill_id, tracking_id, tracking_link, shipping_status, shipping_error, shipping_reference FROM orders WHERE id = ?", (oid,)).fetchone()
    db.close()
    return dict(row)


def test_biteship_is_called_with_a_bearer_key_and_a_timeout(monkeypatch):
    from app import shipping

    seen = {}

    class Answer:
        status_code = 200

        def json(self):
            return {"success": True}

    monkeypatch.setenv("BITESHIP_API_KEY", "biteship_test.key")
    monkeypatch.setattr(shipping.requests, "request", lambda method, url, **kw: (seen.update(method=method, url=url, **kw), Answer())[1])
    assert shipping._biteship("GET", "/v1/trackings/abc") == (200, {"success": True})
    assert seen["url"] == "https://api.biteship.com/v1/trackings/abc" and seen["timeout"] == 15
    assert seen["headers"]["Authorization"] == "Bearer biteship_test.key"


def test_courier_rates_come_from_biteship(api, monkeypatch):
    fake = biteship(monkeypatch)
    body = {"items": [{"variantId": RING, "qty": 2}], "postalCode": "40115"}
    assert api.post("/api/shipping/rates", json=body).status_code == 401  # signed-in customers only
    register(api)
    rates = api.post("/api/shipping/rates", json=body).json()["rates"]
    # Parcel services only (no trucking), cheapest first, insurance included in the price.
    assert [(r["courier"], r["service"], r["priceIdr"]) for r in rates] == [("jne", "reg", 24500), ("sicepat", "best", 31500)]
    assert rates[0] == {"courier": "jne", "courierName": "JNE", "service": "reg", "serviceName": "Reguler", "description": "Layanan reguler", "priceIdr": 24500, "insuranceIdr": 6500, "eta": "2 - 3", "etaUnit": "days", "collection": ["pickup", "drop_off"]}
    assert rates[1]["eta"] == "1"
    sent = fake.calls[-1][2]
    # The server's own price and the store's postal code are what Biteship is told; the goods are insured in full.
    assert (sent["origin_postal_code"], sent["destination_postal_code"], sent["couriers"], sent["courier_insurance"]) == (12190, 40115, "jne,sicepat", 6_500_000)
    assert sent["items"] == [{"name": "Oval Ring", "category": "fashion", "value": 3_250_000, "quantity": 2, "weight": 100}]
    assert api.post("/api/shipping/rates", json={**body, "postalCode": "ABCDE"}).json() == {"error": "postal_code_required"}
    assert api.post("/api/shipping/rates", json={**body, "country": "Singapore"}).json() == {"error": "country_not_served"}
    assert api.post("/api/shipping/rates", json={**body, "items": [{"variantId": "nope", "qty": 1}]}).status_code == 400


def test_rates_need_configuration(api, monkeypatch):
    register(api)
    body = {"items": [{"variantId": RING, "qty": 1}], "postalCode": "40115"}
    for name in ("BITESHIP_ORIGIN_POSTAL_CODE", "ORIGIN_POSTAL_CODE"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("BITESHIP_API_KEY", "biteship_test.key")
    for name in ("NAME", "PHONE", "ADDRESS"):
        monkeypatch.setenv(f"BITESHIP_ORIGIN_{name}", "x")
    assert api.post("/api/shipping/rates", json=body).json() == {"error": "shipping_origin_not_configured"}
    monkeypatch.setenv("ORIGIN_POSTAL_CODE", "12190")  # the shorter name is read too
    monkeypatch.setenv("BITESHIP_API_KEY", "")
    assert api.post("/api/shipping/rates", json=body).json() == {"error": "shipping_not_configured"}


def test_checkout_with_a_live_courier_rate(api, monkeypatch):
    fake = biteship(monkeypatch)
    register(api)
    body = {k: v for k, v in order_body().items() if k != "shippingServiceId"}
    # The price the customer saw must be the price the courier gives now.
    stale = api.post("/api/orders", json={**body, "shippingRate": {**JNE_REG, "expectedPriceIdr": 15000}})
    assert stale.status_code == 409 and stale.json() == {"error": "shipping_changed", "priceIdr": 24500}
    assert api.post("/api/orders", json={**body, "shippingRate": {**JNE_REG, "service": "jtr", "expectedPriceIdr": 9000}}).json() == {"error": "shipping_changed"}  # trucking is not offered
    assert api.post("/api/orders", json=body).json() == {"error": "invalid_order"}  # neither a service nor a rate
    assert api.post("/api/orders", json={**body, "address": {**ADDRESS, "country": "Singapore"}, "shippingRate": JNE_REG}).status_code == 400
    assert api.get("/api/orders").json()["orders"] == []

    placed = live_order(api)
    assert placed.status_code == 201, placed.text
    order = placed.json()["order"]
    assert order["shippingService"] == {"id": "biteship:jne:reg", "courier": "JNE", "name": {"en": "Reguler", "id": "Reguler"}, "etaDays": "2-3", "costIdr": 24500, "insuranceIdr": 6500, "biteship": {"courier": "jne", "service": "reg"}}
    assert order["costs"]["shipping"] == 24500 and order["costs"]["total"] == 6_500_000 + 24500 + order["costs"]["duty"]
    assert fake.calls[-1][2]["destination_postal_code"] == 12345
    assert shipping_columns() == {"courier_company": "jne", "courier_type": "reg", "shipping_cost": 24500, "insurance_fee": 6500, "biteship_order_id": None, "waybill_id": None,
                                  "tracking_id": None, "tracking_link": None, "shipping_status": None, "shipping_error": None, "shipping_reference": None}
    # Retrying the same checkout returns the order without asking the courier again.
    asked = len(fake.calls)
    assert live_order(api).status_code == 200 and len(fake.calls) == asked


def test_paid_order_is_booked_by_the_midtrans_notification(api, monkeypatch):
    fake = biteship(monkeypatch)
    register(api)
    order = live_order(api).json()["order"]
    midtrans(monkeypatch)
    api.post("/api/payments/ord-12345678/snap")
    paid = notification(f"{order['number']}-1", "settlement", f"{order['costs']['total']}.00")
    hook = TestClient(api.app)
    assert not fake.booked()  # nothing is booked at checkout
    assert hook.post("/api/payments/midtrans/notification", json=paid).json() == {"ok": True}

    booking = next(c[2] for c in fake.calls if c[:2] == ("POST", "/v1/orders"))
    assert booking["reference_id"] == order["number"] and (booking["courier_company"], booking["courier_type"], booking["delivery_type"]) == ("jne", "reg", "now")
    # Insured for the same amount the rate was quoted with.
    quoted = next(c[2] for c in fake.calls if c[1] == "/v1/rates/couriers")
    assert booking["courier_insurance"] == quoted["courier_insurance"] == 6_500_000 and booking["items"] == quoted["items"]
    assert (booking["destination_contact_name"], booking["destination_contact_phone"], booking["destination_postal_code"]) == ("Tester", "+628123456789", 12345)
    assert booking["destination_address"] == "Jl. Uji 1, Jakarta, DKI Jakarta" and booking["origin_postal_code"] == 12190
    assert shipping_columns() == {"courier_company": "jne", "courier_type": "reg", "shipping_cost": 24500, "insurance_fee": 6500, "biteship_order_id": "bs-order-1", "waybill_id": "JNE0001",
                                  "tracking_id": "bs-track-1", "tracking_link": "https://track.test/JNE0001", "shipping_status": "confirmed", "shipping_error": None, "shipping_reference": order["number"]}
    mine = api.get("/api/orders/ord-12345678").json()["order"]
    assert (mine["status"], mine["paymentStatus"]) == ("confirmed", "paid") and "biteship" not in mine
    assert mine["tracking"] == {"courier": "JNE", "trackingNumber": "JNE0001", "points": [], "status": "confirmed", "link": "https://track.test/JNE0001", "updatedAt": mine["tracking"]["updatedAt"]}

    # Midtrans sends the notification again: still one shipment.
    assert hook.post("/api/payments/midtrans/notification", json=paid).json() == {"ok": True}
    assert len(fake.booked()) == 1 and sum(1 for c in fake.calls if c[:2] == ("POST", "/v1/orders")) == 1


def test_a_failed_booking_does_not_fail_the_payment_and_can_be_retried(api, monkeypatch):
    fake = biteship(monkeypatch)
    register(api)
    order = live_order(api).json()["order"]
    midtrans(monkeypatch)
    api.post("/api/payments/ord-12345678/snap")
    fake.refuse = 40002010
    hook = TestClient(api.app)
    answer = hook.post("/api/payments/midtrans/notification", json=notification(f"{order['number']}-1", "settlement", f"{order['costs']['total']}.00"))
    assert answer.status_code == 200 and answer.json() == {"ok": True}
    assert api.get("/api/orders/ord-12345678").json()["order"]["paymentStatus"] == "paid"
    state = shipping_columns()
    assert state["biteship_order_id"] is None and state["shipping_error"] == "shipping_provider_error 40002010 Your balance is not enough"
    admin = make_admin(api)
    seen = admin.get("/api/admin/orders/ord-12345678").json()["order"]
    assert seen["biteship"]["error"].endswith("Your balance is not enough") and seen["biteship"]["orderId"] is None
    assert admin.post("/api/admin/orders/ord-12345678/biteship").status_code == 502  # still refused

    # Topped up: the admin books again, with the customer's service unless another is named.
    fake.refuse = None
    booked = admin.post("/api/admin/orders/ord-12345678/biteship")
    assert booked.status_code == 201, booked.text
    assert booked.json()["order"]["biteship"] == {"orderId": "bs-order-1", "trackingId": "bs-track-1", "courier": "jne", "service": "reg", "priceIdr": 24500, "insuranceIdr": 6500, "reference": order["number"], "error": None}
    assert admin.post("/api/admin/orders/ord-12345678/biteship").json() == {"error": "already_booked"}
    # Biteship being unreachable when the payment arrives is the same story.
    live_order(api, "ord-87654321")
    fake.down = True
    assert api.post("/api/orders/ord-87654321/demo-payment", json={"paymentStatus": "paid"}).json()["order"]["paymentStatus"] == "paid"
    assert shipping_columns("ord-87654321")["shipping_error"] == "shipping_provider_unreachable"


def test_a_booking_biteship_already_has_is_taken_over_and_rebooks_get_a_suffix(api, monkeypatch):
    fake = biteship(monkeypatch)
    monkeypatch.setenv("BITESHIP_AUTO_BOOK", "false")
    register(api)
    order = live_order(api).json()["order"]
    api.post("/api/orders/ord-12345678/demo-payment", json={"paymentStatus": "paid"})
    assert not fake.booked() and shipping_columns()["shipping_error"] is None  # switched off: the dashboard books
    admin = make_admin(api)
    # Booked before, but the answer never reached us: Biteship refuses the reference (40002060)
    # and the order it already has becomes this order's shipment.
    fake.orders["bs-order-1"] = {"id": "bs-order-1", "status": "confirmed", "price": 24500, "reference_id": order["number"], "tracking": "bs-track-1", "waybill": "JNE0001", "company": "jne", "type": "reg", "insured": 6_500_000}
    taken = admin.post("/api/admin/orders/ord-12345678/biteship", json={"courier": "jne", "service": "reg"})
    assert taken.status_code == 201 and taken.json()["order"]["tracking"]["trackingNumber"] == "JNE0001" and len(fake.orders) == 1
    assert shipping_columns()["shipping_reference"] == order["number"]

    # The shipment is cancelled at Biteship: the order may be booked again, under -R1, then -R2.
    fake.orders["bs-order-1"]["status"] = "cancelled"
    assert admin.post("/api/admin/orders/ord-12345678/biteship/sync").json()["order"]["tracking"]["status"] == "cancelled"
    again = admin.post("/api/admin/orders/ord-12345678/biteship", json={"courier": "sicepat", "service": "best"}).json()["order"]
    assert again["biteship"]["reference"] == f"{order['number']}-R1" and again["biteship"]["orderId"] == "bs-order-2" and again["tracking"]["trackingNumber"] == "JNE0002"
    assert (again["biteship"]["courier"], again["biteship"]["service"], again["tracking"]["status"]) == ("sicepat", "best", "confirmed")
    fake.orders["bs-order-2"]["status"] = "courierNotFound"
    admin.post("/api/admin/orders/ord-12345678/biteship/sync")
    assert admin.post("/api/admin/orders/ord-12345678/biteship").json()["order"]["biteship"]["reference"] == f"{order['number']}-R2"
    assert [o["reference_id"] for o in fake.orders.values()] == [order["number"], f"{order['number']}-R1", f"{order['number']}-R2"]
    # Unpaid orders are not shipped; customers cannot book.
    api.post("/api/orders", json=order_body("ord-87654321"))
    assert admin.post("/api/admin/orders/ord-87654321/biteship", json={"courier": "jne", "service": "reg"}).json() == {"error": "not_allowed"}
    assert api.post("/api/admin/orders/ord-12345678/biteship").status_code == 401
    assert admin.post("/api/admin/orders/ord-87654321/biteship/sync").json() == {"error": "not_booked"}


def test_biteship_webhook_and_tracking(api, monkeypatch):
    fake = biteship(monkeypatch)
    register(api)
    live_order(api)
    api.post("/api/orders/ord-12345678/demo-payment", json={"paymentStatus": "paid"})
    assert shipping_columns()["biteship_order_id"] == "bs-order-1"
    hook, outside = "/api/shipping/biteship/webhook", TestClient(api.app)
    status = lambda: api.get("/api/orders/ord-12345678").json()["order"]["status"]  # noqa: E731
    moved = {"event": "order.status", "order_id": "bs-order-1", "status": "dropping_off"}

    # Installing the webhook: an empty body wants a 200. Unknown orders and junk are acknowledged too.
    assert outside.post(hook, content=b"", headers={"content-type": "application/json"}).status_code == 200
    assert outside.post(hook, json={"event": "order.status", "order_id": "someone-else", "status": "delivered"}).json() == {"ok": True, "ignored": "unknown_order"}
    assert outside.post(hook, content=b"not json").json() == {"ok": True, "ignored": "not_json"}
    # A forged "delivered" changes nothing: the shipment is read from Biteship, which still says confirmed.
    assert outside.post(hook, json={**moved, "status": "delivered"}).json() == {"ok": True}
    assert status() == "confirmed"

    # With a token set, the address must carry it (the header of before still works).
    monkeypatch.setenv("BITESHIP_WEBHOOK_TOKEN", "t0ken")
    fake.orders["bs-order-1"]["status"] = "droppingOff"
    fake.history = [{"status": "picked", "note": "Paket dijemput", "updated_at": "2026-11-26T03:00:00Z"}, {"status": "droppingOff", "note": "Menuju alamat", "updated_at": "2026-11-27T02:00:00Z"}]
    assert outside.post(hook, json=moved).status_code == 401
    assert outside.post(f"{hook}?token=wrong", json=moved).status_code == 401
    assert outside.post(hook, content=b"").status_code == 401
    assert status() == "confirmed"
    assert outside.post(f"{hook}?token=t0ken", content=b"").status_code == 200
    assert outside.post(f"{hook}?token=t0ken", json=moved).json() == {"ok": True}
    assert status() == "shipped" and shipping_columns()["shipping_status"] == "dropping_off"
    outside.post(f"{hook}?token=t0ken", json=moved)  # Biteship retries: nothing is added
    assert [e["status"] for e in api.get("/api/orders/ord-12345678").json()["order"]["history"]].count("shipped") == 1
    monkeypatch.setenv("BITESHIP_WEBHOOK_SECRET", "s3cret")
    monkeypatch.setenv("BITESHIP_WEBHOOK_HEADER", "X-Aurelle-Hook")
    assert outside.post(hook, json=moved, headers={"X-Aurelle-Hook": "s3cret"}).status_code == 200
    assert outside.post(hook, json=moved, headers={"X-Aurelle-Hook": "nope"}).status_code == 401

    # Tracking is read from Biteship when the customer opens it: scans and the driver, nothing stored.
    for path in ("/api/orders/ord-12345678/tracking", "/api/shipping/orders/ord-12345678/tracking"):
        tracking = api.get(path).json()["tracking"]
        assert (tracking["status"], tracking["trackingNumber"], tracking["link"]) == ("dropping_off", "JNE0001", "https://track.test/JNE0001")
        assert tracking["history"] == [{"status": "picked", "note": "Paket dijemput", "at": "2026-11-26T03:00:00Z"}, {"status": "dropping_off", "note": "Menuju alamat", "at": "2026-11-27T02:00:00Z"}]
        assert tracking["driver"] == {"name": "Budi", "phone": "0812000111", "plateNumber": "B 1234 XY", "photoUrl": None}
    assert fake.calls[-1][:2] == ("GET", "/v1/trackings/bs-track-1")
    other = TestClient(api.app)
    register(other, "b@example.com")
    assert other.get("/api/orders/ord-12345678/tracking").status_code == 404  # someone else's order
    assert outside.get("/api/orders/ord-12345678/tracking").status_code == 401
    # Opening the tracking also notices a delivery the webhook has not reported yet.
    fake.orders["bs-order-1"]["status"] = "delivered"
    assert api.get("/api/orders/ord-12345678/tracking").json()["tracking"]["status"] == "delivered" and status() == "delivered"

    # Biteship cannot be reached: the webhook still answers 200 and takes the message's word;
    # tracking gives what is stored.
    fake.down = True
    assert outside.post(f"{hook}?token=t0ken", json={"event": "order.price", "order_id": "bs-order-1", "status": "delivered", "price": 27000, "courier_waybill_id": "JNE0001"}).json() == {"ok": True}
    assert shipping_columns()["shipping_cost"] == 27000
    stored = api.get("/api/orders/ord-12345678/tracking").json()["tracking"]
    assert (stored["status"], stored["history"], stored["driver"]) == ("delivered", [], None)


def test_shipping_migration_runs_again_and_backfills_old_orders(api):
    import json

    from app.db import SCHEMA, connect

    register(api)
    api.post("/api/orders", json=order_body())
    db = connect()
    # An order as the first version kept it: the shipment inside the order's JSON, no columns.
    data = json.loads(db.execute("SELECT data FROM orders WHERE id = 'ord-12345678'").fetchone()[0])
    data["shippingService"]["biteship"] = {"courier": "jne", "service": "reg"}
    data["biteship"] = {"orderId": "bs-old", "trackingId": "trk-old", "waybillId": "JNE-OLD", "courier": "jne", "service": "reg", "priceIdr": 18000, "link": "https://track.test/old", "status": "picked", "syncedAt": "2026-11-20T04:00:00.000Z"}
    db.execute("UPDATE orders SET data = ?, biteship_order_id = 'bs-old', shipping_cost = NULL WHERE id = 'ord-12345678'", (json.dumps(data),))
    db.execute("DELETE FROM settings WHERE name = 'biteship_columns_backfilled'")
    db.commit()
    for _ in range(2):  # every cold start runs it; the second run changes nothing
        db.execute(";\n".join(SCHEMA))
        db.commit()
    db.close()
    assert shipping_columns() == {"courier_company": "jne", "courier_type": "reg", "shipping_cost": 18000, "insurance_fee": None, "biteship_order_id": "bs-old", "waybill_id": "JNE-OLD",
                                  "tracking_id": "trk-old", "tracking_link": "https://track.test/old", "shipping_status": "picked", "shipping_error": None, "shipping_reference": api.get("/api/orders/ord-12345678").json()["order"]["number"]}
    tracking = api.get("/api/orders/ord-12345678").json()["order"]["tracking"]
    assert (tracking["status"], tracking["link"], tracking["updatedAt"]) == ("picked", "https://track.test/old", "2026-11-20T04:00:00.000Z")
    # The file handed to Supabase is the same migration the backend runs.
    from pathlib import Path

    from app.db import SHIPPING_MIGRATION

    assert Path(__file__).parents[1].joinpath("migrations", "2026-11-26_biteship_shipping.sql").read_text(encoding="utf-8").split("\n\n", 1)[1].strip() == ";\n\n".join(SHIPPING_MIGRATION) + ";"
