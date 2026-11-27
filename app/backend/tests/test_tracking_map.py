"""The shipment map: position by stage (pure), areas and routes (cached), and what the two
tracking endpoints give out."""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import tracking_map
from app.tracking_map import area_key, area_of_postal, district_of, estimate, eta_days, point_along_route, split_route

from test_api import api, biteship, live_order, register  # noqa: F401 - `api` is a fixture

STAGES = {"picked": (0.0, 0.05), "in_transit": (0.05, 0.85), "dropping_off": (0.85, 0.98), "picked_hours": 6, "dropping_off_hours": 8}
T0 = datetime(2026, 11, 20, 3, 0, tzinfo=timezone.utc)


def at(hours: float) -> str:
    return (T0 + timedelta(hours=hours)).isoformat()


def scans(*steps: tuple[str, float]) -> list[dict]:
    return [{"status": status, "at": at(hours)} for status, hours in steps]


def where(status, history, hours, days=2):
    return estimate(status, history, T0 + timedelta(hours=hours), days, STAGES)


# ------------------------------------------------------------------ position


@pytest.mark.parametrize("status", ["confirmed", "allocated", "picking_up"])
def test_before_pickup_the_parcel_is_at_the_store(status):
    shown = where(status, scans((status, 0)), 5)
    assert (shown["progress"], shown["stage"], shown["tone"], shown["vehicle"], shown["etaAt"]) == (0.0, 1, "normal", True, None)


def test_picked_moves_through_the_first_five_percent():
    history = scans(("allocated", -2), ("picked", 0))
    assert where("picked", history, 0)["progress"] == 0.0
    assert where("picked", history, 3)["progress"] == 0.025
    assert where("picked", history, 30)["progress"] == 0.05  # never past its range
    assert where("picked", history, 3)["stage"] == 2
    # The estimate of arrival counts from the pickup.
    assert where("picked", history, 3)["etaAt"] == "2026-11-22T03:00:00Z"


def test_in_transit_and_dropping_off_are_different_stages():
    history = scans(("picked", 0), ("in_transit", 8))
    # From the first in-transit scan (hour 8) to the estimate (hour 48): 40 hours for 5% -> 85%.
    assert where("in_transit", history, 8)["progress"] == 0.05
    assert where("in_transit", history, 28)["progress"] == 0.45
    late = where("in_transit", history, 500)
    assert (late["progress"], late["stage"]) == (0.85, 3)  # waits at 85% until the courier is out for delivery
    out = scans(("picked", 0), ("in_transit", 8), ("dropping_off", 40))
    assert where("dropping_off", out, 40)["progress"] == 0.85
    assert where("dropping_off", out, 44)["progress"] == 0.915
    done = where("dropping_off", out, 400)
    assert (done["progress"], done["stage"]) == (0.98, 4)  # not at the door until it is delivered


def test_end_states():
    history = scans(("picked", 0), ("in_transit", 8), ("dropping_off", 40))
    delivered = where("delivered", history + scans(("delivered", 45)), 46)
    assert (delivered["progress"], delivered["tone"], delivered["stage"]) == (1.0, "green", 5)
    rejected = where("rejected", history + scans(("rejected", 45)), 46)
    assert (rejected["progress"], rejected["tone"]) == (1.0, "red")
    for status in ("cancelled", "courier_not_found"):
        gone = where(status, scans(("allocated", 0), (status, 1)), 2)
        assert (gone["vehicle"], gone["tone"]) == (False, "gray")


def test_on_hold_stops_where_the_parcel_was_and_resuming_does_not_start_over():
    history = scans(("picked", 0), ("in_transit", 8), ("on_hold", 28))
    held = where("on_hold", history, 200)
    assert (held["progress"], held["tone"], held["stage"]) == (0.45, "orange", 3)
    assert where("on_hold", history, 29)["progress"] == 0.45  # it does not move while held
    # Released: transit carries on from its first scan, not from 5% again.
    resumed = where("in_transit", history + scans(("in_transit", 30)), 38)
    assert resumed["progress"] == 0.65 and resumed["tone"] == "normal"
    late = scans(("picked", 0), ("in_transit", 8), ("dropping_off", 40), ("on_hold", 44))
    assert where("on_hold", late, 90)["stage"] == 4 and where("on_hold", late, 90)["progress"] == 0.915


