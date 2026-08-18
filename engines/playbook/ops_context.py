"""
Ops-scale companion context for A Overview / B side panel / C baselines.

This is intentionally SEPARATE from readiness indicators:

  readiness (D/B)  → per-shop rates (intensity) — who is pressured
  ops_context      → city totals + mix + money + climate — how big / what shape

Never feed these totals into the readiness z-score.
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any

from .loaders import HOST_CITIES, MERGED_MARKETS, _f, _read_csv, poi_split_weights

# NAICS3 → nexus domain (aligned with curated POI efw_layer)
_NAICS_DOMAIN = {
    "722": "Food",
    "445": "Food",
    "311": "Food",
    "312": "Food",
    "424": "Food",
    "447": "Energy",
    "221": "Energy",
    "721": "Water",
    "562": "Water",
    "711": "Venue",
    "712": "Venue",
    "713": "Venue",
}

OPS_CONTEXT_ID = "plan_d_ops_context"
OPS_CONTEXT_VERSION = "1.0.0"


def _domain_from_naics(naics3: str) -> str:
    return _NAICS_DOMAIN.get(str(naics3).strip()[:3], "Other_EFW")


def _share_dict(counts: dict[str, float]) -> dict[str, float]:
    total = sum(counts.values()) or 1.0
    return {k: round(v / total, 4) for k, v in sorted(counts.items(), key=lambda x: -x[1])}


def _summer_ym(year_month: str, summer_months: tuple[int, ...]) -> bool:
    try:
        month = int(year_month.split("-")[1])
    except (IndexError, ValueError):
        return False
    return month in summer_months


def build_ops_context(
    curated: Path,
    *,
    summer_months: tuple[int, ...] = (6, 7),
    brand_top_n: int = 5,
) -> dict[str, Any]:
    """
    Build per-host ops-scale pack from curated shortlist files.

    Window: all years present in curated CSVs, filtered to summer_months.
    Merged visit/spend markets are POI-split onto Dallas/Houston and LA/SF.
    """
    weights = poi_split_weights(curated)

    abs_energy: dict[str, float] = {c: 0.0 for c in HOST_CITIES}
    abs_water: dict[str, float] = {c: 0.0 for c in HOST_CITIES}
    abs_co2: dict[str, float] = {c: 0.0 for c in HOST_CITIES}
    abs_visits: dict[str, float] = {c: 0.0 for c in HOST_CITIES}
    month_rows: dict[str, float] = {c: 0.0 for c in HOST_CITIES}

    for r in _read_csv(curated / "footprint_estimates_market_monthly.csv"):
        if not _summer_ym(r["year_month"], summer_months):
            continue
        market = r["MARKET"]
        e, w, c, v = (
            _f(r, "est_energy_kwh"),
            _f(r, "est_water_liters"),
            _f(r, "est_kg_co2e"),
            _f(r, "total_visits"),
        )
        if market in MERGED_MARKETS:
            for city, wt in weights[market].items():
                abs_energy[city] += e * wt
                abs_water[city] += w * wt
                abs_co2[city] += c * wt
                abs_visits[city] += v * wt
                month_rows[city] += wt
        elif market in abs_energy:
            abs_energy[market] += e
            abs_water[market] += w
            abs_co2[market] += c
            abs_visits[market] += v
            month_rows[market] += 1.0

    # Visit mix from lifetime category totals (structure, not readiness)
    visit_domain: dict[str, dict[str, float]] = {
        c: defaultdict(float) for c in HOST_CITIES
    }
    for r in _read_csv(curated / "visits_efw_market_category_totals.csv"):
        market = r["MARKET"]
        domain = _domain_from_naics(r.get("NAICS3", ""))
        visits = _f(r, "total_visits")
        if market in MERGED_MARKETS:
            for city, wt in weights[market].items():
                visit_domain[city][domain] += visits * wt
        elif market in visit_domain:
            visit_domain[market][domain] += visits

    # Spend mix — summer months, by domain
    spend_domain: dict[str, dict[str, float]] = {
        c: defaultdict(float) for c in HOST_CITIES
    }
    spend_total: dict[str, float] = {c: 0.0 for c in HOST_CITIES}
    for r in _read_csv(curated / "spend_efw_domain_monthly.csv"):
        if not _summer_ym(r["year_month"], summer_months):
            continue
        market = r["MARKET"]
        domain = r.get("spend_domain") or "Other"
        amount = _f(r, "spend_amount")
        if market in MERGED_MARKETS:
            for city, wt in weights[market].items():
                spend_domain[city][domain] += amount * wt
                spend_total[city] += amount * wt
        elif market in spend_domain:
            spend_domain[market][domain] += amount
            spend_total[market] += amount

    # POI structure (already split markets)
    poi_layer: dict[str, dict[str, float]] = {
        c: defaultdict(float) for c in HOST_CITIES
    }
    for r in _read_csv(curated / "poi_efw_market_summary.csv"):
        city = r["MARKET"]
        if city in poi_layer:
            poi_layer[city][r["efw_layer"]] += _f(r, "poi_count")

    # Climate amplifiers (canonical hosts)
    cdd: dict[str, list[float]] = defaultdict(list)
    hdd: dict[str, list[float]] = defaultdict(list)
    temp: dict[str, list[float]] = defaultdict(list)
    for r in _read_csv(curated / "weather_host_monthly.csv"):
        if not _summer_ym(r["year_month"], summer_months):
            continue
        city = r["host_city_canonical"]
        if city not in abs_energy:
            continue
        cdd[city].append(_f(r, "sum_cdd_c"))
        hdd[city].append(_f(r, "sum_hdd_c"))
        temp[city].append(_f(r, "avg_temp_c"))

    # UHI mean
    uhi: dict[str, float] = {}
    uhi_path = curated / "uhi_market_summary.csv"
    if uhi_path.exists():
        for r in _read_csv(uhi_path):
            if r["MARKET"] in abs_energy:
                uhi[r["MARKET"]] = _f(r, "mean_uhi")

    # Top brands by summer visits (traffic storytelling)
    brand_visits: dict[str, dict[str, float]] = {
        c: defaultdict(float) for c in HOST_CITIES
    }
    brand_cat: dict[str, dict[str, str]] = {c: {} for c in HOST_CITIES}
    brand_path = curated / "visits_efw_brand_monthly_top25.csv"
    if brand_path.exists():
        for r in _read_csv(brand_path):
            if not _summer_ym(r["year_month"], summer_months):
                continue
            market = r["MARKET"]
            brand = (r.get("BRAND") or "").strip() or "(unbranded)"
            visits = _f(r, "total_visits")
            cat = r.get("CATEGORY") or ""
            if market in MERGED_MARKETS:
                for city, wt in weights[market].items():
                    brand_visits[city][brand] += visits * wt
                    brand_cat[city].setdefault(brand, cat)
            elif market in brand_visits:
                brand_visits[market][brand] += visits
                brand_cat[market].setdefault(brand, cat)

    cities_out: list[dict[str, Any]] = []
    for city in HOST_CITIES:
        top_brands = sorted(
            brand_visits[city].items(), key=lambda x: x[1], reverse=True
        )[:brand_top_n]
        mean = lambda xs: round(sum(xs) / len(xs), 3) if xs else 0.0  # noqa: E731
        cities_out.append(
            {
                "host_city": city,
                "absolute": {
                    "energy_kwh": round(abs_energy[city], 1),
                    "water_liters": round(abs_water[city], 1),
                    "kg_co2e": round(abs_co2[city], 1),
                    "visits": round(abs_visits[city], 1),
                    "summer_month_weight": round(month_rows[city], 3),
                    "unit": (
                        "city summer totals from store-visits × intensity_factors "
                        "(merged markets POI-split)"
                    ),
                },
                "visit_mix": _share_dict(dict(visit_domain[city])),
                "spend": {
                    "total": round(spend_total[city], 1),
                    "mix": _share_dict(dict(spend_domain[city])),
                    "unit": "summer brand spend (money intensity corroboration)",
                },
                "poi_structure": _share_dict(dict(poi_layer[city])),
                "climate": {
                    "mean_cdd_c": mean(cdd.get(city, [])),
                    "mean_hdd_c": mean(hdd.get(city, [])),
                    "mean_temp_c": mean(temp.get(city, [])),
                    "mean_uhi": round(uhi.get(city, 0.0), 3),
                },
                "top_brands_by_visits": [
                    {
                        "brand": b,
                        "category": brand_cat[city].get(b, ""),
                        "summer_visits": round(v, 1),
                    }
                    for b, v in top_brands
                ],
            }
        )

    by_city = {c["host_city"]: c for c in cities_out}
    return {
        "context_id": OPS_CONTEXT_ID,
        "context_version": OPS_CONTEXT_VERSION,
        "meta": {
            "role": "ops_scale",
            "not_used_in_readiness": True,
            "window": f"summer months={list(summer_months)} (all years in curated)",
            "grain_note": (
                "absolute = provisioning scale (store-visits totals); "
                "readiness uses per-shop rates from spend-patterns map tables"
            ),
            "sources": [
                "footprint_estimates_market_monthly.csv",
                "visits_efw_market_category_totals.csv",
                "visits_efw_brand_monthly_top25.csv",
                "spend_efw_domain_monthly.csv",
                "poi_efw_market_summary.csv",
                "weather_host_monthly.csv",
                "uhi_market_summary.csv",
                "market_crosswalk / POI split weights",
            ],
            "ui_slots": {
                "overview_kpis": "cities[].absolute → Energy/Water/CO₂e totals",
                "category_mix": "cities[].visit_mix",
                "spend_strip": "cities[].spend",
                "structure_card": "cities[].poi_structure",
                "climate_overlay": "cities[].climate",
                "brand_callouts": "cities[].top_brands_by_visits",
                "spatial_side_panel": "compact app/data/ops_context.json",
                "scenario_baseline": "cities[].absolute (+ category files for C)",
            },
            "allocation": weights,
        },
        "cities": cities_out,
        "indexes": {"by_city": {name: i for i, name in enumerate(HOST_CITIES)}},
        "_by_city": by_city,  # stripped before JSON write
    }


def compact_for_app(payload: dict[str, Any]) -> dict[str, Any]:
    """B side-panel grain: absolute load + mix + climate only."""
    cards = []
    for c in payload["cities"]:
        cards.append(
            {
                "c": c["host_city"],
                "e": c["absolute"]["energy_kwh"],
                "w": c["absolute"]["water_liters"],
                "co2": c["absolute"]["kg_co2e"],
                "v": c["absolute"]["visits"],
                "mix": c["visit_mix"],
                "spend": c["spend"]["total"],
                "cdd": c["climate"]["mean_cdd_c"],
                "uhi": c["climate"]["mean_uhi"],
                "brands": [b["brand"] for b in c["top_brands_by_visits"][:3]],
            }
        )
    return {
        "meta": {
            "role": "ops_scale",
            "not_used_in_readiness": True,
            "note": payload["meta"]["grain_note"],
            "version": OPS_CONTEXT_VERSION,
        },
        "cards": cards,
    }


def attach_play_absolute_deltas(
    plays: list[dict],
    absolute: dict[str, float],
) -> list[dict]:
    """
    Annotate play % effects with illustrative citywide absolute deltas.

    Uses summer absolute totals × expected_effects %. Does not change match_score.
    """
    out = []
    for p in plays:
        p2 = dict(p)
        eff = p.get("expected_effects") or {}
        p2["illustrative_absolute_delta"] = {
            "energy_kwh": round(
                absolute.get("energy_kwh", 0.0) * float(eff.get("energy_pct", 0)) / 100.0,
                1,
            ),
            "water_liters": round(
                absolute.get("water_liters", 0.0) * float(eff.get("water_pct", 0)) / 100.0,
                1,
            ),
            "kg_co2e": round(
                absolute.get("kg_co2e", 0.0)
                * float(eff.get("food_co2e_pct", 0))
                / 100.0,
                1,
            ),
            "basis": "summer city absolute totals × expected_effects %",
        }
        out.append(p2)
    return out


def public_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Drop internal indexes before writing JSON."""
    return {k: v for k, v in payload.items() if not k.startswith("_")}
