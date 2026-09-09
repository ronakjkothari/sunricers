# Lever: match ticket = free transit pass (free_transit_with_ticket)

*Written 2026-08-19. Numbers come from `interventions/free_transit_with_ticket_mc.py`; run it from the repo root to reproduce every figure here. It replaces the earlier `gasoline_visit_shift` card (removed 2026-08-19 because only 9 gas stations sit within 2 km of any 2026 stadium, so the map could never show it).*

## What the lever is

The match ticket is also a transit ticket. On match day (and usually the morning after) a ticket holder rides the host city's trains, buses and stadium shuttles for free, the agencies run extra service, and park-and-ride lots feed the rail lines. London 2012 did it with the Games Travelcard, the 2006 World Cup in Germany and EURO 2024 with the KombiTicket / 36-hour pass, Qatar 2022 with the Hayya card. Fewer fans drive, so less gasoline is burned across the region.

**Bucket: match day.** It is an **off-map** lever: the shop data cannot see it, so it lives on the match card as attendance × a per-fan saving, not as a shop-layer cut. Who does it: the host committee (which pays the agencies, as UEFA paid the German VDV), the transit agency, and venue operations. Ronak's `engines/playbook/plays.py` has **no placeholder** for this lever; its nearest one is `gasoline_visit_shift` (energy −10% citywide, every day), which the gasoline card already showed is about twice any defensible number.

The US 2026 tournament mostly did the opposite: NJ Transit charged $150 round trip to MetLife, the MBTA $80 to Gillette, and only Philadelphia gave free rides (Broad Street Line, after the match, paid for by Airbnb). So the lever is a real "could have" for these cities, not something already in the data.

## How big is the cut (the "range")

Per attending fan, the gasoline saved is:

