from __future__ import annotations

from .config import PlaybookConfig
from .scoring import Scorecard

# Rule-based transferable plays. Each play declares which z-drivers it targets.
PLAYBOOK_LIBRARY: list[dict] = [
    {
        "id": "plant_forward_concessions",
        "title": "Plant-forward concessions & catering defaults",
        "targets": ["kg_co2e", "water_liters", "energy_kwh"],
        "legacy_use": "Any stadium / convention F&B contract cycle",
        "owner": "Venue concessions + city food policy",
        "effort": "medium",
        "expected_effects": {
            "energy_pct": -5,
            "food_co2e_pct": -25,
            "water_pct": -8,
        },
        "why_template": (
            "{city} shows elevated food/CO₂e pressure (z={kg_co2e:.2f}). "
            "Peers with similar dining pressure: {peer_overlap}."
        ),
    },
    {
        "id": "hotel_water_reuse",
        "title": "Hotel linen / laundry water-reuse program",
        "targets": ["water_liters", "energy_kwh"],
        "legacy_use": "Hotel BID ordinances for any mega-event peak week",
        "owner": "Hotel association + utility",
        "effort": "medium",
        "expected_effects": {
            "energy_pct": -3,
            "food_co2e_pct": 0,
            "water_pct": -30,
        },
        "why_template": (
            "{city} water intensity is high relative to hosts (z={water_liters:.2f}). "
            "Peers with similar water pressure: {peer_overlap}."
        ),
    },
    {
        "id": "cool_roofs_shade_uhi",
        "title": "Cool roofs + shade in high-UHI hospitality corridors",
        "targets": ["uhi", "cdd", "energy_kwh"],
        "legacy_use": "Heat-action planning for summer festivals / playoffs",
        "owner": "City planning + downtown BID",
        "effort": "high",
        "expected_effects": {
            "energy_pct": -12,
            "food_co2e_pct": 0,
            "water_pct": -2,
        },
        "why_template": (
            "{city} couples heat and cooling load (UHI z={uhi:.2f}, CDD z={cdd:.2f}). "
            "Peers with similar heat/cooling pressure: {peer_overlap}."
        ),
    },
    {
        "id": "gasoline_visit_shift",
        "title": "Shift match-day access from gasoline to transit / EV hubs",
        "targets": ["energy_kwh"],
        "legacy_use": "Event traffic management playbooks citywide",
        "owner": "DOT + venue ops",
        "effort": "high",
        "expected_effects": {
            "energy_pct": -10,
            "food_co2e_pct": -2,
            "water_pct": 0,
        },
        "why_template": (
            "{city} energy footprint is fuel-heavy (z={energy_kwh:.2f}). "
            "Peers with similar energy pressure: {peer_overlap}."
        ),
    },
    {
        "id": "kitchen_water_efficiency",
        "title": "Commercial kitchen water-efficiency retrofit grants",
        "targets": ["water_liters", "kg_co2e"],
        "legacy_use": "Restaurant resilience grants post-event",
        "owner": "Economic development + water utility",
        "effort": "medium",
        "expected_effects": {
            "energy_pct": -2,
            "food_co2e_pct": -5,
            "water_pct": -15,
        },
        "why_template": (
            "{city} food-service density drives water use (water z={water_liters:.2f}). "
            "Peers with similar water/food pressure: {peer_overlap}."
        ),
    },
    {
        "id": "peak_cooling_setpoints",
        "title": "Event-week HVAC setpoint & pre-cooling protocols",
        "targets": ["cdd", "energy_kwh"],
        "legacy_use": "Heat-wave building ops for any summer peak",
        "owner": "Hotel engineering + venue facilities",
        "effort": "low",
        "expected_effects": {
            "energy_pct": -8,
            "food_co2e_pct": 0,
            "water_pct": -1,
        },
        "why_template": (
            "{city} summer CDD pressure is material (z={cdd:.2f}). "
            "Peers with similar cooling pressure: {peer_overlap}."
        ),
    },
]

DRIVER_LABELS = {
    "energy_kwh": "Energy",
    "kg_co2e": "Food CO₂e",
    "water_liters": "Water",
    "cdd": "Cooling (CDD)",
    "uhi": "Urban heat",
}


def _play_score(card: Scorecard, play: dict) -> float:
    """Higher when the city's elevated z-components match the play's targets."""
    score = 0.0
    for key in play["targets"]:
        z = card.z_components.get(key, 0.0)
        if z > 0:
            score += z
    return score


