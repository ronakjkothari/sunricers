# Lever: plant-forward concessions and catering defaults

*Written 2026-08-18. Numbers come from `interventions/plant_forward_concessions_mc.py`; run it from the repo root to reproduce every figure here.*

## What the lever is

The stadium's food seller (Aramark, Levy, Sodexo Live and friends run almost every US stadium) makes the plant-based version the normal one: the standard hot dog, burger or nachos on the board is the plant one, or at least half the menu is meat-free, and you have to ask for beef. The same rule goes into event catering (fan fests, hospitality suites, volunteer meals). It costs nothing to run, it is written into the concessions contract, and it stays after the tournament because the contract stays.

Who does it: the venue's concessions contract holder plus the city food policy office. What it changes: mostly the **food CO2e** of what fans eat, because a beef patty carries about ten times the greenhouse gas of a plant patty. It does **not** change the water or electricity the stadium building uses; the water saved is farm water hundreds of miles away.

Where it applies on our map: this is the awkward part, explained fully under "Blast radius". Short version: `spend-patterns-rice` almost never sees the stadium's own concessions, so the pile we can multiply on the map is small and mostly the wrong kind of place. The real pile is the 5.4 million fans in `app/data/matches.json`, which the map can show as an off-map number.

We do **not** apply this lever citywide to restaurants. A concessions contract reaches the stadium and the events the organiser caters, not the taco place two streets away. Restaurants within 2 km of a stadium on match days are shown below as an optional "voluntary pledge" extension, marked as such.

## How big is the cut (the "range")

**Nobody has measured a stadium's food sales mix before and after making plant-based the default.** The stadium stories that get repeated (Tottenham's "Game Zero", Forest Green Rovers) are club press releases with no baseline share and no method, so we do not use them as numbers.

What has been measured, many times, is (a) how much a menu change moves what people pick, in cafeterias, conferences and catered events, and (b) how much greenhouse gas one meat item carries versus one plant item. So the formula is:

> food CO2e saved per venue visit = share of concession items that switch from meat to plant × kg CO2e saved per switched item × concession meals per visit

Each piece is a triangle (low, middle, high) and we draw 100,000 random combinations. We report the 10th and 90th percentile, meaning eight times out of ten the true value should land inside, and the middle (50th) as the headline.

