"""Monte Carlo for the "free_transit_with_ticket" lever: the match ticket doubles as a
free transit pass on match day (London 2012 Games Travelcard, 2006 World Cup and
EURO 2024 KombiTicket / 36-hour pass, Qatar 2022 Hayya card), with extra service and
park-and-ride, so fewer fans drive to the stadium and less gasoline is burned in the
region.

Run from repo root:  python3 interventions/free_transit_with_ticket_mc.py
Reads app/data/stadiums.json and app/data/matches.json only.  This lever is OFF-MAP:
it is a match-card number (attendance x a per-fan saving), not a shop-layer number.
The shop data in places.json / sm/*.json cannot see it and is not used.
Every input range and its source is explained in interventions/free_transit_with_ticket.md.

Per attending fan, the fuel saved is a product:
    gal_per_fan = C * R * G * D / (MPG * O) * (1 - T)
  C   = share of fans who would arrive by car without the programme (US stadium baseline)
  R   = share of those car-borne fans the ticket-bundle moves to transit / shuttle
  G   = share of the car round trip actually avoided (park-and-ride still drives part way)
  D   = round-trip car miles per shifted car (home or hotel <-> stadium)
  MPG = US light-duty fleet miles per gallon (FHWA VM-1)
  O   = people per car arriving at a stadium (FHWA planned-special-events handbook)
  T   = share of the car saving eaten by the extra transit vehicles' own fuel
Then kWh = gal * 33.7 and kg CO2e = gal * 8.887 (EPA tailpipe, no upstream).
"""
import json, os, math, random

random.seed(1)
D_ = os.path.join(os.path.dirname(__file__), "..", "app", "data")
N = 100_000
KWH_PER_GAL = 33.7     # US DOE gasoline-gallon-equivalent
CO2_PER_GAL = 8.887    # EPA tailpipe kg CO2 per gallon of gasoline
tri = random.triangular  # (low, high, mode)

gal, Cs, Rs = [], [], []
for _ in range(N):
    # C: baseline car share of attendees at a US stadium without a transit bundle.
    # FHWA handbook Table 5-12: SF Giants 48-58% auto, NY Mets 59%, SD Padres 85-95%;
    # MetLife on a normal NFL day ~85-90% (NJ Transit Super Bowl XLVIII report).
    C = tri(0.55, 0.90, 0.80)
    # R: relative cut in car trips when the ticket includes free transit + extra service.
    # Low 5%: AT&T Stadium 2026 (charter buses ~6% of seats), Sacramento Kings free ride
    #   with ticket: "up to 11%" of attendees by light rail.
    # Mode 20%: Climate Pledge Arena free pass 25% transit (no before); MetLife 2026 26-31%
    #   rail with paid $150 fares; SoFi 2026 13-21% shuttles.
    # High 45%: 2006 World Cup Green Goal, same stadiums: PT share ~40% before -> 57%,
    #   car 23% vs ~45% expected, with KombiTicket AND little stadium parking AND many
    #   foreign fans without cars; Super Bowl XLVIII parking cap: car -28..-39%.
    # London 2012 (95-100% PT) is a parking BAN, a different lever, so it is not in the triangle.
    R = tri(0.05, 0.45, 0.20)
    # G: share of the car round trip actually avoided.  Green Goal: park-and-ride was 5 of
    # the 57 PT points (~9% of riders still drove to a lot).  US park-and-ride heavier.
    G = tri(0.60, 1.00, 0.85)
    # D: round-trip car miles.  Straight-line stadium<->downtown for the 11 hosts (computed
    # below) runs 1-58 km; fans come from the whole metro.  Dosumu et al. 2017 England home
    # fans 15.55 km mean; Rapid Vienna 10.1 kg CO2e per car fan (~1.1 gal).  OUR ASSUMPTION.
    Dmi = tri(20.0, 80.0, 40.0)
    # MPG: FHWA Highway Statistics 2023 Table VM-1: all light duty 22.6, short WB 24.7, long WB 17.9.
    MPG = tri(17.9, 24.7, 22.6)
    # O: FHWA handbook Table 5-14 stadium vehicle occupancy 2.15-3.1, 2.5 common assumption.
    O = tri(2.15, 3.10, 2.50)
    # T: transit vehicle fuel per shifted rider as share of car fuel.  TEDB Ed.40 Table 2.13:
    # transit bus 34,877 Btu/veh-mi -> ~700 Btu/p-mi when full (50), car 4,292/2.5 = 1,717;
    # transit rail 20,040 Btu/car-mi -> ~130 Btu/p-mi full; extra seats on scheduled trains ~0.
    T = tri(0.05, 0.40, 0.20)
    g = C * R * G * Dmi / (MPG * O) * (1 - T)
    gal.append(g); Cs.append(C); Rs.append(R)
