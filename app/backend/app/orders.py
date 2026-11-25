"""Orders (F-08/F-18), the admin order desk, and shipment tracking checkpoints."""
import json
import random
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field, StrictInt

from .auth import Admin, Db, User, now_iso
from .catalog import TERMS_VERSION, cost_breakdown, held_stock, reservation_minutes, served_countries, shipping_service, usd_to_idr
from .config import is_prod
from .db import Database, IntegrityError, Row
from .security import Limiter

# Mirrors ReadyStockOrderStatus in the web app's domain types.
Status = Literal["awaiting_payment", "confirmed", "preparing", "ready_to_ship", "shipped", "delivered", "cancelled", "pending_decision"]

# Fulfilment steps an admin may take from each status.
ADMIN_NEXT: dict[str, list[str]] = {
    "awaiting_payment": ["cancelled"],
    "confirmed": ["preparing", "cancelled"],
    "preparing": ["ready_to_ship", "cancelled"],
    "ready_to_ship": ["shipped"],
    "shipped": ["delivered"],
    "delivered": [],
    "cancelled": [],
    "pending_decision": ["confirmed", "cancelled"],
}
# Steps that need a fully paid order (shipping is blocked while a balance remains, AC-10).
NEEDS_PAID = {"preparing", "ready_to_ship", "shipped"}
# What the demo payment simulator may report while an order awaits payment.
DEMO_PAYMENT = {"pending": "awaiting_payment", "failed": "awaiting_payment", "paid": "confirmed"}

# Public order lookup: 10 wrong guesses from one address lock it out for a minute.
track_limiter = Limiter(10, 60)

customer = APIRouter(prefix="/api/orders", tags=["orders"])
admin = APIRouter(prefix="/api/admin", tags=["admin"])

Money = Annotated[StrictInt, Field(ge=0, le=10**12)]


class ItemIn(BaseModel):
    variantId: str = Field(max_length=80)
    qty: Annotated[StrictInt, Field(ge=1, le=99)]
    # Price the customer saw; a mismatch means the price changed since (FR-08-04).
    expectedPriceIdr: Annotated[StrictInt, Field(ge=0, le=10**12)]


class AddressIn(BaseModel):
    recipient: str = Field(min_length=2, max_length=120)
    phoneCountryCode: str = Field(pattern=r"^\+\d{1,4}$")
    phone: str = Field(pattern=r"^[\d\s-]{6,20}$")
    country: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=1, max_length=80)
    city: str = Field(min_length=1, max_length=80)
    postalCode: str = Field(default="", max_length=20)
    line1: str = Field(min_length=3, max_length=200)
    line2: str | None = Field(default=None, max_length=200)


class OrderIn(BaseModel):
    """Checkout request: what to buy and where to send it. Prices, costs and stock are the server's."""

    id: str = Field(pattern=r"^ord-[\w-]{8,64}$")
    items: list[ItemIn] = Field(min_length=1, max_length=50)
    address: AddressIn
    shippingServiceId: str = Field(max_length=80)
    paymentMethod: Literal["card", "qris"]
    currency: Literal["IDR", "USD"]


class TrackIn(BaseModel):
    number: str = Field(min_length=6, max_length=30)
    email: str = Field(min_length=5, max_length=254)


class DemoPaymentIn(BaseModel):
    paymentStatus: Literal["pending", "failed", "paid"]


class StatusIn(BaseModel):
    status: Status


class ShipmentIn(BaseModel):
    courier: str = Field(min_length=2, max_length=60)
    trackingNumber: str = Field(min_length=3, max_length=60)


class TrackingPointIn(BaseModel):
    label: str = Field(min_length=2, max_length=120)
    note: str = Field(default="", max_length=300)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


def _add_event(db: Database, order_id: str, status: str, payment_status: str, actor: str, at: str | None = None) -> None:
    at = at or now_iso()
    db.execute("INSERT INTO order_events (order_id, status, payment_status, actor, at) VALUES (?, ?, ?, ?, ?)", (order_id, status, payment_status, actor, at))
    db.execute("UPDATE orders SET status = ?, payment_status = ?, updated_at = ? WHERE id = ?", (status, payment_status, at, order_id))


