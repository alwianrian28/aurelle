"""Klien async Biteship. Hanya dipanggil dari server; API key tidak pernah sampai ke browser.

Endpoint yang dipakai:
- POST /v1/orders            membuat order (simulasi bila key `biteship_test.`)
- GET  /v1/orders/{id}       status, kurir, origin/destination, waybill, tracking id
- GET  /v1/trackings/{id}    riwayat (history) pengiriman; gratis di sandbox

Public tracking `/v1/trackings/{waybill}/couriers/{courier}` sengaja TIDAK dipakai (berbayar).
"""
import logging
from typing import Any

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.schemas.biteship import OrderResponse, TrackingResponseBiteship

log = logging.getLogger(__name__)


class BiteshipError(Exception):
    """Biteship menjawab, tetapi menolak (4xx, atau `success: false`)."""

    def __init__(self, status: int, message: str, code: object = None) -> None:
        super().__init__(f"Biteship {status}: {message}")
        self.status, self.message, self.code = status, message, code


class BiteshipUnavailable(BiteshipError):
    """Biteship tidak bisa dihubungi: timeout, koneksi gagal, atau 5xx setelah dicoba ulang."""

    def __init__(self, message: str = "Biteship tidak dapat dihubungi") -> None:
        super().__init__(503, message)


class BiteshipNotConfigured(BiteshipError):
    def __init__(self) -> None:
        super().__init__(503, "BITESHIP_API_KEY belum diisi")


class _ServerError(Exception):
    """5xx: layak dicoba ulang."""


class BiteshipClient:
    def __init__(self, http: httpx.AsyncClient, api_key: str, base_url: str = "https://api.biteship.com", retry_wait: float = 0.3) -> None:
        self._http = http
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._retry_wait = retry_wait

    @property
    def is_sandbox(self) -> bool:
        return self._api_key.startswith("biteship_test.")

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    async def _request(self, method: str, path: str, json: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self._api_key:
            raise BiteshipNotConfigured()
        # GET aman diulang. POST hanya diulang bila koneksi belum sempat terbentuk, supaya
        # order tidak terbuat dua kali karena jawaban yang terlambat.
        retryable: tuple[type[Exception], ...] = (httpx.TransportError, _ServerError) if method == "GET" else (httpx.ConnectError, httpx.ConnectTimeout)
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(3),
                wait=wait_exponential(multiplier=self._retry_wait, max=2),
                retry=retry_if_exception_type(retryable),
                reraise=True,
            ):
                with attempt:
                    response = await self._http.request(
                        method,
                        f"{self._base_url}{path}",
                        json=json,
                        headers={"Authorization": self._api_key, "Content-Type": "application/json"},
                    )
                    if response.status_code >= 500:
                        raise _ServerError(response.status_code)
        except (httpx.TransportError, _ServerError) as error:
            log.warning("biteship_unreachable", extra={"method": method, "path": path, "reason": error.__class__.__name__})
            raise BiteshipUnavailable() from error
        try:
            data = response.json()
        except ValueError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        if response.status_code >= 400 or data.get("success") is False:
            message = str(data.get("error") or data.get("message") or "permintaan ditolak")[:300]
            log.warning("biteship_refused", extra={"method": method, "path": path, "status": response.status_code, "code": data.get("code")})
            raise BiteshipError(response.status_code, message, data.get("code"))
        return data

    async def create_order(self, payload: dict[str, Any]) -> OrderResponse:
        return OrderResponse.model_validate(await self._request("POST", "/v1/orders", json=payload))

    async def get_order(self, order_id: str) -> OrderResponse:
        return OrderResponse.model_validate(await self._request("GET", f"/v1/orders/{order_id}"))

    async def get_tracking(self, tracking_id: str) -> TrackingResponseBiteship:
        return TrackingResponseBiteship.model_validate(await self._request("GET", f"/v1/trackings/{tracking_id}"))
