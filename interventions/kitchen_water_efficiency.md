# Lever: commercial kitchen water-efficiency retrofit grants

*Written 2026-08-18. Numbers come from `interventions/kitchen_water_efficiency_mc.py`; run it from the repo root to reproduce every figure here.*

## What the lever is

The city (economic development office plus the water utility) pays for, or heavily subsidises, water-saving kitchen kit in restaurants: low-flow pre-rinse spray valves (the hose that blasts food off plates before the dish machine), ENERGY STAR dish machines, ENERGY STAR ice machines, and low-flow aerators on hand and prep sinks. Less water through the kitchen also means less hot water to heat, so energy falls a little too. It is a real legacy measure because the kit stays after the tournament.

Where it applies on our map: every shop tagged `Food` in `app/data/places.json` (17,157 shops). That layer is `NAICS 722` restaurants **plus** `445` grocery and specialty food stores, and `places.json` does not carry the NAICS code, so we cannot cleanly separate them. We count all Food and also show a rough name-based split (about 3,000 names look like grocery, convenience or liquor stores). Ronak's `engines/playbook/plays.py` placeholder for this lever is energy −2%, food CO₂e −5%, water −15%.

## How big is the cut (the "range")

**Nobody has metered a whole restaurant before and after a kitchen retrofit programme.** Even EPA's own "certified green restaurants" case study says the restaurants "cannot quantify specific savings" because they never had water data. What has been measured are the individual devices, above all the spray valve, and whole-restaurant totals from bills and a few monitored sites. So the cut is a formula from separately measured pieces:

> gallons saved per restaurant-day = (old-valve share × 1.5 valves × saving per valve) + (dish-machine share × saving per machine) + ice machine + aerators
> % water cut = gallons saved ÷ the restaurant's total daily water

Energy is the hot water that no longer needs heating, plus the dish machine's own electricity and gas. We convert to "% of a visit" against the team's hand-set 25 L and 2.8 kWh per restaurant visit in `data/curated/intensity_factors.csv`. Each piece is a triangle (low, middle, high) and we draw 100,000 combinations.

| piece | low / middle / high | where the numbers come from |
|---|---|---|
| total water per restaurant per day | 936 / 1,766 / 5,800 gal | FSTC-monitored Bay Area cafe, every tap sub-metered (936); 221 Kansas casual-dining restaurants from utility bills (1,766, 12.8 gal per seat); FSTC monitoring of 3 Bay Area retail sites (5,800, quoted in the AWE guide) |
| water saved per spray valve swapped | 17.6 / 19.3 / 49 gal per day | DNV GL for Massachusetts/Rhode Island: 39 sites, in-line meters for 30 days on the old and the new valve, 6,410 gal per year (17.6/day) and 114 therms per year per valve; EPA WaterSense calc (1.6 → 1.28 gpm × 64 min/day × 344 days = 7,045 gal/yr); Region of Waterloo pilot, 10 restaurants metered pre/post, 185 L/day per site (49 gal) with old valves at 10.4 L/min |
| valves per restaurant | 1.5 (fixed) | EPA WaterSense support statement assumption |
| **share of restaurants that still have an old (>1.28 gpm) valve** | 0.15 / 0.35 / 0.60 | **untested.** All valves sold in the US since 28 Jan 2019 must flow ≤1.28 gpm (DOE standard; WaterSense retired its label because of it), and valves last 5–8 years, so most kitchens have already turned over. Nobody has surveyed what is left. |
| kWh per gallon of hot water not heated | 0.24 / 0.30 / 0.52 | WaterSense: 0.24 kWh electric or 0.0094 therms (0.275 kWh) gas per gallon; MA/RI measured 114 therms per 6,410 gal = 0.52 kWh (includes heater losses) |
| water saved per dish machine replaced | 15 / 112 / 204 gal per day | FSTC-monitored cafe, ENERGY STAR machine 5,500 gal/yr (15); DOE/ENERGY STAR door-type calc 1.29 → 0.89 gal per rack × 280 racks (112); FSTC field case Bridges restaurant, 2.0 → 0.77 gal/rack × 166 racks = 74,000 gal/yr (204) |
| kWh saved per dish machine per day | 4 / 20 / 39 | cafe gallons × hot-water energy (4); DOE table for the door-type machine: 5,570 kWh + 294 therms per year (39) |
| **share of restaurants with a machine worth replacing** | 0.30 / 0.50 / 0.80 | **untested.** Quick-service and coffee shops often have no machine at all; nobody has counted. |
| ENERGY STAR ice machine | 0 / 5 / 15 gal per day | FSTC-monitored cafe 5,500 gal/yr (15); EPA "at least 10 percent"; 0 where the machine is already efficient |
| sink aerators | 3 / 10 / 30 gal per day | calculation only, no field measurement: AWE's 3.2 → 0.5 gpm for 20 min/day is 54 gal/day, but the monitored cafe's hand sinks used only 12 gal/day in total |

