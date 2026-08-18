from __future__ import annotations

import math
import statistics
from dataclasses import dataclass

from .config import PlaybookConfig


COMPONENT_KEYS = ("energy_kwh", "kg_co2e", "water_liters", "cdd", "uhi")


@dataclass
class Scorecard:
    host_city: str
    raw: dict[str, float]
    z_components: dict[str, float]
    stress_index: float
    readiness_score: float  # 0–100, higher = more ready / lower relative nexus load
    readiness_band: tuple[float, float]  # uncertainty band
    rank: int | None = None
    peer_cities: list[str] | None = None
    recommended_plays: list[dict] | None = None

    def to_dict(self) -> dict:
        return {
            "host_city": self.host_city,
            "rank": self.rank,
            "readiness_score": round(self.readiness_score, 2),
            "readiness_band": [
                round(self.readiness_band[0], 2),
                round(self.readiness_band[1], 2),
            ],
            "stress_index": round(self.stress_index, 4),
            "z_components": {k: round(v, 4) for k, v in self.z_components.items()},
            "raw_indicators": {k: round(v, 4) for k, v in self.raw.items()},
            "peer_cities": self.peer_cities or [],
            "recommended_plays": self.recommended_plays or [],
        }


def _zscores(values: list[float]) -> list[float]:
    if len(values) < 2:
        return [0.0] * len(values)
    mean = statistics.fmean(values)
    stdev = statistics.pstdev(values)
    if stdev == 0:
        return [0.0] * len(values)
    return [(v - mean) / stdev for v in values]


def compute_scorecards(
    indicators: dict[str, dict[str, float]],
    config: PlaybookConfig,
) -> list[Scorecard]:
    cities = sorted(indicators.keys())
    weights = config.weight_map()

    # Per-component z across cities
    z_by_city: dict[str, dict[str, float]] = {c: {} for c in cities}
    for key in COMPONENT_KEYS:
        vals = [indicators[c].get(key, 0.0) for c in cities]
        zs = _zscores(vals)
        for city, z in zip(cities, zs):
            z_by_city[city][key] = z

    # Weighted stress (higher = more nexus pressure)
    stress: dict[str, float] = {}
    for city in cities:
        s = 0.0
        for key, w in weights.items():
            s += w * z_by_city[city][key]
        stress[city] = s

    # Readiness: invert stress, then min-max to 0–100 across the 11 hosts
    stress_vals = [stress[c] for c in cities]
    s_min, s_max = min(stress_vals), max(stress_vals)
    span = (s_max - s_min) or 1.0

    cards: list[Scorecard] = []
    for city in cities:
        # higher readiness when stress is lower
        readiness = 100.0 * (s_max - stress[city]) / span
        band_delta = 100.0 * config.uncertainty_pct
        lo = max(0.0, readiness - band_delta)
        hi = min(100.0, readiness + band_delta)
        cards.append(
            Scorecard(
                host_city=city,
                raw=dict(indicators[city]),
                z_components=dict(z_by_city[city]),
                stress_index=stress[city],
                readiness_score=readiness,
                readiness_band=(lo, hi),
            )
        )

    cards.sort(key=lambda c: c.readiness_score, reverse=True)
    for i, card in enumerate(cards, start=1):
        card.rank = i
    return cards


def profile_vector(card: Scorecard) -> list[float]:
    return [card.z_components[k] for k in COMPONENT_KEYS]


def euclidean(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))
