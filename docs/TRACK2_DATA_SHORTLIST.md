# Track 2 data shortlist — Energy–Food–Water

FIFA 2026 Resource Intelligence Platform · curation from ~7.7 GB compressed sample data · judged on **Impact**, **Data Analytics**, **Innovation**, **Feasibility**, **Legacy**, **Visualization**, **Pitch** ([Devpost](https://rice-urban-sustainability.devpost.com/))

---

> **Critical constraint**  
> These are transformed hackathon samples (noise, jitter). Judges reward methodology + decision support, not “true” city rankings. Build a transparent intensity-factor model and scenario tool — not a claim of ground truth.

| Metric | Value |
|--------|------:|
| Visit rows (est.) | ~224M |
| Compressed total | 7.7 GB |
| Visits in EFW NAICS | ~38% |
| Missing dataset | `spend-patterns-rice` |

---

## Verdict: what to build on

Ignore most of the 8 GB. Keep a thin spine: **filtered visits (demand)** + **filtered POI (maps/districts)** + **brand spend (intensity)** + **CDD/HDD + UHI (energy amplifiers)**. Convert activity → E/F/W with published factors, then run intervention scenarios.

---

## Compressed size by dataset

Source: local Downloads folders · gzip on disk

| Dataset | GB compressed |
|---------|--------------:|
| store-visits | 7.13 |
| daily-spend | 0.36 |
| core-poi | 0.20 |
| weather | 0.02 |
| urban-heat | 0.01 |

```
store-visits ████████████████████████████████████████ 7.13
daily-spend  ██                                    0.36
core-poi     █                                     0.20
weather      ·                                     0.02
urban-heat   ·                                     0.01
```

---

## Priority matrix

| Rank | Dataset | Size | Track 2 role | Keep / cut | Priority |
|-----:|---------|------|--------------|------------|----------|
| 1 | `store-visits-rice` | 7.13 GB | Visitor demand at food, lodging, fuel, venues | Keep only EFW NAICS; aggregate daily→monthly | **P0 — core** |
| 2 | `core-poi-geometry-rice` | 0.20 GB | Maps for venues, hotels, restaurants, districts | Filter EFW categories; keep lat/lon + polygon | **P0 — spatial** |
| 3 | `daily-spend-brand-and-state-rice` | 0.36 GB | Brand/market spend intensity (food, fuel, hotels) | Filter food/fuel/lodging brands; drop noise brands | **P0 — money→resource** |
| 4 | `daily-weather-rice` | 0.02 GB | Cooling/heating degree days + precip (energy/water) | Keep CDD, HDD, temp, precip, humidity only | **P1 — amplifiers** |
| 5 | `urban-heat-index-rice` | 0.01 GB | Spatial cooling load + heat stress overlay | Full grid; join via market crosswalk + coords | **P1 — maps/energy** |
| — | `spend-patterns-rice` | NOT LOADED | Place-level spend + PLACEKEY (best POI join) | Acquire if available — upgrades place analytics | **P0 if obtained** |

---

## Why visits dominate — and what to keep

Sample of ~400k visit rows: EFW-relevant NAICS are a minority. Filtering them is the single biggest win for both storage and signal.

### Share of sampled visits

| Segment | % of sampled rows |
|---------|------------------:|
| Food service | 22.1 |
| Gasoline | 7.5 |
| Food retail | 5.9 |
| Lodging | 2.9 |
| Other visits | 61.6 |

Source: `store-visits-rice` sample · NAICS prefixes 722 / 445 / 447 / 721

### Keep these visit categories

**Food**  
Restaurants, Grocery, Specialty Food, Special Food Services, Drinking Places, Beverage Mfg

**Energy proxies**  
Gasoline Stations; Cooling Degree Days from weather; UHI grid

**Water / waste proxies**  
Lodging + food service intensity factors; Waste Collection / Treatment (thin but useful)

**Venues / mega-event**  
Traveler Accommodation, Spectator Sports, Amusement, Museums — sparse but high narrative value

**Drop**  
Insurance, banks, apparel, auto repair, telecom, real estate brokerages — huge volume, weak EFW story.

---

## Join reality check (do this before modeling)

| Status | Join | Notes |
|--------|------|-------|
| Broken | `STORE_ID` visits ↔ POI | Visits use UUIDs; POI `STORE_ID` is sparse numeric (~7% filled). Sample overlap: **0**. Soft-join on MARKET + BRAND/NAME instead, or aggregate to market×category and skip store-level joins. |
| Crosswalk needed | MARKET labels disagree | Visits/spend: “Dallas / Houston”, “Los Angeles / SF Bay Area”. POI/UHI: separate Dallas, Houston, LA, SF Bay. Weather uses 401 opaque `CITY_LOCATION_IDENTIFIER` codes — map stations→host markets before any city dashboard. |

---

## Columns that actually matter

| Dataset | Must keep | Safe to ignore |
|---------|-----------|----------------|
| store-visits | MARKET, LOCAL_DATE, NAICS/CATEGORY, DAILY_VISITS, BRAND, NAME, STATE | STOCK_*, VERSION_ID, non-EFW categories |
| core-poi | PLACEKEY, LAT/LON, POLYGON_WKT, MARKET, TOP/SUB_CATEGORY, NAICS, LOCATION_NAME, BRANDS, WKT_AREA | PHONE, DOMAINS, WEBSITE, physician/dental-heavy categories |
| daily-spend | MARKET, BRAND_NAME, TRANS_DATE, SPEND_AMOUNT, TRANS_COUNT, STATE_ABBR | VERSION; non food/fuel/lodging brands |
| weather | CITY_ID, DATE, CDD, HDD, AVG/MAX/MIN TEMP, PRECIP, HUMIDITY | Dew point, visibility, pressure, wind (unless expanding climate story) |
| urban-heat | LAT, LON, MARKET, UHI | POINT_GEOMETRY duplicate of lat/lon for most viz tools |

---

## Winning product architecture (minimum that can take 1st)

1. **Baseline** — Market × month footprints for Energy / Food / Water from visits × intensity factors (kWh, kg CO₂e, liters, kcal)
2. **Spatial** — District/venue map from POI density + hotel/restaurant clusters + UHI cooling surcharge
3. **Scenarios** — Sliders: visitor surge, plant-forward menus, hotel AC efficiency, water reuse, local sourcing — show citywide deltas over time
4. **Interventions** — Rank top 10 actions by abatement per visitor-day and feasibility for city / venue / hotel operators

> **How this maps to judging criteria**  
> Impact + Legacy = intervention ranking beyond 2026. Data Analytics = intensity model + market crosswalk + uncertainty from synthetic noise. Innovation = nexus coupling (food spend drives water+energy, heat amplifies cooling). Visualization = maps + scenario compare. Feasibility = operator-ready actions, not just charts.

---

## Processing plan (cut 8 GB → workable)

| Step | Action | Expected result |
|------|--------|-----------------|
| A | Filter visits to EFW NAICS / categories | ~35–40% of rows; drop most of 7 GB |
| B | Aggregate visits to MARKET × CATEGORY × month | Tiny parquet/CSV; fast dashboards |
| C | Filter POI to food/lodging/fuel/venues/waste/utilities | Map layer without physician-office noise |
| D | Build MARKET crosswalk + weather station→market map | All 11 host cities join cleanly |
| E | Attach EPA/hotel/FAO intensity factors + CDD uplift | Quantified E–F–W footprints |
| F | Optional: pull `spend-patterns-rice` if available | PLACEKEY-level spend for venue districts |

---

## Host-city coverage notes

Visits/spend markets seen: Atlanta, Boston, Dallas/Houston, Kansas City, LA/SF Bay, Miami, NY/NJ, Philadelphia, Seattle (9 labels covering the 11 U.S. hosts via merges). POI/UHI split Dallas vs Houston and LA vs SF — better for district maps. Weather has 401 station IDs spanning 2020–2024.

---

*Dictionary: `WorldCupHack_Dictionary.xlsx` · Source data folders under Downloads (`*-rice`). `spend-patterns-rice` is documented but not present in the workspace.*

*Companion deliverables:*
- [`DATA_TECH_DOCUMENT.md`](./DATA_TECH_DOCUMENT.md) — schemas, intensity factors, package map
- [`PROPOSED_SOLUTION_PLANS.md`](./PROPOSED_SOLUTION_PLANS.md) — 4 Track 2 architectures
- [`../data/curated/`](../data/curated/) — viz-ready CSV package
