"""Writes app/data/id_postal_areas.json from the shop's list of Indonesian regions.

    python scripts/build_postal_areas.py

The shop's file (app/web/ecommerce/src/data/idRegions.json) is province -> city -> [postal
code, district]. The backend wants the other direction: postal code -> every (province, city,
district) it is listed under, so an order's postal code can be turned into its district. Run it
again whenever the shop's file changes; a test keeps the two in step.
"""
import json
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
SOURCE = BACKEND.parent / "web" / "ecommerce" / "src" / "data" / "idRegions.json"
TARGET = BACKEND / "app" / "data" / "id_postal_areas.json"


def build(regions: dict) -> dict[str, list[list[str]]]:
    areas: dict[str, list[list[str]]] = {}
    for province, cities in regions.items():
        for city, codes in cities.items():
            for code, district in codes:
                entry = [province, city, district]
                if entry not in areas.setdefault(code, []):
                    areas[code].append(entry)
    return dict(sorted(areas.items()))


def render(areas: dict) -> str:
    return json.dumps(areas, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    TARGET.parent.mkdir(exist_ok=True)
    TARGET.write_text(render(build(json.loads(SOURCE.read_text(encoding="utf-8")))), encoding="utf-8")
    print(f"Wrote {TARGET}")
