# Curated data utilization map

**Rule of thumb**

| Job | Use | Why |
|-----|-----|-----|
| **Who is pressured?** (readiness / peers / plays) | Spend-patterns **per-shop rates** → B map tables → D `--source map` | Size-neutral; joins geometry; B↔D agree |
| **How big is the load?** (ops scale, surge math, scenario deltas) | Store-visits / curated **absolute rollups** via `ops_context` | Magnitude for “million kWh / city-month,” visitor surge, intervention Δ |
| **Where?** | POI + UHI (+ B placekeys) | Spatial truth |
| **When / climate?** | Weather CDD/HDD | Amplifier, not a second demand source |

Never mix rates and totals into one z-score. Show both, labeled.

---

## Wiring status (B + D shipped; A + C pending)

| Surface | Status | Artifact |
|---------|--------|----------|
| D readiness / peers / plays | **Wired** | `a_integration_v1.json` (`--source map`) |
| D dual-grain + play absolute Δ | **Wired** | `scorecards[].ops_scale`, `illustrative_absolute_delta` |
| D preview UI | **Wired** | `data/playbook/preview.html` |
| B map rates / UHI / places | **Wired** (B branch) | `app/data/places.json`, `sm/`, heat |
| B side-panel absolute load | **Data ready** | `app/data/ops_context.json` (sync with `--sync-app`) — mount when B UI merges |
| A Overview KPIs / mix / brands | **Data ready** | same `ops_scale` on A contract — mount in Iteration 1 |
| C scenario baselines | **Data ready** | `ops_context_v1.json` absolutes + `expected_effects` % |

## Product surfaces → best curated (and related) inputs

### A · Overview (command KPIs)

| Widget | Best data | Notes |
|--------|-----------|-------|
| Big absolute KPIs (Energy / Water / CO₂e) | `scorecards[].ops_scale.absolute` ← footprints | **Ready in A-contract 1.1** |
| KPI subtitle / intensity | `raw_indicators` (map rates) | Dual-grain pattern |
| Time series | `footprint_estimates_market_monthly.csv` + weather | Still raw CSV until A builds charts |
| Category mix bars | `ops_scale.visit_mix` | **Ready** |
| Brand callouts | `ops_scale.top_brands_by_visits` | **Ready** |
| Spend strip | `ops_scale.spend` | **Ready** (corroboration, not readiness) |

### A · Compare / D · Playbook

| Widget | Best data | Notes |
|--------|-----------|-------|
| Readiness, peers, steal-this-play | `a_integration_v1.json` from `--source map` | Canonical |
| Driver chart | Same contract `drivers[]` | Already includes CDD + UHI |
| Play citywide Δ | `illustrative_absolute_delta` | **Ready** — % × summer absolutes |
| Export one-pager | `data/playbook/city_cards/*.md` | Includes ops scale section |

### B · Spatial map

| Layer | Best data | Notes |
|-------|-----------|-------|
| Shop dots / districts | B `app/data/places.json` + `sm/` (spend-patterns) | Already shipping |
| Heat | B heat grid **or** curated `uhi_points.csv` | Same family; don’t dual-rank from both |
| Match rings / lift | `data/worldcup/*` | Keep |
| Side panel “city absolute load” | `app/data/ops_context.json` | **Exported** — wire into B panel on merge |

### C · Scenario lab (when built)

| Lever | Best data | Notes |
|-------|-----------|-------|
| Baseline absolute | `ops_context_v1.json` / `ops_scale.absolute` | Apply % effects to **totals** |
| Category targeting | `visits_efw_monthly.csv` × `intensity_factors.csv` | Still raw for C |
| Surge slider | Scale visits then × factors | Totals respond to 1.2×–2.0× visitors |
| Cooling lever | `ops_scale.climate` + lodging/food share | Rates decide priority; absolutes decide ΔkWh |
| Factors | `intensity_factors.csv` | Single source of truth for multipliers |

---

## What each curated file is “for”

| File | Primary use in product | Secondary |
|------|------------------------|-----------|
| `footprint_estimates_market_monthly.csv` | **A Overview absolute KPIs**; **C baseline** | Pitch “citywide load” slides |
| `footprint_estimates_monthly.csv` | **C** category-level intervention math | Deep-dive charts |
| `visits_efw_monthly.csv` | Category mix, surge scaling | Validate footprint rebuild |
| `visits_efw_brand_monthly_top25.csv` | Overview / Spatial “top brands by traffic” | Storytelling |
| `visits_efw_market_category_totals.csv` | Fast city structure cards | |
| `spend_efw_domain_monthly.csv` | Money intensity Food/Energy/Lodging (A strip) | Cross-check vs visits |
| `spend_efw_brand_monthly.csv` | Brand spend deep-dive | |
| `poi_efw.csv` | District maps if not using B places; venue/hotel filters | |
| `poi_efw_market_summary.csv` | City structure; TX/CA split weights | |
| `uhi_points.csv` / `uhi_market_summary.csv` | Heat layer / D uhi input | |
| `weather_host_monthly.csv` | CDD overlay + D/C cooling | |
| `weather_host_daily.csv` | Match-week weather detail (stretch) | |
| `intensity_factors.csv` | All EFW conversions + C levers | |
| `market_crosswalk.csv` | Join visits/spend labels ↔ split hosts | |
| `station_to_market.csv` | Weather provenance | |

B’s spend-patterns tables (`app/data/*`) stay the **spatial + readiness** spine. Curated visits/spend are the **magnitude + mix + money** spine.

---

## UI pattern that maximizes both (do this in A)

On Overview, for the selected city:

```
Energy  1.8e9 kWh / month     ← absolute (curated footprints)
        2.4k kWh / shop-mo    ← rate (map/D grain) · drives readiness
```

Same for water and CO₂e. One glance: **scale** vs **intensity**. Judges love this; it also explains why a small dense city can rank “more pressured” than a large lean one.

---

## Pitch line

> Readiness tells you **where intensity is worst per shop**. Absolute rollups tell you **how many resources the city must actually provision**. Interventions are simulated on absolutes; prioritization is driven by rates.

---

## After you ship D — suggested next uses (priority)

1. ~~D ops_scale companion + play absolute Δ~~ **Done** (`engines/playbook/ops_context.py`, contract 1.1).
2. **A Overview** mount `ops_scale.absolute` + rate subtitles from `raw_indicators`.
3. **B side panel** mount `app/data/ops_context.json` when Spatial merges.
4. **C** baselines from `ops_context` absolutes; lever % from D `expected_effects`.
5. Keep POI curated as backup geometry; prefer B places when present.

Rebuild:

```bash
python -m engines.playbook.cli --source map --sync-app --validate
```

That uses the shortlist fully without breaking B↔D cohesion. Remaining UI work waits on A (Overview) and B panel mount — the data products are ready.
