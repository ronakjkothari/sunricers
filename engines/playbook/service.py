from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from .config import PlaybookConfig
from .loaders import allocation_notes, load_city_indicators
from .peers import attach_peers
from .plays import attach_plays
from .scoring import Scorecard, compute_scorecards


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


class PlaybookService:
    """Plan D back-engine: scorecards → peers → plays → export artifacts."""

    def __init__(self, config: PlaybookConfig | None = None, root: Path | None = None):
        self.root = root or repo_root()
        self.config = config or PlaybookConfig()
        if not self.config.curated_dir.is_absolute():
            self.curated = (self.root / self.config.curated_dir).resolve()
        else:
            self.curated = self.config.curated_dir
        if not self.config.output_dir.is_absolute():
            self.output = (self.root / self.config.output_dir).resolve()
        else:
            self.output = self.config.output_dir
    def compute(self) -> list[Scorecard]:
        indicators = load_city_indicators(
            self.curated, summer_months=self.config.summer_months
        )
        cards = compute_scorecards(indicators, self.config)
        cards = attach_peers(cards, self.config)
        cards = attach_plays(cards, self.config)
        return cards

    def build_payload(self, cards: list[Scorecard] | None = None) -> dict:
        cards = cards or self.compute()
        return {
            "meta": {
                "engine": "plan_d_eleven_hosts_playbook",
                "version": "0.1.0",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "disclaimer": (
                    "Sample data are transformed (noise/jitter). Scores demonstrate "
                    "comparative methodology for mega-event resource readiness — "
                    "not ground-truth city rankings."
                ),
                "formula": {
                    "stress": (
                        "0.35*z(energy)+0.25*z(co2e)+0.20*z(water)"
                        "+0.10*z(cdd)+0.10*z(uhi)"
                    ),
                    "readiness": (
                        "min-max rescale of inverted stress to 0–100 across 11 hosts; "
                        "higher = lower relative summer nexus load"
                    ),
                    "window": f"months={list(self.config.summer_months)} (tournament analog)",
                    "uncertainty_pct": self.config.uncertainty_pct,
                },
                "config": self.config.to_dict(),
                "allocation": allocation_notes(self.curated),
            },
            "scorecards": [c.to_dict() for c in cards],
        }

    def export(self, cards: list[Scorecard] | None = None) -> dict[str, Path]:
        cards = cards or self.compute()
        self.output.mkdir(parents=True, exist_ok=True)
        payload = self.build_payload(cards)

        json_path = self.output / "playbook_scorecards.json"
        json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

        csv_path = self.output / "playbook_scorecards.csv"
        with csv_path.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(
                fh,
                fieldnames=[
                    "rank",
                    "host_city",
                    "readiness_score",
                    "readiness_lo",
                    "readiness_hi",
                    "stress_index",
                    "z_energy_kwh",
                    "z_kg_co2e",
                    "z_water_liters",
                    "z_cdd",
                    "z_uhi",
                    "peer_1",
                    "peer_2",
                    "peer_3",
                    "play_1",
                    "play_2",
                    "play_3",
                ],
            )
            writer.writeheader()
            for c in cards:
                peers = (c.peer_cities or []) + ["", "", ""]
                plays = [p["title"] for p in (c.recommended_plays or [])] + ["", "", ""]
                writer.writerow(
                    {
                        "rank": c.rank,
                        "host_city": c.host_city,
                        "readiness_score": round(c.readiness_score, 2),
                        "readiness_lo": round(c.readiness_band[0], 2),
                        "readiness_hi": round(c.readiness_band[1], 2),
                        "stress_index": round(c.stress_index, 4),
                        "z_energy_kwh": round(c.z_components["energy_kwh"], 4),
                        "z_kg_co2e": round(c.z_components["kg_co2e"], 4),
                        "z_water_liters": round(c.z_components["water_liters"], 4),
                        "z_cdd": round(c.z_components["cdd"], 4),
                        "z_uhi": round(c.z_components["uhi"], 4),
                        "peer_1": peers[0],
                        "peer_2": peers[1],
                        "peer_3": peers[2],
                        "play_1": plays[0],
                        "play_2": plays[1],
                        "play_3": plays[2],
                    }
                )

        plays_path = self.output / "playbook_plays_by_city.json"
        plays_payload = {
            c.host_city: c.recommended_plays for c in cards
        }
        plays_path.write_text(json.dumps(plays_payload, indent=2), encoding="utf-8")

        return {
            "json": json_path,
            "csv": csv_path,
            "plays_json": plays_path,
        }


def build_default_service(root: Path | None = None) -> PlaybookService:
    return PlaybookService(PlaybookConfig(), root=root)
