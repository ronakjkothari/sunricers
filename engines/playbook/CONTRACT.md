"""
Plan D ↔ Plan A integration contract
====================================

**Mount this file in A:** [`data/playbook/a_integration_v1.json`](../../data/playbook/a_integration_v1.json)

| Field | Value |
|-------|-------|
| `contract_id` | `plan_d_a_integration` |
| `contract_version` | `1.0.0` |
| Engine | `engines/playbook` ≥ 0.2.0 |

Rebuild anytime:

```bash
python -m engines.playbook.cli
python -m engines.playbook.cli --validate
```

## UI slots A should reserve

| Slot | Source path | Purpose |
|------|-------------|---------|
| Compare strip | `scorecards[]` | 11 readiness cards + band |
| Driver chart | `scorecards[].drivers[]` | Radar / parallel coords (5 z-drivers) |
| Peer jump | `scorecards[].peer_cities[]` | Click peer → select that city |
| Steal this play | `scorecards[].recommended_plays[]` | Pressing plays only (`pressing: true`, `match_score > 0`) |
| General options | `scorecards[].general_options[]` | Optional non-pressing disclosure |
| Pressure filter | `indexes.by_primary_driver` or `drivers[].elevated` | Triage hosts by Energy/Water/Heat/… |
| Export card | one `scorecards[i]` | Printable / downloadable city playbook |

Also emitted as markdown one-pagers: `data/playbook/city_cards/*.md`.

## Play object (steal-this-play)

```json
{
  "id": "hotel_water_reuse",
  "title": "Hotel linen / laundry water-reuse program",
  "owner": "Hotel association + utility",
  "effort": "medium",
  "legacy_use": "Hotel BID ordinances for any mega-event peak week",
  "targets": ["water_liters", "energy_kwh"],
  "elevated_targets": [{"key": "water_liters", "label": "Water", "z": 1.2}],
  "expected_effects": {"energy_pct": -3, "food_co2e_pct": 0, "water_pct": -30},
  "match_score": 1.2,
  "pressing": true,
  "peer_overlap": [
    {
      "city": "Dallas",
      "shared_elevated_drivers": [{"key": "water_liters", "label": "Water", "city_z": 1.2, "peer_z": 0.8}],
      "readiness_score": 12.4,
      "rank": 10
    }
  ],
  "steal_from_peers": ["Dallas"],
  "rationale": "…"
}
```

## Guarantees (foolproof rules)

1. Exactly **11** scorecards, unique `host_city`.
2. `recommended_plays` never includes `match_score <= 0`.
3. `general_options` are always `pressing: false`.
4. Each scorecard has exactly **5** `drivers`.
5. `validate_a_contract()` fails the export if any rule breaks.

## Preview (no A required)

Open `data/playbook/preview.html` via a local static server (see README).
"""
