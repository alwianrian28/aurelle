"""The shipment map: where a parcel is drawn between the store and the customer's area.

Couriers report scans, not coordinates, so the position is an ESTIMATE: the stage Biteship
reports decides which part of the route the parcel is on, and time moves it within that part
(`estimate`, pure functions, no I/O).

The two ends of the route are areas, never street addresses: the store, and the middle of the
customer's district (or city, when the postal code does not name one district). Areas are
geocoded once (`geo_areas`) and the road between two of them is fetched once
(`shipment_routes`); neither table refers to an order or a customer.

Nothing here may fail a tracking request: when the geocoder or the router cannot be had, the
map comes back with less on it (`build` never raises).
"""
import json
import logging
import time
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

import requests

from .config import biteship_origin, geo_retry_days, map_origin_point, map_user_agent, nominatim_url, osrm_url, tracking_stages
from .db import Database

log = logging.getLogger("aurelle.tracking_map")

EARTH_RADIUS_KM = 6371.0088
# The geocoder and the router are extras: a slow answer is given up on, the map does without.
HTTP_TIMEOUT = 4
# OpenStreetMap's Nominatim allows one request a second for the whole application.
NOMINATIM_INTERVAL = 1.1
# A request waits this long at most for its turn at the geocoder; past that it goes without.
NOMINATIM_MAX_WAIT = 3.0
# Key of the transaction-level advisory lock that guards the geocoder's queue.
NOMINATIM_LOCK = 7_203_114_501
NEXT_SLOT = "nominatim_next_slot"

# ------------------------------------------------------------------ position

BEFORE_PICKUP = {"confirmed", "scheduled", "allocated", "picking_up"}
FORWARD = BEFORE_PICKUP | {"picked", "in_transit", "dropping_off"}
NO_VEHICLE = {"cancelled", "courier_not_found"}
# The parcel will not arrive: it stays where it was last known to be.
LOST = {"disposed", "lost", "damaged", "destroyed"}
STAGE = {"picked": 2, "in_transit": 3, "dropping_off": 4}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def haversine_km(a: Sequence[float], b: Sequence[float]) -> float:
    lat1, lng1, lat2, lng2 = map(radians, (a[0], a[1], b[0], b[1]))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lng2 - lng1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(h))


def point_along_route(coords: Sequence[Sequence[float]], progress: float) -> tuple[float, float, int]:
    """The point `progress` (0-1) of the way along the route, by distance.

    Returns (lat, lng, index): the point lies between coords[index] and coords[index + 1]."""
    if not coords:
        raise ValueError("empty route")
    lengths = [haversine_km(coords[i], coords[i + 1]) for i in range(len(coords) - 1)]
    total = sum(lengths)
    if total == 0:
        return float(coords[0][0]), float(coords[0][1]), 0
    target, travelled = clamp(progress) * total, 0.0
    for index, length in enumerate(lengths):
        if travelled + length >= target or index == len(lengths) - 1:
            t = 0.0 if length == 0 else clamp((target - travelled) / length)
            a, b = coords[index], coords[index + 1]
            return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, index
        travelled += length
    raise AssertionError("unreachable")  # pragma: no cover


def split_route(coords: Sequence[Sequence[float]], progress: float) -> tuple[list[list[float]], list[list[float]], list[float]]:
    """The route cut where the parcel is: (behind it, ahead of it, the point itself)."""
    lat, lng, index = point_along_route(coords, progress)
    point = [round(lat, 5), round(lng, 5)]
    passed = [[float(c[0]), float(c[1])] for c in coords[: index + 1]] + [point]
    remaining = [point] + [[float(c[0]), float(c[1])] for c in coords[index + 1:]]
    return passed, remaining, point


