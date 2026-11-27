"""Format tampilan bahasa Indonesia. Nama bulan dipetakan sendiri (tidak bergantung locale OS)."""
import re
from datetime import date, datetime, time, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

BULAN = ("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember")
# Label zona waktu Indonesia; zona lain ditampilkan dengan singkatan bawaannya.
LABEL_ZONA = {"Asia/Jakarta": "WIB", "Asia/Pontianak": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT"}
KOSONG = "–"


def to_local(value: datetime, tz: str = "Asia/Jakarta") -> datetime:
    """Waktu UTC dari database -> zona tampilan. Waktu tanpa zona dianggap UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(ZoneInfo(tz))


def label_zona(tz: str = "Asia/Jakarta") -> str:
    return LABEL_ZONA.get(tz) or datetime.now(ZoneInfo(tz)).tzname() or tz


def format_tanggal(value: date | datetime | None, tz: str = "Asia/Jakarta") -> str:
    """8 Januari 2026"""
    if value is None:
        return KOSONG
    if isinstance(value, datetime):
        value = to_local(value, tz).date()
    return f"{value.day} {BULAN[value.month - 1]} {value.year}"


def format_jam(value: datetime | None, tz: str = "Asia/Jakarta") -> str:
    """14:05"""
    return KOSONG if value is None else to_local(value, tz).strftime("%H:%M")


def format_tanggal_jam(value: datetime | None, tz: str = "Asia/Jakarta") -> str:
    """8 Januari 2026 14:05 WIB"""
    if value is None:
        return KOSONG
    return f"{format_tanggal(value, tz)} {format_jam(value, tz)} {label_zona(tz)}"


def akhir_hari(value: date, tz: str = "Asia/Jakarta") -> datetime:
    """Estimasi tiba disimpan sebagai tanggal; untuk hitungan progress dipakai akhir hari itu."""
    return datetime.combine(value, time(23, 59, 59), tzinfo=ZoneInfo(tz))


def format_angka(value: Decimal | float | int | None, desimal: int = 0) -> str:
    """Angka tanpa nol di belakang koma yang tidak perlu: 26910, 190.4"""
    if value is None:
        return KOSONG
    number = round(float(value), desimal)
    return str(int(number)) if number == int(number) and desimal == 0 else f"{number:.{desimal}f}"


def format_berat(value: Decimal | float | None) -> str:
    """26910 Kg"""
    if value is None:
        return KOSONG
    number = float(value)
    return f"{int(number) if number == int(number) else round(number, 2)} Kg"


def format_jarak(value: Decimal | float | None) -> str:
    """± 190.4 KM"""
    return KOSONG if value is None else f"± {float(value):.1f} KM"


def inisial(nama: str | None) -> str:
    """Inisial untuk avatar: "Budi Santoso" -> "BS"."""
    kata = re.findall(r"[^\W\d_]+", nama or "")
    return "".join(k[0] for k in kata[:2]).upper() or KOSONG


def tautan_telepon(telepon: str | None) -> str | None:
    """Nomor Indonesia -> tautan WhatsApp (wa.me); nomor lain -> tel:."""
    digits = re.sub(r"\D", "", telepon or "")
    if not digits:
        return None
    if digits.startswith("0"):
        return f"https://wa.me/62{digits[1:]}"
    if digits.startswith("62"):
        return f"https://wa.me/{digits}"
    return f"tel:+{digits}" if (telepon or "").strip().startswith("+") else f"tel:{digits}"
