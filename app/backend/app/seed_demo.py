"""Demo customers and orders, so the dashboard has something to show while developing.

    python -m app.seed_demo            add them (does nothing if they are already there)
    python -m app.seed_demo --clear    remove every demo customer and demo order again

Everything it creates is marked: customers use an @demo.aurelle.test address (a domain that
cannot receive mail and whose password cannot be used to sign in) and order ids start with
`ord-demo-`. Demo orders hold stock like real ones, so clear them before real selling starts.
Refuses to run in production.
"""
import json
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from .catalog import RESERVATION_MINUTES, TERMS_VERSION, cost_breakdown, held_stock, shipping_service
from .config import database_url, is_prod
from .db import Database, connect, init_db

DOMAIN = "demo.aurelle.test"
ORDER_PREFIX = "ord-demo-"

# name, city, state, country, phone code
CUSTOMERS = [
    ("Rina Hartanto", "Jakarta", "DKI Jakarta", "Indonesia", "+62"),
    ("Maya Santoso", "Surabaya", "Jawa Timur", "Indonesia", "+62"),
    ("Adi Wijaya", "Singapore", "Singapore", "Singapore", "+65"),
    ("Lia Tan", "Jakarta", "DKI Jakarta", "Indonesia", "+62"),
    ("Sari Pratama", "Bandung", "Jawa Barat", "Indonesia", "+62"),
    ("Dewi Kusuma", "Denpasar", "Bali", "Indonesia", "+62"),
    ("Putri Lestari", "Yogyakarta", "DI Yogyakarta", "Indonesia", "+62"),
    ("Nadia Rahman", "Kuala Lumpur", "Kuala Lumpur", "Malaysia", "+60"),
]
# customer, hours ago, pieces, where the order stands
ORDERS = [
    (0, 0.2, 1, "paid"), (1, 0.1, 2, "unpaid"), (5, 3, 1, "paid"),
    (2, 22, 1, "packing"), (6, 27, 2, "ready"),
    (3, 50, 1, "shipped"), (7, 74, 1, "shipped"), (4, 80, 1, "expired"),
    (0, 100, 1, "delivered"), (5, 125, 2, "delivered"), (1, 150, 1, "delivered"),
    (6, 200, 1, "delivered"), (2, 250, 1, "expired"), (7, 300, 1, "delivered"),
    (3, 380, 2, "delivered"), (4, 460, 1, "delivered"), (0, 540, 1, "delivered"), (5, 650, 1, "delivered"),
]
# Status trail of each outcome after "awaiting_payment / unpaid": (status, payment status, actor, hours after the order).
TRAILS = {
    "unpaid": [],
    "expired": [("cancelled", "expired", "system", 0.5)],
    "paid": [("confirmed", "paid", "demo-gateway", 0.05)],
    "packing": [("confirmed", "paid", "demo-gateway", 0.05), ("preparing", "paid", "admin:demo", 3)],
    "ready": [("confirmed", "paid", "demo-gateway", 0.05), ("preparing", "paid", "admin:demo", 3), ("ready_to_ship", "paid", "admin:demo", 8)],
    "shipped": [("confirmed", "paid", "demo-gateway", 0.05), ("preparing", "paid", "admin:demo", 3), ("ready_to_ship", "paid", "admin:demo", 8), ("shipped", "paid", "admin:demo", 20)],
    "delivered": [("confirmed", "paid", "demo-gateway", 0.05), ("preparing", "paid", "admin:demo", 3), ("ready_to_ship", "paid", "admin:demo", 8), ("shipped", "paid", "admin:demo", 20), ("delivered", "paid", "admin:demo", 70)],
}
# Checkpoints on the way out of Jakarta, for orders that have shipped: label, note, lat, lng, hours after the order.
ROUTE = [("Jakarta workshop", "Packed and handed to the courier", -6.2088, 106.8456, 20), ("Soekarno-Hatta sorting hub", "", -6.1256, 106.6559, 26)]


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def clear(db: Database) -> tuple[int, int]:
    # Order lines, status trail and checkpoints go with their order (ON DELETE CASCADE).
    orders = db.execute("DELETE FROM orders WHERE id LIKE ?", (f"{ORDER_PREFIX}%",)).rowcount
    users = db.execute("DELETE FROM users WHERE email LIKE ?", (f"%@{DOMAIN}",)).rowcount
    return orders, users


