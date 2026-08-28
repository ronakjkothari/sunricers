"""Write app/data/levers.json: the sourced intervention levers for the Scenarios tab and the map.

Run from repo root:  python3 scripts/build_levers.py

Every percentage here is copied from the matching card in interventions/<id>.md, which
is produced by interventions/<id>_mc.py (10th / 50th / 90th percentile of 100,000 draws).
Re-run the _mc.py script if you change a card, then update the numbers here.
All cuts are "portfolio" averages, i.e. spread over every shop of that type in a city
(a shop that actually takes the grant saves more; the card says how much).
"""
import json, os, re, datetime

ROOT = os.path.join(os.path.dirname(__file__), "..")
D = os.path.join(ROOT, "app", "data")

# fractions, [p10, p50, p90]
pc = lambda a, b, c: [a / 100, b / 100, c / 100]

LEVERS = [
    {
        "id": "hotel_water_programme",
        "title": "Hotel water programme",
        "bucket": "before",
        "plain": "Hotels put the “hang up your towel” card in rooms, and grants pay for low-flow showerheads, tap aerators and low-flush toilets.",
        "owner": "Hotel association + water utility",
        "touches": ["hotel"],
        "cuts": {"hotel": {"water": pc(10.9, 13.7, 17.0), "kwh": pc(6.2, 8.6, 11.8)}},
        "evidence": "formula from measured pieces",
        "evidence_plain": "Laundry formula from the EU JRC hotel guide with measured guest participation (35–49%); bathroom fixtures from logged US hotel rooms and two metered San Antonio retrofits. The share of rooms still on old fittings is unmeasured.",
        "best_source": {"t": "JRC, Best Environmental Management Practice in the Tourism Sector, ch. 5",
                        "u": "https://green-forum.ec.europa.eu/document/download/31ee1841-92ff-4eb9-b37e-9fc1f4d66bb7_en?filename=2_PDFsam_BEMP-5-FINAL.pdf"},
        "dials": ["opt-out vs opt-in towel card (roughly doubles participation)", "laundry efficiency (5 to 20 L per kg)", "share of rooms still on pre-1994 fittings"],
        "placeholder": "Ronak: water −30%, energy −3%",
        "card": "interventions/hotel_water_programme.md",
    },
    {
        "id": "kitchen_water_efficiency",
        "title": "Kitchen water retrofits",
        "bucket": "before",
        "plain": "City pays part of new spray valves, dishwashers and ice machines for restaurants.",
        "owner": "Economic development + water utility",
        "touches": ["restaurant"],
        "cuts": {"restaurant": {"water": pc(1.9, 3.5, 6.5), "kwh": pc(0.9, 1.7, 3.1)}},
        "evidence": "partly untested",
        "evidence_plain": "Per-device savings are metered (39 Massachusetts kitchens, 30 days each). How many kitchens still hold old kit has never been surveyed, and since 2019 every valve sold is already efficient.",
        "best_source": {"t": "DNV GL 2014, Massachusetts pre-rinse spray valve impact evaluation",
                        "u": "https://ma-eeac.org/wp-content/uploads/Prescriptive-Gas-Pre-Rinse-Spray-Valve-Measure-Impact-Evaluation.pdf"},
        "dials": ["share of kitchens with old kit", "which devices the grant covers"],
        "placeholder": "Ronak: water −15%, energy −2%, food CO₂e −5%",
        "card": "interventions/kitchen_water_efficiency.md",
    },
    {
        "id": "kitchen_energy_retrofits",
        "title": "Kitchen energy retrofits",
        "bucket": "before",
        "plain": "City pays part of efficient fryers, ovens, fridges and smart exhaust hoods for restaurants.",
        "owner": "Economic development + utility",
        "touches": ["restaurant"],
        "cuts": {"restaurant": {"kwh": pc(3.7, 5.8, 8.7), "water": pc(0.22, 0.45, 0.91)}},
        "overlap": {"kitchen_water_efficiency": ["water"]},   # its water piece is the same ice machines; do not add
        "evidence": "formula from measured pieces",
        "evidence_plain": "Six sub-metered California kitchens: cookline gas −19 to −68%, exhaust fans −45 to −49%. A shop that takes the grant saves 12–21%; spread over every restaurant it is 4–9%.",
        "best_source": {"t": "Frontier Energy 2021, CEC-500-2021-021",
                        "u": "https://www.energy.ca.gov/sites/default/files/2021-05/CEC-500-2021-021.pdf"},
        "dials": ["share of kitchens with old kit", "grant limited to the biggest energy hogs vs any ENERGY STAR item"],
        "placeholder": "no placeholder",
        "card": "interventions/kitchen_energy_retrofits.md",
    },
    {
        "id": "grocery_fridge_doors",
        "title": "Grocery fridge doors",
        "bucket": "before",
        "plain": "Grants to put glass doors on open fridge cases in grocery and convenience stores.",
        "owner": "Utility + city",
        "touches": ["grocery"],
        "cuts": {"grocery": {"kwh": pc(3.6, 5.6, 8.4)}},
        "evidence": "formula from measured pieces",
        "evidence_plain": "42 days of metering in two Kansas supermarkets: doored cases use 23% less, no sales loss. A store that signs up saves 7–13%; spread over all grocery shops 4–8%.",
        "best_source": {"t": "Fricke & Becker 2010, ASHRAE RP-1402 display case doors",
                        "u": "https://www.producefoodsafety.org/files/inline-files/displaycasedoors.pdf"},
        "dials": ["share of stores still running open cases", "heated glass vs no-heat glass + LED"],
        "placeholder": "no placeholder",
        "card": "interventions/grocery_fridge_doors.md",
    },
    {
        "id": "peak_cooling_setpoints",
        "title": "Event-week cooling setpoints",
        "bucket": "during",
        "plain": "Hotels, restaurants and venues set the air conditioning 1–2 °C warmer for the event week.",
        "owner": "Hotel engineering + venue facilities",
        "touches": ["restaurant", "hotel", "venue"],
        "cuts": {"restaurant": {"kwh": pc(0.9, 1.8, 2.9)},
                 "hotel": {"kwh": pc(2.3, 3.6, 5.3), "water": pc(0.9, 1.3, 1.9)},
                 "venue": {"kwh": pc(1.5, 3.0, 5.0)}},
        "evidence": "formula from measured pieces",
        "evidence_plain": "1 °C saves 7–8% of cooling energy in Houston/Miami simulations; cooling is 15–35% of July electricity. Pre-cooling only moves power to the morning, it does not cut kWh.",
        "best_source": {"t": "Ghahramani et al. 2016, Applied Energy (setpoints in hot US cities)",
                        "u": "https://escholarship.org/uc/item/2c58r8qm"},
        "dials": ["+1 or +2 °C", "event week only vs whole summer"],
        "placeholder": "Ronak: energy −8%, water −1%",
        "card": "interventions/peak_cooling_setpoints.md",
    },
    {
        "id": "plant_forward_concessions",
        "title": "Plant-forward concessions",
        "bucket": "match day",
        "plain": "Stadium food contracts make the plant-based option the default or the first thing you see.",
        "owner": "Venue concessions + host committee",
        "touches": [],
        "offmap": {"per_fan": {"co2": [0.15, 0.29, 0.49]}, "unit_note": "kg CO₂e per attending fan"},
        "evidence": "partly untested",
        "evidence_plain": "Three US randomised trials at catered events: plant default +47 points of uptake. Not tested in a stadium; the concession menu mix is assumed. The shop data never sees stadium concessions, so this is attendance × per-fan, not a shop cut.",
        "best_source": {"t": "Boronowsky et al. 2022, Frontiers in Sustainable Food Systems",
                        "u": "https://www.frontiersin.org/articles/10.3389/fsufs.2022.1001157/full"},
        "dials": ["default vs merely available", "share of concession points that comply"],
        "placeholder": "Ronak: food CO₂e −25%, water −8%, energy −5%",
        "card": "interventions/plant_forward_concessions.md",
    },
    {
        "id": "free_transit_with_ticket",
        "title": "Free transit with the match ticket",
        "bucket": "match day",
        "plain": "Your match ticket is also a free bus and train pass, with extra service and park-and-ride.",
        "owner": "Host committee + transit agency",
        "touches": [],
        "offmap": {"per_fan": {"kwh": [1.4, 2.9, 5.3], "co2": [0.37, 0.76, 1.40], "gal": [0.04, 0.09, 0.16]}, "unit_note": "per attending fan, region-wide tailpipe"},
        "evidence": "partly untested",
        "evidence_plain": "Measured at the 2006 World Cup (public transport 40% → 57%), London 2012 and Super Bowl XLVIII, but every big shift also had a parking cap. Not in the shop data: attendance × per-fan.",
        "best_source": {"t": "Öko-Institut, Green Goal Legacy Report (2006 World Cup)",
                        "u": "https://www.oeko.de/oekodoc/292/2006-011-en.pdf"},
        "dials": ["with or without a parking cap", "free vs paid (the 2026 hosts charged $80–150)"],
        "placeholder": "no placeholder (replaces gasoline_visit_shift, energy −10%)",
        "card": "interventions/free_transit_with_ticket.md",
    },
]

