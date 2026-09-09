"""Monte Carlo for the plant-forward concessions lever (id: plant_forward_concessions).

Run from repo root:  python3 interventions/plant_forward_concessions_mc.py
Reads app/data/places.json, months.json, sm/*.json, stadiums.json, matches.json and
data/curated/poi_efw.csv (only its PLACEKEY / TOP_CATEGORY / SUB_CATEGORY columns).
Every input range and its source is explained in interventions/plant_forward_concessions.md.
"""
import csv, json, math, os, random

random.seed(1)
ROOT = os.path.join(os.path.dirname(__file__), "..")
D = os.path.join(ROOT, "app", "data")
N = 100_000
tri = random.triangular  # (low, high, mode)

# ---- per-visit factors the map multiplies customers by (data/curated/intensity_factors.csv)
CO2_SPECTATOR = 2.5    # Spectator Sports, kg CO2e per visit ("concession + ops share")
CO2_AMUSEMENT = 1.8    # Other Amusement and Recreation Industries
CO2_RESTAURANT = 3.5   # Restaurants and Other Eating Places
WATER_SPECTATOR = 15.0 # litres per visit (on-site)
KWH_SPECTATOR = 4.0    # kWh per visit (on-site)

# ---- measured pieces (see the md for every source)
# S: share of all concession main items that move from meat to plant when the menu is made
#    plant-forward. Low = doubling vegetarian availability, weakest cafeteria (Garnett 2019 PNAS,
#    +7.8 pp). Mode = strongest availability result / pooled "decision structure" nudges
#    (Garnett +14.9 pp; Schaeufele-Elbers 2025 meta: up to 30% less meat on an ~80% meat base
#    = ~24 pp). High = plant-based DEFAULT at US catered events (Boronowsky 2022, +47 pp).
S_LO, S_MODE, S_HI = 0.08, 0.20, 0.47
# Dc: kg CO2e saved per swapped item. Low = chicken item -> plant item (Poore & Nemecek 2018
#    poultry 9.87 kg/kg x 113 g = 1.1, minus plant patty 0.4 = ~0.7; US chicken LCAs sit lower,
#    so 0.5). High = US quarter-pound beef patty -> plant patty (Heller & Keoleian 2018:
#    3.7 - 0.4 = 3.3; Boronowsky 2022 sandwiches 3.84 - 0.41 = 3.4). Mode = a mixed
#    beef/pork/chicken concession menu; no measured item mix exists, so 1.5 is a judgement.
DC_LO, DC_MODE, DC_HI = 0.5, 3.3, 1.5
# Dw: litres of upstream (farm + processing) freshwater saved per swapped item. Poore & Nemecek
#    withdrawals per kg: poultry 660, beef 1,451, tofu 149; x 113 g -> chicken swap 58 L, beef
#    swap 147 L; Heller & Keoleian scarcity-weighted beef 218 vs 1.1 L-eq. NOT on-site water.
DW_LO, DW_MODE, DW_HI = 50, 200, 100
# M: concession main items (meals) per venue visit. NO measured source; assumption, exposed
#    as a dial. 1.0 = every card customer buys one main item.
M_LO, M_MODE, M_HI = 0.5, 1.0, 0.8

cut_co2, cut_water = [], []
for _ in range(N):
    S = tri(S_LO, S_HI, S_MODE)
    Dc = tri(DC_LO, DC_HI, DC_MODE)
    Dw = tri(DW_LO, DW_HI, DW_MODE)
    M = tri(M_LO, M_HI, M_MODE)
    cut_co2.append(S * Dc * M)
    cut_water.append(S * Dw * M)
cut_co2.sort(); cut_water.sort()
q = lambda a, p: a[int(p * len(a))]
P = ((".1", .1), (".5", .5), (".9", .9))

print("Food CO2e saved per venue visit (10th / 50th / 90th percentile)")
print(f"  {q(cut_co2,.1):.2f} / {q(cut_co2,.5):.2f} / {q(cut_co2,.9):.2f} kg CO2e per visit")
print(f"  as % of the 2.5 kg Spectator Sports visit:   {q(cut_co2,.1)/CO2_SPECTATOR*100:.1f}% / {q(cut_co2,.5)/CO2_SPECTATOR*100:.1f}% / {q(cut_co2,.9)/CO2_SPECTATOR*100:.1f}%")
print(f"  as % of the 1.8 kg Other Amusement visit:    {q(cut_co2,.1)/CO2_AMUSEMENT*100:.1f}% / {q(cut_co2,.5)/CO2_AMUSEMENT*100:.1f}% / {q(cut_co2,.9)/CO2_AMUSEMENT*100:.1f}%")
print(f"  as % of the 3.5 kg Restaurant visit:         {q(cut_co2,.1)/CO2_RESTAURANT*100:.1f}% / {q(cut_co2,.5)/CO2_RESTAURANT*100:.1f}% / {q(cut_co2,.9)/CO2_RESTAURANT*100:.1f}%")
# per meal actually sold (M = 1), so people can scale by their own meals-per-fan guess
per_meal = sorted(tri(S_LO, S_HI, S_MODE) * tri(DC_LO, DC_HI, DC_MODE) for _ in range(N))
print(f"  per concession meal sold (no meals-per-visit guess): {q(per_meal,.1):.2f} / {q(per_meal,.5):.2f} / {q(per_meal,.9):.2f} kg CO2e")
print("Upstream farm water saved per venue visit (litres; NOT comparable to the 15 L on-site factor)")
print(f"  {q(cut_water,.1):.0f} / {q(cut_water,.5):.0f} / {q(cut_water,.9):.0f} L per visit  (on-site water: no measured change, 0%)")
print("Energy: on-site 0% (no measured change in cooking energy). Upstream only for beef swaps:")
print(f"  ceiling if every swapped item were a beef patty: {S_MODE*M_MODE*(11.4-6.1)/3.6:.2f} kWh per visit (Heller & Keoleian 2018, 11.4 vs 6.1 MJ). Chicken->plant may be zero or negative. Untested.")