def seed(db: Database) -> tuple[int, int]:
    rng = random.Random(2026)  # the same demo data on every machine
    now = datetime.now(timezone.utc)
    services = db.execute("SELECT * FROM shipping_services ORDER BY sort").fetchall()
    variants = db.execute(
        "SELECT v.id, v.label, v.price_idr, v.stock, p.data FROM variants v JOIN products p ON p.id = v.product_id WHERE p.active = 1 ORDER BY p.sort, v.sort"
    ).fetchall()
    held = held_stock(db)
    left = {v["id"]: v["stock"] - held.get(v["id"], 0) for v in variants}

    users = []
    for n, (name, city, state, country, code) in enumerate(CUSTOMERS):
        uid = str(uuid.uuid4())
        joined = iso(now - timedelta(days=34 - n * 3, hours=n))
        # "!" is not a bcrypt hash, so nobody can sign in to a demo account.
        db.execute(
            "INSERT INTO users (id, email, username, password_hash, role, email_verified, phone_country_code, phone, created_at) VALUES (?, ?, ?, '!', 'customer', 1, ?, ?, ?)",
            (uid, f"{name.split()[0].lower()}@{DOMAIN}", name, code, f"81{rng.randint(10_000_000, 99_999_999)}", joined),
        )
        users.append((uid, name, city, state, country, code))

    made = 0
    for n, (who, hours, pieces, outcome) in enumerate(ORDERS):
        uid, name, city, state, country, code = users[who]
        placed = now - timedelta(hours=hours)
        # An order may only take what is really left, so demo data never oversells a variant.
        chosen = [v for v in rng.sample(variants, len(variants)) if left[v["id"]] > 0][:pieces]
        if not chosen:
            continue
        lines = []
        for v in chosen:
            product = json.loads(v["data"])
            left[v["id"]] -= 1 if outcome != "expired" else 0  # an expired order gave its stock back
            lines.append({
                "productId": product["id"], "variantId": v["id"], "name": product["name"], "variantLabel": json.loads(v["label"]),
                "image": product.get("thumb") or (product["media"][0]["src"] if product.get("media") else ""), "qty": 1, "unitPriceIdr": v["price_idr"],
            })
        service = services[n % len(services)]
        costs = cost_breakdown(sum(line["unitPriceIdr"] for line in lines), service["cost_idr"])
        # Only the order still waiting for payment has a reservation that is running.
        expires = now + timedelta(minutes=RESERVATION_MINUTES) if outcome == "unpaid" else placed + timedelta(minutes=RESERVATION_MINUTES)
        data = {
            "type": "ready_stock", "items": lines, "costs": costs,
            "addressSnapshot": {
                "id": "snapshot", "isDefault": False, "recipient": name, "phoneCountryCode": code, "phone": "8123456789",
                "country": country, "state": state, "city": city, "postalCode": f"{rng.randint(10000, 99999)}", "line1": f"Jl. Melati No. {rng.randint(1, 90)}", "line2": None,
            },
            "shippingService": shipping_service(service), "paymentMethod": "qris", "currency": "IDR", "lockedRate": None,
            "termsVersion": TERMS_VERSION, "reservationExpiresAt": iso(expires),
        }
        oid = f"{ORDER_PREFIX}{n:04d}"
        number = f"AUR-RS-{placed.astimezone().strftime('%y%m%d')}-{9000 + n}"
        trail = [("awaiting_payment", "unpaid", "customer", 0), *TRAILS[outcome]]
        # Steps that would lie in the future have not happened yet.
        trail = [step for step in trail if placed + timedelta(hours=step[3]) <= now] or trail[:1]
        status, payment, _, last = trail[-1]
        shipped = status in ("shipped", "delivered")
        db.execute(
            "INSERT INTO orders (id, user_id, number, status, payment_status, total_idr, data, courier, tracking_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (oid, uid, number, status, payment, costs["total"], json.dumps(data), service["courier"] if shipped else None, f"DEMO{rng.randint(10**8, 10**9 - 1)}" if shipped else None, iso(placed), iso(placed + timedelta(hours=last))),
        )
        db.executemany("INSERT INTO order_items (order_id, variant_id, qty) VALUES (?, ?, 1)", [(oid, line["variantId"]) for line in lines])
        db.executemany(
            "INSERT INTO order_events (order_id, status, payment_status, actor, at) VALUES (?, ?, ?, ?, ?)",
            [(oid, s, p, actor, iso(placed + timedelta(hours=after))) for s, p, actor, after in trail],
        )
        if shipped:
            db.executemany(
                "INSERT INTO tracking_points (order_id, label, note, lat, lng, actor, at) VALUES (?, ?, ?, ?, ?, 'admin:demo', ?)",
                [(oid, label, note, lat, lng, iso(placed + timedelta(hours=after))) for label, note, lat, lng, after in ROUTE],
            )
        made += 1
    return made, len(users)


def main() -> None:
    if is_prod():
        sys.exit("Refusing to touch demo data: APP_ENV is production.")
    if sys.argv[1:] not in ([], ["--clear"]):
        sys.exit("Usage: python -m app.seed_demo [--clear]")
    print(f"Database: {urlsplit(database_url()).hostname}")
    init_db()
    db = connect()
    try:
        if sys.argv[1:] == ["--clear"]:
            orders, users = clear(db)
            print(f"Removed {orders} demo orders and {users} demo customers.")
        elif db.execute("SELECT 1 FROM users WHERE email LIKE ? LIMIT 1", (f"%@{DOMAIN}",)).fetchone():
            print("Demo data is already there. Run with --clear first to start over.")
        else:
            orders, users = seed(db)
            print(f"Added {users} demo customers and {orders} demo orders.")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
