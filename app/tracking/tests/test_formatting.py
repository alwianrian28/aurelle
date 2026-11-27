from datetime import date, datetime, timezone

from app.domain import formatting as fmt


def test_tanggal_indonesia_tanpa_locale():
    assert fmt.format_tanggal(date(2026, 1, 10)) == "10 Januari 2026"
    assert fmt.format_tanggal(date(2026, 8, 17)) == "17 Agustus 2026"
    assert fmt.format_tanggal(None) == "–"


def test_utc_dikonversi_ke_wib():
    # 18:30 UTC = 01:30 WIB keesokan harinya.
    value = datetime(2026, 1, 9, 18, 30, tzinfo=timezone.utc)
    assert fmt.format_tanggal_jam(value) == "10 Januari 2026 01:30 WIB"
    assert fmt.format_jam(value) == "01:30"


def test_berat_jarak_inisial():
    assert fmt.format_berat(26910) == "26910 Kg"
    assert fmt.format_jarak(190.44) == "± 190.4 KM"
    assert fmt.inisial("Budi Santoso") == "BS"
    assert fmt.inisial(None) == "–"


def test_tautan_telepon():
    assert fmt.tautan_telepon("0812-3456-7890") == "https://wa.me/6281234567890"
    assert fmt.tautan_telepon("+62 812 3456 7890") == "https://wa.me/6281234567890"
    assert fmt.tautan_telepon("") is None