# ---- blast radius on the map ------------------------------------------------------------
months = json.load(open(os.path.join(D, "months.json")))
j24 = months.index("2024-07")
places = json.load(open(os.path.join(D, "places.json")))
cust = {}
for f in os.listdir(os.path.join(D, "sm")):
    d = json.load(open(os.path.join(D, "sm", f)))
    for k, v in zip(d["keys"], d["v"]):
        cust[k] = v[j24]
csv.field_size_limit(10**9)
cat = {}
with open(os.path.join(ROOT, "data", "curated", "poi_efw.csv")) as f:
    for row in csv.DictReader(f):
        cat[row["PLACEKEY"]] = (row["TOP_CATEGORY"], row["SUB_CATEGORY"])
st = json.load(open(os.path.join(D, "stadiums.json")))
def km(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    h = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(d-b)/2)**2
    return 2*6371*math.asin(math.sqrt(h))
for p in places:
    p["d"] = min(km(p["y"], p["x"], s["y"], s["x"]) for s in st.values())
    p["cust"] = cust.get(p["k"], 0)
    p["cat"] = cat.get(p["k"], ("?", "?"))

def summ(label, rows):
    n = len(rows); c = sum(r["cust"] for r in rows)
    n2 = sum(1 for r in rows if r["d"] <= 2); c2 = sum(r["cust"] for r in rows if r["d"] <= 2)
    n5 = sum(1 for r in rows if r["d"] <= 5); c5 = sum(r["cust"] for r in rows if r["d"] <= 5)
    print(f"  {label:58s} {n:6d} shops {c:8.0f} July-2024 customers | <=2 km: {n2:4d} shops {c2:7.0f} cust | <=5 km: {n5:4d} shops {c5:7.0f} cust")
    return c

print("\nBlast radius on the map (July 2024 card customers; distance = nearest 2026 stadium)")
venue = [p for p in places if p["l"] == "Venue"]
c_venue = summ("Venue layer, all (what Ronak's engine would hit)", venue)
arena = [p for p in venue if p["cat"][0] in ("Spectator Sports", "Promoters of Performing Arts, Sports, and Similar Events")]
c_arena = summ("  of which Spectator Sports + event Promoters (arenas)", arena)
gyms = [p for p in venue if p["cat"][1] == "Fitness and Recreational Sports Centers"]
summ("  of which Fitness and Recreational Sports Centers", gyms)
mus = [p for p in venue if p["cat"][0] == "Museums, Historical Sites, and Similar Institutions"]
summ("  of which Museums, Historical Sites, zoos, parks", mus)
food = [p for p in places if p["l"] == "Food"]
c_food = summ("Food layer, all", food)
rest = [p for p in food if p["cat"][0] in ("Restaurants and Other Eating Places", "Special Food Services", "Food Services and Drinking Places")]
c_rest = summ("  of which Restaurants / eating places (meals)", rest)
groc = [p for p in food if p["cat"][0] in ("Grocery Stores", "Specialty Food Stores")]
c_groc = summ("  of which Grocery + Specialty Food Stores (baskets)", groc)
unk = [p for p in food if p["cat"][0] == "?"]
c_unk = summ("  of which not in poi_efw.csv (type unknown)", unk)
print(f"  share of Food-layer July-2024 customers that are restaurant/eating-place visits: {c_rest/c_food*100:.0f}% (grocery+specialty {c_groc/c_food*100:.0f}%, unknown {c_unk/c_food*100:.0f}%)")

print("\nThe 2026 stadiums themselves as they appear in spend-patterns-rice (July-2024 card customers):")
for p in sorted(venue, key=lambda r: r["d"])[:8]:
    print(f"  {p['n'][:32]:32s} {p['m']:22s} {p['d']:.1f} km  {p['cust']:.0f} customers  {p['cat'][0][:40]}")

def savings(label, c):
    print(f"  {label:58s} p10 {c*q(cut_co2,.1)/1000:8.1f} t | p50 {c*q(cut_co2,.5)/1000:8.1f} t | p90 {c*q(cut_co2,.9)/1000:8.1f} t CO2e")
print("\nJuly-2024 food CO2e saving if the lever were applied to that pile (tonnes)")
savings("Venue layer, all 1,801 shops", c_venue)
savings("Arena-like Venue shops only", c_arena)
c_rest2 = sum(r["cust"] for r in rest if r["d"] <= 2)
savings("Restaurants within 2 km of a stadium (whole month)", c_rest2)
savings("  same, only the +30% match-week extra spend", c_rest2 * 0.30)

# ---- off-map: the tournament itself, from matches.json attendance --------------------------
matches = json.load(open(os.path.join(D, "matches.json")))
att = sum(m["a"] for m in matches)
print(f"\nOff-map: the 78 US fixtures in matches.json hold {att:,} attendees in total.")
print("Tournament-long concession food CO2e saved (attendees x meals per fan x shift x kg per swap):")
for lab, p in P:
    print(f"  p{int(p*100):02d}: {att*q(cut_co2,p)/1000:,.0f} t CO2e   (upstream water {att*q(cut_water,p)/1e6:,.1f} million L)")
