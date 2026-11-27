"""Newsletter (F-06): the storefront's sign-up form, and the list the store's staff read.

There is no confirmation email (the backend sends none yet), so a sign-up counts from the
moment the form is sent with its consent box ticked. What was agreed to, and when, is kept
with the address.
"""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .auth import EMAIL_RE, Admin, Db
from .security import Limiter

router = APIRouter(prefix="/api/newsletter", tags=["newsletter"])
admin = APIRouter(prefix="/api/admin", tags=["admin newsletter"])
# Sign-ups one address (a household, an office) may send before it waits a minute.
signup_limiter = Limiter(10, 60)


class SubscribeIn(BaseModel):
    email: str = Field(max_length=254)
    consent: bool
    consentVersion: str = Field(min_length=1, max_length=60)
    locale: Literal["en", "id", "zh", "ko", "ja"] = "en"
    source: Literal["footer", "home", "account"] = "footer"


@router.post("", status_code=201)
def subscribe(body: SubscribeIn, request: Request, db: Db):
    """Put an address on the list. The answer is the same whether or not it was there already,
    so the form cannot be used to find out who subscribes."""
    key = request.client.host if request.client else "?"
    locked = signup_limiter.locked_for(key)
    if locked > 0:
        raise HTTPException(429, {"error": "too_many_attempts", "retryAfterMs": int(locked * 1000)})
    signup_limiter.fail(key)
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "invalid_input")
    if not body.consent:
        raise HTTPException(400, "consent_required")
    # Someone who left and comes back is subscribed again, under the consent given now. Someone
    # already on the list keeps the consent and the date of their first sign-up.
    db.execute(
        "INSERT INTO newsletter_subscribers (email, locale, source, consent_version, subscribed_at) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT (email) DO UPDATE SET locale = EXCLUDED.locale, source = EXCLUDED.source, consent_version = EXCLUDED.consent_version, "
        "subscribed_at = EXCLUDED.subscribed_at, unsubscribed_at = NULL WHERE newsletter_subscribers.unsubscribed_at IS NOT NULL",
        (email, body.locale, body.source, body.consentVersion, datetime.now(timezone.utc)),
    )
    return {"status": "subscribed"}


@admin.get("/newsletter")
def subscribers(_: Admin, db: Db):
    """Everyone on the list, newest first."""
    rows = db.execute("SELECT email, locale, source, consent_version, subscribed_at, unsubscribed_at FROM newsletter_subscribers ORDER BY subscribed_at DESC").fetchall()
    return {"subscribers": [
        {"email": r["email"], "locale": r["locale"], "source": r["source"], "consentVersion": r["consent_version"],
         "subscribedAt": r["subscribed_at"].isoformat(), "unsubscribedAt": r["unsubscribed_at"].isoformat() if r["unsubscribed_at"] else None}
        for r in rows
    ]}
