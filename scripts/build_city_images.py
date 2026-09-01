"""Derive web-sized city photos from the originals in app/assets/images.

The originals are 3-8 MB each at up to 6000 px wide — 36 MB for the set, which
is far more than the whole rest of the app. This writes three derivatives per
city into app/assets/img, plus the rail logo and favicon from assets/icon.png:

    <slug>-1200.webp   masthead photo, 1200x800, object-fit: cover in the page
    <slug>-320.webp    city rail thumbnail
    lqip.json          24x16 blurred base64 JPEGs, inlined as the blur-up
    icon-{192,64,32}.png, ../favicon.ico   from app/assets/icon.png

Run after adding or replacing anything in app/assets/images:

    python scripts/build_city_images.py
"""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app" / "assets" / "images"
OUT = ROOT / "app" / "assets" / "img"

# host_city (Plan D label) -> source file stem
CITY_SLUG = {
    "Atlanta": "atlanta",
    "Boston": "boston",
    "Dallas": "dallas",
    "Houston": "houston",
    "Kansas City": "kansas-city",
    "Los Angeles": "los-angeles",
    "Miami": "miami",
    "New York/New Jersey": "new-york",
    "Philadelphia": "philadelphia",
    "San Francisco Bay Area": "san-francisco",
    "Seattle": "seattle",
}

SIZES = [(1200, 800, 78), (320, 214, 72)]
LQIP = (24, 16)

ICON = ROOT / "app" / "assets" / "icon.png"
ICON_SIZES = (192, 64, 32)


def cover(im: Image.Image, w: int, h: int) -> Image.Image:
    """Centre-crop to the target aspect, then resize. Same result as CSS cover."""
    want = w / h
    have = im.width / im.height
    if have > want:  # too wide — trim the sides
        new_w = round(im.height * want)
        box = ((im.width - new_w) // 2, 0, (im.width + new_w) // 2, im.height)
    else:  # too tall — trim top and bottom
        new_h = round(im.width / want)
        box = (0, (im.height - new_h) // 2, im.width, (im.height + new_h) // 2)
    return im.resize((w, h), Image.LANCZOS, box=box)


def build_icon() -> None:
    """Rail logo and favicon, from the one 512px source."""
    if not ICON.exists():
        print(f"  !  no {ICON.name}; skipping the icon")
        return
    with Image.open(ICON) as im:
        im = im.convert("RGBA")
        for size in ICON_SIZES:
            im.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png")
        im.resize((64, 64), Image.LANCZOS).save(
            ROOT / "app" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  ok icon -> {', '.join(f'icon-{s}.png' for s in ICON_SIZES)} + favicon.ico")


def main() -> None:
    if not SRC.is_dir():
        raise SystemExit(f"no source images at {SRC}")
    OUT.mkdir(parents=True, exist_ok=True)

    build_icon()

    lqip: dict[str, str] = {}
    total = 0
    for city, slug in sorted(CITY_SLUG.items()):
        src = SRC / f"{slug}.jpg"
        if not src.exists():
            print(f"  !  {city}: missing {src.name}")
            continue
        with Image.open(src) as im:
            im = im.convert("RGB")
            for w, h, q in SIZES:
                dst = OUT / f"{slug}-{w}.webp"
                cover(im, w, h).save(dst, "WEBP", quality=q, method=6)
                total += dst.stat().st_size

            small = cover(im, *LQIP).filter(ImageFilter.GaussianBlur(1.2))
            buf = io.BytesIO()
            small.save(buf, "JPEG", quality=40)
            lqip[city] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

        print(f"  ok {city:<24} {src.stat().st_size / 1e6:5.1f} MB source")

    (OUT / "lqip.json").write_text(json.dumps(lqip, indent=1), encoding="utf-8")
    src_total = sum(f.stat().st_size for f in SRC.glob("*.jpg"))
    print(
        f"\n{len(lqip)} cities · derivatives {total / 1e6:.2f} MB "
        f"(from {src_total / 1e6:.1f} MB of originals) -> {OUT.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()
