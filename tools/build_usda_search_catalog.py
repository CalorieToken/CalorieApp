"""Build a compact, dated public search catalogue from official USDA downloads.

No API credentials or paid service are needed. Original descriptions, FDC IDs,
units and nutrient precision are retained. Missing or censored values stay null.
The original three-food reference is deliberately not overwritten.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NUTRIENTS = {1003, 1004, 1005, 1008, 2047, 2048}


def build(source: Path, output: Path):
    foods, sources, seen = [], [], set()
    for filename, edition in [
        ("FoodData_Central_foundation_food_json_2026-04-30.zip", "2026-04-30"),
        ("FoodData_Central_sr_legacy_food_json_2018-04.zip", "2018-04"),
    ]:
        path = source / filename
        with zipfile.ZipFile(path) as archive:
            member = next(n for n in archive.namelist() if n.endswith(".json"))
            records = next(iter(json.loads(archive.read(member)).values()))
        valid = 0
        for food in records:
            # USDA's Foundation export contains null slots, not food records.
            if not isinstance(food, dict):
                continue
            fdc_id = food["fdcId"]
            if fdc_id in seen:
                raise ValueError(f"Duplicate FDC identifier: {fdc_id}")
            seen.add(fdc_id)
            nutrients = []
            for value in food.get("foodNutrients", []):
                nutrient = value.get("nutrient", {})
                if nutrient.get("id") not in NUTRIENTS:
                    continue
                amount = value.get("amount")
                if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount < 0:
                    amount = None
                loq = value.get("loq")
                if amount == 0 and isinstance(loq, (int, float)) and loq > 0:
                    amount = None
                nutrients.append({"id": nutrient["id"], "name": nutrient["name"],
                                  "unit": nutrient["unitName"], "amount": amount,
                                  "loq": loq})
            foods.append({"fdc_id": fdc_id, "description": food["description"],
                          "data_type": food["dataType"],
                          "category": food.get("foodCategory", {}).get("description", ""),
                          "edition": edition, "nutrients": nutrients})
            valid += 1
        sources.append({"url": "https://fdc.nal.usda.gov/fdc-datasets/" + filename,
                        "edition": edition, "records": valid,
                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    data = {"version": 1, "retrieved_on": "2026-09-15", "source": "USDA FoodData Central",
            "licence": "CC0 1.0", "basis": "100 g edible food", "sources": sources,
            "foods": sorted(foods, key=lambda f: f["fdc_id"])}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps({"records": len(foods), "bytes": output.stat().st_size,
                      "sources": sources}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "frontend/public/data/usda-search-foods.json")
    args = parser.parse_args()
    build(args.source, args.output)
