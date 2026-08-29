# Nexus Pulse — Pitch Document

**Track:** Rice Urban Sustainability Hackathon · Track 2: Energy–Food–Water Nexus  
**Product:** FIFA 2026 Resource Intelligence Platform for the 11 U.S. host cities  
**Primary user:** FIFA Environment / host-city sustainability and resource managers  

**Judging weights this pitch is built around**

| Criterion | Weight |
|-----------|-------:|
| Impact | 25 |
| Data Analytics | 20 |
| Innovation | 15 |
| Feasibility / Implementation | 15 |
| Legacy | 10 |
| Visualization | 10 |
| Presentation / Pitch | 5 |

---

## 1. Problem

FIFA 2026 will concentrate visitors, lodging, food service, fuel, and venue operations across 11 U.S. host cities in a short summer window. Energy, food, and water loads rise together. Heat and cooling demand amplify them. Cities and event operators must act with incomplete, noisy, and hard-to-join data.

**What breaks today**

- City totals and shop-level intensity are mixed, so large cities look “worse” simply because they are large.
- Maps, rankings, and intervention lists often use different inputs, so the same host can look pressured in one view and fine in another.
- Advice stays generic: “cut energy” or “save water,” without peers, owners, effort, or a reusable next-event playbook.
- Spatial load (stadium rings, hotel corridors, heat islands) is invisible in city-average dashboards.

**What Track 2 asks for**

- Quantify E–F–W footprints of visitors, venues, hotels, and districts across the 11 hosts.
- Visualize where load sits.
- Rank interventions that matter for the tournament and after it.
- Support decisions with transparent methods, not false ground-truth claims.

**What the user must answer in under two minutes**

1. Which hosts are under the most EFW pressure in the summer window?
2. Where inside a city is that pressure sitting?
3. If we change visitor load or run a play, what moves (energy / water / CO₂e)?
4. What do we hand the next event team?

---

## 2. Solution overview (value proposition)

**Nexus Pulse** is a command suite for FIFA and host-city resource managers to:

- **Monitor** Energy–Food–Water footprints across the 11 U.S. hosts.
- **Compare** hosts and intervention strategies on one shared evidence base.
- **Locate** pressure on the map (shops, districts, heat, match rings).
- **Carry forward** a reusable playbook for future mega-events.

**One product rule that holds the whole stack together**

| Job | Grain | What it answers |
|-----|-------|-----------------|
| Who is pressured? | Per-shop **rates** (size-neutral) | Readiness rank, peers, plays |
| How big is the load? | City **absolutes** (totals) | Provisioning scale, surge Δ, KPI magnitude |
| Where is it? | Places + UHI + match buffers | Spatial ops |
| When / climate? | CDD / HDD as amplifiers | Cooling pressure, not a second demand score |

Rates and totals are never blended into one z-score. Both appear in the UI, labeled.

**Product surfaces (shipped)**

| Tab | Role |
|-----|------|
| Overview | Absolute city load + monthly series + rate subtitles |
| Compare hosts | Readiness 0–100, drivers, peers, steal-this-play, city one-pagers |
| Spatial map | Place-level map, heat, month scrubber, match-day lift |
| Scenarios | Visitor surge on absolute KPIs (full lever lab prepared on a side branch) |

**Disclaimer (explicit in product):** sample data are transformed (noise/jitter). Scores demonstrate comparative methodology, not ground-truth city rankings.

---

## 3. Main approaches

We solve the problem with four coordinated approaches. A orchestrates. B, D, and C each own one decision job. They share city state, host labels, and the dual-grain data policy.

1. **A · Nexus Pulse shell** — one command surface, one selected host, four tabs.
2. **B · District metabolism (Spatial)** — place-level EFW and heat intelligence.
3. **D · Eleven Hosts Playbook** — comparative readiness, peers, transferable plays.
4. **C · Scenario lab** — absolute load under surge (shipped); lever / Monte Carlo lab (built, not merged).

**How they connect**

```
Selected host city (global)
        │
        ├─ Overview ← ops_scale absolutes + monthly KPI series
        ├─ Compare  ← D contract (rates → readiness, peers, plays)
        ├─ Spatial  ← B map (same rate grain as D; iframe steered by A)
        └─ Scenarios ← multiplies absolute Overview load
```

