"""Accounts and sessions (F-01): register, login, Google sign-in, email verification, password reset."""
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from .config import google_client_id, is_prod, shop_origin
from .db import Database, IntegrityError, Row, get_db
from .security import Limiter, hash_password, hash_token, new_token, password_too_long, verify_password

COOKIE = "aurelle_sid"
DAY = 24 * 60 * 60
SESSION_S = DAY        # closes with the browser
KEEP_S = 30 * DAY      # "Keep me logged in"
VERIFY_TTL_S = DAY
RESET_TTL_S = 15 * 60
RESEND_COOLDOWN_S = 60
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

Db = Annotated[Database, Depends(get_db)]
router = APIRouter(prefix="/api/auth", tags=["auth"])
login_limiter = Limiter(5, 60)
_last_sent: dict[str, float] = {}  # resend cooldown per kind+user


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def public_user(u: Row) -> dict:
    """Shape the web/mobile `User` type expects. Never includes the password hash."""
    return {
        "id": u["id"], "email": u["email"], "username": u["username"], "role": u["role"],
        "emailVerified": bool(u["email_verified"]), "provider": u["provider"],
        "phoneCountryCode": u["phone_country_code"], "phone": u["phone"],
        "preferredLocale": u["preferred_locale"], "preferredCurrency": u["preferred_currency"],
        "newsletter": bool(u["newsletter"]),
        "createdAt": u["created_at"],
    }


def _user_by_id(db: Database, user_id: str) -> Row | None:
    return db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def current_user(db: Db, sid: Annotated[str | None, Cookie(alias=COOKIE)] = None) -> Row | None:
    if not sid:
        return None
    row = db.execute("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?", (hash_token(sid),)).fetchone()
    if not row:
        return None
    if row["expires_at"] <= time.time():
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(sid),))
        return None
    return _user_by_id(db, row["user_id"])


MaybeUser = Annotated[Row | None, Depends(current_user)]


def require_user(user: MaybeUser) -> Row:
    if not user:
        raise HTTPException(401, "unauthenticated")
    return user


def require_admin(user: Annotated[Row, Depends(require_user)]) -> Row:
    if user["role"] != "admin":
        raise HTTPException(403, "forbidden")
    return user


User = Annotated[Row, Depends(require_user)]
Admin = Annotated[Row, Depends(require_admin)]


def _start_session(db: Database, response: Response, user_id: str, keep: bool) -> None:
    token = new_token()
    ttl = KEEP_S if keep else SESSION_S
    db.execute("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", (hash_token(token), user_id, time.time() + ttl))
    response.set_cookie(COOKIE, token, httponly=True, samesite="lax", secure=is_prod(), path="/", max_age=ttl if keep else None)


def _issue_token(db: Database, kind: str, user_id: str) -> str:
    # A new link replaces any earlier unused one of the same kind.
    db.execute("DELETE FROM tokens WHERE user_id = ? AND kind = ? AND used_at IS NULL", (user_id, kind))
    token = new_token()
    ttl = VERIFY_TTL_S if kind == "verify" else RESET_TTL_S
    db.execute("INSERT INTO tokens (token_hash, kind, user_id, expires_at) VALUES (?, ?, ?, ?)", (hash_token(token), kind, user_id, time.time() + ttl))
    return token


def _inspect(db: Database, kind: str, token: str) -> tuple[str, str | None]:
    row = db.execute("SELECT user_id, expires_at, used_at FROM tokens WHERE token_hash = ? AND kind = ?", (hash_token(token), kind)).fetchone() if token else None
    if not row:
        return "invalid", None
    if row["used_at"]:
        return "used", None
    if row["expires_at"] < time.time():
        return "expired", None
    return "ok", row["user_id"]


def _deliver(kind: str, email: str, token: str) -> dict:
    """No email provider is connected yet (PRD §9): the link goes to the server log and,
    outside production only, is echoed to the client so the flow can be completed."""
    if is_prod():
        return {}
    page = "verify-email" if kind == "verify" else "reset-password"
    print(f"[mail:{kind}] to {email}: {shop_origin()}/auth/{page}?token={token}", flush=True)
    return {"devToken": token}


