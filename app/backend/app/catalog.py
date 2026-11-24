"""Catalog (F-04): products, variants, stock, shipping services and checkout cost rules.

The server owns prices and stock. Clients display what this module returns and send only
variant ids and quantities at checkout.
"""
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .auth import Admin, Db, now_iso
from .db import Database, Row

router = APIRouter(prefix="/api/catalog", tags=["catalog"])
admin = APIRouter(prefix="/api/admin", tags=["admin catalog"])
SEED = Path(__file__).parent / "seed" / "catalog.json"

# Order states that hold stock: an unexpired unpaid order reserves it, a confirmed one has sold it.
STOCK_HOLDING = ("awaiting_payment", "confirmed", "preparing", "ready_to_ship", "shipped", "delivered", "pending_decision")
RESERVATION_MINUTES = 30  # OD-08 is still open; 30 minutes is the working default
TERMS_VERSION = "rs-terms-draft-2026-10"


def seed_catalog(db: Database) -> None:
    """Load the starter catalog once, into an empty database."""
    if db.execute("SELECT 1 FROM products LIMIT 1").fetchone():
        return
    seed = json.loads(SEED.read_text())
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


def served_countries(db: Database) -> list[str]:
    return json.loads(db.execute("SELECT value FROM settings WHERE name = 'served_countries'").fetchone()[0])


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
    products = [{**json.loads(p["data"]), "variants": variants.get(p["id"], [])} for p in db.execute("SELECT * FROM products WHERE active = 1 ORDER BY sort").fetchall()]
    return {
        "products": products,
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


class ProductPatch(BaseModel):
    nameId: str | None = Field(default=None, min_length=2, max_length=120)
    nameEn: str | None = Field(default=None, min_length=2, max_length=120)
    active: bool | None = None


class VariantPatch(BaseModel):
    priceIdr: int | None = Field(default=None, ge=1, le=10**12)
    # Units that can be bought right now. Units already reserved or sold are kept on top of this.
    available: int | None = Field(default=None, ge=0, le=100_000)


def _audit(db: Database, admin: Row, entity: str, entity_id: str, field: str, old: object, new: object) -> None:
    db.execute(
        "INSERT INTO catalog_audit (actor, entity, entity_id, field, old_value, new_value, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (f"admin:{admin['id']}", entity, entity_id, field, str(old), str(new), now_iso()),
    )


def _admin_products(db: Database) -> dict:
    held = held_stock(db)
    variants: dict[str, list[dict]] = {}
    for v in db.execute("SELECT * FROM variants ORDER BY sort").fetchall():
        taken = held.get(v["id"], 0)
        variants.setdefault(v["product_id"], []).append({
            "id": v["id"], "sku": v["sku"], "label": json.loads(v["label"]), "priceIdr": v["price_idr"],
            "available": max(0, v["stock"] - taken), "held": taken,
        })
    products = []
    for p in db.execute("SELECT * FROM products ORDER BY sort").fetchall():
        data = json.loads(p["data"])
        products.append({"id": p["id"], "name": data["name"], "category": p["category"], "thumb": data.get("thumb"), "active": bool(p["active"]), "variants": variants.get(p["id"], [])})
    return {"products": products}


@admin.get("/products")
def list_products(_: Admin, db: Db):
    """Every product, including hidden ones, with editable price and stock per variant."""
    from .orders import expire_stale

    expire_stale(db)
    return _admin_products(db)


@admin.patch("/products/{product_id}")
def update_product(product_id: str, body: ProductPatch, user: Admin, db: Db):
    row = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not row:
        raise HTTPException(404, "not_found")
    data = json.loads(row["data"])
    for lang, value in (("id", body.nameId), ("en", body.nameEn)):
        if value is not None and value.strip() != data["name"][lang]:
            _audit(db, user, "product", product_id, f"name.{lang}", data["name"][lang], value.strip())
            data["name"][lang] = value.strip()
    active = row["active"]
    if body.active is not None and int(body.active) != row["active"]:
        _audit(db, user, "product", product_id, "active", bool(row["active"]), body.active)
        active = int(body.active)
    db.execute("UPDATE products SET data = ?, active = ? WHERE id = ?", (json.dumps(data), active, product_id))
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
