"""Payments through Midtrans (PRD §9).

Cards are paid in the shop's own card form: the browser hands the card to Midtrans and gets a
one-time token, and POST /api/payments/{order_id}/card pays a Snap transaction with that token
(the route Midtrans' own mobile SDK takes; the Core API's /v2/charge is not open to every
merchant account). With MIDTRANS_CARD_FORM=midtrans, cards use Midtrans' form (Snap) instead.
Card numbers never reach this server either way. QRIS always uses Midtrans' form.

The pieces:
- POST /api/payments/{order_id}/snap: creates the Snap transaction and returns its token; the shop
  shows Midtrans' payment form with it, inside its own payment page. The customer may switch
  between card and QRIS there: each switch is a new Snap transaction for the same order.
- POST /api/payments/midtrans/notification: Midtrans calls this when a payment changes state.
  It is the source of truth for "paid" (FR-08-09): the browser's own callbacks are never trusted.
- POST /api/payments/{order_id}/sync: the shop asks us to look the payment up at Midtrans right
  now, for when the customer returns before the notification has arrived.
"""
import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone

from typing import Literal

import requests
from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from .auth import Db, User
from .config import midtrans_client_key, midtrans_is_production, midtrans_own_card_form, midtrans_notification_url, midtrans_server_key, shop_origin
from .db import Database, Row
from .orders import _add_event, _get, _own, _to_order, expire_stale

router = APIRouter(prefix="/api/payments", tags=["payments"])

# What Snap offers for each method chosen at checkout.
ENABLED_PAYMENTS = {"card": ["credit_card"], "qris": ["other_qris", "gopay"]}
PAID, PENDING, FAILED, EXPIRED = "paid", "pending", "failed", "expired"


def _hosts() -> tuple[str, str]:
    """(Snap host, Core API host) for the configured environment."""
    if midtrans_is_production():
        return "https://app.midtrans.com", "https://api.midtrans.com"
    return "https://app.sandbox.midtrans.com", "https://api.sandbox.midtrans.com"


def _server_key() -> str:
    key = midtrans_server_key()
    if not key:
        raise HTTPException(503, "payments_not_configured")
    return key


def _midtrans(method: str, url: str, body: dict | None = None, headers: dict | None = None) -> tuple[int, dict]:
    """One call to Midtrans, authenticated with the server key. Returns (HTTP status, JSON body)."""
    auth = base64.b64encode(f"{_server_key()}:".encode()).decode()
    try:
        res = requests.request(
            method, url, json=body, timeout=20,
            headers={"Authorization": f"Basic {auth}", "Accept": "application/json", "Content-Type": "application/json", **(headers or {})},
        )
    except requests.RequestException:
        raise HTTPException(502, "payment_provider_unreachable") from None
    try:
        return res.status_code, res.json()
    except ValueError:
        return res.status_code, {}


def _outcome(payload: dict) -> str | None:
    """Midtrans transaction_status (+ fraud_status) reduced to what an order cares about."""
    status, fraud = payload.get("transaction_status"), payload.get("fraud_status")
    if status == "settlement" or (status == "capture" and fraud in (None, "accept")):
        return PAID
    if status in ("pending", "authorize") or (status == "capture" and fraud == "challenge"):
        return PENDING
    if status in ("deny", "cancel", "failure"):
        return FAILED
    if status == "expire":
        return EXPIRED
    return None  # refunds and chargebacks are handled by staff, not by this flow


def _apply(db: Database, row: Row, payload: dict) -> None:
    """Move the order to match what Midtrans reports. Safe to call twice with the same payload."""
    outcome = _outcome(payload)
    if not outcome:
        return
    current = (json.loads(row["data"]).get("midtrans") or {}).get("orderId")
    is_current = payload.get("order_id") == current
    actor = "midtrans"

    if outcome == PAID:
        # Never trust an amount other than the order's own total.
        if int(float(payload.get("gross_amount") or 0)) != int(row["total_idr"]):
            print(f"[midtrans] amount mismatch on {row['number']}: {payload.get('gross_amount')}", flush=True)
            return
        if row["status"] == "awaiting_payment":
            _add_event(db, row["id"], "confirmed", "paid", actor)
        elif row["status"] == "cancelled" and row["payment_status"] != "paid":
            # Paid after the reservation ran out and the stock was released: staff decide.
            _add_event(db, row["id"], "pending_decision", "paid", actor)
        return

    # Everything below only matters while the order still waits for this attempt's payment.
    if row["status"] != "awaiting_payment" or not is_current:
        return
    if outcome == PENDING and row["payment_status"] != "pending":
        _add_event(db, row["id"], "awaiting_payment", "pending", actor)
    elif outcome == FAILED and row["payment_status"] != "failed":
        _add_event(db, row["id"], "awaiting_payment", "failed", actor)
    elif outcome == EXPIRED:
        _add_event(db, row["id"], "cancelled", "expired", actor)


