"""Monte Carlo for the grocery fridge-door retrofit grant lever
(city/utility pays to put glass doors on open multi-deck refrigerated cases,
ideally with low-heat doors and LED case lighting).

Run from repo root:  python3 interventions/grocery_fridge_doors_mc.py
Reads app/data/places.json, app/data/months.json, app/data/sm/*.json, app/data/stadiums.json.
Every input range and its source is explained in interventions/grocery_fridge_doors.md.

Model, per store that takes the grant:
  % store kWh cut  = R * F * S
    R = refrigeration share of the store's electricity
    F = share of refrigeration electricity that goes to the open medium-temperature
        vertical cases (the ones that get doors) in a store that still has them
    S = fraction of those cases' electricity (compressor + fans + lights + door heaters)
        removed by the doors
  Cross-check: Lindberg et al. 2008 metered one whole Swedish supermarket before/after
  a door retrofit and found -6 % on the whole-store meter (winter, 3 weeks vs 3 weeks).
Portfolio view (all grocery-like shops on the map):
  % cut = R * F * S * O,  O = share of those shops that still have open cases and take
  the grant.  O has NO measurement behind it; it is a slider (see md).
Water: 0.  Food CO2e: 0 (doors do not change what is sold).
Per-visit cut is applied to intensity_factors.csv 'Grocery Stores' 1.2 kWh per visit.
"""
import json, os, math, random, re

random.seed(1)
D = os.path.join(os.path.dirname(__file__), "..", "app", "data")
N = 100_000
KWH_PER_GROCERY_VISIT = 1.2   # data/curated/intensity_factors.csv, Grocery Stores

tri = random.triangular  # (low, high, mode)
store_pct, portfolio_pct = [], []
for _ in range(N):
    # --- measured pieces (see md, "How big is the cut") ---
    R = tri(0.35, 0.55, 0.48)   # refrigeration share of store kWh: CBECS 2018 food sales 26/54 = 0.48; Westphalen 1996 / ORNL ~0.50;
                                # Michaels Energy 50 MN convenience stores 0.50; Lindberg 0.40-0.50; UK 0.35-0.50
    F = tri(0.40, 0.60, 0.54)   # open multi-deck MT cases' share of refrigeration load: ORNL/TM-2004/292: MT fixtures 70-75 % of
                                # load, open multi-deck ~3/4 of that = 0.53-0.56; range widened for stores with fewer open cases
    S = tri(0.23, 0.64, 0.36)   # fraction of those cases' kWh removed by doors: Fricke & Becker 2010 metered 2.21 -> 1.71 kWh/ft/day
                                # (-23 %, always-on door heaters, fluorescent); their no-heat-door + LED estimate 0.80 (-64 %);
                                # ORNL 2004 calibrated DOE-2: doors cut store refrigeration kWh 19.5 % = 0.195/0.54 = 0.36 of case share
    # --- untested share (no survey found; slider, see md) ---
    O = tri(0.30, 0.90, 0.60)   # share of grocery-like shops that still run open cases AND take the grant
    s = R * F * S
    store_pct.append(s)
    portfolio_pct.append(s * O)
store_pct.sort(); portfolio_pct.sort()
q = lambda a, p: a[int(p * len(a))]

print("Cut in a store that takes the grant, as % of its total electricity (10th / 50th / 90th percentile)")
print(f"  energy {q(store_pct,.1)*100:.1f}% / {q(store_pct,.5)*100:.1f}% / {q(store_pct,.9)*100:.1f}%   (water 0%, food CO2e 0%)")
print("Per visit, against intensity_factors.csv Grocery Stores 1.2 kWh")
for lab, p in (("p10", .1), ("p50", .5), ("p90", .9)):
    print(f"  {lab}: {q(store_pct,p)*KWH_PER_GROCERY_VISIT:.3f} kWh per visit ({q(store_pct,p)*100:.1f}%)")
print("Portfolio view, every grocery-like shop on the map, with the 'still open and takes the grant' slider O")
print(f"  energy {q(portfolio_pct,.1)*100:.1f}% / {q(portfolio_pct,.5)*100:.1f}% / {q(portfolio_pct,.9)*100:.1f}%")
print("Cross-check: Lindberg et al. 2008, one metered supermarket, whole-store meter after door retrofit: -6 %")

# Blast radius: Food-layer shops whose name looks like grocery / convenience / liquor
# (same regex as kitchen_water_efficiency_mc.py; places.json has no NAICS)
months = json.load(open(os.path.join(D, "months.json")))
j24 = months.index("2024-07")
places = json.load(open(os.path.join(D, "places.json")))
gro = re.compile(r"market|grocer|supermarket|deli\b|foods\b|liquor|wine|spirits|7-eleven|circle k|wawa|bodega|"
                 r"mart\b|convenience|bakery|meat|seafood|produce|aldi|safeway|publix|kroger|h-e-b|trader joe|"
                 r"whole foods|shoprite|key food|c town|costco|walmart|target|sprouts|smart & final|dollar", re.I)
food = {p["k"]: p for p in places if p["l"] == "Food"}
shops = {k: p for k, p in food.items() if p["n"] and gro.search(p["n"])}
cust = {}
for f in os.listdir(os.path.join(D, "sm")):
    d = json.load(open(os.path.join(D, "sm", f)))
    for k, v in zip(d["keys"], d["v"]):
        if k in shops:
            cust[k] = v[j24]
tot = sum(cust.values())
print(f"\nFood-layer shops on map: {len(food)}; of which grocery/convenience/liquor by name regex: {len(shops)}, "
      f"July-2024 card customers: {tot:.0f}")
by = {}
for k, p in shops.items():
    by.setdefault(p["m"], [0, 0]); by[p["m"]][0] += 1; by[p["m"]][1] += cust.get(k, 0)
for m, (n, c) in sorted(by.items(), key=lambda x: -x[1][1]):
    print(f"  {m:24s} {n:5d} shops {c:8.0f} customers")
print("  July-2024 saving if EVERY one of these shops took the grant (store-level %):")
for lab, p in (("p10", .1), ("p50", .5), ("p90", .9)):
    print(f"    {lab}: {tot*q(store_pct,p)*KWH_PER_GROCERY_VISIT:.0f} kWh")
print("  July-2024 saving with the slider O applied (portfolio %):")
for lab, p in (("p10", .1), ("p50", .5), ("p90", .9)):
    print(f"    {lab}: {tot*q(portfolio_pct,p)*KWH_PER_GROCERY_VISIT:.0f} kWh")

st = json.load(open(os.path.join(D, "stadiums.json")))
def km(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    h = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(d-b)/2)**2
    return 2*6371*math.asin(math.sqrt(h))
n2 = n5 = c2 = c5 = 0
for k, p in shops.items():
    dmin = min(km(p["y"], p["x"], s["y"], s["x"]) for s in st.values())
    if dmin <= 2: n2 += 1; c2 += cust.get(k, 0)
    if dmin <= 5: n5 += 1; c5 += cust.get(k, 0)
print(f"  within 2 km of a 2026 stadium: {n2} shops, {c2:.0f} customers; within 5 km: {n5} shops, {c5:.0f} customers")
print("  (bucket 'before': the lever is citywide and year-round; the stadium rings are for context only)")