def _cooldown(key: str) -> float:
    """Seconds left before another email may be sent; 0 starts a new cooldown."""
    wait = _last_sent.get(key, 0) + RESEND_COOLDOWN_S - time.time()
    if wait <= 0:
        _last_sent[key] = time.time()
        return 0
    return wait


class RegisterIn(BaseModel):
    email: str = Field(max_length=254)
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8, max_length=72)
    newsletter: bool = False


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)
    keep: bool = False


class GoogleIn(BaseModel):
    """`credential` is the ID token Google Identity Services hands to the page."""
    credential: str = Field(min_length=20, max_length=4096)
    keep: bool = False


class EmailIn(BaseModel):
    email: str = Field(max_length=254)


class TokenIn(BaseModel):
    token: str = Field(max_length=200)


class ResetIn(TokenIn):
    password: str = Field(min_length=8, max_length=72)


class ProfileIn(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=80)
    phoneCountryCode: str | None = Field(default=None, pattern=r"^(\+\d{1,4})?$")
    phone: str | None = Field(default=None, pattern=r"^([\d\s-]{6,20})?$")
    newsletter: bool | None = None


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Db, response: Response):
    email = body.email.strip().lower()
    username = body.username.strip()
    if not EMAIL_RE.match(email) or len(username) < 3 or password_too_long(body.password):
        raise HTTPException(400, "invalid_input")
    if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise HTTPException(409, "email_in_use")
    user_id = str(uuid.uuid4())
    try:
        db.execute(
            "INSERT INTO users (id, email, username, password_hash, newsletter, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, email, username, hash_password(body.password), int(body.newsletter), now_iso()),
        )
    except IntegrityError:  # the same email registered a moment ago
        raise HTTPException(409, "email_in_use") from None
    _start_session(db, response, user_id, keep=False)
    return {"user": public_user(_user_by_id(db, user_id)), **_deliver("verify", email, _issue_token(db, "verify", user_id))}


@router.post("/login")
def login(body: LoginIn, db: Db, request: Request, response: Response):
    email = body.email.strip().lower()
    key = f"{request.client.host if request.client else '?'}|{email}"
    locked = login_limiter.locked_for(key)
    if locked:
        raise HTTPException(429, {"error": "throttled", "retryAfterMs": int(locked * 1000)})
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    # Same response whether the email exists or the password is wrong (FR-01-07).
    if not user or not verify_password(body.password, user["password_hash"]):
        login_limiter.fail(key)
        raise HTTPException(401, {"error": "invalid_credentials", "retryAfterMs": int(login_limiter.locked_for(key) * 1000)})
    login_limiter.reset(key)
    _start_session(db, response, user["id"], body.keep)
    return {"user": public_user(user)}


def verify_google_credential(credential: str, client_id: str) -> dict | None:
    """Claims of a Google ID token, or None when it is not a valid token for this app.

    Google's library checks the signature against Google's published keys, the expiry, the
    issuer and that the token was issued for our client ID. Raises TransportError when
    Google's keys cannot be fetched."""
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    try:
        return id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
    except ValueError:
        return None


@router.get("/config")
def auth_config():
    """What the sign-in pages need before anyone is logged in."""
    return {"googleClientId": google_client_id()}


