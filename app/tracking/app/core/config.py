"""Konfigurasi aplikasi, dibaca dari environment / file .env di folder proyek.

Semua rahasia bertipe SecretStr supaya tidak ikut tercetak saat objek Settings di-log.
"""
from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    BITESHIP_API_KEY: SecretStr = SecretStr("")
    BITESHIP_BASE_URL: str = "https://api.biteship.com"
    # Biteship mengirim "signature key" sebagai nama header dan "signature secret" sebagai nilainya.
    BITESHIP_WEBHOOK_HEADER: str = "X-Webhook-Secret"
    BITESHIP_WEBHOOK_SECRET: SecretStr = SecretStr("")

    DATABASE_URL: SecretStr = SecretStr("")
    DATABASE_URL_MIGRATION: SecretStr = SecretStr("")
    # Nilai `ssl` untuk asyncpg: "require" (Supabase) atau "disable" (PostgreSQL lokal untuk test).
    DATABASE_SSL: str = "require"

    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: SecretStr = SecretStr("")
    SUPABASE_STORAGE_BUCKET: str = "shipment-photos"
    SIGNED_URL_TTL_SECONDS: int = 3600

    ADMIN_API_TOKEN: SecretStr = SecretStr("")

    APP_BASE_URL: str = "http://localhost:8000"
    TIMEZONE: str = "Asia/Jakarta"

    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    HTTP_TIMEOUT_SECONDS: float = 10.0
    # Data dianggap basi dan disinkronkan ulang dari Biteship setelah sekian menit.
    SYNC_INTERVAL_MINUTES: int = 10
    # Jeda minimal antar sinkron paksa (?force=true), supaya tombol refresh tidak bisa
    # dipakai membanjiri Biteship.
    FORCE_SYNC_COOLDOWN_SECONDS: int = 30

    @property
    def is_sandbox(self) -> bool:
        return self.BITESHIP_API_KEY.get_secret_value().startswith("biteship_test.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
