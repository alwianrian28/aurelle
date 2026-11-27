"""domain/position.py dan domain/status.py: fungsi murni, tanpa database."""
from datetime import datetime, timedelta, timezone

import pytest

from app.domain.position import MAX_TRANSIT_PROGRESS, PICKED_PROGRESS, clamp, estimate_progress, haversine_km, point_along_route, split_route
from app.domain.status import GRAY, Kind, normalize_status, status_info

NOW = datetime(2026, 1, 8, 12, 0, tzinfo=timezone.utc)
PICKED_AT = NOW - timedelta(hours=5)
ETA = PICKED_AT + timedelta(hours=10)  # tepat setengah jalan pada NOW


def progress(status: str, last: float | None = 0.0, now: datetime = NOW, picked_at=PICKED_AT, eta=ETA) -> float:
    return estimate_progress(status, picked_at, eta, now, last)


# ---------------------------------------------------------- progress per status


@pytest.mark.parametrize("status", ["confirmed", "scheduled", "allocated", "picking_up"])
def test_sebelum_diambil_progress_nol(status):
    assert progress(status, last=0.4) == 0.0


def test_picked_progress_lima_persen():
    assert progress("picked") == PICKED_PROGRESS == 0.05


@pytest.mark.parametrize("status", ["dropping_off", "in_transit"])
def test_dalam_perjalanan_dinamis_dari_waktu(status):
    # 0.05 + 0.9 * (5 jam / 10 jam)
    assert progress(status) == pytest.approx(0.5)


def test_delivered_progress_satu():
    assert progress("delivered", last=0.3) == 1.0


def test_on_hold_tetap_di_nilai_terakhir():
    assert progress("on_hold", last=0.37) == pytest.approx(0.37)


@pytest.mark.parametrize("status", ["cancelled", "rejected", "courier_not_found", "disposed"])
def test_gagal_tetap_di_nilai_terakhir_dan_kendaraan_disembunyikan(status):
    assert progress(status, last=0.2) == pytest.approx(0.2)
    assert status_info(status).show_vehicle is False
    assert status_info(status).color == "red"


def test_retur_arah_dibalik():
    assert progress("return_in_transit", last=0.6) == pytest.approx(0.3)
    assert progress("returned", last=0.6) == 0.0
    assert status_info("return_in_transit").color == "orange"


def test_status_tak_dikenal_tetap_di_posisi_terakhir():
    assert progress("sorting_center", last=0.42) == pytest.approx(0.42)
    info = status_info("sorting_center")
    assert (info.label, info.color, info.kind) == ("sorting_center", GRAY, Kind.UNKNOWN)


def test_status_camel_case_dinormalkan():
    assert normalize_status("droppingOff") == "dropping_off"
    assert progress("droppingOff") == pytest.approx(0.5)


# ------------------------------------------------------------------- clamp


def test_clamp():
    assert clamp(-0.5) == 0.0
    assert clamp(1.7) == 1.0
    assert clamp(0.25) == 0.25


def test_waktu_sebelum_picked_tidak_mundur_dari_lima_persen():
    assert progress("dropping_off", now=PICKED_AT - timedelta(hours=3)) == pytest.approx(0.05)


def test_last_progress_di_luar_rentang_dijepit():
    assert progress("on_hold", last=3.0) == 1.0
    assert progress("on_hold", last=-1.0) == 0.0
    assert progress("on_hold", last=None) == 0.0


# -------------------------------------------------------------- batas 0.95


def test_batas_095_saat_tepat_di_estimasi_tiba():
    assert progress("dropping_off", now=ETA) == MAX_TRANSIT_PROGRESS == 0.95


def test_batas_095_setelah_lewat_estimasi_tiba():
    assert progress("dropping_off", now=ETA + timedelta(days=30)) == 0.95


def test_estimasi_tiba_sebelum_picked_tetap_095():
    assert progress("dropping_off", eta=PICKED_AT - timedelta(hours=1)) == 0.95


def test_tanpa_picked_at_atau_estimasi_memakai_nilai_terakhir():
    assert progress("dropping_off", picked_at=None, last=0.0) == 0.05
    assert progress("dropping_off", eta=None, last=0.5) == pytest.approx(0.5)
    assert progress("dropping_off", eta=None, last=1.0) == 0.95


# ------------------------------------------------------- titik di sepanjang rute

# Di khatulistiwa 1 derajat bujur = panjang yang sama, jadi hitungan mudah diperiksa.
DUA_TITIK = [[0.0, 0.0], [0.0, 2.0]]
# Segmen pertama 1 derajat, segmen kedua 3 derajat: index dan jarak sengaja tidak sejalan.
TIGA_TITIK = [[0.0, 0.0], [0.0, 1.0], [0.0, 4.0]]


def test_rute_dua_titik():
    lat, lng, index = point_along_route(DUA_TITIK, 0.25)
    assert (lat, index) == (0.0, 0)
    assert lng == pytest.approx(0.5)


def test_rute_dua_titik_di_ujung():
    assert point_along_route(DUA_TITIK, 0.0) == (0.0, 0.0, 0)
    lat, lng, index = point_along_route(DUA_TITIK, 1.0)
    assert (lat, lng, index) == (0.0, pytest.approx(2.0), 0)


def test_interpolasi_di_tengah_segmen():
    # Setengah panjang rute (2 dari 4 derajat) jatuh di segmen KEDUA, sepertiga jalan di dalamnya.
    lat, lng, index = point_along_route(TIGA_TITIK, 0.5)
    assert index == 1
    assert lng == pytest.approx(2.0)
    assert lat == pytest.approx(0.0)


def test_berdasarkan_jarak_bukan_index():
    # Berdasarkan index, 0.5 akan jatuh di titik tengah daftar (lng 1.0). Berdasarkan jarak: 2.0.
    assert point_along_route(TIGA_TITIK, 0.5)[1] != pytest.approx(1.0)
    # 10% rute = 0.4 derajat, masih di segmen pertama.
    lat, lng, index = point_along_route(TIGA_TITIK, 0.1)
    assert (index, lng) == (0, pytest.approx(0.4))


def test_progress_di_luar_rentang_dijepit_ke_ujung_rute():
    assert point_along_route(TIGA_TITIK, -1)[:2] == (0.0, 0.0)
    assert point_along_route(TIGA_TITIK, 9)[1] == pytest.approx(4.0)


def test_rute_satu_titik_dan_kosong():
    assert point_along_route([[1.5, 2.5]], 0.7) == (1.5, 2.5, 0)
    with pytest.raises(ValueError):
        point_along_route([], 0.5)


def test_titik_kembar_tidak_membagi_dengan_nol():
    assert point_along_route([[1.0, 1.0], [1.0, 1.0]], 0.5) == (1.0, 1.0, 0)


def test_split_route_menyambung_di_posisi_kendaraan():
    passed, remaining, position = split_route(TIGA_TITIK, 0.5)
    assert passed[0] == [0.0, 0.0] and remaining[-1] == [0.0, 4.0]
    assert passed[-1] == remaining[0] == [position[0], position[1]]
    assert len(passed) == 3 and len(remaining) == 2


def test_haversine_depok_cirebon_masuk_akal():
    assert 190 < haversine_km((-6.4025, 106.7942), (-6.7320, 108.5523)) < 200
