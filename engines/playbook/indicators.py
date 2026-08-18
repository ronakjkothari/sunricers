"""
Indicator adapters for Plan D.

D's z-score engine is source-independent: it only needs per-city indicators
with keys energy_kwh, kg_co2e, water_liters, cdd, uhi.

Two adapters exist on purpose — do NOT silently blend them:

  map      — per-shop summer RATES from spend-patterns (via app/data map tables).
             Canonical for the product demo: same demand grain as B's map.
  curated  — city TOTALS from store-visits curated package. Useful for absolute
             footprint rollups; size-sensitive; NOT the default for readiness.

Blending / weighting multiple demand CSVs into one z-score is rejected for the
hackathon: it would make rankings opaque and break B↔D agreement.
"""

from __future__ import annotations

import json
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Literal

from .loaders import HOST_CITIES, _f, _read_csv, load_city_indicators

IndicatorSource = Literal["map", "curated"]

# Same intensity factors as B map / build_scorecards
MAP_FACTORS = {
    "Food": (2.8, 25.0, 3.5),
    "Energy": (45.0, 1.5, 12.0),
    "Water": (28.0, 300.0, 2.0),
    "Venue": (4.0, 15.0, 2.5),
    "Other_EFW": (3.0, 12.0, 1.8),
}

SOURCE_META = {
    "map": {
        "id": "map",
        "label": "spend-patterns per-shop summer rates (map tables)",
        "unit": "energy/water/co2e per trading shop-month; city size does not drive rank",
        "joins_geometry": True,
        "canonical_for_demo": True,
    },
    "curated": {
        "id": "curated",
        "label": "store-visits curated city totals",
        "unit": "summer aggregate totals (size-sensitive)",
        "joins_geometry": False,
        "canonical_for_demo": False,
    },
}


def map_data_available(app_data: Path) -> bool:
    return (app_data / "places.json").exists() and (app_data / "months.json").exists()


def load_map_rate_indicators(
    app_data: Path,
    curated: Path,
    *,
    years: set[str] | None = None,
    summer_months: set[str] | None = None,
) -> dict[str, dict[str, float]]:
    """
    Build indicators from B's map tables (spend-patterns → customers × factors).

    Mirrors scripts/build_scorecards.py so D rankings match the Spatial tab.
    """
    years = years or {"2022", "2023", "2024"}
    summer_months = summer_months or {"06", "07"}

    places = json.loads((app_data / "places.json").read_text(encoding="utf-8"))
    months = json.loads((app_data / "months.json").read_text(encoding="utf-8"))
    mi = [i for i, m in enumerate(months) if m[:4] in years and m[5:] in summer_months]
    cities = sorted({p["m"] for p in places})

    indicators: dict[str, dict[str, float]] = {}
    for city in cities:
        sm_path = app_data / "sm" / f"{city.replace('/', '_')}.json"
        sm = json.loads(sm_path.read_text(encoding="utf-8"))
        idx = {k: i for i, k in enumerate(sm["keys"])}
        kwh = water = co2 = 0.0
        shop_months = 0
        uhis: list[float] = []
        for p in places:
            if p["m"] != city:
                continue
            if p.get("u") is not None:
                uhis.append(float(p["u"]))
            row = sm["v"][idx[p["k"]]] if p["k"] in idx else None
            if row is None:
                continue
            fk, fw, fc = MAP_FACTORS.get(p["l"], MAP_FACTORS["Other_EFW"])
            for i in mi:
                v = row[i] or 0
                if v <= 0:
                    continue
                shop_months += 1
                kwh += v * fk
                water += v * fw
                co2 += v * fc
        if shop_months <= 0:
            shop_months = 1
        indicators[city] = {
            "energy_kwh": kwh / shop_months,
            "water_liters": water / shop_months,
            "kg_co2e": co2 / shop_months,
            "uhi": statistics.median(uhis) if uhis else 0.0,
            "shop_months": float(shop_months),
            "shops": float(sum(1 for p in places if p["m"] == city)),
            "cdd": 0.0,
        }

    # CDD from curated weather (shared climate layer — not a second demand source)
    cdd: dict[str, list[float]] = defaultdict(list)
    weather_path = curated / "weather_host_monthly.csv"
    if weather_path.exists():
        for r in _read_csv(weather_path):
            y, m = r["year_month"].split("-")
            if y in years and m in summer_months:
                cdd[r["host_city_canonical"]].append(_f(r, "sum_cdd_c"))
    for city in indicators:
        indicators[city]["cdd"] = (
            statistics.fmean(cdd[city]) if cdd.get(city) else 0.0
        )

    # Ensure all 11 hosts present
    for city in HOST_CITIES:
        indicators.setdefault(
            city,
            {
                "energy_kwh": 0.0,
                "water_liters": 0.0,
                "kg_co2e": 0.0,
                "cdd": 0.0,
                "uhi": 0.0,
                "shop_months": 0.0,
                "shops": 0.0,
            },
        )
    return indicators


def resolve_indicators(
    *,
    source: IndicatorSource,
    curated: Path,
    app_data: Path,
    summer_months: tuple[int, ...] = (6, 7),
) -> tuple[dict[str, dict[str, float]], dict]:
    """
    Return (indicators, source_meta).

    Raises FileNotFoundError if map source requested but map tables missing.
    """
    if source == "map":
        if not map_data_available(app_data):
            raise FileNotFoundError(
                f"indicator source=map requires {app_data}/places.json and months.json. "
                "Build map tables (B) or pass --source curated."
            )
        ind = load_map_rate_indicators(app_data, curated)
        return ind, dict(SOURCE_META["map"])

    if source == "curated":
        ind = load_city_indicators(curated, summer_months=summer_months)
        return ind, dict(SOURCE_META["curated"])

    raise ValueError(f"Unknown indicator source: {source}")


def default_source(app_data: Path) -> IndicatorSource:
    """Product default: map rates when available, else curated totals."""
    return "map" if map_data_available(app_data) else "curated"
