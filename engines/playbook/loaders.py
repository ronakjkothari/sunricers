from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

HOST_CITIES = [
    "Atlanta",
    "Boston",
    "Dallas",
    "Houston",
    "Kansas City",
    "Los Angeles",
    "Miami",
    "New York/New Jersey",
    "Philadelphia",
    "San Francisco Bay Area",
    "Seattle",
]

# Visits/spend markets that must be split across two host cities
MERGED_MARKETS = {
    "Dallas / Houston": ("Dallas", "Houston"),
    "Los Angeles / SF Bay Area": ("Los Angeles", "San Francisco Bay Area"),
}


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def _f(row: dict[str, str], key: str, default: float = 0.0) -> float:
    raw = row.get(key, "")
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def load_crosswalk(curated: Path) -> list[dict[str, str]]:
    return _read_csv(curated / "market_crosswalk.csv")


def poi_split_weights(curated: Path) -> dict[str, dict[str, float]]:
    """
    For merged visit/spend markets, allocate using POI counts of the split cities.
    Returns {merged_label: {host_city: weight}} with weights summing to 1.
    """
    rows = _read_csv(curated / "poi_efw_market_summary.csv")
    counts: dict[str, int] = defaultdict(int)
    for r in rows:
        counts[r["MARKET"]] += int(float(r["poi_count"]))

    out: dict[str, dict[str, float]] = {}
    for merged, (a, b) in MERGED_MARKETS.items():
        ca, cb = counts.get(a, 0), counts.get(b, 0)
        total = ca + cb
        if total <= 0:
            out[merged] = {a: 0.5, b: 0.5}
        else:
            out[merged] = {a: ca / total, b: cb / total}
    return out


def _summer_filter(year_month: str, summer_months: tuple[int, ...]) -> bool:
    try:
        month = int(year_month.split("-")[1])
    except (IndexError, ValueError):
        return False
    return month in summer_months


def load_city_indicators(
    curated: Path,
    summer_months: tuple[int, ...] = (6, 7),
) -> dict[str, dict[str, float]]:
    """
    Build one row of raw indicators per canonical host city for summer months.

    Indicators:
      energy_kwh, water_liters, kg_co2e, visits, cdd, uhi, spend_total
    """
    weights = poi_split_weights(curated)
    indicators: dict[str, dict[str, float]] = {
        city: {
            "energy_kwh": 0.0,
            "water_liters": 0.0,
            "kg_co2e": 0.0,
            "visits": 0.0,
            "cdd": 0.0,
            "uhi": 0.0,
            "spend_total": 0.0,
            "summer_month_rows": 0.0,
        }
        for city in HOST_CITIES
    }

    # Footprints (visit-derived) — may be merged markets
    for r in _read_csv(curated / "footprint_estimates_market_monthly.csv"):
        if not _summer_filter(r["year_month"], summer_months):
            continue
        market = r["MARKET"]
        payload = {
            "energy_kwh": _f(r, "est_energy_kwh"),
            "water_liters": _f(r, "est_water_liters"),
            "kg_co2e": _f(r, "est_kg_co2e"),
            "visits": _f(r, "total_visits"),
            "summer_month_rows": 1.0,
        }
        if market in MERGED_MARKETS:
            for city, w in weights[market].items():
                for k, v in payload.items():
                    indicators[city][k] += v * w
        elif market in indicators:
            for k, v in payload.items():
                indicators[market][k] += v

    # Spend — merged markets, allocate same way
    for r in _read_csv(curated / "spend_efw_domain_monthly.csv"):
        if not _summer_filter(r["year_month"], summer_months):
            continue
        market = r["MARKET"]
        amount = _f(r, "spend_amount")
        if market in MERGED_MARKETS:
            for city, w in weights[market].items():
                indicators[city]["spend_total"] += amount * w
        elif market in indicators:
            indicators[market]["spend_total"] += amount

    # Weather — already canonical host cities
    for r in _read_csv(curated / "weather_host_monthly.csv"):
        if not _summer_filter(r["year_month"], summer_months):
            continue
        city = r["host_city_canonical"]
        if city in indicators:
            indicators[city]["cdd"] += _f(r, "sum_cdd_c")

    # UHI — already split markets (static, not monthly)
    for r in _read_csv(curated / "uhi_market_summary.csv"):
        city = r["MARKET"]
        if city in indicators:
            indicators[city]["uhi"] = _f(r, "mean_uhi")

    # POI structure shares (for playbook profiling)
    poi_rows = _read_csv(curated / "poi_efw_market_summary.csv")
    poi_by_city_layer: dict[str, dict[str, float]] = defaultdict(
        lambda: defaultdict(float)
    )
    for r in poi_rows:
        poi_by_city_layer[r["MARKET"]][r["efw_layer"]] += _f(r, "poi_count")

    for city, layers in poi_by_city_layer.items():
        if city not in indicators:
            continue
        total = sum(layers.values()) or 1.0
        indicators[city]["poi_food_share"] = layers.get("Food", 0.0) / total
        indicators[city]["poi_energy_share"] = layers.get("Energy", 0.0) / total
        indicators[city]["poi_water_share"] = layers.get("Water", 0.0) / total
        indicators[city]["poi_venue_share"] = layers.get("Venue", 0.0) / total

    return indicators


def allocation_notes(curated: Path) -> dict[str, dict[str, float]]:
    return poi_split_weights(curated)
