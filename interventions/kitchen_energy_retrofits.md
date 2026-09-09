# Lever: commercial kitchen energy-retrofit grants

*Written 2026-08-19. Numbers come from `interventions/kitchen_energy_retrofits_mc.py`; run it from the repo root to reproduce every figure here.*

## What the lever is

**Bucket: before.** This is a grant programme set up months ahead of the tournament, not a match-day action.

The city (economic development office plus the electric and gas utility) pays for, or heavily subsidises, a fixed list of efficient kitchen kit for restaurants, with a cap per restaurant: ENERGY STAR fryers, ovens and combi ovens, griddles, steam cookers and hot-food holding cabinets; ENERGY STAR reach-in refrigerators, freezers and ice machines; demand-controlled kitchen ventilation (DCKV, which means the exhaust hood fans slow down when the stove is idle instead of running flat out all day); and LED lighting. Less gas under the pans, less electricity in the fans, fridges and lights. The kit stays after the tournament, so it is a legacy measure. It is the energy twin of the kitchen water lever in `interventions/kitchen_water_efficiency.md` and would be run through the same door.

Where it applies on our map: the `Food` layer of `app/data/places.json`, minus the shops whose names look like grocery, convenience or liquor stores (the regex from `kitchen_water_efficiency_mc.py`). That leaves 14,137 restaurants. Ronak's `engines/playbook/plays.py` has **no placeholder** for this lever; the nearest is `kitchen_water_efficiency` at energy −2%.

## How big is the cut (the "range")

**One study has metered whole cooklines before and after this kind of retrofit**, and it is the spine of this card: the California Energy Commission report CEC-500-2021-021 (Frontier Energy, who run the Food Service Technology Center, 2021). They sub-metered every gas appliance and the hood fans at six kitchens (two restaurants, a hotel, a hospital cafeteria, an airline caterer and a grocery deli), swapped the old appliances for efficient ones, and measured again. Cookline gas fell 19% to 68% by site, 35% pooled; the two restaurants were 19% (a San Diego pub) and 43% (a Los Angeles Cuban full-service restaurant). Adding DCKV cut hood fan electricity by 45% and 49% at the two restaurants. That is a measured result, but for six hand-picked kitchens with old kit, with every appliance replaced for free. Nobody has metered whole restaurants across a real grant programme, and the one programme evaluation we found (California's 2021 food-service instant rebates) only checked paperwork against deemed savings and never put a meter on anything.

So the cut is a formula from measured pieces. We start from how a restaurant's energy splits between uses (the US government's 2018 building survey, CBECS, for food-service buildings), then for each use we ask how much of it the grant kit touches and how much of that the kit saves:

> % cut in restaurant energy = slider × ( cooking share × cookline saving + refrigeration share × reach-in share × unit saving + ventilation share × hood-fan share × DCKV fan saving + heating-and-cooling share × make-up-air share × airflow cut + lighting share × not-yet-LED share × LED saving )

"Slider" is the share of restaurants that still hold old kit and actually take the grant. It is the same unknown as in the water lever and we keep the same 0.15 / 0.35 / 0.60 range. Each piece is a triangle (low, middle, high) and we draw 100,000 combinations. "Site energy" means electricity and gas added together in kWh; that is how we read the team's 2.8 kWh per restaurant visit in `data/curated/intensity_factors.csv` (its note says "incl. prep + HVAC share"), so the % of site energy is the % of the visit.

