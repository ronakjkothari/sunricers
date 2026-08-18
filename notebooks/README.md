# Notebooks

All of these run in Google Colab against the Drive cache `MyDrive/ricehack_cache/`,
which `explore_raw.ipynb` fills from the public Box share. Each later notebook reads
parquet from that folder, so run `explore_raw.ipynb` cells 1-3 (and the
spend-patterns cell) once, then any of the others in any order.

| notebook | what it does | writes |
|---|---|---|
| `explore_raw.ipynb` | reads the six raw datasets from Box, caches each as parquet in Drive; the only notebook that touches Box | `ricehack_cache/*.parquet` |
| `build_map_tables.ipynb` | the map pipeline: keeps EFW shops in `spend-patterns-rice` within 75 km of their city, derives daily customers by the division route, grids the heat index, and in step 6 writes the files the page reads | `ricehack_cache/web/` → copy into `app/data/` keeping `sm/` inside |
| `nfl_lift.ipynb` | game-week ÷ normal-week spend around the 11 stadiums for 566 NFL home games, by distance ring and day offset; 2020 empty stadiums are the control. Needs `data/worldcup/stadiums.csv` and `nfl_home_games.csv` (upload when asked) | `nfl_lift_long.csv`, `nfl_lift_by_ring_bucket.csv` in the cache |
| `copa_lift.ipynb` | same ring analysis on the 19 Copa América 2024 matches, plus the citywide difference-in-differences (host cities vs Boston / Philadelphia / Seattle, summer 2024 ÷ summer 2023, shops present in both years). Needs `copa_america_2024.csv` and `stadiums.csv` | `copa_citywide_lift_by_layer.csv`, `copa_city_daily_balanced.parquet` |
| `copa_lift_executed.ipynb` | the run of the above with outputs kept, for the record | — |
| `visitors.ipynb` | parses `CUSTOMER_HOME_CITY`, calls a customer a visitor when their home state is outside the metro's states, and writes per-shop and per-city-month visitor shares | `ricehack_cache/web/visitors.json`, `visitors_city_month.json` → copy into `app/data/` |

Results, in one line each: the map has 20,569 shops in 11 cities from Dec 2019 to Dec
2024; a stadium crowd lifts spend at shops within 2 km by about +30% on match day
and the day after (NFL +33%, Copa +27%) and nothing measurable beyond 5 km; a
citywide tournament lift could not be separated from ±8% noise; 14,501 shops carry a
visitor share, median 25%. Details and caveats are in the top-level `CLAUDE.md`.

Two gotchas. The upload helper in the lift notebooks accepts any filename and rejects
empty or wrong files, so if a bad upload ever sticks, delete it from
`ricehack_cache/` and re-run step 0. `SPEND_BY_DAY` is stamped on the card settlement
day, so never compare single days; every notebook here compares weeks or smooths.
