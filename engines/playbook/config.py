from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Literal

IndicatorSource = Literal["map", "curated", "auto"]


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

    # Demand indicator source for z-scores.
    #   auto  — map if app/data exists, else curated (product default)
    #   map   — spend-patterns per-shop rates (same as B Spatial)
    #   curated — store-visits city totals
    indicator_source: IndicatorSource = "auto"

    # Paths (relative to repo root unless absolute)
    curated_dir: Path = field(
        default_factory=lambda: Path("data") / "curated"
    )
    app_data_dir: Path = field(
        default_factory=lambda: Path("app") / "data"
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
        d["app_data_dir"] = str(self.app_data_dir)
        d["output_dir"] = str(self.output_dir)
        d["summer_months"] = list(self.summer_months)
        return d
