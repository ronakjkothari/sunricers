# Nexus Pulse — the app

No build step and no dependencies, beyond Montserrat + Manrope from Google Fonts
and the two MapLibre CDN tags on the map page. ES modules load natively over a
static server.

```bash
cd app && python3 -m http.server 8000     # then open http://localhost:8000
```

Opening the files directly does not work — browsers block local `fetch` and ES
module loads from `file://`.

## Layout

```
index.html          shell only: a left icon rail and four empty mounts
js/
  boot.js           state, hash routing, data loading, view mounting
  lib/format.js     fmt · full · esc · pretty · niceMax · ordinal
  lib/palette.js    cached CSS-var reads and the theme swap
  lib/icons.js      twelve line icons, inline SVG
  lib/stats.js      peer statistics: ranks, medians, contributions, verdict copy
  views/*.js        one module per tab, each mount/update/(activate)
css/
  base.css          tokens, type, cards, buttons, the rail
  overview.css      the dossier
  pages.css         Compare, Scenarios, the embedded map
spatial.html        the map page — still its own document (see below)
pulse.css           the map page's stylesheet, pending its redesign
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

## The map page

`spatial.html` is still a separate document, embedded in an iframe on the
Spatial tab, and still on the old stylesheet. It is the next page slated for the
redesign: full-bleed map, the control bar floating over it, three stat pills on
the canvas, and detail cards beneath reusing the Overview's components. The
flutter canvas and every `backdrop-filter` have already been stripped from it.

A embeds B and steers it via `setCity()` / `setTheme()` once `__spatialReady` is
set, so switching cities does not re-download B's place data.

## Regenerating

```bash
python -m engines.playbook.cli --source map --sync-app --validate   # D -> app/data
python scripts/build_overview_kpis.py                               # Overview series
python scripts/build_city_images.py                                 # photo derivatives
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
