"""Shipping through Biteship (https://biteship.com): courier rates, booking a shipment, tracking.

- Rates: what each courier charges from the store to a postal code, insurance for the goods'
  full value included (`POST /api/shipping/rates`; checkout prices the order from the same call).
- Booking: when an order turns paid (payments.py), its shipment is booked with the courier
  service the customer chose. A booking that fails never fails the payment: the reason is kept
  on the order and an admin books again from the dashboard
  (`POST /api/admin/orders/{id}/biteship`). BITESHIP_AUTO_BOOK=false leaves all booking to the
  dashboard.
- Tracking: `GET /api/orders/{id}/tracking` gives the courier's scans, the driver and the
  shipment map (tracking_map.py). Biteship's answer is kept per order for a minute
  (`shipment_tracking_cache`), so looking again and again does not ask Biteship each time.
- Webhook: Biteship calls `POST /api/shipping/biteship/webhook?token=…` whenever a shipment
  changes. It is always answered with 200.

What is stored lives in columns of `orders` (see the migration in db.py). The API key decides
the mode: `biteship_test.…` books simulated shipments, `biteship_live.…` real ones that are
charged to the Biteship balance.
"""
import hmac
import json
import re
from datetime import datetime, timezone
from typing import Annotated

import requests
from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, StrictInt

from . import tracking_map
from .auth import Admin, Db, User, now_iso
from .config import biteship_api_key, biteship_auto_book, biteship_couriers, biteship_origin, biteship_tracking_cache_seconds, biteship_webhook_auth, biteship_webhook_token
from .db import Database, Row
from .orders import _add_event, _admin_order, _admin_row, _get, _own, _to_order
from .security import Limiter

API = "https://api.biteship.com"
TIMEOUT = 15
# Products carry no weight yet. A boxed piece of jewelry is light; couriers bill by the kilogram
# rounded up, so the exact figure rarely changes the price.
ITEM_GRAMS = 100
# Biteship status -> the order status it means for us. Anything else is kept as tracking detail only.
SHIPPED = {"picked", "in_transit", "dropping_off"}
DELIVERED = {"delivered"}
# A shipment that ended without reaching the customer: the order may be booked again.
REBOOKABLE = {"cancelled", "rejected", "courier_not_found", "returned", "disposed"}
# Order statuses in which a shipment may be booked (paid, not yet handed over).
BOOKABLE = {"confirmed", "preparing", "ready_to_ship"}
# Biteship's code for "this reference_id already has an order".
DUPLICATE_REFERENCE = 40002060

router = APIRouter(prefix="/api/shipping", tags=["shipping"])
orders_router = APIRouter(prefix="/api/orders", tags=["orders"])
admin = APIRouter(prefix="/api/admin", tags=["admin"])

# Rates are looked up at another company's API on the customer's behalf: 30 a minute per account.
rate_limiter = Limiter(30, 60)


# ------------------------------------------------------------------ Biteship


