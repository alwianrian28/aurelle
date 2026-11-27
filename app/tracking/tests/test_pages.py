"""Halaman HTML, API JSON, health check dan input history manual."""
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select

from app.models import Driver, Shipment
from app.services.tracking import WARNING_BITESHIP, WARNING_OSRM, insert_history

from .conftest import BITESHIP, OSRM, order_json, tracking_json

RESI = "11-SJ-26-000411"
ADMIN = {"X-Admin-Token": "token-admin-test"}
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


# ------------------------------------------------------------------ halaman


async def test_form_kosong(client):
    response = await client.get("/tracking")
    assert response.status_code == 200
    assert "Lacak pengiriman Anda" in response.text and "NO. RESI" in response.text


async def test_form_tanpa_javascript_dialihkan(client):
    response = await client.get("/tracking", params={"no_resi": " 11-sj-26-000411 "})
    assert response.status_code == 303 and response.headers["location"].endswith(f"/tracking/{RESI}")


async def test_resi_ada(client, session, make_shipment, mock_http):
    now = datetime.now(timezone.utc)
    shipment = await make_shipment(status_terakhir="dropping_off", picked_at=now - timedelta(hours=2), status_terakhir_at=now - timedelta(hours=1))
    await insert_history(session, shipment.id, "picked", now - timedelta(hours=2), "manual", memo="Barang selesai dimuat", posisi="Depok")
    await insert_history(session, shipment.id, "dropping_off", now - timedelta(hours=1), "manual", posisi="Tol Cikampek")
    session.add(Driver(shipment_id=shipment.id, nama="Budi Santoso", telepon="081234567890", kendaraan="Truk Box", no_polisi="B 1234 XYZ"))
    await session.commit()

    response = await client.get(f"/tracking/{RESI.lower()}")  # resi tidak peka huruf besar/kecil

    html = response.text
    assert response.status_code == 200 and not mock_http.calls  # tanpa order Biteship, tanpa OSRM
    for teks in (RESI, "Retailer", "Regular (Key)", "8 Januari 2026", "± 190.4 KM", "26910 Kg", "PT Sumber Makmur", "Toko Sinar"):
        assert teks in html
    assert "Dalam Pengantaran" in html and "Dalam perjalanan menuju lokasi tujuan" in html
    assert "Posisi kendaraan adalah perkiraan berdasarkan status pengiriman, bukan GPS real-time." in html
    assert "Waktu dan posisi dapat berubah sesuai kondisi di lapangan." in html
    assert "Budi Santoso" in html and "https://wa.me/6281234567890" in html and "B 1234 XYZ" in html
    assert "Sandbox" in html
    # Riwayat terbaru di atas.
    assert html.index("Tol Cikampek") < html.index("Barang selesai dimuat")
    # Tidak ada rahasia yang ikut ke browser.
    for rahasia in ("biteship_test.", "postgresql", "service_role", "token-admin-test"):
        assert rahasia not in html


async def test_resi_tidak_ada(client, mock_http):
    html = await client.get("/tracking/TIDAK-ADA-123")
    assert html.status_code == 404 and "No. resi tidak ditemukan" in html.text and "TIDAK-ADA-123" in html.text

    data = await client.get("/api/tracking/TIDAK-ADA-123")
    assert data.status_code == 404
    assert data.json() == {"error": "resi_tidak_ditemukan", "message": "No. resi tidak ditemukan.", "no_resi": "TIDAK-ADA-123"}


async def test_resi_dengan_html_di_escape(client):
    response = await client.get("/tracking/%3Cscript%3Ealert(1)%3C%2Fscript%3E")
    assert response.status_code == 404 and "<script>alert" not in response.text.lower()


async def test_biteship_timeout_menampilkan_data_terakhir(client, session, make_shipment, mock_http):
    await make_shipment(biteship_order_id="ord_1", biteship_tracking_id="trk_1", status_terakhir="picked")
    route = mock_http.get(f"{BITESHIP}/v1/orders/ord_1").mock(side_effect=httpx.ReadTimeout("timeout"))

    response = await client.get(f"/tracking/{RESI}")

    assert response.status_code == 200
    assert route.call_count == 3  # dicoba ulang, lalu menyerah
    assert WARNING_BITESHIP in response.text and "Barang Diambil" in response.text and RESI in response.text
    shipment = (await session.execute(select(Shipment))).scalar_one()
    assert shipment.last_synced_at is None and shipment.status_terakhir == "picked"

    data = (await client.get(f"/api/tracking/{RESI}")).json()
    assert data["sync"]["warning"] == WARNING_BITESHIP and data["sync"]["synced_now"] is False