def expire_stale(db: Database) -> None:
    """Unpaid orders past their reservation window are cancelled when next read (AC-08-04)."""
    rows = db.execute("SELECT id, data FROM orders WHERE status = 'awaiting_payment' AND payment_status != 'pending'").fetchall()
    now = datetime.now(timezone.utc)
    for row in rows:
        expires = datetime.fromisoformat(json.loads(row["data"])["reservationExpiresAt"].replace("Z", "+00:00"))
        if expires <= now:
            _add_event(db, row["id"], "cancelled", "expired", "system")


def _trails(db: Database, order_ids: list[str]) -> tuple[dict[str, list[Row]], dict[str, list[Row]]]:
    """Status history and tracking checkpoints of many orders, in two queries instead of two per order."""
    events: dict[str, list[Row]] = {}
    points: dict[str, list[Row]] = {}
    if order_ids:
        for e in db.execute("SELECT order_id, status, payment_status, actor, at FROM order_events WHERE order_id = ANY(?) ORDER BY id", (order_ids,)).fetchall():
            events.setdefault(e["order_id"], []).append(e)
        for p in db.execute("SELECT order_id, id, label, note, lat, lng, at FROM tracking_points WHERE order_id = ANY(?) ORDER BY at, id", (order_ids,)).fetchall():
            points.setdefault(p["order_id"], []).append(p)
    return events, points


def _to_order(db: Database, row: Row, with_actor: bool = False, trails: tuple[dict[str, list[Row]], dict[str, list[Row]]] | None = None) -> dict:
    """`trails` carries history and checkpoints loaded for a whole list; a single order loads its own."""
    all_events, all_points = trails or _trails(db, [row["id"]])
    events, points = all_events.get(row["id"], []), all_points.get(row["id"], [])
    order = json.loads(row["data"])
    order.pop("midtrans", None)  # Snap token and attempt counter stay on the server
    order.update(
        id=row["id"], number=row["number"], userId=row["user_id"], status=row["status"], paymentStatus=row["payment_status"],
        createdAt=row["created_at"], updatedAt=row["updated_at"],
        history=[{"status": e["status"], "paymentStatus": e["payment_status"], "at": e["at"], **({"actor": e["actor"]} if with_actor else {})} for e in events],
        tracking={"courier": row["courier"], "trackingNumber": row["tracking_number"], "points": [{k: v for k, v in p.items() if k != "order_id"} for p in points]},
    )
    if row["status"] == "cancelled" and row["payment_status"] == "expired":
        order["cancelReason"] = "payment_expired"
    return order


def _next_for(row: Row) -> list[str]:
    return [s for s in ADMIN_NEXT[row["status"]] if s not in NEEDS_PAID or row["payment_status"] == "paid"]


def _admin_orders(db: Database, rows: list[Row]) -> list[dict]:
    """Orders as the dashboard shows them. Customers, history and checkpoints are loaded once
    for the whole list, so the number of queries does not grow with the number of orders."""
    trails = _trails(db, [r["id"] for r in rows])
    user_ids = list({r["user_id"] for r in rows})
    users = {u["id"]: u for u in db.execute("SELECT id, email, username, phone_country_code, phone FROM users WHERE id = ANY(?)", (user_ids,)).fetchall()} if user_ids else {}
    orders = []
    for row in rows:
        u = users.get(row["user_id"])
        phone = f"{u['phone_country_code'] or ''} {u['phone']}".strip() if u and u["phone"] else None
        customer = {"email": u["email"], "name": u["username"], "phone": phone} if u else None
        orders.append({**_to_order(db, row, with_actor=True, trails=trails), "customer": customer, "nextStatuses": _next_for(row)})
    return orders


def _admin_order(db: Database, row: Row) -> dict:
    return _admin_orders(db, [row])[0]


def _get(db: Database, order_id: str) -> Row | None:
    return db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()