| piece | low / middle / high | where the numbers come from |
|---|---|---|
| cooking share of restaurant energy | 33% / 41.7% / 48% | CBECS 2018 Table E2, food service: cooking 109.7 of 263.3 kBtu per sq ft. Spread covers fast food vs full service. Of the cooking energy, 61% is gas and 39% electricity (Table E6). |
| share of cookline energy the swap removes | 8% / 22% / 43% | CEC-500-2021-021. Low: one appliance (the pub's oven, 1.76 of 22 therms/day; ENERGY STAR calculator gives 10–17% on a single oven or griddle). Middle: the one or two biggest hogs (the Cuban restaurant's four fryers, 10 of 43 therms/day). High: whole cookline at the Cuban restaurant (43%; pub 19%, six sites pooled 35%). A capped grant buys one to three appliances, not a whole line. |
| refrigeration share of energy | 12% / 15.4% / 18% | CBECS 2018 Table E2, 40.6 kBtu per sq ft, all electric. |
| **share of fridge energy in reach-ins and ice machines** (not walk-ins) | 30% / 50% / 70% | **untested.** No measurement found. |
| saving per reach-in or ice machine replaced | 8% / 25% / 35% | ENERGY STAR CFS Equipment Calculator (March 2024): ice machines 8–15%, 35 cu ft reach-in refrigerator 27–29%, reach-in freezer 27%. Calculation from lab test data and a federal-minimum baseline, not field meters. |
| ventilation share of energy | 4% / 6.3% / 9% | CBECS 2018 Table E2, 16.6 kBtu per sq ft, all electric. |
| **share of that which is hood exhaust + make-up air fans** | 50% / 70% / 90% | **untested.** Kitchen hoods are the main fans in a restaurant, but nobody has split it. |
| DCKV fan energy saving | 30% / 47% / 62% | Metered: CEC 45% (pub, 46.9 → 26.0 kWh/day exhaust fan) and 49% (Cuban restaurant, 101 → 52 kWh/day for three exhaust fans plus supply); PG&E-monitored hotel kitchen 57%, charbroiler kitchen 37% (quoted in the ENERGY STAR DCKV profile); UC/SPEED five campus kitchens average 62%. |
| heating + cooling share of energy | 17% / 20.8% / 24% | CBECS 2018 Table E2, 35.6 + 19.1 kBtu per sq ft. |
| share of that spent on make-up air, × airflow cut from DCKV | (30% / 50% / 60%) × (10% / 22% / 30%) | Frontier says make-up air is "at least 50%" of a kitchen's HVAC load (no method); airflow cut 22% measured at the Cuban restaurant (11,200 → 8,700 cfm), 30% at a San Francisco hotel (ENERGY STAR profile). Heating savings were **estimated, never metered** in any DCKV study we found (CEC: 1,200 therms/yr estimate; SPEED: 25% estimate). |
| lighting share of energy | 3% / 4.1% / 6% | CBECS 2018 Table E2, 10.8 kBtu per sq ft. |
| share of lighting still not LED in 2026 | 10% / 30% / 50% | DOE LED adoption report: LEDs were 30% of installed lights in 2018 and 47% of commercial lights in 2020, still climbing. |
| LED saving on the fixtures it replaces | 40% / 55% / 75% | Technology level: roughly 40–50% against fluorescent tubes, 70–90% against incandescent and halogen (ENERGY STAR). No restaurant field trial found. |
| **slider: share of restaurants with old kit that take the grant** | 15% / 35% / 60% | **untested**, same as the water lever. Context: ENERGY STAR's share of 2022 US shipments was fryers 26%, griddles 21%, holding cabinets 12%, ice machines 28%, ovens 53%, fridges and freezers 50%, so most kit in kitchens today is not ENERGY STAR; but California's evaluation found 69% of rebated buyers would have bought ENERGY STAR anyway. |

Result: **a restaurant that actually gets the package cuts its energy by 12% / 16% / 21%** (10th / 50th / 90th percentile), which sits inside the CEC study's 20–40% for hand-picked old kitchens with everything replaced, as it should. Averaged over all restaurants with the slider, the cut is **3.7% / 5.8% / 8.7% of site energy, which is 0.10 / 0.16 / 0.24 kWh of the 2.8 kWh visit**. The cookline swap is most of it (median 3.4 points); DCKV fans and make-up air add about 0.7 each, fridges 0.6, LEDs 0.3. About 3.3 of the 5.8 points is electricity, the rest is gas.

**Water: 0.22% / 0.45% / 0.91% of the 25 L visit** (7 / 12 / 19 gallons per restaurant-day), from ENERGY STAR batch ice machines (calculator: 4,900–6,200 gallons a year) and connectionless steamers where a boiler steamer exists (calculator 70,000–104,000 gallons a year; CEC metered 317 → under 20 gallons a day at the hotel; share of restaurants with one set at 3–20%, untested). The ice-machine gallons overlap with the kitchen water lever; do not add the two levers' water numbers together.

**Food CO₂e: 0%.** A new fryer does not change what food is bought or wasted.

So the honest headline is "about 6% of a restaurant's energy when spread across the city, between 4% and 9%, and about 16% inside each kitchen that takes the grant".

## What the organiser can turn