- A does not re-score in the browser.
- D exports a frozen contract (`a_integration.json`) that A mounts.
- B and D use the same demand grain for readiness (`--source map`).
- Absolutes live in `ops_scale` / `ops_context` for magnitude and scenarios.

---

## 4. Detailed approach pitches

### 4.1 A · Nexus Pulse shell

**What it is**

- Operations console for one admin user.
- Persistent host selector and theme.
- Four tabs that never diverge on city identity.
- Dual-grain KPIs: city totals on top, per-shop rates underneath.

**How it works with the others**

- Reads D’s contract and Overview series (~200 KB boot).
- Embeds B as a same-origin iframe; steers city/theme without reloading ~16 MB of place data.
- Applies surge in Scenarios to absolute KPIs only.
- Offers D city one-pagers as downloads on Compare.

**Data used**

| Input | Use |
|-------|-----|
| `a_integration.json` | Readiness, drivers, peers, plays, `ops_scale` |
| `overview_kpis.json` | 11 hosts × ~60 months energy / water / CO₂e / visits / CDD |
| `city_cards/*.md` | Exportable host playbooks |
| B iframe | Spatial tab |

**Impact on the user**

- One place to monitor, compare, locate, and test surge.
- Same host context across every view.
- Clear separation of intensity vs scale, so decisions match the question being asked.

**Differentiation / long future**

- Shell stays stable while engines upgrade.
- New data years, new events, or new levers plug into the same tabs and contract seams.
- Feasible for agencies: static demo today, same architecture for live feeds later.
- Hits **Feasibility**, **Visualization**, and **Pitch** by making the full story operable in one session.

---

### 4.2 B · Spatial map (District metabolism)

**What it is**

- MapLibre place map of EFW-relevant shops and districts.
- Urban heat overlay.
- Month scrubber on customer activity.
- 2026 match locations with measured +30% match-day lift inside a short radius (NFL / Copa evidence).

**How it works with the others**

- Supplies the rate tables D uses for readiness, so Spatial and Compare agree on who is pressured.
- Receives city selection from A; can also run standalone.
- Side-panel absolute load can mount `ops_context.json` without changing readiness math.

**Data used**

| Input | Use |
|-------|-----|
| `places.json`, `sm/*.json`, `months.json` | Shop locations and monthly customers |
| `heat.json` | UHI grid |
| Intensity factors (aligned with D) | Customers → energy / water / CO₂e rates |
| `matches.json`, `stadiums.json` | Tournament geography |
| Optional visitors / daily spend tables | Temporal detail |

**Impact on the user**

- Moves from “Dallas is pressured” to “which corridors and stadium rings.”
- Supports venue, BID, and hotel-cluster planning, not only city averages.
- Shows when load spikes (month and match day), not only season totals.

**Differentiation / long future**

- Spatial EFW metabolism is reusable for any mega-event district, festival, or playoff week.
- Place-level rates stay the right grain for targeting cool roofs, kitchen water programs, and fan-zone ops.
- Hits **Visualization**, **Innovation**, and **Legacy** beyond a single tournament dashboard.

---

### 4.3 D · Eleven Hosts Playbook

**What it is**

- Deterministic engine for all 11 hosts.
- Summer-window stress from five drivers: energy, food CO₂e, water, CDD, UHI.
- Readiness score 0–100 with uncertainty band.
- Peer sets and rule-based **steal-this-play** recommendations (owner, effort, legacy use, expected % effects).
- Illustrative citywide absolute deltas on each play (`% × summer absolutes`).

**How it works with the others**

- Canonical readiness source for A Compare and B’s readiness strip.
- Uses map **rates** for demand; curated weather/UHI as amplifiers only.
- Attaches `ops_scale` companion (absolutes, visit mix, spend, brands, climate) labeled `not_used_in_readiness`.
- Export fails if the A contract validation fails.

**Data used**

| Input | Use |
|-------|-----|
| B map tables (`places`, `sm`, `months`) | Per-shop summer rates |
| `weather_host_monthly.csv` | CDD |
| UHI from map places / curated summaries | Heat driver |
| Footprints, visit mix, spend, brands, POI summary | Ops-scale companion only |
| `intensity_factors.csv` | Conversion factors (shared story with B) |

