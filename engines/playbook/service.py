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
from .indicators import default_source, resolve_indicators
from .loaders import allocation_notes
from .ops_context import (
    attach_play_absolute_deltas,
    build_ops_context,
    compact_for_app,
    public_payload,
)
from .peers import attach_peers
from .plays import attach_plays
from .scoring import Scorecard, compute_scorecards

ENGINE_VERSION = "0.4.0"


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


class PlaybookService:
    """Plan D back-engine: scorecards → peers → plays → export artifacts."""

    def __init__(self, config: PlaybookConfig | None = None, root: Path | None = None):
        self.root = root or repo_root()
        self.config = config or PlaybookConfig()
        self.curated = self._resolve(self.config.curated_dir)
        self.app_data = self._resolve(self.config.app_data_dir)
        self.output = self._resolve(self.config.output_dir)
        self._source_meta: dict | None = None
        self._resolved_source: str | None = None
        self._ops_context: dict | None = None

    def _resolve(self, path: Path) -> Path:
        return path if path.is_absolute() else (self.root / path).resolve()

    def _pick_source(self) -> str:
        src = self.config.indicator_source
        if src == "auto":
            return default_source(self.app_data)
        return src

    def _ensure_ops_context(self) -> dict:
        if self._ops_context is None:
            self._ops_context = build_ops_context(
                self.curated, summer_months=self.config.summer_months
            )
        return self._ops_context

    def compute(self) -> list[Scorecard]:
        source = self._pick_source()
        indicators, meta = resolve_indicators(
            source=source,  # type: ignore[arg-type]
            curated=self.curated,
            app_data=self.app_data,
            summer_months=self.config.summer_months,
        )
        self._resolved_source = source
        self._source_meta = meta
        ops = self._ensure_ops_context()
        by_city = ops.get("_by_city") or {}
        cards = compute_scorecards(indicators, self.config)
        cards = attach_peers(cards, self.config)
        cards = attach_plays(cards, self.config)
        # Annotate plays with illustrative absolute deltas (ops scale, not rates)
        for c in cards:
            abs_row = (by_city.get(c.host_city) or {}).get("absolute") or {}
            if c.recommended_plays:
                c.recommended_plays = attach_play_absolute_deltas(
                    c.recommended_plays, abs_row
                )
            if c.general_options:
                c.general_options = attach_play_absolute_deltas(
                    c.general_options, abs_row
                )
        return cards

    def build_payload(self, cards: list[Scorecard] | None = None) -> dict:
        cards = cards or self.compute()
        source_meta = self._source_meta or {}
        resolved = self._resolved_source or self._pick_source()
        ops = self._ensure_ops_context()
        by_city = ops.get("_by_city") or {}
        scorecards = []
        for c in cards:
            row = c.to_dict()
            ctx = by_city.get(c.host_city)
            if ctx:
                # Labeled companion — never used in z-score / rank
                row["ops_scale"] = {
                    "absolute": ctx["absolute"],
                    "visit_mix": ctx["visit_mix"],
                    "spend": ctx["spend"],
                    "poi_structure": ctx["poi_structure"],
                    "climate": ctx["climate"],
                    "top_brands_by_visits": ctx["top_brands_by_visits"],
                    "not_used_in_readiness": True,
                }
            scorecards.append(row)
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
                "indicator_source": {
                    "resolved": resolved,
                    **source_meta,
                },
                "ops_context": {
                    "context_id": ops.get("context_id"),
                    "context_version": ops.get("context_version"),
                    "role": "ops_scale",
                    "not_used_in_readiness": True,
                    "grain_note": (ops.get("meta") or {}).get("grain_note"),
                },
                "formula": {
                    # Structured weights so the UI can render the score's
                    # decomposition without parsing prose, and so revising the
                    # weights stays a data change. The string is derived from
                    # the same source, and can no longer drift from it.
                    "weights": dict(self.config.weight_map()),
                    "stress": "+".join(
                        f"{w:g}*z({label})"
                        for label, w in (
                            ("energy", self.config.weight_energy),
                            ("co2e", self.config.weight_food_co2e),
                            ("water", self.config.weight_water),
                            ("cdd", self.config.weight_cdd),
                            ("uhi", self.config.weight_uhi),
                        )
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
                "allocation": allocation_notes(self.curated)
                if resolved == "curated"
                else {},
            },
            "scorecards": scorecards,
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

        app_scorecards = self.output / "scorecards_for_app.json"
        ops = self._ensure_ops_context()
        by_city = ops.get("_by_city") or {}
        app_payload = {
            "meta": {
                "source": (self._source_meta or {}).get("label"),
                "method": payload["meta"]["formula"]["stress"]
                + "; readiness = inverted stress, min-max 0-100, band +/-15",
                "unit": (self._source_meta or {}).get("unit"),
                "indicator_source": self._resolved_source,
                "ops_scale": "see app/data/ops_context.json — not used in readiness",
            },
            "cards": [
                {
                    "c": c.host_city,
                    "rank": c.rank,
                    "score": round(c.readiness_score, 1),
                    "band": [
                        round(c.readiness_band[0], 1),
                        round(c.readiness_band[1], 1),
                    ],
                    "z": {k: round(v, 2) for k, v in c.z_components.items()},
                    "raw": {k: round(v, 3) for k, v in c.raw.items()},
                    "peers": c.peer_cities,
                    "plays": [
                        {
                            "t": p["title"],
                            "e": p["expected_effects"],
                            "d": p.get("illustrative_absolute_delta"),
                            "why": p["rationale"],
                            "owner": p.get("owner"),
                            "effort": p.get("effort"),
                            "legacy_use": p.get("legacy_use"),
                            "steal_from_peers": p.get("steal_from_peers"),
                            "pressing": p.get("pressing", True),
                        }
                        for p in (c.recommended_plays or [])
                    ],
                }
                for c in cards
            ],
        }
        app_scorecards.write_text(
            json.dumps(app_payload, separators=(",", ":")), encoding="utf-8"
        )

        ops_full_path = self.output / "ops_context_v1.json"
        ops_full_path.write_text(
            json.dumps(public_payload(ops), indent=2), encoding="utf-8"
        )
        ops_app_path = self.output / "ops_context_for_app.json"
        ops_app_path.write_text(
            json.dumps(compact_for_app(ops), separators=(",", ":")), encoding="utf-8"
        )

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

        cards_dir = self.output / "city_cards"
        cards_dir.mkdir(exist_ok=True)
        for c in cards:
            ctx = by_city.get(c.host_city)
            md = _city_markdown(c, ops_scale=ctx)
            (cards_dir / f"{_slug(c.host_city)}.md").write_text(md, encoding="utf-8")

        return {
            "json": json_path,
            "a_integration": a_path,
            "ops_context": ops_full_path,
            "ops_context_app": ops_app_path,
            "app_scorecards": app_scorecards,
            "csv": csv_path,
            "plays_json": plays_path,
            "city_cards_dir": cards_dir,
        }


def _slug(name: str) -> str:
    return name.lower().replace("/", "_").replace(" ", "_")


def _fmt_big(n: float) -> str:
    abs_n = abs(n)
    if abs_n >= 1e9:
        return f"{n/1e9:.2f}B"
    if abs_n >= 1e6:
        return f"{n/1e6:.2f}M"
    if abs_n >= 1e3:
        return f"{n/1e3:.1f}k"
    return f"{n:.0f}"


def _city_markdown(c: Scorecard, ops_scale: dict | None = None) -> str:
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
    ]
    if ops_scale:
        abs_ = ops_scale.get("absolute") or {}
        mix = ops_scale.get("visit_mix") or {}
        lines += [
            "## Ops scale (city totals — not used in readiness)",
            "",
            f"- **Energy:** {_fmt_big(abs_.get('energy_kwh', 0))} kWh (summer)  ",
            f"- **Water:** {_fmt_big(abs_.get('water_liters', 0))} L  ",
            f"- **CO₂e:** {_fmt_big(abs_.get('kg_co2e', 0))} kg  ",
            f"- **Visit mix:** "
            + ", ".join(f"{k} {v:.0%}" for k, v in list(mix.items())[:4]),
            "",
            "_Intensity (per shop-month) drives rank; absolutes size the load._",
            "",
        ]
    lines += [
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
        delta = p.get("illustrative_absolute_delta") or {}
        lines += [
            f"### {p['title']}",
            "",
            f"- **Owner:** {p['owner']}",
            f"- **Effort:** {p['effort']}",
            f"- **Legacy use:** {p['legacy_use']}",
            f"- **Steal from peers:** {steal}",
            f"- **Expected effects:** energy {eff['energy_pct']}%, "
            f"food CO₂e {eff['food_co2e_pct']}%, water {eff['water_pct']}%",
        ]
        if delta:
            lines.append(
                f"- **Illustrative citywide Δ:** energy {_fmt_big(delta.get('energy_kwh', 0))} kWh · "
                f"water {_fmt_big(delta.get('water_liters', 0))} L · "
                f"CO₂e {_fmt_big(delta.get('kg_co2e', 0))} kg"
            )
        lines += [
            f"- **Why:** {p['rationale']}",
            "",
        ]
    if c.general_options:
        lines += ["## General options (not pressing)", ""]
        for p in c.general_options:
            lines.append(
                f"- **{p['title']}** ({p['effort']} effort) — {p['legacy_use']}"
            )
        lines.append("")
    lines += [
        "---",
        f"_Generated by Plan D engine v{ENGINE_VERSION}; "
        f"A-contract {CONTRACT_VERSION}_",
    ]
    return "\n".join(lines)


def build_default_service(root: Path | None = None) -> PlaybookService:
    return PlaybookService(PlaybookConfig(), root=root)
