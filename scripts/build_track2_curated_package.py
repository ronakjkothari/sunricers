"""
Build Track 2 viz-ready curated CSV package from World Cup Hack sample data.
Outputs to data/curated/
"""
from __future__ import annotations

import csv
import gzip
import sys
from collections import defaultdict
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "curated"
OUT.mkdir(parents=True, exist_ok=True)

VISITS = Path(r"C:\Users\rishi\Downloads\store-visits-rice\store-visits-rice")
POI = Path(r"C:\Users\rishi\Downloads\core-poi-geometry-rice\core-poi-geometry-rice")
SPEND = Path(r"C:\Users\rishi\Downloads\daily-spend-brand-and-state-rice\daily-spend-brand-and-state-rice")
WEATHER = Path(r"C:\Users\rishi\Downloads\daily-weather-rice\daily-weather-rice")
UHI = Path(r"C:\Users\rishi\Downloads\urban-heat-index-rice\urban-heat-index-rice")

csv.field_size_limit(10_000_000)

# EFW NAICS prefixes / exact 3-digit
EFW_NAICS3 = {
    "722",  # food service
    "445",  # food/beverage stores
    "447",  # gasoline
    "721",  # lodging
    "711",  # performing arts / sports
    "712",  # museums / historical
    "713",  # amusement
    "562",  # waste
    "221",  # utilities
    "312",  # beverage mfg
    "311",  # food mfg
    "424",  # grocery wholesale
    "485",  # transit
    "481",  # air transport
    "488",  # support transport
}

EFW_CATEGORY_SUBSTR = (
    "restaurant",
    "grocery",
    "food",
    "gasoline",
    "accommodation",
    "hotel",
    "beverage",
    "drinking",
    "waste",
    "spectator",
    "amusement",
    "museum",
    "utility",
    "electric",
    "water",
)

SPEND_BRAND_KW = (
    "mcdonald",
    "starbucks",
    "chipotle",
    "subway",
    "dunkin",
    "pizza",
    "taco",
    "burger",
    "wendy",
    "kfc",
    "popeye",
    "domino",
    "chick-fil",
    "panera",
    "walmart",
    "target",
    "costco",
    "kroger",
    "whole foods",
    "trader joe",
    "aldi",
    "shell",
    "exxon",
    "chevron",
    "mobil",
    "bp ",
    " marathon",
    "marriott",
    "hilton",
    "hyatt",
    "holiday inn",
    "ihg",
    "wyndham",
    "best western",
    "courtyard",
    "residence inn",
    "hampton",
    "fairfield",
    "embassy",
    "airbnb",
    "uber eats",
    "doordash",
    "grubhub",
    "fuel",
)

# Approximate host-city airport / ASOS identifiers (FAA with K prefix)
STATION_TO_MARKET = {
    "KATL": "Atlanta",
    "KFTY": "Atlanta",
    "KPDK": "Atlanta",
    "KBOS": "Boston",
    "KBED": "Boston",
    "KDFW": "Dallas",
    "KDAL": "Dallas",
    "KADS": "Dallas",
    "KIAH": "Houston",
    "KHOU": "Houston",
    "KEFD": "Houston",
    "KMCI": "Kansas City",
    "KMKC": "Kansas City",
    "KLAX": "Los Angeles",
    "KBUR": "Los Angeles",
    "KLGB": "Los Angeles",
    "KSNA": "Los Angeles",
    "KMIA": "Miami",
    "KFLL": "Miami",
    "KOPF": "Miami",
    "KJFK": "New York/New Jersey",
    "KLGA": "New York/New Jersey",
    "KEWR": "New York/New Jersey",
    "KTEB": "New York/New Jersey",
    "KPHL": "Philadelphia",
    "KPNE": "Philadelphia",
    "KSFO": "San Francisco Bay Area",
    "KOAK": "San Francisco Bay Area",
    "KSJC": "San Francisco Bay Area",
    "KSEA": "Seattle",
    "KBFI": "Seattle",
    "KPAE": "Seattle",
}

