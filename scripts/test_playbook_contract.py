"""Smoke-test Plan D A-integration contract.

Run from repo root:
  python scripts/test_playbook_contract.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engines.playbook.contract import CONTRACT_VERSION, validate_a_contract
from engines.playbook.service import PlaybookService


def main() -> int:
    svc = PlaybookService(root=ROOT)
    cards = svc.compute()
    paths = svc.export(cards)
    contract = json.loads(paths["a_integration"].read_text(encoding="utf-8"))
    errors = validate_a_contract(contract)

    print(f"contract_version={contract.get('contract_version')} (expected {CONTRACT_VERSION})")
    print(f"cities={len(contract['scorecards'])}")
    for c in contract["scorecards"]:
        n = len(c["recommended_plays"])
        weak = [p["id"] for p in c["recommended_plays"] if p["match_score"] <= 0]
        print(
            f"  #{c['rank']:>2} {c['host_city']:<24} "
            f"ready={c['readiness_score']:5.1f} plays={n} "
            f"drivers={c['primary_pressure_drivers']}"
        )
        if weak:
            print(f"    BAD weak plays: {weak}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1

    # Structural extras
    assert paths["a_integration"].exists()
    assert (paths["city_cards_dir"] / "miami.md").exists() or any(
        paths["city_cards_dir"].glob("*.md")
    )
    assert (ROOT / "data" / "playbook" / "preview.html").exists()

    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
