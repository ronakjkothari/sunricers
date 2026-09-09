# Lever: event-week cooling setpoints and pre-cooling

*Written 2026-08-18. Numbers come from `interventions/peak_cooling_setpoints_mc.py`; run it from the repo root to reproduce every figure here.*

## What the lever is

During the tournament weeks, hotels, restaurants and venues turn their air-conditioning thermostat up by 1 to 2 °C (about 2 to 4 °F), so 24 °C instead of 22.5 °C. On the hottest afternoons they can also "pre-cool": run the cooling harder in the morning and let the building drift up through the afternoon peak, which is what utilities call demand response. It costs nothing to do, and the same protocol works for any heat wave afterwards, so it is a real legacy measure.

Two different things are being claimed here and they must be kept apart. **Raising the setpoint saves energy** (less heat is pumped out of the building). **Pre-cooling saves peak power, not energy**: the field tests show it moves the electricity from 3 pm to 8 am and the day's total comes out about the same. So the "peak" half of this lever helps the grid on a hot match day but shows up as roughly zero on the map's kWh.

Who does it: hotel engineering, restaurant chains and venue facilities teams, pushed by the host committee and the utility's demand-response programme. Where it applies on our map: every shop tagged `Food`, `Water` (Traveler Accommodation, the hotels) or `Venue` in `app/data/places.json`, all 11 cities, event weeks only. It does not touch fuel stations.

## How big is the cut (the "range")

**Nobody has metered a hotel, restaurant or stadium before and after a 1–2 °C setpoint change.** The per-degree numbers come from office buildings: two big simulation studies and one measured campus trial. So we build the cut from three pieces:

> energy cut per visit = (cooling's share of the shop's July energy) × (setpoint rise in °C × cooling energy saved per °C ± pre-cooling noise)

Each piece gets a range and we combine them with 100,000 random draws (Monte Carlo), reporting the 10th, 50th and 90th percentile.

| piece | low / middle / high | where the numbers come from |
|---|---|---|
| setpoint rise | 1.0 / 1.5 / 2.0 °C | the lever's own definition; this is the organiser's dial |
| cooling energy saved per °C of setpoint rise | 5% / 9% / 15% | Ghahramani et al 2016 (simulation, DOE office buildings, all US climates): the best 1 °C move saves 7.7% of HVAC energy in Houston, 8.4% in Miami, 7.8% in Phoenix; 2 °C saves 13.6–15.6%. Hoyt, Arens & Zhang 2015 (simulation, offices, 7 climates): +1.1 °C saves 13% of HVAC energy on average (range 1–26%), +2.8 °C saves 29% of cooling energy. University of Georgia campus trial (measured chilled water, hot-humid Athens GA): 74 °F instead of 70–73 °F cut chilled water 19%, 76 °F cut it 40%, i.e. 13–16% per °C. The 5% low end is our judgment for kitchens and packed rooms, where most of the cooling load comes from people, cooking and lights and does not shrink when the setpoint moves; no study measured it. |
| pre-cooling effect on the day's energy | −3% / 0% / +3% of cooling energy | Xu et al 2009, LBNL field tests in two hot-climate California offices: total daily energy "almost the same" as the baseline day, one strategy +400 kWh, one −3.1%. Peak-period energy fell 10–23%. |
| cooling's share of the shop's July energy (electricity plus gas) — restaurants (`Food`) | 2% / 15% / 21% | DOE reference buildings, hourly EnergyPlus output on OpenEI, July: full-service restaurant Houston 20%, Miami 20%, Seattle 2%; quick-service Houston 14%. CBECS 2018 says food service cooling is 6.8% of annual major fuel nationally, so summer in a hot city is roughly triple the annual figure. |
| — hotels (`Water`) | 15% / 28% / 34% | same source, July: large hotel Houston 28%, Miami 29%, Seattle 18%; small hotel Houston 34%. CBECS 2018 lodging annual: 6.9%. |
| — venues (`Venue`) | 5% / 20% / 40% | no reference building exists for a stadium or arena. CBECS 2018 public assembly: cooling is 16.5% of annual major fuel and 32% of electricity. Open-air stadiums sit low, indoor arenas in July sit high. **Untested for venues.** |
| water: "cooling and heating" slice of the shop's water | hotels 12%, restaurants 1%, venues unknown | EPA WaterSense fact sheets (data from New Mexico OSE 1999, AWWA 2000, EBMUD 2008). Only cooling-tower make-up water tracks cooling energy; the split between towers and boilers inside that 12% is not measured, so we draw 50–100% (mode 80%). Only large buildings with towers have any water effect at all. |