MARKET_CROSSWALK = [
    # visits_spend_label, poi_uhi_label, host_city_canonical, notes
    ("Atlanta", "Atlanta", "Atlanta", "1:1"),
    ("Boston", "Boston", "Boston", "1:1"),
    ("Dallas / Houston", "Dallas", "Dallas", "split merged visit market"),
    ("Dallas / Houston", "Houston", "Houston", "split merged visit market"),
    ("Kansas City", "Kansas City", "Kansas City", "1:1"),
    ("Los Angeles / SF Bay Area", "Los Angeles", "Los Angeles", "split merged visit market"),
    ("Los Angeles / SF Bay Area", "San Francisco Bay Area", "San Francisco Bay Area", "split merged visit market"),
    ("Miami", "Miami", "Miami", "1:1"),
    ("New York/New Jersey", "New York/New Jersey", "New York/New Jersey", "1:1"),
    ("Philadelphia", "Philadelphia", "Philadelphia", "1:1"),
    ("Seattle", "Seattle", "Seattle", "1:1"),
]

# Intensity factors for footprint estimation (literature-typical; demo-grade)
# Units documented in DATA_TECH_DOCUMENT.md
INTENSITY_FACTORS = [
    {
        "efw_domain": "Food",
        "activity_class": "Restaurants and Other Eating Places",
        "naics3": "722",
        "activity_unit": "visit",
        "energy_kwh_per_unit": 2.8,
        "water_liters_per_unit": 25.0,
        "food_kg_co2e_per_unit": 3.5,
        "notes": "Approx per restaurant visit incl. prep + HVAC share",
    },
    {
        "efw_domain": "Food",
        "activity_class": "Grocery Stores",
        "naics3": "445",
        "activity_unit": "visit",
        "energy_kwh_per_unit": 1.2,
        "water_liters_per_unit": 8.0,
        "food_kg_co2e_per_unit": 6.0,
        "notes": "Basket emissions dominate over store ops",
    },
    {
        "efw_domain": "Food",
        "activity_class": "Specialty Food Stores",
        "naics3": "445",
        "activity_unit": "visit",
        "energy_kwh_per_unit": 1.0,
        "water_liters_per_unit": 6.0,
        "food_kg_co2e_per_unit": 4.5,
        "notes": "",
    },
    {
        "efw_domain": "Energy",
        "activity_class": "Gasoline Stations",
        "naics3": "447",
        "activity_unit": "visit",
        "energy_kwh_per_unit": 45.0,
        "water_liters_per_unit": 1.5,
        "food_kg_co2e_per_unit": 12.0,
        "notes": "fuel_kg_co2e stored in food_kg_co2e_per_unit column for schema uniformity; treat as energy CO2e",
    },
    {
        "efw_domain": "Water",
        "activity_class": "Traveler Accommodation",
        "naics3": "721",
        "activity_unit": "visit",
        "energy_kwh_per_unit": 28.0,
        "water_liters_per_unit": 300.0,
        "food_kg_co2e_per_unit": 2.0,
        "notes": "Guest-night proxy; water-heavy",
    },
    {
        "efw_domain": "Energy",
        "activity_class": "Cooling Degree Day uplift",
        "naics3": "",
        "activity_unit": "cdd_c_day",
        "energy_kwh_per_unit": 0.15,
        "water_liters_per_unit": 0.4,
        "food_kg_co2e_per_unit": 0.05,
        "notes": "Applied to lodging+food HVAC share via weather CDD",
    },
    {
        "efw_domain": "Energy",
        "activity_class": "UHI surcharge",
        "naics3": "",
        "activity_unit": "uhi_index_point",
        "energy_kwh_per_unit": 0.08,
        "water_liters_per_unit": 0.1,
        "food_kg_co2e_per_unit": 0.03,
        "notes": "Multiplier helper: kWh ≈ factor * UHI * district_visits/1000",
    },
    {
        "efw_domain": "Water",
        "activity_class": "Waste Treatment and Disposal",
        "naics3": "562",
        "activity_unit": "visit",
        "energy_kwh_per_unit": 5.0,
        "water_liters_per_unit": 40.0,
        "food_kg_co2e_per_unit": 8.0,
        "notes": "Sparse in data; use carefully",
    },
    {
        "efw_domain": "Food",
        "activity_class": "Spectator Sports",
        "naics3": "711",
        "activity_unit": "visit",
        "energy_kwh_per_unit": 4.0,
        "water_liters_per_unit": 15.0,
        "food_kg_co2e_per_unit": 2.5,
        "notes": "Venue concession + ops share per visit",
    },
    {
        "efw_domain": "Food",
        "activity_class": "Other Amusement and Recreation Industries",
        "naics3": "713",
        "activity_unit": "visit",
        "energy_kwh_per_unit": 3.0,
        "water_liters_per_unit": 12.0,
        "food_kg_co2e_per_unit": 1.8,
        "notes": "",
    },
]


