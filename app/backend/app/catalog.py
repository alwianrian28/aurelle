"""Catalog (F-04): products, variants, stock, shipping services and checkout cost rules.

The server owns prices and stock. Clients display what this module returns and send only
variant ids and quantities at checkout.
"""
import json
import re
import unicodedata
from datetime import date
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .auth import Admin, Db, now_iso
from .db import Database, IntegrityError, Row

router = APIRouter(prefix="/api/catalog", tags=["catalog"])
admin = APIRouter(prefix="/api/admin", tags=["admin catalog"])
SEED = Path(__file__).parent / "seed" / "catalog.json"

# Order states that hold stock: an unexpired unpaid order reserves it, a confirmed one has sold it.
STOCK_HOLDING = ("awaiting_payment", "confirmed", "preparing", "ready_to_ship", "shipped", "delivered", "pending_decision")
# The part of STOCK_HOLDING that is only a reservation: not paid for yet, may still be released.
RESERVED_ONLY = ("awaiting_payment", "pending_decision")
RESERVATION_MINUTES = 30  # default until an admin sets another window in the dashboard (OD-08)
TERMS_VERSION = "rs-terms-draft-2026-10"


def seed_catalog(db: Database) -> None:
    """Load the starter catalog once, into an empty database."""
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    if not db.execute("SELECT 1 FROM products LIMIT 1").fetchone():
        _seed_products(db, seed)
    # Collections arrived after the first deployments, so they are seeded on their own, once,
    # also into a database that already has products. Deleting them later does not bring them back.
    if not db.execute("SELECT 1 FROM settings WHERE name = 'collections_seeded'").fetchone():
        known = {r["id"] for r in db.execute("SELECT id FROM products").fetchall()}
        for sort, c in enumerate(seed["collections"]):
            data = {"name": c["name"], "story": c["story"], "banner": c["banner"]}
            db.execute("INSERT INTO collections (id, slug, active, sort, data) VALUES (?, ?, 1, ?, ?)", (c["id"], c["slug"], sort, json.dumps(data)))
            db.executemany(
                "INSERT INTO collection_products (collection_id, product_id, sort) VALUES (?, ?, ?)",
                [(c["id"], pid, n) for n, pid in enumerate(c["productIds"]) if pid in known],
            )
        db.execute("INSERT INTO settings (name, value) VALUES ('collections_seeded', '1')")
    # A catalog seeded before the metal was confirmed still says "silver appearance".
    from .wording import migrate as reword_catalog

    reword_catalog(db)


def _seed_products(db: Database, seed: dict) -> None:
    for sort, product in enumerate(seed["products"]):
        variants = product.pop("variants")
        db.execute(
            "INSERT INTO products (id, slug, category, active, sort, data) VALUES (?, ?, ?, ?, ?, ?)",
            (product["id"], product["slug"], product["category"], int(product.get("active", True)), sort, json.dumps(product)),
        )
        for vsort, v in enumerate(variants):
            db.execute(
                "INSERT INTO variants (id, product_id, sku, label, size, price_idr, stock, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (v["id"], product["id"], v["sku"], json.dumps(v["label"]), v.get("size"), v["priceIdr"], v["stock"], vsort),
            )
    for sort, s in enumerate(seed["shippingServices"]):
        db.execute(
            "INSERT INTO shipping_services (id, courier, name, eta_days, cost_idr, sort) VALUES (?, ?, ?, ?, ?, ?)",
            (s["id"], s["courier"], json.dumps(s["name"]), s["etaDays"], s["costIdr"], sort),
        )
    db.execute("INSERT INTO settings (name, value) VALUES ('usd_to_idr', ?)", (str(seed["usdToIdr"]),))
    db.execute("INSERT INTO settings (name, value) VALUES ('served_countries', ?)", (json.dumps(seed["servedCountries"]),))


def held_stock(db: Database) -> dict[str, int]:
    """Units per variant currently reserved or sold."""
    marks = ",".join("?" * len(STOCK_HOLDING))
    rows = db.execute(
        f"SELECT i.variant_id, SUM(i.qty) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status IN ({marks}) GROUP BY i.variant_id",
        STOCK_HOLDING,
    ).fetchall()
    return {r[0]: int(r[1]) for r in rows}  # SUM() of INT is BIGINT


