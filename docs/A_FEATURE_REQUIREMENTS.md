# Plan A — Feature Requirements (Nexus Pulse shell)

**Audience:** teammate building Iteration 1 of A  
**Product:** FIFA 2026 Track 2 — Energy–Food–Water Resource Intelligence Platform  
**Related:** [`PROPOSED_SOLUTION_PLANS.md`](./PROPOSED_SOLUTION_PLANS.md) · D contract [`../engines/playbook/CONTRACT.md`](../engines/playbook/CONTRACT.md) · A shell `app/index.html` · B map `app/spatial.html`

---

## 0. Value proposition (agreed framing)

Your framing is directionally right. Tighten it for judges:

> **Nexus Pulse** is a command suite for FIFA and host-city resource managers to **monitor** Energy–Food–Water footprints across the 11 U.S. hosts, **compare** intervention strategies on the same evidence base, and **carry forward** a reusable playbook for future mega-events.

Avoid “foolproof” (sample data is noisy by design) and “controlled environments” (unclear). Prefer: transparent methods, scenario compare, legacy playbook.

**A’s job in one line:** the always-on shell where monitoring (KPIs + D), place intelligence (B), and intervention testing (C) meet for one admin user.

---

## 1. Current repo reality (so A doesn’t rebuild what’s done)

B and D are **merged onto the A branch** — the demo runs from one checkout.

| Vertical | State | What A does with it |
|--------|--------|---------------------------|
| **main** | Data shortlist + curated CSVs + solution plans | Docs/data baseline |
| **B** `app/spatial.html` | Full MapLibre map: shops/districts, heat, month scrubber, 2026 matches, +30% match-day lift | **Embedded** as the Spatial tab via same-origin iframe — not rewritten |
| **D** `engines/playbook/` | Scoring engine + `a_integration_v1.json` + steal-this-play payload + city one-pagers + preview | **Mounts the JSON contract** into Compare and the Overview KPIs — no re-scoring in the frontend |
| **C** | Not started | **Scenario lab** tab stubbed with a live surge slider; levers land in I2 |

**Rule:** A is orchestration + decision chrome. B is the map. D is the comparative brain. C will be the lever engine.

---

## 2. Who A is for

Primary user: **FIFA Environment / host-city sustainability or resource manager**.

They need to answer, in under two minutes:

1. Which hosts are under the most EFW pressure this summer window?  
2. Where in a city is that pressure sitting (districts / stadium ring)?  
3. If we run intervention X, what moves (energy / water / CO₂e)?  
4. What play do we hand the next event team (legacy)?

---

## 3. Iteration 1 — what “done” means

Iteration 1 is a **working shell**, not a redesign of B/D.

### Must ship

1. **App chrome** with persistent global controls + 3 tabs (4th optional stub).  
2. **Overview tab** with city/global EFW KPIs + time series (baseline monitoring).  
3. **Compare / Playbook tab** wired to D’s `a_integration_v1.json` (strip + drivers + peers + steal-this-play).  
4. **Spatial tab** that loads B’s map experience (iframe, route, or merged module — any integration that preserves B’s features).  
5. **Scenario lab tab** as a clearly labeled stub (“coming in I2 / Plan C”) *or* a minimal surge slider that only multiplies Overview KPIs (nice-to-have, not blocking).  
6. **Disclaimer** visible: transformed sample data; methodology demo, not ground truth.  
7. **One selected city** in global state shared across tabs (changing city on Overview updates Compare + Spatial).

### Not required in I1

- Full C coupling matrix / Pareto intervention lab  
- Perfect visual design system  
- Auth, multi-user, live data feeds  
- Replacing B’s match-day analysis or D’s scoring math

---

## 4. What A should look like (front-end)

Think **operations console**, not marketing site. One product name in the header: **Nexus Pulse**.

### Layout (every page)

