"""CLI for Plan D playbook engine.

Usage (from repo root):
  python -m engines.playbook.cli
  python -m engines.playbook.cli --source map
  python -m engines.playbook.cli --source curated
  python -m engines.playbook.cli --validate
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from .config import PlaybookConfig
from .contract import validate_a_contract
from .service import PlaybookService, repo_root


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Plan D — Eleven Hosts Playbook back-engine"
    )
    parser.add_argument("--curated", type=Path, default=None)
    parser.add_argument("--app-data", type=Path, default=None)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--city", type=str, default=None)
    parser.add_argument("--pretty", action="store_true")
    parser.add_argument(
        "--source",
        choices=["auto", "map", "curated"],
        default="auto",
        help="Demand indicators: map (spend-patterns rates, matches B) | "
        "curated (store-visits totals) | auto (map if app/data exists)",
    )
    parser.add_argument(
        "--sync-app",
        action="store_true",
        help="Also copy scorecards_for_app.json → app/data/scorecards.json",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Export and print A-contract validation result",
    )
    parser.add_argument(
        "--uncertainty",
        type=float,
        default=0.15,
        help="Uncertainty band as fraction (default 0.15)",
    )
    args = parser.parse_args(argv)

    root = repo_root()
    cfg_kwargs: dict = {
        "uncertainty_pct": args.uncertainty,
        "indicator_source": args.source,
    }
    if args.curated:
        cfg_kwargs["curated_dir"] = args.curated
    if args.app_data:
        cfg_kwargs["app_data_dir"] = args.app_data
    if args.out:
        cfg_kwargs["output_dir"] = args.out
    cfg = PlaybookConfig(**cfg_kwargs)

    svc = PlaybookService(cfg, root=root)
    cards = svc.compute()
    paths = svc.export(cards)
    a_contract = svc.build_a_contract(cards)
    errors = validate_a_contract(a_contract)

    print("Plan D playbook export complete:")
    for label, path in paths.items():
        print(f"  {label}: {path}")
    src = (a_contract.get("meta") or {}).get("indicator_source") or {}
    print(f"  indicator_source: {src.get('resolved')} — {src.get('label')}")

    if args.sync_app and "app_scorecards" in paths:
        app_data = root / "app" / "data"
        dest = app_data / "scorecards.json"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(paths["app_scorecards"], dest)
        print(f"  synced -> {dest}")
        if "ops_context_app" in paths:
            ops_dest = app_data / "ops_context.json"
            shutil.copyfile(paths["ops_context_app"], ops_dest)
            print(f"  synced -> {ops_dest}")
        # A shell is served from app/, so it needs the contract and the
        # one-pagers inside that root too.
        if "a_integration" in paths:
            a_dest = app_data / "a_integration.json"
            shutil.copyfile(paths["a_integration"], a_dest)
            print(f"  synced -> {a_dest}")
        if "city_cards_dir" in paths:
            cards_dest = app_data / "city_cards"
            cards_dest.mkdir(parents=True, exist_ok=True)
            for card in sorted(paths["city_cards_dir"].glob("*.md")):
                shutil.copyfile(card, cards_dest / card.name)
            print(f"  synced -> {cards_dest} ({len(list(cards_dest.glob('*.md')))} cards)")

    if errors:
        print("A-CONTRACT INVALID:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 2

    print(f"A-contract OK (v{a_contract['contract_version']}, 11 cities)")

    if args.validate and not args.city and not args.pretty:
        print("\nPressing plays per city:")
        for c in cards:
            titles = [p["title"][:42] for p in (c.recommended_plays or [])]
            print(f"  #{c.rank:>2} {c.host_city:<24} {len(titles)}  {titles}")
        return 0

    if args.city:
        match = next(
            (c for c in cards if c.host_city.lower() == args.city.lower()),
            None,
        )
        if not match:
            print(f"City not found: {args.city}", file=sys.stderr)
            print("Known:", ", ".join(c.host_city for c in cards), file=sys.stderr)
            return 1
        print(json.dumps(match.to_dict(), indent=2))
    elif args.pretty:
        print(json.dumps(a_contract, indent=2))
    else:
        print("\nReadiness leaderboard (higher = more ready):")
        for c in cards:
            n_plays = len(c.recommended_plays or [])
            drivers = ",".join(c.primary_pressure_drivers()[:2]) or "—"
            print(
                f"  #{c.rank:>2}  {c.host_city:<24}  "
                f"{c.readiness_score:5.1f}  "
                f"[{c.readiness_band[0]:.0f}–{c.readiness_band[1]:.0f}]  "
                f"plays={n_plays}  drivers={drivers}  "
                f"peers={', '.join(c.peer_cities or [])}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
