# Scripts

| script | run from repo root | what it does |
|---|---|---|
| `build_scorecards.py` | `python3 scripts/build_scorecards.py` | rebuilds `app/data/scorecards.json`: readiness scores for the 11 cities using the Plan D scoring code in `engines/playbook/` but fed with per-shop summer rates from `app/data/places.json` and `app/data/sm/` (kWh, L, CO₂e per trading shop-month, June-July 2022-2024), CDD from `data/curated/weather_host_monthly.csv`, and the median heat index of each city's shops. Rates, not totals, so city size does not drive the rank. Prints the table. A couple of seconds. |
| `build_baseline.py` | `python3 scripts/build_baseline.py` | writes `app/data/baseline.json`: a "normal day" per city, type and day of the 2026 tournament window, from the double-smoothed same calendar day of 2022-2024 blended 0.2/0.3/0.5, with a ±11%-or-wider band. Built as step 1 of a forecast that was later dropped; the page does not read it. |
| `build_track2_curated_package.py` | cannot run here | the team's original curated-package builder; hardcoded Windows paths to a teammate's machine. Treat `data/curated/` as the artifact. |
| `remap_weather_stations.py` | — | maps the 401 weather station codes to host cities via the OurAirports lookup, keeping the 55 stations within 150 km of a host city. |

Both `build_*.py` scripts read only files already in `app/data/`, need pandas and
numpy, and finish in seconds. `build_scorecards.py` imports Ronak's package, which
leaves `__pycache__` folders under `engines/`; delete them before committing.