Result per visit, **energy**: restaurants **0.9% / 1.8% / 2.9%**, hotels **2.3% / 3.6% / 5.3%**, venues **1.5% / 3.0% / 5.0%** of the `intensity_factors.csv` kWh per visit (2.8, 28, and 3.0–4.0). **Water**: hotels **0.9% / 1.3% / 1.9%** of the 300 L lodging visit, restaurants effectively zero (0.07%), venues untested and set to 0. **Food CO₂e: nothing.**

So Ronak's hardcoded −8% energy in `engines/playbook/plays.py` is two to four times too high for a 1–2 °C move; the honest headline is "about 2% for restaurants, 3–4% for hotels and venues". His −1% water is about right for hotels and too high for everything else. If someone quotes the map against electricity only rather than all energy, roughly double the restaurant figure (cooling is 32% of a Houston restaurant's July electricity but 20% of its total energy because of gas cooking).

## What the organiser can turn

* **How many degrees.** 1 °C to 2 °C is the whole range above; every extra degree adds about the same again. Comfort research (Aghniaey & Lawrence 2019, campus rooms in Georgia) found no discomfort up to 25 °C, so 2 °C from a 22–23 °C base is defensible; beyond that guests notice.
* **Which hours.** All-day setpoint rise is the energy dial. A 2–4 pm pre-cooling and drift protocol is the grid dial: 10–23% less peak-period electricity in the LBNL hot-climate tests, 80–100% chiller cut for three hours in Xu 2004, but nothing on the day's kWh. The app should show these as two separate numbers and never add them.
* **Who signs up.** All figures above assume the shop actually does it. In hotels the guest holds the thermostat, so the realistic move is a higher default and a capped range, not a hard setpoint. Uptake is unmeasured; expose it as a slider tagged "unmeasured".

## Blast radius on our map

The lever touches the `Food`, `Water` and `Venue` layers: 19,473 of the 20,569 shops on the map. In July 2024 those had **420,321 card customers** (Food 400,006, Venue 14,571, Water 5,744), led by New York/New Jersey 113,389, San Francisco Bay Area 54,271, Philadelphia 51,014 and Houston 50,968. Within 2 km of a 2026 stadium there are 341 of these shops with 7,249 customers; within 5 km, 1,238 shops with 31,470 customers.

If every one of these shops ran the protocol for the whole of July, the saving would be **14,300 / 27,100 / 43,400 kWh** and **17 / 29 / 45 m³ of water** across all 11 cities (p10/p50/p90), which is about **3,200 / 6,100 / 9,800 kWh per event week**. Restaurants carry three quarters of the kWh because there are so many of them; hotels carry three quarters of the water. Within 2 km of a stadium it is 430 kWh for the month at p50, within 5 km 2,200 kWh. These absolute numbers are floors, for the same reason as the hotel file: `spend-patterns-rice` counts card customers, and a hotel that shows 30 card customers a month plainly has hundreds of room-nights. The percentage is the trustworthy number; the kWh is a floor.

Note on the `Food` layer: it mixes restaurants with grocery and specialty food shops (roughly one in six of the mapped Food shops by NAICS). Grocery cooling is only 3–4% of its energy (CBECS food sales: refrigeration dominates), so the Food figure is a little generous for those shops.

## Where this is weak, in plain words

* Every per-degree number is from office buildings. Offices have mild internal heat; restaurant kitchens and full arenas do not, so the real per-degree saving there is probably nearer our low end than our middle. No hotel, restaurant or venue trial exists.
* Two of the three per-degree sources are simulations, not meters. The one measured source (University of Georgia) is a press release plus a conference paper we could not open; its 19% and 40% are chilled water, not electricity.
* The July cooling shares come from DOE reference buildings run through EnergyPlus for Houston, Miami and Seattle. They are the standard models, but they are models, and none of them is a stadium.
* Pre-cooling was tested in two hot-climate offices, not in a restaurant or hotel. Its energy effect is about zero, so this only matters if someone tries to claim it saves kWh.
* Water is a thin chain: a survey pie chart (12% of hotel water for "cooling and heating"), an unmeasured tower-versus-boiler split, and physics that make-up water tracks heat rejected. Treat the hotel water cut as "about 1%, probably", not as measured. Restaurants and small hotels have no cooling tower and no water effect at all.
* The 2.8 kWh, 28 kWh, 3–4 kWh and 300 L per visit we divide by are the team's hand-set factors, not measurements. The percent cut inherits that.

## Sources

Numbers with a direct link to the paper or report:

* Hoyt, Arens & Zhang 2015, *Extending air temperature setpoints: simulated energy savings and design considerations for new and retrofit buildings*, Building and Environment 88: 89–96. Table 3.1: +1.1 °C saves 13% of HVAC energy (mean of 7 climates × 5 models, range 1–26%), +2.2 °C 23%; Figure 3.3: 22.2 → 25 °C saves 29% of cooling energy. https://doi.org/10.1016/j.buildenv.2014.09.010 (open copy: https://escholarship.org/uc/item/13s1q2xc)
* Ghahramani, Zhang, Dutta, Yang & Becerik-Gerber 2016, *Energy savings from temperature setpoints and deadband: quantifying the influence of building and system properties on savings*, Applied Energy 165: 930–942. Table 9: daily optimal setpoint within ±1 °C of 22.5 °C saves 8.4% (Miami), 7.7% (Houston), 7.8% (Phoenix), 7.5% (Atlanta) of HVAC energy; ±2 °C 13.6–15.6%. https://doi.org/10.1016/j.apenergy.2015.12.115 (open copy: https://escholarship.org/uc/item/2c58r8qm)
* Xu, Haves, Piette & Braun 2004, *Peak demand reduction from pre-cooling with zone temperature reset in an office building*, ACEEE Summer Study, LBNL-55800: chiller power cut 80–100% from 2 to 5 pm, no comfort complaints. https://www.aceee.org/files/proceedings/2004/data/papers/SS04_Panel3_Paper31.pdf
* Xu et al 2009, *Demand shifting with thermal mass in large commercial buildings in a California hot climate zone*, LBNL for the California Energy Commission: total daily energy about equal (one day +400 kWh, one −3.1%), peak-period energy −10% to −23%, average shed 13% of whole-building power in the high-price hours. https://www.osti.gov/biblio/988082
* Motegi, Piette, Watson, Kiliccote & Xu 2007, *Introduction to commercial building control strategies and techniques for demand response*, LBNL-59975: global temperature adjustment as the priority DR strategy, typical 2–4 °F. https://eta-publications.lbl.gov/sites/default/files/59975.pdf
* Aghniaey & Lawrence 2018, *The impact of increased cooling setpoint temperature during demand response events on occupant thermal comfort in commercial buildings: a review*, Energy and Buildings 173: 19–27. https://www.sciencedirect.com/science/article/abs/pii/S0378778817338719
* Aghniaey, Lawrence et al 2019, *Thermal comfort evaluation in campus classrooms during room temperature adjustment corresponding to demand response*, Building and Environment: acceptability above 80% up to 25 °C. https://www.sciencedirect.com/science/article/abs/pii/S036013231830708X
* EIA, CBECS 2018 Table E1 (major fuels by end use) and Table E5 (electricity by end use): food service cooling 25 of 365 TBtu and 7 of 61 billion kWh; lodging 41 of 598 and 12 of 100; public assembly 96 of 583 and 28 of 87; food sales 7 of 233 and 2 of 54; South region cooling 14.7% of major fuel vs 8.7% nationally. https://www.eia.gov/consumption/commercial/data/2018/ce/xls/e1.xlsx and https://www.eia.gov/consumption/commercial/data/2018/ce/xls/e5.xlsx
* DOE commercial reference buildings, hourly EnergyPlus output by TMY3 site (OpenEI): July cooling electricity ÷ (electricity + gas) computed from `RefBldgFullServiceRestaurant`, `RefBldgQuickServiceRestaurant`, `RefBldgLargeHotel`, `RefBldgSmallHotel` for Houston, and full-service restaurant and large hotel for Miami and Seattle. https://openei.org/datasets/files/961/pub/COMMERCIAL_LOAD_DATA_E_PLUS_OUTPUT/
* EPA WaterSense, *Saving Water in Hotels* (cooling and heating 12% of hotel water) and *Saving Water in Restaurants* (1%). https://www.epa.gov/sites/default/files/2017-01/documents/ws-commercial-factsheet-hotels.pdf and https://www.epa.gov/sites/default/files/2017-01/documents/ws-commercial-factsheet-restaurants.pdf
* EPA WaterSense at Work, Section 1.1: about 4% of commercial buildings use central chillers or district chilled water, and those are the ones with cooling towers. https://www.epa.gov/system/files/documents/2023-05/watersense-at-work_Section_1.1_Intro.pdf

Numbers we only have second-hand:

* University of Georgia measured trial (Amos, Benson and Moore-Rooker Halls, Athens GA): chilled water −19% at 74 °F and −40% at 76 °F against a 70–73 °F baseline, no comfort complaints. Only in the university's press release; the CIBSE ASHRAE 2020 symposium paper it cites was not in the symposium's paper list. https://engineering.uga.edu/turn-up-the-thermostat-lower-energy-costs-no-complaints/
* Lawrence & Aghniaey 2019, *Optimizing thermal comfort and energy cost*, ASHRAE Journal August 2019 (behind ResearchGate; not opened).
* Sun et al 2013 (named in the brief) could not be identified; nothing was taken from it.

Claims we looked at and did NOT use, because they carry no method or do not fit:

* Japan Cool Biz "28 °C" savings (Ministry of the Environment: 210 million kWh in 2005, 4.4 billion kWh since): estimates from participation surveys, not meters. https://www.eesi.org/articles/view/the-japanese-cool-biz-campaign-increasing-comfort-in-the-workplace
* The "3% per °F" rule of thumb repeated in trade guides and in the UGA press release: no source behind it.
* Papadopoulos, Kontokosta et al 2019, *Rethinking HVAC temperature setpoints in commercial buildings*, Building and Environment: optimised setpoints up to 27 °C saving up to 60% in large offices; not a 1–2 °C move. https://www.sciencedirect.com/science/article/abs/pii/S036013231930232X
* PNNL-25985 (Fernandez et al 2017), *Impacts of commercial building controls on energy savings and peak load reduction*: its measure bundles wider deadbands with night setback, so it cannot be split; the PDF also failed to download.
* An Ahvaz, Iran split-air-conditioner bench test (57 W per °C): a single unit, not a building.

## Script output (python3 interventions/peak_cooling_setpoints_mc.py, 2026-08-18)

```
Food   energy cut per visit  p10/p50/p90 = 0.9% / 1.8% / 2.9%   (0.025 / 0.050 / 0.081 kWh)
       water  cut per visit  p10/p50/p90 = 0.03% / 0.07% / 0.12%   (0.01 / 0.02 / 0.03 L)
Water  energy cut per visit  p10/p50/p90 = 2.3% / 3.6% / 5.3%   (0.650 / 1.009 / 1.483 kWh)
       water  cut per visit  p10/p50/p90 = 0.85% / 1.29% / 1.88%   (2.55 / 3.88 / 5.64 L)
Venue  energy cut per visit  p10/p50/p90 = 1.5% / 3.0% / 5.0%   (0.053 / 0.103 / 0.175 kWh)
       water  cut per visit  p10/p50/p90 = 0.00% / 0.00% / 0.00%   (0.00 / 0.00 / 0.00 L)

Blast radius, July 2024 card customers
  Food    17157 shops    400006 customers | within 2 km of a 2026 stadium:  285 shops    6494 cust | within 5 km: 1062 shops   29617 cust
  Water     515 shops      5744 customers | within 2 km of a 2026 stadium:   10 shops      34 cust | within 5 km:   43 shops     585 cust
  Venue    1801 shops     14571 customers | within 2 km of a 2026 stadium:   46 shops     721 cust | within 5 km:  133 shops    1268 cust
    New York/New Jersey       6149 shops   113389 customers
    San Francisco Bay Area    3790 shops    54271 customers
    Philadelphia              1033 shops    51014 customers
    Houston                   2108 shops    50968 customers
    Dallas                    1048 shops    35881 customers
    Miami                      996 shops    30993 customers
    Atlanta                    861 shops    25463 customers
    Seattle                    892 shops    23163 customers
    Los Angeles               1750 shops    22643 customers
    Boston                     480 shops     7731 customers
    Kansas City                366 shops     4805 customers

July-2024 saving if every one of these shops ran the protocol all month (p10 / p50 / p90)
  p10: all 11 cities 14,329 kWh and 17.5 m3 water for the month, i.e. 3,236 kWh per event week; shops within 2 km of a stadium 220 kWh/month, within 5 km 1,175 kWh/month
  p50: all 11 cities 27,108 kWh and 29.1 m3 water for the month, i.e. 6,121 kWh per event week; shops within 2 km of a stadium 430 kWh/month, within 5 km 2,188 kWh/month
  p90: all 11 cities 43,392 kWh and 44.6 m3 water for the month, i.e. 9,798 kWh per event week; shops within 2 km of a stadium 702 kWh/month, within 5 km 3,483 kWh/month
    Food   p50 July saving all cities: 19,812 kWh, 6.8 m3
    Water  p50 July saving all cities: 5,795 kWh, 22.3 m3
    Venue  p50 July saving all cities: 1,501 kWh, 0.0 m3
```
