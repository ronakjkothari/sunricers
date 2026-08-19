# Nexus Pulse — the app

Two pages, no build step, no dependencies beyond the two MapLibre CDN tags in
`spatial.html`. Hand-rolled SVG charts throughout.

```bash
cd app && python3 -m http.server 8000     # then open http://localhost:8000
```

Opening the files directly does not work (browsers block local fetches). If the map
area is blank, click on the tab: Chrome pauses MapLibre while a tab is in the background.

| Page | Plan | What it is |
|------|------|------------|
| `index.html` | **A** | The command shell and the front door. Global host-city selector + four tabs: Overview, Compare hosts, Spatial map, Scenarios. |
| `spatial.html` | **B** | The map page. Runs standalone at `/spatial.html`, and is embedded in A's Spatial tab. |

## How A and B talk

A embeds B in a same-origin iframe and steers it rather than reloading it:

- `spatial.html?embed=1&city=<host>&theme=<light\|dark>` seeds the first load.
  `embed=1` hides B's own header and its readiness strip, because A supplies both.
- After that, A calls `setCity()` / `setTheme()` on the frame once
  `window.__spatialReady` is set, reading `window.__spatialState` to avoid redundant
  calls. Switching cities therefore does **not** re-download B's ~16 MB of place data.
- Host-city labels are identical across both sides (`places.json` `m` values equal
  Plan D's `host_city`), so no crosswalk is needed in the browser.

A itself boots on ~200 KB: it loads only `a_integration.json` and `overview_kpis.json`.
B's heavy tables are fetched only when the Spatial tab is first opened.

## Files in `data/`

Built by Plan D — `python -m engines.playbook.cli --source map --sync-app --validate`:

- `a_integration.json` — **A's spine.** The frozen D contract: 11 scorecards, readiness +
  band, 5 z-drivers, peers, steal-this-play, and the `ops_scale` absolutes A's KPIs use
- `city_cards/*.md` — per-host one-pagers, offered as downloads on A's Compare tab
- `scorecards.json` — compact readiness cards for B's standalone strip
- `ops_context.json` — compact absolute load for B's side panel

Built by `python scripts/build_overview_kpis.py`:

- `overview_kpis.json` — 11 hosts × 60 months of energy / water / CO₂e / visits / CDD,
  for A's Overview chart. Merged TX and CA markets are POI-split with the same weights D
  uses, and the script asserts its June–July sums match D's `ops_scale.absolute`

Required by B (from `notebooks/build_map_tables.ipynb` step 6, copy the whole `web/`
folder here keeping `sm/` inside it):

- `places.json` — one row per shop: `m` city, `k` placekey, `n` name, `l` type,
  `x`/`y` lon/lat, `c` lifetime customers, `u` heat index
- `sm/<city>.json` — `keys` (placekeys) and `v` (61 monthly customer counts per shop);
  this is what animates the map
- `heat.json` — heat index averaged into 0.01° squares
- `daily.json` — city × type × day customers and spend, for the daily chart
- `months.json` — the 61 month labels

Optional for B (the page runs without them):

- `matches.json`, `stadiums.json` — the 78 US fixtures and 11 stadiums, from
  `data/worldcup/` (see its README for the snippet)
- `visitors.json`, `visitors_city_month.json` — `notebooks/visitors.ipynb`
- `baseline.json` — `scripts/build_baseline.py`, not read by either page

## What the numbers are

Two grains, deliberately never blended, and both labelled in the UI:

- **Rates** — energy / water / CO₂e per trading shop-month, from monthly card customers
  (`RAW_NUM_CUSTOMERS`) × `intensity_factors.csv`. Size-neutral, so a big city does not
  rank as pressured just for being big. **This is what drives readiness.**
- **Absolutes** — city summer totals from store-visits × the same factors. This is the
  load a city actually has to provision, and what the surge scenario scales.

Daily lines are derived from `SPEND_BY_DAY` and are stamped on the settlement day, hence
the smooth toggle. The +30% match-day effect is measured (566 NFL games, 19 Copa matches),
applied only within 2 km. Nothing here is a forecast; a 2026 match is shown against the
same month of 2024. The full method note is in the Spatial page's "How this was built"
box and in A's disclaimer drawer.
