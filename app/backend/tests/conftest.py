"""Tests run against the MySQL container from docker-compose (localhost:3311), in a
separate `aurelle_test` database that is dropped and recreated for every test."""
import os
from pathlib import Path

import pymysql
import pytest

# Passwords live in the repository's .env (never committed).
for line in (Path(__file__).parents[3] / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())

TEST_DB = "aurelle_test"


@pytest.fixture(autouse=True)
def test_database(monkeypatch):
    monkeypatch.setenv("DB_HOST", "127.0.0.1")
    monkeypatch.setenv("DB_PORT", "3311")
    monkeypatch.setenv("DB_USER", "root")
    monkeypatch.setenv("DB_PASSWORD", os.environ["MYSQL_ROOT_PASSWORD"])
    monkeypatch.setenv("DB_NAME", TEST_DB)
    monkeypatch.setenv("APP_ENV", "development")
    # Cheapest bcrypt cost so the suite stays fast; production uses 12 (asserted in test_api).
    monkeypatch.setattr("app.security.BCRYPT_ROUNDS", 4)
    admin = pymysql.connect(host="127.0.0.1", port=3311, user="root", password=os.environ["MYSQL_ROOT_PASSWORD"], autocommit=True)
    with admin.cursor() as cursor:
        cursor.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
        cursor.execute(f"CREATE DATABASE {TEST_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    yield
    with admin.cursor() as cursor:
        cursor.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
    admin.close()
