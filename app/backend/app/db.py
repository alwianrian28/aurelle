"""Postgres access (Supabase in production, the docker-compose Postgres locally). Each request
borrows a connection from a small pool; money is stored as integer rupiah."""
import threading
import time
from collections.abc import Iterator, Sequence
from typing import Any

import psycopg

from .config import database_url

IntegrityError = psycopg.IntegrityError

# Each statement is executed separately on startup. Flags are SMALLINT 0/1, so queries
# compare them with `= 1`.
SCHEMA = [
    """CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(40) PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE,
      username VARCHAR(80) NOT NULL,
      password_hash VARCHAR(200) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'customer',
      provider VARCHAR(10) NOT NULL DEFAULT 'email',
      email_verified SMALLINT NOT NULL DEFAULT 0,
      phone_country_code VARCHAR(5),
      phone VARCHAR(20),
      preferred_locale VARCHAR(5) NOT NULL DEFAULT 'id',
      preferred_currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
      newsletter SMALLINT NOT NULL DEFAULT 0,
      created_at VARCHAR(32) NOT NULL,
      CONSTRAINT users_role CHECK (role IN ('customer', 'admin'))
    )""",
    """CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id VARCHAR(40) NOT NULL,
      expires_at DOUBLE PRECISION NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )""",
    "CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)",
    # Single-use email links (verify / reset). Only the hash is stored.
    """CREATE TABLE IF NOT EXISTS tokens (
      token_hash CHAR(64) PRIMARY KEY,
      kind VARCHAR(10) NOT NULL,
      user_id VARCHAR(40) NOT NULL,
      expires_at DOUBLE PRECISION NOT NULL,
      used_at DOUBLE PRECISION,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT tokens_kind CHECK (kind IN ('verify', 'reset'))
    )""",
    "CREATE INDEX IF NOT EXISTS tokens_user ON tokens (user_id)",
    # Catalog (seeded from app/seed/catalog.json on first start; edited from the dashboard).
    """CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(80) PRIMARY KEY,
      slug VARCHAR(120) NOT NULL UNIQUE,
      category VARCHAR(20) NOT NULL,
      active SMALLINT NOT NULL DEFAULT 1,
      sort INT NOT NULL,
      data TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS variants (
      id VARCHAR(80) PRIMARY KEY,
      product_id VARCHAR(80) NOT NULL,
      sku VARCHAR(80) NOT NULL,
      label TEXT NOT NULL,
      size VARCHAR(20),
      price_idr BIGINT NOT NULL,
      stock INT NOT NULL,
      sort INT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      CONSTRAINT variants_price CHECK (price_idr > 0),
      CONSTRAINT variants_stock CHECK (stock >= 0)
    )""",
    "CREATE INDEX IF NOT EXISTS variants_product ON variants (product_id)",
    # Curated groups of products, each with a story and a banner; `data` holds the texts.
    """CREATE TABLE IF NOT EXISTS collections (
      id VARCHAR(80) PRIMARY KEY,
      slug VARCHAR(120) NOT NULL UNIQUE,
      active SMALLINT NOT NULL DEFAULT 1,
      sort INT NOT NULL,
      data TEXT NOT NULL
    )""",
    # Which products a collection shows, in the order the admin arranged them.
    """CREATE TABLE IF NOT EXISTS collection_products (
      collection_id VARCHAR(80) NOT NULL,
      product_id VARCHAR(80) NOT NULL,
      sort INT NOT NULL,
      PRIMARY KEY (collection_id, product_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )""",
    "CREATE INDEX IF NOT EXISTS collection_products_product ON collection_products (product_id)",
    # Photos uploaded from the dashboard. Kept in the database so the API needs no disk of its
    # own (it runs on serverless hosts); served at /api/media/<id>.<ext> with a long cache life.
    """CREATE TABLE IF NOT EXISTS media_files (
      id VARCHAR(40) PRIMARY KEY,
      content_type VARCHAR(40) NOT NULL,
      data BYTEA NOT NULL,
      size INT NOT NULL,
      actor VARCHAR(60) NOT NULL,
      created_at VARCHAR(32) NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS shipping_services (
      id VARCHAR(80) PRIMARY KEY,
      courier VARCHAR(60) NOT NULL,
      name TEXT NOT NULL,
      eta_days VARCHAR(20) NOT NULL,
      cost_idr BIGINT NOT NULL,
      sort INT NOT NULL
    )""",
    "CREATE TABLE IF NOT EXISTS settings (name VARCHAR(60) PRIMARY KEY, value TEXT NOT NULL)",
    """CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(80) PRIMARY KEY,
      user_id VARCHAR(40) NOT NULL,
      number VARCHAR(30) NOT NULL UNIQUE,
      status VARCHAR(30) NOT NULL,
      payment_status VARCHAR(30) NOT NULL,
      total_idr BIGINT NOT NULL,
      data TEXT NOT NULL,
      courier VARCHAR(60),
      tracking_number VARCHAR(60),
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )""",
    # Postgres does not index foreign keys on its own, so the ones we look up by are explicit.
    "CREATE INDEX IF NOT EXISTS orders_created ON orders (created_at)",
    "CREATE INDEX IF NOT EXISTS orders_status ON orders (status)",
    "CREATE INDEX IF NOT EXISTS orders_user ON orders (user_id)",
    # Lines of each order, used for stock arithmetic (the full snapshot lives in orders.data).
    """CREATE TABLE IF NOT EXISTS order_items (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_id VARCHAR(80) NOT NULL,
      variant_id VARCHAR(80) NOT NULL,
      qty INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT order_items_qty CHECK (qty > 0)
    )""",
    "CREATE INDEX IF NOT EXISTS order_items_variant ON order_items (variant_id)",
    "CREATE INDEX IF NOT EXISTS order_items_order ON order_items (order_id)",
    # Status trail with who changed it (audit, AC-18).
    """CREATE TABLE IF NOT EXISTS order_events (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_id VARCHAR(80) NOT NULL,
      status VARCHAR(30) NOT NULL,
      payment_status VARCHAR(30) NOT NULL,
      actor VARCHAR(60) NOT NULL,
      at VARCHAR(32) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )""",
    "CREATE INDEX IF NOT EXISTS order_events_order ON order_events (order_id)",
    # Shipment checkpoints shown on the tracking map.
    """CREATE TABLE IF NOT EXISTS tracking_points (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_id VARCHAR(80) NOT NULL,
      label VARCHAR(120) NOT NULL,
      note VARCHAR(300) NOT NULL DEFAULT '',
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      actor VARCHAR(60) NOT NULL,
      at VARCHAR(32) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )""",
    "CREATE INDEX IF NOT EXISTS tracking_points_order ON tracking_points (order_id)",
    # Who changed which catalog value, and from what to what (audit, AC-18).
    """CREATE TABLE IF NOT EXISTS catalog_audit (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      actor VARCHAR(60) NOT NULL,
      entity VARCHAR(20) NOT NULL,
      entity_id VARCHAR(80) NOT NULL,
      field VARCHAR(40) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      at VARCHAR(32) NOT NULL
    )""",
]

