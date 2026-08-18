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
            "Peers {peers} face a similar dining mix — shared catering specs travel well."
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
            "Lodging-cluster interventions compound across visitor nights."
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
            "Corridor-scale cool roofs cut HVAC share for hotels and dining."
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
            "Access-mode shifts are the highest-leverage energy play for visitor surges."
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
            "Kitchen retrofits persist as legacy infrastructure after the Cup."
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
            "Operational setpoint protocols are fast to deploy and reuse annually."
        ),
    },
]


def _play_score(card: Scorecard, play: dict) -> float:
    """Higher when the city's elevated z-components match the play's targets."""
    score = 0.0
    for key in play["targets"]:
        z = card.z_components.get(key, 0.0)
        # Only reward plays that address above-average pressure
        if z > 0:
            score += z
    return score


def recommend_plays(card: Scorecard, config: PlaybookConfig) -> list[dict]:
    ranked = sorted(
        PLAYBOOK_LIBRARY,
        key=lambda p: _play_score(card, p),
        reverse=True,
    )
    peers = ", ".join(card.peer_cities or []) or "peer hosts"
    out: list[dict] = []
    for play in ranked[: config.plays_per_city]:
        why = play["why_template"].format(
            city=card.host_city,
            peers=peers,
            **card.z_components,
        )
        out.append(
            {
                "id": play["id"],
                "title": play["title"],
                "owner": play["owner"],
                "effort": play["effort"],
                "legacy_use": play["legacy_use"],
                "targets": play["targets"],
                "expected_effects": play["expected_effects"],
                "match_score": round(_play_score(card, play), 3),
                "rationale": why,
            }
        )
    return out


def attach_plays(cards: list[Scorecard], config: PlaybookConfig) -> list[Scorecard]:
    for card in cards:
        card.recommended_plays = recommend_plays(card, config)
    return cards
