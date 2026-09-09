"""Monte Carlo for the commercial-kitchen water-efficiency retrofit lever
(pre-rinse spray valves, ENERGY STAR dish machines, ice machines, faucet aerators).

Run from repo root:  python3 interventions/kitchen_water_efficiency_mc.py
Reads app/data/places.json, app/data/months.json, app/data/sm/*.json, app/data/stadiums.json.
Every input range and its source is explained in interventions/kitchen_water_efficiency.md.

Model, per average Food-layer restaurant per open day:
  gallons saved = O*1.5*PRSV + M*DM + ICE + AER
  kWh saved     = O*1.5*PRSV*E_hot + M*DM_E + AER*E_hot*0.5
  % water cut   = gallons saved / T          (T = total restaurant water per day)
  % energy cut  = kWh saved / (T/6.6 gal per visit * 2.8 kWh per visit)
The 6.6 gal (25 L) and 2.8 kWh per visit are the team's hand-set factors in
data/curated/intensity_factors.csv ('Restaurants and Other Eating Places').
Food CO2e is not modelled: swapping a spray valve does not change what food is bought.
"""
import json, os, math, random

random.seed(1)
D = os.path.join(os.path.dirname(__file__), "..", "app", "data")
N = 100_000
GAL = 3.785
WATER_PER_VISIT_L = 25.0   # intensity_factors.csv, Restaurants and Other Eating Places
KWH_PER_VISIT = 2.8        # same file
WATER_PER_VISIT_GAL = WATER_PER_VISIT_L / GAL

tri = random.triangular  # (low, high, mode)
water_pct, energy_pct, gal_day, kwh_day = [], [], [], []
for _ in range(N):
    # --- measured pieces (see md, "How big is the cut") ---
    T    = tri(936, 5800, 1766)     # gal/day whole-restaurant water: FSTC monitored cafe 936; Kansas 221 casual-dining bills 1,766; FSTC 3 Bay Area sites 5,800
    PRSV = tri(17.6, 49, 19.3)      # gal/day saved per spray valve swapped: MA/RI 39 metered sites 6,410 gal/yr; EPA calc 7,045 gal/yr; Waterloo 10 metered sites 185 L/day
    E_hot= tri(0.24, 0.52, 0.30)    # kWh per gallon of hot water not heated: WaterSense 0.24 kWh (electric) / 0.275 kWh gas; MA measured 114 therms per 6,410 gal = 0.52
    DM   = tri(15, 204, 112)        # gal/day saved per dish machine replaced: FSTC monitored cafe 5,500 gal/yr; DOE/ENERGY STAR door-type calc 1.29->0.89 gal/rack x 280 racks; FSTC Bridges case 2.0->0.77 x 166 racks
    DM_E = tri(4, 39, 20)           # kWh/day saved per dish machine replaced: cafe gallons x E_hot; DOE table 5,570 kWh + 294 therms per year
    ICE  = tri(0, 15, 5)            # gal/day, ENERGY STAR ice machine: FSTC monitored cafe 5,500 gal/yr; EPA 'at least 10 %'; 0 if already efficient/air-cooled
    AER  = tri(3, 30, 10)           # gal/day, hand/prep sink aerators: calc only (AWE 3.2->0.5 gpm x 20 min = 54 gal/day is a ceiling; FSTC cafe hand sinks total 12 gal/day)
    # --- untested shares (no measurement found; treat as dials, see md) ---
    O    = tri(0.15, 0.60, 0.35)    # share of restaurants still holding a pre-2019 (>1.28 gpm) spray valve
    M    = tri(0.30, 0.80, 0.50)    # share of restaurants with a dish machine old enough to be worth replacing
    g = O * 1.5 * PRSV + M * DM + ICE + AER
    e = O * 1.5 * PRSV * E_hot + M * DM_E + AER * E_hot * 0.5
    visits = T / WATER_PER_VISIT_GAL
    gal_day.append(g); kwh_day.append(e)
    water_pct.append(g / T)
    energy_pct.append(e / (visits * KWH_PER_VISIT))
for a in (water_pct, energy_pct, gal_day, kwh_day): a.sort()
q = lambda a, p: a[int(p * len(a))]

