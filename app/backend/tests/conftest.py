"""Tests run against the Postgres container from docker-compose (localhost:5433), in a
separate `aurelle_test` database that is dropped and recreated for every test. They never
use the DATABASE_URL from .env (Supabase)."""
import os
from pathlib import Path
from urllib.parse import quote

import psycopg
import pytest

# Passwords live in the repository's .env (never committed).
for line in (Path(__file__).parents[3] / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())

TEST_DB = "aurelle_test"
LOCAL = f"postgresql://aurelle:{quote(os.environ['POSTGRES_PASSWORD'], safe='')}@127.0.0.1:5433"


@pytest.fixture(autouse=True)
def test_database(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"{LOCAL}/{TEST_DB}")
    monkeypatch.setenv("APP_ENV", "development")
    # Cheapest bcrypt cost so the suite stays fast; production uses 12 (asserted in test_api).
    monkeypatch.setattr("app.security.BCRYPT_ROUNDS", 4)
    admin = psycopg.connect(f"{LOCAL}/postgres", autocommit=True)
    admin.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
    admin.execute(f"CREATE DATABASE {TEST_DB}")
    yield
    admin.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
    admin.close()