def _own(db: Database, order_id: str, user: Row) -> Row:
    row = _get(db, order_id)
    # Same 404 for "missing" and "not yours", so IDs cannot be probed (AC-11).
    if not row or row["user_id"] != user["id"]:
        raise HTTPException(404, "not_found")
    return row


def _fresh_number(db: Database) -> str:
    ymd = datetime.now().strftime("%y%m%d")
    while True:
        number = f"AUR-RS-{ymd}-{random.randint(1000, 9999)}"
        if not db.execute("SELECT 1 FROM orders WHERE number = ?", (number,)).fetchone():
            return number


# ---------------------------------------------------------------- customer


@customer.get("")
def list_my_orders(user: User, db: Db):
    expire_stale(db)
    rows = db.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)).fetchall()
    trails = _trails(db, [r["id"] for r in rows])
    return {"orders": [_to_order(db, r, trails=trails) for r in rows]}


@customer.post("", status_code=201)
def create_order(body: OrderIn, user: User, db: Db, response: Response):
    # FR-01-03: email must be verified before checkout.
    if not user["email_verified"]:
        raise HTTPException(403, "email_unverified")
    # FR-03-07: QRIS is offered for IDR only (working assumption, OD-11 open).
    if body.paymentMethod == "qris" and body.currency != "IDR":
        raise HTTPException(400, "invalid_order")
    if body.address.country not in served_countries(db):
        raise HTTPException(400, "country_not_served")

    # Lock the variants being bought (always in the same order, so two checkouts cannot
    # deadlock). Until this transaction commits, no other checkout can reserve them: the stock
    # check and the reservation are atomic, and the last unit cannot be sold twice (AC-04).
    variant_ids = sorted({item.variantId for item in body.items})
    marks = ",".join("?" * len(variant_ids))
    db.execute(f"SELECT id FROM variants WHERE id IN ({marks}) ORDER BY id FOR UPDATE", variant_ids).fetchall()
    existing = _get(db, body.id)
    if existing:
        # Retrying the same checkout must not create a second order (US-08-02).
        if existing["user_id"] != user["id"]:
            raise HTTPException(409, "conflict")
        response.status_code = 200
        return {"order": _to_order(db, existing)}

    service = db.execute("SELECT * FROM shipping_services WHERE id = ?", (body.shippingServiceId,)).fetchone()
    if not service:
        raise HTTPException(400, "invalid_order")

    expire_stale(db)
    held = held_stock(db)
    wanted: dict[str, int] = {}
    for item in body.items:
        wanted[item.variantId] = wanted.get(item.variantId, 0) + item.qty
    lines, price_changed, short = [], [], []
    for item in body.items:
        v = db.execute(
            "SELECT v.*, p.data AS product, p.active FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?", (item.variantId,)
        ).fetchone()
        if not v or not v["active"] or v["price_idr"] != item.expectedPriceIdr:
            price_changed.append(item.variantId)
            continue
        if v["stock"] - held.get(v["id"], 0) < wanted[v["id"]]:
            short.append(item.variantId)
            continue
        product = json.loads(v["product"])
        lines.append({
            "productId": product["id"], "variantId": v["id"], "name": product["name"], "variantLabel": json.loads(v["label"]),
            "image": product.get("thumb") or (product["media"][0]["src"] if product.get("media") else ""),
            "qty": item.qty, "unitPriceIdr": v["price_idr"],
        })
    if price_changed:
        raise HTTPException(409, {"error": "price_changed", "variantIds": price_changed})
    if short:
        raise HTTPException(409, {"error": "out_of_stock", "variantIds": short})

    now = now_iso()
    costs = cost_breakdown(sum(l["qty"] * l["unitPriceIdr"] for l in lines), service["cost_idr"])
    expires = datetime.now(timezone.utc) + timedelta(minutes=reservation_minutes(db))
    data = {
        "type": "ready_stock", "items": lines, "costs": costs,
        # Snapshots: later edits to the address book or the catalog never change this order.
        "addressSnapshot": {"id": "snapshot", "isDefault": False, **body.address.model_dump()},
        "shippingService": shipping_service(service),
        "paymentMethod": body.paymentMethod, "currency": body.currency,
        "lockedRate": {"usdToIdr": usd_to_idr(db), "at": now} if body.currency == "USD" else None,
        "termsVersion": TERMS_VERSION,
        "reservationExpiresAt": expires.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    }
    try:
        db.execute(
            "INSERT INTO orders (id, user_id, number, status, payment_status, total_idr, data, created_at, updated_at) VALUES (?, ?, ?, 'awaiting_payment', 'unpaid', ?, ?, ?, ?)",
            (body.id, user["id"], _fresh_number(db), costs["total"], json.dumps(data), now, now),
        )
    except IntegrityError:  # the same id (or number) was inserted a moment ago: let the client retry
        raise HTTPException(409, "conflict") from None
    db.executemany("INSERT INTO order_items (order_id, variant_id, qty) VALUES (?, ?, ?)", [(body.id, l["variantId"], l["qty"]) for l in lines])
    _add_event(db, body.id, "awaiting_payment", "unpaid", "customer", now)
    return {"order": _to_order(db, _get(db, body.id))}