TABLES = ("users", "sessions", "tokens", "products", "variants", "collections", "collection_products", "shipping_services", "settings", "media_files", "orders", "order_items", "order_events", "tracking_points", "catalog_audit")


class Row(dict):
    """A result row addressable by column name or by position."""

    def __getitem__(self, key: Any) -> Any:
        return list(self.values())[key] if isinstance(key, int) else super().__getitem__(key)


def _row_factory(cursor: psycopg.Cursor) -> Any:
    names = [column.name for column in cursor.description or ()]
    return lambda values: Row(zip(names, values))


class Database:
    """Thin wrapper so queries read `db.execute(sql, params).fetchone()` with `?` placeholders.

    Values are always passed as parameters, never formatted into the SQL text.
    """

    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def execute(self, sql: str, params: Sequence[Any] = ()) -> psycopg.Cursor:
        return self._conn.execute(sql.replace("?", "%s"), tuple(params) or None)

    def executemany(self, sql: str, rows: Sequence[Sequence[Any]]) -> None:
        if rows:
            self._conn.cursor().executemany(sql.replace("?", "%s"), [tuple(r) for r in rows])

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()

    @property
    def broken(self) -> bool:
        """True once the connection can no longer be used (closed here, or lost)."""
        return self._conn.closed or self._conn.broken


