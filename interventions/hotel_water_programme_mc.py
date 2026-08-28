"""Monte Carlo for the merged hotel water programme lever:
  part A  towel and linen reuse (less laundry)
  part B  guest-room shower, tap and toilet retrofits (less bathroom water)
The two parts touch different water (laundry vs bathroom) so they add.

Run from repo root:  python3 interventions/hotel_water_programme_mc.py
Reads app/data/places.json, app/data/months.json, app/data/sm/*.json, app/data/stadiums.json.
Every input range and its source is explained in interventions/hotel_water_programme.md.
"""
import json, os, math, random

random.seed(1)
D = os.path.join(os.path.dirname(__file__), "..", "app", "data")
N = 100_000
GAL = 3.785                    # litres per US gallon
GUESTS_PER_ROOM = 1.4          # Accor (2010) assumption quoted by JRC
WATER_PER_LODGING_VISIT = 300  # data/curated/intensity_factors.csv, Traveler Accommodation
KWH_PER_LODGING_VISIT = 28     # same file

# ---------------- part A: towel and linen reuse ----------------
tri = random.triangular  # (low, high, mode)
water_l, energy_l = [], []
for _ in range(N):
    P  = tri(0.30, 0.49, 0.38)   # share of occupied room-nights where guests reuse
    V  = tri(2.3, 5.4, 4.0)      # kg laundry per occupied room-night
    Cw = tri(5.0, 20.0, 9.6)     # litres of water per kg laundry
    Ce = tri(0.9, 2.9, 1.5)      # kWh per kg laundry (wash + dry + finish)
    water_l.append(P * V * Cw)
    energy_l.append(P * V * Ce)
q = lambda a, p: a[int(p * len(a))]


# ---------------- part B: shower, tap and toilet retrofits ----------------
water_f, energy_f = [], []
w_std, w_old = [], []    # per room-night, for the two starting states, to report separately
for _ in range(N):
    # --- how much the fixtures are used per occupied room-night (measured, US hotels) ---
    shower_min = tri(8.0, 16.0, 12.0)   # Seattle 2002 logged 12 min/room (West Coast Grand), 13 est. (Westin); REUWS 7.8-8.2 min/shower x 1.4 guests
    flushes    = tri(4.0, 9.0, 7.0)     # Seattle 2002 logged 7 flushes/room; REUWS 5.0/person/day x 1.4; JRC assumes 5/guest-night
    faucet_min = tri(1.0, 6.0, 2.5)     # Seattle 2002 logged ~1 min/room; JRC assumes 6 min/guest-night incl. cleaning

    # --- what the new fittings flow at (WaterSense spec / what utilities actually installed) ---
    new_gpm_shower = tri(1.5, 2.0, 1.75)  # WaterSense max 2.0; SAWS required <1.75; Hilton Palacio 1.5
    new_gpf        = tri(0.9, 1.28, 1.28) # WaterSense HET max 1.28; SAWS installed 1.1 and 1.28/0.8 dual
    new_gpm_faucet = tri(1.0, 1.5, 1.5)   # WaterSense private-lavatory max 1.5; SAWS installed 1.5

    # --- field corrections ---
    insitu   = tri(0.80, 1.00, 0.90)  # rated vs measured flow: LBNL 2006 throttling 0.9 (2.5 rated -> 2.2 measured)
    rebound  = tri(0.85, 1.00, 0.96)  # longer showers after a swap: REUWS/EBMUD/Tampa found little or none

    # --- what the room had before (the untested slider) ---
    p_old  = tri(0.02, 0.25, 0.08)    # share of rooms still on pre-1994 fittings (3.5 gpm / 3.5 gpf / 3.0 gpm)
    p_done = tri(0.20, 0.60, 0.40)    # share already at WaterSense level: retrofit changes nothing
    p_std  = max(0.0, 1.0 - p_old - p_done)  # standard post-1994 room (2.5 gpm / 1.6 gpf / 2.2 gpm)

    # --- litres per room-night, standard room ---
    sh_std = shower_min * max(0.0, 2.5 - new_gpm_shower) * insitu * rebound * GAL
    to_std = flushes * max(0.0, 1.6 - new_gpf) * GAL
    fa_std = faucet_min * max(0.0, 2.2 - new_gpm_faucet) * insitu * GAL
    # --- litres per room-night, old room ---
    sh_old = shower_min * (3.5 - new_gpm_shower) * insitu * rebound * GAL
    to_old = flushes * (3.5 - new_gpf) * GAL
    fa_old = faucet_min * (3.0 - new_gpm_faucet) * insitu * GAL

    # --- hot-water energy: kWh per litre of warm water not drawn = 1.163 Wh/L/degC x deltaT / efficiency ---
    kwh_per_L_shower = 1.163e-3 * tri(15.0, 28.0, 22.0) / tri(0.75, 0.98, 0.85)  # mixed shower ~38-40 C over 10-25 C inlet
    kwh_per_L_faucet = 1.163e-3 * tri(8.0, 20.0, 15.0) / tri(0.75, 0.98, 0.85)   # JRC assumes 20 C lift for taps, REUWS 57% hot

    w = p_std * (sh_std + to_std + fa_std) + p_old * (sh_old + to_old + fa_old)
    e = p_std * (sh_std * kwh_per_L_shower + fa_std * kwh_per_L_faucet) \
      + p_old * (sh_old * kwh_per_L_shower + fa_old * kwh_per_L_faucet)
    water_f.append(w); energy_f.append(e)
    w_std.append(sh_std + to_std + fa_std); w_old.append(sh_old + to_old + fa_old)