@customer.post("/track")
def track_order(body: TrackIn, request: Request, db: Db):
    """Shipment status for whoever holds both the order number and the email it was placed with.

    No login needed, so the answer leaves out everything private: no street address, phone,
    prices or account ids. A wrong number and a wrong email get the same 404."""
    key = request.client.host if request.client else "?"
    locked = track_limiter.locked_for(key)
    if locked > 0:
        raise HTTPException(429, {"error": "too_many_attempts", "retryAfterMs": int(locked * 1000)})
    expire_stale(db)
    row = db.execute(
        "SELECT o.* FROM orders o JOIN users u ON u.id = o.user_id WHERE o.number = ? AND u.email = ?",
        (body.number.strip().upper(), body.email.strip().lower()),
    ).fetchone()
    if not row:
        track_limiter.fail(key)
        raise HTTPException(404, "not_found")
    order = _to_order(db, row)
    service, address = order["shippingService"], order["addressSnapshot"]
    return {"order": {
        "number": order["number"], "status": order["status"], "paymentStatus": order["paymentStatus"],
        "createdAt": order["createdAt"], "updatedAt": order["updatedAt"], "cancelReason": order.get("cancelReason"),
        "history": order["history"], "tracking": order["tracking"],
        "items": [{"name": i["name"], "variantLabel": i["variantLabel"], "image": i["image"], "qty": i["qty"]} for i in order["items"]],
        "shippingService": {"courier": service["courier"], "name": service["name"], "etaDays": service["etaDays"]},
        "destination": {"city": address["city"], "country": address["country"]},
    }}


@customer.get("/{order_id}")
def get_my_order(order_id: str, user: User, db: Db):
    expire_stale(db)
    return {"order": _to_order(db, _own(db, order_id, user))}


@customer.post("/{order_id}/demo-payment")
def demo_payment(order_id: str, body: DemoPaymentIn, user: User, db: Db):
    """DEMO ONLY: stands in for the payment gateway's verified webhook until a provider is
    connected (PRD §9). Disabled in production, where only the real webhook may mark an order paid."""
    if is_prod():
        raise HTTPException(404, "not_found")
    expire_stale(db)
    row = _own(db, order_id, user)
    if row["status"] != "awaiting_payment":
        raise HTTPException(409, "not_allowed")
    # Reporting the same state twice changes nothing (duplicate callbacks, AC-09).
    if row["payment_status"] != body.paymentStatus:
        _add_event(db, row["id"], DEMO_PAYMENT[body.paymentStatus], body.paymentStatus, "demo-gateway")
    return {"order": _to_order(db, _get(db, order_id))}


# ------------------------------------------------------------------- admin


def _admin_row(db: Database, order_id: str) -> Row:
    row = _get(db, order_id)
    if not row:
        raise HTTPException(404, "not_found")
    return row