def write_csv(path: Path, rows: list[dict], fieldnames: list[str] | None = None) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        print(f"  wrote EMPTY {path.name}")
        return
    fieldnames = fieldnames or list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"  wrote {path.name} ({len(rows):,} rows)")


def build_reference_tables() -> None:
    write_csv(
        OUT / "market_crosswalk.csv",
        [
            {
                "visits_spend_market": a,
                "poi_uhi_market": b,
                "host_city_canonical": c,
                "notes": d,
            }
            for a, b, c, d in MARKET_CROSSWALK
        ],
    )
    write_csv(OUT / "intensity_factors.csv", INTENSITY_FACTORS)
    write_csv(
        OUT / "station_to_market.csv",
        [
            {"station_id": k, "host_city_canonical": v, "source": "manual_host_airport_map"}
            for k, v in sorted(STATION_TO_MARKET.items())
        ],
    )


def build_visits(con: duckdb.DuckDBPyConnection) -> None:
    print("Building visits aggregates (this is the slow step)...")
    files = sorted(VISITS.glob("*.csv.gz"))
    if not files:
        raise FileNotFoundError(VISITS)

    naics_list = ", ".join(f"'{n}'" for n in sorted(EFW_NAICS3))
    efw_where = f"""
        substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) IN ({naics_list})
           OR lower(COALESCE(CATEGORY, '')) LIKE '%restaurant%'
           OR lower(COALESCE(CATEGORY, '')) LIKE '%grocery%'
           OR lower(COALESCE(CATEGORY, '')) LIKE '%food%'
           OR lower(COALESCE(CATEGORY, '')) LIKE '%gasoline%'
           OR lower(COALESCE(CATEGORY, '')) LIKE '%accommodation%'
           OR lower(COALESCE(CATEGORY, '')) LIKE '%waste%'
           OR lower(COALESCE(CATEGORY, '')) LIKE '%spectator%'
           OR lower(COALESCE(CATEGORY, '')) LIKE '%amusement%'
           OR lower(COALESCE(CATEGORY, '')) LIKE '%beverage%'
           OR lower(COALESCE(CATEGORY, '')) LIKE '%drinking%'
    """

    con.execute("DROP TABLE IF EXISTS visits_monthly_parts;")
    con.execute("DROP TABLE IF EXISTS visits_brand_parts;")
    con.execute("DROP TABLE IF EXISTS visits_total_parts;")
    monthly_created = brand_created = total_created = False

    for i, path in enumerate(files, 1):
        print(f"  visits file {i}/{len(files)}: {path.name}", flush=True)
        # One scan per file → three aggregates via TEMP table
        con.execute("DROP TABLE IF EXISTS visits_file_efw;")
        con.execute(
            f"""
            CREATE TEMP TABLE visits_file_efw AS
            SELECT
                MARKET,
                CATEGORY,
                SUB_CATEGORY,
                BRAND,
                NAME,
                substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) AS NAICS3,
                TRY_CAST(LOCAL_DATE AS DATE) AS LOCAL_DATE,
                TRY_CAST(DAILY_VISITS AS DOUBLE) AS DAILY_VISITS
            FROM read_csv(
                '{path.as_posix()}',
                header=true,
                ignore_errors=true,
                parallel=false,
                compression='gzip'
            )
            WHERE {efw_where};
            """
        )
        n = con.execute("SELECT COUNT(*) FROM visits_file_efw").fetchone()[0]
        print(f"    efw rows: {n:,}", flush=True)

        monthly_sql = """
            SELECT
                MARKET,
                CATEGORY,
                SUB_CATEGORY,
                NAICS3,
                strftime(LOCAL_DATE, '%Y-%m') AS year_month,
                SUM(DAILY_VISITS) AS total_visits,
                COUNT(*) AS store_day_rows,
                AVG(DAILY_VISITS) AS avg_daily_visits,
                COUNT(DISTINCT NAME) AS distinct_names
            FROM visits_file_efw
            GROUP BY 1,2,3,4,5
        """
        if not monthly_created:
            con.execute(f"CREATE TABLE visits_monthly_parts AS {monthly_sql}")
            monthly_created = True
        else:
            con.execute(f"INSERT INTO visits_monthly_parts {monthly_sql}")

        brand_sql = """
            SELECT
                MARKET,
                CATEGORY,
                BRAND,
                strftime(LOCAL_DATE, '%Y-%m') AS year_month,
                SUM(DAILY_VISITS) AS total_visits,
                COUNT(DISTINCT NAME) AS distinct_locations
            FROM visits_file_efw
            WHERE BRAND IS NOT NULL AND BRAND <> ''
            GROUP BY 1,2,3,4
        """
        if not brand_created:
            con.execute(f"CREATE TABLE visits_brand_parts AS {brand_sql}")
            brand_created = True
        else:
            con.execute(f"INSERT INTO visits_brand_parts {brand_sql}")

        total_sql = """
            SELECT
                MARKET,
                CATEGORY,
                NAICS3,
                SUM(DAILY_VISITS) AS total_visits,
                COUNT(*) AS store_day_rows
            FROM visits_file_efw
            GROUP BY 1,2,3
        """
        if not total_created:
            con.execute(f"CREATE TABLE visits_total_parts AS {total_sql}")
            total_created = True
        else:
            con.execute(f"INSERT INTO visits_total_parts {total_sql}")

        con.execute("DROP TABLE IF EXISTS visits_file_efw;")

    con.execute(
        """
        COPY (
            SELECT
                MARKET,
                CATEGORY,
                SUB_CATEGORY,
                NAICS3,
                year_month,
                SUM(total_visits) AS total_visits,
                SUM(store_day_rows) AS store_day_rows,
                SUM(avg_daily_visits * store_day_rows) / NULLIF(SUM(store_day_rows), 0) AS avg_daily_visits,
                MAX(distinct_names) AS distinct_names_approx
            FROM visits_monthly_parts
            GROUP BY 1,2,3,4,5
            ORDER BY 1,5,6 DESC
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "visits_efw_monthly.csv")],
    )
    print("  wrote visits_efw_monthly.csv")

    con.execute(
        """
        COPY (
            SELECT * FROM (
                SELECT
                    MARKET,
                    CATEGORY,
                    BRAND,
                    year_month,
                    SUM(total_visits) AS total_visits,
                    MAX(distinct_locations) AS distinct_locations_approx
                FROM visits_brand_parts
                GROUP BY 1,2,3,4
            )
            QUALIFY ROW_NUMBER() OVER (
                PARTITION BY MARKET, CATEGORY, year_month
                ORDER BY total_visits DESC
            ) <= 25
            ORDER BY MARKET, year_month, CATEGORY, total_visits DESC
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "visits_efw_brand_monthly_top25.csv")],
    )
    print("  wrote visits_efw_brand_monthly_top25.csv")

    con.execute(
        """
        COPY (
            SELECT
                MARKET,
                CATEGORY,
                NAICS3,
                SUM(total_visits) AS total_visits,
                SUM(store_day_rows) AS store_day_rows
            FROM visits_total_parts
            GROUP BY 1,2,3
            ORDER BY MARKET, total_visits DESC
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "visits_efw_market_category_totals.csv")],
    )
    print("  wrote visits_efw_market_category_totals.csv")


def build_poi(con: duckdb.DuckDBPyConnection) -> None:
    print("Building POI EFW layer...")
    files = sorted(POI.glob("*.csv.gz"))
    naics_list = ", ".join(f"'{n}'" for n in sorted(EFW_NAICS3))
    con.execute("CREATE OR REPLACE TABLE poi_efw AS SELECT * FROM (SELECT 1 AS _x) WHERE 1=0;")
    # Create empty typed table via first successful insert pattern
    con.execute("DROP TABLE IF EXISTS poi_efw;")
    created = False
    for i, path in enumerate(files, 1):
        print(f"  poi file {i}/{len(files)}: {path.name}")
        select_sql = f"""
            SELECT
                PLACEKEY,
                LOCATION_NAME,
                MARKET,
                CITY,
                REGION,
                POSTAL_CODE,
                TRY_CAST(LATITUDE AS DOUBLE) AS LATITUDE,
                TRY_CAST(LONGITUDE AS DOUBLE) AS LONGITUDE,
                CAST(NAICS_CODE AS VARCHAR) AS NAICS_CODE,
                substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) AS NAICS3,
                TOP_CATEGORY,
                SUB_CATEGORY,
                BRANDS,
                CATEGORY_TAGS,
                TRY_CAST(WKT_AREA_SQ_METERS AS DOUBLE) AS WKT_AREA_SQ_METERS,
                GEOMETRY_TYPE,
                CASE
                    WHEN POLYGON_WKT IS NULL THEN NULL
                    WHEN length(POLYGON_WKT) > 2000 THEN left(POLYGON_WKT, 2000) || '...[truncated]'
                    ELSE POLYGON_WKT
                END AS POLYGON_WKT_SHORT,
                CASE
                  WHEN substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) = '722' THEN 'Food'
                  WHEN substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) = '445' THEN 'Food'
                  WHEN substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) IN ('311','312','424') THEN 'Food'
                  WHEN substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) = '447' THEN 'Energy'
                  WHEN substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) = '221' THEN 'Energy'
                  WHEN substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) = '721' THEN 'Water'
                  WHEN substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) = '562' THEN 'Water'
                  WHEN substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) IN ('711','712','713') THEN 'Venue'
                  ELSE 'Other_EFW'
                END AS efw_layer
            FROM read_csv(
                '{path.as_posix()}',
                header=true,
                ignore_errors=true,
                parallel=false,
                compression='gzip'
            )
            WHERE substr(CAST(NAICS_CODE AS VARCHAR), 1, 3) IN ({naics_list})
               OR lower(COALESCE(TOP_CATEGORY, '')) LIKE '%restaurant%'
               OR lower(COALESCE(TOP_CATEGORY, '')) LIKE '%grocery%'
               OR lower(COALESCE(TOP_CATEGORY, '')) LIKE '%accommodation%'
               OR lower(COALESCE(TOP_CATEGORY, '')) LIKE '%gasoline%'
               OR lower(COALESCE(TOP_CATEGORY, '')) LIKE '%waste%'
               OR lower(COALESCE(TOP_CATEGORY, '')) LIKE '%spectator%'
               OR lower(COALESCE(TOP_CATEGORY, '')) LIKE '%amusement%'
               OR lower(COALESCE(TOP_CATEGORY, '')) LIKE '%museum%'
               OR lower(COALESCE(LOCATION_NAME, '')) LIKE '%stadium%'
               OR lower(COALESCE(LOCATION_NAME, '')) LIKE '%arena%'
               OR lower(COALESCE(LOCATION_NAME, '')) LIKE '%convention%'
        """
        if not created:
            con.execute(f"CREATE TABLE poi_efw AS {select_sql}")
            created = True
        else:
            con.execute(f"INSERT INTO poi_efw {select_sql}")
    con.execute(
        """
        COPY (
            SELECT * FROM poi_efw
            ORDER BY MARKET, efw_layer, TOP_CATEGORY, LOCATION_NAME
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "poi_efw.csv")],
    )
    n = con.execute("SELECT COUNT(*) FROM poi_efw").fetchone()[0]
    print(f"  wrote poi_efw.csv ({n:,} rows)")

    con.execute(
        """
        COPY (
            SELECT
                MARKET,
                efw_layer,
                TOP_CATEGORY,
                COUNT(*) AS poi_count,
                AVG(LATITUDE) AS avg_lat,
                AVG(LONGITUDE) AS avg_lon,
                SUM(COALESCE(WKT_AREA_SQ_METERS, 0)) AS sum_area_sq_m
            FROM poi_efw
            GROUP BY 1,2,3
            ORDER BY MARKET, poi_count DESC
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "poi_efw_market_summary.csv")],
    )
    print("  wrote poi_efw_market_summary.csv")


def build_spend(con: duckdb.DuckDBPyConnection) -> None:
    print("Building spend EFW brand filter...")
    files = sorted(SPEND.glob("*.csv.gz"))
    ors = " OR ".join(
        f"lower(COALESCE(BRAND_NAME, '')) LIKE '%{kw.strip()}%'" for kw in SPEND_BRAND_KW
    )
    con.execute("DROP TABLE IF EXISTS spend_efw;")
    created = False
    for i, path in enumerate(files, 1):
        print(f"  spend file {i}/{len(files)}: {path.name}")
        select_sql = f"""
            SELECT
                MARKET,
                STATE_ABBR,
                BRAND_NAME,
                TRY_CAST(TRANS_DATE AS DATE) AS TRANS_DATE,
                TRY_CAST(SPEND_AMOUNT AS DOUBLE) AS SPEND_AMOUNT,
                TRY_CAST(TRANS_COUNT AS DOUBLE) AS TRANS_COUNT,
                CASE
                  WHEN lower(BRAND_NAME) LIKE '%fuel%' OR lower(BRAND_NAME) LIKE '%shell%'
                    OR lower(BRAND_NAME) LIKE '%exxon%' OR lower(BRAND_NAME) LIKE '%chevron%'
                    OR lower(BRAND_NAME) LIKE '%mobil%' OR lower(BRAND_NAME) LIKE '%bp %'
                    THEN 'Energy'
                  WHEN lower(BRAND_NAME) LIKE '%marriott%' OR lower(BRAND_NAME) LIKE '%hilton%'
                    OR lower(BRAND_NAME) LIKE '%hyatt%' OR lower(BRAND_NAME) LIKE '%holiday%'
                    OR lower(BRAND_NAME) LIKE '%hampton%' OR lower(BRAND_NAME) LIKE '%wyndham%'
                    OR lower(BRAND_NAME) LIKE '%best western%' OR lower(BRAND_NAME) LIKE '%courtyard%'
                    OR lower(BRAND_NAME) LIKE '%embassy%' OR lower(BRAND_NAME) LIKE '%fairfield%'
                    THEN 'Lodging'
                  ELSE 'Food'
                END AS spend_domain
            FROM read_csv(
                '{path.as_posix()}',
                header=true,
                ignore_errors=true,
                parallel=false,
                compression='gzip'
            )
            WHERE {ors}
        """
        if not created:
            con.execute(f"CREATE TABLE spend_efw AS {select_sql}")
            created = True
        else:
            con.execute(f"INSERT INTO spend_efw {select_sql}")
    con.execute(
        """
        COPY (
            SELECT
                MARKET,
                spend_domain,
                BRAND_NAME,
                strftime(TRANS_DATE, '%Y-%m') AS year_month,
                SUM(SPEND_AMOUNT) AS spend_amount,
                SUM(TRANS_COUNT) AS trans_count
            FROM spend_efw
            GROUP BY 1,2,3,4
            ORDER BY MARKET, year_month, spend_amount DESC
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "spend_efw_brand_monthly.csv")],
    )
    print("  wrote spend_efw_brand_monthly.csv")
    con.execute(
        """
        COPY (
            SELECT
                MARKET,
                spend_domain,
                strftime(TRANS_DATE, '%Y-%m') AS year_month,
                SUM(SPEND_AMOUNT) AS spend_amount,
                SUM(TRANS_COUNT) AS trans_count,
                COUNT(DISTINCT BRAND_NAME) AS brand_count
            FROM spend_efw
            GROUP BY 1,2,3
            ORDER BY MARKET, year_month, spend_domain
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "spend_efw_domain_monthly.csv")],
    )
    print("  wrote spend_efw_domain_monthly.csv")


def build_weather(con: duckdb.DuckDBPyConnection) -> None:
    print("Building weather (host-station subset + monthly)...")
    files = sorted(WEATHER.glob("*.csv.gz"))
    station_rows = ", ".join(
        f"('{sid}', '{mkt}')" for sid, mkt in STATION_TO_MARKET.items()
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE station_map AS
        SELECT * FROM (VALUES {station_rows})
        AS t(station_id, host_city_canonical);
        """
    )
    con.execute("DROP TABLE IF EXISTS weather_host;")
    created = False
    for i, path in enumerate(files, 1):
        print(f"  weather file {i}/{len(files)}: {path.name}")
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
    print(f"  host-station weather rows: {n:,}")
    con.execute(
        """
        COPY (
            SELECT * FROM weather_host
            ORDER BY host_city_canonical, station_id, valid_date
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "weather_host_daily.csv")],
    )
    print("  wrote weather_host_daily.csv")
    con.execute(
        """
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
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "weather_host_monthly.csv")],
    )
    print("  wrote weather_host_monthly.csv")


