# Nexus Pulse map page

`index.html` is the whole app: one file, MapLibre with a CARTO basemap, hand-rolled
SVG charts, no build step and no dependencies beyond the two CDN tags at the top.

Run: `cd app && python3 -m http.server 8000`, then open http://localhost:8000.
Opening the file directly does not work (browsers block local fetches). If the map
area is blank, click on the tab: Chrome pauses MapLibre while a tab is in the
background.

## Files in `data/`

Required (from `notebooks/build_map_tables.ipynb` step 6, copy the whole `web/`
folder here keeping `sm/` inside it):

- `places.json` — one row per shop: `m` city, `k` placekey, `n` name, `l` type,
  `x`/`y` lon/lat, `c` lifetime customers, `u` heat index
- `sm/<city>.json` — `keys` (placekeys) and `v` (61 monthly customer counts per shop);
  this is what animates the map
- `heat.json` — heat index averaged into 0.01° squares
- `daily.json` — city × type × day customers and spend, for the daily chart
- `months.json` — the 61 month labels

Optional (the page runs without them):

- `matches.json`, `stadiums.json` — the 78 US fixtures and 11 stadiums, from
  `data/worldcup/` (see its README for the snippet)
- `scorecards.json` — `scripts/build_scorecards.py`
- `visitors.json`, `visitors_city_month.json` — `notebooks/visitors.ipynb`
- `baseline.json` — `scripts/build_baseline.py`, not read by the page

## What the numbers are

Customers are monthly card customers per shop (`RAW_NUM_CUSTOMERS`); daily lines are
derived from `SPEND_BY_DAY` and are stamped on the settlement day, hence the smooth
toggle. Energy, water and CO₂ are customers × the team's `intensity_factors.csv`.
The +30% match-day effect is measured (566 NFL games, 19 Copa matches), applied only
within 2 km. Nothing on the page is a forecast; a 2026 match is shown against the
same month of 2024. The full method note is in the page's "How this was built" box.