def test_a_return_runs_back_towards_the_store():
    history = scans(("picked", 0), ("in_transit", 8), ("return_in_transit", 28))
    turned = where("return_in_transit", history, 28)
    assert (turned["progress"], turned["tone"], turned["returning"]) == (0.45, "purple", True)
    halfway = where("return_in_transit", history, 28 + 0.45 * 48 / 2)  # half of the 0.45 * 2 days back
    assert halfway["progress"] == pytest.approx(0.225, abs=0.001)
    assert where("return_in_transit", history, 900)["progress"] == 0.0
    # Refused at the door, then sent back: the way back starts at the customer.
    refused = scans(("picked", 0), ("in_transit", 8), ("dropping_off", 40), ("rejected", 44), ("return_in_transit", 46))
    assert where("return_in_transit", refused, 46)["progress"] == 1.0
    back = where("returned", refused + scans(("returned", 90)), 91)
    assert (back["progress"], back["tone"]) == (0.0, "purple")


def test_lost_and_unknown_statuses_stay_at_the_last_position(caplog):
    history = scans(("picked", 0), ("in_transit", 8), ("disposed", 28))
    lost = where("disposed", history, 300)
    assert (lost["progress"], lost["tone"]) == (0.45, "red")
    with caplog.at_level("WARNING", logger="aurelle.tracking_map"):
        odd = where("teleported", scans(("picked", 0), ("in_transit", 8), ("teleported", 28)), 300)
    assert (odd["progress"], odd["tone"]) == (0.45, "normal") and "teleported" in caplog.text


def test_missing_times_and_configured_ranges():
    # Only a status, no scans (Biteship never answered): the start of the stage's range.
    assert where("in_transit", [], 10)["progress"] == 0.05
    assert where("dropping_off", [], 10)["progress"] == 0.85
    assert where("on_hold", [], 10)["progress"] == 0.0
    wide = estimate("in_transit", scans(("picked", 0), ("in_transit", 0)), T0 + timedelta(hours=24), 2, {**STAGES, "in_transit": (0.1, 0.9)})
    assert wide["progress"] == 0.5
    assert [eta_days(v) for v in ("2-3", "1", "3 - 5", "", None, "-")] == [3, 1, 5, 3, 3, 3]


def test_stage_ranges_come_from_the_environment(monkeypatch):
    from app.config import tracking_stages

    assert tracking_stages() == STAGES
    monkeypatch.setenv("TRACKING_PROGRESS_TRANSIT", "10 - 80")
    monkeypatch.setenv("TRACKING_PROGRESS_DROPOFF", "90-70")  # backwards: the default stands
    monkeypatch.setenv("TRACKING_PICKED_HOURS", "x")
    assert tracking_stages() == {**STAGES, "in_transit": (0.1, 0.8)}


def test_point_along_a_route():
    line = [[0.0, 0.0], [0.0, 1.0], [0.0, 3.0]]
    assert point_along_route(line, 0)[:2] == (0.0, 0.0)
    lat, lng, index = point_along_route(line, 0.5)
    assert (round(lng, 3), index) == (1.5, 1)
    assert point_along_route(line, 7)[:2] == (0.0, 3.0)
    passed, remaining, point = split_route(line, 0.5)
    assert passed == [[0.0, 0.0], [0.0, 1.0], point] and remaining == [point, [0.0, 3.0]]
    assert split_route([[1.0, 1.0], [1.0, 1.0]], 0.5)[2] == [1.0, 1.0]  # no length: no division by zero


# --------------------------------------------------------------------- areas


def test_postal_areas_file_is_built_from_the_shops_list():
    import sys

    backend = Path(__file__).parents[1]
    sys.path.insert(0, str(backend / "scripts"))
    try:
        import build_postal_areas as builder
    finally:
        sys.path.pop(0)
    assert builder.TARGET.read_text(encoding="utf-8") == builder.render(builder.build(json.loads(builder.SOURCE.read_text(encoding="utf-8"))))


