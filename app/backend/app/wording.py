"""The metal Aurelle works in, in the catalog's own words.

The starter catalog was written before the material was confirmed and spoke of a "silver
appearance". Every piece is 18K white gold, rhodium-plated. This module holds the old phrases
and what replaces them, so the seed file and a database seeded from the old one say the same.
The karat is stated once, in a product's materials; descriptions and stories say "white gold".
Only these exact phrases are touched: text an admin wrote differently is left as it is.
"""
import json
import re

from .db import Database

PHRASES = [
    # English
    ("Silver appearance · demo material not yet verified", "18K white gold, rhodium-plated"),
    ("in silver-colored metal and decorative stone", "in white gold set with a decorative stone"),
    ("in silver-colored metal", "in white gold"),
    ("in dark mixed material", "in white gold"),
    ("in mixed material,", "in white gold,"),
    ("and a quiet silver glow", "and the quiet glow of white gold"),
    ("Mixed materials and dark-toned natural stones", "White gold set with dark-toned natural stones"),
    # Indonesian
    ("Tampilan silver · material demo belum terverifikasi", "Emas putih 18K, berlapis rhodium"),
    ("dengan tampilan logam silver", "dari emas putih"),
    ("dengan tampilan silver dan batu dekoratif", "dari emas putih dengan batu dekoratif"),
    ("dengan material campuran gelap", "dari emas putih"),
    ("dengan material campuran,", "dari emas putih,"),
    ("kilau silver yang tenang", "kilau emas putih yang tenang"),
    ("Material campuran dan batu alami bertekstur gelap", "Emas putih dengan batu alami bertekstur gelap"),
    # The first version of this module put the karat in every sentence.
    ("in 18K white gold set with a decorative stone", "in white gold set with a decorative stone"),
    ("in 18K white gold,", "in white gold,"),
    ("18K white gold set with dark-toned natural stones", "White gold set with dark-toned natural stones"),
    ("dari emas putih 18K dengan batu dekoratif", "dari emas putih dengan batu dekoratif"),
    ("dari emas putih 18K,", "dari emas putih,"),
    ("Emas putih 18K dengan batu alami bertekstur gelap", "Emas putih dengan batu alami bertekstur gelap"),
]


def reword(text: str) -> str:
    """Descriptions, materials and collection stories."""
    for old, new in PHRASES:
        text = text.replace(old, new)
    return text


def reword_alt(text: str) -> str:
    """Photo descriptions were taken from the photo files' names, which say "silver"."""
    text = re.sub(r"\bSilver\b(?= [A-Z])", "White Gold", text)  # a title: "Layered Silver Necklaces"
    text = re.sub(r"\bSilver\b", "White gold", text)  # the start of a sentence
    return re.sub(r"\bsilver\b", "white gold", text)


def reword_product(product: dict) -> dict:
    """A product as the catalog stores it, with the old wording replaced. Returns the same dict."""
    for field in ("description", "materials", "tagline"):
        if isinstance(product.get(field), dict):
            product[field] = {lang: reword(value) for lang, value in product[field].items()}
    for photo in product.get("media", []):
        if isinstance(photo.get("alt"), dict):
            photo["alt"] = {lang: reword_alt(value) for lang, value in photo["alt"].items()}
    return product


def reword_collection(collection: dict) -> dict:
    if isinstance(collection.get("story"), dict):
        collection["story"] = {lang: reword(value) for lang, value in collection["story"].items()}
    return collection


def migrate(db: Database) -> None:
    """Bring a catalog seeded with the old wording up to date. Runs once per database."""
    if db.execute("SELECT 1 FROM settings WHERE name = 'wording_white_gold_2'").fetchone():
        return
    for table, fix in (("products", reword_product), ("collections", reword_collection)):
        for row in db.execute(f"SELECT id, data FROM {table}").fetchall():
            fixed = json.dumps(fix(json.loads(row["data"])))
            if fixed != row["data"]:
                db.execute(f"UPDATE {table} SET data = ? WHERE id = ?", (fixed, row["id"]))
    db.execute("INSERT INTO settings (name, value) VALUES ('wording_white_gold_2', '1')")