def build_uhi(con: duckdb.DuckDBPyConnection) -> None:
    print("Building UHI...")
    files = sorted(UHI.glob("*.csv.gz"))
    con.execute("DROP TABLE IF EXISTS uhi_all;")
    created = False
    for i, path in enumerate(files, 1):
        print(f"  uhi file {i}/{len(files)}: {path.name}")
        select_sql = f"""
            SELECT
                MARKET,
                TRY_CAST(LATITUDE AS DOUBLE) AS LATITUDE,
                TRY_CAST(LONGITUDE AS DOUBLE) AS LONGITUDE,
                TRY_CAST(UHI AS INTEGER) AS UHI
            FROM read_csv(
                '{path.as_posix()}',
                header=true,
                ignore_errors=true,
                parallel=false,
                compression='gzip'
            )
        """
        if not created:
            con.execute(f"CREATE TABLE uhi_all AS {select_sql}")
            created = True
        else:
            con.execute(f"INSERT INTO uhi_all {select_sql}")

    con.execute(
        """
        COPY (
            SELECT * FROM uhi_all
            ORDER BY MARKET, UHI DESC
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "uhi_points.csv")],
    )
    print("  wrote uhi_points.csv")
    con.execute(
        """
        COPY (
            SELECT
                MARKET,
                COUNT(*) AS point_count,
                AVG(UHI) AS mean_uhi,
                quantile_cont(UHI, 0.9) AS p90_uhi,
                MAX(UHI) AS max_uhi,
                AVG(LATITUDE) AS avg_lat,
                AVG(LONGITUDE) AS avg_lon
            FROM uhi_all
            GROUP BY 1
            ORDER BY mean_uhi DESC
        ) TO ? (HEADER, DELIMITER ',');
        """,
        [str(OUT / "uhi_market_summary.csv")],
    )
    print("  wrote uhi_market_summary.csv")


def build_footprints(con: duckdb.DuckDBPyConnection) -> None:
    print("Building demo footprint estimates...")
    intensity_path = (OUT / "intensity_factors.csv").as_posix()
    visits_path = (OUT / "visits_efw_monthly.csv").as_posix()
    out_cat = (OUT / "footprint_estimates_monthly.csv").as_posix()
    out_mkt = (OUT / "footprint_estimates_market_monthly.csv").as_posix()

    con.execute(
        f"""
        CREATE OR REPLACE TABLE intensity AS
        SELECT * FROM read_csv_auto('{intensity_path}', header=true);
        """
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE footprint_monthly AS
        SELECT
            v.MARKET,
            v.year_month,
            v.CATEGORY,
            v.NAICS3,
            v.total_visits,
            i.efw_domain,
            i.energy_kwh_per_unit,
            i.water_liters_per_unit,
            i.food_kg_co2e_per_unit,
            v.total_visits * i.energy_kwh_per_unit AS est_energy_kwh,
            v.total_visits * i.water_liters_per_unit AS est_water_liters,
            v.total_visits * i.food_kg_co2e_per_unit AS est_kg_co2e
        FROM read_csv_auto('{visits_path}', header=true) v
        INNER JOIN intensity i
          ON v.CATEGORY = i.activity_class;
        """
    )
    con.execute(
        f"""
        COPY (
            SELECT * FROM footprint_monthly
            ORDER BY MARKET, year_month, est_kg_co2e DESC
        ) TO '{out_cat}' (HEADER, DELIMITER ',');
        """
    )
    print("  wrote footprint_estimates_monthly.csv")

    con.execute(
        f"""
        COPY (
            SELECT
                MARKET,
                year_month,
                SUM(est_energy_kwh) AS est_energy_kwh,
                SUM(est_water_liters) AS est_water_liters,
                SUM(est_kg_co2e) AS est_kg_co2e,
                SUM(total_visits) AS total_visits
            FROM footprint_monthly
            GROUP BY 1,2
            ORDER BY 1,2
        ) TO '{out_mkt}' (HEADER, DELIMITER ',');
        """
    )
    print("  wrote footprint_estimates_market_monthly.csv")