def test_a_postal_code_names_a_district_only_when_there_is_exactly_one(monkeypatch):
    monkeypatch.setattr(tracking_map, "_postal_areas", lambda: {
        "16424": [["Jawa Barat", "Depok", "Beji"]],
        "23615": [["Aceh", "Aceh Barat", "Johan Pahwalan, Meureubo"]],
        "22765": [["Sumatera Utara", "Padang Lawas", "Sosa Timur"], ["Sumatera Utara", "Padang Lawas Utara", "Dolok"]],
        "40111": [["Jawa Barat", "Bandung", "Sumur Bandung"], ["Jawa Barat", "Bandung", "Cicendo"]],
    })
    assert district_of(" depok ", "16424") == "Beji"
    assert district_of("Aceh Barat", "23615") is None  # the list names two districts for it
    assert district_of("Bandung", "40111") is None  # listed twice in one city
    assert district_of("Padang Lawas", "22765") == "Sosa Timur"  # one district within this city
    assert district_of("Depok", "99999") is None and district_of("Bogor", "16424") is None
    assert area_of_postal("16424") == ("Jawa Barat", "Depok") and area_of_postal("22765") is None and area_of_postal("00000") is None
    # Every postal code of a district shares one cache entry; without a district, the city does.
    assert area_key("Jawa Barat", " Depok", "Beji") == "id|jawa barat|depok|beji"
    assert area_key("Jawa  Barat", "Depok", None) == "id|jawa barat|depok|"


class FakeMaps:
    """Stands in for Nominatim and OSRM: remembers what was asked."""

    def __init__(self):
        self.calls, self.places, self.down, self.osrm = [], {}, False, "road"

    def __call__(self, url, params):
        self.calls.append((url, params))
        if self.down:
            raise ConnectionError("down")
        if "/search" in url:
            point = self.places.get(params["q"])
            return 200, [{"lat": str(point[0]), "lon": str(point[1])}] if point else []
        if self.osrm == "none":
            return 400, {"code": "NoRoute"}
        if self.osrm == "busy":
            return 429, {"message": "Too Many Requests"}
        mode = "ferry" if self.osrm == "ferry" else "driving"
        return 200, {"code": "Ok", "routes": [{"distance": 151_234.0, "geometry": {"coordinates": [[106.8, -6.2], [107.2, -6.5], [107.6, -6.9]]}, "legs": [{"steps": [{"mode": "driving"}, {"mode": mode}]}]}]}

    def asked(self, part):
        return [c for c in self.calls if part in c[0]]


@pytest.fixture()
def maps(monkeypatch):
    fake = FakeMaps()
    monkeypatch.setattr(tracking_map, "_fetch", fake)
    # Waiting is switched off in tests, so turns at the geocoder pile up instead of passing.
    monkeypatch.setattr(tracking_map, "NOMINATIM_MAX_WAIT", 10_000.0)
    monkeypatch.setattr(tracking_map, "_postal_areas", lambda: {"40115": [["Jawa Barat", "Bandung", "Coblong"]], "12190": [["DKI Jakarta", "Jakarta", "Kebayoran Baru"]]})
    monkeypatch.setenv("BITESHIP_ORIGIN_LAT", "-6.2")
    monkeypatch.setenv("BITESHIP_ORIGIN_LNG", "106.8")
    fake.places = {"Coblong, Bandung, Jawa Barat, Indonesia": (-6.9, 107.6), "Bandung, Jawa Barat, Indonesia": (-6.91, 107.61), "Jakarta, DKI Jakarta, Indonesia": (-6.21, 106.85)}
    return fake


@pytest.fixture()
def db(api):  # noqa: F811 - the app has created the schema
    from app.db import connect

    conn = connect()
    yield conn
    conn.rollback()
    conn.close()


