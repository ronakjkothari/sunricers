# Plan D — Eleven Hosts Playbook (standalone back-engine)

**Role:** comparative sustainability-**readiness** scorecards for the 11 U.S. host cities, plus peer sets and transferable intervention plays. Built to plug into Plan A (Nexus Pulse) later — no A UI dependency.

## A integration (start here)

| Artifact | Path |
|----------|------|
| **Frozen contract** | [`CONTRACT.md`](./CONTRACT.md) |
| **JSON A mounts** | [`../../data/playbook/a_integration_v1.json`](../../data/playbook/a_integration_v1.json) |
| **Preview UI** | [`../../data/playbook/preview.html`](../../data/playbook/preview.html) |
| **City one-pagers** | `../../data/playbook/city_cards/*.md` |

```bash
# from repo root
python -m engines.playbook.cli --validate
python scripts/test_playbook_contract.py
```

## Guarantees (v0.2 / contract 1.0.0)

- Exactly 11 scorecards
- `recommended_plays` only include **pressing** plays (`match_score > 0`)
- Each play carries `owner`, `effort`, `legacy_use`, `peer_overlap`, `steal_from_peers`, `expected_effects`
- `drivers[]` (5) ready for radar / parallel coords / pressure filters
- Export **fails** if contract validation fails

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
