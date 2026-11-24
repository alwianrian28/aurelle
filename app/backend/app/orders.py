"""Orders (F-08/F-18), the admin order desk, and shipment tracking checkpoints."""
import json
import random
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, StrictInt

from .auth import Admin, Db, User, now_iso
from .catalog import RESERVATION_MINUTES, TERMS_VERSION, cost_breakdown, held_stock, served_countries, shipping_service, usd_to_idr
from .config import is_prod
from .db import Database, IntegrityError, Row

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


def _to_order(db: Database, row: Row, with_actor: bool = False) -> dict:
    events = db.execute("SELECT status, payment_status, actor, at FROM order_events WHERE order_id = ? ORDER BY id", (row["id"],)).fetchall()
    points = db.execute("SELECT id, label, note, lat, lng, at FROM tracking_points WHERE order_id = ? ORDER BY at, id", (row["id"],)).fetchall()
    order = json.loads(row["data"])
    order.update(
        id=row["id"], number=row["number"], userId=row["user_id"], status=row["status"], paymentStatus=row["payment_status"],
        createdAt=row["created_at"], updatedAt=row["updated_at"],
        history=[{"status": e["status"], "paymentStatus": e["payment_status"], "at": e["at"], **({"actor": e["actor"]} if with_actor else {})} for e in events],
        tracking={"courier": row["courier"], "trackingNumber": row["tracking_number"], "points": [dict(p) for p in points]},
    )
    if row["status"] == "cancelled" and row["payment_status"] == "expired":
        order["cancelReason"] = "payment_expired"
    return order


def _next_for(row: Row) -> list[str]:
    return [s for s in ADMIN_NEXT[row["status"]] if s not in NEEDS_PAID or row["payment_status"] == "paid"]


def _admin_order(db: Database, row: Row) -> dict:
    u = db.execute("SELECT email, username, phone_country_code, phone FROM users WHERE id = ?", (row["user_id"],)).fetchone()
    phone = f"{u['phone_country_code'] or ''} {u['phone']}".strip() if u and u["phone"] else None
    return {**_to_order(db, row, with_actor=True), "customer": {"email": u["email"], "name": u["username"], "phone": phone} if u else None, "nextStatuses": _next_for(row)}


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
    return {"orders": [_to_order(db, r) for r in rows]}


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
    expires = datetime.now(timezone.utc) + timedelta(minutes=RESERVATION_MINUTES)
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

    def count(where: str, *args: str) -> int:
        return db.execute(f"SELECT COUNT(*) FROM orders WHERE {where}", args).fetchone()[0]

    midnight = datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    return {
        "orders": [_admin_order(db, r) for r in rows],
        "summary": {
            "today": count("created_at >= ?", midnight.isoformat(timespec="milliseconds").replace("+00:00", "Z")),
            "awaitingPayment": count("status = 'awaiting_payment'"),
            "toProcess": count("status IN ('confirmed', 'preparing', 'ready_to_ship')"),
            "shipped": count("status = 'shipped'"),
            "paidTotalIdr": int(db.execute("SELECT COALESCE(SUM(total_idr), 0) FROM orders WHERE payment_status = 'paid'").fetchone()[0]),
        },
    }


@admin.get("/overview")
def overview(_: Admin, db: Db):
    """Numbers for the dashboard home: today, the last 7 days, what needs attention."""
    expire_stale(db)
    now = datetime.now().astimezone()
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = midnight - timedelta(days=6)
    iso = lambda d: d.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")  # noqa: E731

    def count(where: str, *args: str) -> int:
        return db.execute(f"SELECT COUNT(*) FROM orders WHERE {where}", args).fetchone()[0]

    # Revenue counts paid orders only, on the day the order was placed (local time).
    days = {(week_start + timedelta(days=i)).date(): {"orders": 0, "paidIdr": 0} for i in range(7)}
    for row in db.execute("SELECT created_at, payment_status, total_idr FROM orders WHERE created_at >= ?", (iso(week_start),)).fetchall():
        day = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")).astimezone(now.tzinfo).date()
        if day in days:
            days[day]["orders"] += 1
            if row["payment_status"] == "paid":
                days[day]["paidIdr"] += int(row["total_idr"])

    held = held_stock(db)
    low = []
    for v in db.execute("SELECT v.id, v.sku, v.label, v.stock, p.data FROM variants v JOIN products p ON p.id = v.product_id WHERE p.active = 1 ORDER BY p.sort, v.sort").fetchall():
        available = max(0, v["stock"] - held.get(v["id"], 0))
        if available <= 2:
            low.append({"sku": v["sku"], "product": json.loads(v["data"])["name"]["en"], "variant": json.loads(v["label"])["en"], "available": available})
    low.sort(key=lambda item: item["available"])

    top = db.execute(
        "SELECT i.variant_id, SUM(i.qty) AS qty FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.payment_status = 'paid' GROUP BY i.variant_id ORDER BY qty DESC LIMIT 5"
    ).fetchall()
    top_products = []
    for row in top:
        v = db.execute("SELECT v.label, p.data FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?", (row["variant_id"],)).fetchone()
        if v:
            top_products.append({"product": json.loads(v["data"])["name"]["en"], "variant": json.loads(v["label"])["en"], "qty": int(row["qty"])})

    latest = db.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT 6").fetchall()
    today = days[midnight.date()]
    return {
        "today": {"orders": today["orders"], "paidIdr": today["paidIdr"]},
        "week": {"orders": sum(d["orders"] for d in days.values()), "paidIdr": sum(d["paidIdr"] for d in days.values())},
        "awaitingPayment": count("status = 'awaiting_payment'"),
        "toProcess": count("status IN ('confirmed', 'preparing', 'ready_to_ship')"),
        "shipped": count("status = 'shipped'"),
        "customers": db.execute("SELECT COUNT(*) FROM users WHERE role = 'customer'").fetchone()[0],
        "daily": [{"date": d.isoformat(), **values} for d, values in days.items()],
        "lowStock": low[:8],
        "lowStockTotal": len(low),
        "topProducts": top_products,
        "latestOrders": [{"id": r["id"], "number": r["number"], "status": r["status"], "paymentStatus": r["payment_status"], "totalIdr": int(r["total_idr"]), "createdAt": r["created_at"]} for r in latest],
    }


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