@admin.get("/orders")
def list_orders(_: Admin, db: Db, status: Status | None = None):
    expire_stale(db)
    if status:
        rows = db.execute("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 500", (status,)).fetchall()
    else:
        rows = db.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").fetchall()

    midnight = datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    totals = db.execute(
        "SELECT COUNT(*) FILTER (WHERE created_at >= ?) AS today, COUNT(*) FILTER (WHERE status = 'awaiting_payment') AS awaiting, "
        "COUNT(*) FILTER (WHERE status IN ('confirmed', 'preparing', 'ready_to_ship')) AS to_process, COUNT(*) FILTER (WHERE status = 'shipped') AS shipped, "
        "COALESCE(SUM(total_idr) FILTER (WHERE payment_status = 'paid'), 0) AS paid FROM orders",
        (midnight.isoformat(timespec="milliseconds").replace("+00:00", "Z"),),
    ).fetchone()
    return {
        "orders": _admin_orders(db, rows),
        "summary": {"today": totals["today"], "awaitingPayment": totals["awaiting"], "toProcess": totals["to_process"], "shipped": totals["shipped"], "paidTotalIdr": int(totals["paid"])},
    }


@admin.get("/overview")
def overview(_: Admin, db: Db, days: Annotated[int, Query(ge=1, le=90)] = 7):
    """Numbers for the dashboard home: the chosen period (ending today) and what needs attention."""
    expire_stale(db)
    now = datetime.now().astimezone()
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start = midnight - timedelta(days=days - 1)
    iso = lambda d: d.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")  # noqa: E731

    # Revenue counts paid orders only, on the day the order was placed (local time).
    per_day = {(start + timedelta(days=i)).date(): {"orders": 0, "paidOrders": 0, "paidIdr": 0} for i in range(days)}
    for row in db.execute("SELECT created_at, payment_status, total_idr FROM orders WHERE created_at >= ?", (iso(start),)).fetchall():
        day = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")).astimezone(now.tzinfo).date()
        if day in per_day:
            per_day[day]["orders"] += 1
            if row["payment_status"] == "paid":
                per_day[day]["paidOrders"] += 1
                per_day[day]["paidIdr"] += int(row["total_idr"])

    held = held_stock(db)
    low = []
    for v in db.execute("SELECT v.id, v.sku, v.label, v.stock, p.id AS product_id, p.data FROM variants v JOIN products p ON p.id = v.product_id WHERE p.active = 1 ORDER BY p.sort, v.sort").fetchall():
        available = max(0, v["stock"] - held.get(v["id"], 0))
        if available <= 2:
            low.append({"sku": v["sku"], "productId": v["product_id"], "product": json.loads(v["data"])["name"]["en"], "variant": json.loads(v["label"])["en"], "available": available})
    low.sort(key=lambda item: item["available"])

    top = db.execute(
        "SELECT p.id AS product_id, p.data, SUM(i.qty) AS qty FROM order_items i JOIN orders o ON o.id = i.order_id JOIN variants v ON v.id = i.variant_id "
        "JOIN products p ON p.id = v.product_id WHERE o.payment_status = 'paid' GROUP BY p.id ORDER BY qty DESC, p.id LIMIT 5"
    ).fetchall()
    top_products = []
    for row in top:
        data = json.loads(row["data"])
        thumb = data.get("thumb") or (data["media"][0]["src"] if data.get("media") else None)
        top_products.append({"productId": row["product_id"], "product": data["name"]["en"], "thumb": thumb, "qty": int(row["qty"])})

    latest = db.execute("SELECT o.*, u.username FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 5").fetchall()
    today = per_day[midnight.date()]
    total = lambda key: sum(d[key] for d in per_day.values())  # noqa: E731
    now_counts = db.execute(
        "SELECT COUNT(*) FILTER (WHERE status = 'awaiting_payment') AS awaiting, COALESCE(SUM(total_idr) FILTER (WHERE status = 'awaiting_payment'), 0) AS awaiting_idr, "
        "COUNT(*) FILTER (WHERE status IN ('confirmed', 'preparing', 'ready_to_ship')) AS to_process, COUNT(*) FILTER (WHERE status = 'shipped') AS shipped, "
        "(SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers FROM orders"
    ).fetchone()
    return {
        "today": {"orders": today["orders"], "paidIdr": today["paidIdr"]},
        "period": {"days": days, "orders": total("orders"), "paidOrders": total("paidOrders"), "paidIdr": total("paidIdr")},
        "awaitingPayment": now_counts["awaiting"],
        "awaitingPaymentIdr": int(now_counts["awaiting_idr"]),
        "toProcess": now_counts["to_process"],
        "shipped": now_counts["shipped"],
        "customers": now_counts["customers"],
        "daily": [{"date": d.isoformat(), "orders": v["orders"], "paidIdr": v["paidIdr"]} for d, v in per_day.items()],
        "lowStock": low[:8],
        "lowStockTotal": len(low),
        "soldOutTotal": sum(1 for item in low if item["available"] == 0),
        "topProducts": top_products,
        "latestOrders": [
            {"id": r["id"], "number": r["number"], "customer": r["username"], "status": r["status"], "paymentStatus": r["payment_status"], "totalIdr": int(r["total_idr"]), "createdAt": r["created_at"]}
            for r in latest
        ],
    }