async def test_biteship_error_5xx_dan_4xx_tidak_menjadi_500(client, make_shipment, mock_http):
    await make_shipment(biteship_order_id="ord_1")
    mock_http.get(f"{BITESHIP}/v1/orders/ord_1").mock(return_value=httpx.Response(401, json={"success": False, "error": "Authentication failed", "code": 40101001}))
    assert (await client.get(f"/tracking/{RESI}")).status_code == 200


async def test_sinkron_saat_data_basi_dan_tidak_saat_masih_baru(client, session, make_shipment, mock_http):
    await make_shipment(biteship_order_id="ord_1", last_synced_at=datetime.now(timezone.utc) - timedelta(minutes=11))
    orders = mock_http.get(f"{BITESHIP}/v1/orders/ord_1").mock(return_value=httpx.Response(200, json=order_json("dropping_off", driver_name="Asep", driver_phone="08111", driver_plate_number="D 1 A")))
    mock_http.get(f"{BITESHIP}/v1/trackings/trk_1").mock(
        return_value=httpx.Response(200, json=tracking_json("dropping_off", [("picked", "2026-01-08T10:30:00+07:00", ""), ("dropping_off", "2026-01-08T11:00:00+07:00", "Menuju tujuan")]))
    )

    first = await client.get(f"/tracking/{RESI}")
    assert first.status_code == 200 and orders.call_count == 1
    assert "Menuju tujuan" in first.text and "Asep" in first.text and "Biteship – JNE REG" in first.text

    # Baru saja disinkronkan: halaman berikutnya memakai DB.
    await client.get(f"/tracking/{RESI}")
    assert orders.call_count == 1
    # ?force=true dibatasi cooldown.
    data = (await client.get(f"/api/tracking/{RESI}", params={"force": "true"})).json()
    assert orders.call_count == 1 and data["sync"]["synced_now"] is False

    # Setelah cooldown lewat, force menyinkronkan lagi.
    shipment = (await session.execute(select(Shipment))).scalar_one()
    shipment.last_synced_at = datetime.now(timezone.utc) - timedelta(seconds=31)
    await session.commit()
    data = (await client.get(f"/api/tracking/{RESI}", params={"force": "true"})).json()
    assert orders.call_count == 2 and data["sync"]["synced_now"] is True
    assert len(data["histories"]) == 2 and data["histories"][0]["status"] == "dropping_off"


# ---------------------------------------------------------------- peta / OSRM


async def test_api_mengirim_data_peta(client, make_shipment):
    now = datetime.now(timezone.utc)
    await make_shipment(status_terakhir="dropping_off", picked_at=now - timedelta(hours=1), estimasi_tiba=(now + timedelta(days=2)).date())

    peta = (await client.get(f"/api/tracking/{RESI}")).json()["map"]

    assert peta["available"] and peta["show_vehicle"] and not peta["delivered"]
    assert 0.05 < peta["progress"] <= 0.95
    assert peta["route_passed"][0] == peta["origin"] and peta["route_remaining"][-1] == peta["destination"]
    assert peta["route_passed"][-1] == peta["route_remaining"][0] == peta["vehicle_position"]
    assert peta["note"] == "Perkiraan posisi berdasarkan status pengiriman"


async def test_peta_delivered_dan_dibatalkan(client, session, make_shipment):
    shipment = await make_shipment(status_terakhir="delivered")
    peta = (await client.get(f"/api/tracking/{RESI}")).json()["map"]
    assert peta["progress"] == 1.0 and peta["delivered"] and peta["vehicle_position"] == peta["destination"]

    shipment.status_terakhir = "cancelled"
    await session.merge(shipment)
    await session.commit()
    data = (await client.get(f"/api/tracking/{RESI}")).json()
    assert data["map"]["show_vehicle"] is False and data["summary"]["status_color"] == "red"