```
┌─────────────────────────────────────────────────────────────┐
│ Nexus Pulse · FIFA 2026 EFW Command                          │
│ [Host city ▾] [Season: Jun–Jul ▾] [Disclaimer ▾]             │
├──────── Tabs ───────────────────────────────────────────────┤
│  Overview  |  Compare hosts  |  Spatial map  |  Scenarios   │
├─────────────────────────────────────────────────────────────┤
│  TAB BODY                                                    │
└─────────────────────────────────────────────────────────────┘
```

### Tab: Overview (A-native)

- **KPI cards:** Energy (kWh), Water (L), Food CO₂e (kg), optional Visitors — for selected city *or* “All 11” rollup.  
- **Spark / line chart:** month series for the selected city (summer months emphasized).  
- **Pressure chips:** top 1–2 elevated drivers from D for that city (e.g. “Water↑”, “Heat↑”).  
- **CTA row:** “Open playbook for this city” → jumps to Compare; “Inspect on map” → jumps to Spatial.

### Tab: Compare hosts (D surface)

This is where D becomes a playbook, not a strip.

**Top:** 11 readiness cards (rank, score, ±15 band). Click selects city.  
**Filter:** pressure driver chips (Energy / CO₂e / Water / CDD / Heat) using D’s `indexes.by_primary_driver`.  
**Middle-left:** driver bars or simple radar from `drivers[]`.  
**Middle-right:** **Steal this play** cards from `recommended_plays[]` — show title, effort, owner, legacy use, expected Δ%, steal-from peers (clickable), rationale.  
**Bottom:** optional “Download city one-pager” (link to `city_cards/*.md` or export JSON).

Do **not** invent new scores in the UI. Read D’s contract only.

### Tab: Spatial map (B surface)

- Host B’s existing map (shops / districts / heat / scrubber / match picker / match-day halo).  
- Global city selector should deep-link into B’s city filter when possible.  
- Keep B’s “How this was built” honesty — it’s a judging asset.

### Tab: Scenarios (C stub in I1)

Minimum for I1:

- Title: “Intervention lab”  
- Short copy: “Toggle strategies and see ΔkWh / ΔL / ΔCO₂e vs baseline — landing in next iteration.”  
- Optional: one **Visitor surge** slider (1.0×–2.0×) that only scales Overview KPIs client-side, labeled “illustrative.”

I2 fills real levers (plant-forward, water reuse, cool roofs, access shift) using intensity factors + C logic.

---

## 5. How A pulls data (explicit wiring)

### Prefer these sources (in order)

| Need | Source | Notes |
|------|--------|--------|
| Readiness, peers, plays | `data/playbook/a_integration_v1.json` | **Canonical for D.** Contract `plan_d_a_integration` / `1.0.0` |
| Map places, months, heat, matches | `app/data/*` from B | Already built for the map page |
| City×month footprints (Overview KPIs) | `data/curated/footprint_estimates_market_monthly.csv` **or** B’s derived rates via `app/data/scorecards.json` / map aggregates | Pick **one** KPI definition and label it in UI |
| Intensity / scenario multipliers | `data/curated/intensity_factors.csv` | Used heavily when C lands |
| Weather amplifiers | `data/curated/weather_host_monthly.csv` | Already inside D scoring; Overview may show CDD as context |

### Integration rules

1. **Single city state** in A (`selectedHostCity`). All tabs read it.  
2. **D is read-only from A.** Rebuild scorecards with `python -m engines.playbook.cli` (or B’s `scripts/build_scorecards.py` if you standardize on per-shop rates — then regenerate `a_integration_v1.json` from the same engine). Document which pipeline is “production” for the demo.  
3. **B is embedded, not copied.** If you must merge HTML, preserve match-day + district features.  
4. **No silent unit mixing.** If Overview uses shop-month rates and the map shows customers, say so in the KPI subtitle.

### Recommended demo data path for I1

```
A shell
 ├─ fetch a_integration_v1.json          → Compare tab
 ├─ embed /spatial → app/index.html      → Spatial tab (B)
 └─ fetch footprint_estimates_market_monthly.csv (or a small JSON export of it)
                                         → Overview KPIs
```