class CardIn(BaseModel):
    """The one-time token Midtrans gave the browser for the card. Never the card itself."""

    tokenId: str = Field(min_length=8, max_length=200, pattern=r"^[A-Za-z0-9._-]+$")


def _details(row: Row, data: dict, user: Row) -> tuple[list[dict], dict]:
    """(item lines, customer) as Midtrans wants them. The lines add up to the order total exactly."""
    costs, address = data["costs"], data["addressSnapshot"]
    items = [
        {"id": line["variantId"][:50], "name": f"{line['name']['en']} ({line['variantLabel']['en']})"[:50], "price": int(line["unitPriceIdr"]), "quantity": int(line["qty"])}
        for line in data["items"]
    ]
    for key, label in (("shipping", "Shipping"), ("tax", "Tax"), ("duty", "Import duty (estimate)"), ("other", "Other fees")):
        if costs.get(key):
            items.append({"id": key, "name": label, "price": int(costs[key]), "quantity": 1})
    phone = f"{address.get('phoneCountryCode', '')}{address.get('phone', '')}".replace(" ", "")
    shipping = {
        **_names(address["recipient"]), "phone": phone, "address": " ".join(filter(None, [address["line1"], address.get("line2")]))[:200],
        "city": address["city"][:100], "postal_code": (address.get("postalCode") or "")[:10],
    }
    return items, {**_names(user["username"]), "email": user["email"], "phone": phone, "shipping_address": shipping}


def _names(full: str) -> dict:
    """Midtrans keeps a first and a last name. Sending the whole name as the first name leaves
    its dashboard and receipts to cut it up on their own; the last word is the last name."""
    parts = full.split()
    if len(parts) < 2:
        return {"first_name": full[:255]}
    return {"first_name": " ".join(parts[:-1])[:255], "last_name": parts[-1][:255]}


def close_overdue(db: Database, order_id: str) -> None:
    """The reservation of an order with a payment under way has run out. Midtrans keeps a card
    transaction open for days whatever expiry it is created with, so it is closed there
    explicitly before the order is cancelled and its stock released. A payment that turns out
    to have gone through meanwhile is taken as paid instead."""
    row = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    midtrans_order_id = (json.loads(row["data"]).get("midtrans") or {}).get("orderId")
    if midtrans_order_id and midtrans_server_key():
        try:
            _, payload = _midtrans("GET", f"{_hosts()[1]}/v2/{midtrans_order_id}/status")
            if _outcome(payload) in (PENDING, None) and str(payload.get("status_code")) != "404":
                _, closed = _midtrans("POST", f"{_hosts()[1]}/v2/{midtrans_order_id}/expire")
                if str(closed.get("status_code")) != "407":  # not expired: it may just have been paid
                    _, payload = _midtrans("GET", f"{_hosts()[1]}/v2/{midtrans_order_id}/status")
                    if _outcome(payload) == PENDING:
                        return  # still open at Midtrans: the order stays as it is, to be tried again
        except HTTPException:
            return  # Midtrans cannot be reached: never release stock on a guess
        if _outcome(payload) == PAID:
            locked = db.execute("SELECT * FROM orders WHERE id = ? FOR UPDATE", (order_id,)).fetchone()
            _apply(db, locked, {**payload, "order_id": midtrans_order_id})
            return
    locked = db.execute("SELECT * FROM orders WHERE id = ? FOR UPDATE", (order_id,)).fetchone()
    if locked["status"] == "awaiting_payment" and locked["payment_status"] == "pending":
        _add_event(db, order_id, "cancelled", "expired", "system")


