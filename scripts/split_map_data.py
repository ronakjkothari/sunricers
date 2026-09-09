"""Split the map tables per host city.

The map only ever shows one city at a time, but it downloads every city's data
on boot: daily.json is 6.9 MB of which 0.8 MB is ever used, and heat.json is
0.7 MB of which about a fifteenth is. Splitting them cuts the map tab's boot
payload from roughly 11.7 MB to about 1.5 MB, with no change to what it can show.

Reads   app/data/daily.json, app/data/heat.json, app/data/places.json
Writes  app/data/daily/<slug>.json
        app/data/heat/<slug>.json
        app/data/places/<slug>.json
        app/data/index.json      city -> slug, counts, and the byte sizes

The originals are left in place; nothing breaks until the map is pointed at the
split files.

    python scripts/split_map_data.py
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "app" / "data"

# the same host_city -> file stem mapping the photos use
SLUG = {
    "Atlanta": "atlanta",
    "Boston": "boston",
    "Dallas": "dallas",
    "Houston": "houston",
    "Kansas City": "kansas-city",
    "Los Angeles": "los-angeles",
    "Miami": "miami",
    "New York/New Jersey": "new-york",
    "Philadelphia": "philadelphia",
    "San Francisco Bay Area": "san-francisco",
    "Seattle": "seattle",
}


def write(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    # separators matter: the default ", " / ": " adds ~8% to files this size
    text = json.dumps(obj, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def group(rows: list[dict], key: str) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        out[r[key]].append(r)
    return out


def main() -> None:
    src_daily = DATA / "daily.json"
    src_heat = DATA / "heat.json"
    src_places = DATA / "places.json"
    for p in (src_daily, src_heat, src_places):
        if not p.exists():
            raise SystemExit(f"missing {p.relative_to(ROOT)} — run the map-tables notebook first")

    daily = json.loads(src_daily.read_text(encoding="utf-8"))
    heat = json.loads(src_heat.read_text(encoding="utf-8"))
    places = json.loads(src_places.read_text(encoding="utf-8"))

    by_daily = group(daily, "m")
    by_heat = group(heat, "m")
    by_places = group(places, "m")

    index: dict[str, dict] = {}
    total_before = sum(p.stat().st_size for p in (src_daily, src_heat, src_places))
    biggest = 0

    for city, slug in sorted(SLUG.items()):
        # the city key is redundant once the file is per city
        d = [{k: v for k, v in r.items() if k != "m"} for r in by_daily.get(city, [])]
        h = [{k: v for k, v in r.items() if k != "m"} for r in by_heat.get(city, [])]
        pl = [{k: v for k, v in r.items() if k != "m"} for r in by_places.get(city, [])]

        n_d = write(DATA / "daily" / f"{slug}.json", d)
        n_h = write(DATA / "heat" / f"{slug}.json", h)
        n_p = write(DATA / "places" / f"{slug}.json", pl)

        city_bytes = n_d + n_h + n_p
        biggest = max(biggest, city_bytes)
        index[city] = {
            "slug": slug,
            "shops": len(pl),
            "heat_cells": len(h),
            "daily_rows": len(d),
            "bytes": city_bytes,
        }
        print(f"  {city:<24} {city_bytes / 1e6:5.2f} MB  "
              f"({len(pl):>5} shops, {len(h):>5} heat cells, {len(d):>5} daily rows)")

    write(DATA / "index.json", {
        "role": "per-city map tables",
        "note": "the map loads one city at a time; these replace the all-city daily/heat/places",
        "cities": index,
    })

    print(f"\nwas {total_before / 1e6:.2f} MB downloaded on every boot")
    print(f"now {biggest / 1e6:.2f} MB for the largest city, loaded on demand")
    print(f"boot payload cut by {100 * (1 - biggest / total_before):.0f}%")


if __name__ == "__main__":
    main()