@router.post("/google")
def google_login(body: GoogleIn, db: Db, response: Response):
    """Sign in, or create the account, with a Google ID token (BR-03)."""
    from google.auth.exceptions import TransportError

    client_id = google_client_id()
    if not client_id:
        raise HTTPException(503, "google_not_configured")
    try:
        claims = verify_google_credential(body.credential, client_id)
    except TransportError:
        raise HTTPException(503, "google_unreachable") from None
    email = str((claims or {}).get("email") or "").strip().lower()
    # Only an address Google itself has verified may open or create an account.
    if not claims or claims.get("email_verified") not in (True, "true") or not EMAIL_RE.match(email) or len(email) > 254:
        raise HTTPException(401, "invalid_credentials")

    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if user and not user["email_verified"]:
        # A password account nobody proved they own. Google has now proved who owns the
        # address, so the old password and any session opened with it stop working.
        db.execute("UPDATE users SET email_verified = 1, password_hash = ? WHERE id = ?", (hash_password(new_token()), user["id"]))
        db.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
    if not user:
        name = " ".join(str(claims.get("name") or "").split())[:80]
        if len(name) < 3:
            name = email.split("@")[0][:80].ljust(3, "_")
        user_id = str(uuid.uuid4())
        # No password is set: the hash is of a random secret nobody holds. The customer can
        # still add one later through "Forgot password". ON CONFLICT: the same address may have
        # signed up a moment ago, and in Postgres a failed INSERT would abort the transaction.
        db.execute(
            "INSERT INTO users (id, email, username, password_hash, provider, email_verified, created_at) VALUES (?, ?, ?, ?, 'google', 1, ?) ON CONFLICT (email) DO NOTHING",
            (user_id, email, name, hash_password(new_token()), now_iso()),
        )
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    _start_session(db, response, user["id"], body.keep)
    return {"user": public_user(user)}


@router.post("/logout")
def logout(db: Db, response: Response, sid: Annotated[str | None, Cookie(alias=COOKIE)] = None):
    if sid:
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(sid),))
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: MaybeUser):
    return {"user": public_user(user) if user else None}


@router.patch("/profile")
def update_profile(body: ProfileIn, user: User, db: Db):
    fields = body.model_dump(exclude_unset=True)
    username = (fields.get("username") or user["username"]).strip()
    if len(username) < 3:
        raise HTTPException(400, "invalid_input")
    cc = fields["phoneCountryCode"] or None if "phoneCountryCode" in fields else user["phone_country_code"]
    phone = fields["phone"] or None if "phone" in fields else user["phone"]
    newsletter = int(fields["newsletter"]) if fields.get("newsletter") is not None else user["newsletter"]
    db.execute("UPDATE users SET username = ?, phone_country_code = ?, phone = ?, newsletter = ? WHERE id = ?", (username, cc, phone, newsletter, user["id"]))
    return {"user": public_user(_user_by_id(db, user["id"]))}


@router.post("/verify/resend")
def resend_verification(user: User, db: Db):
    if user["email_verified"]:
        return {"ok": True}
    wait = _cooldown(f"verify|{user['id']}")
    if wait:
        raise HTTPException(429, {"error": "cooldown", "retryAfterMs": int(wait * 1000)})
    return {"ok": True, **_deliver("verify", user["email"], _issue_token(db, "verify", user["id"]))}


@router.post("/verify")
def verify_email(body: TokenIn, db: Db, user: MaybeUser):
    result, user_id = _inspect(db, "verify", body.token)
    # A signed-in user may only confirm their own link.
    if result == "ok" and user and user["id"] != user_id:
        result = "invalid"
    if result == "ok":
        db.execute("UPDATE tokens SET used_at = ? WHERE token_hash = ?", (time.time(), hash_token(body.token)))
        db.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user_id,))
    return {"result": result}


@router.post("/forgot")
def forgot_password(body: EmailIn, db: Db):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "invalid_input")
    user = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    extra: dict = {}
    if user and not _cooldown(f"reset|{user['id']}"):
        extra = _deliver("reset", email, _issue_token(db, "reset", user["id"]))
    # Identical status for known and unknown emails (AC-01-06).
    return {"ok": True, **extra}


@router.post("/reset/inspect")
def inspect_reset(body: TokenIn, db: Db):
    return {"result": _inspect(db, "reset", body.token)[0]}


@router.post("/reset")
def reset_password(body: ResetIn, db: Db, response: Response):
    if password_too_long(body.password):
        raise HTTPException(400, "invalid_input")
    result, user_id = _inspect(db, "reset", body.token)
    if result == "ok":
        db.execute("UPDATE tokens SET used_at = ? WHERE token_hash = ?", (time.time(), hash_token(body.token)))
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(body.password), user_id))
        # Every existing session ends after a password change.
        db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        response.delete_cookie(COOKIE, path="/")
    return {"result": result}