def test_an_area_is_geocoded_once_and_shared_by_its_postal_codes(db, maps, monkeypatch):
    found = tracking_map.locate(db, "Jawa Barat", "Bandung", "40115")
    assert found == {"key": "id|jawa barat|bandung|coblong", "lat": -6.9, "lng": 107.6, "precision": "district"}
    url, params = maps.calls[0]
    assert url == "https://nominatim.openstreetmap.org/search" and params == {"q": "Coblong, Bandung, Jawa Barat, Indonesia", "format": "jsonv2", "limit": 1, "countrycodes": "id"}
    assert tracking_map.locate(db, "jawa barat", "BANDUNG", "40115") == found and len(maps.calls) == 1
    # A postal code that names no single district is located by its city, once for the whole city.
    assert tracking_map.locate(db, "Jawa Barat", "Bandung", "40999")["precision"] == "city"
    assert tracking_map.locate(db, "Jawa Barat", "Bandung", "40998")["key"] == "id|jawa barat|bandung|" and len(maps.calls) == 2
    # The geocoder does not know the district: the city is used.
    del maps.places["Coblong, Bandung, Jawa Barat, Indonesia"]
    monkeypatch.setattr(tracking_map, "_postal_areas", lambda: {"40116": [["Jawa Barat", "Bandung", "Cidadap"]]})
    assert tracking_map.locate(db, "Jawa Barat", "Bandung", "40116") == {"key": "id|jawa barat|bandung|cidadap", "lat": -6.91, "lng": 107.61, "precision": "city"}
    assert tracking_map.locate(db, "", "Bandung", "40115") is None


def test_an_unknown_area_is_asked_about_again_only_after_some_days(db, maps, monkeypatch):
    assert tracking_map.locate(db, "Papua", "Nowhere", "99999") is None and len(maps.calls) == 1
    assert tracking_map.locate(db, "Papua", "Nowhere", "99999") is None and len(maps.calls) == 1  # remembered
    row = db.execute("SELECT lat, precision FROM geo_areas WHERE area_key = 'id|papua|nowhere|'").fetchone()
    assert (row["lat"], row["precision"]) == (None, None)
    db.execute("UPDATE geo_areas SET checked_at = ? WHERE area_key = 'id|papua|nowhere|'", (datetime.now(timezone.utc) - timedelta(days=6),))
    assert tracking_map.locate(db, "Papua", "Nowhere", "99999") is None and len(maps.calls) == 1
    db.execute("UPDATE geo_areas SET checked_at = ? WHERE area_key = 'id|papua|nowhere|'", (datetime.now(timezone.utc) - timedelta(days=8),))
    maps.places["Nowhere, Papua, Indonesia"] = (-4.0, 138.0)
    assert tracking_map.locate(db, "Papua", "Nowhere", "99999")["lat"] == -4.0 and len(maps.calls) == 2
    monkeypatch.setenv("GEO_RETRY_DAYS", "3")
    db.execute("INSERT INTO geo_areas (area_key, province, city, checked_at) VALUES ('id|bali|void|', 'Bali', 'Void', ?)", (datetime.now(timezone.utc) - timedelta(days=4),))
    tracking_map.locate(db, "Bali", "Void", "80000")
    assert len(maps.calls) == 3


def test_a_geocoder_that_cannot_be_reached_stores_nothing(db, maps, monkeypatch):
    maps.down = True
    assert tracking_map.locate(db, "Jawa Barat", "Bandung", "40115") is None
    assert db.execute("SELECT COUNT(*) FROM geo_areas").fetchone()[0] == 0  # asked again next time
    maps.down = False
    assert tracking_map.locate(db, "Jawa Barat", "Bandung", "40115")["precision"] == "district"
    monkeypatch.setenv("NOMINATIM_URL", "")  # switched off
    assert tracking_map.locate(db, "Jawa Barat", "Cimahi", "40511") is None and not [c for c in maps.calls if "Cimahi" in str(c)]


