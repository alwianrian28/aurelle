from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def api():
    from app import auth, orders
    from app.main import create_app

    auth.login_limiter._entries.clear()
    orders.track_limiter._entries.clear()
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


def test_overview_counts_paid_revenue_and_low_stock(api):
    register(api)
    assert api.get("/api/admin/overview").status_code == 401
    api.post("/api/orders", json=order_body("ord-paid0000", qty=5))
    api.post("/api/orders/ord-paid0000/demo-payment", json={"paymentStatus": "paid"})
    api.post("/api/orders", json=order_body("ord-unpaid00", qty=1))
    data = make_admin(api).get("/api/admin/overview").json()
    paid_total = 5 * 3_250_000 + 285_000 + 813_000  # 5% duty of 16,250,000 = 812,500 -> 813,000
    assert data["today"] == {"orders": 2, "paidIdr": paid_total} and data["week"]["paidIdr"] == paid_total
    assert (data["awaitingPayment"], data["toProcess"], data["customers"]) == (1, 1, 1)
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
    assert api.get("/api/payments/config").json() == {"midtransClientKey": None, "snapUrl": None}
    assert api.post("/api/payments/ord-12345678/snap").status_code == 503  # switched off

    fake = midtrans(monkeypatch)
    assert api.get("/api/payments/config").json() == {"midtransClientKey": "SB-Mid-client-test", "snapUrl": "https://app.sandbox.midtrans.com/snap/snap.js"}
    assert api.post("/api/payments/ord-12345678/snap").json() == {"token": "snap-token-1", "redirectUrl": "https://snap.test/1"}
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
    assert TestClient(api.app).post("/api/payments/ord-12345678/snap").status_code == 401


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