Result per average restaurant per open day: **64 / 94 / 130 gallons of water (242 / 356 / 490 L)** and **12.9 / 18.9 / 26.3 kWh** (10th / 50th / 90th percentile).

As a share of the restaurant's water that is a **1.9% / 3.5% / 6.5% water cut** (0.47 / 0.87 / 1.63 L of the 25 L visit) and a **0.9% / 1.7% / 3.1% energy cut** (0.025 / 0.046 / 0.087 kWh of the 2.8 kWh visit). The absolute extremes of the simulation were 0.6% and 12% for water.

**Food CO₂e: 0%.** Swapping a spray valve or a dish machine does not change what food the restaurant buys or throws away, and we found no study claiming otherwise. Ronak's −5% has no mechanism behind it and should be dropped.

So the honest headline is "about 3.5% of a restaurant's water, somewhere between 2% and 6.5%, and under 2% of its energy". Ronak's −15% water is about four times too high; his −2% energy is roughly right.

## What the organiser can turn

* **Which kitchens get the grant.** The whole spray-valve piece only pays off in kitchens that still have a pre-2019 valve, and the dish-machine piece only where there is an old machine. A free "walk in and swap" programme (the Massachusetts model, direct-install contractors) reaches many kitchens cheaply but about 20% of swaps in that programme saved almost nothing because the old valve was already low-flow or barely used. Screening kitchens first (bucket-test the valve, look at the dish machine's plate) moves the range toward the high end. This is the biggest dial and it is unmeasured, so the app should show it as a slider labelled "share of kitchens with old kit", not as a fixed number.
* **Valve only vs full retrofit.** Valves cost under $100 and pay back in months; a dish machine costs thousands and only full-service restaurants have one. A valve-only programme sits at the low end of the range (roughly 1–2% of water); adding dish machines is what gets to 3–6%.
* **Full-service vs quick-service.** Quick-service and coffee shops (Starbucks, Subway, Dunkin', McDonald's are the four most common names in our Food layer) spend most of their water on drinks, ice and toilets, not on dishes. In the one cafe FSTC sub-metered, dish-related water was 26% of the total and drinks-and-ice 40%. Targeting full-service restaurants raises the per-shop saving; spreading grants across every Food shop lowers it.

## Blast radius on our map

The lever touches the `Food` layer: 17,157 of the 20,569 shops on the map, with **400,006 card customers in July 2024** across the 11 cities (New York/New Jersey 107,228, Philadelphia 49,600, Houston 49,400, San Francisco Bay Area 48,278, Dallas 35,229, Miami 30,042, Atlanta 24,671, Seattle 22,095, Los Angeles 21,702, Boston 7,585, Kansas City 4,176). Within 2 km of a 2026 stadium there are 285 Food shops with 6,494 July-2024 customers; within 5 km, 1,062 shops with 29,617 customers.

Because `places.json` has no NAICS code, roughly 3,020 of those shops (114,853 July customers) have names that look like grocery, convenience or liquor stores and would not have a commercial kitchen; the other 14,137 shops (285,153 customers) we treat as restaurants. That split is a regex on brand names, so read it as a rough share, not a count.

Applying the range to that pile, the whole-July saving across all 11 cities is **189 / 347 / 650 m³ of water and 10,100 / 18,500 / 34,800 kWh** for all Food shops, or **135 / 248 / 463 m³ and 7,200 / 13,200 / 24,800 kWh** for the restaurants-only split. As with hotels, `spend-patterns-rice` sees only card customers, so these litres are a floor; the percentage is the number to trust.

## Where this is weak, in plain words

* The two shares that matter most (how many kitchens still have an old spray valve, how many have an old dish machine) are guesses with wide ranges. No one has surveyed them, and since 2019 every new valve is already low-flow, so the spray-valve saving that made this lever famous is mostly already banked.
* The measured savings per valve come from 2005–2014 programmes where the old valve flowed 1.9–2.3 times the new one. Against a 1.6 gpm valve the saving is smaller (that is the EPA 7,045-gallon calc we use as the middle).
* The dish-machine numbers are one field case, one monitored cafe and a DOE calculation, not a field trial across many restaurants. FSTC's own 20-site conveyor-machine monitoring found real water use often differs from the rated figure.
* Whole-restaurant totals come from Kansas casual dining and Bay Area cafes, not from the 11 host cities, and none of the pieces were measured on the mix of chains that dominates our Food layer.
* Energy is converted through the team's 25 L and 2.8 kWh per visit; if the true visit uses less water than 25 L, the water percent is understated, and vice versa.
* Food CO₂e is set to zero by reasoning, not by measurement.

## Sources

Numbers with a direct link to the report:

* DNV GL 2014, *Impact Evaluation of Massachusetts Prescriptive Gas Pre-Rinse Spray Valve Measure*: 39 metered sites (33 MA, 6 RI), 30-day in-line metering of old and new valve, 6,410 gal and 114 therms per valve per year, ~20% "small-saver" swaps, valve life 8 years. https://ma-eeac.org/wp-content/uploads/Prescriptive-Gas-Pre-Rinse-Spray-Valve-Measure-Impact-Evaluation.pdf (Rhode Island companion: https://eec.ri.gov/wp-content/uploads/2018/03/impact-evaluation-of-national-grid-rhode-island-ci-prescriptive-gas-pre-rinse-spray-valve-measure.pdf)
* Veritec Consulting 2005, *Region of Waterloo Pre-Rinse Spray Valve Pilot Study*: 10 food-service sites metered pre/post, 10.4 → 4.6 L/min, 185 L/day per site (245 excluding pressure-problem sites), 46% of valve water; California Rinse & Save 19 metered facilities quoted at 520 L/day for 2.7 h use. https://p2infohouse.org/ref/50/49038.pdf
* EPA WaterSense 2013, *Pre-Rinse Spray Valves Specification Supporting Statement*, Appendix A: 7,045 gal/yr = (1.6 − 1.28 gpm) × 64 min/day × 344 days; 1.5 valves per establishment; 0.24 kWh or 0.0094 therms per gallon heated. https://www.epa.gov/sites/production/files/2017-01/documents/ws-products-support-statement-prsv.pdf
* EPA WaterSense, *Pre-Rinse Spray Valves* page: DOE standard 1.00/1.20/1.28 gpm effective 28 Jan 2019, WaterSense label sunset 1 Jan 2019. https://epa.gov/watersense/pre-rinse-spray-valves
* Alliance for Water Efficiency / FSTC, *Commercial Kitchens Water Use Efficiency and Best Practices Guide*: FSTC-monitored cafe end uses (sanitation 239, bathroom 316, drinks & ice 381 gal/day), 2009 coffee-chain monitoring (ENERGY STAR dish machine 5,500 gal/yr, ice machine 5,500 gal/yr), Bridges dish-machine case (2.0 → 0.77 gal/rack, 74,000 gal/yr), 5,800 gal/day from 3 Bay Area sites. https://ctycms.com/az-tempe/docs/awe-commercial-kitchens-guide.pdf
* DOE FEMP, *Purchasing Energy-Efficient Commercial Dishwashers*: door-type machine, 1.29 → 0.89 gal/rack, 17,176 → 11,606 kWh and 947 → 653 therms per year at 280 racks/day. https://www.energy.gov/cmei/femp/purchasing-energy-efficient-commercial-dishwashers
* ENERGY STAR, *Commercial Dishwashers* and Version 3.0 key product criteria (gal/rack limits, "50 percent more water efficient", 5,647 gal/yr claim). https://www.energystar.gov/products/commercial_dishwashers and https://www.energystar.gov/products/commercial_food_service_equipment/commercial_dishwashers/key_product_criteria
* Van Schenkhof 2011, *An investigation of water usage in casual dining restaurants in Kansas*, K-State thesis: 221 restaurants, utility billing data, 1,766 gal/day, 12.79 gal per seat per day. https://krex.k-state.edu/handle/2097/13114
* Frontier Energy 2025, *Restaurant Field Monitoring Final Report* (CalNEXT ET22SWE0046): one full-service restaurant, hot water 10.8 gal per cover, 1.6 gal per cover less after a 1.5 → 0.75 gpm spray head. https://calnext.com/wp-content/uploads/2025/10/ET22SWE0046_Restaurant-Field-Monitoring_Final-Report.pdf
* Fisher 2008, *Case Studies in Restaurant Water Heating*, ACEEE: monitored hot water 500 gal/day (quick service) and 2,100 gal/day (full service). https://www.aceee.org/files/proceedings/2008/data/papers/9_243.pdf
* EPA WaterSense 2012, *WaterSense at Work*, Section 4 (kitchen ~50% of restaurant water; ENERGY STAR kit "at least 10 percent" more water-efficient; spray-valve equation). https://www.epa.gov/sites/default/files/2017-02/documents/watersense-at-work_final_508c3.pdf
* EPA 2009, *Water Efficiency in the Commercial and Institutional Sector*: restaurant end-use pie (kitchen 48%, restrooms 31%), EBMUD split (kitchen 47%). https://www.epa.gov/sites/default/files/2017-03/documents/ws-commercial-ci-whitepaper.pdf

Numbers we only have second-hand:

* Dziegielewski et al. 2000, *Commercial and Institutional End Uses of Water*, AWWARF (24 sub-metered establishments; restaurant end-use shares), quoted by EPA; the book itself is behind the AWWA paywall.
* EBMUD 2008, *WaterSmart Guidebook*, restaurant end-use split, quoted by EPA.
* SBW Consulting 2007, *2004-05 Pre-Rinse Spray Valve Installation Program (Phase 2)* for CUWCC/CPUC: 19 metered sites, 1.11 gpm flow reduction, 33% longer use after the swap; quoted in the DNV GL report.
* Delagah & Fisher 2008, CEC PIER *Water Heating Equipment and Systems Characterization*: ~2,500 gal hot water per day at full-service restaurants, quoted in the AWE guide.

Claims we looked at and did NOT use, because they carry no method:

* "Overall water savings of 10–25% with low-cost upgrades" (AWE guide, footnoted to "FSTC field auditing experience").
* "Dishwashing is 30–40% of restaurant water" and "dish machine plus spray valve are two-thirds of kitchen water" (AWE web page, no data behind it).
* Boston University cafeteria "63 percent decrease" from spray valves (EPA *Saving Water in Restaurants* factsheet, single site, no method). https://www.epa.gov/sites/default/files/2017-01/documents/ws-commercial-factsheet-restaurants.pdf
* MWRA *Water Efficiency for Restaurants Case Study*: savings are spreadsheet estimates, not meter readings. https://www.mwra.com/documents/water-efficiency-restaurants-case-study
* EPA *Restaurants Install Water-Efficient Commercial Kitchen Equipment* case study: three restaurants, "not able to cite how many total gallons of water they have saved". https://www.epa.gov/sites/default/files/2017-01/documents/ws-commercial-casestudy-certified-restaurants.pdf
* Online "restaurant water use calculators" (Menubly and similar): no source for their gallons-per-meal figures.

## Script output (2026-08-18)

```
Saved per average restaurant per open day (10th / 50th / 90th percentile)
  water  64 / 94 / 130 gal  (242 / 356 / 490 L)
  energy 12.9 / 18.9 / 26.3 kWh
Cut per visit, as % of intensity_factors.csv restaurant visit (25 L, 2.8 kWh)
  p10: water 1.9% (0.47 L), energy 0.9% (0.025 kWh), food CO2e 0%
  p50: water 3.5% (0.87 L), energy 1.7% (0.046 kWh), food CO2e 0%
  p90: water 6.5% (1.63 L), energy 3.1% (0.087 kWh), food CO2e 0%

Food-layer shops on map: 17157, July-2024 card customers: 400006
  New York/New Jersey       5554 shops   107228 customers
  Philadelphia               926 shops    49600 customers
  Houston                   1862 shops    49400 customers
  San Francisco Bay Area    3253 shops    48278 customers
  Dallas                     928 shops    35229 customers
  Miami                      859 shops    30042 customers
  Atlanta                    712 shops    24671 customers
  Seattle                    767 shops    22095 customers
  Los Angeles               1578 shops    21702 customers
  Boston                     397 shops     7585 customers
  Kansas City                321 shops     4176 customers
  of which names that look like grocery/convenience/liquor (rough regex): 3020 shops, 114853 customers
  rest, treated as restaurants: 14137 shops, 285153 customers
  p10: July-2024 saving, all Food shops = 189 m3 water, 10091 kWh; restaurants-only (name split) = 135 m3, 7193 kWh
  p50: July-2024 saving, all Food shops = 347 m3 water, 18523 kWh; restaurants-only (name split) = 248 m3, 13205 kWh
  p90: July-2024 saving, all Food shops = 650 m3 water, 34768 kWh; restaurants-only (name split) = 463 m3, 24785 kWh
  within 2 km of a 2026 stadium: 285 shops, 6494 customers; within 5 km: 1062 shops, 29617 customers
```