def test_the_geocoder_is_asked_once_a_second_across_requests(db, maps, monkeypatch):
    waits = []
    monkeypatch.setattr(tracking_map.time, "sleep", waits.append)
    monkeypatch.setattr(tracking_map, "NOMINATIM_MAX_WAIT", 3.0)
    assert tracking_map.locate(db, "Jawa Barat", "Bandung", "40999")  # the first turn is free
    assert waits == []
    assert tracking_map.locate(db, "DKI Jakarta", "Jakarta", "10110")  # the next one waits for its second
    assert len(waits) == 1 and 0.5 < waits[0] <= tracking_map.NOMINATIM_INTERVAL
    slot = float(db.execute("SELECT value FROM settings WHERE name = 'nominatim_next_slot'").fetchone()[0])
    assert slot - datetime.now(timezone.utc).timestamp() == pytest.approx(2 * tracking_map.NOMINATIM_INTERVAL, abs=0.5)
    # A queue longer than a request should wait in: this one goes without, and stores nothing.
    db.execute("UPDATE settings SET value = ? WHERE name = 'nominatim_next_slot'", (repr(datetime.now(timezone.utc).timestamp() + 30),))
    db.commit()
    asked = len(maps.calls)
    assert tracking_map.locate(db, "Jawa Barat", "Cimahi", "40511") is None and len(maps.calls) == asked
    assert db.execute("SELECT 1 FROM geo_areas WHERE city = 'Cimahi'").fetchone() is None
    # The lock is taken per transaction (it must not outlive one on a transaction pooler).
    import inspect

    assert "pg_advisory_xact_lock" in inspect.getsource(tracking_map._nominatim_turn) and "pg_advisory_lock" not in inspect.getsource(tracking_map)


def test_routes_are_fetched_once_and_water_gives_a_straight_line(db, maps):
    start = {"lat": -6.2, "lng": 106.8}
    area = tracking_map.locate(db, "Jawa Barat", "Bandung", "40115")
    way = tracking_map.route(db, start, area)
    assert way == {"kind": "road", "coords": [[-6.2, 106.8], [-6.5, 107.2], [-6.9, 107.6]], "distanceKm": 151.2}
    url, params = maps.asked("/route/")[0]
    assert url == "https://router.project-osrm.org/route/v1/driving/106.8,-6.2;107.6,-6.9" and params["overview"] == "simplified"
    assert tracking_map.route(db, start, area) == way and len(maps.asked("/route/")) == 1
    # No road between the two (another island), or a ferry on the way: a straight line, remembered.
    for kind, city in (("none", "Jakarta"), ("ferry", "Bandung")):
        maps.osrm = kind
        other = tracking_map.locate(db, "DKI Jakarta" if city == "Jakarta" else "Jawa Barat", city, "00000")
        asked = len(maps.asked("/route/"))
        line = tracking_map.route(db, start, other)
        assert line["kind"] == "straight" and line["coords"] == [[-6.2, 106.8], [other["lat"], other["lng"]]] and line["distanceKm"] > 0
        assert tracking_map.route(db, start, other) == line and len(maps.asked("/route/")) == asked + 1
    # A router that is busy or down is not remembered as "no road".
    maps.osrm = "busy"
    elsewhere = {"lat": -7.0, "lng": 110.4}
    assert tracking_map.route(db, elsewhere, area) is None
    maps.down = True
    assert tracking_map.route(db, elsewhere, area) is None
    maps.down, maps.osrm = False, "road"
    assert tracking_map.route(db, elsewhere, area)["kind"] == "road"


# ----------------------------------------------------------------- endpoints


def shipped(api, monkeypatch, status="inTransit"):  # noqa: F811
    fake = biteship(monkeypatch)
    register(api)
    placed = api.post("/api/orders", json={**{k: v for k, v in live_order_body().items()}}).json()["order"]
    api.post("/api/orders/ord-12345678/demo-payment", json={"paymentStatus": "paid"})
    now = datetime.now(timezone.utc)
    fake.orders["bs-order-1"]["status"] = status
    fake.history = [{"status": "picked", "note": "Paket dijemput", "updated_at": (now - timedelta(hours=32)).isoformat()}, {"status": "inTransit", "note": "Tiba di gudang Bandung", "updated_at": (now - timedelta(hours=24)).isoformat()}]
    return fake, placed


def live_order_body():
    from test_api import ADDRESS, JNE_REG, order_body

    body = {k: v for k, v in order_body().items() if k != "shippingServiceId"}
    return {**body, "address": {**ADDRESS, "state": "Jawa Barat", "city": "Bandung", "postalCode": "40115"}, "shippingRate": JNE_REG}


