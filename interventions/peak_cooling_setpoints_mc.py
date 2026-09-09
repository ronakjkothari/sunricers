"""Monte Carlo for the event-week cooling setpoint (+1 to +2 C) and pre-cooling lever.

Run from repo root:  python3 interventions/peak_cooling_setpoints_mc.py
Reads app/data/places.json, app/data/months.json, app/data/sm/*.json, app/data/stadiums.json.
Every input range and its source is explained in interventions/peak_cooling_setpoints.md.

Formula, per shop and per visit:
  energy cut  = (cooling share of the shop's July energy) x (setpoint rise in C x cooling energy saved per C  +  pre-cooling penalty)
  water cut   = (cooling-and-heating share of the shop's water) x (share of that which is cooling-tower make-up) x (same cooling cut)
Only the setpoint rise saves energy. Pre-cooling moves energy from the afternoon to the morning; the field tests
say the day's total is about the same, so it enters only as a small +/- noise term.
"""
import json, os, math, random

random.seed(1)
D = os.path.join(os.path.dirname(__file__), "..", "app", "data")
N = 100_000
tri = random.triangular  # (low, high, mode)

# kWh and litres per visit from data/curated/intensity_factors.csv (team's hand-set factors)
FACT = {  # layer: (kWh per visit, L per visit)
    "Food":  (2.8, 25.0),     # Restaurants and Other Eating Places (grocery is 1.2 kWh / 8 L, see md)
    "Water": (28.0, 300.0),   # Traveler Accommodation
    "Venue": (None, None),    # Spectator Sports 4.0 kWh/15 L, Amusement 3.0 kWh/12 L: drawn below
}

# Cooling's share of a shop's total July energy (electricity + gas). DOE reference buildings, TMY3 weather,
# hourly output on OpenEI (Houston, Miami, Seattle) and CBECS 2018 Table E1 for venues. See md.
COOL_SHARE = {
    "Food":  (0.02, 0.21, 0.15),   # Seattle full-service 2%, Houston quick-service 14%, Houston/Miami full-service 20%
    "Water": (0.15, 0.34, 0.28),   # Seattle large hotel 18%, Houston large 28%, Miami large 29%, Houston small 34%
    "Venue": (0.05, 0.40, 0.20),   # CBECS public assembly: 16.5% of annual major fuel; open-air stadiums lower, arenas in July higher. UNTESTED for venues.
}
WATER_HC_SHARE = {"Food": 0.01, "Water": 0.12, "Venue": None}  # EPA WaterSense "cooling and heating" slice of facility water

def draw_cut(layer):
    dT   = tri(1.0, 2.0, 1.5)      # setpoint rise in C: the dial (1-2 C per the lever definition)
    s    = tri(0.05, 0.15, 0.09)   # fraction of cooling energy saved per C: Ghahramani 2016 (7.7-8.4% HVAC per C, hot climates),
                                   #   Hoyt 2015 (13% HVAC for +1.1 C, 29% cooling for +2.8 C), UGA measured (13-16%/C chilled water); low is judgment
    pc   = tri(-0.03, 0.03, 0.0)   # pre-cooling: fraction of cooling energy saved (+) or added (-); Xu et al 2009 measured -3.1% .. +small
    cool = min(dT * s + pc, 0.6)   # fraction of the shop's cooling energy avoided
    share = tri(*COOL_SHARE[layer])
    e_cut = share * cool           # fraction of the shop's July energy avoided
    if layer == "Water":
        tower = tri(0.5, 1.0, 0.8) # share of the 12% "cooling and heating" water that is cooling-tower make-up (untested split)
        w_cut = WATER_HC_SHARE[layer] * tower * cool
    elif layer == "Food":
        w_cut = WATER_HC_SHARE[layer] * tri(0.0, 1.0, 0.5) * cool   # 1% slice, mostly boiler in restaurants; effectively zero
    else:
        w_cut = 0.0                # venues: no measured cooling-tower share; untested, reported as 0
    if layer == "Venue":
        kwh = tri(3.0, 4.0, 3.5); lit = tri(12.0, 15.0, 13.5)
    else:
        kwh, lit = FACT[layer]
    return e_cut, w_cut, kwh, lit