def parse_time(value: object) -> datetime | None:
    """A timestamp as Biteship writes it. One without an offset is taken as UTC."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value or "").strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def eta_days(value: object, default: int = 3) -> int:
    """The longer end of a delivery estimate such as "2-3"."""
    numbers = [int(n) for n in "".join(c if c.isdigit() else " " for c in str(value or "")).split()]
    return max(1, min(max(numbers), 60)) if numbers else default


def _share(start: datetime | None, now: datetime, duration: timedelta) -> float:
    """How much of `duration` has passed since `start`; 0 when the start is not known."""
    if start is None or duration.total_seconds() <= 0:
        return 0.0
    return clamp((now - start).total_seconds() / duration.total_seconds())


def estimate(status: str | None, history: Sequence[dict], now: datetime, days: int, stages: dict | None = None) -> dict:
    """Where on the route (0 = the store, 1 = the customer) a shipment is drawn.

    `history` is the courier's scans, oldest first: {"status", "at"}. Returns progress, the
    stage (1-5), a tone for the colours, whether a vehicle is drawn at all, whether it is on
    its way back, and when the parcel was estimated to arrive."""
    stages = stages or tracking_stages()
    status = status or ""
    events = [(str(h.get("status") or ""), parse_time(h.get("at"))) for h in history if h.get("status")]
    if status and (not events or events[-1][0] != status):
        events.append((status, None))
    # When each stage began: a parcel held and released does not start its stage again.
    first: dict[str, datetime | None] = {}
    for name, at in events:
        if first.get(name) is None:
            first[name] = at
    collected = next((first[name] for name in ("picked", "in_transit", "dropping_off") if first.get(name)), None)
    eta = collected + timedelta(days=days) if collected else None

    def moving(name: str, at: datetime) -> float:
        if name in BEFORE_PICKUP:
            return 0.0
        low, high = stages[name]
        if name == "in_transit":
            start = first.get(name) or collected
            share = _share(start, at, (eta - start) if eta and start else timedelta(0))
        else:
            share = _share(first.get(name), at, timedelta(hours=stages[f"{name}_hours"]))
        return low + (high - low) * share

    def before(index: int) -> float:
        """Where the parcel was when the event at `index` happened."""
        at = events[index][1] if 0 <= index < len(events) else None
        for name, _ in reversed(events[:max(index, 0)]):
            if name == "rejected":
                return 1.0
            if name in FORWARD:
                return moving(name, at or now)
        return 0.0

    last = len(events) - 1
    result = {"stage": 1, "tone": "normal", "vehicle": True, "returning": False, "progress": 0.0}
    if status in BEFORE_PICKUP:
        pass
    elif status in STAGE:
        result.update(stage=STAGE[status], progress=moving(status, now))
    elif status == "on_hold":
        held_in = next((name for name, _ in reversed(events[:last]) if name in STAGE), "in_transit")
        result.update(stage=STAGE[held_in], tone="orange", progress=before(last))
    elif status == "delivered":
        result.update(stage=5, tone="green", progress=1.0)
    elif status in NO_VEHICLE:
        result.update(stage=2, tone="gray", vehicle=False)
    elif status == "rejected":
        result.update(stage=5, tone="red", progress=1.0)
    elif status == "return_in_transit":
        turned, since = before(last), events[last][1] or first.get(status)
        # The way back takes as long as that part of the way out was estimated to take.
        result.update(stage=5, tone="purple", returning=True, progress=turned * (1 - _share(since, now, timedelta(days=max(days * turned, 0.5)))))
    elif status == "returned":
        result.update(stage=5, tone="purple", returning=True)
    elif status in LOST:
        result.update(stage=5, tone="red", progress=before(last))
    else:
        log.warning("unknown shipment status %r: the parcel is left where it was", status)
        result.update(stage=3, progress=before(last))
    result["progress"] = round(clamp(result["progress"]), 4)
    result["etaAt"] = eta.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z") if eta else None
    return result


# --------------------------------------------------------------------- areas


@lru_cache(maxsize=1)
def _postal_areas() -> dict[str, list[list[str]]]:
    """Postal code -> every [province, city, district] it is listed under
    (scripts/build_postal_areas.py)."""
    try:
        return json.loads(Path(__file__).with_name("data").joinpath("id_postal_areas.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        log.warning("postal areas could not be read: areas are located by city only")
        return {}


def _same(a: str, b: str) -> bool:
    return " ".join(a.lower().split()) == " ".join(b.lower().split())


def district_of(city: str, postal_code: str) -> str | None:
    """The one district a postal code belongs to within a city. None when the code is unknown,
    is shared by several districts, or the list names several for it: no guessing."""
    listed = [entry for entry in _postal_areas().get("".join(c for c in postal_code if c.isdigit()), []) if _same(entry[1], city)]
    if len(listed) != 1 or "," in listed[0][2] or not listed[0][2].strip():
        return None
    return listed[0][2].strip()


def area_of_postal(postal_code: str) -> tuple[str, str] | None:
    """(province, city) of a postal code, when it lies in exactly one city."""
    cities = {(entry[0], entry[1]) for entry in _postal_areas().get("".join(c for c in postal_code if c.isdigit()), [])}
    return next(iter(cities)) if len(cities) == 1 else None


def area_key(province: str, city: str, district: str | None) -> str:
    """What an area is cached under. The postal code is not part of it: every code of a
    district is the same point, so the district is looked up once."""
    return "|".join(" ".join(part.lower().split()) for part in ("id", province, city, district or ""))[:300]


def _fetch(url: str, params: dict) -> tuple[int, object]:
    """One GET to the geocoder or the router: (HTTP status, JSON body). Raises when there is
    no answer in time or the answer is not JSON."""
    res = requests.get(url, params=params, timeout=HTTP_TIMEOUT, headers={"User-Agent": map_user_agent(), "Accept": "application/json", "Accept-Language": "id,en"})
    return res.status_code, res.json()


def _nominatim_turn(db: Database) -> bool:
    """Take the next free second at the geocoder and wait for it. False when the queue is too
    long to wait in.

    The queue is one row in `settings`, changed under a transaction-level advisory lock, so it
    holds across every instance of the backend. The transaction ends before the wait and before
    the request goes out: no lock and no transaction is held while the geocoder answers."""
    db.execute("SELECT pg_advisory_xact_lock(?)", (NOMINATIM_LOCK,))
    now = float(db.execute("SELECT EXTRACT(EPOCH FROM clock_timestamp()) AS now").fetchone()["now"])
    row = db.execute("SELECT value FROM settings WHERE name = ?", (NEXT_SLOT,)).fetchone()
    try:
        slot = max(now, float(row["value"])) if row else now
    except ValueError:
        slot = now
    if slot - now > NOMINATIM_MAX_WAIT:
        db.commit()
        return False
    db.execute("INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value", (NEXT_SLOT, repr(slot + NOMINATIM_INTERVAL)))
    db.commit()
    if slot > now:
        time.sleep(slot - now)
    return True


def _geocode(db: Database, query: str) -> tuple[float, float] | None | bool:
    """A point for a place name. None: the geocoder knows no such place. False: it could not
    be asked (switched off, busy, down), which says nothing about the place."""
    base = nominatim_url()
    if not base or not _nominatim_turn(db):
        return False
    try:
        status, found = _fetch(f"{base}/search", {"q": query, "format": "jsonv2", "limit": 1, "countrycodes": "id"})
        if status != 200 or not isinstance(found, list):
            return False
        return (round(float(found[0]["lat"]), 5), round(float(found[0]["lon"]), 5)) if found else None
    except Exception as error:  # noqa: BLE001 - the map does without
        log.warning("geocoder not available: %s", error.__class__.__name__)
        return False


def locate(db: Database, province: str, city: str, postal_code: str) -> dict | None:
    """The middle of the district a postal code is in, or of its city: {key, lat, lng,
    precision}. Looked up once per area; an area the geocoder does not know is asked about
    again after GEO_RETRY_DAYS. None when there is no point to give."""
    province, city = province.strip()[:80], city.strip()[:80]
    if not province or not city:
        return None
    district = district_of(city, postal_code)
    key = area_key(province, city, district)
    row = db.execute("SELECT lat, lng, precision, checked_at FROM geo_areas WHERE area_key = ?", (key,)).fetchone()
    if row and row["lat"] is not None:
        return {"key": key, "lat": row["lat"], "lng": row["lng"], "precision": row["precision"]}
    if row and datetime.now(timezone.utc) - row["checked_at"] < timedelta(days=geo_retry_days()):
        return None
    db.commit()  # nothing is left open while the geocoder is asked
    point, precision = None, None
    for query, level in ((f"{district}, {city}, {province}, Indonesia", "district"), (f"{city}, {province}, Indonesia", "city")):
        if level == "district" and not district:
            continue
        point = _geocode(db, query)
        if point is False:
            return None  # not asked: nothing learned, nothing stored
        if point:
            precision = level
            break
    lat, lng = point or (None, None)
    db.execute(
        "INSERT INTO geo_areas (area_key, province, city, district, lat, lng, precision, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT (area_key) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, precision = EXCLUDED.precision, checked_at = EXCLUDED.checked_at",
        (key, province, city, district, lat, lng, precision, datetime.now(timezone.utc)),
    )
    db.commit()
    return {"key": key, "lat": lat, "lng": lng, "precision": precision} if point else None


def origin(db: Database) -> dict | None:
    """Where the store is: the configured point, or else the area of its postal code."""
    point = map_origin_point()
    if point:
        return {"lat": point[0], "lng": point[1]}
    store = biteship_origin()
    area = area_of_postal(store["postalCode"]) if store else None
    found = locate(db, area[0], area[1], store["postalCode"]) if area else None
    return {"lat": found["lat"], "lng": found["lng"]} if found else None


# -------------------------------------------------------------------- routes


def _by_road(start: Sequence[float], end: Sequence[float]) -> tuple[str, list[list[float]] | None, float] | None:
    """(kind, points, km) from the router. "straight" when no road joins the two points or the
    way crosses water by ferry: such a parcel does not follow the road drawn. None when the
    router could not be asked."""
    base = osrm_url()
    if not base:
        return None
    straight = ("straight", None, round(haversine_km(start, end), 1))
    try:
        status, data = _fetch(f"{base}/route/v1/driving/{start[1]},{start[0]};{end[1]},{end[0]}", {"overview": "simplified", "geometries": "geojson", "steps": "true"})
        if not isinstance(data, dict):
            return None
        if data.get("code") == "NoRoute":
            return straight
        if status != 200 or data.get("code") != "Ok":
            return None
        route = data["routes"][0]
        if any(step.get("mode") == "ferry" for leg in route.get("legs", []) for step in leg.get("steps", [])):
            return straight
        points = [[round(float(lat), 5), round(float(lng), 5)] for lng, lat in route["geometry"]["coordinates"]]
        return ("road", points, round(float(route["distance"]) / 1000, 1)) if len(points) > 1 else None
    except Exception as error:  # noqa: BLE001 - the map does without
        log.warning("router not available: %s", error.__class__.__name__)
        return None


def route(db: Database, start: dict, area: dict) -> dict | None:
    """The way from the store to an area: {kind, coords, distanceKm}. Fetched once per pair."""
    origin_key = f"{start['lat']:.5f},{start['lng']:.5f}"
    ends = [[start["lat"], start["lng"]], [area["lat"], area["lng"]]]
    row = db.execute("SELECT kind, coords, distance_km FROM shipment_routes WHERE origin_key = ? AND area_key = ?", (origin_key, area["key"])).fetchone()
    if row:
        return {"kind": row["kind"], "coords": row["coords"] or ends, "distanceKm": row["distance_km"]}
    db.commit()  # nothing is left open while the router is asked
    found = _by_road(*ends)
    if not found:
        return None
    kind, coords, km = found
    db.execute(
        "INSERT INTO shipment_routes (origin_key, area_key, kind, coords, distance_km, fetched_at) VALUES (?, ?, ?, CAST(? AS JSONB), ?, ?) ON CONFLICT (origin_key, area_key) DO NOTHING",
        (origin_key, area["key"], kind, json.dumps(coords) if coords else None, km, datetime.now(timezone.utc)),
    )
    db.commit()
    return {"kind": kind, "coords": coords or ends, "distanceKm": km}


# ----------------------------------------------------------------------- map


def build(db: Database, order: dict, tracking: dict, now: datetime | None = None) -> dict | None:
    """What the shipment map shows for an order, or None when there is no shipment to draw.

    Whatever was changed on `db` before is committed first, and nothing that goes wrong here
    reaches the caller: the answer then simply carries less (no route, or no points at all)."""
    status = tracking.get("status")
    address = order.get("addressSnapshot") or {}
    if not status or str(address.get("country", "")).strip().lower() != "indonesia":
        return None
    position = estimate(status, tracking.get("history") or [], now or datetime.now(timezone.utc), eta_days((order.get("shippingService") or {}).get("etaDays")))
    shown = {
        "estimated": True, "status": status, "stage": position["stage"], "tone": position["tone"], "progress": position["progress"],
        "returning": position["returning"], "etaAt": position["etaAt"], "origin": None, "destination": None, "route": None, "vehicle": None,
    }
    try:
        db.commit()
        start = origin(db)
        area = locate(db, str(address.get("state", "")), str(address.get("city", "")), str(address.get("postalCode", "")))
        shown["origin"] = {"lat": start["lat"], "lng": start["lng"]} if start else None
        shown["destination"] = {"lat": area["lat"], "lng": area["lng"], "precision": area["precision"], "city": address.get("city")} if area else None
        way = route(db, start, area) if start and area else None
        if way:
            passed, remaining, point = split_route(way["coords"], position["progress"])
            shown["route"] = {"kind": way["kind"], "distanceKm": way["distanceKm"], "passed": passed, "remaining": remaining}
            shown["vehicle"] = {"lat": point[0], "lng": point[1]} if position["vehicle"] else None
    except Exception as error:  # noqa: BLE001 - tracking is answered with or without a map
        log.warning("shipment map left incomplete: %r", error)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001 - the connection is gone; the request will find out
            pass
    return shown