def write_manifest() -> None:
    files = sorted(p for p in OUT.iterdir() if p.is_file())
    rows = []
    for p in files:
        rows.append(
            {
                "file": p.name,
                "bytes": p.stat().st_size,
                "mb": round(p.stat().st_size / 1e6, 3),
            }
        )
    write_csv(OUT / "MANIFEST.csv", rows)
    # Also a human README stub inside package
    (OUT / "README.md").write_text(
        """# Track 2 curated CSV package

Viz-ready extracts for the Rice Urban Sustainability Hackathon — Track 2 (Energy–Food–Water).

**Start here for humans:** [`../../docs/DATA_TECH_DOCUMENT.md`](../../docs/DATA_TECH_DOCUMENT.md)

**Solution brainstorming:** [`../../docs/PROPOSED_SOLUTION_PLANS.md`](../../docs/PROPOSED_SOLUTION_PLANS.md)

**Shortlist rationale:** [`../../docs/TRACK2_DATA_SHORTLIST.md`](../../docs/TRACK2_DATA_SHORTLIST.md)

All magnitude fields are from transformed sample data — use for methodology demos only.
""",
        encoding="utf-8",
    )


def main() -> int:
    print(f"Output directory: {OUT}")
    build_reference_tables()
    db_path = OUT / "_build.duckdb"
    if db_path.exists():
        db_path.unlink()
    con = duckdb.connect(database=str(db_path))
    con.execute("SET threads TO 4;")
    con.execute("SET memory_limit='6GB';")
    try:
        build_visits(con)
        build_poi(con)
        build_spend(con)
        build_weather(con)
        build_uhi(con)
        build_footprints(con)
        write_manifest()
        print("DONE")
    finally:
        con.close()
        # keep duckdb for debug reuse; remove if huge
        if db_path.exists() and db_path.stat().st_size > 2_000_000_000:
            db_path.unlink()
    return 0


if __name__ == "__main__":
    sys.exit(main())
