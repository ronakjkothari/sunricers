"""
Rebuild the eleven "readiness" scorecards from our own per-shop data.

Same scoring method as the team's Plan D engine (engines/playbook: z-scores ->
weighted stress -> inverted, min-max 0-100, +/-15 band, nearest peers, rule-
matched plays), but fed with per-shop RATES from spend-patterns-rice instead of
city TOTALS from the store-visits-based curated package. Rates stop city size
from driving the rank.

Indicators, per city, June + July of 2022-2024:
  energy_kwh, kg_co2e, water_liters : per trading shop-month, from that month's
                                      card customers x intensity factor for the
                                      shop's type (same factors as the map page)
  cdd                               : mean summer-month cooling degree days,
                                      data/curated/weather_host_monthly.csv
                                      (built from daily-weather-rice, unaffected
                                      by the store-visits problems)
  uhi                               : median heat index of the city's shops

Reads app/data/{places,months}.json and app/data/sm/*.json (the map's own
files). Writes app/data/scorecards.json. Runs in a couple of seconds.
"""
import csv, json, os, statistics, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
APP  = os.path.join(ROOT, "app", "data")
sys.path.insert(0, ROOT)
from engines.playbook.config import PlaybookConfig
from engines.playbook.scoring import compute_scorecards
from engines.playbook.peers import attach_peers
from engines.playbook.plays import attach_plays

FACTORS = {"Food":(2.8,25,3.5), "Energy":(45,1.5,12), "Water":(28,300,2), "Venue":(4,15,2.5), "Other_EFW":(3,12,1.8)}
YEARS, SUMMER = {"2022","2023","2024"}, {"06","07"}

def main():
    places = json.load(open(f"{APP}/places.json"))
    months = json.load(open(f"{APP}/months.json"))
    mi = [i for i, m in enumerate(months) if m[:4] in YEARS and m[5:] in SUMMER]
    cities = sorted({p["m"] for p in places})

    ind = {}
    for c in cities:
        sm = json.load(open(f"{APP}/sm/{c.replace('/', '_')}.json"))
        idx = {k: i for i, k in enumerate(sm["keys"])}
        kwh = water = co2 = 0.0; shop_months = 0; uhis = []
        for p in places:
            if p["m"] != c: continue
            if p.get("u") is not None: uhis.append(p["u"])
            row = sm["v"][idx[p["k"]]] if p["k"] in idx else None
            if row is None: continue
            fk, fw, fc = FACTORS.get(p["l"], FACTORS["Other_EFW"])
            for i in mi:
                v = row[i] or 0
                if v <= 0: continue
                shop_months += 1; kwh += v*fk; water += v*fw; co2 += v*fc
        ind[c] = {"energy_kwh": kwh/shop_months, "water_liters": water/shop_months, "kg_co2e": co2/shop_months,
                  "uhi": statistics.median(uhis) if uhis else 0.0, "shop_months": shop_months,
                  "shops": sum(1 for p in places if p["m"] == c)}

    cdd = defaultdict(list)
    for r in csv.DictReader(open(os.path.join(ROOT, "data", "curated", "weather_host_monthly.csv"))):
        y, m = r["year_month"].split("-")
        if y in YEARS and m in SUMMER: cdd[r["host_city_canonical"]].append(float(r["sum_cdd_c"]))
    for c in cities: ind[c]["cdd"] = statistics.fmean(cdd[c]) if cdd[c] else 0.0

    cfg = PlaybookConfig()
    cards = attach_plays(attach_peers(compute_scorecards(ind, cfg), cfg), cfg)

    out = []
    for s in cards:
        plays = []
        for p in s.recommended_plays:
            why = p["rationale"]
            if p["match_score"] <= 0:   # his template says "elevated" even when z is negative — say what is true
                why = f"{s.host_city} sits at or below the host average on what this play targets; listed as a general option, not a pressing one."
            plays.append({"t": p["title"], "e": p["expected_effects"], "why": why})
        out.append({"c": s.host_city, "rank": s.rank, "score": round(s.readiness_score, 1),
                    "band": [round(s.readiness_band[0], 1), round(s.readiness_band[1], 1)],
                    "z": {k: round(v, 2) for k, v in s.z_components.items()},
                    "raw": {k: round(v, 3) for k, v in s.raw.items()},
                    "peers": s.peer_cities, "plays": plays})
    meta = {"source": "per-shop summer rates from spend-patterns-rice (Jun+Jul 2022-2024), CDD from daily-weather-rice",
            "method": "engines/playbook scoring: 0.35 z(energy) + 0.25 z(co2e) + 0.20 z(water) + 0.10 z(cdd) + 0.10 z(uhi); readiness = inverted stress, min-max 0-100, band +/-15",
            "unit": "energy/water/co2 are per trading shop-month, so city size does not drive the rank"}
    json.dump({"meta": meta, "cards": out}, open(f"{APP}/scorecards.json", "w"), separators=(",", ":"))

    print(f"{'rank':>4} {'city':24s} {'score':>6} {'kWh/shop-mo':>12} {'L/shop-mo':>10} {'CDD':>7} {'UHI':>5}  peers")
    for s in cards:
        r = s.raw
        print(f"{s.rank:>4} {s.host_city:24s} {s.readiness_score:6.1f} {r['energy_kwh']:12.0f} {r['water_liters']:10.0f} {r['cdd']:7.0f} {r['uhi']:5.1f}  {', '.join(s.peer_cities)}")

if __name__ == "__main__":
    main()