@admin.get("/customers")
def list_customers(_: Admin, db: Db):
    """Customer accounts with what they have ordered and paid so far."""
    rows = db.execute(
        "SELECT u.id, u.email, u.username, u.email_verified, u.created_at, u.phone_country_code, u.phone, COUNT(o.id) AS orders, "
        "COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_idr ELSE 0 END), 0) AS paid_idr, MAX(o.created_at) AS last_order_at "
        "FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE u.role = 'customer' GROUP BY u.id ORDER BY u.created_at DESC LIMIT 1000"
    ).fetchall()
    return {"customers": [
        {
            "id": r["id"], "email": r["email"], "name": r["username"], "emailVerified": bool(r["email_verified"]), "createdAt": r["created_at"],
            "phone": f"{r['phone_country_code'] or ''} {r['phone']}".strip() if r["phone"] else None,
            "orders": int(r["orders"]), "paidIdr": int(r["paid_idr"]), "lastOrderAt": r["last_order_at"],
        }
        for r in rows
    ]}


@admin.get("/orders/{order_id}")
def get_order(order_id: str, _: Admin, db: Db):
    expire_stale(db)
    return {"order": _admin_order(db, _admin_row(db, order_id))}


@admin.patch("/orders/{order_id}")
def set_status(order_id: str, body: StatusIn, user: Admin, db: Db):
    expire_stale(db)
    row = _admin_row(db, order_id)
    if body.status not in _next_for(row):
        raise HTTPException(409, "invalid_transition")
    _add_event(db, row["id"], body.status, row["payment_status"], f"admin:{user['id']}")
    return {"order": _admin_order(db, _get(db, order_id))}


@admin.put("/orders/{order_id}/shipment")
def set_shipment(order_id: str, body: ShipmentIn, _: Admin, db: Db):
    row = _admin_row(db, order_id)
    db.execute("UPDATE orders SET courier = ?, tracking_number = ?, updated_at = ? WHERE id = ?", (body.courier.strip(), body.trackingNumber.strip(), now_iso(), row["id"]))
    return {"order": _admin_order(db, _get(db, order_id))}


@admin.post("/orders/{order_id}/tracking", status_code=201)
def add_tracking_point(order_id: str, body: TrackingPointIn, user: Admin, db: Db):
    row = _admin_row(db, order_id)
    at = now_iso()
    db.execute(
        "INSERT INTO tracking_points (order_id, label, note, lat, lng, actor, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (row["id"], body.label.strip(), body.note.strip(), body.lat, body.lng, f"admin:{user['id']}", at),
    )
    db.execute("UPDATE orders SET updated_at = ? WHERE id = ?", (at, row["id"]))
    return {"order": _admin_order(db, _get(db, order_id))}


@admin.delete("/orders/{order_id}/tracking/{point_id}")
def delete_tracking_point(order_id: str, point_id: int, _: Admin, db: Db):
    row = _admin_row(db, order_id)
    db.execute("DELETE FROM tracking_points WHERE id = ? AND order_id = ?", (point_id, row["id"]))
    return {"order": _admin_order(db, _get(db, order_id))}