def _biteship(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    """One call to Biteship, authenticated with the API key. Returns (HTTP status, JSON body)."""
    key = biteship_api_key()
    if not key:
        raise HTTPException(503, "shipping_not_configured")
    try:
        res = requests.request(method, f"{API}{path}", json=body, timeout=TIMEOUT, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    except requests.RequestException:
        raise HTTPException(502, "shipping_provider_unreachable") from None
    try:
        data = res.json()
    except ValueError:
        data = {}
    return res.status_code, data if isinstance(data, dict) else {}


def _refused(status: int, data: dict) -> HTTPException:
    """Biteship said no. Its own message is passed on: it names the field or the balance at fault."""
    return HTTPException(502, {"error": "shipping_provider_error", "providerStatus": status, "providerCode": data.get("code"), "message": str(data.get("error") or data.get("message") or "")[:300]})


def _ok(status: int, data: dict) -> bool:
    return 200 <= status < 300 and data.get("success") is not False


def _status(value: object) -> str:
    """Biteship writes a status as `dropping_off` in one place and `droppingOff` in another."""
    return re.sub(r"(?<=[a-z])(?=[A-Z])", "_", str(value or "")).lower()


def _postal(value: str) -> int:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) != 5:
        raise HTTPException(400, "postal_code_required")
    return int(digits)


def _origin() -> dict:
    origin = biteship_origin()
    if not origin:
        raise HTTPException(503, "shipping_origin_not_configured")
    return origin


def _eta(value: object) -> str:
    """Biteship's duration range, with "1 - 1" said as "1"."""
    parts = [part.strip() for part in str(value or "").split("-")]
    return parts[0] if len(parts) == 2 and parts[0] == parts[1] else str(value or "").strip()


def _parcel(lines: list[dict]) -> list[dict]:
    """Order lines as Biteship wants them: a name, the declared value in IDR, the weight in grams."""
    return [{"name": str(l["name"])[:120], "category": "fashion", "value": int(l["value"]), "quantity": int(l["qty"]), "weight": ITEM_GRAMS} for l in lines]


def _insured(parcel: list[dict]) -> int:
    """What the parcel is insured for: the full value of the goods. One function, so the rate a
    customer is shown and the booking made later insure the same amount."""
    return sum(item["value"] * item["quantity"] for item in parcel)


def _order_parcel(order: dict) -> list[dict]:
    return _parcel([{"name": i["name"]["en"], "value": i["unitPriceIdr"], "qty": i["qty"]} for i in order["items"]])


def _cart(db: Database, items: list[tuple[str, int]]) -> list[dict]:
    """A cart as a parcel, at the catalog's own prices."""
    lines = []
    for variant_id, qty in items:
        v = db.execute("SELECT v.price_idr, p.data FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? AND p.active = 1", (variant_id,)).fetchone()
        if not v:
            raise HTTPException(400, "invalid_input")
        lines.append({"name": json.loads(v["data"])["name"]["en"], "value": v["price_idr"], "qty": qty})
    return _parcel(lines)


def _rates(parcel: list[dict], postal_code: str) -> list[dict]:
    """Parcel services (no trucking or freight) with their insured price, cheapest first."""
    status, data = _biteship("POST", "/v1/rates/couriers", {
        "origin_postal_code": _postal(_origin()["postalCode"]), "destination_postal_code": _postal(postal_code),
        "couriers": biteship_couriers(), "items": parcel, "courier_insurance": _insured(parcel),
    })
    if not _ok(status, data):
        raise _refused(status, data)
    rates = [
        {
            "courier": p.get("courier_code"), "courierName": p.get("courier_name"),
            # `service` is what booking asks for as the courier type.
            "service": p.get("courier_service_code"), "serviceName": p.get("courier_service_name"), "description": p.get("description") or "",
            # `price` is Biteship's final figure: the shipping fee plus the insurance fee.
            "priceIdr": int(p.get("price") or 0), "insuranceIdr": int(p.get("insurance_fee") or 0),
            "eta": _eta(p.get("shipment_duration_range")), "etaUnit": p.get("shipment_duration_unit") or "",
            "collection": p.get("available_collection_method") or [],
        }
        for p in data.get("pricing") or [] if p.get("shipping_type") == "parcel" and p.get("courier_code") and p.get("courier_service_code")
    ]
    return sorted(rates, key=lambda r: r["priceIdr"])


def quote_rate(db: Database, items: list[tuple[str, int]], country: str, postal_code: str, courier: str, service: str) -> dict:
    """The courier service a customer picked at checkout, priced by the courier right now, in
    the shape an order keeps as its shipping service. 409 when that service is no longer offered."""
    if country.strip().lower() != "indonesia":
        raise HTTPException(400, "country_not_served")
    rate = next((r for r in _rates(_cart(db, items), postal_code) if (r["courier"], r["service"]) == (courier, service)), None)
    if not rate:
        raise HTTPException(409, {"error": "shipping_changed"})
    return {
        "id": f"biteship:{courier}:{service}", "courier": rate["courierName"] or courier.upper(), "name": {"en": rate["serviceName"] or service, "id": rate["serviceName"] or service},
        "etaDays": rate["eta"].replace(" ", "") or "-", "costIdr": rate["priceIdr"], "insuranceIdr": rate["insuranceIdr"],
        "biteship": {"courier": courier, "service": service},
    }


# ---------------------------------------------------------------- our orders


def _lock(db: Database, order_id: str) -> Row:
    return db.execute("SELECT * FROM orders WHERE id = ? FOR UPDATE", (order_id,)).fetchone()


def _advance(db: Database, row: Row, status: str) -> None:
    """Move the order along when the courier has the parcel or has delivered it. Only a paid
    order on its way moves; a cancelled one stays cancelled. Safe to call again."""
    if row["payment_status"] != "paid":
        return
    if status in DELIVERED and row["status"] in BOOKABLE | {"shipped"}:
        _add_event(db, row["id"], "delivered", "paid", "biteship")
    elif status in SHIPPED and row["status"] in BOOKABLE:
        _add_event(db, row["id"], "shipped", "paid", "biteship")


def _save(db: Database, row: Row, remote: dict, reference: str | None = None) -> Row:
    """Store what Biteship reports about a shipment (an order object from its API). Fields it
    leaves out keep what is stored. Safe to call again with the same answer."""
    courier = remote.get("courier") or {}
    insurance = courier.get("insurance") or {}
    status = _status(remote.get("status")) or row["shipping_status"] or "confirmed"
    waybill = courier.get("waybill_id") or None
    company = courier.get("company") or None
    db.execute(
        "UPDATE orders SET biteship_order_id = COALESCE(?, biteship_order_id), shipping_reference = COALESCE(?, shipping_reference), "
        "courier_company = COALESCE(?, courier_company), courier_type = COALESCE(?, courier_type), "
        "shipping_cost = COALESCE(?, shipping_cost), insurance_fee = COALESCE(?, insurance_fee), "
        "waybill_id = COALESCE(?, waybill_id), tracking_id = COALESCE(?, tracking_id), tracking_link = COALESCE(?, tracking_link), "
        "shipping_status = ?, shipping_updated_at = ?, shipping_error = NULL, "
        "courier = COALESCE(?, courier), tracking_number = COALESCE(?, tracking_number), updated_at = ? WHERE id = ?",
        (
            remote.get("id") or None, reference, company, courier.get("type") or None,
            int(remote["price"]) if remote.get("price") else None, int(insurance["fee"]) if insurance.get("fee") is not None else None,
            waybill, courier.get("tracking_id") or None, courier.get("link") or None,
            status, datetime.now(timezone.utc), company.upper() if company else None, waybill, now_iso(), row["id"],
        ),
    )
    _forget_scans(db, row["id"])
    _advance(db, row, status)
    return _get(db, row["id"])


def _refresh(db: Database, row: Row) -> Row:
    """Read the shipment back from Biteship and store it."""
    if not row["biteship_order_id"]:
        raise HTTPException(409, "not_booked")
    status, remote = _biteship("GET", f"/v1/orders/{row['biteship_order_id']}")
    if not _ok(status, remote):
        raise _refused(status, remote)
    return _save(db, _lock(db, row["id"]), remote)


def _next_reference(row: Row) -> str:
    """Biteship books a reference once. The first booking goes under the order number; a booking
    made after the previous shipment was cancelled gets -R1, then -R2, and so on. A booking
    that is merely tried again keeps its reference, so Biteship answers with the one it has."""
    previous = row["shipping_reference"]
    if not row["biteship_order_id"]:
        return previous or row["number"]
    again = re.search(r"-R(\d+)$", previous or "")
    return f"{row['number']}-R{int(again.group(1)) + 1 if again else 1}"


def book(db: Database, row: Row, courier: str, service: str, collection: str = "pickup", note: str = "", actor: str = "biteship") -> Row:
    """Book the order's shipment at Biteship. `row` must be locked by the caller."""
    if row["biteship_order_id"] and row["shipping_status"] not in REBOOKABLE:
        raise HTTPException(409, "already_booked")
    if row["payment_status"] != "paid" or row["status"] not in BOOKABLE:
        raise HTTPException(409, "not_allowed")
    order, origin = json.loads(row["data"]), _origin()
    address = order["addressSnapshot"]
    if address["country"].strip().lower() != "indonesia":
        raise HTTPException(409, "country_not_served")
    parcel, reference = _order_parcel(order), _next_reference(row)
    street = ", ".join(part for part in (address["line1"], address.get("line2"), address["city"], address["state"]) if part)
    status, remote = _biteship("POST", "/v1/orders", {
        "shipper_contact_name": origin["name"], "shipper_contact_phone": origin["phone"], "shipper_organization": "Aurelle",
        "origin_contact_name": origin["name"], "origin_contact_phone": origin["phone"], "origin_address": origin["address"],
        "origin_postal_code": _postal(origin["postalCode"]), "origin_collection_method": collection,
        "destination_contact_name": address["recipient"], "destination_contact_phone": re.sub(r"[^\d+]", "", f"{address['phoneCountryCode']}{address['phone']}"),
        "destination_address": street, "destination_postal_code": _postal(address["postalCode"]),
        "courier_company": courier, "courier_type": service, "courier_insurance": _insured(parcel), "delivery_type": "now",
        "order_note": note, "reference_id": reference, "items": parcel,
    })
    if not _ok(status, remote):
        # Biteship already holds an order under this reference (the payment notification came
        # twice, or an earlier answer was lost): that order is this one's booking, not a failure.
        known = (remote.get("details") or {}).get("order_id") if remote.get("code") == DUPLICATE_REFERENCE else None
        if not known:
            raise _refused(status, remote)
        status, remote = _biteship("GET", f"/v1/orders/{known}")
        if not _ok(status, remote):
            raise _refused(status, remote)
    if not remote.get("id"):
        raise _refused(status, remote)
    row = _save(db, row, remote, reference)
    db.execute("INSERT INTO order_events (order_id, status, payment_status, actor, at) VALUES (?, ?, ?, ?, ?)", (row["id"], row["status"], row["payment_status"], actor, now_iso()))
    return row


def _reason(error: Exception) -> str:
    detail = getattr(error, "detail", None)
    if isinstance(detail, dict):
        return " ".join(str(part) for part in (detail.get("error"), detail.get("providerCode"), detail.get("message")) if part)[:300]
    return str(detail or error.__class__.__name__)[:300]


def auto_book(db: Database, order_id: str) -> None:
    """Called when an order has just turned paid. Books the courier service the customer chose
    at checkout. Never raises: a booking that fails is written on the order (`shipping_error`)
    for an admin to try again, and the payment that triggered it is not disturbed."""
    try:
        if not biteship_auto_book() or not biteship_api_key():
            return
        row = _lock(db, order_id)
        wanted = (json.loads(row["data"]).get("shippingService") or {}).get("biteship")
        if not wanted or row["biteship_order_id"]:
            return
        # A savepoint: whatever goes wrong while booking is undone on its own, and the
        # transaction that marks the order paid carries on.
        db.execute("SAVEPOINT biteship_booking")
        try:
            book(db, row, wanted["courier"], wanted["service"])
            db.execute("RELEASE SAVEPOINT biteship_booking")
        except Exception as error:  # noqa: BLE001 - nothing here may fail the payment
            db.execute("ROLLBACK TO SAVEPOINT biteship_booking")
            db.execute("UPDATE orders SET shipping_error = ?, shipping_updated_at = ? WHERE id = ?", (_reason(error), datetime.now(timezone.utc), order_id))
            print(f"[biteship] booking failed for {row['number']}: {_reason(error)}", flush=True)
    except Exception as error:  # noqa: BLE001
        print(f"[biteship] auto-booking skipped for {order_id}: {error!r}", flush=True)


def _scans(db: Database, row: Row) -> dict | None:
    """What Biteship says about the shipment: {status, link, history, driver, fetchedAt}.

    Its answer is kept per order and reused for BITESHIP_TRACKING_CACHE_SECONDS, so a page that
    is opened or looked up again and again asks Biteship once. When Biteship cannot be asked,
    the last answer it gave is used, however old. None when there has never been one."""
    kept = db.execute("SELECT payload, fetched_at FROM shipment_tracking_cache WHERE order_id = ? AND tracking_id = ?", (row["id"], row["tracking_id"])).fetchone()
    if kept and (datetime.now(timezone.utc) - kept["fetched_at"]).total_seconds() < biteship_tracking_cache_seconds():
        return kept["payload"]
    try:
        status, remote = _biteship("GET", f"/v1/trackings/{row['tracking_id']}")
    except HTTPException:
        status, remote = 0, {}
    if not _ok(status, remote):
        return kept["payload"] if kept else None
    courier = remote.get("courier") or {}
    scans = {
        "status": _status(remote.get("status")), "link": remote.get("link") or None, "fetchedAt": now_iso(),
        "history": [{"status": _status(h.get("status")), "note": str(h.get("note") or "")[:300], "at": str(h.get("updated_at") or "")} for h in remote.get("history") or [] if isinstance(h, dict)],
        "driver": {"name": courier["driver_name"], "phone": courier.get("driver_phone") or None, "plateNumber": courier.get("driver_plate_number") or None, "photoUrl": courier.get("driver_photo_url") or None} if courier.get("driver_name") else None,
    }
    db.execute(
        "INSERT INTO shipment_tracking_cache (order_id, tracking_id, payload, fetched_at) VALUES (?, ?, CAST(? AS JSONB), ?) "
        "ON CONFLICT (order_id) DO UPDATE SET tracking_id = EXCLUDED.tracking_id, payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at",
        (row["id"], row["tracking_id"], json.dumps(scans), datetime.now(timezone.utc)),
    )
    return scans


def _forget_scans(db: Database, order_id: str) -> None:
    """The shipment changed (a webhook, a sync, a new booking): the next look asks Biteship
    again instead of repeating an answer from before the change."""
    db.execute("UPDATE shipment_tracking_cache SET fetched_at = ? WHERE order_id = ?", (datetime.fromtimestamp(0, timezone.utc), order_id))


def _live_tracking(db: Database, row: Row, public: bool = False) -> dict:
    """The order's tracking with the courier's scans, the driver and the shipment map.

    `public` is the lookup by order number and email (no login): the driver's name is given,
    the phone, plate and photo are not. When Biteship has never been reached for this order,
    what is stored (status, waybill, link) is given without scans."""
    order = _to_order(db, row)
    tracking = {**order["tracking"], "history": [], "driver": None}
    scans = _scans(db, row) if row["tracking_id"] else None
    if scans:
        now = scans["status"]
        if now and (now != row["shipping_status"] or (scans["link"] and scans["link"] != row["tracking_link"])):
            locked = _lock(db, row["id"])
            db.execute("UPDATE orders SET shipping_status = ?, tracking_link = COALESCE(?, tracking_link), shipping_updated_at = ? WHERE id = ?", (now, scans["link"], datetime.now(timezone.utc), row["id"]))
            _advance(db, locked, now)
        driver = scans["driver"]
        tracking.update(
            status=now or tracking["status"], link=scans["link"] or tracking["link"], updatedAt=scans["fetchedAt"], history=scans["history"],
            driver={"name": driver["name"]} if driver and public else driver,
        )
    # What the courier was handed: one parcel, at the weight every booking declares per piece.
    tracking["parcel"] = {"count": 1, "weightGrams": sum(int(item["qty"]) for item in order["items"]) * ITEM_GRAMS}
    tracking["map"] = tracking_map.build(db, order, tracking)
    return tracking


# ------------------------------------------------------------------ customer


class RateLine(BaseModel):
    variantId: str = Field(max_length=80)
    qty: Annotated[StrictInt, Field(ge=1, le=99)]


class RatesIn(BaseModel):
    items: list[RateLine] = Field(min_length=1, max_length=50)
    postalCode: str = Field(min_length=5, max_length=10)
    country: str = Field(default="Indonesia", max_length=80)


@router.post("/rates")
def shipping_rates(body: RatesIn, user: User, db: Db):
    """Courier prices for a cart sent to a postal code in Indonesia, cheapest first."""
    if rate_limiter.locked_for(user["id"]) > 0:
        raise HTTPException(429, "too_many_attempts")
    rate_limiter.fail(user["id"])
    if body.country.strip().lower() != "indonesia":
        raise HTTPException(400, "country_not_served")
    return {"rates": _rates(_cart(db, [(line.variantId, line.qty) for line in body.items]), body.postalCode)}


@orders_router.get("/{order_id}/tracking")
@router.get("/orders/{order_id}/tracking")  # the address this had first
def order_tracking(order_id: str, user: User, db: Db):
    """Where the customer's own order is: status, the courier's scans and the driver."""
    return {"tracking": _live_tracking(db, _own(db, order_id, user))}


# ------------------------------------------------------------------- webhook


@router.post("/biteship/webhook")
async def biteship_webhook(request: Request, db: Db):
    """Called by Biteship when a shipment changes (order.status, order.price, order.waybill_id).

    Guarded by a secret in the address (`?token=`, BITESHIP_WEBHOOK_TOKEN) or, as before, in a
    header. Past that it always answers 200, quickly: Biteship only needs to know the message
    arrived. When the webhook is installed, Biteship sends a request with an empty body."""
    token = biteship_webhook_token()
    header, secret = biteship_webhook_auth()
    if token or secret:
        by_token = bool(token) and hmac.compare_digest(request.query_params.get("token", "").encode(), token.encode())
        by_header = bool(secret) and hmac.compare_digest(request.headers.get(header, "").encode(), secret.encode())
        if not (by_token or by_header):
            raise HTTPException(401, "bad_token")
    raw = await request.body()
    if not raw.strip():
        return {"ok": True}
    try:
        payload = json.loads(raw)
    except ValueError:
        payload = None
    if not isinstance(payload, dict):
        return {"ok": True, "ignored": "not_json"}
    # The rest calls Biteship and waits for a row lock: not on the event loop.
    return await run_in_threadpool(_handle_webhook, db, payload)


def _handle_webhook(db: Database, payload: dict) -> dict:
    order_id = str(payload.get("order_id") or "")[:60]
    if not order_id:
        return {"ok": True, "ignored": "no_order"}
    row = db.execute("SELECT * FROM orders WHERE biteship_order_id = ?", (order_id,)).fetchone()
    if not row:
        return {"ok": True, "ignored": "unknown_order"}
    db.execute("SAVEPOINT biteship_webhook")
    try:
        try:
            # The shipment is read back from Biteship with our key: status, price and waybill
            # then come from Biteship itself, whatever event this was.
            _refresh(db, row)
        except HTTPException:
            # Biteship could not be asked just now: take what the message says.
            _from_payload(db, _lock(db, row["id"]), payload)
        db.execute("RELEASE SAVEPOINT biteship_webhook")
    except Exception as error:  # noqa: BLE001 - the answer is 200 either way
        db.execute("ROLLBACK TO SAVEPOINT biteship_webhook")
        print(f"[biteship] webhook for {row['number']} not applied: {error!r}", flush=True)
    return {"ok": True}


def _from_payload(db: Database, row: Row, payload: dict) -> None:
    status = _status(payload.get("status")) or row["shipping_status"]
    price = payload.get("price") if payload.get("event") == "order.price" else None
    waybill = payload.get("courier_waybill_id") or None
    db.execute(
        "UPDATE orders SET shipping_status = ?, shipping_cost = COALESCE(?, shipping_cost), waybill_id = COALESCE(?, waybill_id), tracking_number = COALESCE(?, tracking_number), "
        "tracking_link = COALESCE(?, tracking_link), shipping_updated_at = ? WHERE id = ?",
        (status, int(price) if isinstance(price, (int, float)) else None, waybill, waybill, payload.get("courier_link") or None, datetime.now(timezone.utc), row["id"]),
    )
    _forget_scans(db, row["id"])
    _advance(db, row, status or "")


# --------------------------------------------------------------------- admin


class BookIn(BaseModel):
    """A courier service taken from the rates: `courier` (e.g. jne) and `service` (e.g. reg).
    Left out, the service the customer chose at checkout is booked."""

    courier: str | None = Field(default=None, min_length=2, max_length=40, pattern=r"^[a-z0-9_]+$")
    service: str | None = Field(default=None, min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_]+$")
    # "pickup": the courier comes to the store. "drop_off": the store brings the parcel to a counter.
    collection: str = Field(default="pickup", pattern=r"^(pickup|drop_off)$")
    note: str = Field(default="", max_length=200)


@admin.get("/orders/{order_id}/biteship/rates")
def order_rates(order_id: str, _: Admin, db: Db):
    """Courier prices for this order's parcel and destination, to choose a service to book."""
    order = json.loads(_admin_row(db, order_id)["data"])
    address = order["addressSnapshot"]
    if address["country"].strip().lower() != "indonesia":
        raise HTTPException(409, "country_not_served")
    return {"rates": _rates(_order_parcel(order), address["postalCode"])}


@admin.post("/orders/{order_id}/biteship", status_code=201)
def book_shipment(order_id: str, user: Admin, db: Db, body: BookIn | None = None):
    """Book the order's shipment at Biteship, or book it again after a failed attempt or a
    cancelled shipment. The row is locked while Biteship is asked, so two clicks book once."""
    _admin_row(db, order_id)
    row = _lock(db, order_id)
    body = body or BookIn()
    wanted = (json.loads(row["data"]).get("shippingService") or {}).get("biteship") or {}
    courier, service = body.courier or wanted.get("courier"), body.service or wanted.get("service")
    if not courier or not service:
        raise HTTPException(400, "invalid_input")
    return {"order": _admin_order(db, book(db, row, courier, service, body.collection, body.note, f"admin:{user['id']}:biteship"))}


@admin.post("/orders/{order_id}/biteship/sync")
def sync_shipment(order_id: str, _: Admin, db: Db):
    """Ask Biteship where the shipment is now (status, price, waybill)."""
    return {"order": _admin_order(db, _refresh(db, _admin_row(db, order_id)))}


@admin.get("/orders/{order_id}/biteship/tracking")
def admin_tracking(order_id: str, _: Admin, db: Db):
    """The courier's scans and driver for the order, read from Biteship now."""
    return {"tracking": _live_tracking(db, _admin_row(db, order_id))}
