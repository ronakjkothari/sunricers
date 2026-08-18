# D indicator sources (B ↔ D cohesion)

## Diagnosis

Laksh is right that **D’s scoring math is source-independent** — it only needs
per-city `energy_kwh`, `kg_co2e`, `water_liters`, `cdd`, `uhi`.

The real cohesion bug was not “missing CSV weighting.” It was **two pipelines**:

| Pipeline | Demand input | What it optimizes | Ranking example |
|----------|--------------|-------------------|-----------------|
| D default (old) | store-visits **city totals** via `data/curated/` | Absolute summer load (size-sensitive) | Seattle high / Miami low |
| B map scorecards | spend-patterns **per-shop rates** via `app/data/` | Intensity per shop-month (size-neutral, joins geometry) | Boston high / Dallas low |

A mounting D’s old export while Spatial shows B’s strip would **disagree on who is pressured**. That breaks the product story.

### Why not “weight all CSVs together”?

Blending store-visits totals with spend-pattern rates into one z-score would:

- Hide which signal drives the rank (bad for judging / Data Analytics)
- Still not fix geometry join (visits still don’t link to place polygons)
- Create a third, undefended methodology

Climate (CDD) and heat (UHI) already layer in cleanly as **non-demand** amplifiers. Those should stay. Demand should stay **one grain**.

## Decision (canonical for demo)

**Product readiness scores use `map` indicators** — the same spend-patterns customer × intensity rates that power B’s map.

- `python -m engines.playbook.cli --source map` (or `--source auto` when `app/data` exists)
- Writes `data/playbook/a_integration_v1.json` for A
- Optionally `--sync-app` copies compact scorecards into `app/data/scorecards.json` for B

`curated` remains available for absolute footprint rollups via the **ops_scale**
companion (`ops_context_v1.json` / `scorecards[].ops_scale`) — never as the
default readiness source.

```bash
# Canonical (matches Spatial)
python -m engines.playbook.cli --source map --sync-app --validate

# Alternate totals (explicit, not default)
python -m engines.playbook.cli --source curated --validate
```

## Adapter code

`engines/playbook/indicators.py`

- `load_map_rate_indicators(...)` — spend-patterns via map tables + weather CDD
- `load_city_indicators(...)` — curated visits totals (existing loaders)
- `resolve_indicators(source=...)` — pick one; never silent blend
