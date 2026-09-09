# Lever: hotel water programme (towel/linen reuse + shower, tap and toilet retrofits)

*Merged 2026-08-19 from the two earlier cards `hotel_linen_reuse.md` and `hotel_shower_tap_retrofits.md`. Bucket: **before** (a hotel-association programme plus grants, set up months ahead; it keeps working after 2026). Numbers come from `interventions/hotel_water_programme_mc.py`; run it from the repo root to reproduce every figure here.*

## What the lever is

One programme with two parts that touch different water, so their savings add. **Part A, towel and linen reuse:** hotels put the "hang up your towel, keep your sheets" card in rooms, so laundry is skipped on the nights guests say yes. **Part B, bathroom retrofits:** grants to fit WaterSense showerheads, tap aerators and low-flush toilets in guest rooms, so every shower, flush and hand-wash uses less.

Who does it: the hotel association in each host city plus the water utility. Where it applies on our map: every shop tagged `Water` in `app/data/places.json`, which is the Traveler Accommodation type from `spend-patterns-rice` (515 hotels across the 11 cities).

## Headline

Per guest-night, as % of the lodging visit in `data/curated/intensity_factors.csv` (300 L, 28 kWh), 10th / 50th / 90th percentile:

| part | water cut | energy cut |
|---|---|---|
| A, towel and linen reuse | 2.5% / 4.0% / 6.1% | 4.4% / 6.6% / 9.8% |
| B, shower, tap and toilet retrofits | 7.3% / 9.5% / 12.3% | 1.4% / 1.9% / 2.6% |
| **A + B, the programme** | **10.9% / 13.7% / 17.0%** | **6.2% / 8.6% / 11.8%** |

Ronak's `hotel_water_reuse` placeholder in `engines/playbook/plays.py` is water −30%, energy −3%. The honest whole-programme number is about half of that on water and about three times it on energy (laundry is hot water and dryers).

## Part A: how big is the towel/linen cut

**Nobody has measured a whole hotel's water meter before and after starting one of these programmes.** The numbers everyone repeats ("17 gallons per room per day", "17% fewer loads") come from a Florida utility page and a hotel-industry guideline, with no method or sample behind them, so we do not use them.

Instead we use the formula the EU's Joint Research Centre gives in its official hotel best-practice guide (chapter 5, "Laundry reuse programmes"):

> water saved per occupied room-night = share of nights guests take part × kg of laundry per room-night × litres of water per kg washed

Each of the three pieces has been measured separately, in several places, so we give each one a range and combine them by drawing 100,000 random combinations (Monte Carlo). We report the 10th and 90th percentile, meaning eight times out of ten the true value should land inside, and the middle (50th) as the headline.

The three pieces, with sources:

| piece | low / middle / high | where the numbers come from |
|---|---|---|
| share of nights guests take part | 30% / 38% / 49% | Goldstein, Cialdini & Griskevicius 2008, two field experiments in a US hotel: 35.1% and 37.2% with the standard "save the environment" card, 44.1% and about 49% with a "most guests in this room reused" card. Replicated by Schultz et al. 2008 and Reese et al. 2014 (links below). 30% is the floor for a weak programme. |
| kg of laundry per occupied room-night | 2.3 / 4.0 / 5.4 | Alliance for Water Efficiency 2009 (2.3 kg), Accor 2010 (4 kg), O'Neill et al. 2002 US study median 5.4 kg (range 2.4–15.8), Scandic 2 kg and Hilton 3.7 kg per guest-night (Bohdanowicz & Martinac 2007). All quoted in the JRC guide. |
| litres of water per kg laundry | 5 / 9.6 / 20 | JRC guide: large efficient laundries 5–6 L/kg, benchmark ≤5–7, European average machine 9.6, modern washer-extractors 8, small non-optimised laundries over 20. |
| kWh per kg laundry (wash, dry, iron) | 0.9 / 1.5 / 2.9 | JRC guide: benchmark ≤0.9, worked example 1.5, Carbon Trust 2009 small on-premise laundries 2.0–2.9. |

Result, per occupied room-night: **water 10.6 / 16.7 / 25.7 litres**, **energy 1.7 / 2.6 / 3.8 kWh** (10th / 50th / 90th percentile). The absolute extremes of the simulation were 4 and 46 litres, which is why we do not report the full min-to-max: it is dominated by hotels where every ingredient is extreme at once, which is rare.

