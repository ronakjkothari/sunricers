from __future__ import annotations

from .config import PlaybookConfig
from .scoring import Scorecard, euclidean, profile_vector


def attach_peers(cards: list[Scorecard], config: PlaybookConfig) -> list[Scorecard]:
    """Fill peer_cities on each scorecard using z-profile distance."""
    by_city = {c.host_city: c for c in cards}
    for card in cards:
        distances: list[tuple[float, str]] = []
        vec = profile_vector(card)
        for other in cards:
            if other.host_city == card.host_city:
                continue
            distances.append(
                (euclidean(vec, profile_vector(other)), other.host_city)
            )
        distances.sort(key=lambda t: t[0])
        card.peer_cities = [name for _, name in distances[: config.peer_count]]
        # keep object linked
        by_city[card.host_city] = card
    return cards
