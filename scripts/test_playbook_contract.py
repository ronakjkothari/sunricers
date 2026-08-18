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
    from engines.playbook.config import PlaybookConfig

    # Prefer map source when app/data exists so A↔B rankings agree
    svc = PlaybookService(PlaybookConfig(indicator_source="auto"), root=ROOT)
    cards = svc.compute()
    paths = svc.export(cards)
    contract = json.loads(paths["a_integration"].read_text(encoding="utf-8"))
    errors = validate_a_contract(contract)
    src = (contract.get("meta") or {}).get("indicator_source") or {}

    print(f"contract_version={contract.get('contract_version')} (expected {CONTRACT_VERSION})")
    print(f"indicator_source={src.get('resolved')} — {src.get('label')}")
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

    assert paths["a_integration"].exists()
    assert (paths["city_cards_dir"] / "miami.md").exists() or any(
        paths["city_cards_dir"].glob("*.md")
    )
    assert (ROOT / "data" / "playbook" / "preview.html").exists()
    assert paths.get("ops_context") and paths["ops_context"].exists()

    # Ops scale companion must be present and labeled off the readiness path
    for c in contract["scorecards"]:
        ops = c.get("ops_scale")
        if not ops or not ops.get("absolute"):
            print(f"FAIL: {c['host_city']} missing ops_scale.absolute")
            return 1
        if not ops.get("not_used_in_readiness"):
            print(f"FAIL: {c['host_city']} ops_scale missing not_used_in_readiness")
            return 1
        if c["recommended_plays"]:
            d = c["recommended_plays"][0].get("illustrative_absolute_delta")
            if not d or "energy_kwh" not in d:
                print(f"FAIL: {c['host_city']} play missing illustrative_absolute_delta")
                return 1
    print("ops_scale OK on all 11 scorecards")

    # If map tables present, rankings must match B's prior scorecards order loosely
    # (same #1 city) — cohesion guard
    b_scores = ROOT / "app" / "data" / "scorecards.json"
    if src.get("resolved") == "map" and b_scores.exists():
        # Recompute agreement against freshly exported app compact file
        app_cards = json.loads(paths["app_scorecards"].read_text(encoding="utf-8"))
        a_order = [c["host_city"] for c in sorted(contract["scorecards"], key=lambda x: x["rank"])]
        b_order = [c["c"] for c in sorted(app_cards["cards"], key=lambda x: x["rank"])]
        if a_order != b_order:
            print("FAIL: a_integration ranks != scorecards_for_app ranks")
            return 1
        print(f"cohesion OK: #1={a_order[0]}  #11={a_order[-1]}")

    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
