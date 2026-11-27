"""Foto bukti (POD) di Supabase Storage, bucket privat.

Satu-satunya tempat supabase-py dipakai. Klien dibuat dengan service_role key, yang melewati
RLS: key ini hanya ada di server. Browser hanya menerima signed URL yang kedaluwarsa sendiri.
"""
import logging
from typing import Any

log = logging.getLogger(__name__)


class StorageError(Exception):
    pass


class StorageService:
    def __init__(self, url: str, service_role_key: str, bucket: str, signed_url_ttl: int = 3600) -> None:
        self._url, self._key, self._bucket, self._ttl = url, service_role_key, bucket, signed_url_ttl
        self._client: Any = None

    @property
    def enabled(self) -> bool:
        return bool(self._url and self._key)

    async def _bucket_api(self) -> Any:
        if not self.enabled:
            raise StorageError("Supabase Storage belum dikonfigurasi")
        if self._client is None:
            from supabase import acreate_client  # impor ditunda: tidak diperlukan bila storage mati

            self._client = await acreate_client(self._url, self._key)
        return self._client.storage

    async def ensure_bucket(self) -> bool:
        """Buat bucket privat bila belum ada. True bila baru dibuat."""
        storage = await self._bucket_api()
        existing = {getattr(b, "name", None) or getattr(b, "id", None) for b in await storage.list_buckets()}
        if self._bucket in existing:
            return False
        await storage.create_bucket(self._bucket, options={"public": False})
        return True

    async def upload(self, path: str, data: bytes, content_type: str) -> str:
        """Simpan objek dan kembalikan path-nya (yang disimpan di DB adalah path, bukan URL)."""
        storage = await self._bucket_api()
        try:
            await storage.from_(self._bucket).upload(path, data, {"content-type": content_type, "upsert": "false"})
        except Exception as error:  # noqa: BLE001 - supabase-py melempar beberapa jenis error
            log.warning("storage_upload_failed", extra={"reason": error.__class__.__name__})
            raise StorageError("Gagal mengunggah foto") from error
        return path

    async def signed_urls(self, paths: list[str]) -> dict[str, str]:
        """path -> signed URL (berlaku ±1 jam). Gagal membuat URL tidak menggagalkan halaman:
        foto yang bersangkutan tampil sebagai placeholder."""
        paths = [p for p in dict.fromkeys(paths) if p]
        if not paths or not self.enabled:
            return {}
        try:
            storage = await self._bucket_api()
            items = await storage.from_(self._bucket).create_signed_urls(paths, self._ttl)
        except Exception as error:  # noqa: BLE001
            log.warning("storage_sign_failed", extra={"reason": error.__class__.__name__})
            return {}
        urls: dict[str, str] = {}
        for requested, item in zip(paths, items or []):
            if not isinstance(item, dict) or item.get("error"):
                continue
            url = item.get("signedURL") or item.get("signedUrl")
            if url:
                urls[item.get("path") or requested] = url
        return urls