def collection_links(db: Database) -> list[Row]:
    """Every (collection, product) pair, in the order each collection lists its products."""
    return db.execute("SELECT collection_id, product_id FROM collection_products ORDER BY collection_id, sort").fetchall()


def reserved_stock(db: Database) -> dict[str, int]:
    """Units per variant reserved by orders that are not paid yet (a subset of `held_stock`)."""
    marks = ",".join("?" * len(RESERVED_ONLY))
    rows = db.execute(
        f"SELECT i.variant_id, SUM(i.qty) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status IN ({marks}) GROUP BY i.variant_id",
        RESERVED_ONLY,
    ).fetchall()
    return {r[0]: int(r[1]) for r in rows}


def served_countries(db: Database) -> list[str]:
    return json.loads(db.execute("SELECT value FROM settings WHERE name = 'served_countries'").fetchone()[0])


def reservation_minutes(db: Database) -> int:
    """How long an unpaid order keeps its stock. Applies to orders placed from now on."""
    row = db.execute("SELECT value FROM settings WHERE name = 'reservation_minutes'").fetchone()
    return int(row[0]) if row else RESERVATION_MINUTES


def usd_to_idr(db: Database) -> int:
    return int(db.execute("SELECT value FROM settings WHERE name = 'usd_to_idr'").fetchone()[0])


def shipping_service(row: Row) -> dict:
    return {"id": row["id"], "courier": row["courier"], "name": json.loads(row["name"]), "etaDays": row["eta_days"], "costIdr": row["cost_idr"]}


def cost_breakdown(subtotal: int, shipping: int) -> dict[str, int]:
    """Checkout costs shown separately (BR-15). Tax (OD-16) and the duty calculation
    provider (OD-12) are still open in the PRD: tax is 0 and duty is a 5% working estimate."""
    tax, other = 0, 0
    # 5% rounded to the nearest 1,000, halves up, in integer maths (matches the web preview;
    # Python's round() would send 162.5 down to 162).
    duty = (subtotal + 10_000) // 20_000 * 1000
    return {"subtotal": subtotal, "tax": tax, "shipping": shipping, "duty": duty, "other": other, "total": subtotal + tax + shipping + duty + other}


@router.get("")
def get_catalog(db: Db):
    from .orders import expire_stale  # releases stock held by expired unpaid orders

    expire_stale(db)
    held = held_stock(db)
    variants: dict[str, list[dict]] = {}
    for v in db.execute("SELECT * FROM variants ORDER BY sort").fetchall():
        variants.setdefault(v["product_id"], []).append({
            "id": v["id"], "sku": v["sku"], "label": json.loads(v["label"]), "size": v["size"], "priceIdr": v["price_idr"],
            # Public figure only: what can be bought now, never the internal reservation split.
            "stock": max(0, v["stock"] - held.get(v["id"], 0)),
        })
    rows = db.execute("SELECT * FROM products WHERE active = 1 ORDER BY sort").fetchall()
    visible = {p["id"] for p in rows}
    shown = {c["id"]: {**json.loads(c["data"]), "id": c["id"], "slug": c["slug"], "productIds": []} for c in db.execute("SELECT * FROM collections WHERE active = 1 ORDER BY sort").fetchall()}
    member: dict[str, list[str]] = {}
    for link in collection_links(db):
        if link["collection_id"] in shown and link["product_id"] in visible:
            shown[link["collection_id"]]["productIds"].append(link["product_id"])
            member.setdefault(link["product_id"], []).append(link["collection_id"])
    # `active` and `collectionIds` come from the tables, not from the stored snapshot.
    products = [{**json.loads(p["data"]), "active": True, "collectionIds": member.get(p["id"], []), "variants": variants.get(p["id"], [])} for p in rows]
    return {
        "products": products,
        # A collection with nothing to show (all its products hidden, or none yet) stays off the shop.
        "collections": [c for c in shown.values() if c["productIds"]],
        "shippingServices": [shipping_service(s) for s in db.execute("SELECT * FROM shipping_services ORDER BY sort").fetchall()],
        "usdToIdr": usd_to_idr(db),
        "servedCountries": served_countries(db),
    }


class QuoteLine(BaseModel):
    variantId: str = Field(max_length=80)
    qty: int = Field(ge=1, le=99)


class QuoteIn(BaseModel):
    items: list[QuoteLine] = Field(min_length=1, max_length=50)
    shippingServiceId: str = Field(max_length=80)