| piece | low / middle / high | where the numbers come from |
|---|---|---|
| share of items that switch meat → plant | 8 pp / 20 pp / 47 pp (percentage points of all main items sold) | Low: Garnett et al. 2019 PNAS, 94,644 meals in three Cambridge college cafeterias; doubling vegetarian options from 1-in-4 to 2-in-4 raised vegetarian sales by +7.8, +14.5 and +14.9 percentage points (41–79% relative), with no drop in total sales and no rebound at other meals. High: Boronowsky et al. 2022, three randomised trials at US catered events (Harvard, UCLA ×2, 280 people); with the plant meal as the default, plant choice went from 14–24% to 58–73%, +47 pp pooled. Middle: the strongest availability result and the pooled "change the decision structure" effect in Schäufele-Elbers et al. 2025 (33 field experiments, 78 effects: up to 30% less meat, defaults 54% less on average) applied to a menu that is ~80% meat. Hansen et al. 2021 (three Danish conference RCTs) got +80 pp with a pre-ordered vegetarian default; we treat that as the ceiling and do not use it, because pre-ordering a conference lunch is not walking up to a hot-dog stand. |
| kg CO2e saved per switched item | 0.5 / 1.5 / 3.3 | High: US quarter-pound beef patty 3.7 kg CO2e vs plant patty 0.4 (Heller & Keoleian 2018, cradle to distribution, beef from the NCBA-funded Thoma et al. 2017 LCA); Boronowsky 2022 used 3.84 vs 0.41 for a beef vs plant sandwich. Low: chicken item → plant item, Poore & Nemecek 2018 poultry 9.87 kg CO2e per kg × 113 g = 1.1 kg, minus 0.4 for the plant item, and US chicken LCAs sit lower, so 0.5. Middle: 1.5 for a real concession menu that mixes hot dogs (pork/beef, ~50 g meat), chicken tenders and beef burgers. **No measured item mix for US stadium concessions exists, so the middle is a judgement, not a measurement.** |
| concession meals per venue visit | 0.5 / 0.8 / 1.0 | **No source.** One card customer at a venue might buy nothing, one item or several. 1.0 = every customer buys one main item. This is a dial, not a fact. |
| upstream water saved per switched item | 50 / 100 / 200 L | Poore & Nemecek 2018 freshwater withdrawals per kg: beef 1,451 L, poultry 660 L, tofu 149 L; × 113 g gives chicken → plant 58 L, beef → plant 147 L. Heller & Keoleian's scarcity-weighted figure is 218 vs 1.1 L-eq per patty. This is farm and processing water, not stadium water. |
| energy | untested | Heller & Keoleian: 11.4 MJ beef patty vs 6.1 MJ plant patty (the plant patty's factory and packaging energy is high). Chicken → plant has no source and could be zero or slightly negative. On-site (cooking, fridges) nobody has measured a change. |

Result, per venue visit: **food CO2e 0.15 / 0.29 / 0.49 kg**, which against the Spectator Sports visit in `data/curated/intensity_factors.csv` (2.5 kg CO2e) is a **6% / 11.5% / 20% food CO2e cut**. Per concession meal actually sold, without the meals-per-visit guess, it is 0.20 / 0.38 / 0.64 kg. Against the Other Amusement visit (1.8 kg) it is 8% / 16% / 28%; against a restaurant visit (3.5 kg) it is 4% / 8% / 14%.

Water: **on-site 0%.** The 15 L per venue visit in `intensity_factors.csv` is toilets, cleaning and kitchen taps, and none of that changes when the patty changes. Upstream, 11 / 19 / 32 litres of farm water per visit are saved, which is more than the whole on-site number, so a "% of the factor" would be nonsense and we do not show one.

Energy: **on-site 0%, upstream untested.** If every switched item were a beef patty the upstream ceiling would be about 0.3 kWh per visit; for chicken swaps it may be nothing.

So Ronak's hardcoded numbers in `engines/playbook/plays.py` compare like this: food CO2e −25% is about twice our middle and just above our 90th percentile (a real number if the venue goes all-in on defaults and its menu is beef-heavy); water −8% and energy −5% have no measured basis on the site meter and should be shown as 0% with the upstream water as a separate line.

## What the organiser can turn

Three dials move the range and are genuinely in a concessions contract:

* **Default vs "more options".** This is the whole game. Adding plant options gets you 8–15 points of switching (Garnett); making plant the default gets 47 points (Boronowsky) and up to 80 in a pre-order setting (Hansen). The app should show these as two settings, "plant options doubled" and "plant is the default", not one average.
* **What the meat was.** Swapping beef saves 3.3 kg per item; swapping chicken saves about 0.5. A stadium whose top seller is a beef burger gains six times more per switch than one whose top seller is chicken tenders. This is knowable per venue from the concessionaire's sales report and shifts the answer more than anything else.
* **Scope: stadium only, or stadium + fan fest + hospitality + volunteer meals.** Catered meals (Boronowsky, Hansen) are where the default works best, because someone else picks the default for you. The 5.4 million stadium seats are the big number, but the catered meals are the sure thing.

## Blast radius on our map

Here is the thing Laksh must know before wiring this in. **The map's Venue layer is not stadiums.** Joining the 1,801 Venue shops in `app/data/places.json` to `data/curated/poi_efw.csv` by `PLACEKEY`: 552 are `Fitness and Recreational Sports Centers` (gyms), 245 are `Museums, Historical Sites, and Similar Institutions` (zoos, parks, museums), and only 34 are `Spectator Sports` or `Promoters of Performing Arts, Sports, and Similar Events` (arenas). The 2026 stadiums themselves are there but empty: Lincoln Financial Field shows 0–4 card customers in July 2024, Wells Fargo Center 0, the Seattle Mariners' park 0. Madison Square Garden (2,007) is the one arena the data sees. Concession sales clear through the concessionaire's merchant account, so `spend-patterns-rice` never sees them at the stadium's own placekey. **A per-visit % applied to the Venue layer would mostly be applied to gyms and zoos.**

The piles, July 2024 card customers, distance to the nearest 2026 stadium:

* Venue layer, all 1,801 shops: 14,571 customers; within 2 km of a stadium 46 shops / 721 customers; within 5 km 133 shops / 1,268.
* Arena-like Venue shops (Spectator Sports + Promoters): 34 shops, 2,086 customers, none within 2 km, 2 within 5 km. Some real stadiums are missing from this subset because they are not in `poi_efw.csv` at all.
* Food layer, all 17,157 shops: 400,006 customers. Of those, restaurants and eating places are 10,425 shops / 245,621 customers (**61% of food-layer customers are meal visits**), grocery + specialty food 1,928 shops / 107,861 (27%), 3,480 shops (7%) not in `poi_efw.csv` so type unknown.
* Restaurants within 2 km of a 2026 stadium: 169 shops, 5,243 customers; within 5 km 663 shops, 20,668.

Applying the range to those piles for the whole of July 2024: Venue layer 2.2 / 4.2 / 7.2 tonnes CO2e (and that is gyms and zoos, so not real), arena-like shops 0.3 / 0.6 / 1.0 t, restaurants within 2 km 0.8 / 1.5 / 2.6 t for the whole month and 0.2 / 0.5 / 0.8 t for just the +30% match-week extra spend. All tiny, all because the concessions themselves are invisible in card data.

The honest number is off-map. The 78 US fixtures in `app/data/matches.json` hold **5,395,633 attendees**. Attendees × meals per fan × share switched × kg per switch gives **807 / 1,547 / 2,670 tonnes CO2e** for the whole tournament's stadium concessions, plus 58 / 104 / 173 million litres of upstream farm water. The map should show that as a match-card line ("this fixture's 70,000 fans: about 20 t CO2e if concessions default to plant"), not as a per-shop recolouring, because there is nothing on the map to recolour. Per fixture it is attendance × 0.15 / 0.29 / 0.49 kg.

## Where this is weak, in plain words

* The percentages of shift come from cafeterias, conferences and catered dinners, not from a hot-dog stand with a queue and a beer in hand. Nobody has run the trial in a stadium. Grade for that piece: measured field trials, but in a different setting.
* The kg-per-item middle (1.5) is a judgement about what a US stadium menu is made of. Beef-heavy menus push it towards 3.3; chicken-and-pizza menus towards 0.5. Ask the concessionaire for the sales mix and the range collapses.
* Meals per visit (0.5–1.0) is a pure assumption. Everything scaled by it inherits that. Per meal sold, the numbers do not depend on it.
* Water and energy: the map's factors are on-site, this lever's savings are upstream. Showing them as a % of the on-site factor would be wrong. Ronak's −8% water and −5% energy should be 0% on-site.
* The 2.5 kg CO2e per Spectator Sports visit we divide by is the team's hand-set factor, not a measurement, and it bundles concessions with building operations; the % inherits that.
* Beef LCA numbers move a lot by method: Poore & Nemecek's global mean is 99 kg CO2e per kg beef, the US industry-funded Thoma et al. figure behind Heller & Keoleian works out near 33. We used the US figure for the high end, which is conservative.

## Sources

Numbers with a direct link to the paper or report:

* Garnett, Balmford, Sandbrook, Pilling & Marteau 2019, *Impact of increasing vegetarian availability on meal selection and sales in cafeterias*, PNAS 116(42): 94,644 meals; +7.8 / +14.5 / +14.9 percentage points vegetarian when options doubled; no rebound, no sales loss. https://pmc.ncbi.nlm.nih.gov/articles/PMC6800350/
* Boronowsky, Zhang, Nakamura et al. (Cleveland's group) 2022, *Plant-based default nudges effectively increase the sustainability of catered meals on college campuses: three randomized controlled trials*, Frontiers in Sustainable Food Systems 6: 24→67%, 14→58%, 18→73% plant choice under a plant default; +47 pp pooled; 3.84 vs 0.41 kg CO2e per beef vs plant sandwich. https://www.frontiersin.org/articles/10.3389/fsufs.2022.1001157/full
* Hansen, Schilling & Malthesen 2021, *Nudging healthy and sustainable food choices: three randomized controlled field experiments using a vegetarian lunch-default*, Journal of Public Health 43(2): 2→87%, 6→86%, 12.5→89% vegetarian under a vegetarian default. https://academic.oup.com/jpubhealth/article/43/2/392/5637580
* Schäufele-Elbers, Bosnjak, Gastaldello & Schamel 2025, *Nudging meat off the plate in foodservice? A systematic review and meta-analysis identifying moderators in field-based intervention studies*, Journal of Environmental Psychology: 33 field experiments, 78 effect sizes; decision-structure nudges up to −30% meat, defaults −54% on average, information nudges weak; prediction interval −50% to +28%. https://www.sciencedirect.com/science/article/pii/S0272494425003135
* Poore & Nemecek 2018, *Reducing food's environmental impacts through producers and consumers*, Science 360: per kg product, GHG beef (beef herd) 99.5, beef (dairy herd) 33.3, pork 12.3, poultry 9.9, tofu 3.2, peas 1.0 kg CO2e; freshwater withdrawals beef 1,451, poultry 660, tofu 149, peas 397 L. https://doi.org/10.1126/science.aaq0216 ; values read from Our World in Data's CSVs https://ourworldindata.org/grapher/ghg-per-kg-poore and https://ourworldindata.org/grapher/water-withdrawals-per-kg-poore
* Heller & Keoleian 2018, *Beyond Meat's Beyond Burger Life Cycle Assessment*, University of Michigan Center for Sustainable Systems report CSS18-10 (commissioned by Beyond Meat, ISO-style peer review): per quarter-pound patty, 0.4 vs 3.7 kg CO2e, 6.1 vs 11.4 MJ, 1.1 vs 218 L-eq scarcity-weighted water, beef from Thoma et al. 2017. https://css.umich.edu/sites/default/files/publication/CSS18-10.pdf
* Rose, Heller, Willits-Smith & Meyer 2019, *Carbon footprint of self-selected US diets*, AJCN 109(3): mean US diet 4.72 kg CO2e per person per day (about 1.6 kg per meal), top fifth 4.54 kg per 1,000 kcal; used only as a sanity check on the meal sizes above. https://pmc.ncbi.nlm.nih.gov/articles/PMC6408204/

Numbers we only have second-hand:

* Thoma et al. 2017 US beef LCA for the National Cattlemen's Beef Association: the beef side of Heller & Keoleian's comparison; the report itself is not open.
* Meier, Andor, Doebbe, Haddaway & Reisch 2022, *Do green defaults reduce meat consumption?* Food Policy 110: "green defaults" −54% meat on average; seen only through citations, consistent with Schäufele-Elbers 2025.
* Mertens et al. 2022 PNAS meta-analysis of choice architecture: food-domain effects roughly 2.5× other domains; seen through citations.

Claims we looked at and did NOT use, because they carry no method:

* Tottenham Hotspur / Sky "Game Zero" (Sep 2021): "94% more vegetarian and plant-based meals sold" at one match, no baseline share, no denominator, club and sponsor press release. https://www.skygroup.sky/article/sky-and-tottenham-hotspur-to-make-premier-league-fixture-against-chelsea-the-world-s-first-net-zero-carbon-major-football-match-ahead-of-cop26
* Forest Green Rovers all-vegan stadium: owner says food sales "probably" rose fourfold; anecdote, and a 5,000-seat ground. https://www.fgr.co.uk/vegan-food/
* Aramark, Levy and Sodexo Live plant-based menu announcements and pledges: menu counts, no sales mix published.
* Trade-press stories that "multiple stadiums saw a dramatic rise in category sales after switching to plant-based" (SmartBrief 2019, Green Sports Alliance): no data behind them.
* Sport teams' promotion of plant-based food consumption among fans (Sport Management Review 2023): interviews and strategy, no sales measurement. https://www.tandfonline.com/doi/full/10.1080/14413523.2023.2259146

## Script output (python3 interventions/plant_forward_concessions_mc.py, 2026-08-18)

```
Food CO2e saved per venue visit (10th / 50th / 90th percentile)
  0.15 / 0.29 / 0.49 kg CO2e per visit
  as % of the 2.5 kg Spectator Sports visit:   6.0% / 11.5% / 19.8%
  as % of the 1.8 kg Other Amusement visit:    8.3% / 15.9% / 27.5%
  as % of the 3.5 kg Restaurant visit:         4.3% / 8.2% / 14.1%
  per concession meal sold (no meals-per-visit guess): 0.20 / 0.38 / 0.64 kg CO2e
Upstream farm water saved per venue visit (litres; NOT comparable to the 15 L on-site factor)
  11 / 19 / 32 L per visit  (on-site water: no measured change, 0%)
Energy: on-site 0% (no measured change in cooking energy). Upstream only for beef swaps:
  ceiling if every swapped item were a beef patty: 0.29 kWh per visit (Heller & Keoleian 2018, 11.4 vs 6.1 MJ). Chicken->plant may be zero or negative. Untested.

Blast radius on the map (July 2024 card customers; distance = nearest 2026 stadium)
  Venue layer, all (what Ronak's engine would hit)             1801 shops    14571 July-2024 customers | <=2 km:   46 shops     721 cust | <=5 km:  133 shops    1268 cust
    of which Spectator Sports + event Promoters (arenas)         34 shops     2086 July-2024 customers | <=2 km:    0 shops       0 cust | <=5 km:    2 shops       3 cust
    of which Fitness and Recreational Sports Centers            552 shops     4212 July-2024 customers | <=2 km:    4 shops      76 cust | <=5 km:   30 shops     137 cust
    of which Museums, Historical Sites, zoos, parks             245 shops     3019 July-2024 customers | <=2 km:    7 shops     313 cust | <=5 km:   24 shops     371 cust
  Food layer, all                                             17157 shops   400006 July-2024 customers | <=2 km:  285 shops    6494 cust | <=5 km: 1062 shops   29617 cust
    of which Restaurants / eating places (meals)              10425 shops   245621 July-2024 customers | <=2 km:  169 shops    5243 cust | <=5 km:  663 shops   20668 cust
    of which Grocery + Specialty Food Stores (baskets)         1928 shops   107861 July-2024 customers | <=2 km:   19 shops     509 cust | <=5 km:  100 shops    4900 cust
    of which not in poi_efw.csv (type unknown)                 3480 shops    29974 July-2024 customers | <=2 km:   82 shops     631 cust | <=5 km:  209 shops    3162 cust
  share of Food-layer July-2024 customers that are restaurant/eating-place visits: 61% (grocery+specialty 27%, unknown 7%)

The 2026 stadiums themselves as they appear in spend-patterns-rice (July-2024 card customers):
  Lincoln Financial Field          Philadelphia           0.1 km  0 customers  ?
  Lincoln Financial Field          Philadelphia           0.1 km  4 customers  ?
  Lincoln Financial Field          Philadelphia           0.1 km  0 customers  ?
  Houston Livestock Show and Rodeo Houston                0.2 km  0 customers  ?
  The Spectrum                     Philadelphia           0.4 km  0 customers  ?
  Wells Fargo Center               Philadelphia           0.4 km  0 customers  ?
  Seattle Mariners                 Seattle                0.4 km  0 customers  Other Amusement and Recreation Industrie
  Seattle Mariners                 Seattle                0.5 km  0 customers  ?

July-2024 food CO2e saving if the lever were applied to that pile (tonnes)
  Venue layer, all 1,801 shops                               p10      2.2 t | p50      4.2 t | p90      7.2 t CO2e
  Arena-like Venue shops only                                p10      0.3 t | p50      0.6 t | p90      1.0 t CO2e
  Restaurants within 2 km of a stadium (whole month)         p10      0.8 t | p50      1.5 t | p90      2.6 t CO2e
    same, only the +30% match-week extra spend               p10      0.2 t | p50      0.5 t | p90      0.8 t CO2e

Off-map: the 78 US fixtures in matches.json hold 5,395,633 attendees in total.
Tournament-long concession food CO2e saved (attendees x meals per fan x shift x kg per swap):
  p10: 807 t CO2e   (upstream water 57.7 million L)
  p50: 1,547 t CO2e   (upstream water 103.9 million L)
  p90: 2,670 t CO2e   (upstream water 173.4 million L)
```
