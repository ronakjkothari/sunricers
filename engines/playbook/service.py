from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from .config import PlaybookConfig
from .contract import (
    CONTRACT_VERSION,
    build_a_contract_payload,
    validate_a_contract,
)
from .loaders import allocation_notes, load_city_indicators
from .peers import attach_peers
from .plays import attach_plays
from .scoring import Scorecard, compute_scorecards

ENGINE_VERSION = "0.2.0"


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
                "version": ENGINE_VERSION,
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
                    "play_rule": (
                        "recommended_plays require match_score>0 (elevated z on "
                        "target drivers); general_options are non-pressing fallbacks"
                    ),
                },
                "config": self.config.to_dict(),
                "allocation": allocation_notes(self.curated),
            },
            "scorecards": [c.to_dict() for c in cards],
        }

    def build_a_contract(self, cards: list[Scorecard] | None = None) -> dict:
        return build_a_contract_payload(self.build_payload(cards))

    def export(self, cards: list[Scorecard] | None = None) -> dict[str, Path]:
        cards = cards or self.compute()
        self.output.mkdir(parents=True, exist_ok=True)
        payload = self.build_payload(cards)
        a_contract = build_a_contract_payload(payload)

        errors = validate_a_contract(a_contract)
        if errors:
            raise RuntimeError(
                "A-integration contract failed validation:\n- " + "\n- ".join(errors)
            )

        json_path = self.output / "playbook_scorecards.json"
        json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

        a_path = self.output / "a_integration_v1.json"
        a_path.write_text(json.dumps(a_contract, indent=2), encoding="utf-8")

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
                    "primary_drivers",
                    "z_energy_kwh",
                    "z_kg_co2e",
                    "z_water_liters",
                    "z_cdd",
                    "z_uhi",
                    "peer_1",
                    "peer_2",
                    "peer_3",
                    "pressing_play_count",
                    "play_1",
                    "play_1_steal_from",
                    "play_2",
                    "play_2_steal_from",
                    "play_3",
                    "play_3_steal_from",
                ],
            )
            writer.writeheader()
            for c in cards:
                peers = (c.peer_cities or []) + ["", "", ""]
                plays = (c.recommended_plays or []) + [None, None, None]
                row = {
                    "rank": c.rank,
                    "host_city": c.host_city,
                    "readiness_score": round(c.readiness_score, 2),
                    "readiness_lo": round(c.readiness_band[0], 2),
                    "readiness_hi": round(c.readiness_band[1], 2),
                    "stress_index": round(c.stress_index, 4),
                    "primary_drivers": "|".join(c.primary_pressure_drivers()),
                    "z_energy_kwh": round(c.z_components["energy_kwh"], 4),
                    "z_kg_co2e": round(c.z_components["kg_co2e"], 4),
                    "z_water_liters": round(c.z_components["water_liters"], 4),
                    "z_cdd": round(c.z_components["cdd"], 4),
                    "z_uhi": round(c.z_components["uhi"], 4),
                    "peer_1": peers[0],
                    "peer_2": peers[1],
                    "peer_3": peers[2],
                    "pressing_play_count": len(c.recommended_plays or []),
                }
                for i in range(3):
                    p = plays[i]
                    row[f"play_{i+1}"] = p["title"] if p else ""
                    row[f"play_{i+1}_steal_from"] = (
                        "|".join(p.get("steal_from_peers") or []) if p else ""
                    )
                writer.writerow(row)

        plays_path = self.output / "playbook_plays_by_city.json"
        plays_payload = {
            c.host_city: {
                "recommended_plays": c.recommended_plays,
                "general_options": c.general_options,
            }
            for c in cards
        }
        plays_path.write_text(json.dumps(plays_payload, indent=2), encoding="utf-8")

        # Per-city one-pager markdown (legacy export artifact)
        cards_dir = self.output / "city_cards"
        cards_dir.mkdir(exist_ok=True)
        for c in cards:
            md = _city_markdown(c)
            (cards_dir / f"{_slug(c.host_city)}.md").write_text(md, encoding="utf-8")

        return {
            "json": json_path,
            "a_integration": a_path,
            "csv": csv_path,
            "plays_json": plays_path,
            "city_cards_dir": cards_dir,
        }


def _slug(name: str) -> str:
    return name.lower().replace("/", "_").replace(" ", "_")


def _city_markdown(c: Scorecard) -> str:
    lines = [
        f"# {c.host_city} — FIFA 2026 EFW readiness playbook",
        "",
        f"**Rank:** #{c.rank} of 11  ",
        f"**Readiness:** {c.readiness_score:.1f} / 100 "
        f"(band {c.readiness_band[0]:.0f}–{c.readiness_band[1]:.0f})  ",
        f"**Stress index:** {c.stress_index:.3f}  ",
        f"**Peers:** {', '.join(c.peer_cities or []) or '—'}  ",
        "",
        "> Sample-data methodology demo — not a ground-truth city ranking.",
        "",
        "## Pressure drivers (z vs other hosts)",
        "",
        "| Driver | z | Status |",
        "|--------|--:|--------|",
    ]
    for d in c.drivers():
        status = "elevated" if d["elevated"] else "at/below average"
        lines.append(f"| {d['label']} | {d['z']:+.2f} | {status} |")
    lines += ["", "## Steal these plays", ""]
    if not c.recommended_plays:
        lines.append("_No pressing plays (all drivers at/below host average)._")
    for p in c.recommended_plays or []:
        steal = ", ".join(p.get("steal_from_peers") or []) or "—"
        eff = p["expected_effects"]
        lines += [
            f"### {p['title']}",
            "",
            f"- **Owner:** {p['owner']}",
            f"- **Effort:** {p['effort']}",
            f"- **Legacy use:** {p['legacy_use']}",
            f"- **Steal from peers:** {steal}",
            f"- **Expected effects:** energy {eff['energy_pct']}%, "
            f"food CO₂e {eff['food_co2e_pct']}%, water {eff['water_pct']}%",
            f"- **Why:** {p['rationale']}",
            "",
        ]
    if c.general_options:
        lines += ["## General options (not pressing)", ""]
        for p in c.general_options:
            lines.append(f"- **{p['title']}** ({p['effort']} effort) — {p['legacy_use']}")
        lines.append("")
    lines += [
        "---",
        f"_Generated by Plan D engine v{ENGINE_VERSION}; "
        f"A-contract {CONTRACT_VERSION}_",
    ]
    return "\n".join(lines)


def build_default_service(root: Path | None = None) -> PlaybookService:
    return PlaybookService(PlaybookConfig(), root=root)