SEGMENTS = {
    "restaurant": {"layer": "Food",   "label": "restaurants",          "factor": {"kwh": 2.8,  "water": 25.0,  "co2": 3.5}},
    "grocery":    {"layer": "Food",   "label": "grocery & convenience", "factor": {"kwh": 1.2,  "water": 8.0,   "co2": 6.0}},
    "hotel":      {"layer": "Water",  "label": "hotels",               "factor": {"kwh": 28.0, "water": 300.0, "co2": 2.0}},
    "venue":      {"layer": "Venue",  "label": "venues",               "factor": {"kwh": 4.0,  "water": 15.0,  "co2": 2.5}},
    "gas":        {"layer": "Energy", "label": "gas stations",         "factor": {"kwh": 45.0, "water": 1.5,   "co2": 12.0}},
    "other":      {"layer": "Other_EFW", "label": "other",             "factor": {"kwh": 3.0,  "water": 12.0,  "co2": 1.8}},
}
GROCERY_RE = (r"market|grocer|supermarket|deli\b|foods\b|liquor|wine|spirits|7-eleven|circle k|wawa|bodega|"
              r"mart\b|convenience|bakery|meat|seafood|produce|aldi|safeway|publix|kroger|h-e-b|trader joe|"
              r"whole foods|shoprite|key food|c town|costco|walmart|target|sprouts|smart & final|dollar")
