"""Printable city one-pager (PDF 1.4, Helvetica, no extra deps)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .scoring import Scorecard

PAGE_W = 612.0  # US Letter
PAGE_H = 792.0
MARGIN_L = 48.0
MARGIN_R = 48.0
MARGIN_T = 44.0
MARGIN_B = 40.0
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

NAVY = (18, 32, 52)
INK = (22, 26, 32)
MUTED = (92, 98, 110)
WHITE = (255, 255, 255)
RULE = (214, 218, 224)
ELEVATED = (154, 48, 42)
OK = (36, 108, 72)

# Helvetica AFM widths, 1/1000 em, ASCII 32–126.
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
        "\u2014": "\x97",
        "\u2013": "\x96",
        "\u2018": "\x91",
        "\u2019": "\x92",
        "\u201c": "\x93",
        "\u201d": "\x94",
        "\u2026": "\x85",
        "\u2022": "\x95",
        "\u00a0": " ",
        "\u00d7": "x",
        "\u2212": "\x96",
        "\u2082": "2",
        "\u0394": "d",
        "\u2206": "d",
        "\u00b7": "\xb7",
        "\u2248": "~",
        "\u2192": "-",
        "\u00b0": "\xb0",
    }
)


def _fmt_big(n: float) -> str:
    abs_n = abs(n)
    if abs_n >= 1e9:
        return f"{n / 1e9:.2f}B"
    if abs_n >= 1e6:
        return f"{n / 1e6:.2f}M"
    if abs_n >= 1e3:
        return f"{n / 1e3:.1f}k"
    return f"{n:.0f}"


def _fold(s: str) -> str:
    s = s.translate(_UNICODE)
    return s.encode("latin-1", "replace").decode("latin-1")


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
        if 32 <= o <= 126:
            total += _HEL[o - 32]
        else:
            total += 500
    return total * size * scale / 1000.0


def _wrap(s: str, size: float, max_w: float, bold: bool = False) -> list[str]:
    s = " ".join(s.split())
    if not s:
        return [""]
    words = s.split(" ")
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = word if not cur else f"{cur} {word}"
        if _width(trial, size, bold) <= max_w:
            cur = trial
            continue
        if cur:
            lines.append(cur)
        if _width(word, size, bold) <= max_w:
            cur = word
            continue
        chunk = ""
        for ch in word:
            t = chunk + ch
            if chunk and _width(t, size, bold) > max_w:
                lines.append(chunk)
                chunk = ch
            else:
                chunk = t
        cur = chunk
    if cur:
        lines.append(cur)
    return lines or [""]


class _Canvas:
    def __init__(self) -> None:
        self.pages: list[list[str]] = []
        self.ops: list[str] = []
        self.y = PAGE_H - MARGIN_T
        self._city = ""
        self._continued = False

    def close_page(self) -> None:
        self.ops.append(
            f"BT /F3 7 Tf {_rgb(MUTED)} rg {MARGIN_L:.2f} 26.00 Td "
            f"({_esc('Sample-data methodology demo  -  not a ground-truth city ranking.')}) Tj ET"
        )
        self.pages.append(self.ops)
        self.ops = []
        self.y = PAGE_H - MARGIN_T
        self._continued = True

    def new_page(self) -> None:
        self.close_page()
        if self._city:
            self.ops.append(
                f"{_rgb(NAVY)} rg {MARGIN_L:.2f} {PAGE_H - 28:.2f} {CONTENT_W:.2f} 2.00 re f"
            )
            self.text(
                f"{self._city}  -  continued",
                MARGIN_L,
                PAGE_H - 24,
                size=8,
                italic=True,
                rgb=MUTED,
            )
            self.y = PAGE_H - 40

    def need(self, h: float) -> None:
        if self.y - h < MARGIN_B:
            self.new_page()

    def fill_rect(
        self, x: float, y: float, w: float, h: float, rgb: tuple[int, int, int]
    ) -> None:
        self.ops.append(
            f"{_rgb(rgb)} rg {x:.2f} {y:.2f} {w:.2f} {h:.2f} re f"
        )

    def rule(self) -> None:
        self.need(10)
        self.fill_rect(MARGIN_L, self.y - 2, CONTENT_W, 0.6, RULE)
        self.y -= 10

    def text(
        self,
        s: str,
        x: float,
        y: float,
        size: float = 9,
        *,
        bold: bool = False,
        italic: bool = False,
        rgb: tuple[int, int, int] = INK,
    ) -> None:
        font = "F2" if bold else ("F3" if italic else "F1")
        self.ops.append(
            f"BT /{font} {size:.2f} Tf {_rgb(rgb)} rg {x:.2f} {y:.2f} Td ({_esc(s)}) Tj ET"
        )

    def flow(
        self,
        s: str,
        size: float = 9,
        *,
        bold: bool = False,
        italic: bool = False,
        rgb: tuple[int, int, int] = INK,
        indent: float = 0.0,
        leading: float | None = None,
    ) -> None:
        leading = size + 3.5 if leading is None else leading
        max_w = CONTENT_W - indent
        for line in _wrap(s, size, max_w, bold):
            self.need(leading)
            self.text(
                line,
                MARGIN_L + indent,
                self.y - size,
                size,
                bold=bold,
                italic=italic,
                rgb=rgb,
            )
            self.y -= leading

    def heading(self, title: str) -> None:
        self.need(22)
        self.y -= 6
        self.text(title.upper(), MARGIN_L, self.y - 11, 11, bold=True, rgb=NAVY)
        self.y -= 14
        self.fill_rect(MARGIN_L, self.y, CONTENT_W, 0.8, NAVY)
        self.y -= 12

    def kv_line(self, label: str, value: str, indent: float = 12.0) -> None:
        self.need(13)
        y = self.y - 9
        self.text(f"{label}:", MARGIN_L + indent, y, 9, bold=True, rgb=INK)
        label_w = _width(f"{label}: ", 9, bold=True)
        rest_x = MARGIN_L + indent + label_w
        max_w = PAGE_W - MARGIN_R - rest_x
        lines = _wrap(value, 9, max_w)
        self.text(lines[0], rest_x, y, 9, rgb=INK)
        self.y -= 13
        for extra in lines[1:]:
            self.need(12)
            self.text(extra, rest_x, self.y - 9, 9, rgb=INK)
            self.y -= 12


def _assemble(pages: list[list[str]]) -> bytes:
    objects: list[bytes] = []

    def add(body: str | bytes) -> int:
        if isinstance(body, str):
            body = body.encode("latin-1")
        objects.append(body)
        return len(objects)

    add("<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{i} 0 R" for i in range(3, 3 + len(pages)))
    add(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>")
    # Page objects 3 .. 2+n, content streams 3+n .. 2+2n, fonts after that.
    font_f1 = 3 + 2 * len(pages)
    font_f2 = font_f1 + 1
    font_f3 = font_f1 + 2
    resources = (
        f"<< /Font << /F1 {font_f1} 0 R /F2 {font_f2} 0 R /F3 {font_f3} 0 R >> >>"
    )

    streams = ["\n".join(ops).encode("latin-1") for ops in pages]
    for i, _stream in enumerate(streams):
        content_id = 3 + len(pages) + i
        add(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W:.0f} {PAGE_H:.0f}] "
            f"/Contents {content_id} 0 R /Resources {resources} >>"
        )
    for stream in streams:
        add(f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1") + stream + b"\nendstream")

    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    add(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
    )
    add(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"
    )

    # Object numbers were assigned sequentially; page dicts must point at the
    # content streams that follow them. Rebuild the Pages kids with actual ids.
    # Catalog is 1, Pages is 2, then page dicts, then streams, then fonts.
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{i} 0 obj\n".encode("ascii"))
        out.extend(body)
        if not body.endswith(b"\n"):
            out.extend(b"\n")
        out.extend(b"endobj\n")
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    out.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n".encode("ascii")
    )
    return bytes(out)


def render_city_card_pdf(
    c: Scorecard,
    ops_scale: dict | None = None,
    *,
    engine_version: str,
    contract_version: str,
) -> bytes:
    cv = _Canvas()
    cv._city = c.host_city

    # Header bar
    header_h = 64.0
    cv.fill_rect(0, PAGE_H - header_h, PAGE_W, header_h, NAVY)
    cv.text(c.host_city, MARGIN_L, PAGE_H - 28, 20, bold=True, rgb=WHITE)
    cv.text(
        "FIFA 2026 EFW readiness playbook",
        MARGIN_L,
        PAGE_H - 46,
        9,
        rgb=(196, 204, 216),
    )
    rank = f"#{c.rank} of 11" if c.rank else "unranked"
    cv.text(rank, PAGE_W - MARGIN_R - _width(rank, 12, bold=True), PAGE_H - 30, 12, bold=True, rgb=WHITE)
    cv.y = PAGE_H - header_h - 18

    ready = (
        f"Readiness  {c.readiness_score:.1f} / 100"
        f"   (band {c.readiness_band[0]:.0f}-{c.readiness_band[1]:.0f})"
    )
    cv.flow(ready, 11, bold=True)
    cv.flow(f"Stress index  {c.stress_index:.3f}", 10, rgb=MUTED)
    peers = ", ".join(c.peer_cities or []) or "-"
    cv.flow(f"Peers  {peers}", 10)
    cv.y -= 4

    if ops_scale:
        abs_ = ops_scale.get("absolute") or {}
        mix = ops_scale.get("visit_mix") or {}
        cv.heading("Ops scale")
        cv.flow("City totals - not used in readiness. Intensity per shop-month drives rank; these numbers size the load.", 8, italic=True, rgb=MUTED, leading=11)
        bits = [
            f"Energy  {_fmt_big(abs_.get('energy_kwh', 0))} kWh (summer)",
            f"Water  {_fmt_big(abs_.get('water_liters', 0))} L",
            f"CO2e  {_fmt_big(abs_.get('kg_co2e', 0))} kg",
        ]
        cv.flow("    ".join(bits), 9)
        if mix:
            mix_s = ", ".join(f"{k} {v:.0%}" for k, v in list(mix.items())[:4])
            cv.flow(f"Visit mix  {mix_s}", 9)

    cv.heading("Pressure drivers  (z vs other hosts)")
    col_z = MARGIN_L + 220
    col_st = MARGIN_L + 300
    cv.need(14)
    cv.text("Driver", MARGIN_L, cv.y - 9, 8, bold=True, rgb=MUTED)
    cv.text("z", col_z, cv.y - 9, 8, bold=True, rgb=MUTED)
    cv.text("Status", col_st, cv.y - 9, 8, bold=True, rgb=MUTED)
    cv.y -= 14
    for d in c.drivers():
        cv.need(13)
        y = cv.y - 9
        status = "elevated" if d["elevated"] else "at/below average"
        colour = ELEVATED if d["elevated"] else OK
        cv.text(d["label"], MARGIN_L, y, 10, bold=True)
        cv.text(f"{d['z']:+.2f}", col_z, y, 10)
        cv.text(status, col_st, y, 10, rgb=colour)
        cv.y -= 13

    cv.heading("Steal these plays")
    if not c.recommended_plays:
        cv.flow("No pressing plays (all drivers at/below host average).", 9, italic=True, rgb=MUTED)
    for p in c.recommended_plays or []:
        cv.need(56)
        cv.y -= 2
        cv.flow(p["title"], 11, bold=True)
        steal = ", ".join(p.get("steal_from_peers") or []) or "-"
        eff = p["expected_effects"]
        cv.kv_line("Owner", str(p["owner"]))
        cv.kv_line("Effort", str(p["effort"]))
        cv.kv_line("Legacy use", str(p["legacy_use"]))
        cv.kv_line("Steal from peers", steal)
        cv.kv_line(
            "Expected effects",
            f"energy {eff['energy_pct']}%   food CO2e {eff['food_co2e_pct']}%   water {eff['water_pct']}%",
        )
        delta = p.get("illustrative_absolute_delta") or {}
        if delta:
            cv.kv_line(
                "Illustrative citywide change",
                f"energy {_fmt_big(delta.get('energy_kwh', 0))} kWh   "
                f"water {_fmt_big(delta.get('water_liters', 0))} L   "
                f"CO2e {_fmt_big(delta.get('kg_co2e', 0))} kg",
            )
        cv.kv_line("Why", str(p["rationale"]))
        cv.y -= 6

    if c.general_options:
        cv.heading("General options  (not pressing)")
        for p in c.general_options:
            cv.flow(
                f"{p['title']}  ({p['effort']} effort) - {p['legacy_use']}",
                9,
                indent=8,
            )

    cv.y -= 8
    cv.rule()
    cv.flow(
        f"Generated by Plan D engine v{engine_version}; A-contract {contract_version}",
        8,
        italic=True,
        rgb=MUTED,
    )

    cv.close_page()
    return _assemble(cv.pages)
