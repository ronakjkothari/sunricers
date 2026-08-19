# sunricers

Rice Urban Sustainability Hackathon — **Track 2: Energy–Food–Water Nexus**

## Run the demo

```bash
python -m engines.playbook.cli --source map --sync-app --validate   # D → app/data
python scripts/build_overview_kpis.py                               # A Overview series
cd app && python -m http.server 8000                                # http://localhost:8000
```

Check the shell still works after changing it: `node scripts/test_shell.js`
(everything except pixels — layout and the embedded map still need a browser).

**Nexus Pulse** (`app/index.html`) is the front door: one host-city selector driving four
tabs — Overview (KPIs + monthly load), Compare hosts (Plan D readiness + steal-this-play),
Spatial map (Plan B, embedded), Scenarios (visitor surge; the full lever lab is next).
See [`app/README.md`](app/README.md) for how the pieces wire together.

## Start here (teammates)

1. [`docs/TRACK2_DATA_SHORTLIST.md`](docs/TRACK2_DATA_SHORTLIST.md) — what data matters and why  
2. [`docs/DATA_TECH_DOCUMENT.md`](docs/DATA_TECH_DOCUMENT.md) — schemas, intensity factors, joins  
3. [`docs/PROPOSED_SOLUTION_PLANS.md`](docs/PROPOSED_SOLUTION_PLANS.md) — 4 architectures to brainstorm from  
4. [`docs/A_FEATURE_REQUIREMENTS.md`](docs/A_FEATURE_REQUIREMENTS.md) — what the A shell must do, plus the demo script  
5. [`docs/A_ARCHITECTURE.md`](docs/A_ARCHITECTURE.md) — how A is built: state, the D and B seams, where C plugs in  
6. **[`data/curated/`](data/curated/)** — viz-ready CSV package (load these, not the 8 GB raw dumps)

### Plan D engine (standalone)

Comparative readiness playbook for 11 hosts — **A mounts** [`data/playbook/a_integration_v1.json`](data/playbook/a_integration_v1.json):

```bash
python -m engines.playbook.cli --validate
python scripts/test_playbook_contract.py
```

Contract: [`engines/playbook/CONTRACT.md`](engines/playbook/CONTRACT.md) · Preview: `data/playbook/preview.html`

## Rebuild curated package

Requires local raw `*-rice` folders under Downloads (paths set in the script) and `duckdb`:

```bash
pip install duckdb
python scripts/build_track2_curated_package.py
```

## Hackathon

[Devpost — Rice Urban Sustainability Hackathon](https://rice-urban-sustainability.devpost.com/)