def _elevated_targets(card: Scorecard, play: dict) -> list[dict]:
    out = []
    for key in play["targets"]:
        z = card.z_components.get(key, 0.0)
        if z > 0:
            out.append(
                {
                    "key": key,
                    "label": DRIVER_LABELS.get(key, key),
                    "z": round(z, 4),
                }
            )
    return out


def _peer_overlap(
    card: Scorecard,
    play: dict,
    by_city: dict[str, Scorecard],
) -> list[dict]:
    """Peers that also show z>0 on at least one of this play's target drivers."""
    overlaps: list[dict] = []
    for peer_name in card.peer_cities or []:
        peer = by_city.get(peer_name)
        if not peer:
            continue
        shared = []
        for key in play["targets"]:
            z_self = card.z_components.get(key, 0.0)
            z_peer = peer.z_components.get(key, 0.0)
            if z_self > 0 and z_peer > 0:
                shared.append(
                    {
                        "key": key,
                        "label": DRIVER_LABELS.get(key, key),
                        "city_z": round(z_self, 4),
                        "peer_z": round(z_peer, 4),
                    }
                )
        if shared:
            overlaps.append(
                {
                    "city": peer_name,
                    "shared_elevated_drivers": shared,
                    "readiness_score": round(peer.readiness_score, 2),
                    "rank": peer.rank,
                }
            )
    return overlaps


def _serialize_play(
    card: Scorecard,
    play: dict,
    by_city: dict[str, Scorecard],
    *,
    pressing: bool,
) -> dict:
    elevated = _elevated_targets(card, play)
    overlap = _peer_overlap(card, play, by_city)
    overlap_names = ", ".join(o["city"] for o in overlap) or "none among nearest peers"
    rationale = play["why_template"].format(
        city=card.host_city,
        peers=", ".join(card.peer_cities or []) or "peer hosts",
        peer_overlap=overlap_names,
        **card.z_components,
    )
    if not pressing:
        rationale = (
            f"{card.host_city} is at or below host-average on this play's target drivers; "
            "kept as a general option, not a pressing priority."
        )
    return {
        "id": play["id"],
        "title": play["title"],
        "owner": play["owner"],
        "effort": play["effort"],
        "legacy_use": play["legacy_use"],
        "targets": play["targets"],
        "elevated_targets": elevated,
        "expected_effects": play["expected_effects"],
        "match_score": round(_play_score(card, play), 3),
        "pressing": pressing,
        "peer_overlap": overlap,
        "steal_from_peers": [o["city"] for o in overlap],
        "rationale": rationale,
    }


def recommend_plays(
    card: Scorecard,
    config: PlaybookConfig,
    by_city: dict[str, Scorecard] | None = None,
) -> list[dict]:
    """
    Return up to `plays_per_city` **pressing** plays (match_score > 0).

    If fewer than needed exist, do not pad with weak matches — return what
    qualifies. Callers that want general options can use `general_options`.
    """
    by_city = by_city or {card.host_city: card}
    ranked = sorted(
        PLAYBOOK_LIBRARY,
        key=lambda p: _play_score(card, p),
        reverse=True,
    )
    pressing = [p for p in ranked if _play_score(card, p) > 0]
    out: list[dict] = []
    for play in pressing[: config.plays_per_city]:
        out.append(_serialize_play(card, play, by_city, pressing=True))
    return out


def general_options(
    card: Scorecard,
    config: PlaybookConfig,
    by_city: dict[str, Scorecard] | None = None,
    limit: int = 2,
) -> list[dict]:
    """Non-pressing plays (match_score == 0) for optional UI disclosure."""
    by_city = by_city or {card.host_city: card}
    weak = [
        p for p in PLAYBOOK_LIBRARY if _play_score(card, p) <= 0
    ]
    # Prefer low-effort generals first
    effort_rank = {"low": 0, "medium": 1, "high": 2}
    weak.sort(key=lambda p: effort_rank.get(p["effort"], 9))
    return [
        _serialize_play(card, p, by_city, pressing=False) for p in weak[:limit]
    ]


def attach_plays(cards: list[Scorecard], config: PlaybookConfig) -> list[Scorecard]:
    by_city = {c.host_city: c for c in cards}
    for card in cards:
        card.recommended_plays = recommend_plays(card, config, by_city)
        card.general_options = general_options(card, config, by_city)
    return cards
