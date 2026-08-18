"""
Step 1 of the matchday forecast: the "normal day" baseline.

Reads app/data/daily.json (city x type x day card customers and spend,
2019-12-01 to 2024-12-31, from spend-patterns-rice) and writes
app/data/baseline.json: for every host city, every EFW type and every day of
the 2026 tournament window (with a week of padding either side, so arrival
and departure days around the first and last matches are covered), the
expected customers and spend on a day with no match, plus a low/high band.

Method, in plain words
- SPEND_BY_DAY records money on the day the card payment *settled*, so the raw
  days carry a fake weekly rhythm (Monday about 2.5x a weekday, weekends tiny,
  holidays pushed onto the next working day). A 7-day centred rolling mean,
  applied twice, removes that rhythm. Everything below works on the smoothed
  series.
- For a target date like 2026-06-15 we look at the smoothed value on
  06-15 in 2022, 2023 and 2024 and blend them 0.2 / 0.3 / 0.5. 2020 and 2021
  are left out because of Covid.
- No trend is projected. Per-city totals swing 20-30% between years, and that
  is mostly shops joining and leaving the panel plus the organisers' injected
  noise, so a fitted trend would be fitting noise.
- The band is the min and max across the three years, widened to at least
  +/-11% around the blend, which is the noise floor the organisers put on
  every magnitude column.

Runs locally in a few seconds; no Colab needed.
"""
import json, os, sys
from collections import defaultdict
from datetime import date, timedelta

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
APP  = os.path.join(HERE, "..", "app", "data")
SRC  = os.path.join(APP, "daily.json")
OUT  = os.path.join(APP, "baseline.json")

YEARS   = {2022: 0.2, 2023: 0.3, 2024: 0.5}   # blend weights, sum to 1
NOISE   = 0.11                                # organisers' noise floor
PAD     = 7                                   # days either side of the tournament
START   = date(2026, 6, 11) - timedelta(days=PAD)
END     = date(2026, 7, 19) + timedelta(days=PAD)
WINDOW  = 7                                   # rolling-mean width in days

def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC} — copy the web folder into app/data first")
    raw = pd.DataFrame(json.load(open(SRC)))
    raw["date"] = pd.to_datetime(raw["d"])
    print(f"{len(raw):,} city x type x day rows, {raw.date.min().date()} to {raw.date.max().date()}")

    full_idx = pd.date_range(raw.date.min(), raw.date.max(), freq="D")
    targets = pd.date_range(START, END, freq="D")
    out = []
    summary = defaultdict(lambda: defaultdict(float))

    for (city, layer), g in raw.groupby(["m", "l"]):
        s = g.set_index("date")[["c", "s"]].reindex(full_idx).fillna(0.0)
        # centred 7-day mean, applied twice: one pass kills the settlement-day
        # rhythm; the second pass stops a holiday whose money got pushed to the
        # next working day from leaving a notch where the window edge splits them
        sm = (s.rolling(WINDOW, center=True, min_periods=1).mean()
               .rolling(WINDOW, center=True, min_periods=1).mean())

        for t in targets:
            vals_c, vals_s = [], []
            for y, w in YEARS.items():
                try:
                    src = t.replace(year=y)
                except ValueError:          # only 29 Feb could hit this
                    src = t.replace(year=y, day=28)
                if src in sm.index:
                    vals_c.append((sm.at[src, "c"], w))
                    vals_s.append((sm.at[src, "s"], w))
            if not vals_c:
                continue
            wsum = sum(w for _, w in vals_c)
            c  = sum(v * w for v, w in vals_c) / wsum
            sp = sum(v * w for v, w in vals_s) / wsum
            lo = min(min(v for v, _ in vals_c), c * (1 - NOISE))
            hi = max(max(v for v, _ in vals_c), c * (1 + NOISE))
            out.append({"m": city, "l": layer, "d": t.strftime("%Y-%m-%d"),
                        "c": round(c, 1), "lo": round(lo, 1), "hi": round(hi, 1),
                        "s": round(sp, 0)})
            if date(2026, 6, 11) <= t.date() <= date(2026, 7, 19):
                summary[city]["c"] += c; summary[city]["lo"] += lo; summary[city]["hi"] += hi

    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    mb = os.path.getsize(OUT) / 1e6
    print(f"wrote {len(out):,} rows to {OUT} ({mb:.1f} MB)\n")

    print("expected card customers at EFW shops, 11 Jun - 19 Jul 2026, no matches:")
    print(f"  {'city':24s} {'blend':>9s} {'low':>9s} {'high':>9s}   per day")
    for city in sorted(summary):
        v = summary[city]
        print(f"  {city:24s} {v['c']/1e3:8.0f}k {v['lo']/1e3:8.0f}k {v['hi']/1e3:8.0f}k   {v['c']/39:7.0f}")

if __name__ == "__main__":
    main()
