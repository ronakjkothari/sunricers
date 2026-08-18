"""CLI for Plan D playbook engine.

Usage (from repo root):
  python -m engines.playbook.cli
  python -m engines.playbook.cli --validate
  python -m engines.playbook.cli --city Miami
  python -m engines.playbook.cli --pretty
"""

from __future__ import annotations

import argparse
import json
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
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--city", type=str, default=None)
    parser.add_argument("--pretty", action="store_true")
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
    cfg_kwargs: dict = {"uncertainty_pct": args.uncertainty}
    if args.curated:
        cfg_kwargs["curated_dir"] = args.curated
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

    if errors:
        print("A-CONTRACT INVALID:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 2

    print(f"A-contract OK (v{a_contract['contract_version']}, 11 cities)")

    if args.validate and not args.city and not args.pretty:
        # summary of pressing plays
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
