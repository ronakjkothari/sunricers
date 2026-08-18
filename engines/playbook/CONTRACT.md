"""
Plan D ↔ Plan A integration contract
====================================

**Mount this file in A:** [`data/playbook/a_integration_v1.json`](../../data/playbook/a_integration_v1.json)

| Field | Value |
|-------|-------|
| `contract_id` | `plan_d_a_integration` |
| `contract_version` | `1.1.0` |
| Engine | `engines/playbook` ≥ 0.4.0 |

Rebuild anytime:

```bash
python -m engines.playbook.cli --source map --sync-app --validate
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
| Overview KPIs | `scorecards[].ops_scale.absolute` | City summer totals (**not** readiness) |
| Category / brands | `ops_scale.visit_mix`, `top_brands_by_visits` | Structure + storytelling |
| Spend strip | `ops_scale.spend` | Money corroboration |
| Play absolute Δ | `recommended_plays[].illustrative_absolute_delta` | % × city totals |

Also emitted:

- `data/playbook/ops_context_v1.json` — full ops pack for A/C
- `app/data/ops_context.json` — compact B side panel (`--sync-app`)
- `data/playbook/city_cards/*.md` — one-pagers with ops scale section

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
  "illustrative_absolute_delta": {
    "energy_kwh": -1.2e7,
    "water_liters": -4.5e8,
    "kg_co2e": 0.0,
    "basis": "summer city absolute totals × expected_effects %"
  },
  "match_score": 1.2,
  "pressing": true,
  "peer_overlap": [],
  "steal_from_peers": ["Dallas"],
  "rationale": "…"
}
```

## Guarantees (foolproof rules)

1. Exactly **11** scorecards, unique `host_city`.
2. `recommended_plays` never includes `match_score <= 0`.
3. `general_options` are always `pressing: false`.
4. Each scorecard has exactly **5** `drivers`.
5. `ops_scale` is labeled `not_used_in_readiness: true` — never feed into z-score.
6. `validate_a_contract()` fails the export if any rule breaks.

## Preview (no A required)

Open `data/playbook/preview.html` via a local static server (see README).
"""