Our map counts card customers, which is closer to a guest than a room, so we divide by 1.4 guests per room (the Accor assumption the JRC uses). Per guest-night that is **7.6 / 11.9 / 18.4 litres** and **1.2 / 1.8 / 2.7 kWh**. Against the lodging visit in `data/curated/intensity_factors.csv` (300 L, 28 kWh) that is a **2.5% / 4.0% / 6.1% water cut** and a **4.4% / 6.6% / 9.8% energy cut**.

So Ronak's hardcoded −30% water in `engines/playbook/plays.py` is about seven times too high. The honest headline is "about 4% of hotel water, somewhere between 2.5% and 6%".

## Part B: how big is the shower/tap/toilet cut

Two US hotels have been metered before and after this exact retrofit, both in San Antonio, both through the utility programme above. The Holiday Inn Airport (397 rooms, built 1981, fittings never upgraded) went from 202 to 132 gallons per occupied room per day, a 35% cut, 7 million gallons a year. The Hilton Palacio del Rio (470 rooms, built 1968) went from 209 to 107 gallons per room per day, 49%, though that hotel also swapped its ice machines. **Both started from 3.5 and 5.0 gallon-a-flush toilets.** A hotel built or renovated after 1994 already has 1.6 gallon toilets and 2.5 gallon-a-minute showerheads by law, so it cannot save anything like that. That is why we do not just copy the 35%: we build the saving fixture by fixture and let the room's starting point be the big unknown.

The formula, for each of the three fittings:

> litres saved per occupied room-night = minutes (or flushes) per room-night × (old flow − new flow) × in-situ factor × behaviour factor

summed over shower, toilet and tap, then weighted by what the room had before: rooms already at WaterSense level save nothing, standard post-1994 rooms save a little, pre-1994 rooms save a lot. Energy is the warm water not drawn (shower and tap only; toilets are cold) times the kilowatt-hours it takes to heat a litre. Each piece is a triangle (low, middle, high) and we draw 100,000 combinations.

| piece | low / middle / high | where the numbers come from |
|---|---|---|
| shower minutes per occupied room-night | 8 / 12 / 16 | Seattle Public Utilities 2002: data loggers on a block of four occupied rooms at the West Coast Grand, 12 min/room/day at 2.5 gpm (30 gal); Westin Seattle estimated 13 min; REUWS 2016 7.8 min per shower at home, times 1.4 guests |
| toilet flushes per room-night | 4 / 7 / 9 | Seattle 2002 logged 7 flushes/room/day; REUWS 2016 5.0 flushes per person per day × 1.4 guests; JRC assumes 5 per guest-night incl. the cleaner's flush |
| tap minutes per room-night | 1 / 2.5 / 6 | Seattle 2002 logged about 1 min/room/day (2.5 gal); JRC assumes 6 min per guest-night including 2 min of cleaning |
| new showerhead flow | 1.5 / 1.75 / 2.0 gpm | WaterSense label maximum 2.0 gpm; San Antonio required under 1.75; Hilton Palacio fitted 1.5 |
| new toilet flush | 0.9 / 1.28 / 1.28 gpf | WaterSense maximum 1.28; San Antonio fitted 1.1 and 1.28/0.8 dual-flush |
| new tap flow | 1.0 / 1.5 / 1.5 gpm | WaterSense private-lavatory maximum 1.5 gpm; San Antonio fitted 1.5 |
| in-situ factor (rated vs real flow) | 0.80 / 0.90 / 1.00 | LBNL 2006: 2.5-gpm-rated heads measure 2.2 gpm in homes (REUWS, Seattle), "throttling factor" 0.9 |
| behaviour factor (longer showers after the swap) | 0.85 / 0.96 / 1.00 | EBMUD 2003 and Tampa 2004 metered retrofits and REUWS: duration "similar with and without" low-flow heads (Tampa 8.0 → 7.8 min, EBMUD 8.9 → 8.2); LBNL calls the evidence "conflicting", so we allow up to 15% rebound |
| standard post-1994 room | 2.5 gpm shower, 1.6 gpf toilet, 2.2 gpm tap | US federal maximums since 1994 (EPAct 1992), stated in WaterSense at Work |
| old pre-1994 room | 3.5 gpm, 3.5 gpf, 3.0 gpm | what Seattle found at the 1980s Westin towers and San Antonio found at the Holiday Inn (3.5 and 5.0 gpf) |
| **share of rooms still pre-1994** | 0.02 / 0.08 / 0.25 | **untested.** Nobody has surveyed US hotel bathrooms. 32 years of fixture turnover say it is small; the San Antonio hotels say it is not zero |
| **share of rooms already at WaterSense level** | 0.20 / 0.40 / 0.60 | **untested.** Seattle's 2001 survey of 20 hotels: 90% said they had low-flow showerheads and aerators, 50% low-flow toilets; the big chains now specify efficient fittings, but no count exists |
| kWh per litre of shower water saved | 0.018 / 0.030 / 0.043 | formula 1.163 Wh per litre per °C × temperature lift ÷ heater efficiency; lift 15 / 22 / 28 °C (mixed shower about 38–40 °C over cold-water inlet 10–25 °C), efficiency 0.75 (gas) to 0.98 (electric). LBNL 2006 gets 0.112 kWh/gal electric = 0.030 kWh/L; JRC gets 52 kWh per m³ at 45 °C |
| kWh per litre of tap water saved | 0.010 / 0.020 / 0.031 | same formula with lift 8 / 15 / 20 °C (JRC assumes 20 °C for taps; REUWS: 57% of tap water is hot) |

