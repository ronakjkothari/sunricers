"""
Stable A-integration contract for Plan D.

Contract version: 1.0.0

A should mount `data/playbook/a_integration_v1.json` (or the identical
payload from `PlaybookService.build_a_contract()`). Do not parse unstable
internal fields from older exports.
"""

from __future__ import annotations

from typing import Any

CONTRACT_VERSION = "1.0.0"
CONTRACT_ID = "plan_d_a_integration"

REQUIRED_SCORECARD_KEYS = {
    "host_city",
    "rank",
    "readiness_score",
    "readiness_band",
    "stress_index",
    "drivers",
    "primary_pressure_drivers",
    "z_components",
    "peer_cities",
    "recommended_plays",
    "general_options",
}

REQUIRED_PLAY_KEYS = {
    "id",
    "title",
    "owner",
    "effort",
    "legacy_use",
    "targets",
    "elevated_targets",
    "expected_effects",
    "match_score",
    "pressing",
    "peer_overlap",
    "steal_from_peers",
    "rationale",
}

REQUIRED_DRIVER_KEYS = {"key", "label", "z", "elevated", "raw"}


class ContractError(ValueError):
    pass


def build_a_contract_payload(engine_payload: dict[str, Any]) -> dict[str, Any]:
    """Project the engine payload into the frozen A-facing shape."""
    cards_in = engine_payload.get("scorecards") or []
    cards_out = []
    for c in cards_in:
        cards_out.append(
            {
                "host_city": c["host_city"],
                "rank": c["rank"],
                "readiness_score": c["readiness_score"],
                "readiness_band": c["readiness_band"],
                "stress_index": c["stress_index"],
                "drivers": c.get("drivers") or [],
                "primary_pressure_drivers": c.get("primary_pressure_drivers") or [],
                "z_components": c["z_components"],
                "raw_indicators": c.get("raw_indicators") or {},
                "peer_cities": c.get("peer_cities") or [],
                "recommended_plays": c.get("recommended_plays") or [],
                "general_options": c.get("general_options") or [],
            }
        )

    meta_in = engine_payload.get("meta") or {}
    return {
        "contract_id": CONTRACT_ID,
        "contract_version": CONTRACT_VERSION,
        "meta": {
            "engine": meta_in.get("engine"),
            "engine_version": meta_in.get("version"),
            "generated_at": meta_in.get("generated_at"),
            "disclaimer": meta_in.get("disclaimer"),
            "formula": meta_in.get("formula"),
            "ui_slots": {
                "compare_strip": "scorecards[] → rank, readiness_score, readiness_band",
                "driver_chart": "scorecards[].drivers[] → radar / parallel coords",
                "peer_jump": "scorecards[].peer_cities[]",
                "steal_this_play": "scorecards[].recommended_plays[] (pressing only)",
                "general_options": "scorecards[].general_options[] (optional disclosure)",
                "pressure_filter": "scorecards[].primary_pressure_drivers[] / drivers[].elevated",
                "export_card": "one scorecard object = one printable city playbook page",
            },
        },
        "scorecards": cards_out,
        "indexes": {
            "by_city": {c["host_city"]: i for i, c in enumerate(cards_out)},
            "by_primary_driver": _index_by_driver(cards_out),
        },
    }


def _index_by_driver(cards: list[dict]) -> dict[str, list[str]]:
    idx: dict[str, list[str]] = {
        "energy_kwh": [],
        "kg_co2e": [],
        "water_liters": [],
        "cdd": [],
        "uhi": [],
    }
    for c in cards:
        for d in c.get("drivers") or []:
            if d.get("elevated") and d["key"] in idx:
                idx[d["key"]].append(c["host_city"])
    return idx


def validate_a_contract(payload: dict[str, Any]) -> list[str]:
    """Return a list of validation errors (empty = ok)."""
    errors: list[str] = []
    if payload.get("contract_id") != CONTRACT_ID:
        errors.append(f"contract_id must be {CONTRACT_ID}")
    if payload.get("contract_version") != CONTRACT_VERSION:
        errors.append(f"contract_version must be {CONTRACT_VERSION}")

    cards = payload.get("scorecards")
    if not isinstance(cards, list) or len(cards) != 11:
        errors.append(f"expected 11 scorecards, got {0 if not cards else len(cards)}")
        return errors

    cities = set()
    for i, c in enumerate(cards):
        missing = REQUIRED_SCORECARD_KEYS - set(c)
        if missing:
            errors.append(f"scorecard[{i}] missing keys: {sorted(missing)}")
            continue
        cities.add(c["host_city"])
        if not (0 <= c["readiness_score"] <= 100):
            errors.append(f"{c['host_city']}: readiness_score out of range")
        if len(c["readiness_band"]) != 2:
            errors.append(f"{c['host_city']}: readiness_band must be [lo, hi]")
        if len(c["drivers"]) != 5:
            errors.append(f"{c['host_city']}: drivers must have 5 entries")
        for d in c["drivers"]:
            if REQUIRED_DRIVER_KEYS - set(d):
                errors.append(f"{c['host_city']}: driver missing keys {REQUIRED_DRIVER_KEYS - set(d)}")
        for play in c["recommended_plays"]:
            miss = REQUIRED_PLAY_KEYS - set(play)
            if miss:
                errors.append(f"{c['host_city']} play missing {sorted(miss)}")
            if play.get("pressing") is not True:
                errors.append(f"{c['host_city']}: recommended_plays must all be pressing=true")
            if not (play.get("match_score", 0) > 0):
                errors.append(
                    f"{c['host_city']}: recommended play {play.get('id')} has match_score<=0"
                )
        for play in c.get("general_options") or []:
            if play.get("pressing") is not False:
                errors.append(f"{c['host_city']}: general_options must be pressing=false")
            if play.get("match_score", 1) > 0:
                errors.append(
                    f"{c['host_city']}: general option {play.get('id')} has match_score>0"
                )

    if len(cities) != 11:
        errors.append(f"expected 11 unique cities, got {len(cities)}")
    return errors
