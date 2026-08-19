# Plan A — Nexus Pulse shell, as built

**What this is:** the as-built reference for `app/index.html`. Requirements live in
[`A_FEATURE_REQUIREMENTS.md`](./A_FEATURE_REQUIREMENTS.md); this describes what actually
shipped, the two integration seams A owns, and where Plan C plugs in.

**Related:** D contract [`../engines/playbook/CONTRACT.md`](../engines/playbook/CONTRACT.md) ·
grain policy [`CURATED_DATA_UTILIZATION.md`](./CURATED_DATA_UTILIZATION.md) ·
indicator policy [`D_INDICATOR_SOURCES.md`](./D_INDICATOR_SOURCES.md) ·
run notes [`../app/README.md`](../app/README.md)

---

## 1. What A is (and is not)

A is **orchestration and decision chrome**. It computes no scores. Every readiness number,
z-driver, peer and play is read verbatim out of D's frozen contract; every map pixel is
B's. A's own contribution is the shell: one host-city selection, four tabs, the dual-grain
KPI presentation, the month chart, and the surge scenario.

```
                    ┌────────────────────────────┐
                    │  A · app/index.html        │
                    │  state = {city, tab,       │
                    │           theme, metric,   │
                    │           surge, filter}   │
                    └─────┬──────────┬───────────┘
        reads (fetch)     │          │   steers (same-origin JS)
        ┌─────────────────┘          └──────────────┐
        ▼                                           ▼
  data/a_integration.json                    app/spatial.html
  data/overview_kpis.json                    (Plan B, unmodified logic)
  data/city_cards/*.md
        ▲                                           ▲
        │ built by                                  │ built by
  engines/playbook (Plan D)                   notebooks/build_map_tables
  scripts/build_overview_kpis.py
```

**Anti-goals held:** no scoring re-implemented in JS, no rewrite of B's map, no claim of
real-time capability, no presentation of rankings as ground truth.

---

## 2. Files

| Path | Role |
|---|---|
| `app/index.html` | The whole shell — markup, CSS tokens, and one inline script. No build step. |
| `app/spatial.html` | Plan B's map. Runs standalone; also embedded by A. Three additive hooks, no logic changed. |
| `app/data/a_integration.json` | D's contract, synced into the serving root |
| `app/data/overview_kpis.json` | 11 hosts × 60 months of E/W/CO₂e/visits/CDD |
| `app/data/city_cards/*.md` | One-pagers, offered as downloads on Compare |
| `scripts/build_overview_kpis.py` | Builds the series above; asserts it reconciles with D |
| `scripts/test_shell.js` | Regression test for everything except pixels |

A boots on ~200 KB (`a_integration.json` + `overview_kpis.json`). B's ~16 MB of place data
is fetched only when the Spatial tab is first opened.

---

## 3. State and routing

One object drives every tab:

```js
state = { city, tab, theme, metric, surge, filter }
```

`city` is the single global — the whole product story depends on it never diverging between
tabs. It is either a host name exactly as D spells it, or the `__all__` sentinel.

Routing is `#<tab>` or `#<tab>/<city>`, written with `history.replaceState` (no history
entries, so no risk of a hashchange loop). **The city is percent-encoded before it goes in
the hash and the fragment is split on its first `/` before decoding** — `New York/New Jersey`
contains the separator, and decoding first silently drops the city on reload. `scripts/test_shell.js`
round-trips all 48 tab×city combinations to keep that fixed.

Unknown tabs fall back to Overview; a hash with no city keeps the current one, or on a cold
load defaults to the rank-11 host (the most pressured, which is the most interesting opener).

---

## 4. Seam 1 — A ↔ D (read-only)

A consumes the contract; it never writes back and never re-scores. Slot mapping:

| A surface | Contract path |
|---|---|
| Header rank line, Compare cards | `scorecards[].rank / readiness_score / readiness_band` |
| Pressure chips, driver bars | `scorecards[].drivers[]` (5, with `elevated`) |
| Pressure filter | `indexes.by_primary_driver` |
| Peer jump buttons | `scorecards[].peer_cities[]` |
| Steal-this-play cards | `scorecards[].recommended_plays[]` |
| Collapsed disclosure | `scorecards[].general_options[]` |
| Play effect chips | `expected_effects` + `illustrative_absolute_delta` |
| **Overview KPI headline** | `scorecards[].ops_scale.absolute` |
| **Overview KPI subtitle** | `scorecards[].raw_indicators` |
| Mix / brands / spend / climate | `ops_scale.visit_mix / top_brands_by_visits / spend / climate` |
| Disclaimer drawer | `meta.disclaimer / formula / indicator_source / engine_version` |
| One-pager download | `data/city_cards/<slug>.md`, slug = lowercase, `/`→`_`, ` `→`_` |

### The dual-grain rule

This is the part most likely to be broken by a well-meaning edit, so it is worth stating
plainly. Two numbers, never blended, both labelled in the UI:

```
Energy   15.4B kWh   ← ops_scale.absolute — what the city must provision. NOT readiness.
         793 kWh/shop-month  ← raw_indicators — size-neutral intensity. THIS drives the rank.
```

