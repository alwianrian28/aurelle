"""MySQL access. One connection per request; money is stored as integer rupiah."""
import time
from collections.abc import Iterator, Sequence
from typing import Any

import pymysql
from pymysql.cursors import Cursor, DictCursor

from .config import db_settings

IntegrityError = pymysql.err.IntegrityError

# Each statement is executed separately on startup. utf8mb4 everywhere; ids and hashes are
# VARCHAR because MySQL cannot index unbounded TEXT.
SCHEMA = [
    """CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(40) PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE,
      username VARCHAR(80) NOT NULL,
      password_hash VARCHAR(200) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'customer',
      email_verified TINYINT NOT NULL DEFAULT 0,
      phone_country_code VARCHAR(5),
      phone VARCHAR(20),
      preferred_locale VARCHAR(5) NOT NULL DEFAULT 'id',
      preferred_currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
      newsletter TINYINT NOT NULL DEFAULT 0,
      created_at VARCHAR(32) NOT NULL,
      CONSTRAINT users_role CHECK (role IN ('customer', 'admin'))
    )""",
    """CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id VARCHAR(40) NOT NULL,
      expires_at DOUBLE NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )""",
    # Single-use email links (verify / reset). Only the hash is stored.
    """CREATE TABLE IF NOT EXISTS tokens (
      token_hash CHAR(64) PRIMARY KEY,
      kind VARCHAR(10) NOT NULL,
      user_id VARCHAR(40) NOT NULL,
      expires_at DOUBLE NOT NULL,
      used_at DOUBLE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT tokens_kind CHECK (kind IN ('verify', 'reset'))
    )""",
    # Catalog (seeded from app/seed/catalog.json on first start; edited from the dashboard).
    """CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(80) PRIMARY KEY,
      slug VARCHAR(120) NOT NULL UNIQUE,
      category VARCHAR(20) NOT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      sort INT NOT NULL,
      data MEDIUMTEXT NOT NULL
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
      data MEDIUMTEXT NOT NULL,
      courier VARCHAR(60),
      tracking_number VARCHAR(60),
      created_at VARCHAR(32) NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX orders_created (created_at),
      INDEX orders_status (status)
    )""",
    # Lines of each order, used for stock arithmetic (the full snapshot lives in orders.data).
    """CREATE TABLE IF NOT EXISTS order_items (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(80) NOT NULL,
      variant_id VARCHAR(80) NOT NULL,
      qty INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      INDEX order_items_variant (variant_id),
      CONSTRAINT order_items_qty CHECK (qty > 0)
    )""",
    # Status trail with who changed it (audit, AC-18).
    """CREATE TABLE IF NOT EXISTS order_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(80) NOT NULL,
      status VARCHAR(30) NOT NULL,
      payment_status VARCHAR(30) NOT NULL,
      actor VARCHAR(60) NOT NULL,
      at VARCHAR(32) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )""",
    # Shipment checkpoints shown on the tracking map.
    """CREATE TABLE IF NOT EXISTS tracking_points (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(80) NOT NULL,
      label VARCHAR(120) NOT NULL,
      note VARCHAR(300) NOT NULL DEFAULT '',
      lat DOUBLE NOT NULL,
      lng DOUBLE NOT NULL,
      actor VARCHAR(60) NOT NULL,
      at VARCHAR(32) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )""",
    # Who changed which catalog value, and from what to what (audit, AC-18).
    """CREATE TABLE IF NOT EXISTS catalog_audit (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      actor VARCHAR(60) NOT NULL,
      entity VARCHAR(20) NOT NULL,
      entity_id VARCHAR(80) NOT NULL,
      field VARCHAR(40) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      at VARCHAR(32) NOT NULL
    )""",
]


class Row(dict):
    """A result row addressable by column name or by position."""

    def __getitem__(self, key: Any) -> Any:
        return list(self.values())[key] if isinstance(key, int) else super().__getitem__(key)


class _RowCursor(DictCursor):
    dict_type = Row


class Database:
    """Thin wrapper so queries read `db.execute(sql, params).fetchone()` with `?` placeholders.

    Values are always passed as parameters, never formatted into the SQL text.
    """

    def __init__(self, conn: pymysql.connections.Connection) -> None:
        self._conn = conn

    def execute(self, sql: str, params: Sequence[Any] = ()) -> Cursor:
        cursor = self._conn.cursor()
        cursor.execute(sql.replace("?", "%s"), tuple(params))
        return cursor

    def executemany(self, sql: str, rows: Sequence[Sequence[Any]]) -> None:
        if rows:
            self._conn.cursor().executemany(sql.replace("?", "%s"), [tuple(r) for r in rows])

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


def connect() -> Database:
    conn = pymysql.connect(**db_settings(), charset="utf8mb4", cursorclass=_RowCursor, autocommit=False)
    # READ COMMITTED: once a checkout holds the row locks on its variants, its next read
    # must see orders other customers have just committed (REPEATABLE READ would not).
    with conn.cursor() as cursor:
        cursor.execute("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED")
    return Database(conn)


def init_db(retries: int = 30) -> None:
    """Create tables and seed the catalog. Waits for MySQL, which may still be starting."""
    for attempt in range(retries):
        try:
            db = connect()
            break
        except pymysql.err.OperationalError:
            if attempt == retries - 1:
                raise
            time.sleep(2)
    try:
        for statement in SCHEMA:
            db.execute(statement)
        from .catalog import seed_catalog  # late import: catalog depends on this module

        seed_catalog(db)
        db.commit()
    finally:
        db.close()


def get_db() -> Iterator[Database]:
    """FastAPI dependency: commit on success, roll back on error."""
    db = connect()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