def test_tracking_carries_the_map_for_the_owner(api, maps, monkeypatch):  # noqa: F811
    shipped(api, monkeypatch)
    tracking = api.get("/api/orders/ord-12345678/tracking").json()["tracking"]
    shown = tracking["map"]
    assert (shown["status"], shown["stage"], shown["tone"], shown["estimated"], shown["returning"]) == ("in_transit", 3, "normal", True, False)
    # Picked 32 hours ago with a "2-3 days" service: in transit for 24 of the 64 hours to the estimate.
    assert shown["progress"] == pytest.approx(0.05 + 0.8 * 24 / 64, abs=0.002)
    assert shown["origin"] == {"lat": -6.2, "lng": 106.8, "city": "Jakarta"} and tracking["parcel"] == {"count": 1, "weightGrams": 200}
    assert shown["destination"] == {"lat": -6.9, "lng": 107.6, "precision": "district", "city": "Bandung"}
    assert shown["route"]["kind"] == "road" and shown["route"]["distanceKm"] == 151.2
    assert shown["route"]["passed"][0] == [-6.2, 106.8] and shown["route"]["remaining"][-1] == [-6.9, 107.6]
    assert shown["route"]["passed"][-1] == shown["route"]["remaining"][0] == [shown["vehicle"]["lat"], shown["vehicle"]["lng"]]
    assert tracking["driver"]["phone"] == "0812000111" and [h["status"] for h in tracking["history"]] == ["picked", "in_transit"]
    # The street address never reaches the geocoder or the router: an area name and two points.
    sent = json.dumps(maps.calls)
    assert all(private not in sent for private in ("Jl. Uji", "8123456789", "Tester", "example.com", "40115"))


def test_public_lookup_gives_scans_and_map_but_only_the_drivers_name(api, maps, monkeypatch):  # noqa: F811
    _, placed = shipped(api, monkeypatch)
    guest = TestClient(api.app)
    found = guest.post("/api/orders/track", json={"number": placed["number"], "email": "a@example.com"})
    assert found.status_code == 200, found.text
    order = found.json()["order"]
    assert order["status"] == "shipped"  # reading the scans moved the order along
    assert order["tracking"]["driver"] == {"name": "Budi"}
    # The courier's tracking number finds the order as well, with the same email.
    assert guest.post("/api/orders/track", json={"number": "JNE0001", "email": "a@example.com"}).json()["order"]["number"] == placed["number"]
    assert guest.post("/api/orders/track", json={"number": "JNE0001", "email": "b@example.com"}).status_code == 404
    assert [h["note"] for h in order["tracking"]["history"]] == ["Paket dijemput", "Tiba di gudang Bandung"]
    assert order["tracking"]["map"]["route"]["kind"] == "road" and order["tracking"]["map"]["destination"]["city"] == "Bandung"
    assert all(private not in found.text for private in ("Jl. Uji 1", "8123456789", "0812000111", "B 1234 XY", "a@example.com", "ord-12345678", "40115"))
    # Signed out and without the email there is no map at all.
    assert guest.get("/api/orders/ord-12345678/tracking").status_code == 401
    assert guest.post("/api/orders/track", json={"number": placed["number"], "email": "b@example.com"}).status_code == 404


def test_biteship_is_asked_once_a_minute_per_order(api, maps, monkeypatch):  # noqa: F811
    fake, placed = shipped(api, monkeypatch)
    monkeypatch.setenv("BITESHIP_TRACKING_CACHE_SECONDS", "60")
    guest = TestClient(api.app)
    asked = lambda: sum(1 for c in fake.calls if c[1].startswith("/v1/trackings/"))  # noqa: E731
    before = asked()
    for _ in range(3):
        assert api.get("/api/orders/ord-12345678/tracking").json()["tracking"]["status"] == "in_transit"
        assert guest.post("/api/orders/track", json={"number": placed["number"], "email": "a@example.com"}).status_code == 200
    assert asked() == before + 1
    # A webhook says the shipment changed: the next look asks Biteship again.
    fake.orders["bs-order-1"]["status"] = "delivered"
    assert api.get("/api/orders/ord-12345678/tracking").json()["tracking"]["status"] == "in_transit"
    assert guest.post("/api/shipping/biteship/webhook", json={"event": "order.status", "order_id": "bs-order-1", "status": "delivered"}).json() == {"ok": True}
    fresh = api.get("/api/orders/ord-12345678/tracking").json()["tracking"]
    assert (fresh["status"], fresh["map"]["tone"], fresh["map"]["progress"]) == ("delivered", "green", 1.0) and asked() == before + 2
    # An old answer is asked for again once the minute is over; with 0 it is never reused.
    from app.db import connect

    conn = connect()
    conn.execute("UPDATE shipment_tracking_cache SET fetched_at = fetched_at - INTERVAL '61 seconds'")
    conn.commit()
    conn.close()
    api.get("/api/orders/ord-12345678/tracking")
    assert asked() == before + 3
    monkeypatch.setenv("BITESHIP_TRACKING_CACHE_SECONDS", "0")
    api.get("/api/orders/ord-12345678/tracking")
    api.get("/api/orders/ord-12345678/tracking")
    assert asked() == before + 5


