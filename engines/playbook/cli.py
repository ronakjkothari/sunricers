"""CLI for Plan D playbook engine.

Usage (from repo root):
  python -m engines.playbook.cli
  python -m engines.playbook.cli --pretty
  python -m engines.playbook.cli --city Miami
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import PlaybookConfig
from .service import PlaybookService, repo_root


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Plan D — Eleven Hosts Playbook back-engine"
    )
    parser.add_argument(
        "--curated",
        type=Path,
        default=None,
        help="Path to data/curated (default: <repo>/data/curated)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output directory (default: <repo>/data/playbook)",
    )
    parser.add_argument(
        "--city",
        type=str,
        default=None,
        help="Print one city scorecard to stdout",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print full JSON payload to stdout after export",
    )
    parser.add_argument(
        "--uncertainty",
        type=float,
        default=0.15,
        help="Uncertainty band as fraction (default 0.15 = ±15 pts on 0–100 scale)",
    )
    args = parser.parse_args(argv)

    root = repo_root()
    cfg = PlaybookConfig(uncertainty_pct=args.uncertainty)
    if args.curated:
        cfg = PlaybookConfig(
            uncertainty_pct=args.uncertainty,
            curated_dir=args.curated,
            output_dir=args.out or (root / "data" / "playbook"),
        )
    elif args.out:
        cfg = PlaybookConfig(
            uncertainty_pct=args.uncertainty,
            output_dir=args.out,
        )

    svc = PlaybookService(cfg, root=root)
    cards = svc.compute()
    paths = svc.export(cards)

    print("Plan D playbook export complete:")
    for label, path in paths.items():
        print(f"  {label}: {path}")

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
        print(json.dumps(svc.build_payload(cards), indent=2))
    else:
        # compact leaderboard for terminal
        print("\nReadiness leaderboard (higher = more ready):")
        for c in cards:
            print(
                f"  #{c.rank:>2}  {c.host_city:<24}  "
                f"{c.readiness_score:5.1f}  "
                f"[{c.readiness_band[0]:.0f}–{c.readiness_band[1]:.0f}]  "
                f"peers={', '.join(c.peer_cities or [])}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