> gallons per fan = share who would drive (C) × share of those the free pass moves to transit (R) × share of the drive actually avoided (G) × round-trip miles (D) ÷ (fleet mpg × people per car) × (1 − transit's own fuel, T)

Seven pieces. The agency and fleet pieces are measured by US government bodies; the behaviour pieces are measured at real events but not in a clean with/without test; the trip length is our assumption.

| piece | low / middle / high | where the numbers come from |
|---|---|---|
| C: car share without the programme | 55% / 80% / 90% | FHWA *Managing Travel for Planned Special Events* Table 5-12: SF Giants 48–58% auto, NY Mets 59%, SD Padres 85–95%; MetLife on a normal NFL day ~85–90% (NJ Transit Super Bowl XLVIII report, via the gasoline card). |
| R: share of car trips the pass removes | 5% / 20% / 45% | Low: AT&T Stadium 2026, charter buses ~6% of seats; Sacramento Kings, free light rail with the ticket, "up to 11%" of attendees by rail. Middle: Climate Pledge Arena, free pass in every ticket, 25% of fans by transit in year one; MetLife 2026 26–31% by rail even at $150; SoFi 2026 13–21% on Metro shuttles. High: 2006 World Cup Green Goal legacy report, same German stadiums, public transport ~40% before → 57% during (car 23% against ~45% expected), with the first-ever KombiTicket, little stadium parking and many foreign fans without cars; Super Bowl XLVIII parking cap, car trips −28 to −39%. London 2012 (95–100% public transport) was a parking *ban* and is left out of the triangle as a different lever. |
| G: share of the car trip actually avoided | 60% / 85% / 100% | Green Goal: park-and-ride was 5 of the 57 public-transport points, so ~1 in 11 riders still drove to a lot; US lots are bigger, so a wider range. Assumption anchored on that one number. |
| D: round-trip car miles | 20 / 40 / 80 | **Our assumption**, not a US measurement. Straight-line stadium ↔ downtown for the 11 hosts is 1–57 km (script); fans come from the whole metro. England home fans average 15.6 km (Dosumu et al. 2017); Rapid Vienna fans ~10 kg CO2e per car fan (~1.1 gal). |
| fleet mpg | 17.9 / 22.6 / 24.7 | FHWA Highway Statistics 2023 Table VM-1: all light-duty 22.6 mpg, short wheelbase 24.7, long wheelbase 17.9. Stadium traffic is stop-and-go, so true mpg is lower and the saving a little higher. |
| people per car | 2.15 / 2.5 / 3.1 | FHWA handbook Table 5-14, stadium vehicle occupancy; 2.5 is the common planning value. |
| T: transit's own fuel as a share of the car saving | 5% / 20% / 40% | DOE Transportation Energy Data Book Ed. 40 Table 2.13: a transit bus burns 34,877 Btu per vehicle-mile, so a full event bus (50 riders) is ~700 Btu per rider-mile against ~1,717 for a car with 2.5 people; a full rail car ~130; an extra rider on a train that runs anyway costs ~0. |

Result, **per attending fan: 0.04 / 0.09 / 0.16 gallons, 1.4 / 2.9 / 5.3 kWh, 0.37 / 0.76 / 1.40 kg CO2e** (10th / 50th / 90th percentile, tailpipe only; well-to-wheel adds about a quarter). Per *shifted* fan (the car rider who actually switches) that is 0.22 / 0.51 / 1.17 gallons, so the 1.14 gal per shifted fan the gasoline card borrowed from the Rapid Vienna study sits at our 90th percentile; the "for scale" lines in that card should be read as the high end. The share of car trips removed, R, lands at 13% / 23% / 35%.

Against the shop factors in `data/curated/intensity_factors.csv` there is nothing to divide by: the fuel is burned on the road, not bought at a mapped Gasoline Station (45 kWh per visit). For scale only, the median 2.9 kWh per fan is about three-quarters of one Spectator Sports visit (4.0 kWh).

## What the organiser can turn

* **Pay for the pass or charge for the train.** This is the whole lever. UEFA paid the German agencies so every ticket carried a 36-hour pass; NJ Transit and the MBTA charged $150 and $80 in 2026. The middle of R (20%) assumes a free pass with normal service; the low end (5%) is what a paid or thin service gets at a parking-lot stadium. The organiser's cost is the agency's lost fare plus extra service hours; we did not find a linkable cost-per-rider figure we trust, so the app should take it as an input, not show one.
* **Parking.** Every case above R ≈ 30% had a parking cap or very little stadium parking behind it (Green Goal, Super Bowl XLVIII, London 2012). Free transit alone, with 20,000 free spaces next door, stays near the low end. Levels: free pass only (R ≈ 5–20%), free pass + extra service + park-and-ride (≈ 20–30%), plus a parking cap (≈ 30–45%).
* **Which stadium.** Mercedes-Benz, Lumen Field, NRG and Lincoln Financial sit on rail in or near downtown; MetLife, AT&T, SoFi, Hard Rock, Gillette, Arrowhead and Levi's are parking-lot stadiums 10–57 km out. The achievable R and the trip length D both move with the site, so the match card should carry the number per stadium, not one number for all 11.

## Blast radius on our map

**Not in the shop data.** `spend-patterns-rice` counts card customers at shops; fuel burned on the freeway is not a shop visit, and the 9 gasoline stations inside any 2 km stadium ring (gasoline card) are not where this fuel would have been bought. So there is no shop layer, no shop count and no July-2024 customer pile for this lever. It is a match-card line.

Attendance basis from `app/data/stadiums.json` × `app/data/matches.json`: 78 US matches, every seat filled, **5,411,526 attendees**. Whole tournament, all 11 US stadiums: **226,000 / 462,000 / 854,000 gallons, 7,600 / 15,600 / 28,800 MWh, 2,000 / 4,100 / 7,600 t CO2e** (p10 / p50 / p90). One average match (69,379 seats): 2,900 / 5,900 / 11,000 gallons, 98 / 200 / 369 MWh, 26 / 53 / 97 t CO2e. Per stadium the script prints the same per-fan number times that stadium's seats (MetLife 8 matches ≈ 55,000 gallons at the median, Lumen Field 6 matches ≈ 34,000), because the trip-length range is not yet per stadium.

For perspective, the gasoline card's whole-tournament saving *on the map* (station visits within 2 km) was 102 kWh at the median; this lever's region-wide saving is 15,600 MWh, about 150,000 times larger, and none of it is visible in `places.json`.

## Where this is weak, in plain words

* No one has run the clean test: same stadium, same crowd, ticket with and without a free pass. Green Goal compares a World Cup crowd to a Bundesliga crowd; EURO 2024 (81% "eco-friendly", car under a fifth) has no "without"; Climate Pledge Arena and Sacramento are new arenas or one-line statements. R is a judgement over those, not a measurement of the pass itself.
* The middle and high of R lean on cases that also had little parking or foreign visitors without cars. A free pass at a US parking-lot stadium with no parking cap is the low end, and that is most of our 11.
* Trip length D is our assumption. It sets the size of every number here; halve it and everything halves.
* The agency and fleet numbers (mpg, occupancy, Btu per mile) are national averages, not match-day measurements.
* Cost is not quantified; we found no linkable cost-per-rider figure we trust.

## Sources

Numbers with a direct link to the report or paper:

* Öko-Institut for the 2006 FIFA World Cup OC, *Green Goal Legacy Report* (2006): public-transport share ~40% before → 57% during (52% from stations + 5% park-and-ride), walking 6%, coach 11%, car 23%; "expected 55% green (40% PT)" → 74–75% achieved; KombiTicket first used at a World Cup; Berlin >85% PT; car-park occupancy 25–46%; 800 t of the 17,000 t transport saving attributed to local access. https://www.oeko.de/oekodoc/292/2006-011-en.pdf
* TfL, *Travel in London Report 5* (2012), section 10: "between 95 and 100 per cent of Games related trips used public transport"; ticketed spectators issued a free Games Travelcard; 6.2 million Olympic spectators in London. https://content.tfl.gov.uk/travel-in-london-report-5.pdf
* FHWA, *Managing Travel for Planned Special Events* (2003), Table 5-12 modal split and Table 5-14 vehicle occupancy 2.15–3.1. https://ops.fhwa.dot.gov/publications/fhwaop04010/chapter5_03.htm
* FHWA, *Highway Statistics 2023*, Table VM-1: light-duty vehicles 22.6 mpg (short WB 24.7, long WB 17.9). https://www.fhwa.dot.gov/policyinformation/statistics/2023/pdf/vm1.pdf
* ORNL / US DOE, *Transportation Energy Data Book Ed. 40*, Table 2.13 (2019): cars 4,292 Btu/vehicle-mile at 1.5 occupancy; transit bus 34,877 Btu/vehicle-mile, 7.5 riders; transit rail 20,040 Btu/car-mile, 23.6 riders. https://tedb.ornl.gov/wp-content/uploads/2022/03/TEDB_Ed_40.pdf
* Climate Pledge Arena press release, 6 Jan 2023: "In our first year we've seen 25% of fans at Kraken and Storm games take public transit" with the free pass in every ticket. https://climatepledgearena.com/climate-pledge-arena-announces-free-public-transit-for-all-publicly-ticketed-events/
* Sacramento City Express, 16 Oct 2017: Kings ticket = free light-rail ride; "up to 11% of Golden 1 Center attendees" travelled by light rail. https://sacramentocityexpress.com/2017/10/16/sacrt-offers-free-ride-day-for-kings-season-opener/
* Dosumu, Colbeck & Bryant 2017, *Greenhouse gas emissions as a result of spectators travelling to football in England*, Scientific Reports: 1,649 fans, car 67.5%, 2.26 per car, home-fan mean 15.55 km, 1.70 kg CO2e per home trip. https://pmc.ncbi.nlm.nih.gov/articles/PMC5539281/
* Trains.com, 20 Apr 2026: SEPTA free Broad Street Line rides after matches (Airbnb-funded), NJ Transit $150 round trip, MBTA $80. https://www.trains.com/pro/passenger/rapid-transit/septa-to-offer-free-train-rides-after-world-cup-games-thanks-to-sponsor/
* edie, 20 Aug 2024, summarising UEFA's EURO 2024 report: "81% of spectators using eco-friendly transport to reach the stadiums". https://www.edie.net/carbon-insetting-funds-and-free-public-transport-how-sustainable-were-the-euros-2024/
* NJ TRANSIT Board, Super Bowl XLVIII transportation report (MetLife rail share 7–16% on a normal NFL day vs 34–43% at the Super Bowl with a 13,000-pass parking cap): http://www.mdmc-law.com/tasks/sites/mdmc/assets/Image/FINAL%20PUBLIC.pdf
* KERA News on AT&T Stadium 2026 charter buses (~6% of seats) and LAist on SoFi 2026 Metro shuttles (13–21%): press reports, links were in the removed gasoline card and are not re-verified here.

Numbers we only have second-hand:

* UEFA EURO 2024 ESG report (Nov 2024): "almost two-thirds of ticket holders used public transport within the host cities", 850,000+ Fan Pass activations, 275,000 DB tickets; VDV expected ~70% by public transport. uefa.com returned 403 from here; figures are from search snippets of https://www.uefa.com/news-media/news/0293-1c3aa0237fb8-cbccf668506c-1000--uefa-euro-2024-champions-sustainability-and-social-respon/
* Qatar Rail via QNA, 21 Dec 2022: 18.2 million Doha Metro and Lusail Tram passengers over the tournament, free with the Hayya card; no mode share. https://www.qna.org.qa/en/News-Area/Special-News/2022-12/21/0056-qatar-2022-182-million-passengers-used-doha-metro-,-a-,-lusail-tram-networks-during-world-cup
* Rapid Vienna study (J. Cleaner Production 2024): ~10.1 kg CO2e per car-borne spectator, as quoted in the gasoline card. https://www.sciencedirect.com/science/article/pii/S0959652624017074
* Loewen & Wicker 2021, Bundesliga fans: cars 70% of travel emissions; not opened. https://www.tandfonline.com/doi/abs/10.1080/14775085.2021.1932562
* US DOE / EPA constants: 33.7 kWh and 8.887 kg CO2 per gallon.

Claims we looked at and did NOT use:

* Pre-tournament forecasts ("70% will use public transport", "25% will take transit") without counts.
* Host-committee statements that transport "was a success" with no rider numbers.
* Thormann & Wicker 2024 stated-preference survey: what fans say they would do. https://doi.org/10.1177/15270025231200889
* London 2012's 95–100% as an R value: it is a parking ban plus a free pass, a different and much stronger lever; kept as the ceiling only.
* Any claim about fuel sales at nearby gasoline stations: that is the gasoline card's unknown S and is deliberately kept out of this card.

## Script output (2026-08-19)

```
free_transit_with_ticket: per ATTENDING fan, match day, region-wide (not a shop-visit number)
  gallons   p10 / p50 / p90 = 0.042 / 0.085 / 0.158
  kWh       p10 / p50 / p90 = 1.41 / 2.88 / 5.32
  kg CO2e   p10 / p50 / p90 = 0.37 / 0.76 / 1.40  (tailpipe; upstream adds ~25%)
  per SHIFTED fan: gallons p10 / p50 / p90 = 0.22 / 0.51 / 1.17  (gasoline_visit_shift card used 1.14 gal from the Rapid Vienna study)
  share of car trips removed, R: p10 / p50 / p90 = 13% / 23% / 35%
  Ronak's engines/playbook/plays.py: no placeholder for this lever (gasoline_visit_shift is energy -10% citywide).

Attendance basis: 78 US matches, every seat filled: 5,411,526 attendees
  stadium                    matches  attendees   km to downtown |  gallons saved p10 / p50 / p90 (whole tournament)
  MetLife Stadium              8      645,304      13          |    26,974 /    55,084 /   101,862
  AT&T Stadium                 9      635,841      28          |    26,578 /    54,276 /   100,368
  SoFi Stadium                 8      563,936      14          |    23,573 /    48,138 /    89,018
  Arrowhead Stadium            6      414,270      10          |    17,317 /    35,362 /    65,393
  Levi's Stadium               6      412,962      57          |    17,262 /    35,251 /    65,186
  NRG Stadium                  7      481,439       9          |    20,124 /    41,096 /    75,996
  Lincoln Financial Field      6      409,944       6          |    17,136 /    34,993 /    64,710
  Mercedes-Benz Stadium        8      545,912       1          |    22,819 /    46,599 /    86,173
  Lumen Field                  6      401,550       1          |    16,785 /    34,277 /    63,385
  Hard Rock Stadium            7      451,346      21          |    18,866 /    38,527 /    71,245
  Gillette Stadium             7      449,022      34          |    18,769 /    38,329 /    70,879

Whole tournament, all 11 US stadiums, 78 matches:
  p10:    226,204 gallons =    7,623 MWh =   2,010 t CO2e
  p50:    461,932 gallons =   15,567 MWh =   4,105 t CO2e
  p90:    854,214 gallons =   28,787 MWh =   7,591 t CO2e
One average match (69,379 seats): 2,900 / 5,922 / 10,951 gallons = 98 / 200 / 369 MWh = 26 / 53 / 97 t CO2e
NOT IN THE SHOP DATA: spend-patterns-rice sees gasoline-station card visits, not fuel burned on the road; the Energy layer has 9 stations within 2 km of any 2026 stadium (the removed gasoline card).
```