async def test_rute_osrm_diambil_sekali_lalu_dicache(client, session, make_shipment, mock_http):
    await make_shipment(route_geometry=None, jarak_km=None)
    osrm = mock_http.get(url__startswith=f"{OSRM}/route/v1/driving/").mock(
        return_value=httpx.Response(200, json={"code": "Ok", "routes": [{"distance": 190432.0, "geometry": {"type": "LineString", "coordinates": [[106.7942, -6.4025], [107.6, -6.55], [108.5523, -6.732]]}}]})
    )

    first = await client.get(f"/tracking/{RESI}")
    await client.get(f"/tracking/{RESI}")

    assert first.status_code == 200 and "± 190.4 KM" in first.text
    assert osrm.call_count == 1
    # OSRM memakai urutan lng,lat di URL; yang disimpan [lat, lng].
    assert "106.7942,-6.4025;108.5523,-6.732" in str(osrm.calls.last.request.url)
    shipment = (await session.execute(select(Shipment))).scalar_one()
    assert shipment.route_geometry[0] == [-6.4025, 106.7942] and float(shipment.jarak_km) == 190.4


async def test_osrm_timeout_memakai_garis_lurus(client, make_shipment, mock_http):
    await make_shipment(route_geometry=None, jarak_km=None)
    mock_http.get(url__startswith=f"{OSRM}/route/v1/driving/").mock(side_effect=httpx.ConnectTimeout("timeout"))

    response = await client.get(f"/tracking/{RESI}")
    data = (await client.get(f"/api/tracking/{RESI}")).json()

    assert response.status_code == 200 and WARNING_OSRM in response.text
    assert data["map"]["available"] and data["map"]["is_straight_line"]
    assert data["summary"]["jarak_teks"] == "–"


async def test_tanpa_koordinat_peta_tidak_tersedia(client, make_shipment):
    await make_shipment(route_geometry=None, muat_lat=None, muat_lng=None)
    response = await client.get(f"/tracking/{RESI}")
    assert response.status_code == 200 and "Koordinat titik muat / bongkar belum tersedia." in response.text


# ------------------------------------------------------------------ lain-lain


async def test_healthz(client):
    response = await client.get("/healthz")
    assert response.status_code == 200 and response.json()["database"] == "ok"


async def test_history_manual_butuh_token(client, make_shipment):
    await make_shipment()
    url = f"/api/shipments/{RESI}/histories"
    assert (await client.post(url, data={"status": "picked"})).status_code == 401
    assert (await client.post(url, data={"status": "picked"}, headers={"X-Admin-Token": "salah"})).status_code == 401


async def test_history_manual(client, make_shipment):
    await make_shipment()
    url = f"/api/shipments/{RESI}/histories"

    response = await client.post(url, data={"status": "picked", "memo": "Dokumen lengkap", "posisi": "Depok", "occurred_at": "2030-01-08T10:00:00+07:00"}, headers=ADMIN)

    assert response.status_code == 201
    data = response.json()
    assert data["summary"]["status"] == "picked"
    assert (data["histories"][0]["memo"], data["histories"][0]["posisi"], data["histories"][0]["source"]) == ("Dokumen lengkap", "Depok", "manual")
    assert data["histories"][0]["tanggal"] == "8 Januari 2030" and data["histories"][0]["jam"] == "10:00 WIB"
    # Kiriman yang sama dua kali tidak menduplikasi.
    again = await client.post(url, data={"status": "picked", "occurred_at": "2030-01-08T10:00:00+07:00"}, headers=ADMIN)
    assert len(again.json()["histories"]) == 1
    assert (await client.post("/api/shipments/TIDAK-ADA/histories", data={"status": "picked"}, headers=ADMIN)).status_code == 404


async def test_validasi_foto(client, make_shipment):
    await make_shipment()
    url = f"/api/shipments/{RESI}/histories"

    pdf = await client.post(url, data={"status": "delivered"}, files={"foto": ("bukti.pdf", b"%PDF-1.4", "application/pdf")}, headers=ADMIN)
    palsu = await client.post(url, data={"status": "delivered"}, files={"foto": ("bukti.png", b"bukan gambar", "image/png")}, headers=ADMIN)
    besar = await client.post(url, data={"status": "delivered"}, files={"foto": ("bukti.png", PNG + b"\x00" * (5 * 1024 * 1024), "image/png")}, headers=ADMIN)
    # Gambar sah, tetapi Supabase Storage tidak dikonfigurasi di test.
    tanpa_storage = await client.post(url, data={"status": "delivered"}, files={"foto": ("bukti.png", PNG, "image/png")}, headers=ADMIN)

    assert (pdf.status_code, palsu.status_code, besar.status_code, tanpa_storage.status_code) == (415, 415, 413, 503)
    assert (await client.get(f"/api/tracking/{RESI}")).json()["histories"] == []