gro = re.compile(GROCERY_RE, re.I)

# Food-layer split per city: share of Jun+Jul-2024 card customers at grocery-looking names vs the rest
months = json.load(open(os.path.join(D, "months.json")))
idx = [months.index("2024-06"), months.index("2024-07")]
places = json.load(open(os.path.join(D, "places.json")))
food = {p["k"]: p for p in places if p["l"] == "Food"}
split = {}
for f in os.listdir(os.path.join(D, "sm")):
    d = json.load(open(os.path.join(D, "sm", f)))
    for k, v in zip(d["keys"], d["v"]):
        p = food.get(k)
        if not p: continue
        c = sum(v[i] for i in idx)
        s = split.setdefault(p["m"], {"restaurant": 0.0, "grocery": 0.0})
        s["grocery" if (p["n"] and gro.search(p["n"])) else "restaurant"] += c
food_split = {}
for m, s in split.items():
    t = s["restaurant"] + s["grocery"]
    food_split[m] = {"restaurant": round(s["restaurant"] / t, 4), "grocery": round(s["grocery"] / t, 4)} if t else {"restaurant": 0.73, "grocery": 0.27}

out = {
    "built": datetime.date.today().isoformat(),
    "note": ("Cuts are 10th/50th/90th percentiles from interventions/<id>_mc.py (100,000 draws, middle 80% kept). "
             "They are % of the per-visit factor in data/curated/intensity_factors.csv for that shop type, averaged over all "
             "shops of the type in a city. The percent is the trustworthy part; absolute totals inherit whichever pile they are applied to."),
    "segments": SEGMENTS,
    "grocery_regex": GROCERY_RE,
    "food_split": food_split,
    "levers": LEVERS,
}
os.makedirs(D, exist_ok=True)
json.dump(out, open(os.path.join(D, "levers.json"), "w"), indent=1, ensure_ascii=False)
print("wrote app/data/levers.json:", len(LEVERS), "levers; food split", {m: v["grocery"] for m, v in sorted(food_split.items())})