def test_tracking_answers_when_the_geocoder_and_the_router_do_not(api, maps, monkeypatch):  # noqa: F811
    shipped(api, monkeypatch)
    maps.down = True
    monkeypatch.delenv("BITESHIP_ORIGIN_LAT")
    answer = api.get("/api/orders/ord-12345678/tracking")
    assert answer.status_code == 200
    tracking = answer.json()["tracking"]
    assert len(tracking["history"]) == 2 and tracking["map"]["stage"] == 3
    assert (tracking["map"]["origin"], tracking["map"]["destination"], tracking["map"]["route"], tracking["map"]["vehicle"]) == (None, None, None, None)
    # The geocoder is back but the router is not: both ends are shown, with no line between them.
    maps.down, maps.osrm = False, "busy"
    monkeypatch.setenv("BITESHIP_ORIGIN_LAT", "-6.2")
    tracking = api.get("/api/orders/ord-12345678/tracking").json()["tracking"]
    assert tracking["map"]["destination"]["precision"] == "district" and tracking["map"]["origin"] and tracking["map"]["route"] is None and tracking["map"]["vehicle"] is None
    # No road: a straight line, marked as such for the page to draw dashed.
    maps.osrm = "none"
    line = api.get("/api/orders/ord-12345678/tracking").json()["tracking"]["map"]
    assert line["route"]["kind"] == "straight" and line["vehicle"] and len(line["route"]["passed"]) == 2
    # Even a database that refuses the map's tables leaves tracking standing.
    monkeypatch.setattr(tracking_map, "locate", lambda *a: (_ for _ in ()).throw(RuntimeError("boom")))
    broken = api.get("/api/orders/ord-12345678/tracking")
    assert broken.status_code == 200 and broken.json()["tracking"]["map"]["route"] is None and len(broken.json()["tracking"]["history"]) == 2


def test_no_map_without_a_shipment_or_outside_indonesia(api, maps):  # noqa: F811
    from test_api import order_body

    register(api)
    api.post("/api/orders", json=order_body())
    assert api.get("/api/orders/ord-12345678/tracking").json()["tracking"]["map"] is None and maps.calls == []
    assert tracking_map.build(None, {"addressSnapshot": {"country": "Singapore"}}, {"status": "in_transit"}) is None


def test_the_store_is_located_by_its_postal_code_when_no_point_is_set(db, maps, monkeypatch):
    monkeypatch.delenv("BITESHIP_ORIGIN_LAT")
    for name, value in (("NAME", "Aurelle Store"), ("PHONE", "0811111111"), ("ADDRESS", "Jl. Toko 1, Jakarta"), ("POSTAL_CODE", "12190")):
        monkeypatch.setenv(f"BITESHIP_ORIGIN_{name}", value)
    assert tracking_map.origin(db) == {"lat": -6.21, "lng": 106.85, "city": "Jakarta"}  # Kebayoran Baru is not known: its city is
    assert [c[1]["q"] for c in maps.calls] == ["Kebayoran Baru, Jakarta, DKI Jakarta, Indonesia", "Jakarta, DKI Jakarta, Indonesia"]
    monkeypatch.setenv("BITESHIP_ORIGIN_POSTAL_CODE", "99999")
    assert tracking_map.origin(db) is None
    assert maps.calls[0][0].startswith("https://nominatim.openstreetmap.org") and "AurelleShop/1.0 (" in tracking_map.map_user_agent()