def connect() -> Database:
    # Postgres runs READ COMMITTED by default: once a checkout holds the row locks on its
    # variants, its next read sees orders other customers have just committed.
    # prepare_threshold=None: Supabase's transaction pooler does not keep prepared statements.
    return Database(psycopg.connect(database_url(), row_factory=_row_factory, prepare_threshold=None, connect_timeout=10))


def _lock_out_data_api(db: Database) -> None:
    """Supabase serves every table in `public` over its REST API to anyone holding the project's
    public key, unless row level security is on. This backend connects as the table owner,
    which RLS does not restrict, so switching it on (with no policies) closes that door only."""
    rows = db.execute(
        "SELECT relname FROM pg_class WHERE relnamespace = current_schema()::regnamespace AND relkind = 'r' AND NOT relrowsecurity AND relname = ANY(?)",
        (list(TABLES),),
    ).fetchall()
    for row in rows:
        db.execute(f"ALTER TABLE {row[0]} ENABLE ROW LEVEL SECURITY")


def init_db(retries: int = 30) -> None:
    """Create tables and seed the catalog. Waits for a local Postgres that may still be starting."""
    for attempt in range(retries):
        try:
            db = connect()
            break
        except psycopg.OperationalError:
            if attempt == retries - 1:
                raise
            time.sleep(2)
    try:
        # One round trip for the whole schema: the database can be far away (see `get_db`).
        db.execute(";\n".join(SCHEMA))
        _lock_out_data_api(db)
        from .catalog import seed_catalog  # late import: catalog depends on this module

        seed_catalog(db)
        db.commit()
    finally:
        db.close()


# Opening a connection costs a TCP + TLS + login exchange with a database that may be on another
# continent (about a second to Supabase from Indonesia), so finished requests hand theirs back
# and the next request reuses it. Quiet connections are not trusted for long: poolers and
# serverless hosts drop them without telling the client.
POOL_SIZE = 5
IDLE_SECONDS = 45
_idle: list[tuple[str, float, Database]] = []
_pool_lock = threading.Lock()


def _borrow() -> Database:
    url, now = database_url(), time.monotonic()
    with _pool_lock:
        while _idle:
            made_for, since, db = _idle.pop()
            if made_for == url and now - since < IDLE_SECONDS and not db.broken:
                return db
            _close_quietly(db)
    return connect()


def _hand_back(db: Database) -> None:
    with _pool_lock:
        if not db.broken and len(_idle) < POOL_SIZE:
            _idle.append((database_url(), time.monotonic(), db))
            return
    _close_quietly(db)


def _close_quietly(db: Database) -> None:
    try:
        db.close()
    except Exception:  # noqa: BLE001 - already unusable; nothing more to do with it
        pass


def close_pool() -> None:
    """Close every idle connection (application shutdown)."""
    with _pool_lock:
        while _idle:
            _close_quietly(_idle.pop()[2])


def get_db() -> Iterator[Database]:
    """FastAPI dependency: commit on success, roll back on error."""
    db = _borrow()
    try:
        yield db
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:  # noqa: BLE001 - the connection is gone; the original error is the one to report
            _close_quietly(db)
        raise
    finally:
        _hand_back(db)