def _minutes_left(data: dict) -> int:
    expires = datetime.fromisoformat(data["reservationExpiresAt"].replace("Z", "+00:00"))
    return int((expires - datetime.now(timezone.utc)).total_seconds() // 60)


class SnapIn(BaseModel):
    """Which method the form should offer. Left out, it is the one chosen at checkout."""

    method: Literal["card", "qris"] | None = None


def _order_for(db: Database, midtrans_order_id: str) -> Row | None:
    """Our order for a Midtrans order id ("<order number>-<attempt>")."""
    number = midtrans_order_id.rsplit("-", 1)[0]
    return db.execute("SELECT * FROM orders WHERE number = ? FOR UPDATE", (number,)).fetchone()


@router.get("/config")
def payment_config():
    """What the payment page needs to take a payment. The client key is public by design."""
    key = midtrans_client_key() if midtrans_server_key() else None
    return {
        "midtransClientKey": key,
        "snapUrl": f"{_hosts()[0]}/snap/snap.js" if key else None,
        # "own": the shop's card form. "midtrans": Midtrans' form (Snap).
        "cardForm": "own" if key and midtrans_own_card_form() else "midtrans",
        "environment": "production" if midtrans_is_production() else "sandbox",
    }


@router.post("/midtrans/notification")
async def midtrans_notification(request: Request, db: Db):
    """Webhook from Midtrans. Anything that is not a correctly signed notification about one of
    our orders is acknowledged and ignored, so Midtrans does not keep retrying it."""
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    if not isinstance(payload, dict):
        return {"ok": True, "ignored": "not_json"}
    # Only reading the body happens on the event loop. The rest waits for a row lock in the
    # database, and waiting there on the loop would freeze every other request, including
    # the one that holds the lock and needs the loop to finish.
    return await run_in_threadpool(_handle_notification, db, payload)


def _handle_notification(db: Database, payload: dict) -> dict:
    key = midtrans_server_key()
    if not key:
        raise HTTPException(503, "payments_not_configured")
    order_id, status_code, gross = str(payload.get("order_id") or ""), str(payload.get("status_code") or ""), str(payload.get("gross_amount") or "")
    expected = hashlib.sha512(f"{order_id}{status_code}{gross}{key}".encode()).hexdigest()
    if not hmac.compare_digest(expected, str(payload.get("signature_key") or "")):
        return {"ok": True, "ignored": "bad_signature"}
    row = _order_for(db, order_id)
    if not row:
        return {"ok": True, "ignored": "unknown_order"}
    _apply(db, row, payload)
    return {"ok": True}


@router.post("/{order_id}/snap")
def create_snap_transaction(order_id: str, user: User, db: Db, body: SnapIn | None = None):
    """Snap token for paying this order. Asking again returns the same token while it is usable:
    until that attempt fails, or the customer asks for the other payment method."""
    _server_key()
    expire_stale(db)
    _own(db, order_id, user)
    row = db.execute("SELECT * FROM orders WHERE id = ? FOR UPDATE", (order_id,)).fetchone()
    if row["status"] != "awaiting_payment":
        raise HTTPException(409, "not_allowed")
    data = json.loads(row["data"])
    minutes_left = _minutes_left(data)
    if minutes_left < 1:
        raise HTTPException(409, "not_allowed")

    method = (body.method if body else None) or data["paymentMethod"]
    # FR-03-07: QRIS is offered for IDR only (the same rule checkout applies).
    if method == "qris" and data["currency"] != "IDR":
        raise HTTPException(400, "invalid_order")
    previous = data.get("midtrans") or {}
    same_method = previous.get("method", data["paymentMethod"]) == method
    # A failed attempt needs a new Midtrans order id, and so does the other method (a Snap
    # transaction offers what it was created with); otherwise the existing token still works.
    if previous.get("token") and same_method and row["payment_status"] != "failed":
        return {"token": previous["token"], "redirectUrl": previous.get("redirectUrl"), "method": method}
    if previous.get("orderId") and not same_method:
        # The attempt being left behind must not stay payable next to the new one. Best effort:
        # Midtrans answers 404 when the customer never got as far as starting it.
        _midtrans("POST", f"{_hosts()[1]}/v2/{previous['orderId']}/cancel")

    attempt = int(previous.get("attempt", 0)) + 1
    midtrans_order_id = f"{row['number']}-{attempt}"
    items, customer = _details(row, data, user)
    body = {
        "transaction_details": {"order_id": midtrans_order_id, "gross_amount": int(row["total_idr"])},
        "item_details": items,
        "customer_details": customer,
        "enabled_payments": ENABLED_PAYMENTS[method],
        "credit_card": {"secure": True},
        # The payment page closes when the stock reservation does.
        "expiry": {"unit": "minute", "duration": minutes_left},
        "callbacks": {"finish": f"{shop_origin()}/checkout/payment/{row['id']}"},
    }
    headers = {"X-Override-Notification": midtrans_notification_url()} if midtrans_notification_url() else None
    status, res = _midtrans("POST", f"{_hosts()[0]}/snap/v1/transactions", body, headers)
    if status not in (200, 201) or not res.get("token"):
        print(f"[midtrans] snap create failed for {row['number']}: {status} {res.get('error_messages')}", flush=True)
        raise HTTPException(502, "payment_provider_error")

    data["midtrans"] = {"orderId": midtrans_order_id, "attempt": attempt, "method": method, "token": res["token"], "redirectUrl": res.get("redirect_url")}
    data["paymentMethod"] = method  # the order shows the method it is actually being paid with
    db.execute("UPDATE orders SET data = ? WHERE id = ?", (json.dumps(data), row["id"]))
    if row["payment_status"] in ("failed", "pending"):
        # A fresh attempt starts unpaid: the failure, or the abandoned method's pending state, is history.
        _add_event(db, row["id"], "awaiting_payment", "unpaid", "customer")
    return {"token": res["token"], "redirectUrl": res.get("redirect_url"), "method": method}


@router.post("/{order_id}/card")
def charge_card(order_id: str, body: CardIn, user: User, db: Db):
    """Pay with the card behind a one-time token (the shop's own card form). Every call is a new
    attempt: a Snap transaction for cards only, paid at once with the token. The answer says
    what Midtrans decided so far, and where to send the customer when the bank wants an OTP
    (3-D Secure); "paid" still only ever comes from Midtrans."""
    _server_key()
    if not midtrans_own_card_form():
        raise HTTPException(409, "card_form_off")
    expire_stale(db)
    _own(db, order_id, user)
    row = db.execute("SELECT * FROM orders WHERE id = ? FOR UPDATE", (order_id,)).fetchone()
    if row["status"] != "awaiting_payment":
        raise HTTPException(409, "not_allowed")
    data = json.loads(row["data"])
    minutes_left = _minutes_left(data)
    if minutes_left < 1:
        raise HTTPException(409, "not_allowed")

    previous = data.get("midtrans") or {}
    if previous.get("orderId"):
        # Whatever was started before (a QRIS code, an unfinished OTP) must not stay payable.
        _midtrans("POST", f"{_hosts()[1]}/v2/{previous['orderId']}/cancel")
    attempt = int(previous.get("attempt", 0)) + 1
    midtrans_order_id = f"{row['number']}-{attempt}"
    items, customer = _details(row, data, user)
    create = {
        "transaction_details": {"order_id": midtrans_order_id, "gross_amount": int(row["total_idr"])},
        "item_details": items,
        "customer_details": customer,
        "enabled_payments": ENABLED_PAYMENTS["card"],
        "credit_card": {"secure": True},
        "expiry": {"unit": "minute", "duration": minutes_left},
    }
    headers = {"X-Override-Notification": midtrans_notification_url()} if midtrans_notification_url() else None
    status, snap = _midtrans("POST", f"{_hosts()[0]}/snap/v1/transactions", create, headers)
    if status not in (200, 201) or not snap.get("token"):
        print(f"[midtrans] snap create failed for {row['number']}: {status} {snap.get('error_messages')}", flush=True)
        raise HTTPException(502, "payment_provider_error")
    # The attempt exists at Midtrans from here on, whatever the card does: remember it first.
    data["midtrans"] = {"orderId": midtrans_order_id, "attempt": attempt, "method": "card", "mode": "own"}
    data["paymentMethod"] = "card"
    db.execute("UPDATE orders SET data = ? WHERE id = ?", (json.dumps(data), row["id"]))
    if row["payment_status"] in ("failed", "pending"):
        _add_event(db, row["id"], "awaiting_payment", "unpaid", "customer")  # a fresh attempt starts unpaid

    pay = {"payment_type": "credit_card", "payment_params": {"card_token": body.tokenId, "save_card": False}}
    status, res = _midtrans("POST", f"{_hosts()[0]}/snap/v1/transactions/{snap['token']}/pay", pay)
    if not res.get("transaction_status"):
        code = str(res.get("status_code") or status)
        print(f"[midtrans] card payment not started for {row['number']}: {status} {code} {res.get('status_message') or res.get('error_messages')}", flush=True)
        if code.startswith("4") and status == 200:
            # Midtrans turned the card down before anything was charged (bad or used token, card not accepted).
            db.commit()  # keep the attempt number; the refusal itself is the answer
            raise HTTPException(400, "card_rejected")
        raise HTTPException(502, "payment_provider_error")
    _apply(db, _get(db, order_id), {**res, "order_id": midtrans_order_id})
    return {"order": _to_order(db, _get(db, order_id)), "redirectUrl": res.get("redirect_url")}


@router.post("/{order_id}/sync")
def sync_payment(order_id: str, user: User, db: Db):
    """Ask Midtrans for this order's payment status now and apply it. The answer comes from
    Midtrans' own API, authenticated with the server key, so the browser cannot fake a payment."""
    expire_stale(db)
    seen = _own(db, order_id, user)
    midtrans_order_id = (json.loads(seen["data"]).get("midtrans") or {}).get("orderId")
    if midtrans_order_id and midtrans_server_key():
        # Ask Midtrans first, lock the order afterwards: the page asks every few seconds, and a
        # lock held across a call to another company's server would make everyone else wait.
        status, payload = _midtrans("GET", f"{_hosts()[1]}/v2/{midtrans_order_id}/status")
        row = db.execute("SELECT * FROM orders WHERE id = ? FOR UPDATE", (order_id,)).fetchone()
        # 404: the customer has not chosen a payment method in Snap yet, so nothing to apply.
        if status == 200 and str(payload.get("status_code")) != "404":
            _apply(db, row, {**payload, "order_id": midtrans_order_id})
    return {"order": _to_order(db, _get(db, order_id))}