* **Which kitchens, and which appliance.** The measured saving came from finding the one or two biggest energy hogs in old kitchens (broilers, old convection ovens, fryers on all day) and replacing those; CEC says that costs under $5,000 per kitchen and pays back in under two years. A grant that lets any restaurant buy any ENERGY STAR item drifts toward the low end (ENERGY STAR griddles save 12%, and California found most buyers would have chosen ENERGY STAR anyway). A grant that requires a short energy audit first and funds the top hog moves toward 22–43% of the cookline. This is the biggest dial and it is not measured across a programme, so the app should show the slider, not a fixed number.
* **DCKV in, or out.** DCKV is the only piece that also cuts heating and cooling, and it is metered at 45–62% of fan energy wherever it was tried, but it costs $5,000–15,000 with variable-speed drives and is only worth it under hoods that run 15+ hours a day. Installed base is about 3–5%. Including it roughly doubles the non-cookline saving; excluding it keeps the grant cheap.
* **Full-service vs quick-service.** Full-service kitchens with ranges, ovens and broilers running 15–19 hours a day (the CEC sites) are where the cookline saving lives. Coffee shops and sandwich chains (Starbucks, Subway, Dunkin' are among the most common names in our Food layer) have little cooking energy and mostly gain from fridges and LEDs, which is the 1–2% end.

## Blast radius on our map

The lever touches the restaurant part of the `Food` layer: 14,137 of the 20,569 shops after the grocery-name regex (17,157 Food shops in total), with **285,153 card customers in July 2024** across the 11 cities (New York/New Jersey 74,542, Houston 39,160, San Francisco Bay Area 31,056, Dallas 28,562, Philadelphia 28,522, Atlanta 20,137, Seattle 18,011, Los Angeles 17,905, Miami 17,759, Boston 5,708, Kansas City 3,791). Within 2 km of a 2026 stadium there are 248 restaurants with 5,886 July-2024 customers; within 5 km, 900 with 24,346. Those ring counts are for the map only; the lever is citywide and months ahead, not match-day scoped.

Applying the range to that pile, the whole-July saving across all 11 cities is **29,500 / 46,600 / 69,300 kWh of site energy and 16 / 32 / 65 m³ of water** for restaurants (41,400 / 65,400 / 97,200 kWh if every Food shop is counted). As with the other levers, `spend-patterns-rice` sees only card customers, so these kWh are a floor; the percentage is the number to trust. Note the 2.8 kWh per visit is the team's hand-set factor; CBECS says an average 4,800 sq ft food-service building uses about 370,000 kWh of site energy a year, which is 1–4 kWh per meal depending on how busy it is, so the factor is the right order of magnitude but not a measurement.

## Where this is weak, in plain words

* The only before-and-after meters are six California kitchens picked because they had old kit, and the researchers replaced everything. A real grant replaces one or two things in kitchens that volunteer. We cover that with the 8–43% cookline range and the slider, but it is a judgement, not a measurement.
* Four pieces have no measurement at all: how much fridge energy sits in reach-ins, how much fan energy sits in hoods, how many restaurants have a boiler steamer, and the slider itself.
* The DCKV heating and cooling saving is an engineering estimate in every study we found; nobody metered the gas bill after installing it. We let its low end sit near zero.
* The ENERGY STAR calculator numbers (fridges, ice machines, single appliances) are lab-test arithmetic against a federal-minimum baseline; old kit in the field may save more, and lightly used kit less.
* The percentage is against the team's 2.8 kWh per visit, read as electricity plus gas. If that factor is meant as electricity only, the gas part of the saving (about 40% of it) does not belong in the same percent.
* Food CO₂e is set to zero by reasoning, not by measurement.

## Sources

Numbers with a direct link to the report:

* Livchak, Ruan, Karsz & Zabrowski (Frontier Energy / Food Service Technology Center) 2021, *Demonstration of High-Efficiency Commercial Cooking Equipment and Kitchen Ventilation Systems*, California Energy Commission CEC-500-2021-021: six sub-metered kitchens; cookline gas savings 19–68%, pooled 35% (Table ES-2 / Table 33); Werewolf pub 22 therms/day cookline, oven 3.48 → 1.72, DCKV exhaust fan 46.9 → 26.0 kWh/day (45%), 11,467 kWh/yr; Versailles Cuban 53 therms/day total gas, 43 cookline, 18 saved, DCKV 101 → 52 kWh/day (49%), airflow 11,200 → 8,700 cfm, heating saving estimated 1,200 therms/yr; DoubleTree steamer 317 → under 20 gal/day and 50 → 10 kWh/day; DCKV market penetration 3–5%. https://www.energy.ca.gov/sites/default/files/2021-05/CEC-500-2021-021.pdf (landing page https://www.energy.ca.gov/publications/2021/demonstration-high-efficiency-commercial-cooking-equipment-and-kitchen)
* EIA, 2018 Commercial Buildings Energy Consumption Survey, end-use tables E1–E6 (December 2022): food service 263.3 kBtu per sq ft, cooking 109.7, refrigeration 40.6, space heating 35.6, cooling 19.1, water heating 19.4, ventilation 16.6, lighting 10.8; electricity 43.8 kWh per sq ft of which cooking 12.4, refrigeration 11.9. https://www.eia.gov/consumption/commercial/data/2018/ce/xls/e2.xlsx and https://www.eia.gov/consumption/commercial/data/2018/ce/xls/e6.xlsx ; summary page https://www.eia.gov/consumption/commercial/pba/food-service.php ; EIA *Today in Energy* "Food service buildings are highly energy intensive" https://www.eia.gov/todayinenergy/detail.php?id=60241
* EPA ENERGY STAR, *CFS Equipment Calculator* (March 2024 xlsx): per-unit annual use and savings, e.g. gas fryer 1,636 → 1,124 therms (31%), electric fryer 17%, gas griddle 12%, gas convection oven 17%, gas combi 35%, holding cabinet 1,478 → 933 kWh (37%), steam cooker 52–54% and 70,000–104,000 gal/yr, batch ice-making head 8% and 6,228 gal/yr, 35 cu ft reach-in refrigerator 3.11 → 2.2 kWh/day (29%), reach-in freezer 7.98 → 5.85 kWh/day (27%); inputs from ASTM tests, FSTC usage-hour research and SCG 2019. https://www.energystar.gov/sites/default/files/2024-03/CFS%20Equipment%20Calculator.xlsx (page https://www.energystar.gov/partner-resources/energy-star-training-center/commercial-food-service)
* EPA ENERGY STAR, *Technology Profile: Demand Control Kitchen Ventilation*: hotel kitchen fan power −57% (60,439 kWh/yr), charbroiler kitchen −37%, 30% make-up-air cut at a San Francisco hotel, DCKV market share 0.5–10% in 2010. https://www.energystar.gov/sites/default/files/dckv_technology_profile.pdf
* UC Davis Western Cooling Efficiency Center / SPEED programme, *Demand Control Kitchen Ventilation* case-study compilation: five campus kitchens, average fan electricity saving 62%, heating saving 25% (estimated, "not directly measured"). https://wcec.ucdavis.edu/wp-content/uploads/2013/07/Case-Study-DCKV_Compilation_Web.pdf
* DNV 2023, *California Foodservice Instant Rebates Statewide Third-Party Program, PY2021 Impact and Process Evaluation*: deemed-savings review, no metering; gross realisation 99–100%; net-to-gross 31% (69% free-ridership); fryers 81% of gas savings; average rebated unit 114 kWh + 64 therms a year gross. https://www.calmac.org/publications/PY_2021_Statewide_Third_Party_Programs_Evaluation_-_Foodservice_Instant_Rebates.pdf
* EPA ENERGY STAR, *2022 Unit Shipment and Market Penetration Report*: ENERGY STAR share of shipments, commercial fryers 26%, griddles 21%, hot food holding cabinets 12%, ice makers 28%, ovens 53%, refrigerators and freezers 50%, steam cookers 39%, dishwashers 47%. https://www.energystar.gov/sites/default/files/2022%20Unit%20Shipment%20Data%20Summary%20Report.pdf
* DOE 2020, *Adoption of Light-Emitting Diodes in Common Lighting Applications*: LED 30% of installed lights in 2018; commercial 47% in 2020 (summarised at https://inside.lighting/news/24-05/insights-latest-led-adoption-report). https://www.energy.gov/sites/default/files/2020/09/f78/ssl-led-adoption-aug2020.pdf
* EPA ENERGY STAR, *Look for the ENERGY STAR and Find Savings in Your Commercial Kitchen* (2015 fact sheet): lifetime dollar savings per product; LED 70–90% claim. https://www.energystar.gov/sites/default/files/asset/document/Equipment_Savings_fact_sheet.pdf
* Frontier Energy, *Energy Reduction in Commercial Kitchens* (SFIA summary of the CEC study): fryer replacement 40–50%, broiler 25–35%, griddle about 1 therm/day. https://frontierfstc.com/ceccook/Energy_Reduction_in_Commercial_Kitchens_SFIA.pdf
* Whole-restaurant water total (936 / 1,766 / 5,800 gal/day) reused from `interventions/kitchen_water_efficiency.md`: Van Schenkhof 2011 (221 Kansas restaurants) https://krex.k-state.edu/handle/2097/13114 and the AWE/FSTC kitchens guide https://ctycms.com/az-tempe/docs/awe-commercial-kitchens-guide.pdf

Numbers we only have second-hand:

* PG&E-directed monitoring of a Melink Intelli-Hood hotel kitchen (57%, 60,439 kWh/yr) and a charbroiler kitchen (37%), reference [5] inside the ENERGY STAR DCKV profile; the underlying Fisher-Nickel report was not found online.
* FSTC "research on average use" (2009, 2011) for appliance operating hours, Southern California Gas 2019 "Update Plan" efficiencies, and CA eTRM SWFS007 holding-cabinet idle rates, all inside the ENERGY STAR calculator.
* Frontier's "at least 50% of HVAC load is make-up air" and "only 10% of the California market uses ENERGY STAR gas cooking appliances", stated in the CEC report without a method.

Claims we looked at and did NOT use, because they carry no method:

* ENERGY STAR "outfitting a kitchen with a full suite saves about 350 MMBtu a year" (brochure arithmetic, no kitchen behind it).
* "Commercial kitchen ventilation is the single biggest user of energy in a food service facility" (ENERGY STAR DCKV profile); CBECS puts cooking first by a wide margin.
* Manufacturer brochures (Melink, hood makers) quoting "up to 70%" fan savings, and PG&E's blog post on DCKV. https://www.pge.com/en/mybusiness/save/smbblog/article/regulate-restaurant-kitchen-ventilation-more-effectively-with-demand-control.page
* ENERGY STAR small-business restaurant page "restaurants use 5 to 7 times more energy per square foot" (true from CBECS, but not a saving).

## Script output (2026-08-19)

```
Cut in restaurant site energy (electricity + gas), 10th / 50th / 90th percentile
  restaurant that gets the package (slider = 1): 12.4% / 16.3% / 20.9%
  averaged over all restaurants (slider 0.15/0.35/0.60): 3.7% / 5.8% / 8.7%
  of which (median, averaged): cook 3.4%, ref 0.6%, dckv_fan 0.7%, dckv_mua 0.7%, led 0.3%
  electricity part of the averaged cut: 2.1% / 3.3% / 4.7% of site energy
Cut per visit, as % of intensity_factors.csv restaurant visit (2.8 kWh, 25 L)
  p10: energy 3.7% (0.104 kWh), water 0.22% (0.05 L; 6.9 gal per restaurant-day), food CO2e 0%
  p50: energy 5.8% (0.164 kWh), water 0.45% (0.11 L; 11.9 gal per restaurant-day), food CO2e 0%
  p90: energy 8.7% (0.243 kWh), water 0.91% (0.23 L; 19.3 gal per restaurant-day), food CO2e 0%

Food-layer shops on map: 17157 (400006 July-2024 card customers); treated as restaurants after the grocery-name regex: 14137 shops, 285153 customers
  New York/New Jersey       4387 shops    74542 customers
  Houston                   1563 shops    39160 customers
  San Francisco Bay Area    2764 shops    31056 customers
  Dallas                     785 shops    28562 customers
  Philadelphia               714 shops    28522 customers
  Atlanta                    619 shops    20137 customers
  Seattle                    676 shops    18011 customers
  Los Angeles               1261 shops    17905 customers
  Miami                      725 shops    17759 customers
  Boston                     364 shops     5708 customers
  Kansas City                279 shops     3791 customers
  p10: July-2024 saving, restaurants = 29538 kWh (site energy), 16 m3 water; all Food shops = 41435 kWh
  p50: July-2024 saving, restaurants = 46629 kWh (site energy), 32 m3 water; all Food shops = 65410 kWh
  p90: July-2024 saving, restaurants = 69280 kWh (site energy), 65 m3 water; all Food shops = 97184 kWh
  restaurants within 2 km of a 2026 stadium: 248 shops, 5886 customers; within 5 km: 900 shops, 24346 customers (the lever is a 'before' grant, not match-day scoped; shown for the map only)
```
