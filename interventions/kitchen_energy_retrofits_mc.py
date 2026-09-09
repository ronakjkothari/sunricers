"""Monte Carlo for the commercial-kitchen energy-retrofit grant lever
(ENERGY STAR fryers / ovens / griddles / steamers / holding cabinets,
ENERGY STAR reach-in refrigeration and ice machines, demand-controlled
kitchen ventilation (DCKV) and LED lighting).

Run from repo root:  python3 interventions/kitchen_energy_retrofits_mc.py
Reads app/data/places.json, app/data/months.json, app/data/sm/*.json, app/data/stadiums.json.
Every input range and its source is explained in interventions/kitchen_energy_retrofits.md.

Model, as a share of a restaurant's total site energy (electricity + gas, both in kWh):
  cut = A * ( S_cook * R_cook                       # cookline swap
            + S_ref  * F_ref  * R_ref               # reach-in fridges/freezers, ice machines
            + S_vent * F_vent * R_dckv              # DCKV fan energy
            + S_hc   * F_mua  * R_mua               # DCKV: less make-up air to heat/cool (estimate grade)
            + S_light* F_nonled * R_led )           # LED where lights are not LED yet
  S_* = end-use share of restaurant site energy, CBECS 2018 Table E2 "Food service"
  A   = share of restaurants that still hold old kit AND take the grant (unmeasured slider,
        same unknown as kitchen_water_efficiency_mc.py)
The % of the 2.8 kWh restaurant visit in data/curated/intensity_factors.csv is taken equal to
the % of site energy (the 2.8 kWh is read as all fuels in kWh; see md).
Water: ENERGY STAR ice machines and connectionless steamers, as gallons per restaurant-day
over the same whole-restaurant water total used in kitchen_water_efficiency_mc.py.
Food CO2e: 0 (no mechanism, no evidence).
"""
import json, os, math, random, re

random.seed(1)
D = os.path.join(os.path.dirname(__file__), "..", "app", "data")
N = 100_000
GAL = 3.785
KWH_PER_VISIT = 2.8          # intensity_factors.csv, Restaurants and Other Eating Places
WATER_PER_VISIT_L = 25.0     # same file
WATER_PER_VISIT_GAL = WATER_PER_VISIT_L / GAL

