# 2026 World Cup schedule and stadiums

Pulled from Wikipedia on 2026-08-16 by parsing the `football box` templates on
`2026 FIFA World Cup Group A` … `Group L`, `… round of 32`, `… knockout stage`
and `… final`, plus the venue table on `2026 FIFA World Cup`. Nothing here is
from memory.

`matches_2026.csv` — all 104 matches, one row each.
`date` (local), `stadium`, `market` (our host-city label, blank for Canada and
Mexico), `in_usa`, `stage` (Group A … Final), `stage_group` (Group / Round of 32
/ Round of 16 / Quarter-final / Semi-final / Third place / Final), `team1`,
`team2` (FIFA codes), `attendance` (as reported by Wikipedia), `capacity_wc`
(tournament configuration, US stadiums only).

`stadiums.csv` — the 11 US venues with our `market` label, Wikipedia
coordinates and tournament capacity.

Checks done: 104 matches parsed with no missing date or stadium; per-stadium
match counts equal Wikipedia's venue table (AT&T 9, MetLife/SoFi/Mercedes-Benz 8,
NRG/Hard Rock/Gillette 7, the rest 6); 78 matches in the US, all 78 carry an
attendance figure; median fill rate 100%, lowest 97%.

## Analog events (for calibrating the forecast)

`nfl_home_games.csv` — 566 NFL home games at the 11 stadiums, 2020–2024, from ESPN's public
schedule feed (`site.api.espn.com`), with local date, kickoff, season type and attendance.
2020 games had empty or capped stadiums and serve as a no-crowd control. Read by
`notebooks/nfl_lift.ipynb`.

`copa_america_2024.csv` — all 32 Copa América 2024 matches, 20 Jun–14 Jul 2024, parsed from
Wikipedia the same way as the World Cup schedule; 19 of them at eight of our stadiums, with
attendance. Read by `notebooks/copa_lift.ipynb`. Boston, Philadelphia and Seattle hosted no
matches and are the control cities.

## Feeding the map page

`app/data/matches.json` (US matches only, short keys `id d s m st g t1 t2 a cap`) and
`app/data/stadiums.json` (`{stadium: {m, y, x, cap}}`) were written from these two
CSVs with a few lines of Python; if the CSVs change, regenerate them the same way:

```python
import csv, json
st = {r['stadium']: r for r in csv.DictReader(open('data/worldcup/stadiums.csv'))}
ms = [r for r in csv.DictReader(open('data/worldcup/matches_2026.csv')) if r['in_usa'] == '1']
json.dump([{"id": i, "d": r['date'], "s": r['stadium'], "m": r['market'], "st": r['stage'], "g": r['stage_group'],
            "t1": r['team1'], "t2": r['team2'], "a": int(r['attendance']) if r['attendance'] else None,
            "cap": int(r['capacity_wc'])} for i, r in enumerate(ms)], open('app/data/matches.json', 'w'))
json.dump({k: {"m": v['market'], "y": float(v['lat']), "x": float(v['lon']), "cap": int(v['capacity_wc'])}
           for k, v in st.items()}, open('app/data/stadiums.json', 'w'))
```
