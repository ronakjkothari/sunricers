# Plan D — Eleven Hosts Playbook (standalone back-engine)

**Role:** comparative sustainability-**readiness** scorecards for the 11 U.S. host cities, plus peer sets and transferable intervention plays. Built to plug into Plan A (Nexus Pulse) later — no A UI dependency.

## Alignment

| Concept | Implementation |
|---------|----------------|
| Stress model | Weighted sum of z-scores on summer Energy / CO₂e / Water / CDD / UHI |
| Readiness | Inverted stress, min-max scaled to **0–100** (higher = more ready) |
| Uncertainty | ±15 pts band (configurable) for synthetic-sample honesty |
| Peers | Nearest cities in z-profile space |
| Plays | Rule-matched interventions from a legacy-oriented play library |
| Split markets | Dallas/Houston & LA/SF visit+spend allocated by POI share |

## Run (no extra deps)

```bash
# from repo root
python -m engines.playbook.cli
python -m engines.playbook.cli --city Miami
python -m engines.playbook.cli --pretty
```

Artifacts land in `data/playbook/`:

- `playbook_scorecards.json` — full payload (meta + 11 scorecards) for A to ingest
- `playbook_scorecards.csv` — flat leaderboard
- `playbook_plays_by_city.json` — plays only

## Optional HTTP API

```bash
pip install fastapi uvicorn
uvicorn engines.playbook.api:app --reload --port 8081
```

- `GET /playbook` — full payload  
- `GET /playbook/scorecards` — array only  
- `GET /playbook/cities/{city}` — one scorecard  
- `POST /playbook/refresh` — recompute + rewrite artifacts  

## Contract for Plan A overlay

Each scorecard object:

```json
{
  "host_city": "Miami",
  "rank": 4,
  "readiness_score": 62.3,
  "readiness_band": [47.3, 77.3],
  "stress_index": -0.12,
  "z_components": {
    "energy_kwh": 0.4,
    "kg_co2e": 0.1,
    "water_liters": -0.2,
    "cdd": 1.1,
    "uhi": 0.8
  },
  "raw_indicators": { "...": "..." },
  "peer_cities": ["Houston", "Dallas", "Atlanta"],
  "recommended_plays": [
    {
      "id": "cool_roofs_shade_uhi",
      "title": "...",
      "rationale": "...",
      "expected_effects": { "energy_pct": -12, "water_pct": -2, "food_co2e_pct": 0 }
    }
  ]
}
```

A can render the leaderboard strip + “Steal this play” panel from this JSON without reimplementing scoring.