`ops_scale` carries `not_used_in_readiness: true`. Feeding absolutes into a z-score would
make big cities look pressured merely for being big, and would break agreement with B's
standalone strip. If you add a KPI, decide which grain it is and say so in the subtitle.

### Rollups

For `__all__`, absolutes **sum** (they are additive) and rates are **weighted by
`shop_months`** (they are not). CDD is averaged, not summed — it is a climate reading, not
a quantity. See `absolutes()`, `rates()` and `seriesOf()` in the page script.

---

## 5. Seam 2 — A ↔ B (iframe protocol)

This is the fragile seam, so it is a small, explicit contract rather than an ad-hoc poke.

**Query parameters** (first load only):

| Param | Effect in `spatial.html` |
|---|---|
| `embed=1` | Adds `body.embed`: hides B's `<h1>`, its lead paragraph, its theme button and its readiness strip — A supplies all four. The "how to read this" line **stays**, because `setView()` rewrites it and it is the only thing explaining what a dot means. |
| `city=<host>` | Seeds `state.city` before the "land on the biggest city" default. Accepts `__all__`. |
| `theme=dark` | Seeds `state.theme` and the root attribute **without** calling `setTheme()` — `setTheme` ends in `render()`, which is not safe before the rest of `boot()` has run. `initMap()` reads `state.theme` afterwards. |

**Globals B exposes** (at the end of `boot()`):

| Global | Why |
|---|---|
| `window.__spatialReady` | B boots asynchronously. A must not call in before this is `true`. |
| `window.__spatialState` | B's `state` is a top-level `const`, so it is *not* a window property. Exposed deliberately so A can skip redundant calls. |
| `window.setCity(city)` | A function declaration, so already on `window`. |
| `window.setTheme(theme)` | Same. |

**Rules A follows:**

1. `src` is set once, on first activation of the Spatial tab — never again. Reassigning it
   would re-download ~16 MB per city switch.
2. The iframe is given its height **before** `src` is assigned, or MapLibre measures a
   0×0 container and renders nothing.
3. After load, A polls `__spatialReady` (150 ms, 20 s ceiling) and then steers via
   `setCity` / `setTheme`, comparing against `__spatialState` first.
4. The pop-out link carries `?city=&theme=` so the full-tab view opens on the same city.

**Why the labels just work:** B's city names (`places.json` `m`) and D's `host_city` are an
exact 11-way string match, verified. No crosswalk is needed in the browser — the crosswalk
happens upstream, in `market_crosswalk.csv` and the POI split weights.

---

## 6. Seam 3 — where Plan C plugs in

The Scenarios tab ships one live lever and a preview of the rest.

**Live:** visitor surge 1.0×–2.0×, applied to `ops_scale.absolute`. This is honest linear
scaling: these footprints *are* visits × intensity factors, so scaling visitors scales them
exactly. Climate amplifiers are deliberately not scaled — CDD and UHI do not depend on
visitor counts. The UI says so.

**Preview:** the lever list is generated from D's own play catalogue (deduplicated across
all 11 scorecards by `id`), so it can never drift from the engine.

To land the real lab, C needs:

- baselines → `ops_scale.absolute` (or `data/playbook/ops_context_v1.json` for the full pack)
- lever percentages → `expected_effects` on each play
- category targeting → `visits_efw_monthly.csv` × `intensity_factors.csv`
- coupling matrix → new, C-owned; keep it out of D's z-score

Replace `drawLevers()` and `drawSurge()`. Nothing else in the shell needs to change.

---

## 7. Testing

```bash
node scripts/test_shell.js
```

Covers contract fields, series reconciliation, 576 render combinations, per-city empty
states, pressure-filter counts against `indexes.by_primary_driver`, spatial pop-out wiring,
and all 48 deep-link round-trips. Exits 1 on failure.

**It cannot check pixels.** Layout, MapLibre's size inside the iframe, and dark mode need a
human with a browser. The manual pass is in [`../app/README.md`](../app/README.md).

Data-side checks:

```bash
python -m engines.playbook.cli --source map --sync-app --validate
python scripts/test_playbook_contract.py
python scripts/build_overview_kpis.py    # must report 0.0000% drift
```

That last one is the cohesion guard: if A's Overview totals ever stop matching D's
`ops_scale.absolute`, the Overview and Compare tabs are describing the same city
differently — the worst failure this product can have.

---

## 8. Known limits

- **Not a forecast.** Every figure is a 2020–2024 summer analog. No 2026 projection anywhere.
- **Sample data are transformed** (multiplicative noise, spatial jitter). Rankings demonstrate
  method, not real cities. The disclaimer drawer is always one click away on every tab.
- **Browser Back leaves the app** — routing uses `replaceState`, so no history entries accrue.
- **The surge lever is uncoupled.** No cross-resource effects, no capacity ceilings, no price
  response. Labelled illustrative; C fixes this.
- **`data/playbook/preview.html`** is D's standalone preview and is now superseded by A's
  Compare tab. Keep it for engine-only debugging; do not demo from it.