gal.sort()
q = lambda a, p: a[int(p * len(a))]
p10, p50, p90 = q(gal, .1), q(gal, .5), q(gal, .9)

print("free_transit_with_ticket: per ATTENDING fan, match day, region-wide (not a shop-visit number)")
print(f"  gallons   p10 / p50 / p90 = {p10:.3f} / {p50:.3f} / {p90:.3f}")
print(f"  kWh       p10 / p50 / p90 = {p10*KWH_PER_GAL:.2f} / {p50*KWH_PER_GAL:.2f} / {p90*KWH_PER_GAL:.2f}")
print(f"  kg CO2e   p10 / p50 / p90 = {p10*CO2_PER_GAL:.2f} / {p50*CO2_PER_GAL:.2f} / {p90*CO2_PER_GAL:.2f}  (tailpipe; upstream adds ~25%)")
# Same numbers per SHIFTED fan (divide out C*R), for comparison with the gasoline card's 1.14 gal
sh = sorted(g / (c * r) for g, c, r in zip(gal, Cs, Rs))
print(f"  per SHIFTED fan: gallons p10 / p50 / p90 = {q(sh,.1):.2f} / {q(sh,.5):.2f} / {q(sh,.9):.2f}"
      f"  (gasoline_visit_shift card used 1.14 gal from the Rapid Vienna study)")
print(f"  share of car trips removed, R: p10 / p50 / p90 = {q(sorted(Rs),.1)*100:.0f}% / {q(sorted(Rs),.5)*100:.0f}% / {q(sorted(Rs),.9)*100:.0f}%")
print("  Ronak's engines/playbook/plays.py: no placeholder for this lever (gasoline_visit_shift is energy -10% citywide).")

# ---------------- Tournament totals from stadiums.json x matches.json ----------------
st = json.load(open(os.path.join(D_, "stadiums.json")))
matches = json.load(open(os.path.join(D_, "matches.json")))
CENTRES = {"Atlanta": (33.749, -84.388), "Boston": (42.360, -71.058), "Dallas": (32.777, -96.797),
           "Houston": (29.760, -95.370), "Kansas City": (39.100, -94.579), "Los Angeles": (34.052, -118.244),
           "San Francisco Bay Area": (37.775, -122.419), "Miami": (25.775, -80.194),
           "New York/New Jersey": (40.713, -74.006), "Philadelphia": (39.953, -75.165), "Seattle": (47.606, -122.332)}
def km(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    h = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(d-b)/2)**2
    return 2*6371*math.asin(math.sqrt(h))
nmatch, att = {}, {}
for x in matches:
    nmatch[x["s"]] = nmatch.get(x["s"], 0) + 1
    att[x["s"]] = att.get(x["s"], 0) + st[x["s"]]["cap"]
tot_att = sum(att.values())
print(f"\nAttendance basis: {len(matches)} US matches, every seat filled: {tot_att:,} attendees")
print("  stadium                    matches  attendees   km to downtown |  gallons saved p10 / p50 / p90 (whole tournament)")
for s in st:
    d = km(st[s]["y"], st[s]["x"], *CENTRES[st[s]["m"]])
    print(f"  {s:26s} {nmatch[s]:3d}    {att[s]:9,}   {d:5.0f}          | {att[s]*p10:9,.0f} / {att[s]*p50:9,.0f} / {att[s]*p90:9,.0f}")
print("\nWhole tournament, all 11 US stadiums, 78 matches:")
for lab, p in (("p10", p10), ("p50", p50), ("p90", p90)):
    print(f"  {lab}: {tot_att*p:10,.0f} gallons = {tot_att*p*KWH_PER_GAL/1000:8,.0f} MWh = {tot_att*p*CO2_PER_GAL/1000:7,.0f} t CO2e")
avg = tot_att / len(matches)
print(f"One average match ({avg:,.0f} seats): {avg*p10:,.0f} / {avg*p50:,.0f} / {avg*p90:,.0f} gallons = "
      f"{avg*p10*KWH_PER_GAL/1000:,.0f} / {avg*p50*KWH_PER_GAL/1000:,.0f} / {avg*p90*KWH_PER_GAL/1000:,.0f} MWh = "
      f"{avg*p10*CO2_PER_GAL/1000:,.0f} / {avg*p50*CO2_PER_GAL/1000:,.0f} / {avg*p90*CO2_PER_GAL/1000:,.0f} t CO2e")
print("NOT IN THE SHOP DATA: spend-patterns-rice sees gasoline-station card visits, not fuel burned on the road; "
      "the Energy layer has 9 stations within 2 km of any 2026 stadium (see gasoline_visit_shift.md).")
