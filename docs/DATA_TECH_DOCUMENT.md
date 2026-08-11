# Data Tech Document — Track 2 Energy–Food–Water

**Audience:** teammates building viz / architecture today  
**Hackathon:** [Rice Urban Sustainability Hackathon — World Cup 2026](https://rice-urban-sustainability.devpost.com/)  
**Track:** Energy–Food–Water Nexus Resource Intelligence Platform  

Companion docs:
- [`TRACK2_DATA_SHORTLIST.md`](./TRACK2_DATA_SHORTLIST.md) — why this subset wins
- [`PROPOSED_SOLUTION_PLANS.md`](./PROPOSED_SOLUTION_PLANS.md) — 4 solution architectures
- **Viz-ready package (explicit referral):** [`../data/curated/`](../data/curated/)

---

## 1. Package referral (start here for code)

All brainstorming and prototypes should load from:

```
sunricers/data/curated/
```

**Package snapshot (after ETL):** see `MANIFEST.csv` for exact bytes/rows. Approximate:

| File | ~Rows | Role |
|------|------:|------|
| `visits_efw_monthly.csv` | 16k | Core demand time series |
| `visits_efw_brand_monthly_top25.csv` | (see manifest) | Top brands |
| `visits_efw_market_category_totals.csv` | (see manifest) | Lifetime category totals |
| `poi_efw.csv` | ~98k | Map layer |
| `poi_efw_market_summary.csv` | (see manifest) | POI counts |
| `spend_efw_brand_monthly.csv` | (see manifest) | Brand spend |
| `spend_efw_domain_monthly.csv` | ~1.6k | Food/Energy/Lodging spend |
| `weather_host_daily.csv` | ~100k | Host-metro stations |
| `weather_host_monthly.csv` | (see manifest) | Monthly CDD/HDD |
| `uhi_points.csv` | ~1.2M | Heat grid |
| `uhi_market_summary.csv` | 11 | Mean/p90 UHI |
| `intensity_factors.csv` | 10 | Consumption metrics |
| `footprint_estimates_monthly.csv` | (see manifest) | Visits × factors |
| `footprint_estimates_market_monthly.csv` | ~540 | City×month footprints |
| `market_crosswalk.csv` | 11 | Label alignment |
| `station_to_market.csv` | ~55 | Weather→host (150 km) |

| File | Purpose | Typical join keys |
|------|---------|-------------------|
| `visits_efw_monthly.csv` | Core demand time series (filtered EFW categories) | `MARKET`, `CATEGORY`, `year_month` |
| `visits_efw_brand_monthly_top25.csv` | Top brands per market×category×month | `MARKET`, `BRAND`, `year_month` |
| `visits_efw_market_category_totals.csv` | Lifetime totals for ranking | `MARKET`, `CATEGORY` |
| `poi_efw.csv` | Map layer: restaurants, hotels, fuel, venues, waste… | `MARKET`, `LATITUDE`/`LONGITUDE`, `efw_layer` |
| `poi_efw_market_summary.csv` | POI counts by market×layer×category | `MARKET`, `efw_layer` |
| `spend_efw_brand_monthly.csv` | Brand spend (food / fuel / lodging keywords) | `MARKET`, `BRAND_NAME`, `year_month` |
| `spend_efw_domain_monthly.csv` | Spend rolled to Food / Energy / Lodging | `MARKET`, `spend_domain`, `year_month` |
| `weather_host_daily.csv` | Host-metro stations: temp, CDD, HDD, precip, RH | `host_city_canonical`, `valid_date` |
| `weather_host_monthly.csv` | Monthly climate amplifiers | `host_city_canonical`, `year_month` |
| `uhi_points.csv` | Urban heat grid points | `MARKET`, lat/lon, `UHI` |
| `uhi_market_summary.csv` | Mean / p90 UHI by market | `MARKET` |
| `intensity_factors.csv` | **Consumption metrics** (kWh, L water, kg CO₂e per visit) | `activity_class` ↔ visit `CATEGORY` |
| `footprint_estimates_monthly.csv` | Visits × intensity (demo footprints) | `MARKET`, `year_month`, `CATEGORY` |
| `footprint_estimates_market_monthly.csv` | City×month E/F/W totals | `MARKET`, `year_month` |
| `market_crosswalk.csv` | Visits/spend labels ↔ POI/UHI ↔ canonical host city | all market fields |
| `station_to_market.csv` | Weather station ID → host city (nearest within 150 km) | `station_id` |
| `MANIFEST.csv` | File sizes / row counts | — |
| `README.md` | Package pointer | — |

Rebuild anytime:

```bash
python scripts/build_track2_curated_package.py
python scripts/remap_weather_stations.py
```

Source raw inputs (not in-repo; local Downloads):
- `store-visits-rice` (~7.1 GB gz)
- `core-poi-geometry-rice` (~0.2 GB)
- `daily-spend-brand-and-state-rice` (~0.36 GB)
- `daily-weather-rice` (~0.02 GB)
- `urban-heat-index-rice` (~0.01 GB)

Dictionary: `WorldCupHack_Dictionary.xlsx` (repo root).

---

## 2. Disclaimer (put on every viz)

Sample data were **transformed** (multiplicative noise on magnitudes, additive noise on temps, spatial jitter). Outputs demonstrate **methodology**, not actionable rankings of real cities, venues, or brands.

---

## 3. Conceptual data model

```
                    ┌─────────────────────┐
                    │ market_crosswalk    │
                    │ (canonical host)    │
                    └─────────┬───────────┘
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
   visits_* (demand)   poi_efw (space)    weather_host_* 
           │                  │              (CDD/HDD)
           ▼                  │                  │
   intensity_factors ─────────┼──────────────────┘
           │                  │
           ▼                  ▼
   footprint_estimates    uhi_points (cooling surcharge)
           │
           ▼
   scenario / intervention layer (app logic)
```

**There is no reliable `STORE_ID` join** between visits and POI. Prefer:
1. Market × category aggregates (default), or  
2. Soft match `BRAND` / `LOCATION_NAME` + `MARKET` (optional, fuzzy).

---

## 4. Market crosswalk (required)

Visits & spend use **merged** labels; POI & UHI use **split** labels.

| Visits / spend `MARKET` | POI / UHI `MARKET` | Canonical host city |
|-------------------------|--------------------|---------------------|
| Atlanta | Atlanta | Atlanta |
| Boston | Boston | Boston |
| Dallas / Houston | Dallas | Dallas |
| Dallas / Houston | Houston | Houston |
| Kansas City | Kansas City | Kansas City |
| Los Angeles / SF Bay Area | Los Angeles | Los Angeles |
| Los Angeles / SF Bay Area | San Francisco Bay Area | San Francisco Bay Area |
| Miami | Miami | Miami |
| New York/New Jersey | New York/New Jersey | New York/New Jersey |
| Philadelphia | Philadelphia | Philadelphia |
| Seattle | Seattle | Seattle |

For city-level charts from visits: either keep merged markets, or **allocate** Dallas/Houston and LA/SF using POI share or population weights (document the assumption).

---

## 5. EFW filter logic (what “shortlisted” means)

### Visits kept (NAICS3)
`722, 445, 447, 721, 711, 712, 713, 562, 221, 311, 312, 424, 485, 481, 488`  
plus category text matches: restaurant, grocery, food, gasoline, accommodation, waste, spectator, amusement, beverage, drinking.

### POI kept
Same NAICS set + name hits for stadium / arena / convention.

Assigned `efw_layer`:
| Layer | Meaning |
|-------|---------|
| Food | Restaurants, grocery, food/beverage mfg & wholesale |
| Energy | Gasoline, utilities |
| Water | Lodging (water-heavy), waste |
| Venue | Sports, museums, amusement |
| Other_EFW | Residual matched rows |

### Spend kept
Brand-name keyword filter (QSR, grocery, fuel, hotel chains, delivery). Domain tag: `Food` / `Energy` / `Lodging`.

### Weather kept
Stations within **150 km** of a host-city center (mapped via OurAirports ICAO/`ident` → nearest host). See `station_to_market.csv` (~55 stations across all 11 hosts). Columns: avg/max/min °C, **CDD**, **HDD**, precip, RH.

> Major hub codes like `KATL`/`KLAX` are mostly absent from this sample; regional ASOS IDs near hosts are used instead. Re-run `scripts/remap_weather_stations.py` after changing the distance threshold.


---

## 6. Consumption metrics (`intensity_factors.csv`)

Demo-grade factors for converting **visits → footprints**. Tune openly in the pitch; cite as illustrative.

| Domain | Activity class | Per | Energy (kWh) | Water (L) | kg CO₂e* |
|--------|----------------|-----|-------------:|----------:|---------:|
| Food | Restaurants and Other Eating Places | visit | 2.8 | 25 | 3.5 |
| Food | Grocery Stores | visit | 1.2 | 8 | 6.0 |
| Food | Specialty Food Stores | visit | 1.0 | 6 | 4.5 |
| Energy | Gasoline Stations | visit | 45 | 1.5 | 12.0† |
| Water | Traveler Accommodation | visit | 28 | 300 | 2.0 |
| Energy | Cooling Degree Day uplift | CDD·day | 0.15 | 0.4 | 0.05 |
| Energy | UHI surcharge | UHI index pt | 0.08 | 0.1 | 0.03 |
| Water | Waste Treatment and Disposal | visit | 5 | 40 | 8.0 |
| Food | Spectator Sports | visit | 4 | 15 | 2.5 |
| Food | Other Amusement and Recreation Industries | visit | 3 | 12 | 1.8 |

\*Column name `food_kg_co2e_per_unit` is schema-uniform; for gasoline treat as **energy CO₂e**.  
†Fuel-dominated.

### Suggested formulas

```
est_energy_kwh   = visits * energy_kwh_per_unit
est_water_L      = visits * water_liters_per_unit
est_kg_co2e      = visits * food_kg_co2e_per_unit

# Optional climate amplifier on lodging + restaurants:
cooling_kwh += sum_cdd_c * 0.15 * (lodging_visits + restaurant_visits) / 1e6

# Optional district UHI surcharge:
uhi_kwh += mean_uhi * 0.08 * district_visits / 1000
```

Precomputed joins live in:
- `footprint_estimates_monthly.csv`
- `footprint_estimates_market_monthly.csv`

---

## 7. Schema cheat-sheet (columns you will actually bind)

### `visits_efw_monthly.csv`
`MARKET, CATEGORY, SUB_CATEGORY, NAICS3, year_month, total_visits, store_day_rows, avg_daily_visits, distinct_names_approx`

### `poi_efw.csv`
`PLACEKEY, LOCATION_NAME, MARKET, CITY, REGION, POSTAL_CODE, LATITUDE, LONGITUDE, NAICS_CODE, NAICS3, TOP_CATEGORY, SUB_CATEGORY, BRANDS, CATEGORY_TAGS, WKT_AREA_SQ_METERS, GEOMETRY_TYPE, POLYGON_WKT_SHORT, efw_layer`

### `spend_efw_domain_monthly.csv`
`MARKET, spend_domain, year_month, spend_amount, trans_count, brand_count`

### `weather_host_monthly.csv`
`host_city_canonical, year_month, avg_temp_c, sum_cdd_c, sum_hdd_c, avg_rh_pct, sum_precip_hundredths_mm, day_station_rows`

### `uhi_points.csv`
`MARKET, LATITUDE, LONGITUDE, UHI` (UHI scale 1–11)

### `footprint_estimates_market_monthly.csv`
`MARKET, year_month, est_energy_kwh, est_water_liters, est_kg_co2e, total_visits`

---

## 8. Recommended viz grains

| View | Grain | Files |
|------|-------|-------|
| City compare KPI cards | host city × latest year or World Cup summer months | `footprint_estimates_market_monthly` + crosswalk |
| Time series | market × month | footprints + weather monthly |
| Map | POI points + UHI hex/grid | `poi_efw`, `uhi_points` |
| Brand deep-dive | brand × month | visits brand top25 + spend brand monthly |
| Scenario compare | same KPIs under factor multipliers | app state × intensity_factors |

**World Cup window tip:** filter `year_month` to June–July analogs (e.g. `2023-06`, `2023-07`, `2024-06`, `2024-07`) as “tournament-season baseline,” then apply a visitor-surge slider (1.2×–2.0×).

---

## 9. Gaps & how to talk about them

| Gap | Impact | Mitigation in pitch |
|-----|--------|---------------------|
| No direct water utility metering | Water inferred | Lodging + food intensity + precip context |
| No building energy meters | Energy inferred | Visits × kWh factors + CDD + UHI |
| `STORE_ID` broken across tables | No store-level join | Market/category + maps |
| Merged TX / CA visit markets | City split fuzzy | Crosswalk + POI weights |
| Weather only at mapped airports | Spatial climate coarse | ~55 regional stations within 150 km; UHI for intra-city |
| `spend-patterns-rice` missing | No PLACEKEY spend | Brand/state spend as proxy; note upgrade path |

---

## 10. Stack suggestions for teammates

- **Fast prototype:** Observable / Streamlit / DuckDB-WASM / Flourish + Mapbox  
- **Map:** deck.gl or MapLibre; POI as circle layers by `efw_layer`; UHI as heatmap  
- **Charts:** ECharts / Recharts / Observable Plot  
- **Scenario engine:** pure client-side multipliers on `intensity_factors` + surge factor  
- **Do not** ship raw 7 GB visits into the front end — only `data/curated/*`

---

## 11. Quality checklist before demo

- [ ] Disclaimer visible  
- [ ] Crosswalk applied (no mixed market strings on one chart)  
- [ ] Footprints labeled “estimated via intensity factors”  
- [ ] At least one **scenario comparison** (baseline vs intervention)  
- [ ] At least one **map** (POI or UHI)  
- [ ] Intervention list tied to quantified delta (kWh / L / kg CO₂e)

---

*Generated for Sunricers Track 2. Rebuild package: `python scripts/build_track2_curated_package.py`.*
