# Lever: doors on open grocery fridges (retrofit grant)

*Written 2026-08-19. Numbers come from `interventions/grocery_fridge_doors_mc.py`; run it from the repo root to reproduce every figure here.*

## What the lever is

Most US supermarkets still keep milk, yoghurt, meat, drinks and ready meals in tall open fridges with no doors. Cold air falls out of them all day, and the compressors run to replace it. The lever is a city or utility grant that pays shops to bolt glass doors onto those open cases (and, in the same visit, swap to "no-heat" glass and LED case lights). The doors stay for 10-15 years, so this is a **"before" bucket** lever: a grant programme launched months ahead of the tournament, citywide, not tied to a match day. Its saving runs all year, including tournament week.

Who does it: the city's economic development office plus the electric utility (several utilities already pay $100-200 per linear foot for exactly this). Where it applies on our map: the `Food` layer of `app/data/places.json`, limited to the shops whose name looks like a grocery, convenience or liquor store by the regex in `interventions/kitchen_water_efficiency_mc.py` (3,020 of the 17,157 Food shops). It does not touch restaurants, hotels, fuel or venues. It saves electricity only; water 0, food CO₂e 0 (doors do not change what is sold).

Ronak's `engines/playbook/plays.py` has **no placeholder** for this lever.

## How big is the cut (the "range")

**Only one whole-store meter reading exists.** Lindberg and colleagues put doors on about 50 m of vertical cabinets and 17 m of freezers in one Swedish supermarket in January 2008 and read the store's main meter three weeks before and three weeks after: **the whole store used 6% less electricity**, and the compressor circuit feeding the dairy and meat cabinets used 26% less. That is one store, in winter (when open cases leak least), for three weeks. Everything else measured is at the level of the case, not the store. So the cut is a formula from separately measured pieces, and the Swedish store is the cross-check:

> % of store electricity saved = refrigeration's share of the store's electricity × the open cases' share of refrigeration × the fraction of those cases' electricity the doors remove

Each piece is a triangle (low, middle, high) and we draw 100,000 combinations.

| piece | low / middle / high | where the numbers come from |
|---|---|---|
| refrigeration's share of the store's electricity | 35% / 48% / 55% | CBECS 2018 (EIA survey of US commercial buildings), Table E5: food-sales buildings use 54 billion kWh, 26 of it refrigeration = 48%. Westphalen 1996 (DOE) "approximately 50%", repeated by ORNL and by Fricke & Becker. Michaels Energy audited 50 Minnesota convenience stores: 50%. Lindberg: 40-50%. UK literature 35-50%. |
| open multi-deck cases' share of refrigeration electricity | 40% / 54% / 60% | ORNL/TM-2004/292 (Walker, Faramarzi, Baxter): medium-temperature fixtures and coolers are 70-75% of a store's refrigeration load and open multi-deck cases are about three quarters of that, so 0.53-0.56; open multi-deck cases are "about half of the refrigerated fixtures" in a typical store, confirmed by a southern California store survey; Navigant/DOE 2013 says the same ("roughly 50% of display cases are open medium-temperature"). Low end for stores that have already doored some aisles. |
| fraction of those cases' electricity the doors remove | 23% / 36% / 64% | Fricke & Becker 2010 (ASHRAE RP-1402): two Kansas supermarkets, 42 days of one-minute metering on a new open and a new doored dairy lineup: 2.21 vs 1.71 kWh per foot per day, 23% less, even though the doored case ran always-on door heaters and fluorescent lights (compressor energy fell 72%, heaters ate most of it back). Their estimate for no-heat doors plus LED: 0.80 kWh/ft/day, 64% less. ORNL 2004 lab-calibrated DOE-2 simulation of a whole supermarket: doors on all open vertical medium-temperature cases cut refrigeration electricity 19.5%, which against a 54% case share is 36% of the case's own use; the door package cut refrigeration 25.0% in Houston and 28.4% in Seattle. Lindberg's compressor circuit fell 26%. Faramarzi's SCE lab test (2002) cut refrigeration load 68% and compressor power 87%, the ceiling. |
| **share of grocery-like shops that still have open cases and take the grant** | 0.30 / 0.60 / 0.90 | **untested.** Nobody has surveyed how many US stores still run open cases. Navigant/DOE 2013 describes "a typical store" as half open cases, and every big US chain except ALDI still sells dairy from open cases, so the share of supermarkets is high; convenience stores mostly already use glass-door coolers, so for them it is low. This is a slider. |

Result, **per store that takes the grant: 6.8% / 9.4% / 13.0% of its total electricity** (10th / 50th / 90th percentile). Against the grocery visit in `data/curated/intensity_factors.csv` (1.2 kWh) that is **0.08 / 0.11 / 0.16 kWh per visit**. The one metered store (−6%, winter) sits just under the low end, which is where a winter reading should sit, so the formula is not obviously inflated. For the whole grocery-like pile on the map, with the slider applied, the average is **3.6% / 5.6% / 8.4%**.

