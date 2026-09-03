# Nexus Pulse — the app

No build step. MapLibre is vendored in `vendor/`, so the only runtime network
dependencies are Montserrat + Manrope from Google Fonts and Carto's keyless
vector basemap — and if that basemap is unreachable the shops still draw on a
plain ground. ES modules load natively over a static server.

> **Two traps in the map, both fixed, both worth knowing about.**
> MapLibre's stylesheet is injected into `<head>` *after* ours and sets
> `.maplibregl-map { position: relative }` on the very element we position
> absolutely — same specificity, later in the cascade. A plain `.mapcanvas`
> rule loses, the container collapses to 0 px, and MapLibre silently falls back
> to a 400×300 canvas inside an `overflow:hidden` box: every dot renders, and
> nothing is visible. The fix is `.mapstage > .mapcanvas` plus an explicit
> `height: 100%`, and `test_shell.js` asserts both.
> Separately, Carto's **raster** endpoint now stamps "API KEY REQUIRED" across
> the tiles. Their **vector** style is still keyless, so that is what the map
> uses.

```bash
cd app && python3 -m http.server 8000     # then open http://localhost:8000
```

Opening the files directly does not work — browsers block local `fetch` and ES
module loads from `file://`.

## Layout

```
index.html          shell only: a left icon rail and three empty mounts
js/
  boot.js           state, hash routing, data loading, view mounting
  lib/format.js     fmt · full · esc · pretty · niceMax · ordinal
  lib/palette.js    cached CSS-var reads and the theme swap
  lib/icons.js      twelve line icons, inline SVG
  lib/stats.js      peer statistics: ranks, medians, contributions, verdict copy
  lib/city.js       host photos, blur-ups, the readiness colour ramp
  lib/scenario.js   lever scopes and the map's paint expressions
  views/*.js        one module per tab, each mount/update/(activate)
css/
  base.css          tokens, type, the rail, and every shared component:
                    cards, chips, charts, bullets, the play card
  overview.css      the dossier
  compare.css       the leaderboard, the comparison, the playbook
  spatial.css       the impact map
vendor/             MapLibre, vendored
```

Each view owns the DOM inside its own mount element and queries within it, so
ids never collide between tabs. State lives once, in `boot.js`.

Views load with a dynamic `import()` on first activation. That keeps the map's
~11 MB of place data and MapLibre off the boot path, which is what the old
iframe was doing — without a second document, stylesheet, or font load.

**The Overview boots on ~240 KB** (contract + series + shell) plus about 255 KB
of photography.

## Reading the Overview

Three bands, and every block belongs to exactly one:

| Band | Question | Blocks |
|---|---|---|
| **A verdict** | How is this city doing? | full-bleed banner, readiness gauge, the one-sentence verdict, the host picker; a condensed sticky header takes over on scroll |
| **B evidence** | Why? | four KPI tiles, composition strip, the readiness decomposition, the 60-month chart |
| **C action** | What now? | the top plays with before/after bars, routes to the playbook and the map |

Layout: the banner and sticky header are `.bleed` (full container width); every
other block is inset by `--gutter`, so the page has one left edge below the fold.
Nothing scrolls horizontally — the host picker is a grid popover, not a rail.

Two things carry most of the meaning:

- **The waterfall is the scoring formula, in readiness points.** Readiness is a
  linear rescale of the stress index, so a host sitting at the 11-host average on
  every driver scores a fixed **62.2**, and each driver's `weight × z` converts
  directly into points that move it from there. The steps land exactly on the
  host's score — `test_shell.js` asserts that identity for all eleven — which is
  what lets the panel answer "why 12.4" rather than showing abstract z-units.
- **Every magnitude carries a peer comparison.** `24.7B kWh` alone is
  uninterpretable. The tiles pair it with the city's rank on the *rate* per
  trading shop-month, which is what readiness is scored on, and the chart draws
  the 11-host median and interquartile band behind the city's line.

Weights come from `meta.formula.weights` when present, and are otherwise parsed
out of `meta.formula.stress`. Revising the weights is therefore a data change,
not a UI change.

Driver rows carry two affordances: the row focuses that driver (highlighting it
in the waterfall), and the trailing arrow opens Compare filtered to every host
elevated on it. The chart's metric is set by the pills in its own header, and by
the KPI tiles — both stay in sync.

## Reading Compare

Overview is one city in depth. Compare is the eleven against each other — and
the home of the **full** playbook, which Overview only summarises:

| | Overview | Compare |
|---|---|---|
| Plays | top two | all recommended, plus general options |
| Grain | absolutes, what a city must provision | rates, what readiness scores |
| Rationale | one line | the case per play, with the driver evidence |

Three bands:

- **A · Leaderboard** — all eleven ranked, each with its ±15 band. It is also
  the selector: clicking a row makes that host the **anchor** (band C follows
  it, and `state.city` moves, so Overview follows too); ⊕ adds it to the
  comparison as a **partner**. Up to three partners; they reseed from the
  anchor's own `peer_cities` whenever the anchor changes.
