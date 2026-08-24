# Plan A — Iteration 1 Feature Requirements

**Product:** Nexus Pulse (FIFA 2026 Resource Intelligence Platform)  
**Track:** Energy–Food–Water Nexus · [Rice Urban Sustainability Hackathon](https://rice-urban-sustainability.devpost.com/)  
**Role of A:** The command shell. B (map), C (intervention lab), and D (playbook) are modules A hosts and connects.  
**Audience for this doc:** teammate building Iteration 1 of A  
**Companion sources:** [`PROPOSED_SOLUTION_PLANS.md`](./PROPOSED_SOLUTION_PLANS.md), D [`engines/playbook/CONTRACT.md`](../engines/playbook/CONTRACT.md), B `app/` on `feat/plan-b-efw_inspection`

---

## 0. Where the repo stands today (so you don’t rebuild)

| Branch / area | What exists | What it is *not* |
|---------------|-------------|------------------|
| **main** | Curated CSVs + data/solution docs | No product UI |
| **B** (`feat/plan-b-efw_inspection`) | Strong map product: shops/districts, UHI, month scrubber, match-day +30%, KPI strip, thin readiness strip | Not a command suite; scenarios/interventions missing |
| **D** (`feat/plan-d-playbook-engine`) | Playbook engine + frozen A contract `data/playbook/a_integration_v1.json` + preview UI + city cards | Preview is not A; no shell |
| **C** | Not started | Highest gap for **Impact** judging |

**Implication for Iteration 1 of A:** Do **not** rebuild B’s map or D’s scoring. Mount them. Ship the shell + city command view + D playbook panel + a thin C stub so the track story is complete.

---

## 1. Value proposition (use this wording)

**Preferred one-liner for pitch / UI masthead:**

> Nexus Pulse is a command suite for host-city sustainability and FIFA resource managers to monitor Energy–Food–Water footprints across all 11 U.S. host cities, stress-test interventions with transparent data, and leave a reusable playbook for future mega-events.

**Why this beats the draft you floated**

| Your draft | Tighten to |
|------------|------------|
| “foolproof, legacy solutions” | “reusable playbooks” — judges punish overclaim; D already uses honest ±15% bands |
| “state-of-the-art data aggregation” | “transparent intensity model + cross-city comparison” — methodology > buzzwords |
| “controlled environments” | “tournament-analog summer windows and match-day overlays” — concrete |
| Missing user | Name **urban resource / sustainability managers + FIFA Environment ops** |
| Missing scope | Say **11 U.S. host cities** and **E–F–W nexus** explicitly (Track 2 brief) |

Keep your structure: **monitor → test → deploy/legacy**. That maps cleanly to B+D → C → D play cards.

---

## 2. What A is (and is not)

**A is:**

1. The single entry URL / home experience judges open first  
2. Global controls: **city**, **time window** (month / match), **scenario state**  
3. Navigation that deep-links into B, C, D without losing selected city/time  
4. The place KPIs, ranked interventions, and “steal this play” live together  

**A is not:**

- A second map engine (B owns spatial)  
- A second readiness math engine (D owns scorecards/plays)  
- A black-box AI advisor (methods must stay visible)

---

## 3. Iteration 1 — must ship (above-and-beyond bar)

Think of B as already “above plan.” A Iteration 1 should feel the same for the **decision layer**: one screen where a manager can answer *“Which city is pressured, where on the map, what do we do, what does it save?”*

### 3.1 Screens / layout (frontend)

One app shell, four regions. Desktop-first (judges on laptops). Light/dark optional (B already has theme).

```
┌──────────────────────────────────────────────────────────────────┐
│ NEXUS PULSE                          [City ▾] [Month/Match ▾]   │
│ E–F–W command suite · 11 hosts       Scenario: Baseline | Active │
├────────────┬─────────────────────────────────────────────────────┤
│ Nav        │  HOME — City Command                                │
│ • Home     │  ┌──────── KPI strip: Energy | Food CO₂e | Water   │
│ • Map (B)  │  │            + readiness score + peer chips        │
│ • Lab (C)  │  ├──────────────────────┬──────────────────────────┤
│ • Playbook │  │  Time series         │  Steal this play (D)     │
│   (D)      │  │  footprint / visits  │  2–3 pressing plays      │
│            │  │  + CDD overlay       │  expected ΔE/F/W %       │
│            │  ├──────────────────────┴──────────────────────────┤
│            │  │  Mini-map preview (embed/link into B)            │
│            │  │  “Open full district map →”                      │
│            │  └─────────────────────────────────────────────────┘
│            │  FOOTER: method + disclaimer + export city card     │
└────────────┴─────────────────────────────────────────────────────┘
```

**Visual rules (keep B’s quality bar):**

- Plain language labels (“Energy, food, water”) — not jargon-only  
- Every number has an `i` tip or footer line stating source + formula class  
- Readiness is **relative among 11 hosts**, never “absolute sustainability grade”  
- Persistent disclaimer: sample data are transformed; methodology demo, not official city ranking  

### 3.2 Functional requirements (FR)

| ID | Requirement | Iteration 1 bar |
|----|-------------|------------------|
| **A-FR1** | Shell with shared state: `host_city`, `month` or `match_id`, `scenario_id` | Required |
| **A-FR2** | Home City Command: KPI strip for selected city (E / F-CO₂e / Water) from curated footprints | Required |
| **A-FR3** | Mount D contract: load `data/playbook/a_integration_v1.json` (static) | Required — do not recompute z-scores in the UI |
| **A-FR4** | Compare strip: all 11 readiness cards; click selects city | Required (can restyle D preview, don’t invent new scores) |
| **A-FR5** | Driver panel: 5 z-drivers for selected city (bars or simple radar) | Required |
| **A-FR6** | Steal-this-play panel: `recommended_plays[]` only; show title, owner, effort, `expected_effects`, peer chips | Required |
| **A-FR7** | Peer jump: clicking a peer city updates global `host_city` | Required |
| **A-FR8** | Deep-link to B: “Inspect districts” opens B map with same city (+ month if B supports) | Required |
| **A-FR9** | Deep-link / tab to C: Intervention Lab with ≥3 levers and before/after deltas | **Minimum viable C inside A** (see §5) |
| **A-FR10** | Export: download/print one city playbook (JSON or use D `city_cards/*.md`) | Required for Legacy story |
| **A-FR11** | Method drawer: intensity factors + stress/readiness formula + match-day note (+30% / 2 km from B) | Required for Data Analytics |
| **A-FR12** | Empty/error states: missing JSON → tell user to run `python -m engines.playbook.cli` | Required |

### 3.3 Explicitly out of Iteration 1

- Rebuilding MapLibre layers already in B  
- Live FastAPI dependency (static JSON is enough for the pitch)  
- Full Pareto optimizer / ML recommendations  
- Auth, multi-user, production hosting polish beyond a local static server  
- Perfect mobile layout  

---

## 4. How A pulls data and links B / C / D

### 4.1 Data wiring (Iteration 1)

| Need | Source | How A consumes |
|------|--------|----------------|
| City E/F/W baselines | `data/curated/footprint_estimates_market_monthly.csv` (or B’s prebuilt `app/data/*.json`) | Parse once at load; filter by city + June–July or selected month |
| Intensity / scenario factors | `data/curated/intensity_factors.csv` | C levers multiply category footprints |
| Weather / CDD | `data/curated/weather_host_monthly.csv` | Overlay on time series |
| Readiness + plays | **`data/playbook/a_integration_v1.json`** | Primary D mount — frozen contract 1.0.0 |
| Spatial deep-dive | B `app/` + `app/data/` | Navigate / iframe / shared querystring |
| Match calendar | `data/worldcup/` or B `matches.json` | Optional on Home; required when linking match context into B |

**Rule:** A is an **orchestrator**. Prefer precomputed JSON (B notebooks + D CLI) over re-aggregating raw visits in the browser.

### 4.2 Shared state contract (all verticals)

```
?city=Miami&month=2024-06&match=optional_id&scenario=baseline
```

| Key | Owner writes | Consumers |
|-----|--------------|-----------|
| `city` | A nav / D strip / peer chips | B map focus, C baseline, D scorecard |
| `month` | A scrubber or Home control | B month index, C baseline slice |
| `match` | A match picker (optional I1) | B match-day halo |
| `scenario` | C lab | Home KPIs show Active vs Baseline |

When opening B from A: pass at least `city` (and `month` if trivial). When returning from B: preserve `city`.

### 4.3 Vertical roles inside A

| Vertical | Job inside A | Iteration 1 integration style |
|----------|--------------|-------------------------------|
| **B** | “Where is the load?” district/shop metabolism, heat, match-day | **Embed or route** to existing `app/index.html`; do not fork map logic |
| **C** | “What if we intervene?” coupled E–F–W deltas | **Build as A tab** (thin); feeds Active scenario back to Home KPIs |
| **D** | “Who is pressured + what play to steal?” | **Mount JSON** into Home + Playbook tab; reuse preview patterns |

```
                 ┌──────────── A shell (shared state) ────────────┐
                 │  Home KPIs ← curated footprints × C scenario   │
                 │       ↑                           ↑            │
                 │       │                           │            │
   B map tab ←───┤  city/month/match          a_integration_v1    ├──→ D playbook tab
                 │       │                     (scorecards/plays) │
                 │       └──────────→ C lab levers ───────────────┘
```

---

## 5. Minimum C inside A (so the track is solved)

Track 2 requires **quantify + visualize + identify highest-impact interventions**. B+D alone under-serve Impact. Iteration 1 therefore includes a **thin Intervention Lab**:

**Levers (toggle or 0–100% intensity):**

1. Plant-forward concessions → Food CO₂e ↓ (and small Energy/Water coupling)  
2. Hotel water-reuse / linen program → Water ↓ (small Energy ↓)  
3. Cool roofs / shade in high-UHI cells → Energy ↓ on lodging+dining share  

Use the coupling table already in [`PROPOSED_SOLUTION_PLANS.md`](./PROPOSED_SOLUTION_PLANS.md) Plan C (or D play `expected_effects` as defaults).

**Lab UI must show:**

- Before vs after bars for E / F / W for the selected city  
- Ranked list: which lever moved the nexus most (simple sort by total % abatement or by water/energy priority from D’s elevated drivers)  
- Button: **Apply to Home** → sets `scenario=active` and updates KPI strip  

This is enough to claim scenario comparison in the Devpost deliverable without a full Sankey.

---

## 6. UNLEASH + judging alignment (build with these in mind)

### UNLEASH-style problem framing (put in Home “Problem” blurb)

1. **User:** Host-city sustainability lead / FIFA Environment ops  
2. **Problem:** Mega-event demand spikes Energy–Food–Water together; cities lack a shared, comparable view of *where* load sits and *which* plays transfer across hosts  
3. **Insight:** Footprints can be estimated from visits × intensity factors; heat/CDD amplify energy; peer cities share transferable plays  
4. **Solution:** One command suite — monitor (Home+B), test (C), institutionalize (D playbooks)  
5. **Legacy:** Same scorecards + plays work for Olympics, Super Bowl, large MICE weeks  

### Judging checklist → A features

| Criterion | How Iteration 1 of A proves it |
|-----------|--------------------------------|
| **Impact** | C before/after + D pressing plays with owners/effort |
| **Data Analytics** | Method drawer; z-score readiness; intensity factors; honest synthetic-data disclaimer |
| **Innovation** | Nexus coupling in C; peer-matched “steal this play”; match-day measured lift from B |
| **Feasibility** | Plays name owner + effort; exportable city card; no fantasy infrastructure |
| **Legacy** | Playbook language + export; reusable beyond 2026 |
| **Visualization** | Home command layout + B map + clear strip/KPIs |
| **Pitch** | One path: pick pressured city → see map → apply lever → export play |

---

## 7. Suggested build order for the A teammate (≈1–2 focused days)

1. **Shell + routing** — Home / Map / Lab / Playbook; shared querystring state  
2. **Mount D** — strip + drivers + steal-this-play + peer jump from `a_integration_v1.json`  
3. **Home KPIs + time series** — from curated footprints (+ optional CDD line)  
4. **Wire B** — button/route into existing map with `?city=`  
5. **Thin C** — 3 levers, before/after, apply-to-home  
6. **Method + export + disclaimer** — pitch-ready  

**Definition of done (Iteration 1):**  
A judge can open one URL, select Houston (or any host), see readiness vs peers, open the district map for that city, toggle one intervention and see E/F/W move, and export a city playbook — without running Python live.

---

## 8. Above-and-beyond extras (only after §7 is green)

- Pressure filter chips from D `primary_pressure_drivers` / `indexes.by_primary_driver`  
- Side-by-side city compare (2 hosts)  
- Match-day mode on Home that mirrors B’s +30% / 2 km story  
- iframe B map on Home mini-preview  
- Live `GET /playbook/a-contract` if someone already runs uvicorn — optional, not required  

---

## 9. File / ownership cheat sheet

| Path | Owner | A action |
|------|-------|----------|
| `app/index.html` + `app/data/` | B | Link/embed; don’t rewrite |
| `engines/playbook/` + `data/playbook/a_integration_v1.json` | D | Mount contract; run CLI if JSON stale |
| `data/curated/*` | Data | KPI + C baselines |
| `docs/PLAN_A_ITERATION1_FRD.md` | A | This spec |
| New: `app/shell/` or `app/a/` (team choice) | A | Iteration 1 implementation home |

---

*Keep A thin, honest, and decisive. B already won the map. D already won comparative readiness. A wins the hackathon by making them one product that changes a decision.*
