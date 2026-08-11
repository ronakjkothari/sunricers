# Track 2 curated CSV package

Viz-ready extracts for the Rice Urban Sustainability Hackathon — **Track 2 (Energy–Food–Water)**.

## Humans: read these first

| Doc | Why |
|-----|-----|
| [`../../docs/DATA_TECH_DOCUMENT.md`](../../docs/DATA_TECH_DOCUMENT.md) | Schemas, joins, intensity/consumption metrics, package map |
| [`../../docs/PROPOSED_SOLUTION_PLANS.md`](../../docs/PROPOSED_SOLUTION_PLANS.md) | 4 architectures to brainstorm viz from |
| [`../../docs/TRACK2_DATA_SHORTLIST.md`](../../docs/TRACK2_DATA_SHORTLIST.md) | Why this subset (not the full 8 GB) |

## Load these files (not the raw Downloads dumps)

See `MANIFEST.csv` for sizes and row counts.

**Highest-leverage starters for a dashboard:**

1. `footprint_estimates_market_monthly.csv` — city × month Energy / Water / CO₂e estimates  
2. `poi_efw.csv` — map points (food / energy / water / venue layers)  
3. `uhi_points.csv` — urban heat grid  
4. `weather_host_monthly.csv` — CDD / HDD amplifiers by host city  
5. `intensity_factors.csv` — edit these to run scenarios  
6. `market_crosswalk.csv` — align visit/spend labels with POI/UHI labels  

## Rebuild

```bash
pip install duckdb
python scripts/build_track2_curated_package.py
python scripts/remap_weather_stations.py   # improves station→host mapping via OurAirports
```

All magnitudes are from **transformed sample data** — methodology demos only.
