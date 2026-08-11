import csv
import math
import urllib.request
from collections import Counter
from pathlib import Path

import duckdb

HOSTS = {
    "Atlanta": (33.749, -84.388),
    "Boston": (42.360, -71.059),
    "Dallas": (32.777, -96.797),
    "Houston": (29.760, -95.370),
    "Kansas City": (39.100, -94.578),
    "Los Angeles": (34.052, -118.244),
    "Miami": (25.762, -80.192),
    "New York/New Jersey": (40.713, -74.006),
    "Philadelphia": (39.953, -75.165),
    "San Francisco Bay Area": (37.775, -122.419),
    "Seattle": (47.606, -122.332),
}

OUT = Path(r"C:\Users\rishi\OneDrive\Documents\GitHub\sunricers\data\curated")
WEATHER = Path(r"C:\Users\rishi\Downloads\daily-weather-rice\daily-weather-rice")


def haversine_km(a, b):
    lat1, lon1 = a
    lat2, lon2 = b
    r = 6371.0
    p = math.radians(lat2 - lat1)
    q = math.radians(lon2 - lon1)
    x = (
        math.sin(p / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(q / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(x))


def main():
    con = duckdb.connect()
    ids = set()
    for f in sorted(WEATHER.glob("*.csv.gz")):
        rows = con.execute(
            f"""
            SELECT DISTINCT CITY_LOCATION_IDENTIFIER__UP_TO_9_ALPHANUMERIC_CHARACTERS_
            FROM read_csv(
                '{f.as_posix()}',
                header=true,
                parallel=false,
                compression='gzip'
            )
            """
        ).fetchall()
        ids.update(r[0] for r in rows)
    print("stations", len(ids))

    url = "https://davidmegginson.github.io/ourairports-data/airports.csv"
    tmp = OUT / "_airports_tmp.csv"
    print("downloading airports...")
    urllib.request.urlretrieve(url, tmp)

    icao = {}
    with tmp.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            code = row.get("ident") or ""
            if not code:
                continue
            try:
                lat = float(row["latitude_deg"])
                lon = float(row["longitude_deg"])
            except (TypeError, ValueError):
                continue
            icao[code] = (lat, lon, row.get("name", ""), row.get("municipality", ""))

    rows_out = []
    for sid in sorted(ids):
        if sid not in icao:
            continue
        lat, lon, name, muni = icao[sid]
        best = None
        bestd = 1e9
        for host, coord in HOSTS.items():
            d = haversine_km((lat, lon), coord)
            if d < bestd:
                bestd = d
                best = host
        if bestd <= 150:
            rows_out.append(
                {
                    "station_id": sid,
                    "host_city_canonical": best,
                    "dist_km": round(bestd, 1),
                    "station_name": name,
                    "municipality": muni,
                    "lat": lat,
                    "lon": lon,
                    "source": "ourairports_nearest_host_150km",
                }
            )

    print("matched within 150km", len(rows_out))
    print(Counter(r["host_city_canonical"] for r in rows_out))

    out = OUT / "station_to_market.csv"
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows_out[0].keys()))
        w.writeheader()
        w.writerows(sorted(rows_out, key=lambda r: (r["host_city_canonical"], r["dist_km"])))
    print("wrote", out)

    # Rebuild weather_host using new map
    station_rows = ", ".join(
        f"('{r['station_id']}', '{r['host_city_canonical']}')" for r in rows_out
    )
    con.execute("DROP TABLE IF EXISTS station_map;")
    con.execute(
        f"""
        CREATE TABLE station_map AS
        SELECT * FROM (VALUES {station_rows}) AS t(station_id, host_city_canonical);
        """
    )
    con.execute("DROP TABLE IF EXISTS weather_host;")
    created = False
    for i, path in enumerate(sorted(WEATHER.glob("*.csv.gz")), 1):
        print(f"weather rebuild {i}/31 {path.name}")
        select_sql = f"""
            SELECT
                r.CITY_LOCATION_IDENTIFIER__UP_TO_9_ALPHANUMERIC_CHARACTERS_ AS station_id,
                m.host_city_canonical,
                TRY_CAST(r.VALID_DATE_AS_YYYYMMDD AS DATE) AS valid_date,
                TRY_CAST(r.AVERAGE_TEMPERATURE_C___FLOAT_VALUE_TO_NEAREST_HUNDREDTHS_PLACE AS DOUBLE) AS avg_temp_c,
                TRY_CAST(r.MAXIMUM_TEMPERATURE_C___FLOAT_VALUE_TO_NEAREST_HUNDREDTHS_PLACE AS DOUBLE) AS max_temp_c,
                TRY_CAST(r.MINIMUM_TEMPERATURE_C___FLOAT_VALUE_TO_NEAREST_HUNDREDTHS_PLACE AS DOUBLE) AS min_temp_c,
                TRY_CAST(r.COOLING_DEGREE_DAYS_C___FLOAT_VALUE_TO_NEAREST_HUNDREDTHS_PLACE AS DOUBLE) AS cdd_c,
                TRY_CAST(r.HEATING_DEGREE_DAYS_C___FLOAT_VALUE_TO_NEAREST_HUNDREDTHS_PLACE AS DOUBLE) AS hdd_c,
                TRY_CAST(r.PRECIPITATION_INTEGER_IN_HUNDREDTHS_OF_A_MILLIMETER___LIQUID_EQUIVALENT____0__IS_USED_FOR_TRACE_AMOUNTS_AND___1__IS_USED_FOR_NO_PRECIPITATION AS DOUBLE) AS precip_hundredths_mm,
                TRY_CAST(r.AVERAGE_RELATIVE_HUMIDITY_____FLOAT_VALUE_TO_NEAREST_HUNDREDTHS_PLACE AS DOUBLE) AS avg_rh_pct
            FROM read_csv(
                '{path.as_posix()}',
                header=true,
                ignore_errors=true,
                parallel=false,
                compression='gzip'
            ) r
            JOIN station_map m
              ON r.CITY_LOCATION_IDENTIFIER__UP_TO_9_ALPHANUMERIC_CHARACTERS_ = m.station_id
        """
        if not created:
            con.execute(f"CREATE TABLE weather_host AS {select_sql}")
            created = True
        else:
            con.execute(f"INSERT INTO weather_host {select_sql}")

    n = con.execute("SELECT COUNT(*) FROM weather_host").fetchone()[0]
    print("host weather rows", n)
    daily = (OUT / "weather_host_daily.csv").as_posix()
    monthly = (OUT / "weather_host_monthly.csv").as_posix()
    con.execute(
        f"""
        COPY (
            SELECT * FROM weather_host
            ORDER BY host_city_canonical, station_id, valid_date
        ) TO '{daily}' (HEADER, DELIMITER ',');
        """
    )
    con.execute(
        f"""
        COPY (
            SELECT
                host_city_canonical,
                strftime(valid_date, '%Y-%m') AS year_month,
                AVG(avg_temp_c) AS avg_temp_c,
                SUM(cdd_c) AS sum_cdd_c,
                SUM(hdd_c) AS sum_hdd_c,
                AVG(avg_rh_pct) AS avg_rh_pct,
                SUM(CASE WHEN precip_hundredths_mm > 0 THEN precip_hundredths_mm ELSE 0 END) AS sum_precip_hundredths_mm,
                COUNT(*) AS day_station_rows
            FROM weather_host
            GROUP BY 1,2
            ORDER BY 1,2
        ) TO '{monthly}' (HEADER, DELIMITER ',');
        """
    )
    print("rewrote weather host files")
    tmp.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
