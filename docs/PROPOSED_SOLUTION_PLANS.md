# Proposed Solution Plans — Track 2

**Goal:** FIFA 2026 Resource Intelligence Platform that quantifies and visualizes the Energy–Food–Water footprint of visitors, venues, hotels, and districts across the 11 U.S. host cities, and ranks highest-impact interventions.

**Data package:** [`../data/curated/`](../data/curated/) · schemas in [`DATA_TECH_DOCUMENT.md`](./DATA_TECH_DOCUMENT.md)  
**Judging:** Impact · Data Analytics · Innovation · Feasibility · Legacy · Visualization · Pitch ([Devpost](https://rice-urban-sustainability.devpost.com/))

Each plan below is sized for a hackathon: uses only curated CSVs, ships an interactive viz + scenario compare, and tells a decision-maker story.

---

## Plan A — “Nexus Pulse” City Command Dashboard

**One-liner:** Cross-city E–F–W command center with summer surge scenarios and ranked interventions for mayors / FIFA ops.

### Why it can win
Hits every deliverable: maps + charts + scenario comparisons + measurable impact over time. Clear feasibility for city agencies.

### User
Host-city sustainability lead comparing “our city vs peer hosts” before and during tournament season.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│  UI: City selector · Month range · Surge slider · Tabs   │
├──────────────┬───────────────────┬───────────────────────┤
│ KPI strip    │ Time series       │ Intervention ranker   │
│ Energy/Food/ │ visits→footprint  │ ΔkWh, ΔL, ΔCO₂e       │
│ Water + CO₂e │ + CDD overlay     │ per $ / per visitor   │
├──────────────┴───────────────────┴───────────────────────┤
│ Map: POI by efw_layer + UHI heatmap (selected city)      │
└──────────────────────────────────────────────────────────┘
              ▲                              ▲
              │                              │
   footprint_estimates_market_monthly   poi_efw + uhi_points
   weather_host_monthly                 intensity_factors
   market_crosswalk
```

### Data used
| Layer | Files |
|-------|-------|
| Baseline KPIs | `footprint_estimates_market_monthly.csv` |
| Climate amplifier | `weather_host_monthly.csv` (`sum_cdd_c`) |
| Spatial | `poi_efw.csv`, `uhi_market_summary.csv`, `uhi_points.csv` |
| Factors / scenarios | `intensity_factors.csv` |
| Labels | `market_crosswalk.csv` |

### Scenario knobs (client-side)
1. Visitor surge `1.0×–2.0×` on visits  
2. Plant-forward menus → multiply restaurant `food_kg_co2e` by `0.7–1.0`  
3. Hotel water reuse → multiply lodging water by `0.6–1.0`  
4. Efficient cooling → reduce CDD uplift `0.5–1.0`

### Pitch punchline
“From baseline summer demand to a ranked playbook: which three interventions cut the most nexus load per visitor-day in your host city?”

---

## Plan B — “District Metabolism” Venue & Corridor Explorer

**One-liner:** Zoom from host city → high-intensity food/hotel/fuel districts → venue buffers; show local E–F–W metabolism.

### Why it can win
Strong **Visualization** + **Innovation**: spatial nexus story competitors may skip if they stay at city KPIs. Legacy: works for any mega-event district.

### User
Venue operator / downtown BID planning fan zones, hotel clusters, and concession strategy.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Map-first UI (MapLibre / deck.gl)                       │
│  • Hex or H3 bins of POI density by efw_layer           │
│  • UHI as raster/heatmap                                │
│  • Click district → side panel                          │
├─────────────────────────────────────────────────────────┤
│ Side panel                                              │
│  POI mix (food/hotel/fuel/venue counts)                 │
│  Nearest brand visit leaders (soft match optional)      │
│  District footprint proxy = POI weights × city factors  │
│  Intervention: shade + cool roofs in high-UHI food hexes│
└─────────────────────────────────────────────────────────┘
         ▲                    ▲                 ▲
    poi_efw              uhi_points    visits_efw_* + intensity
    (lat/lon, layer)                   (downscale by POI share)
```

### Data used
| Layer | Files |
|-------|-------|
| Geography | `poi_efw.csv` (`LATITUDE`, `LONGITUDE`, `efw_layer`, `WKT_AREA_SQ_METERS`) |
| Heat | `uhi_points.csv` |
| City rates | `footprint_estimates_monthly.csv` or market totals |
| Brands | `visits_efw_brand_monthly_top25.csv`, `spend_efw_brand_monthly.csv` |

### Downscaling trick (transparent)
```
district_share = district_poi_count / city_poi_count  (by efw_layer)
district_footprint ≈ city_category_footprint * district_share
```
State this as a spatial allocation model — judges reward honesty + usefulness.

### Pitch punchline
“We don’t just say Houston uses more cooling energy — we show *which corridors* couple heat, hotels, and food into the hottest nexus load.”

---

## Plan C — “Menu–Meter–Mainbreak” Intervention Simulator

**One-liner:** A what-if lab where each intervention is a lever on Food, Energy, or Water, with coupled side-effects across the nexus.

### Why it can win
Best **Impact** + **Innovation** story: true nexus (changing food changes water & energy). Excellent for UNLEASH-style problem framing.

### User
FIFA Environment / city sustainability working group stress-testing a portfolio of actions.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Intervention cards (toggle / intensity)                  │
│  [ ] Plant-forward concessions                           │
│  [ ] Hotel linen/water program                           │
│  [ ] Cool roofs + shade in UHI≥8 cells                   │
│  [ ] Shift QSR→grocery fresh (proxy via brand mix)       │
│  [ ] EV / transit vs gasoline visit reduction            │
├──────────────────────────────────────────────────────────┤
│ Coupling engine (JS/Python)                              │
│  reads intensity_factors + applies matrices              │
│  Food↓CO₂e often ⇒ Water↓ & Energy↓ (prep/HVAC)          │
│  CDD×UHI ⇒ Energy↑ on lodging+dining                     │
├──────────────┬───────────────────┬───────────────────────┤
│ Sankey       │ Before/After bars │ Pareto of interventions│
│ E↔F↔W flows  │ city or all-11    │ abatement vs effort    │
└──────────────┴───────────────────┴───────────────────────┘
```

### Data used
| Layer | Files |
|-------|-------|
| Baseline | `footprint_estimates_market_monthly.csv` |
| Category levers | `visits_efw_monthly.csv` + `intensity_factors.csv` |
| Heat coupling | `uhi_market_summary.csv`, `weather_host_monthly.csv` |
| Spend validation | `spend_efw_domain_monthly.csv` (does money move with visits?) |

### Example coupling matrix (encode in app)

| Intervention | Energy | Food CO₂e | Water |
|--------------|-------:|----------:|------:|
| Plant-forward menus | −5% | −25% | −8% |
| Hotel water reuse | −3% | 0% | −30% |
| Cool roofs (UHI≥8) | −12% lodging/dining HVAC share | 0% | −2% |
| −10% gasoline visits | −10% energy @ fuel | −2% | 0% |

### Pitch punchline
“Single-resource dashboards miss tradeoffs. Nexus Pulse shows how a menu change ripples into water and cooling demand — and which lever wins on a Pareto frontier.”

---

## Plan D — “Eleven Hosts, One Playbook” Comparative Intelligence

**One-liner:** Standardized scorecards for all 11 hosts: readiness, peak-season stress, and transferable interventions (legacy beyond 2026).

### Why it can win
**Legacy** + **Feasibility**: reusable for Olympics, Super Bowl, large MICE events. Judges include city + FIFA stakeholders who think in playbooks.

### User
Multi-city coordinator / national partner comparing hosts on one page.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Small-multiple scorecards (11 cities)                   │
│  Stress index = z(summer footprint) + z(CDD) + z(UHI)   │
├──────────────────────────┬──────────────────────────────┤
│ Radar / parallel coords  │ “Steal this play” panel      │
│ Energy · Food · Water    │ Interventions that work in   │
│ · Heat · Spend intensity │ peer cities with similar mix │
├──────────────────────────┴──────────────────────────────┤
│ Shared methodology footer + uncertainty band            │
│ (synthetic noise → show sensitivity ±15%)               │
└─────────────────────────────────────────────────────────┘
```

### Data used
| Layer | Files |
|-------|-------|
| Footprints | `footprint_estimates_market_monthly.csv` |
| Climate | `weather_host_monthly.csv` |
| Heat | `uhi_market_summary.csv` |
| Economic intensity | `spend_efw_domain_monthly.csv` |
| Structure | `poi_efw_market_summary.csv` |
| Crosswalk | `market_crosswalk.csv` (handle TX/CA merges) |

### Stress index (transparent formula)
```
stress = 0.35*z(est_energy_kwh)
       + 0.25*z(est_kg_co2e)
       + 0.20*z(est_water_liters)
       + 0.10*z(sum_cdd_c)
       + 0.10*z(mean_uhi)
```
Compute on June–July months only for “tournament analog.”

### Pitch punchline
“A playbook, not a one-off chart: every host gets a stress score, a peer set, and three interventions proven in similar nexus profiles — reusable after the Cup.”

---

## Comparison — which to pick

| Plan | Best judging fit | Build risk | Wow factor |
|------|------------------|------------|------------|
| **A Nexus Pulse** | Balanced / safest 1st | Low | High if scenarios polish |
| **B District Metabolism** | Visualization + Innovation | Medium (maps) | Very high |
| **C Intervention Simulator** | Impact + Innovation | Medium (coupling UX) | Very high |
| **D Eleven Hosts Playbook** | Legacy + Feasibility | Low–medium | High for judges panel |

### Recommended combo for a winning submission
Ship **A as the shell**, embed **B’s map** as the spatial tab, and **C’s levers** as the scenario engine. Use **D’s stress index** on the landing comparison strip.

```
Nexus Pulse (A)
 ├─ Tab: Compare hosts (D scorecards)
 ├─ Tab: District map (B)
 └─ Tab: Intervention lab (C)
```

---

## 48-hour teammate split (suggested)

| Role | Owns |
|------|------|
| Data | Confirm curated CSVs load; crosswalk helper; surge months filter |
| Viz | Map + KPI + time series |
| Model | Intensity multipliers + coupling matrix + stress index |
| Pitch | Problem framing, disclaimer, intervention feasibility story |

**Do not** re-parse the 7 GB raw visits unless regenerating the package.

---

*Questions for standup: Which plan (or A+B+C combo) do we commit to before noon?*
