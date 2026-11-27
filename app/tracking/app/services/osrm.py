"""Rute jalan dari OSRM public API. Dipanggil sekali per pengiriman; hasilnya di-cache di
kolom `shipments.route_geometry` dan `jarak_km`, tidak dipanggil di setiap request."""
import logging
from dataclasses import dataclass

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

log = logging.getLogger(__name__)


class OsrmError(Exception):
    pass


@dataclass(frozen=True)
class Route:
    coords: list[list[float]]  # [lat, lng]
    distance_km: float


class OsrmClient:
    def __init__(self, http: httpx.AsyncClient, base_url: str = "https://router.project-osrm.org", retry_wait: float = 0.3) -> None:
        self._http = http
        self._base_url = base_url.rstrip("/")
        self._retry_wait = retry_wait

    async def route(self, muat: tuple[float, float], bongkar: tuple[float, float]) -> Route:
        """Rute mengemudi dari titik muat ke titik bongkar; keduanya (lat, lng)."""
        # OSRM memakai urutan lng,lat.
        url = f"{self._base_url}/route/v1/driving/{muat[1]},{muat[0]};{bongkar[1]},{bongkar[0]}"
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(2),
                wait=wait_exponential(multiplier=self._retry_wait, max=2),
                retry=retry_if_exception_type(httpx.TransportError),
                reraise=True,
            ):
                with attempt:
                    response = await self._http.get(url, params={"overview": "full", "geometries": "geojson"})
            data = response.json() if response.status_code == 200 else {}
        except (httpx.TransportError, ValueError) as error:
            log.warning("osrm_unreachable", extra={"reason": error.__class__.__name__})
            raise OsrmError("OSRM tidak dapat dihubungi") from error
        routes = data.get("routes") if isinstance(data, dict) else None
        if not routes or data.get("code") != "Ok":
            log.warning("osrm_no_route", extra={"status": response.status_code})
            raise OsrmError("OSRM tidak menemukan rute")
        try:
            # GeoJSON [lng, lat] -> [lat, lng]; 5 desimal (±1 m) cukup dan menghemat ukuran.
            coords = [[round(float(lat), 5), round(float(lng), 5)] for lng, lat in routes[0]["geometry"]["coordinates"]]
            distance_km = float(routes[0]["distance"]) / 1000
        except (KeyError, TypeError, ValueError) as error:
            raise OsrmError("Jawaban OSRM tidak dikenali") from error
        if len(coords) < 2:
            raise OsrmError("OSRM tidak menemukan rute")
        return Route(coords=coords, distance_km=distance_km)