q = lambda a, p: a[int(p * len(a))]
res = {}
for layer in ("Food", "Water", "Venue"):
    E, W, EK, WL = [], [], [], []
    for _ in range(N):
        e, w, kwh, lit = draw_cut(layer)
        E.append(e); W.append(w); EK.append(e * kwh); WL.append(w * lit)
    for a in (E, W, EK, WL): a.sort()
    res[layer] = (E, W, EK, WL)
    print(f"{layer:6s} energy cut per visit  p10/p50/p90 = {q(E,.1)*100:.1f}% / {q(E,.5)*100:.1f}% / {q(E,.9)*100:.1f}%"
          f"   ({q(EK,.1):.3f} / {q(EK,.5):.3f} / {q(EK,.9):.3f} kWh)")
    print(f"{'':6s} water  cut per visit  p10/p50/p90 = {q(W,.1)*100:.2f}% / {q(W,.5)*100:.2f}% / {q(W,.9)*100:.2f}%"
          f"   ({q(WL,.1):.2f} / {q(WL,.5):.2f} / {q(WL,.9):.2f} L)")

# ---- blast radius on the map -------------------------------------------------------------
months = json.load(open(os.path.join(D, "months.json")))
j24 = months.index("2024-07")
places = json.load(open(os.path.join(D, "places.json")))
LAYERS = ("Food", "Water", "Venue")
sel = {p["k"]: p for p in places if p["l"] in LAYERS}
cust = {}
for f in os.listdir(os.path.join(D, "sm")):
    d = json.load(open(os.path.join(D, "sm", f)))
    for k, v in zip(d["keys"], d["v"]):
        if k in sel:
            cust[k] = v[j24]

st = json.load(open(os.path.join(D, "stadiums.json")))
def km(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    h = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(d-b)/2)**2
    return 2*6371*math.asin(math.sqrt(h))
dmin = {k: min(km(p["y"], p["x"], s["y"], s["x"]) for s in st.values()) for k, p in sel.items()}

print("\nBlast radius, July 2024 card customers")
tot = {}
for L in LAYERS:
    ks = [k for k, p in sel.items() if p["l"] == L]
    n = len(ks); c = sum(cust.get(k, 0) for k in ks)
    n2 = sum(1 for k in ks if dmin[k] <= 2); c2 = sum(cust.get(k, 0) for k in ks if dmin[k] <= 2)
    n5 = sum(1 for k in ks if dmin[k] <= 5); c5 = sum(cust.get(k, 0) for k in ks if dmin[k] <= 5)
    tot[L] = (c, c2, c5)
    print(f"  {L:6s} {n:6d} shops {c:9d} customers | within 2 km of a 2026 stadium: {n2:4d} shops {c2:7d} cust | within 5 km: {n5:4d} shops {c5:7d} cust")
by = {}
for k, p in sel.items():
    by.setdefault(p["m"], [0, 0]); by[p["m"]][0] += 1; by[p["m"]][1] += cust.get(k, 0)
for m, (n, c) in sorted(by.items(), key=lambda x: -x[1][1]):
    print(f"    {m:24s} {n:5d} shops {c:8d} customers")

print("\nJuly-2024 saving if every one of these shops ran the protocol all month (p10 / p50 / p90)")
for lab, p in (("p10", .1), ("p50", .5), ("p90", .9)):
    kwh = sum(tot[L][0] * q(res[L][2], p) for L in LAYERS)
    m3  = sum(tot[L][0] * q(res[L][3], p) for L in LAYERS) / 1000
    kwh2 = sum(tot[L][1] * q(res[L][2], p) for L in LAYERS)
    kwh5 = sum(tot[L][2] * q(res[L][2], p) for L in LAYERS)
    print(f"  {lab}: all 11 cities {kwh:,.0f} kWh and {m3:,.1f} m3 water for the month, i.e. {kwh*7/31:,.0f} kWh per event week;"
          f" shops within 2 km of a stadium {kwh2:,.0f} kWh/month, within 5 km {kwh5:,.0f} kWh/month")
for L in LAYERS:
    print(f"    {L:6s} p50 July saving all cities: {tot[L][0]*q(res[L][2],.5):,.0f} kWh, {tot[L][0]*q(res[L][3],.5)/1000:,.1f} m3")
