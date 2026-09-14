"""Printable city one-pager (PDF 1.4, Helvetica, no extra deps).

One US Letter page per host city, written for a person to read in two minutes:
where the city ranks (bar chart of all 11 hosts), what stands out, the top three
levers from the intervention lab (app/data/levers.json, ranked the same way as
app/js/lib/levers.js rankLevers) and what those three would cut together
(second bar chart). The levers come from the lab, not from plays.py, so the
PDF matches what the Overview and Compare tabs show.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .scoring import Scorecard

PAGE_W = 612.0  # US Letter
PAGE_H = 792.0
MARGIN_L = 50.0
MARGIN_R = 50.0
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

NAVY = (18, 32, 52)
INK = (22, 26, 32)
MUTED = (92, 98, 110)
WHITE = (255, 255, 255)
RULE = (214, 218, 224)
BAR_OTHER = (200, 205, 214)
BAR_RES = {"kwh": (201, 132, 30), "water": (40, 110, 180), "co2": (70, 120, 80)}

REPO = Path(__file__).resolve().parents[2]
LEVERS_PATH = REPO / "app" / "data" / "levers.json"
MATCHES_PATH = REPO / "app" / "data" / "matches.json"

RES = (("kwh", "energy"), ("water", "water"), ("co2", "carbon"))
KEY = {"kwh": "energy_kwh", "water": "water_liters", "co2": "kg_co2e"}
RES_Z = {"kwh": "energy_kwh", "water": "water_liters", "co2": "kg_co2e"}
DRIVER_PLAIN = {
    "energy_kwh": "energy use",
    "kg_co2e": "food carbon",
    "water_liters": "water use",
    "cdd": "summer cooling need",
    "uhi": "urban heat",
}

# Helvetica AFM widths, 1/1000 em, ASCII 32-126.
_HEL = (
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
)

_UNICODE = str.maketrans(
    {
        "‘": "'",
        "’": "'",
        "“": '"',
        "”": '"',
        "…": "...",
        "•": "-",
        " ": " ",
        "×": "x",
        "−": "-",
        "₂": "2",
        "≈": "about ",
        "→": "to",
        "°": "\xb0",
    }
)


def _plain(s: str) -> str:
    """No dashes or middots in reader-facing text: ranges read 'to', breaks read as commas."""
    s = re.sub(r"(\d)\s*[–—]\s*(\$?\d)", r"\1 to \2", s)
    s = re.sub(r"\s*[–—]\s*", ", ", s)
    s = s.replace(" · ", ", ").replace("·", ",")
    return s.translate(_UNICODE)


def _fold(s: str) -> str:
    return _plain(s).encode("latin-1", "replace").decode("latin-1")


def _esc(s: str) -> str:
    s = _fold(s)
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _rgb(rgb: tuple[int, int, int]) -> str:
    return f"{rgb[0] / 255:.3f} {rgb[1] / 255:.3f} {rgb[2] / 255:.3f}"


def _width(s: str, size: float, bold: bool = False) -> float:
    s = _fold(s)
    scale = 1.04 if bold else 1.0
    total = 0.0
    for ch in s:
        o = ord(ch)
        total += _HEL[o - 32] if 32 <= o <= 126 else 500
    return total * size * scale / 1000.0


def _wrap(s: str, size: float, max_w: float, bold: bool = False) -> list[str]:
    words = " ".join(_fold(s).split()).split(" ")
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = word if not cur else f"{cur} {word}"
        if not cur or _width(trial, size, bold) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines or [""]


class _Canvas:
    def __init__(self) -> None:
        self.ops: list[str] = []
        self.y = PAGE_H

    def fill_rect(self, x: float, y: float, w: float, h: float, rgb: tuple[int, int, int]) -> None:
        self.ops.append(f"{_rgb(rgb)} rg {x:.2f} {y:.2f} {w:.2f} {h:.2f} re f")

    def text(self, s: str, x: float, y: float, size: float = 9, *, bold: bool = False,
             italic: bool = False, rgb: tuple[int, int, int] = INK) -> None:
        font = "F2" if bold else ("F3" if italic else "F1")
        self.ops.append(f"BT /{font} {size:.2f} Tf {_rgb(rgb)} rg {x:.2f} {y:.2f} Td ({_esc(s)}) Tj ET")

    def text_right(self, s: str, x_right: float, y: float, size: float = 9, **kw) -> None:
        self.text(s, x_right - _width(s, size, kw.get("bold", False)), y, size, **kw)

    def flow(self, s: str, size: float = 9.5, *, bold: bool = False, italic: bool = False,
             rgb: tuple[int, int, int] = INK, indent: float = 0.0, leading: float | None = None) -> None:
        leading = size * 1.38 if leading is None else leading
        for line in _wrap(s, size, CONTENT_W - indent, bold):
            self.text(line, MARGIN_L + indent, self.y - size, size, bold=bold, italic=italic, rgb=rgb)
            self.y -= leading

    def heading(self, title: str) -> None:
        self.y -= 8
        self.text(title, MARGIN_L, self.y - 12, 12, bold=True, rgb=NAVY)
        self.y -= 17
        self.fill_rect(MARGIN_L, self.y, CONTENT_W, 0.8, NAVY)
        self.y -= 8

    def hbars(self, rows: list[tuple[str, float, str, tuple[int, int, int], bool]], *,
              vmax: float, label_w: float, bar_h: float = 10.0, gap: float = 3.5) -> None:
        """Plain horizontal bar chart: label, bar, value at the end of the bar."""
        x0 = MARGIN_L + label_w
        span = CONTENT_W - label_w - 90
        for label, v, vtxt, colour, strong in rows:
            y = self.y - bar_h
            self.text_right(label, x0 - 8, y + 2, 8.5, bold=strong, rgb=INK if strong else MUTED)
            w = max(0.0, span * v / vmax) if vmax else 0.0
            self.fill_rect(x0, y, max(w, 1.0), bar_h, colour)
            self.text(vtxt, x0 + w + 5, y + 2, 8.5, bold=strong, rgb=INK if strong else MUTED)
            self.y -= bar_h + gap
        self.fill_rect(x0 - 0.5, self.y + gap, 0.6, len(rows) * (bar_h + gap) - gap, MUTED)


def _assemble(pages: list[list[str]]) -> bytes:
    objects: list[bytes] = []

    def add(body: str | bytes) -> None:
        objects.append(body.encode("latin-1") if isinstance(body, str) else body)

    n = len(pages)
    add("<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{i} 0 R" for i in range(3, 3 + n))
    add(f"<< /Type /Pages /Kids [{kids}] /Count {n} >>")
    # Catalog 1, Pages 2, page dicts 3..2+n, content streams 3+n..2+2n, then fonts.
    font_f1 = 3 + 2 * n
    resources = f"<< /Font << /F1 {font_f1} 0 R /F2 {font_f1 + 1} 0 R /F3 {font_f1 + 2} 0 R >> >>"
    streams = ["\n".join(ops).encode("latin-1") for ops in pages]
    for i in range(n):
        add(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W:.0f} {PAGE_H:.0f}] "
            f"/Contents {3 + n + i} 0 R /Resources {resources} >>")
    for stream in streams:
        add(f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1") + stream + b"\nendstream")
    for base in ("Helvetica", "Helvetica-Bold", "Helvetica-Oblique"):
        add(f"<< /Type /Font /Subtype /Type1 /BaseFont /{base} /Encoding /WinAnsiEncoding >>")

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{i} 0 obj\n".encode("ascii") + body)
        if not body.endswith(b"\n"):
            out.extend(b"\n")
        out.extend(b"endobj\n")
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for off in offsets:
        out.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    out.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
               f"startxref\n{xref_pos}\n%%EOF\n".encode("ascii"))
    return bytes(out)


# ------------------------------------------------------------ lever arithmetic
# Same maths as app/js/lib/levers.js (segmentPiles, combinedCuts, rankLevers).


def _load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _segment_piles(lev: dict, city: str, ops: dict) -> tuple[dict, dict]:
    a = ops.get("absolute") or {}
    mix = ops.get("visit_mix") or {}
    fs = (lev.get("food_split") or {}).get(city) or {"restaurant": 0.73, "grocery": 0.27}
    visits = {}
    for s, d in lev["segments"].items():
        lv = (a.get("visits") or 0) * (mix.get(d["layer"]) or 0)
        visits[s] = lv * (fs.get(s) or 0) if d["layer"] == "Food" else lv
    seg = {s: {"kwh": 0.0, "water": 0.0, "co2": 0.0} for s in visits}
    tot = {}
    for r in KEY:
        raw = sum(visits[s] * lev["segments"][s]["factor"][r] for s in visits)
        scale = (a.get(KEY[r]) or 0) / raw if raw else 0
        for s in visits:
            seg[s][r] = visits[s] * lev["segments"][s]["factor"][r] * scale
        tot[r] = a.get(KEY[r]) or 0
    return seg, tot


def _rank_levers(lev: dict, c: "Scorecard", ops: dict, seats: float) -> tuple[list[dict], str | None]:
    seg, tot = _segment_piles(lev, c.host_city, ops)
    z = {r: c.z_components.get(RES_Z[r], 0.0) for r in KEY}
    top = max(KEY, key=lambda r: z[r])
    worst = top if z[top] >= 0.25 else None
    rows = []
    for l in lev["levers"]:
        cut = {}
        for r in KEY:
            if l.get("offmap"):
                pf = l["offmap"]["per_fan"].get(r)
                cut[r] = pf[1] * seats / tot[r] if pf and tot[r] else 0.0
            else:
                s = sum(seg[sg][r] * cuts[r][1] for sg, cuts in l["cuts"].items() if r in cuts and sg in seg)
                cut[r] = s / tot[r] if tot[r] and s > 1e-6 else 0.0
        rows.append({"l": l, "cut": cut, "best": max(cut.values())})
    rows.sort(key=lambda x: ((-x["cut"][worst]) if worst else 0, -x["best"]))
    pressing = [x for x in rows if (x["cut"][worst] if worst else x["best"]) > 1e-6]
    return pressing, worst


def _combined(lev: dict, ids: list[str], c: "Scorecard", ops: dict, seats: float) -> dict:
    """[low, mid, high] fraction of each city total cut when all `ids` are on."""
    seg, tot = _segment_piles(lev, c.host_city, ops)
    on = [l for l in lev["levers"] if l["id"] in ids]
    keep: dict = {}
    for l in on:
        if l.get("offmap"):
            continue
        for sg, cuts in l["cuts"].items():
            for r, v in cuts.items():
                if any(r in rs and oid in ids for oid, rs in (l.get("overlap") or {}).items()):
                    continue
                k = keep.setdefault(sg, {}).setdefault(r, [1.0, 1.0, 1.0])
                for i in range(3):
                    k[i] *= 1 - v[i]
    out = {}
    for r in KEY:
        if not tot[r]:
            out[r] = [0.0, 0.0, 0.0]
            continue
        vals = []
        for i in range(3):
            s = sum(seg[sg][r] * (1 - keep.get(sg, {}).get(r, [1, 1, 1])[i]) for sg in seg)
            for l in on:
                pf = (l.get("offmap") or {}).get("per_fan", {}).get(r)
                if pf:
                    s += pf[i] * seats
            vals.append(s / tot[r])
        out[r] = vals
    return out


def _pct(f: float) -> str:
    p = f * 100
    if p < 0.05:
        return "under 0.1%"
    return f"{p:.1f}%"


def _and(items: list[str]) -> str:
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def _z_word(z: float) -> str:
    if abs(z) < 0.25:
        return "about average"
    if z > 0.75:
        return "well above average"
    if z > 0:
        return "above average"
    return "well below average" if z < -0.75 else "below average"


def _ordinal(n: int) -> str:
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


# ------------------------------------------------------------------- the page


def render_city_card_pdf(
    c: Scorecard,
    ops_scale: dict | None = None,
    *,
    all_cards: list[Scorecard] | None = None,
    engine_version: str,
    contract_version: str,
) -> bytes:
    city = c.host_city
    n_hosts = len(all_cards) if all_cards else 11
    cv = _Canvas()

    # Header
    header_h = 66.0
    cv.fill_rect(0, PAGE_H - header_h, PAGE_W, header_h, NAVY)
    cv.text(city, MARGIN_L, PAGE_H - 32, 22, bold=True, rgb=WHITE)
    cv.text("2026 World Cup host city: energy, water and food carbon", MARGIN_L, PAGE_H - 50, 9.5,
            rgb=(196, 204, 216))
    rank = f"Rank {c.rank} of {n_hosts}" if c.rank else "Not ranked"
    cv.text_right(rank, PAGE_W - MARGIN_R, PAGE_H - 36, 13, bold=True, rgb=WHITE)
    cv.y = PAGE_H - header_h - 6

    # 1. How the city compares
    cv.heading(f"How {city} compares")
    place = f"ranks {_ordinal(c.rank)} of the {n_hosts} host cities" if c.rank else "is not ranked"
    cv.flow(
        f"{city} scores {c.readiness_score:.0f} out of 100 and {place}. The score compares how much "
        f"energy, water and food carbon a typical shop uses here in summer, plus how hot the city gets, "
        f"against the other host cities. The best of the {n_hosts} gets 100 and the worst gets 0, so the "
        f"score shows where a city stands, not whether it passes a fixed target."
    )
    if all_cards:
        cv.y -= 6
        cv.text("Readiness score, all host cities (higher is better)", MARGIN_L, cv.y - 9, 9, bold=True)
        cv.y -= 16
        ordered = sorted(all_cards, key=lambda k: -k.readiness_score)
        cv.hbars(
            [(k.host_city, k.readiness_score, f"{k.readiness_score:.0f}",
              NAVY if k.host_city == city else BAR_OTHER, k.host_city == city) for k in ordered],
            vmax=100, label_w=140, bar_h=9.5, gap=3,
        )

    # 2. What stands out
    cv.heading("What stands out")
    groups: dict[str, list[str]] = {}
    for key in ("energy_kwh", "water_liters", "kg_co2e", "cdd", "uhi"):
        groups.setdefault(_z_word(c.z_components.get(key, 0.0)), []).append(DRIVER_PLAIN[key])
    order = ["well above average", "above average", "about average", "below average", "well below average"]
    parts = [f"{w} on {_and(groups[w])}" for w in order if w in groups]
    cv.flow(f"Compared with the other host cities, {city} is {_and(parts)}.")

    # 3. What to do
    lev = _load_json(LEVERS_PATH)
    matches = _load_json(MATCHES_PATH) or []
    ops = ops_scale or {}
    if lev and ops.get("absolute"):
        fixtures = [m for m in matches if m.get("m") == city]
        seats = float(sum(m.get("a") or m.get("cap") or 0 for m in fixtures))
        pressing, worst = _rank_levers(lev, c, ops, seats)
        picks = pressing[:3]
        cv.heading(f"Top {len(picks)} steps for {city}" if picks else f"Steps for {city}")
        if not picks:
            cv.flow("None of the studied steps changes this city's summer totals.")
        else:
            worst_word = dict(RES)[worst] if worst else None
            why = (f"They are ranked by how much they cut {worst_word}, where {city} is furthest above "
                   f"the other hosts." if worst_word else
                   f"No single resource stands out for {city}, so they are ranked by their biggest cut.")
            cv.flow(f"These come from the intervention lab. {why} Each percent is the share of the "
                    f"city's whole summer total that the step saves.")
            cv.y -= 2
            for i, x in enumerate(picks, start=1):
                l = x["l"]
                cuts = [f"{_pct(x['cut'][r])} of {w}" for r, w in RES if x["cut"][r] > 1e-6]
                cv.y -= 5
                cv.flow(f"{i}. {l['title']}", 10.5, bold=True)
                cv.flow(l["plain"], indent=13)
                who = f"Who does it: {l['owner']}."
                cost = (l.get("cost_tier") or {}).get("t")
                if cost:
                    cost = cost[0].upper() + cost[1:]
                    who += f" Cost: {cost}."
                cv.flow(who, 9, rgb=MUTED, indent=13)
                cv.flow(f"Saves about {_and(cuts)}.", 9, bold=True, indent=13)

            both = _combined(lev, [x["l"]["id"] for x in picks], c, ops, seats)
            cv.y -= 8
            cv.text(f"If {city} does all {len(picks)}: cut to the city's summer total", MARGIN_L, cv.y - 9, 9,
                    bold=True)
            cv.y -= 16
            vmax = max(v[1] for v in both.values()) or 1
            cv.hbars(
                [(w.capitalize(), both[r][1],
                  f"{_pct(both[r][1])}  (likely {_pct(both[r][0])} to {_pct(both[r][2])})"
                  if both[r][2] >= 0.0005 else "no real change",
                  BAR_RES[r], True) for r, w in RES],
                vmax=vmax * 1.05, label_w=60, bar_h=13, gap=5,
            )
            cv.y -= 2
            cv.flow("The bar is the middle estimate. The range in brackets covers 8 in 10 simulated outcomes.",
                    8.5, italic=True, rgb=MUTED)

    if cv.y < 70:
        raise ValueError(f"{city} one-pager runs into the footer (y={cv.y:.0f})")


    return _assemble([cv.ops])