**Method (transparent)**

- Stress = weighted z-scores of the five drivers across hosts.
- Readiness = inverted stress, min-max scaled to 0–100.
- Pressing plays require elevated drivers (`match_score > 0`).
- Peers support “steal from hosts with the same pressure pattern.”

**Impact on the user**

- Ranked pressure without size bias.
- Action list with owner and effort, not only charts.
- Peer transfer: copy what similar hosts should already prioritize.
- Absolute Δ on plays shows provisioning impact, not only percent change.

**Differentiation / long future**

- Frozen contract means the UI cannot silently drift from the engine.
- Playbook transfers to other Cups, All-Star weeks, conventions, and heat seasons.
- Methodology stays auditable when data are replaced with operational feeds.
- Hits **Data Analytics**, **Impact**, **Legacy**, and **Feasibility**.

---

### 4.4 C · Scenario lab

**Shipped on main**

- Visitor surge slider on Overview absolute KPIs.
- Shows how citywide energy / water / CO₂e scale with visitor load.
- Keeps readiness (rates) unchanged during surge, which matches the dual-grain rule.

**Built on unmerged branch (`do_not_merge`)**

- Lever cards with researched costs.
- Monte Carlo uncertainty on intervention outcomes.
- Shell + map wiring for a fuller intervention lab.
- Intended next step once cleaned for merge.

**How it works with the others**

- Baselines = D/A `ops_scale` absolutes.
- Lever % effects align with D play `expected_effects`.
- Priority of which lever to test comes from D readiness drivers.
- Spatial context from B shows where a lever should land (e.g. high-UHI corridors).

**Data used**

| Input | Use |
|-------|-----|
| Absolute footprints / `ops_scale` | Baseline magnitude |
| `intensity_factors.csv` | Factor edits for category levers |
| Visit category structure | Target food / lodging / fuel slices |
| Climate (CDD) | Cooling lever relevance |
| `levers.json` (side branch) | Packaged interventions + costs |

**Impact on the user**

- Answers “what if visitors jump?” with citywide resource deltas.
- Upcoming lever lab answers “which play buys the most abatement per effort/cost?”
- Connects Compare recommendations to testable outcomes.

**Differentiation / long future**

- Scenarios stay on absolutes; prioritization stays on rates. That split survives new data and new events.
- Monte Carlo and costed levers move the product from storytelling to operator budgeting.
- Hits **Impact**, **Innovation**, and **Feasibility** as the intervention layer matures.

---

## 5. How the approaches work as one system

**Decision path we want judges to see**

1. **Compare** — find the most pressured hosts (rates → readiness).
2. **Overview** — see how large their absolute summer load is.
3. **Spatial** — locate districts, heat, and match rings.
4. **Steal-this-play** — take transferable actions with owners and peers.
5. **Scenarios** — scale absolutes under visitor surge; later, test costed levers.

**Cohesion guarantees**

- Same host labels everywhere (no browser crosswalk).
- Same readiness ranking in A Compare and B strip (`--source map`).
- Overview summer sums reconciled against D `ops_scale.absolute`.
- Shell regression tests cover tab × city routing and contract wiring.

**Judging map**

| Criterion | Where we earn it |
|-----------|------------------|
| Impact | Prioritized plays + absolute Δ + surge response for real ops questions |
| Data Analytics | Dual-grain model, z-score readiness, market splits, validated contract |
| Innovation | Size-neutral readiness + absolute ops companion; steal-this-play with peer overlap |
| Feasibility | Static, auditable stack agencies can run; owner/effort on every play |
| Legacy | Playbook and district map reuse beyond FIFA 2026 |
| Visualization | Command shell + MapLibre spatial + dual-grain KPI presentation |
| Pitch | One clear story: monitor → compare → locate → act → reuse |

---

## 6. One-line close

**Nexus Pulse** tells host-city and FIFA resource managers who is pressured, how large the load is, where it sits on the map, and which plays to steal next, using one dual-grain evidence base that stays useful after the final whistle.
