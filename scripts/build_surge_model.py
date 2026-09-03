"""Fit the visitor-surge model the Impact map uses.

The old Scenarios tab multiplied every metric by the surge slider, which assumes
a 1.5x surge lands identically on a hotel, a gas station and a taqueria. It does
not. This measures how each shop type and each distance band actually responds
when citywide demand moves, and writes the coefficients the map applies.

Method — deliberately the simplest thing that answers the question:

    log(segment customers) ~ a + b * log(city total customers)

fitted per host across the 61 monthly observations, then pooled by median. The
slope b is an elasticity: b = 1 means a segment moves proportionally with the
city, b > 1 means it amplifies. Estimates are shrunk toward 1 in proportion to
their R², so a noisy segment defaults to "moves proportionally" rather than to a
number the data cannot support.

    b_shrunk = 1 + (b - 1) * R2

Writes app/data/surge_model.json.

    python scripts/build_surge_model.py
"""

from __future__ import annotations

import json
import math
import statistics as st
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "app" / "data"

# shops this close to the stadium are treated as event-exposed; the +30%
# match-day effect in the method note was measured within 2 km
NEAR_KM = 5.0
MIN_MONTHS = 24


def ols(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """@returns (slope, r2)"""
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    if not sxx:
        return 1.0, 0.0
    b = sxy / sxx
    a = my - b * mx
    sst = sum((y - my) ** 2 for y in ys)
    ssr = sum((y - (a + b * x)) ** 2 for x, y in zip(xs, ys))
    return b, (1 - ssr / sst if sst else 0.0)


def km(x1: float, y1: float, x2: float, y2: float) -> float:
    return math.hypot((x1 - x2) * 111 * math.cos(math.radians(y1)), (y1 - y2) * 111)


def elasticity(total: list[float], seg: list[float]) -> tuple[float, float] | None:
    pts = [(math.log(total[j]), math.log(seg[j]))
           for j in range(len(total)) if total[j] > 0 and seg[j] > 0]
    if len(pts) < MIN_MONTHS:
        return None
    return ols([p[0] for p in pts], [p[1] for p in pts])


def shrink(b: float, r2: float) -> float:
    """Pull a noisy elasticity back toward proportional."""
    return round(1 + (b - 1) * max(0.0, min(1.0, r2)), 3)


def main() -> None:
    index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))["cities"]
    stadiums = json.loads((DATA / "stadiums.json").read_text(encoding="utf-8"))

    by_layer: dict[str, list[tuple[float, float]]] = {}
    near: list[tuple[float, float]] = []
    near_shops = 0
    hosts_with_near = 0

    for city, meta in index.items():
        shops = json.loads((DATA / "places" / f"{meta['slug']}.json").read_text(encoding="utf-8"))
        sm = json.loads((DATA / "sm" / f"{city.replace('/', '_')}.json").read_text(encoding="utf-8"))
        at = {k: i for i, k in enumerate(sm["keys"])}
        n_m = len(sm["v"][0])

        stadium = next((v for v in stadiums.values() if v["m"] == city), None)

        total = [0.0] * n_m
        layers: dict[str, list[float]] = {}
        near_seg = [0.0] * n_m
        n_near = 0

        for s in shops:
            row = sm["v"][at[s["k"]]]
            arr = layers.setdefault(s["l"], [0.0] * n_m)
            is_near = stadium and km(s["x"], s["y"], stadium["x"], stadium["y"]) <= NEAR_KM
            if is_near:
                n_near += 1
            for j, v in enumerate(row):
                if not v:
                    continue
                total[j] += v
                arr[j] += v
                if is_near:
                    near_seg[j] += v

        for layer, arr in layers.items():
            hit = elasticity(total, arr)
            if hit:
                by_layer.setdefault(layer, []).append(hit)

        if n_near:
            hit = elasticity(total, near_seg)
            if hit:
                near.append(hit)
                near_shops += n_near
                hosts_with_near += 1

    layer_out = {}
    for layer, hits in sorted(by_layer.items()):
        b = st.median([h[0] for h in hits])
        r2 = st.median([h[1] for h in hits])
        layer_out[layer] = {
            "elasticity": shrink(b, r2),
            "raw": round(b, 3),
            "r2": round(r2, 3),
            "hosts": len(hits),
        }

    nb = st.median([h[0] for h in near]) if near else 1.0
    nr2 = st.median([h[1] for h in near]) if near else 0.0
    near_out = {
        # the extra elasticity a shop gets for being event-exposed, over and
        # above its shop type
        "within_km": NEAR_KM,
        "extra": round(shrink(nb, nr2) - 1, 3),
        "raw": round(nb, 3),
        "r2": round(nr2, 3),
        "hosts": hosts_with_near,
        "shops": near_shops,
    }

    model = {
        "role": "visitor_surge_response",
        "method": (
            "log(segment customers) ~ log(city total customers), OLS per host over "
            f"{MIN_MONTHS}+ monthly observations, pooled by median across hosts, then "
            "shrunk toward 1 in proportion to R^2"
        ),
        "reading": (
            "elasticity 1.0 means the segment moves proportionally with citywide demand; "
            "above 1 it amplifies. A surge of S multiplies a shop by S^elasticity."
        ),
        "caveat": (
            "Fitted on observed monthly variation, not on a mega-event. It says how a "
            "segment has responded when the city got busier, which is the closest "
            "evidence available for how it would respond to a tournament."
        ),
        "layers": layer_out,
        "near_stadium": near_out,
    }
    (DATA / "surge_model.json").write_text(json.dumps(model, indent=1), encoding="utf-8")

    print("visitor-surge elasticities (shrunk toward 1 by R^2)\n")
    for layer, v in sorted(layer_out.items(), key=lambda kv: -kv[1]["elasticity"]):
        print(f"  {layer:<10} {v['elasticity']:5.2f}   raw {v['raw']:5.2f}  "
              f"R2 {v['r2']:.2f}  ({v['hosts']} hosts)")
    print(f"\n  within {NEAR_KM:g} km of a stadium: +{near_out['extra']:.2f} on top "
          f"(raw {near_out['raw']:.2f}, R2 {near_out['r2']:.2f}, "
          f"{near_out['shops']:,} shops across {near_out['hosts']} hosts)")
    print("\n-> app/data/surge_model.json")


if __name__ == "__main__":
    main()