q = lambda a, p: a[int(p * len(a))]


# ---------------- combine (same draw index = same imagined hotel) ----------------
water_c = [a + b for a, b in zip(water_l, water_f)]
energy_c = [a + b for a, b in zip(energy_l, energy_f)]
for a in (water_l, energy_l, water_f, energy_f, water_c, energy_c, w_std, w_old): a.sort()
q = lambda a, p: a[int(p * len(a))]

def report(name, water, energy):
    print(f"{name}: per occupied room-night water {q(water,.1):.1f} / {q(water,.5):.1f} / {q(water,.9):.1f} L, energy {q(energy,.1):.2f} / {q(energy,.5):.2f} / {q(energy,.9):.2f} kWh")
    for lab, p in (("p10", .1), ("p50", .5), ("p90", .9)):
        wl = q(water, p) / GUESTS_PER_ROOM; ek = q(energy, p) / GUESTS_PER_ROOM
        print(f"   {lab} per guest: {wl:.1f} L = {wl/WATER_PER_LODGING_VISIT*100:.1f}% of 300 L; {ek:.2f} kWh = {ek/KWH_PER_LODGING_VISIT*100:.1f}% of 28 kWh")
report("Part A linen reuse", water_l, energy_l)
report("Part B fixture retrofits", water_f, energy_f)
print(f"   (B: a standard post-1994 room saves {q(w_std,.1):.0f} / {q(w_std,.5):.0f} / {q(w_std,.9):.0f} L a night, a pre-1994 room {q(w_old,.1):.0f} / {q(w_old,.5):.0f} / {q(w_old,.9):.0f} L)")
report("COMBINED hotel water programme", water_c, energy_c)
water, energy = water_c, energy_c

# Blast radius on the map: Traveler Accommodation shops and their July-2024 card customers
months = json.load(open(os.path.join(D, "months.json")))
j24 = months.index("2024-07")
places = json.load(open(os.path.join(D, "places.json")))
lodg = {p["k"]: p for p in places if p["l"] == "Water"}
cust = {}
for f in os.listdir(os.path.join(D, "sm")):
    d = json.load(open(os.path.join(D, "sm", f)))
    for k, v in zip(d["keys"], d["v"]):
        if k in lodg:
            cust[k] = v[j24]
tot = sum(cust.values())
print(f"\nLodging shops on map: {len(lodg)}, July-2024 card customers: {tot}")
by = {}
for k, p in lodg.items():
    by.setdefault(p["m"], [0, 0]); by[p["m"]][0] += 1; by[p["m"]][1] += cust.get(k, 0)
for m, (n, c) in sorted(by.items(), key=lambda x: -x[1][1]):
    print(f"  {m:24s} {n:4d} shops {c:6d} customers")
for lab, p in (("p10", .1), ("p50", .5), ("p90", .9)):
    print(f"  {lab}: July-2024 saving all cities = {tot*q(water,p)/GUESTS_PER_ROOM/1000:.0f} m3 water, {tot*q(energy,p)/GUESTS_PER_ROOM:.0f} kWh")

st = json.load(open(os.path.join(D, "stadiums.json")))
def km(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    h = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(d-b)/2)**2
    return 2*6371*math.asin(math.sqrt(h))
n2 = n5 = c2 = c5 = 0
for k, p in lodg.items():
    dmin = min(km(p["y"], p["x"], s["y"], s["x"]) for s in st.values())
    if dmin <= 2: n2 += 1; c2 += cust.get(k, 0)
    if dmin <= 5: n5 += 1; c5 += cust.get(k, 0)
print(f"  within 2 km of a 2026 stadium: {n2} shops, {c2} customers; within 5 km: {n5} shops, {c5} customers")