@router.post("/quote")
def quote(body: QuoteIn, db: Db):
    """Cost preview for a cart at current prices, so clients do not re-implement the rules.
    The order itself is priced again at checkout."""
    service = db.execute("SELECT cost_idr FROM shipping_services WHERE id = ?", (body.shippingServiceId,)).fetchone()
    subtotal = 0
    for line in body.items:
        v = db.execute("SELECT price_idr FROM variants WHERE id = ?", (line.variantId,)).fetchone()
        if not v or not service:
            raise HTTPException(400, "invalid_input")
        subtotal += v["price_idr"] * line.qty
    return {"costs": cost_breakdown(subtotal, service["cost_idr"])}


# ------------------------------------------------------------------- admin


CategoryName = Literal["ring", "necklace", "bracelet", "earring"]
# A photo is a link: an upload (/api/media, see media.py), a file the shop already serves
# under /media, or any https address. File names under /media may hold spaces and commas;
# only what could break out of an HTML attribute or a line is refused.
MediaSrc = Annotated[str, Field(max_length=500, pattern=r"^(https://|/media/|/api/media/)[^\"<>\\\x00-\x1f]+$")]


class VariantIn(BaseModel):
    labelEn: str = Field(min_length=1, max_length=60)
    labelId: str | None = Field(default=None, max_length=60)
    sku: str = Field(min_length=2, max_length=80, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    priceIdr: int = Field(ge=1, le=10**12)
    available: int = Field(default=0, ge=0, le=100_000)


class ProductIn(BaseModel):
    nameEn: str = Field(min_length=2, max_length=120)
    nameId: str | None = Field(default=None, max_length=120)
    category: CategoryName
    descriptionEn: str = Field(default="", max_length=2000)
    descriptionId: str = Field(default="", max_length=2000)
    materialsEn: str = Field(default="", max_length=200)
    materialsId: str = Field(default="", max_length=200)
    # Hidden until the admin decides it is ready for customers.
    active: bool = False
    media: list[MediaSrc] = Field(default_factory=list, max_length=12)
    collectionIds: list[str] = Field(default_factory=list, max_length=20)
    variants: list[VariantIn] = Field(min_length=1, max_length=20)


class CollectionIn(BaseModel):
    nameEn: str = Field(min_length=2, max_length=120)
    nameId: str | None = Field(default=None, max_length=120)
    storyEn: str = Field(default="", max_length=1000)
    storyId: str = Field(default="", max_length=1000)
    banner: MediaSrc | None = None
    active: bool = True
    productIds: list[str] = Field(default_factory=list, max_length=200)


class CollectionPatch(BaseModel):
    nameEn: str | None = Field(default=None, min_length=2, max_length=120)
    nameId: str | None = Field(default=None, min_length=2, max_length=120)
    storyEn: str | None = Field(default=None, max_length=1000)
    storyId: str | None = Field(default=None, max_length=1000)
    # An empty string removes the banner.
    banner: MediaSrc | Literal[""] | None = None
    active: bool | None = None
    productIds: list[str] | None = Field(default=None, max_length=200)


class SettingsPatch(BaseModel):
    usdToIdr: int | None = Field(default=None, ge=1_000, le=100_000)
    reservationMinutes: int | None = Field(default=None, ge=5, le=1440)
    servedCountries: list[Annotated[str, Field(min_length=2, max_length=80, pattern=r"^[^<>\"]+$")]] | None = Field(default=None, min_length=1, max_length=60)


class ShippingPatch(BaseModel):
    courier: str | None = Field(default=None, min_length=2, max_length=60)
    nameEn: str | None = Field(default=None, min_length=2, max_length=80)
    nameId: str | None = Field(default=None, min_length=2, max_length=80)
    # "7-12" or "3": days, shown to the customer as an estimate. The seeded services use an en dash.
    etaDays: str | None = Field(default=None, pattern=r"^\d{1,2}([-–]\d{1,2})?$")
    costIdr: int | None = Field(default=None, ge=0, le=10**9)


class ShippingIn(BaseModel):
    courier: str = Field(min_length=2, max_length=60)
    nameEn: str = Field(min_length=2, max_length=80)
    nameId: str | None = Field(default=None, max_length=80)
    etaDays: str = Field(pattern=r"^\d{1,2}([-–]\d{1,2})?$")
    costIdr: int = Field(ge=0, le=10**9)


class ProductPatch(BaseModel):
    nameId: str | None = Field(default=None, min_length=2, max_length=120)
    nameEn: str | None = Field(default=None, min_length=2, max_length=120)
    descriptionId: str | None = Field(default=None, max_length=2000)
    descriptionEn: str | None = Field(default=None, max_length=2000)
    materialsId: str | None = Field(default=None, max_length=200)
    materialsEn: str | None = Field(default=None, max_length=200)
    category: CategoryName | None = None
    active: bool | None = None
    media: list[MediaSrc] | None = Field(default=None, max_length=12)
    collectionIds: list[str] | None = Field(default=None, max_length=20)


class VariantPatch(BaseModel):
    priceIdr: int | None = Field(default=None, ge=1, le=10**12)
    # Units that can be bought right now. Units already reserved or sold are kept on top of this.
    available: int | None = Field(default=None, ge=0, le=100_000)


def _audit(db: Database, admin: Row, entity: str, entity_id: str, field: str, old: object, new: object) -> None:
    db.execute(
        "INSERT INTO catalog_audit (actor, entity, entity_id, field, old_value, new_value, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (f"admin:{admin['id']}", entity, entity_id, field, str(old), str(new), now_iso()),
    )


def _slug(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")[:80]


def _free_slug(db: Database, table: Literal["products", "collections"], base: str, prefix: str = "") -> str:
    """`base`, or `base-2`, `base-3`… : the first one no row uses as its id or its slug."""
    n, slug = 1, base
    while db.execute(f"SELECT 1 FROM {table} WHERE slug = ? OR id = ?", (slug, prefix + slug)).fetchone():
        n += 1
        slug = f"{base}-{n}"
    return slug


def _refuse_taken_skus(db: Database, skus: list[str]) -> None:
    """SKUs identify a variant in the warehouse: no two variants may share one."""
    wanted = [s.strip().upper() for s in skus]
    taken = db.execute("SELECT 1 FROM variants WHERE UPPER(sku) = ANY(?) LIMIT 1", (wanted,)).fetchone()
    if taken or len(set(wanted)) != len(wanted):
        raise HTTPException(409, "sku_taken")


def _insert_variant(db: Database, product_id: str, v: VariantIn, sort: int) -> str:
    n = sort
    while db.execute("SELECT 1 FROM variants WHERE id = ?", (f"{product_id}-{n}",)).fetchone():
        n += 1
    label = {"id": (v.labelId or v.labelEn).strip(), "en": v.labelEn.strip()}
    size = re.fullmatch(r"Size (\S+)", label["en"])  # ring sizes are also stored on their own
    db.execute(
        "INSERT INTO variants (id, product_id, sku, label, size, price_idr, stock, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (f"{product_id}-{n}", product_id, v.sku.strip(), json.dumps(label), size.group(1) if size else None, v.priceIdr, v.available, sort),
    )
    return f"{product_id}-{n}"


def _set_media(data: dict, sources: list[str]) -> None:
    """Replace a product's photos, keeping the stored entry (id, alt text) of every photo that stays."""
    kept = {m["src"]: m for m in data.get("media", [])}
    used = {m["id"] for m in kept.values()}
    media = []
    for src in dict.fromkeys(sources):
        entry = kept.get(src)
        if not entry:
            n = 1
            while f"{data['id']}-photo-{n}" in used:
                n += 1
            entry = {"id": f"{data['id']}-photo-{n}", "src": src, "alt": dict(data["name"])}
            used.add(entry["id"])
        media.append(entry)
    # The stored thumbnail is a small copy of the old cover; without that cover it would be wrong.
    if not media or not data.get("media") or media[0]["src"] != data["media"][0]["src"]:
        data.pop("thumb", None)
    data["media"] = media


def _set_product_collections(db: Database, product_id: str, collection_ids: list[str]) -> None:
    wanted = list(dict.fromkeys(collection_ids))
    known = {r["id"] for r in db.execute("SELECT id FROM collections").fetchall()}
    if not set(wanted) <= known:
        raise HTTPException(400, "invalid_input")
    current = {r["collection_id"] for r in db.execute("SELECT collection_id FROM collection_products WHERE product_id = ?", (product_id,)).fetchall()}
    for cid in current - set(wanted):
        db.execute("DELETE FROM collection_products WHERE collection_id = ? AND product_id = ?", (cid, product_id))
    for cid in wanted:
        if cid not in current:  # a newcomer goes to the end of the collection
            last = db.execute("SELECT COALESCE(MAX(sort), -1) FROM collection_products WHERE collection_id = ?", (cid,)).fetchone()[0]
            db.execute("INSERT INTO collection_products (collection_id, product_id, sort) VALUES (?, ?, ?)", (cid, product_id, last + 1))


def _set_collection_products(db: Database, collection_id: str, product_ids: list[str]) -> None:
    wanted = list(dict.fromkeys(product_ids))
    known = {r["id"] for r in db.execute("SELECT id FROM products").fetchall()}
    if not set(wanted) <= known:
        raise HTTPException(400, "invalid_input")
    db.execute("DELETE FROM collection_products WHERE collection_id = ?", (collection_id,))
    db.executemany("INSERT INTO collection_products (collection_id, product_id, sort) VALUES (?, ?, ?)", [(collection_id, pid, n) for n, pid in enumerate(wanted)])


def _admin_products(db: Database) -> dict:
    """The whole catalog as the dashboard edits it: products with their variants, and collections."""
    held, reserved = held_stock(db), reserved_stock(db)
    collections = {c["id"]: {**json.loads(c["data"]), "id": c["id"], "slug": c["slug"], "active": bool(c["active"]), "productIds": []} for c in db.execute("SELECT * FROM collections ORDER BY sort").fetchall()}
    member: dict[str, list[str]] = {}
    for link in collection_links(db):
        collections[link["collection_id"]]["productIds"].append(link["product_id"])
        member.setdefault(link["product_id"], []).append(link["collection_id"])
    variants: dict[str, list[dict]] = {}
    for v in db.execute("SELECT * FROM variants ORDER BY sort").fetchall():
        taken, unpaid = held.get(v["id"], 0), reserved.get(v["id"], 0)
        variants.setdefault(v["product_id"], []).append({
            "id": v["id"], "sku": v["sku"], "label": json.loads(v["label"]), "priceIdr": v["price_idr"],
            # `held` waits for payment and may come back; `sold` is paid for.
            "available": max(0, v["stock"] - taken), "held": unpaid, "sold": taken - unpaid,
        })
    products = []
    for p in db.execute("SELECT * FROM products ORDER BY sort").fetchall():
        data = json.loads(p["data"])
        media = [m["src"] for m in data.get("media", []) if m.get("src")]
        products.append({
            "id": p["id"], "slug": p["slug"], "name": data["name"], "category": p["category"], "active": bool(p["active"]),
            "description": data.get("description") or {"id": "", "en": ""}, "materials": data.get("materials") or {"id": "", "en": ""},
            "thumb": data.get("thumb") or (media[0] if media else None), "media": media, "collectionIds": member.get(p["id"], []),
            "variants": variants.get(p["id"], []),
        })
    return {"products": products, "collections": list(collections.values())}


def _store_settings(db: Database) -> dict:
    return {
        "usdToIdr": usd_to_idr(db),
        "servedCountries": served_countries(db),
        "reservationMinutes": reservation_minutes(db),
        "shippingServices": [shipping_service(s) for s in db.execute("SELECT * FROM shipping_services ORDER BY sort").fetchall()],
    }


@admin.get("/settings")
def store_settings(_: Admin, db: Db):
    """The store rules checkout applies, as the dashboard's settings page shows and edits them."""
    return _store_settings(db)


@admin.patch("/settings")
def update_settings(body: SettingsPatch, user: Admin, db: Db):
    """Changes apply to what happens next: orders already placed keep the rate, the
    reservation window and the address they were placed with."""
    changes: list[tuple[str, object, str]] = []
    if body.usdToIdr is not None and body.usdToIdr != usd_to_idr(db):
        changes.append(("usd_to_idr", usd_to_idr(db), str(body.usdToIdr)))
    if body.reservationMinutes is not None and body.reservationMinutes != reservation_minutes(db):
        changes.append(("reservation_minutes", reservation_minutes(db), str(body.reservationMinutes)))
    if body.servedCountries is not None:
        countries = list(dict.fromkeys(c.strip() for c in body.servedCountries if c.strip()))
        if not countries:
            raise HTTPException(400, "invalid_input")
        if countries != served_countries(db):
            changes.append(("served_countries", ", ".join(served_countries(db)), json.dumps(countries)))
    for name, old, value in changes:
        db.execute("INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value", (name, value))
        _audit(db, user, "setting", name, "value", old, ", ".join(json.loads(value)) if name == "served_countries" else value)
    return _store_settings(db)


def _eta_in_order(eta: str) -> None:
    days = [int(n) for n in re.split("[-–]", eta)]
    if days != sorted(days):
        raise HTTPException(400, "invalid_input")


@admin.post("/shipping", status_code=201)
def create_shipping(body: ShippingIn, user: Admin, db: Db):
    """A new service is offered at checkout as soon as it is saved, after the existing ones."""
    _eta_in_order(body.etaDays)
    if db.execute("SELECT COUNT(*) FROM shipping_services").fetchone()[0] >= 12:
        raise HTTPException(400, "invalid_input")
    name = {"id": (body.nameId or body.nameEn).strip(), "en": body.nameEn.strip()}
    base, n = f"ship-{_slug(name['en']) or 'service'}", 1
    sid = base
    while db.execute("SELECT 1 FROM shipping_services WHERE id = ?", (sid,)).fetchone():
        n += 1
        sid = f"{base}-{n}"
    sort = db.execute("SELECT COALESCE(MAX(sort), -1) FROM shipping_services").fetchone()[0] + 1
    db.execute(
        "INSERT INTO shipping_services (id, courier, name, eta_days, cost_idr, sort) VALUES (?, ?, ?, ?, ?, ?)",
        (sid, body.courier.strip(), json.dumps(name), body.etaDays, body.costIdr, sort),
    )
    _audit(db, user, "shipping", sid, "created", "", name["en"])
    return {"id": sid, **_store_settings(db)}


@admin.delete("/shipping/{service_id}")
def delete_shipping(service_id: str, user: Admin, db: Db):
    """Orders carry their own copy of the service they chose, so removing one changes no order.
    The last one stays: without a shipping service nobody can check out."""
    row = db.execute("SELECT name FROM shipping_services WHERE id = ? FOR UPDATE", (service_id,)).fetchone()
    if not row:
        raise HTTPException(404, "not_found")
    if db.execute("SELECT COUNT(*) FROM shipping_services").fetchone()[0] <= 1:
        raise HTTPException(409, "last_service")
    db.execute("DELETE FROM shipping_services WHERE id = ?", (service_id,))
    _audit(db, user, "shipping", service_id, "deleted", json.loads(row["name"])["en"], "")
    return _store_settings(db)


@admin.patch("/shipping/{service_id}")
def update_shipping(service_id: str, body: ShippingPatch, user: Admin, db: Db):
    """Orders keep the shipping service they were placed with; this changes what new checkouts are offered."""
    row = db.execute("SELECT * FROM shipping_services WHERE id = ? FOR UPDATE", (service_id,)).fetchone()
    if not row:
        raise HTTPException(404, "not_found")
    name = json.loads(row["name"])
    new_name = {"id": (body.nameId or name["id"]).strip(), "en": (body.nameEn or name["en"]).strip()}
    wanted = {
        "courier": (body.courier or row["courier"]).strip(), "name": json.dumps(new_name),
        "eta_days": body.etaDays or row["eta_days"], "cost_idr": row["cost_idr"] if body.costIdr is None else body.costIdr,
    }
    _eta_in_order(wanted["eta_days"])
    for column, value in wanted.items():
        if value != row[column]:
            _audit(db, user, "shipping", service_id, column, row[column], value)
    db.execute("UPDATE shipping_services SET courier = ?, name = ?, eta_days = ?, cost_idr = ? WHERE id = ?", (*wanted.values(), service_id))
    return _store_settings(db)


@admin.get("/products")
def list_products(_: Admin, db: Db):
    """Every product, including hidden ones, with editable price and stock per variant."""
    from .orders import expire_stale

    expire_stale(db)
    return _admin_products(db)


@admin.post("/products", status_code=201)
def create_product(body: ProductIn, user: Admin, db: Db):
    """A new product with its first variants. Its id and shop address come from the English name."""
    _refuse_taken_skus(db, [v.sku for v in body.variants])
    name = {"id": (body.nameId or body.nameEn).strip(), "en": body.nameEn.strip()}
    pid = _free_slug(db, "products", _slug(name["en"]) or "product")
    data = {
        "id": pid, "slug": pid, "name": name, "tagline": {"id": "", "en": ""},
        "description": {"id": body.descriptionId.strip(), "en": body.descriptionEn.strip()},
        "category": body.category, "collectionIds": [], "saleType": "ready_stock",
        "materials": {"id": body.materialsId.strip(), "en": body.materialsEn.strip()},
        "engravingAvailable": False, "featured": False, "active": body.active, "media": [], "createdAt": date.today().isoformat(),
    }
    _set_media(data, body.media)
    sort = db.execute("SELECT COALESCE(MAX(sort), -1) FROM products").fetchone()[0] + 1
    db.execute("INSERT INTO products (id, slug, category, active, sort, data) VALUES (?, ?, ?, ?, ?, ?)", (pid, pid, body.category, int(body.active), sort, json.dumps(data)))
    for n, variant in enumerate(body.variants):
        _insert_variant(db, pid, variant, n)
    _set_product_collections(db, pid, body.collectionIds)
    _audit(db, user, "product", pid, "created", "", name["en"])
    return {"id": pid, **_admin_products(db)}


@admin.post("/products/{product_id}/variants", status_code=201)
def add_variant(product_id: str, body: VariantIn, user: Admin, db: Db):
    if not db.execute("SELECT 1 FROM products WHERE id = ? FOR UPDATE", (product_id,)).fetchone():
        raise HTTPException(404, "not_found")
    _refuse_taken_skus(db, [body.sku])
    if db.execute("SELECT COUNT(*) FROM variants WHERE product_id = ?", (product_id,)).fetchone()[0] >= 20:
        raise HTTPException(400, "invalid_input")
    sort = db.execute("SELECT COALESCE(MAX(sort), -1) FROM variants WHERE product_id = ?", (product_id,)).fetchone()[0] + 1
    vid = _insert_variant(db, product_id, body, sort)
    _audit(db, user, "variant", vid, "created", "", body.sku.strip())
    return _admin_products(db)


@admin.delete("/variants/{variant_id}")
def delete_variant(variant_id: str, user: Admin, db: Db):
    """Only a variant nobody has ordered can go: orders keep pointing at the variant they bought."""
    row = db.execute("SELECT * FROM variants WHERE id = ? FOR UPDATE", (variant_id,)).fetchone()
    if not row:
        raise HTTPException(404, "not_found")
    if db.execute("SELECT 1 FROM order_items WHERE variant_id = ? LIMIT 1", (variant_id,)).fetchone():
        raise HTTPException(409, "variant_in_orders")
    if db.execute("SELECT COUNT(*) FROM variants WHERE product_id = ?", (row["product_id"],)).fetchone()[0] <= 1:
        raise HTTPException(409, "last_variant")
    db.execute("DELETE FROM variants WHERE id = ?", (variant_id,))
    _audit(db, user, "variant", variant_id, "deleted", row["sku"], "")
    return _admin_products(db)


@admin.post("/collections", status_code=201)
def create_collection(body: CollectionIn, user: Admin, db: Db):
    name = {"id": (body.nameId or body.nameEn).strip(), "en": body.nameEn.strip()}
    slug = _free_slug(db, "collections", _slug(name["en"]) or "collection", prefix="col-")
    cid = f"col-{slug}"
    data = {"name": name, "story": {"id": body.storyId.strip(), "en": body.storyEn.strip()}, "banner": body.banner or ""}
    sort = db.execute("SELECT COALESCE(MAX(sort), -1) FROM collections").fetchone()[0] + 1
    try:
        db.execute("INSERT INTO collections (id, slug, active, sort, data) VALUES (?, ?, ?, ?, ?)", (cid, slug, int(body.active), sort, json.dumps(data)))
    except IntegrityError:  # the same name was saved a moment ago
        raise HTTPException(409, "conflict") from None
    _set_collection_products(db, cid, body.productIds)
    _audit(db, user, "collection", cid, "created", "", name["en"])
    return {"id": cid, **_admin_products(db)}


@admin.patch("/collections/{collection_id}")
def update_collection(collection_id: str, body: CollectionPatch, user: Admin, db: Db):
    row = db.execute("SELECT * FROM collections WHERE id = ? FOR UPDATE", (collection_id,)).fetchone()
    if not row:
        raise HTTPException(404, "not_found")
    data = json.loads(row["data"])
    for field, lang, value in (("name", "id", body.nameId), ("name", "en", body.nameEn), ("story", "id", body.storyId), ("story", "en", body.storyEn)):
        if value is not None and value.strip() != data[field][lang]:
            _audit(db, user, "collection", collection_id, f"{field}.{lang}", data[field][lang], value.strip())
            data[field][lang] = value.strip()
    if body.banner is not None and body.banner != data.get("banner", ""):
        _audit(db, user, "collection", collection_id, "banner", data.get("banner", ""), body.banner)
        data["banner"] = body.banner
    active = row["active"]
    if body.active is not None and int(body.active) != active:
        _audit(db, user, "collection", collection_id, "active", bool(active), body.active)
        active = int(body.active)
    db.execute("UPDATE collections SET data = ?, active = ? WHERE id = ?", (json.dumps(data), active, collection_id))
    if body.productIds is not None:
        old = [r["product_id"] for r in db.execute("SELECT product_id FROM collection_products WHERE collection_id = ? ORDER BY sort", (collection_id,)).fetchall()]
        if old != list(dict.fromkeys(body.productIds)):
            _set_collection_products(db, collection_id, body.productIds)
            _audit(db, user, "collection", collection_id, "products", ",".join(old), ",".join(dict.fromkeys(body.productIds)))
    return _admin_products(db)


@admin.delete("/collections/{collection_id}")
def delete_collection(collection_id: str, user: Admin, db: Db):
    """Removes the grouping only; its products stay in the catalog."""
    row = db.execute("SELECT data FROM collections WHERE id = ?", (collection_id,)).fetchone()
    if not row:
        raise HTTPException(404, "not_found")
    db.execute("DELETE FROM collections WHERE id = ?", (collection_id,))
    _audit(db, user, "collection", collection_id, "deleted", json.loads(row["data"])["name"]["en"], "")
    return _admin_products(db)


@admin.patch("/products/{product_id}")
def update_product(product_id: str, body: ProductPatch, user: Admin, db: Db):
    row = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not row:
        raise HTTPException(404, "not_found")
    data = json.loads(row["data"])
    texts = (
        ("name", "id", body.nameId), ("name", "en", body.nameEn),
        ("description", "id", body.descriptionId), ("description", "en", body.descriptionEn),
        ("materials", "id", body.materialsId), ("materials", "en", body.materialsEn),
    )
    for field, lang, value in texts:
        old = (data.get(field) or {}).get(lang, "")
        if value is not None and value.strip() != old:
            _audit(db, user, "product", product_id, f"{field}.{lang}", old, value.strip())
            data.setdefault(field, {})[lang] = value.strip()
    category = row["category"]
    if body.category is not None and body.category != category:
        _audit(db, user, "product", product_id, "category", category, body.category)
        category = data["category"] = body.category
    active = row["active"]
    if body.active is not None and int(body.active) != row["active"]:
        _audit(db, user, "product", product_id, "active", bool(row["active"]), body.active)
        active = int(body.active)
    if body.media is not None and list(dict.fromkeys(body.media)) != [m["src"] for m in data.get("media", [])]:
        _audit(db, user, "product", product_id, "media", len(data.get("media", [])), len(dict.fromkeys(body.media)))
        _set_media(data, body.media)
    db.execute("UPDATE products SET data = ?, category = ?, active = ? WHERE id = ?", (json.dumps(data), category, active, product_id))
    if body.collectionIds is not None:
        _set_product_collections(db, product_id, body.collectionIds)
    return _admin_products(db)


@admin.patch("/variants/{variant_id}")
def update_variant(variant_id: str, body: VariantPatch, user: Admin, db: Db):
    """Change a price or the available stock. Existing orders keep the price they were placed at (AC-12)."""
    # Row lock: no checkout may reserve this variant between the read and the write.
    row = db.execute("SELECT * FROM variants WHERE id = ? FOR UPDATE", (variant_id,)).fetchone()
    if not row:
        raise HTTPException(404, "not_found")
    if body.priceIdr is not None and body.priceIdr != row["price_idr"]:
        _audit(db, user, "variant", variant_id, "price_idr", row["price_idr"], body.priceIdr)
        db.execute("UPDATE variants SET price_idr = ? WHERE id = ?", (body.priceIdr, variant_id))
    if body.available is not None:
        taken = held_stock(db).get(variant_id, 0)
        stock = body.available + taken
        if stock != row["stock"]:
            _audit(db, user, "variant", variant_id, "stock", row["stock"], stock)
            db.execute("UPDATE variants SET stock = ? WHERE id = ?", (stock, variant_id))
    return _admin_products(db)