If CSV-in-browser is annoying, add a tiny `scripts/build_overview_kpis.py` that writes `app/data/overview_kpis.json` — fine for I1.

---

## 6. How A links B, C, D (product logic)

```
                 ┌──────────────────────┐
                 │   A · Nexus Pulse    │
                 │  global city + tabs  │
                 └──────────┬───────────┘
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   D Compare/Playbook   B Spatial map      C Scenarios
   "who/what to do"     "where it sits"    "what if we act"
        │                   │                   │
        └──────────► same city ◄────────────────┘
                         │
                         ▼
              Pitch story: Monitor → Locate → Decide → Leave a playbook
```

| User action in A | Vertical used |
|------------------|---------------|
| Scan which hosts are stressed | D |
| Jump to peer city | D → updates global city → B/Overview follow |
| See stadium-ring / district load | B |
| Pick a 2026 match and see +30% halo | B |
| Apply “steal this play” and preview impact | C (I2); until then, show expected Δ% from D play object as static text |
| Export city playbook | D one-pager |

---

## 7. Functional requirements checklist (plain language)

### Global

- [ ] Product name **Nexus Pulse** in header  
- [ ] Host-city selector (11 U.S. hosts + optional “All hosts”)  
- [ ] Persistent disclaimer  
- [ ] Tab navigation with deep links (`#overview`, `#compare`, `#spatial`, `#scenarios`)  
- [ ] Selected city syncs across tabs  

### Overview

- [ ] E / F / W (+ CO₂e) KPIs for selection  
- [ ] Time series for tournament-analog months  
- [ ] Jump buttons to Compare and Spatial  

### Compare (D)

- [ ] 11 readiness cards with band  
- [ ] Driver visualization from `drivers[]`  
- [ ] Peer list clickable  
- [ ] Steal-this-play panel with owner / effort / legacy / Δ% / steal-from  
- [ ] Pressure filter  
- [ ] Empty-state friendly when a lean city has zero pressing plays (show `general_options` collapsed)  

### Spatial (B)

- [ ] Full B map capabilities available from A  
- [ ] City context matches A selector when feasible  

### Scenarios (stub → C)

- [ ] Visible tab so judges see the decision loop is intentional  
- [ ] No fake precision; label illustrative multipliers  

---

## 8. Above and beyond (same spirit as B beating the sketch)

B didn’t just “show a map” — it added match calendars, measured lift, and honest methods. A should do the equivalent for **command**:

1. **Decision loop in the UI chrome** — Monitor → Locate → Decide → Export, not four disconnected demos.  
2. **One shared city state** so the story never breaks when switching tabs.  
3. **Playbook export** a manager could email (D’s city markdown is enough for I1).  
4. **Method honesty** on Overview + Compare (band ±15, sample noise) — judges reward this.  
5. **Stub Scenarios tab early** so the pitch can point at the full Track 2 loop before C is finished.  
6. Optional stretch for I1: side-by-side **Baseline vs Surge** KPI toggle on Overview (even without full C).

---

## 9. Judging / UNLEASH (short, practical)

| Criterion | How A helps |
|-----------|-------------|
| **Impact** | Clear admin user + ranked plays with expected effects |
| **Data analytics** | Don’t hide units; show z-drivers and uncertainty band |
| **Innovation** | Shell that couples city compare + district map + (later) scenarios |
| **Feasibility** | Plays have owner + effort + legacy use — ops-ready language |
| **Legacy** | Exportable city playbook beyond 2026 |
| **Visualization** | B’s map inside A; D’s compare not buried |
| **Pitch** | Demo script: pick Miami → see pressure → open map near stadium → open play → (later) scenario delta |

UNLEASH-style framing for the pitch (optional copy block):

