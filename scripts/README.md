# Scripts

| script | run from repo root | what it does |
|---|---|---|
| `build_scorecards.py` | `python3 scripts/build_scorecards.py` | rebuilds `app/data/scorecards.json`: readiness scores for the 11 cities using the Plan D scoring code in `engines/playbook/` but fed with per-shop summer rates from `app/data/places.json` and `app/data/sm/` (kWh, L, CO₂e per trading shop-month, June-July 2022-2024), CDD from `data/curated/weather_host_monthly.csv`, and the median heat index of each city's shops. Rates, not totals, so city size does not drive the rank. Prints the table. A couple of seconds. |
| `test_shell.js` | `node scripts/test_shell.js` | regression test for the A shell. Runs `app/index.html`'s inline script against a DOM stub and the real `app/data/*.json`: checks every contract field the shell reads, that the Overview series reconciles with D's `ops_scale.absolute`, that all 12 selections × 4 metrics × 3 surges × 4 tabs render without throwing, that each city's play/general-option empty states are right, that the pressure filter counts match `indexes.by_primary_driver`, and that all 48 deep links survive a reload. Exits 1 on failure. **Does not check pixels** — layout, the map's size inside the iframe, and dark mode still need a browser. Node only, no install. |
| `build_overview_kpis.py` | `python3 scripts/build_overview_kpis.py` | writes `app/data/overview_kpis.json`: 11 hosts × 60 months of energy, water, CO₂e, visits and cooling degree days, for the A shell's Overview chart. Reads `data/curated/footprint_estimates_market_monthly.csv` and `weather_host_monthly.csv`, splitting the merged "Dallas / Houston" and "Los Angeles / SF Bay Area" markets with the same POI weights Plan D uses (`engines.playbook.loaders.poi_split_weights`). Asserts its own June–July sums match D's `ops_scale.absolute` and exits non-zero if they drift more than 0.5%. Stdlib only, well under a second. |
| `build_baseline.py` | `python3 scripts/build_baseline.py` | writes `app/data/baseline.json`: a "normal day" per city, type and day of the 2026 tournament window, from the double-smoothed same calendar day of 2022-2024 blended 0.2/0.3/0.5, with a ±11%-or-wider band. Built as step 1 of a forecast that was later dropped; the page does not read it. |
| `build_track2_curated_package.py` | cannot run here | the team's original curated-package builder; hardcoded Windows paths to a teammate's machine. Treat `data/curated/` as the artifact. |
| `remap_weather_stations.py` | — | maps the 401 weather station codes to host cities via the OurAirports lookup, keeping the 55 stations within 150 km of a host city. |

`build_scorecards.py` and `build_baseline.py` read only files already in `app/data/`
and need pandas and numpy; `build_overview_kpis.py` reads `data/curated/` and needs
only the stdlib. All three finish in seconds. `build_scorecards.py` and
`build_overview_kpis.py` import the `engines/playbook` package, which leaves
`__pycache__` folders under `engines/`; delete them before committing.
