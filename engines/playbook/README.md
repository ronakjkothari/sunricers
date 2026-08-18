# Plan D — Eleven Hosts Playbook (standalone back-engine)

**Role:** comparative sustainability-**readiness** scorecards for the 11 U.S. host cities, plus peer sets and transferable intervention plays. Built to plug into Plan A (Nexus Pulse) later — no A UI dependency.

## A integration (start here)

| Artifact | Path |
|----------|------|
| **Frozen contract** | [`CONTRACT.md`](./CONTRACT.md) |
| **JSON A mounts** | [`../../data/playbook/a_integration_v1.json`](../../data/playbook/a_integration_v1.json) |
| **Indicator source policy** | [`../../docs/D_INDICATOR_SOURCES.md`](../../docs/D_INDICATOR_SOURCES.md) |
| **Preview UI** | [`../../data/playbook/preview.html`](../../data/playbook/preview.html) |

```bash
# Canonical: same demand grain as B Spatial (spend-patterns rates)
python -m engines.playbook.cli --source map --sync-app --validate
python scripts/test_playbook_contract.py
```

Do **not** blend store-visits totals with spend rates into one z-score. Use `--source curated` only when you explicitly want size-sensitive totals.

## Guarantees (v0.4 / contract 1.1.0)

- Exactly 11 scorecards
- `recommended_plays` only include **pressing** plays (`match_score > 0`)
- Each play carries `owner`, `effort`, `legacy_use`, `peer_overlap`, `steal_from_peers`, `expected_effects`, `illustrative_absolute_delta`
- `drivers[]` (5) ready for radar / parallel coords / pressure filters
- `ops_scale` companion (absolutes / mix / spend / brands / climate) labeled off the readiness path
- Export **fails** if contract validation fails

## Artifacts

| File | Consumer |
|------|----------|
| `a_integration_v1.json` | A shell |
| `ops_context_v1.json` | A Overview / C baselines |
| `ops_context_for_app.json` → `app/data/ops_context.json` | B side panel |
| `scorecards_for_app.json` → `app/data/scorecards.json` | B readiness strip |

## Run

```bash
python -m engines.playbook.cli
python -m engines.playbook.cli --city Miami
python -m engines.playbook.cli --pretty   # dumps a_integration_v1 payload
```

Preview:

```bash
cd data/playbook
python -m http.server 8090
# open http://localhost:8090/preview.html
```

## Optional HTTP API

```bash
pip install fastapi uvicorn
uvicorn engines.playbook.api:app --reload --port 8081
```

`GET /playbook` returns the full engine payload; prefer `a_integration_v1.json` for A.