- **Problem:** mega-events spike EFW load unevenly across hosts and districts.  
- **User:** FIFA / city resource managers who need comparable evidence, not one-off charts.  
- **Insight:** pressure is a nexus (heat×lodging×food), so plays must transfer across peer cities.  
- **Solution:** Nexus Pulse shell + spatial truth (B) + readiness playbook (D) + intervention lab (C).  
- **Prototype:** working tabs on sample host-city data with transparent factors.

---

## 10. Suggested build order for the A teammate (Iteration 1)

1. Scaffold shell: header, city select, 4 tabs, disclaimer.  
2. Wire **Compare** to `a_integration_v1.json` (fastest proof A is real).  
3. Embed **Spatial** from B.  
4. Build **Overview** KPIs from curated monthly footprints (or a small JSON build step).  
5. Add **Scenarios** stub + demo script notes in README.  
6. Merge/rebase B + D into the A branch so demo runs from one checkout.

**Exit test for I1:** a stranger can pick a host, see why it’s pressured, jump to the map, and leave with a named play — without asking you which folder to open.

---

## 10b. What Iteration 1 actually shipped

```bash
python -m engines.playbook.cli --source map --sync-app --validate
python scripts/build_overview_kpis.py
cd app && python -m http.server 8000
```

| Requirement (§3) | Where it lives |
|---|---|
| App chrome + 4 tabs + global city | `app/index.html` — header selector, hash routes `#overview/Miami` etc. |
| Overview KPIs + time series | Dual-grain KPI cards (absolute + rate) and a 60-month SVG chart with June–July shading and a CDD axis |
| Compare wired to D | Readiness strip with ±15 band, pressure filter, z-driver bars, steal-this-play cards with citywide Δ, clickable peers, one-pager download |
| Spatial embeds B | `app/spatial.html` in a same-origin iframe, steered via `setCity`/`setTheme` — no reload on city change |
| Scenario stub | Live visitor-surge slider (1.0×–2.0×) on the absolutes + greyed preview of the I2 levers, read from D's play catalogue |
| Disclaimer | Persistent drawer carrying the contract's own disclaimer, both grains, the formula, and engine provenance |

Two supporting changes: `--sync-app` now also copies `a_integration_v1.json` and
`city_cards/` into `app/data/` (A is served from `app/`), and
`scripts/build_overview_kpis.py` builds the monthly series, asserting its June–July sums
match D's `ops_scale.absolute` — they reconcile to 0.0000%.

### Demo script (≈2 minutes)

1. **Land on Dallas** — rank #11, readiness 0.0. Every driver elevated. Read the two grains
   off one KPI card: 15.4B kWh to provision this summer, 793 kWh per trading shop-month.
2. **Load through the year** — the June–July bands are shaded; that is the only window
   readiness is scored on. Cooling degree days ride the same chart.
3. **Compare hosts** — filter to *Urban heat*: 6 of 11 hosts, spanning rank #2 to #11 —
   heat alone does not decide readiness. Click Miami (#8); the whole shell follows.
4. **Steal this play** — "Hotel linen / laundry water-reuse", owner *hotel association +
   utility*, effort medium, −30% water ≈ −22.9B L citywide. It is already indicated for
   Dallas and Seattle — click Dallas to jump to the peer.
5. **Spatial** — same city, no reload. Districts, heat, the month scrubber, and a 2026
   fixture with its measured +30% match-day halo.
6. **Scenarios** — push visitor surge to 1.6× and show the Δ on the absolutes. Say plainly
   that this is linear and that the coupled lever lab is the next iteration.
7. **Leave with something** — download the city one-pager from Compare.

## 11. Out of scope / anti-goals

- Re-implementing D scoring in JavaScript  
- Rebuilding B’s map from scratch in A  
- Claiming real-time FIFA operations capability  
- Ranking cities as literal truth instead of comparative methodology  

---

*This doc supersedes the thin Plan A sketch in `PROPOSED_SOLUTION_PLANS.md` for implementation purposes. Keep that file as the four-vertical strategy overview.*