tri = random.triangular  # (low, high, mode)
pct, pct_full, pct_elec, water_pct, gal_day = [], [], [], [], []
parts = {"cook": [], "ref": [], "dckv_fan": [], "dckv_mua": [], "led": []}
for _ in range(N):
    # --- end-use shares of restaurant site energy: CBECS 2018 Table E2, Food service, kBtu/sf of 263.3 ---
    S_cook  = tri(0.33, 0.48, 0.417)   # cooking 109.7 kBtu/sf = 41.7 %
    S_ref   = tri(0.12, 0.18, 0.154)   # refrigeration 40.6 = 15.4 %
    S_vent  = tri(0.04, 0.09, 0.063)   # ventilation 16.6 = 6.3 %
    S_hc    = tri(0.17, 0.24, 0.208)   # space heating 35.6 + cooling 19.1 = 20.8 %
    S_light = tri(0.03, 0.06, 0.041)   # lighting 10.8 = 4.1 %
    # --- measured / calculated savings per piece (see md, "How big is the cut") ---
    R_cook  = tri(0.08, 0.43, 0.22)    # share of cookline energy removed: 1 appliance (ENERGY STAR calc 10-17 % on ovens/griddles,
                                       #   Werewolf oven 1.76 of 22 therms = 8 %) / top 1-2 hogs (Versailles 4 fryers 10 of 43 therms = 23 %)
                                       #   / whole cookline (CEC-500-2021-021: Versailles 43 %, Werewolf 19 %, 6 sites pooled 35 %)
    F_ref   = tri(0.30, 0.70, 0.50)    # share of refrigeration energy in reach-ins + ice machines (not walk-ins): UNTESTED
    R_ref   = tri(0.08, 0.35, 0.25)    # ENERGY STAR CFS calculator: ice machines 8-15 %, reach-in fridges 27-29 %, freezers 27 %; calc, not field
    F_vent  = tri(0.50, 0.90, 0.70)    # share of ventilation electricity that is hood exhaust + make-up air fans: UNTESTED
    R_dckv  = tri(0.30, 0.62, 0.47)    # DCKV fan kWh saved: CEC 45 % and 49 % metered; PG&E hotel 57 %, charbroiler kitchen 37 %; WCEC 5 campuses avg 62 %
    F_mua   = tri(0.30, 0.60, 0.50)    # share of heating+cooling that is make-up air: Frontier "at least 50 %", no method
    R_mua   = tri(0.10, 0.30, 0.22)    # airflow cut: Versailles 11,200 -> 8,700 cfm = 22 %; ENERGY STAR DCKV profile hotel 30 %; estimate grade
    F_nonled= tri(0.10, 0.50, 0.30)    # share of lighting energy still non-LED in 2026: DOE LED adoption 30 % of units 2018, 47 % commercial 2020
    R_led   = tri(0.40, 0.75, 0.55)    # LED vs fluorescent ~40-50 %, vs incandescent/halogen 70-90 % (ENERGY STAR); technology-level, not restaurant field
    # --- the slider ---
    A       = tri(0.15, 0.60, 0.35)    # share of restaurants with old kit that the grant reaches; 2022 ENERGY STAR share of shipments:
                                       #   fryers 26 %, griddles 21 %, holding cabinets 12 %, ice 28 %, ovens 53 %, fridges 50 %
    cook = S_cook * R_cook
    ref  = S_ref * F_ref * R_ref
    fan  = S_vent * F_vent * R_dckv
    mua  = S_hc * F_mua * R_mua
    led  = S_light * F_nonled * R_led
    full = cook + ref + fan + mua + led          # a restaurant that actually gets the package
    pct_full.append(full)
    pct.append(A * full)
    for k, v in (("cook", cook), ("ref", ref), ("dckv_fan", fan), ("dckv_mua", mua), ("led", led)):
        parts[k].append(A * v)
    # electricity part of the saving: cooking is 39 % electric (CBECS E6 12.4 kWh/sf of 109.7 kBtu/sf), rest electric except make-up air heating
    elec = A * (cook * 0.39 + ref + fan + mua * 0.35 + led)
    pct_elec.append(elec)
    # --- water: ice machines and boiler steamers, gallons per restaurant-day ---
    T    = tri(936, 5800, 1766)        # whole-restaurant gal/day, same as kitchen_water_efficiency_mc.py
    ICE  = tri(0, 17, 10)              # ENERGY STAR calc: batch ice-making head 6,228 gal/yr (17/day), self-contained 4,933 (13.5), continuous 0
    STM  = tri(190, 300, 250)          # connectionless steamer: calc 70,000-104,000 gal/yr; CEC DoubleTree metered 317 -> <20 gal/day
    P_stm= tri(0.03, 0.20, 0.08)       # share of restaurants with a boiler-based steamer: UNTESTED
    g = A * (ICE + STM * P_stm)
    gal_day.append(g)
    water_pct.append(g / T)

for a in (pct, pct_full, pct_elec, water_pct, gal_day, *parts.values()): a.sort()
q = lambda a, p: a[int(p * len(a))]

