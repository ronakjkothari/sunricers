from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class PlaybookConfig:
    """Transparent methodology knobs for Plan D."""

    # Tournament-analog months (World Cup window proxy)
    summer_months: tuple[int, ...] = (6, 7)

    # Stress weights (sum = 1.0). Readiness = inverted / rescaled stress.
    weight_energy: float = 0.35
    weight_food_co2e: float = 0.25
    weight_water: float = 0.20
    weight_cdd: float = 0.10
    weight_uhi: float = 0.10

    # Synthetic-sample uncertainty band shown on scorecards
    uncertainty_pct: float = 0.15

    # Peer search
    peer_count: int = 3

    # Plays returned per city
    plays_per_city: int = 3

    # Paths (relative to repo root unless absolute)
    curated_dir: Path = field(
        default_factory=lambda: Path("data") / "curated"
    )
    output_dir: Path = field(
        default_factory=lambda: Path("data") / "playbook"
    )

    def weight_map(self) -> dict[str, float]:
        return {
            "energy_kwh": self.weight_energy,
            "kg_co2e": self.weight_food_co2e,
            "water_liters": self.weight_water,
            "cdd": self.weight_cdd,
            "uhi": self.weight_uhi,
        }

    def to_dict(self) -> dict:
        d = asdict(self)
        d["curated_dir"] = str(self.curated_dir)
        d["output_dir"] = str(self.output_dir)
        d["summer_months"] = list(self.summer_months)
        return d
