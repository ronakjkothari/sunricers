"""
Build the monthly Energy / Water / CO2e series the A shell's Overview tab charts.

The curated footprint table is keyed on the *merged* visit markets ("Dallas /
Houston", "Los Angeles / SF Bay Area"), so it only has 9 rows per month. Plan D
already solved that split with POI counts; this reuses the very same weights
(engines.playbook.loaders.poi_split_weights) so the chart and D's ops_scale can
never disagree about what a city is.

  energy/water/co2e/visits : footprint_estimates_market_monthly.csv, merged
                             markets allocated onto the 11 hosts by POI share
  cdd                      : weather_host_monthly.csv, already per host city

Writes app/data/overview_kpis.json (~90 KB). Reconciles its own June+July sums
against data/playbook/a_integration_v1.json ops_scale.absolute and fails if the
two grains have drifted apart. Runs in well under a second.
"""
import json, os, sys
from pathlib import Path

HERE = Path(os.path.dirname(os.path.abspath(__file__)))
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
from engines.playbook.loaders import (
    HOST_CITIES,
    MERGED_MARKETS,
    _f,
    _read_csv,
    poi_split_weights,
)

CURATED = ROOT / "data" / "curated"
APP = ROOT / "app" / "data"
CONTRACT = ROOT / "data" / "playbook" / "a_integration_v1.json"
SUMMER = (6, 7)
TOLERANCE = 0.005          # ops_scale is rounded to 1dp; 0.5% is a generous ceiling

SERIES = [("e", "est_energy_kwh"), ("w", "est_water_liters"),
          ("co2", "est_kg_co2e"), ("v", "total_visits")]


def main():
    weights = poi_split_weights(CURATED)

    # ---- footprints: merged markets -> 11 hosts -------------------------------
    rows = _read_csv(CURATED / "footprint_estimates_market_monthly.csv")
    months = sorted({r["year_month"] for r in rows})
    mi = {m: i for i, m in enumerate(months)}
    n = len(months)

    cities = {c: {k: [0.0] * n for k, _ in SERIES} for c in HOST_CITIES}
    for r in rows:
        market, i = r["MARKET"], mi[r["year_month"]]
        share = weights[market] if market in MERGED_MARKETS else {market: 1.0}
        for city, wt in share.items():
            if city not in cities:
                continue
            for key, col in SERIES:
                cities[city][key][i] += _f(r, col) * wt

    # ---- climate amplifier: already canonical host cities ---------------------
    for c in cities:
        cities[c]["cdd"] = [0.0] * n
    for r in _read_csv(CURATED / "weather_host_monthly.csv"):
        city, ym = r["host_city_canonical"], r["year_month"]
        if city in cities and ym in mi:
            cities[city]["cdd"][mi[ym]] += _f(r, "sum_cdd_c")

    payload = {
        "meta": {
            "role": "overview_series",
            "grain": "city x month absolute totals (provisioning scale, NOT readiness)",
            "unit": {
                "e": "kWh", "w": "litres", "co2": "kg CO2e",
                "v": "visits", "cdd": "cooling degree days (C)",
            },
            "sources": [
                "footprint_estimates_market_monthly.csv (visits x intensity_factors)",
                "weather_host_monthly.csv (sum_cdd_c)",
                "poi_efw_market_summary.csv (merged-market split weights)",
            ],
            "allocation": weights,
            "summer_months": list(SUMMER),
            "reconciles_with": "a_integration_v1.json scorecards[].ops_scale.absolute",
            "disclaimer": "Sample data are transformed (noise/jitter). Methodology demo, "
                          "not ground truth for any city.",
        },
        "months": months,
        "cities": {c: {k: [round(x, 1) for x in v] for k, v in s.items()}
                   for c, s in cities.items()},
    }

    APP.mkdir(parents=True, exist_ok=True)
    out = APP / "overview_kpis.json"
    out.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")

    print(f"wrote {out.relative_to(ROOT)}  "
          f"{len(HOST_CITIES)} cities x {n} months ({months[0]}..{months[-1]}), "
          f"{out.stat().st_size / 1024:.0f} KB")
    return reconcile(cities, months)


def reconcile(cities, months):
    """Summer sums here must match what D published as ops_scale.absolute."""
    if not CONTRACT.exists():
        print(f"\nSKIPPED reconciliation: {CONTRACT.relative_to(ROOT)} not found "
              f"(run: python -m engines.playbook.cli --source map --sync-app)")
        return 0

    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    absolute = {c["host_city"]: c["ops_scale"]["absolute"] for c in contract["scorecards"]}
    summer = [i for i, m in enumerate(months) if int(m.split("-")[1]) in SUMMER]
    pairs = [("e", "energy_kwh"), ("w", "water_liters"), ("co2", "kg_co2e"), ("v", "visits")]

    print(f"\nreconciliation vs ops_scale.absolute (Jun+Jul, {len(summer)} months):")
    worst, bad = 0.0, []
    for city in HOST_CITIES:
        drifts = []
        for key, field in pairs:
            mine = sum(cities[city][key][i] for i in summer)
            theirs = absolute[city][field]
            drift = abs(mine - theirs) / theirs if theirs else 0.0
            drifts.append(drift)
            if drift > TOLERANCE:
                bad.append(f"{city}.{field}: {mine:,.0f} vs {theirs:,.0f} ({drift:.2%})")
        top = max(drifts)
        worst = max(worst, top)
        print(f"  {'OK ' if top <= TOLERANCE else 'BAD'} {city:<24} max drift {top:.4%}")

    if bad:
        print("\nRECONCILIATION FAILED — Overview and D disagree on city totals:", file=sys.stderr)
        for b in bad:
            print(f"  - {b}", file=sys.stderr)
        return 2

    print(f"\nOK: all 11 hosts within {TOLERANCE:.1%} (worst {worst:.4%}). "
          f"Overview absolutes and D ops_scale agree.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