Result, per occupied room-night: a **standard post-1994 room saves 40 / 49 / 59 litres**, a **pre-1994 room saves 124 / 144 / 165 litres**, and averaged over a hotel stock with the shares above the saving is **31 / 40 / 52 litres of water and 0.54 / 0.75 / 1.02 kWh** (10th / 50th / 90th percentile). For the old rooms that is below what San Antonio measured (the Holiday Inn saved 70 gallons, 265 litres, per occupied room), which is expected: the metered number also contains the leaking 1981 toilet flappers that got thrown away (Seattle found 15% of the old Westin's toilets leaking, about 35 gallons a room a day unaccounted for) and the hotel's other water projects. So our figures are conservative for old hotels.

Our map counts card customers, which is closer to a guest than a room, so as in the linen card we divide by 1.4 guests per room. Per guest-night that is **21.9 / 28.7 / 36.8 litres** and **0.38 / 0.53 / 0.73 kWh**. Against the lodging visit in `data/curated/intensity_factors.csv` (300 L, 28 kWh) that is a **7.3% / 9.6% / 12.3% water cut** and a **1.4% / 1.9% / 2.6% energy cut**. Food CO₂e: 0%, nothing about a showerhead changes what anyone eats.

The honest headline is "about 10% of hotel water, somewhere between 7% and 12%, and about 2% of hotel energy". The range is narrow only because the two "share of rooms" sliders are triangles around guesses; if a city's hotels turn out to be mostly renovated since 2010, the cut is nearer 5%; if it has many old budget hotels, nearer 15%.

**Overlap with towel and linen reuse: none.** Linen reuse cuts laundry water (the washing machines); this lever cuts guest bathroom water (shower, toilet, tap). They are different end uses and different bits of hot water, so the two percentages add: roughly 4% + 10% ≈ 14% of the hotel visit's water. The only thing they share is the 300 L per visit they are both divided by.

## What the organiser can turn

Part A dials:

Two dials move the range and are genuinely under a policymaker's control, so the app should expose them instead of hiding them in the average:

* **Opt-in vs opt-out.** All the measured participation numbers above are opt-in ("hang the towel if you want it kept"). Opt-out programmes ("we only change sheets if you ask") are reported anecdotally at 60–70% participation, but no controlled study exists, so the app should show that setting with an "unmeasured" tag.
* **Laundry efficiency.** A city whose hotels use outsourced large laundries sits at the 5–8 L/kg end; old on-site machines at 20. This is knowable per hotel and shifts the water saving by 3×.

Part B dials:

* **Screen the hotels first.** The whole lever lives or dies on which hotels still have old kit. Walking a plumber through the oldest hotels first (built or last renovated before 1994) puts every dollar where a room saves 140 litres a night instead of 50, and catches the leaking toilets that the Seattle and San Antonio work both found. This is the untested slider and the app should show it as one ("share of rooms with old fittings"), not as a fixed number.
* **Pay for it, do not just ask.** San Antonio's utility spent about $100,000 per 400-room hotel, paid back in under two years at the hotel's water and energy prices, and took the only step that actually happened at scale: it bought and installed the fixtures. A rebate-only programme depends on hotel engineering budgets, which the Seattle survey found were the main blocker (only 26% of hotels thought their parent company cared).
* **Showerhead only vs all three.** The showerhead is about two-thirds of the saving in a standard room and carries most of the energy saving; it costs $20–50 and takes ten minutes. Toilets cost $100–150 each plus a plumber and only matter in pre-1994 rooms. A showerhead-and-aerator-only programme gives roughly four-fifths of the saving in a standard room (about 7–8% of water); toilets are what matter in old hotels, where a 3.5-gallon flush is most of the room's water.

## Blast radius on our map

The lever touches only Traveler Accommodation shops: 515 of the 20,569 shops on the map. In July 2024 those hotels had **5,744 card customers in total** across all 11 cities (San Francisco Bay Area 2,877, New York/New Jersey 848, Miami 604, Philadelphia 513, Seattle 484, everyone else under 100). Within 2 km of a 2026 stadium there are 10 hotels with 34 customers; within 5 km, 43 hotels with 585 customers.

Applying the combined range to that pile, the whole-July saving across all 11 cities is **188 / 236 / 294 m³ of water and 10,000 / 13,800 / 19,000 kWh**. That is small, and the reason matters: `spend-patterns-rice` sees hotel stays very poorly (a hotel shows a few dozen card customers a month where it clearly has hundreds of room-nights), so the pile on our map is much smaller than the real pile. The map should say this plainly: **the percentage is trustworthy, the absolute litres shown for hotels are a floor, not a total.**

## Where this is weak, in plain words

Part A:

* The formula counts a whole room's laundry as avoided on a "yes" night. If a guest reuses towels but sheets are still changed, the true saving is lower. The 30% floor on participation partly covers this.
* Participation was measured on business and leisure guests in ordinary weeks, not on football fans during a tournament. Fans staying 2–4 nights are the ideal case for reuse (one-night stays gain nothing), so if anything the numbers lean conservative for World Cup weeks.
* Every input is a triangle between literature low and high; none of the studies were done in the 11 host cities.
* The 300 L and 28 kWh per lodging visit we divide by are the team's hand-set factors, not measurements. The percent cut inherits that.

Part B:

* The two shares that matter most (how many rooms still have pre-1994 fittings, how many are already efficient) are guesses. Nobody has surveyed US hotel bathrooms, and since 1994 every fixture sold has been 2.5 gpm / 1.6 gpf / 2.2 gpm at worst, so the big savings that made the San Antonio case studies famous are mostly already banked in newer hotels.
* Minutes of showering and number of flushes come from four logged rooms in one Seattle hotel in 2000, plus home studies scaled by 1.4 guests. Football fans in July may shower more than business travellers in a Seattle August; that would push the saving up, not down.
* The two metered hotel results are from one utility programme in one city, both in old hotels, and one of them mixes in ice machines. There is no metered result for a retrofit of a post-1994 hotel; for that case we rely on the fixture formula and the home retrofit studies.
* Leaks are left out of the numbers. A retrofit of old toilets also stops flapper leaks, which Seattle measured at about 35 gallons a room a day in one tower; that would be a sizeable extra saving in old hotels, but we cannot put a share on it.
* The energy number is a formula (litres × temperature lift × 1.163 Wh), not a metered result. The Holiday Inn's 330,000 kWh a year is also an estimate; the hotel never metered it. Heater and pipe losses are ignored, so the energy saving leans low.
* The 300 L and 28 kWh per lodging visit we divide by are the team's hand-set factors, not measurements. The percent cut inherits that.

Both parts are built on the same 300 L and 28 kWh per lodging visit, which are the team's hand-set factors, not measurements; the percent cuts inherit that.

## Sources

Part A (towel and linen reuse):

Numbers with a direct link to the paper or report:

* Goldstein, Cialdini & Griskevicius 2008, *A Room with a Viewpoint*, Journal of Consumer Research 35(3): participation 35.1% / 44.1% (study 1) and 37.2% / ~49% (study 2). https://doi.org/10.1086/586910
* Schultz, Khazian & Zaleski 2008, *Using normative social influence to promote conservation among hotel guests*, Social Influence 3(1): replication, same ballpark. https://doi.org/10.1080/15534510701755614
* Reese, Loew & Steffgen 2014, *A Room with a Viewpoint Revisited*, J. Social Psychology: replication. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4118982/
* Bohdanowicz & Martinac 2007, *Determinants and benchmarking of resource consumption in hotels*, Energy and Buildings 39(1): Scandic 2 kg and Hilton 3.7 kg laundry per guest-night. https://doi.org/10.1016/j.enbuild.2006.05.005
* O'Neill & Siegelbaum / The RICE Group 2002, *Hotel Water Conservation: A Seattle Demonstration*, for Seattle Public Utilities: US median 5.4 kg (12 lb) laundry per occupied room-night, range 2.4–15.8 kg. https://www.seattle.gov/documents/Departments/SPU/Documents/HotelWaterConservation.pdf (the link returned 404 on 2026-08-18; the figure is quoted in the JRC guide, footnote 9)
* JRC (European Commission Joint Research Centre), *Best Environmental Management Practice in the Tourism Sector*, chapter 5: the formula, the worked example, litres per kg (5–6 large laundries, 7 benchmark, 8 Hohenstein 2010, 9.6 European average, >20 small non-optimised), kWh per kg (0.9 benchmark, 1.5 example, 2.0–2.9 Carbon Trust 2009), 1.4 guests per room. https://green-forum.ec.europa.eu/document/download/31ee1841-92ff-4eb9-b37e-9fc1f4d66bb7_en?filename=2_PDFsam_BEMP-5-FINAL.pdf
* Styles, Schoenberger & Galvez-Martos 2015, *Water management in the European hospitality sector*, Tourism Management 46: peer-reviewed summary of the same JRC work. https://www.sciencedirect.com/science/article/abs/pii/S026151771400137X

Numbers we only have second-hand, quoted inside the JRC guide, with no direct link found:

* Accor 2010 (4 kg laundry per room-night; 1.4 guests per room).
* Alliance for Water Efficiency 2009 (2.3 kg / 5 lb per room-night). Their hotel page is at https://www.allianceforwaterefficiency.org but the 2009 text is not online.
* Hohenstein Institute 2010 (8 L per kg for washer-extractors).
* Carbon Trust 2009 (2.0–2.9 kWh per kg for small on-premise laundries).

Claims we looked at and did NOT use, because they carry no method:

* EPA WaterSense, *Saving Water in Hotels* fact sheet, "17% fewer laundry loads", footnoted to an American Hotel & Lodging Association guideline. https://19january2017snapshot.epa.gov/www3/watersense/docs/saving-water-in-hotels_fact%20sheet_508_Mar2016.pdf
* SWFWMD Water CHAMP, "17 gallons per occupied room per day". https://www.swfwmd.state.fl.us/residents/water-conservation/water-champ
* Nature Humanities & Social Sciences Communications 2025, metered rooms in one Mallorca hotel: information cards alone did not cut room water; not a laundry measurement. https://www.nature.com/articles/s41599-025-04608-2

Part B (shower, tap and toilet retrofits):

Numbers with a direct link to the paper or report:

* O'Neill & Siegelbaum / The RICE Group 2002, *Hotel Water Conservation: A Seattle Demonstration*, for Seattle Public Utilities: four occupied rooms data-logged at 10-second intervals (43.7 gal per occupied room per day; 7 flushes at 1.6 gpf; 12 min shower at 2.5 gpm, 2/3 hot; 1 min tap at 2.5 gpm); Westin towers at 3.5 gpm / 3.5 gpf, 15% of toilets leaking, 35.6 gpd/room unaccounted; 20-hotel survey (90% had low-flow heads, 50% low-flow toilets). The seattle.gov link is dead; archived copy: https://web.archive.org/web/20190819042844/http://www.seattle.gov/Documents/Departments/SPU/Documents/HotelWaterConservation.pdf
* EPA WaterSense 2014, *Hotel Installs Water-Efficient Sanitary Fixtures* (Holiday Inn San Antonio International Airport): 397 rooms, 3.5/5.0 → 1.1 gpf, 2.2 → 1.5 gpm, 2.5 → 1.75 gpm, metered 202 → 132 gal per occupied room per day (−35%), 7 million gal/yr, ~$100,000 cost, payback under 2 years, 330,000 kWh estimated. https://www.epa.gov/sites/default/files/2017-01/documents/ws-commercial-casestudy-holiday-inn-sanantonio.pdf
* EPA WaterSense 2014, *Texas Hotel Upgrades to Four-Star Water Efficiency* (Hilton Palacio del Rio): 470 rooms, 5.0 → 1.28/0.8 gpf, 2.2 → 1.5 gpm, 2.5 → 1.5 gpm plus ice machines, 209 → 107 gal per room per day (−49%), 26 million gal/yr; "sanitary fixtures account for 30 percent of a hotel's total water use". https://19january2021snapshot.epa.gov/sites/static/files/2017-01/documents/ws-commercial-casestudy-hilton-palacio.pdf
* EPA WaterSense 2012, *WaterSense at Work*, sections 3.2 toilets (3.5/5.0 gpf before 1994, 1.6 after, WaterSense 1.28), 3.4 faucets (2.2 gpm federal, WaterSense 1.5 for private use such as hotel rooms) and 3.5 showerheads (2.5 gpm since 1994, older 3.0–5.0, WaterSense 2.0, Equation 3-7, 8-minute shower). https://www.epa.gov/sites/default/files/2017-02/documents/watersense-at-work_final_508c3.pdf
* Biermayer 2006, LBNL-58601, *Potential Water and Energy Savings from Showerheads*: 2.2 gpm measured on 2.5-rated heads, throttling factor 0.9, 8.2 min, "three AWWA end-use studies (Seattle, EBMUD, Tampa) indicated that the duration of showers was similar with and without low-flow showerheads", energy 0.112 kWh/gal electric (45 °F lift, 0.98) and 498 Btu/gal gas (0.75). https://map-testing.com/wp-content/uploads/2022/11/LBNL-Showerhead-final-rpt.pdf
* Heschong Mahone Group 2011, CASE report *Multi-head Showers and Lower Flow Shower Heads* for the 2013 California Title 24: table of metered retrofits, EBMUD 2003 (33 homes, 2.0 → 1.8 gpm in situ, 12.0 → 11.4 gal/person/day), Tampa 2004 (49 homes, 2.1 → 1.7 gpm, 15.2 → 11.0 gal/person/day, 8.0 → 7.8 min), REUWS 1999 low-flow vs mixed homes. https://title24stakeholders.com/wp-content/uploads/2020/01/CASE-Report_Multi-Head-Showers-and-Lower-Flow-Shower-Heads-1.pdf-1.pdf
* Water Research Foundation 2016, *Residential End Uses of Water, Version 2*, executive report: 5.0 flushes per person per day, 7.8 min per shower, flow down only 0.1 gpm since 1999, shower hot water 17.8 of 26.9 gal/household/day (66%), faucet 15.4 of 27.0 (57%). https://www.circleofblue.org/wp-content/uploads/2016/04/WRF_REU2016.pdf
* JRC (European Commission Joint Research Centre), *Best Environmental Management Practice in the Tourism Sector*, chapter 5: guest-room water "over 200 L per guest-night" at 15 L/min showers and 12 L flushes; 1.16 kWh per m³ per °C and "52 kWh per m³ of hot water at 45 °C"; per-fitting savings 17.5 / 11.7 / 9.1 m³ a year and 677 / 301 kWh for shower / tap; low-flow showers cut a hotel's total water "almost 10%", taps 5%, toilets 3.5%; benchmark ≤100 L and 3.0 kWh per guest-night for en-suite bathrooms; 1.4 guests per room; Table 5.1 hotel average 312 L per guest-night. https://green-forum.ec.europa.eu/document/download/31ee1841-92ff-4eb9-b37e-9fc1f4d66bb7_en?filename=2_PDFsam_BEMP-5-FINAL.pdf
* EPA WaterSense, *Saving Water in Hotels* fact sheet: the San Antonio 7 million gallons figure, restrooms as the largest hotel water use. https://19january2017snapshot.epa.gov/www3/watersense/docs/saving-water-in-hotels_fact%20sheet_508_Mar2016.pdf

Numbers we only have second-hand:

* Mayer & DeOreo 1999, *Residential End Uses of Water* (AWWARF): 8.2 min, 2.2 gpm, quoted by LBNL and WaterSense at Work; the book is behind the AWWA paywall.
* DeOreo & Mayer 2000, *Seattle Home Water Conservation Study*, and the EBMUD 2003 and Tampa 2004 retrofit studies: metered before/after, quoted in the LBNL and CASE reports above; the originals were not found online.
* Accor 2010 (1.4 guests per room) and ITP 2008 (hotel sub-meter splits), quoted in the JRC guide.
* Tiefenbeck et al. 2019, Nature Energy, 19,596 showers in six Swiss hotels: shows hotel showers can be metered cheaply and that feedback alone cut shower energy 11.4%; we could not reach the per-shower litres behind the paywall. https://www.nature.com/articles/s41560-018-0282-1

Claims we looked at and did NOT use, because they carry no method:

* "Hotels can cut water 15–30% with low-flow fixtures" and similar figures on plumbing-contractor and fixture-maker pages (Symmons, HVAC Morgan, Oxmaint): no data behind them.
* EPA WaterSense "Westin Riverwalk" case study: it is a laundry retrofit (washer-extractors, rinse reclaim), not fixtures, so it belongs to the linen card. https://www.epa.gov/sites/default/files/2017-01/documents/ws-commercial-casestudy-westin-river-walk.pdf
* The Seattle 2002 report's own "savings potential 10–20% of total hotel use, range 0–45%" from its case-study review: the authors say "very little documentation was provided" for those figures.

## Script output (2026-08-19)

```
Part A linen reuse: per occupied room-night water 10.6 / 16.7 / 25.7 L, energy 1.71 / 2.58 / 3.83 kWh
   p10 per guest: 7.6 L = 2.5% of 300 L; 1.22 kWh = 4.4% of 28 kWh
   p50 per guest: 11.9 L = 4.0% of 300 L; 1.84 kWh = 6.6% of 28 kWh
   p90 per guest: 18.4 L = 6.1% of 300 L; 2.74 kWh = 9.8% of 28 kWh
Part B fixture retrofits: per occupied room-night water 30.6 / 40.1 / 51.5 L, energy 0.54 / 0.75 / 1.02 kWh
   p10 per guest: 21.9 L = 7.3% of 300 L; 0.38 kWh = 1.4% of 28 kWh
   p50 per guest: 28.6 L = 9.5% of 300 L; 0.53 kWh = 1.9% of 28 kWh
   p90 per guest: 36.8 L = 12.3% of 300 L; 0.73 kWh = 2.6% of 28 kWh
   (B: a standard post-1994 room saves 40 / 49 / 59 L a night, a pre-1994 room 124 / 144 / 165 L)
COMBINED hotel water programme: per occupied room-night water 45.8 / 57.6 / 71.5 L, energy 2.45 / 3.35 / 4.62 kWh
   p10 per guest: 32.7 L = 10.9% of 300 L; 1.75 kWh = 6.2% of 28 kWh
   p50 per guest: 41.1 L = 13.7% of 300 L; 2.40 kWh = 8.6% of 28 kWh
   p90 per guest: 51.1 L = 17.0% of 300 L; 3.30 kWh = 11.8% of 28 kWh

Lodging shops on map: 515, July-2024 card customers: 5744
  San Francisco Bay Area    116 shops   2877 customers
  New York/New Jersey       123 shops    848 customers
  Miami                      35 shops    604 customers
  Philadelphia               13 shops    513 customers
  Seattle                    22 shops    484 customers
  Atlanta                    42 shops     97 customers
  Houston                    71 shops     90 customers
  Dallas                     23 shops     79 customers
  Los Angeles                44 shops     70 customers
  Boston                     12 shops     57 customers
  Kansas City                14 shops     25 customers
  p10: July-2024 saving all cities = 188 m3 water, 10035 kWh
  p50: July-2024 saving all cities = 236 m3 water, 13760 kWh
  p90: July-2024 saving all cities = 294 m3 water, 18971 kWh
  within 2 km of a 2026 stadium: 10 shops, 34 customers; within 5 km: 43 shops, 585 customers
```