- **B · Head to head** — a driver matrix (read across a row to compare hosts on
  one driver, down a column for one host's profile), a deviation chart in
  readiness points showing which driver separates them, a readiness-vs-volume
  scatter, and the 60-month chart with one line per host.
- **C · Playbook** — every pressing play for the anchor with before/after bars
  and a **targets strip** naming how elevated the anchor is on each driver the
  play acts on, then a play × host matrix showing where each play transfers.

`goCompare(driverKey, scrollTo)` carries a landing target, so Overview's
"Open the full playbook" arrives at band C rather than at the top of a
leaderboard the reader did not ask for.

## Reading the Impact map

Spatial and Scenarios merged. Keeping them apart was what made Scenarios a stub:
every play in the catalogue is written spatially — *hotel* linen, *commercial
kitchen*, *high-UHI hospitality corridors* — but had no geometry to act on, so it
multiplied a citywide total. A lever now hits the shops it names. In Miami,
"hotel linen reuse" touches **35 lodging shops**, not all 1,079.

The map is the page: controls float on it, three stat pills sit top-right, the
month scrubber runs along the bottom, and the **Scenario** drawer opens on the
right with the visitor surge, the play levers, the urban-heat threshold and a
*show the change only* toggle.

Two rules make it fast enough to be usable:

1. **Sources are built once per city**, carrying all 61 monthly counts as feature
   properties `m0…m60`. Scrubbing months is a paint-property swap, not a GeoJSON
   rebuild — the old page re-serialised up to 6,300 features every 300 ms during
   playback.
2. **Metric, levers and surge compile into the same expression.** Only the
   district view is recomputed in JS, because one cell mixes shop types — and
   only when the scenario changes, never when the month does.

`lib/scenario.js` holds the same maths twice: as MapLibre expressions for the
map and as plain JS for the pills. `test_shell.js` evaluates the expressions
against the JS across 360 combinations, because if the two ever disagree the map
is showing one number while the pills show another.

### The visitor surge is fitted, not assumed

`scripts/build_surge_model.py` regresses `log(segment customers)` on
`log(city total customers)` per host across 61 months, pools by median, and
shrinks each estimate toward 1 in proportion to its R² — so a noisy segment
defaults to "moves proportionally" rather than to a number the data cannot
support. A surge of *S* multiplies a shop by *S^β*:

| Segment | β | R² |
|---|---|---|
| Venues | 1.12 | 0.32 |
| Lodging | 1.08 | 0.24 |
| Other | 1.05 | 0.15 |
| Food | 0.98 | **0.99** |
| Fuel retail | 0.97 | 0.61 |
| within 5 km of a stadium | **+0.13** | 0.55 |

So a 1.5× surge moves a hotel near a stadium by ×1.63 and a fuel station across
town by ×1.48, where the old flat slider said ×1.50 for both. Food tracks the
city almost exactly, which is what you would expect of the segment that *is* 80%
of the demand. The coefficients are shown in the drawer beside the slider, with
their R², because a fitted number that hides its fit is not evidence.

**Fitted on observed monthly variation, not on a mega-event** — it says how a
segment has responded when a host city got busier, which is the closest evidence
available for how it would respond to a tournament.

**The heat threshold is a visible control, not a buried constant.** "High-UHI
corridors" needs a cutoff, that cutoff is a judgement call, and burying it is
exactly the kind of thing that does not survive a judge's question.

### Payload

`scripts/split_map_data.py` splits `daily`, `heat` and `places` per host. The map
tab went from **11.7 MB on every boot to 2.66 MB for the largest city**, loaded on
demand; most cities are nearer 1.5 MB. Nothing was dropped — the same 100,183
daily rows, 14,702 heat cells and 20,569 shops, just addressed per city.
`visitors.json` is not loaded at all unless visitor colouring is switched on.

## Regenerating

```bash
python -m engines.playbook.cli --source map --sync-app --validate   # D -> app/data
python scripts/build_overview_kpis.py                               # Overview series
python scripts/build_city_images.py                                 # photo derivatives
python scripts/split_map_data.py                                    # per-city map tables
python scripts/build_surge_model.py                                 # fit the surge elasticities
node scripts/test_shell.js                                          # regression check
```

`build_city_images.py` turns `assets/images/*.jpg` (37 MB of up-to-6000px
originals) into `assets/img/` — a 1200px banner photo, a 320px thumbnail, and
inline blur-up placeholders, 1.6 MB for the set. It also derives the rail logo
and `favicon.ico` from `assets/icon.png`. **Never ship the originals.**

> The photographs in `assets/images/` are untracked and their provenance is not
> recorded. Add a `CREDITS.md` with a source and licence per file before this
> goes public.

## Data

Built by Plan D — `python -m engines.playbook.cli --source map --sync-app`:

- `a_integration.json` — **the spine.** 11 scorecards: readiness + band, 5
  z-drivers with raw values, peers, plays, and the `ops_scale` absolutes
- `city_cards/*.md` — per-host one-pagers, offered as downloads
- `scorecards.json`, `ops_context.json` — compact forms for the map page

Built by `python scripts/build_overview_kpis.py`:

- `overview_kpis.json` — 11 hosts × 60 months of energy / water / CO₂e / visits / CDD

Required by the map page (from `notebooks/build_map_tables.ipynb` step 6):
`places.json`, `sm/<city>.json`, `heat.json`, `daily.json`, `months.json`.
Optional: `matches.json`, `stadiums.json`, `visitors.json`, `visitors_city_month.json`.

## What the numbers are

Two grains, deliberately never blended, and both labelled in the UI:

- **Rates** — energy / water / CO₂e per trading shop-month. Size-neutral, so a
  big city does not rank as pressured just for being big. **This drives readiness**,
  and it is what the KPI chips rank.
- **Absolutes** — city summer totals from store-visits × intensity factors. This
  is the load a city must actually provision, and what the KPI headline numbers show.

Ranking the absolutes gives nearly the same answer on all four metrics, because
they are all visits × a factor — which is exactly why the tiles rank the rate
instead. A city can be 6th largest and still rank 11th on readiness; that gap is
the product's whole argument, so the section caption states it outright.

The +30% match-day effect is measured (566 NFL games, 19 Copa matches), applied
only within 2 km. Nothing here is a forecast; a 2026 match is shown against the
same month of 2024. Sample data are transformed — the scores demonstrate a
comparative methodology, not ground-truth city rankings.