The honest headline is "about 9% of a grocery store's electricity, somewhere between 7% and 13%, for each store that does it."

## What the organiser can turn

* **No-heat glass and LED lights, or cheap doors.** This is the biggest dial and it is in the grant terms. Fricke's measured 23% used heated doors and fluorescent tubes; the same doors with no-heat glass and LEDs are estimated at 64%. A grant that only pays for low-heat or humidity-controlled doors plus LED case lighting sits at the top of the range; a grant that pays for any door sits at the bottom.
* **Who gets the grant.** Supermarkets with long open dairy, meat and produce aisles are where the refrigeration share (48%) and the open-case share (54%) both hold. Convenience stores, delis and liquor shops already run glass-door coolers, so a grant there buys little. The slider should default high for supermarkets and low for the rest.
* **Re-tune the compressors.** The DOE retrofit guide is blunt that doors only deliver if the refrigeration system is reset for the smaller load (evaporator temperature raised, compressor staging adjusted). A grant that requires a commissioning visit keeps the saving; one that just pays for glass often does not.

## Blast radius on our map

The lever touches only the grocery-like part of the Food layer: **3,020 of the 20,569 shops on the map**, picked by brand name because `places.json` carries no NAICS code (the regex also catches delis, bakeries and liquor stores, so it is a rough net). In July 2024 those shops had **114,853 card customers** across the 11 cities (New York/New Jersey 32,686, Philadelphia 21,078, San Francisco Bay Area 17,222, Miami 12,283, Houston 10,240, Dallas 6,667, Atlanta 4,534, Seattle 4,084, Los Angeles 3,797, Boston 1,877, Kansas City 385). Within 2 km of a 2026 stadium there are 37 such shops with 608 customers; within 5 km, 162 shops with 5,271 customers. The stadium rings are context only: this lever is citywide and year-round.

Applying the range to that pile, the whole-July saving across all 11 cities is **9,400 / 13,000 / 17,900 kWh** if every one of those shops took the grant, and **5,000 / 7,700 / 11,500 kWh** with the slider. That is tiny, and the reason matters: a single supermarket uses 2-3 million kWh a year (ORNL), so one store's July saving alone is around 15,000-25,000 kWh, more than the whole pile above. `spend-patterns-rice` sees only card customers, and 1.2 kWh per visit is a hand-set factor, so the absolute kWh on the map is a floor, not a total. **The percentage is trustworthy; the kWh is not.**

## Where this is weak, in plain words

* Only one store has ever been metered whole before and after (Lindberg 2008, Sweden, winter, three weeks). Everything else is per case or simulated. A US summer reading would probably be higher than 6%, but nobody has taken one.
* The case-level saving was measured on dairy and beer cases in two small Kansas supermarkets in 2009. The 64% top end is an estimate, not a measurement.
* The "share of refrigeration in open cases" comes from a 2004 ORNL survey of typical stores; stores that have already doored some aisles will be lower.
* Doors stop the cases from cooling the store for free, so the air conditioning works a bit harder in summer (Houston, Miami, Dallas). Fricke argues the HVAC does that job more efficiently than the fridges, and the ORNL whole-store simulation still showed 25% refrigeration savings in Houston, but the net is not separately measured here.
* The slider (how many stores still have open cases and would sign up) is a guess with no survey behind it.
* The sales worry is real but the measured evidence says no loss: Fricke & Becker found dairy sales flat and beer sales up equally in the doored and the open store (statistically no effect); Lindberg's store saw no fall in sales and shoppers rated the aisle more comfortable. The only counter-claim (a 2017 shopper-filming study by a marketing consultancy) reports fewer product touches, not sales, and gives no method.
* The 1.2 kWh per grocery visit we divide by is the team's hand-set factor, not a measurement. The percent cut inherits that.
* Convenience stores, delis and liquor stores inside the regex mostly already have doors; the per-store percent is a supermarket number.

## Sources

Numbers with a direct link to the paper or report:

* Fricke & Becker 2010, *Doored Display Cases: They Save Energy, Don't Lose Sales*, ASHRAE Journal 52(9): two Kansas supermarkets, 42 days of metering, open 2.21 vs doored 1.71 kWh/ft/day (compressors 42.2 vs 11.7, door heaters 15.5 kWh/day), no-heat + LED estimate 0.80; dairy sales −2.8% vs −0.5% control, beer +27% vs +29%, "no effect on product sales". https://www.producefoodsafety.org/files/inline-files/displaycasedoors.pdf (final report RP-1402: https://www.producefoodsafety.org/files/inline-files/comparison_of_vertical_display_cases.pdf; Purdue conference version: https://docs.lib.purdue.edu/iracc/1154/; FMI 2010 slides with instrumentation: https://19january2021snapshot.epa.gov/sites/static/files/documents/Doored_vs_Open_Refrigeration_Cases_%202010FMI.pdf)
* Lindberg, Axell, Fahlén & Fransson 2008, *Supermarkets, Indoor Climate and Energy Efficiency – Field Measurements Before and After Installation of Doors on Refrigerated Cases*, Purdue IRACC paper 879: one Swedish supermarket, 975 m², doors on ~50 m of vertical cabinets + 17 m of freezers, whole-store electricity −6%, dairy/meat compressor circuit −26%, sales not lower, 270 shopper questionnaires. https://docs.lib.purdue.edu/iracc/879 (PDF: https://core.ac.uk/download/4955370.pdf)
* Walker, Faramarzi & Baxter 2004/2005, *Investigation of Energy-Efficient Supermarket Display Cases*, ORNL/TM-2004/292: open multi-deck MT cases ≈ half of fixtures and ≈ 3/4 of the 70-75% MT share of refrigeration load; DOE-2 simulation calibrated to lab tests: doors on open vertical MT cases −19.5% refrigeration electricity, door package 25.0% (Houston) to 28.4% (Seattle); baseline refrigeration 1.4-1.6 million kWh/yr per store; industry survey 9 for / 8 against doors. https://www.osti.gov/biblio/885840 (PDF: https://info.ornl.gov/sites/publications/Files/Pub57417.pdf)
* EIA, CBECS 2018, Table E5 *Electricity consumption by end use*: food sales 54 billion kWh total, 26 refrigeration. https://www.eia.gov/consumption/commercial/data/2018/ce/xls/e5.xlsx
* DOE / Navigant 2012 (rev. 2013), *Guide for the Retrofitting of Open Refrigerated Display Cases with Doors*: infiltration 70-80% of open-case load, doors cut case heat load 50-80%, anti-sweat and system re-tuning cautions. https://www1.eere.energy.gov/buildings/commercial/pdfs/cbea_open_case_retrofit_guide.pdf
* Goetzler (Navigant) 2013, DOE BTO peer review slides *Retrofitting Doors on Open Refrigerated Cases*: "typical store – roughly 50% of display cases are open medium-temperature"; supermarket 2-3 million kWh/yr, refrigeration ~50%. https://www.energy.gov/sites/prod/files/2013/12/f5/commlbldgs18_goetzler_040413.pdf
* Michaels Energy for Minnesota Commerce (CARD grant), *Improving Energy Efficiency in Convenience Stores*: 50 stores audited, refrigeration 50% of electricity, average 364,000 kWh/yr. https://mn.gov/commerce/energy/industry-government/cip/card-grant-search/card-project-pages/convenience-stores.jsp
* Efficiency Maine, Hannaford case study: 11 stores, doors on 12-ft open cases plus LED, 586,176 kWh/yr and 6,140 MMBtu heating claimed, payback 1.3 years with incentive (programme tracking, not an independent meter study). https://www.efficiencymaine.com/at-work/grocery-and-convenience/
* Regional Technical Forum (NW Power & Conservation Council), measure *Retrofit Doors on Grocery Display Cases* v3.1, approved Aug 2025: "reduces the refrigeration load by about half" (workbook not read). https://rtf.nwcouncil.org/measure/retrofit-or-upgrade-doors-existing-display-cases/

Numbers we only have second-hand, quoted inside the papers above, with no direct link found:

* Faramarzi, Coburn & Sarhadian 2002, *Performance and energy impact of installing glass doors on an open vertical deli/dairy display case*, ASHRAE Transactions 108(1): SCE lab, refrigeration load −68%, compressor power −87% (quoted by Fricke & Becker and ORNL).
* Westphalen, Zogg, Varone & Foran 1996, *Energy Savings Potential for Commercial Refrigeration Equipment*, DOE: refrigeration ≈ 50% of supermarket electricity (quoted by Fricke & Becker and ORNL).
* Evans 2014, *Are doors on fridges the best environmental solution for the retail sector?*, Proc. Institute of Refrigeration, and Brown, Foster & Evans 2014 (IIR): literature range 25-80% saving on the cabinet; quoted in an RD&T news item at https://www.rdandt.co.uk/news/doors_on_cabinets, paper not accessed.
* ENERGY STAR small-business page: refrigeration "up to 40 percent" of a convenience store's energy.

Claims we looked at and did NOT use, because they carry no method or are not a store measurement:

* Shopping Behaviour Xplained 2017 in-store filming: "29% fewer buyers" with doors; shopper touches, not sales, no store count or method. https://www.coolingpost.com/features/study-sees-fridge-doors-sales-barrier/
* Aldi UK "expects 20% lower electricity bills" with doors (press statement). https://feeds.bbci.co.uk/news/uk-wales-59141894
* Zeng, Luo et al. 2015, Postharvest Biology and Technology, spinach case with doors "69% less energy": one test case, not a store. https://sciencedirect.com/science/article/abs/pii/S0925521415300466
* Cool Products / JRC 2014 EU-wide TWh potentials and Bio Intelligence 2007: modelled totals, not measured stores. https://www.coolproducts.eu/uncategorized/why-dont-supermarket-fridges-have-doors/
* Vendor pages (Taper, Remis, Waypoint Energy) repeating "up to 50%" with no source.