print("Cut in restaurant site energy (electricity + gas), 10th / 50th / 90th percentile")
print(f"  restaurant that gets the package (slider = 1): {q(pct_full,.1)*100:.1f}% / {q(pct_full,.5)*100:.1f}% / {q(pct_full,.9)*100:.1f}%")
print(f"  averaged over all restaurants (slider 0.15/0.35/0.60): {q(pct,.1)*100:.1f}% / {q(pct,.5)*100:.1f}% / {q(pct,.9)*100:.1f}%")
print("  of which (median, averaged): " + ", ".join(f"{k} {q(v,.5)*100:.1f}%" for k, v in parts.items()))
print(f"  electricity part of the averaged cut: {q(pct_elec,.1)*100:.1f}% / {q(pct_elec,.5)*100:.1f}% / {q(pct_elec,.9)*100:.1f}% of site energy")
print("Cut per visit, as % of intensity_factors.csv restaurant visit (2.8 kWh, 25 L)")
for lab, p in (("p10", .1), ("p50", .5), ("p90", .9)):
    print(f"  {lab}: energy {q(pct,p)*100:.1f}% ({q(pct,p)*KWH_PER_VISIT:.3f} kWh), "
          f"water {q(water_pct,p)*100:.2f}% ({q(water_pct,p)*WATER_PER_VISIT_L:.2f} L; {q(gal_day,p):.1f} gal per restaurant-day), food CO2e 0%")

# Blast radius: Food layer, restaurants only (grocery/convenience/liquor names removed with the regex from kitchen_water_efficiency_mc.py)
months = json.load(open(os.path.join(D, "months.json")))
j24 = months.index("2024-07")
places = json.load(open(os.path.join(D, "places.json")))
food = {p["k"]: p for p in places if p["l"] == "Food"}
gro = re.compile(r"market|grocer|supermarket|deli\b|foods\b|liquor|wine|spirits|7-eleven|circle k|wawa|bodega|"
                 r"mart\b|convenience|bakery|meat|seafood|produce|aldi|safeway|publix|kroger|h-e-b|trader joe|"
                 r"whole foods|shoprite|key food|c town|costco|walmart|target|sprouts|smart & final|dollar", re.I)
rest = {k: p for k, p in food.items() if not (p["n"] and gro.search(p["n"]))}
cust = {}
for f in os.listdir(os.path.join(D, "sm")):
    d = json.load(open(os.path.join(D, "sm", f)))
    for k, v in zip(d["keys"], d["v"]):
        if k in food:
            cust[k] = v[j24]
tot_food = sum(cust.get(k, 0) for k in food)
tot = sum(cust.get(k, 0) for k in rest)
print(f"\nFood-layer shops on map: {len(food)} ({tot_food:.0f} July-2024 card customers); "
      f"treated as restaurants after the grocery-name regex: {len(rest)} shops, {tot:.0f} customers")
by = {}
for k, p in rest.items():
    by.setdefault(p["m"], [0, 0]); by[p["m"]][0] += 1; by[p["m"]][1] += cust.get(k, 0)
for m, (n, c) in sorted(by.items(), key=lambda x: -x[1][1]):
    print(f"  {m:24s} {n:5d} shops {c:8.0f} customers")
for lab, p in (("p10", .1), ("p50", .5), ("p90", .9)):
    print(f"  {lab}: July-2024 saving, restaurants = {tot*q(pct,p)*KWH_PER_VISIT:.0f} kWh (site energy), "
          f"{tot*q(water_pct,p)*WATER_PER_VISIT_L/1000:.0f} m3 water; all Food shops = {tot_food*q(pct,p)*KWH_PER_VISIT:.0f} kWh")

st = json.load(open(os.path.join(D, "stadiums.json")))
def km(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    h = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(d-b)/2)**2
    return 2*6371*math.asin(math.sqrt(h))
n2 = n5 = c2 = c5 = 0
for k, p in rest.items():
    dmin = min(km(p["y"], p["x"], s["y"], s["x"]) for s in st.values())
    if dmin <= 2: n2 += 1; c2 += cust.get(k, 0)
    if dmin <= 5: n5 += 1; c5 += cust.get(k, 0)
print(f"  restaurants within 2 km of a 2026 stadium: {n2} shops, {c2:.0f} customers; within 5 km: {n5} shops, {c5:.0f} customers "
      f"(the lever is a 'before' grant, not match-day scoped; shown for the map only)")