print("Saved per average restaurant per open day (10th / 50th / 90th percentile)")
print(f"  water  {q(gal_day,.1):.0f} / {q(gal_day,.5):.0f} / {q(gal_day,.9):.0f} gal  "
      f"({q(gal_day,.1)*GAL:.0f} / {q(gal_day,.5)*GAL:.0f} / {q(gal_day,.9)*GAL:.0f} L)")
print(f"  energy {q(kwh_day,.1):.1f} / {q(kwh_day,.5):.1f} / {q(kwh_day,.9):.1f} kWh")
print("Cut per visit, as % of intensity_factors.csv restaurant visit (25 L, 2.8 kWh)")
for lab, p in (("p10", .1), ("p50", .5), ("p90", .9)):
    print(f"  {lab}: water {q(water_pct,p)*100:.1f}% ({q(water_pct,p)*WATER_PER_VISIT_L:.2f} L), "
          f"energy {q(energy_pct,p)*100:.1f}% ({q(energy_pct,p)*KWH_PER_VISIT:.3f} kWh), food CO2e 0%")

# Blast radius: the whole Food layer (restaurants, grocery, specialty food are not separable in places.json)
months = json.load(open(os.path.join(D, "months.json")))
j24 = months.index("2024-07")
places = json.load(open(os.path.join(D, "places.json")))
food = {p["k"]: p for p in places if p["l"] == "Food"}
cust = {}
for f in os.listdir(os.path.join(D, "sm")):
    d = json.load(open(os.path.join(D, "sm", f)))
    for k, v in zip(d["keys"], d["v"]):
        if k in food:
            cust[k] = v[j24]
tot = sum(cust.values())
print(f"\nFood-layer shops on map: {len(food)}, July-2024 card customers: {tot:.0f}")
by = {}
for k, p in food.items():
    by.setdefault(p["m"], [0, 0]); by[p["m"]][0] += 1; by[p["m"]][1] += cust.get(k, 0)
for m, (n, c) in sorted(by.items(), key=lambda x: -x[1][1]):
    print(f"  {m:24s} {n:5d} shops {c:8.0f} customers")
# rough name-based split: names that look like grocery / convenience / liquor stores
import re
gro = re.compile(r"market|grocer|supermarket|deli\b|foods\b|liquor|wine|spirits|7-eleven|circle k|wawa|bodega|"
                 r"mart\b|convenience|bakery|meat|seafood|produce|aldi|safeway|publix|kroger|h-e-b|trader joe|"
                 r"whole foods|shoprite|key food|c town|costco|walmart|target|sprouts|smart & final|dollar", re.I)
gk = [k for k, p in food.items() if p["n"] and gro.search(p["n"])]
gc = sum(cust.get(k, 0) for k in gk)
print(f"  of which names that look like grocery/convenience/liquor (rough regex): {len(gk)} shops, {gc:.0f} customers")
print(f"  rest, treated as restaurants: {len(food)-len(gk)} shops, {tot-gc:.0f} customers")
for lab, p in (("p10", .1), ("p50", .5), ("p90", .9)):
    print(f"  {lab}: July-2024 saving, all Food shops = {tot*q(water_pct,p)*WATER_PER_VISIT_L/1000:.0f} m3 water, "
          f"{tot*q(energy_pct,p)*KWH_PER_VISIT:.0f} kWh; restaurants-only (name split) = "
          f"{(tot-gc)*q(water_pct,p)*WATER_PER_VISIT_L/1000:.0f} m3, {(tot-gc)*q(energy_pct,p)*KWH_PER_VISIT:.0f} kWh")

st = json.load(open(os.path.join(D, "stadiums.json")))
def km(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    h = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(d-b)/2)**2
    return 2*6371*math.asin(math.sqrt(h))
n2 = n5 = c2 = c5 = 0
for k, p in food.items():
    dmin = min(km(p["y"], p["x"], s["y"], s["x"]) for s in st.values())
    if dmin <= 2: n2 += 1; c2 += cust.get(k, 0)
    if dmin <= 5: n5 += 1; c5 += cust.get(k, 0)
print(f"  within 2 km of a 2026 stadium: {n2} shops, {c2:.0f} customers; within 5 km: {n5} shops, {c5:.0f} customers")
