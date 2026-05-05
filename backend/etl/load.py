import os
import re
import psycopg2
from psycopg2.extras import execute_values
import pandas as pd
import numpy as np

# ── Config ────────────────────────────────────────────────────────────────────
DSN = (
    os.environ.get(
        "DATABASE_URL",
        "postgresql://elections:elections@localhost:5433/electoral_dashboard",
    )
    .replace("postgresql+asyncpg://", "postgresql://")
    .replace("postgresql+psycopg2://", "postgresql://")
)
CLEANED = os.path.join(os.path.dirname(__file__), "..", "datasets", "cleaned")

SUFFIX_RE = re.compile(
    r"\s+(County|Parish|Borough|Municipality|Census\s+Area"
    r"|City\s+and\s+Borough|City|Town|Village|District)$",
    re.IGNORECASE,
)

EDU_LEVEL_MAP = {
    "less_than_hs":        "less_than_high_school",
    "hs_only":             "high_school_only",
    "some_college":        "some_college_or_associate",
    "bachelors_or_higher": "bachelors_or_higher",
}

# (csv_col, indicator_code, name, category, unit, value_type)
DEMO_INDICATORS = [
    ("age_pct_65_older",               "age_pct_65_older",          "Population 65 years and older",              "Age",           "percent",       "percent"),
    ("age_pct_under_18",               "age_pct_under_18",          "Population under 18 years",                  "Age",           "percent",       "percent"),
    ("age_pct_under_5",                "age_pct_under_5",           "Population under 5 years",                   "Age",           "percent",       "percent"),
    ("edu_bachelors_pct",              "edu_bachelors_pct",         "Bachelor degree or higher (ACS)",            "Education",     "percent",       "percent"),
    ("edu_hs_or_higher_pct",           "edu_hs_or_higher_pct",      "High school diploma or higher (ACS)",        "Education",     "percent",       "percent"),
    ("employment_nonemployer_estab",   "emp_nonemployer_estab",      "Nonemployer establishments",                 "Employment",    "count",         "count"),
    ("ethnicity_native_pct",           "ethnicity_native_pct",      "American Indian and Alaska Native alone",    "Ethnicity",     "percent",       "percent"),
    ("ethnicity_asian_pct",            "ethnicity_asian_pct",       "Asian alone",                                "Ethnicity",     "percent",       "percent"),
    ("ethnicity_black_pct",            "ethnicity_black_pct",       "Black or African American alone",            "Ethnicity",     "percent",       "percent"),
    ("ethnicity_hispanic_pct",         "ethnicity_hispanic_pct",    "Hispanic or Latino",                         "Ethnicity",     "percent",       "percent"),
    ("ethnicity_pacific_islander_pct", "ethnicity_pi_pct",          "Native Hawaiian and Pacific Islander alone", "Ethnicity",     "percent",       "percent"),
    ("ethnicity_two_or_more_pct",      "ethnicity_two_or_more_pct", "Two or more races",                          "Ethnicity",     "percent",       "percent"),
    ("ethnicity_white_pct",            "ethnicity_white_pct",       "White alone",                                "Ethnicity",     "percent",       "percent"),
    ("ethnicity_white_nonhispanic_pct","ethnicity_white_nh_pct",    "White alone, not Hispanic or Latino",        "Ethnicity",     "percent",       "percent"),
    ("housing_homeownership_pct",      "housing_homeownership_pct", "Homeownership rate",                         "Housing",       "percent",       "percent"),
    ("housing_households",             "housing_households",        "Number of households",                       "Housing",       "count",         "count"),
    ("housing_units",                  "housing_units",             "Housing units",                              "Housing",       "count",         "count"),
    ("housing_median_value",           "housing_median_value",      "Median value of owner-occupied units",       "Housing",       "USD",           "currency"),
    ("housing_persons_per_hh",         "housing_persons_per_hh",    "Persons per household",                      "Housing",       "ratio",         "ratio"),
    ("income_median_household",        "income_median_household",   "Median household income",                    "Income",        "USD",           "currency"),
    ("income_per_capita",              "income_per_capita",         "Per capita income",                          "Income",        "USD",           "currency"),
    ("misc_foreign_born_pct",          "misc_foreign_born_pct",     "Foreign born population",                    "Demographics",  "percent",       "percent"),
    ("misc_land_area_sqmi",            "misc_land_area_sqmi",       "Land area in square miles",                  "Geography",     "sq mi",         "area"),
    ("misc_lang_noneng_pct",           "misc_lang_noneng_pct",      "Language other than English at home",        "Demographics",  "percent",       "percent"),
    ("misc_same_house_1yr_pct",        "misc_same_house_1yr_pct",   "Living in same house 1+ years",              "Demographics",  "percent",       "percent"),
    ("misc_manuf_shipments",           "misc_manuf_shipments",      "Manufacturers shipments (USD thousands)",    "Economy",       "USD thousands", "count"),
    ("misc_mean_travel_time_min",      "misc_mean_travel_time_min", "Mean travel time to work (minutes)",         "Transportation","minutes",       "minutes"),
    ("misc_pct_female",                "misc_pct_female",           "Percent female",                             "Demographics",  "percent",       "percent"),
    ("misc_veterans",                  "misc_veterans",             "Veterans",                                   "Demographics",  "count",         "count"),
    ("population_2020",                "population_2020",           "Population (2020 Census)",                   "Population",    "count",         "count"),
    ("population_2010",                "population_2010",           "Population (2010 Census)",                   "Population",    "count",         "count"),
    ("population_density",             "pop_density_census",        "Population density per sq mi (Census)",      "Population",    "people/sq mi",  "density"),
    ("sales_food_services",            "sales_food_services",       "Accommodation and food services sales",      "Economy",       "USD thousands", "count"),
    ("sales_retail",                   "sales_retail",              "Retail sales",                               "Economy",       "USD thousands", "count"),
    ("firms_total",                    "firms_total",               "Total business firms",                       "Employment",    "count",         "count"),
    ("firms_women_owned",              "firms_women_owned",         "Women-owned firms",                          "Employment",    "count",         "count"),
    ("firms_men_owned",                "firms_men_owned",           "Men-owned firms",                            "Employment",    "count",         "count"),
    ("firms_minority_owned",           "firms_minority_owned",      "Minority-owned firms",                       "Employment",    "count",         "count"),
    ("firms_nonminority_owned",        "firms_nonminority_owned",   "Nonminority-owned firms",                    "Employment",    "count",         "count"),
    ("firms_veteran_owned",            "firms_veteran_owned",       "Veteran-owned firms",                        "Employment",    "count",         "count"),
    ("firms_nonveteran_owned",         "firms_nonveteran_owned",    "Nonveteran-owned firms",                     "Employment",    "count",         "count"),
]

POP_INDICATORS = [
    ("population",       "pop_density_population",  "Population (density dataset)",           "Population", "count",        "count"),
    ("area_sqmi",        "pop_density_area_sqmi",   "Land area in square miles",              "Geography",  "sq mi",        "area"),
    ("density_per_sqmi", "pop_density_per_sqmi",    "Population density per square mile",     "Population", "people/sq mi", "density"),
    ("log_density",      "pop_density_log_density", "Log population density (ln(1+density))", "Population", "log scale",    "index"),
]

# ── Helpers ───────────────────────────────────────────────────────────────────
def pnone(x):
    """pandas NA / np.nan / None → Python None."""
    try:
        if pd.isna(x):
            return None
    except (TypeError, ValueError):
        pass
    return x


def to_code_int(x):
    """1.0 → 1 (SMALLINT), None stays None."""
    x = pnone(x)
    if x is None:
        return None
    try:
        return int(float(x))
    except (ValueError, TypeError):
        return None


def hdr(msg):
    print(f"\n{'─'*60}\n  {msg}\n{'─'*60}")


def county_type_from_name(name):
    m = SUFFIX_RE.search(str(name))
    return m.group(1).title() if m else None


# ── Loaders ───────────────────────────────────────────────────────────────────
def load_states(cur, el):
    rows = [
        (r.state_abbr.strip(), r.state_name.strip())
        for r in el[["state_abbr", "state_name"]].drop_duplicates().dropna().itertuples(index=False)
    ]
    execute_values(
        cur,
        "INSERT INTO dim_state (state_abbr, state_name) VALUES %s ON CONFLICT (state_abbr) DO NOTHING",
        rows,
    )
    print(f"  states: {len(rows)}")


def load_counties(cur, el):
    seen, rows = set(), []
    for r in el.itertuples(index=False):
        fips = str(r.fips).zfill(5)
        if fips in seen:
            continue
        seen.add(fips)
        rows.append((
            fips, r.state_abbr, r.county_name,
            county_type_from_name(r.county_name),
        ))
    execute_values(
        cur,
        """INSERT INTO dim_county (fips, state_abbr, county_name, county_type)
           VALUES %s ON CONFLICT (fips) DO NOTHING""",
        rows,
    )
    print(f"  counties: {len(rows)}")
    cur.execute("SELECT fips FROM dim_county")
    return {row[0] for row in cur.fetchall()}


def load_elections_2024(cur, el, known_fips):
    cur.execute("SELECT election_id FROM dim_election WHERE election_year=2024 AND office='President'")
    eid = cur.fetchone()[0]
    cur.execute("SELECT candidate_name, candidate_id FROM dim_candidate")
    cmap = {n: i for n, i in cur.fetchall()}

    vote_rows, sum_rows = [], []
    for r in el.itertuples(index=False):
        fips = str(r.fips).zfill(5)
        if fips not in known_fips:
            continue
        for cname, votes, pct in [
            ("Trump",  r.votes_trump,  r.pct_trump),
            ("Harris", r.votes_harris, r.pct_harris),
            ("Stein",  r.votes_stein,  r.pct_stein),
        ]:
            vote_rows.append((fips, eid, cmap[cname], pnone(votes), pnone(pct), r.winner_2024 == cname))

        w = str(r.winner_2024)
        sum_rows.append((
            fips, eid, pnone(r.votes_tot), cmap.get(w), w,
            pnone(r.margin_votes), pnone(r.margin_pct), pnone(r.competitiveness_score),
        ))

    execute_values(cur,
        "INSERT INTO fact_county_candidate_votes (fips,election_id,candidate_id,votes,vote_pct,is_winner) VALUES %s ON CONFLICT DO NOTHING",
        vote_rows)
    execute_values(cur,
        """INSERT INTO fact_county_election_summary
           (fips,election_id,total_votes,winner_candidate_id,winner_name_raw,
            margin_votes,margin_pct,competitiveness_score) VALUES %s ON CONFLICT DO NOTHING""",
        sum_rows)
    print(f"  candidate_votes: {len(vote_rows)},  election_summary: {len(sum_rows)}")


def load_winner_history(cur, el, known_fips):
    cur.execute("SELECT party_id FROM dim_party WHERE party_code='DEM'")
    dem_pid = cur.fetchone()[0]
    execute_values(cur,
        "INSERT INTO dim_candidate (party_id, candidate_name) VALUES %s ON CONFLICT (candidate_name,party_id) DO NOTHING",
        [(dem_pid, "Biden"),
         (dem_pid, "Clinton")])

    cur.execute("SELECT candidate_name, candidate_id FROM dim_candidate")
    cmap = {n: i for n, i in cur.fetchall()}
    cur.execute("SELECT election_year, election_id FROM dim_election WHERE office='President'")
    emap = {yr: eid for yr, eid in cur.fetchall()}

    rows = []
    for r in el.itertuples(index=False):
        fips = str(r.fips).zfill(5)
        if fips not in known_fips:
            continue
        for yr, winner in [(2016, r.winner_2016), (2020, r.winner_2020)]:
            wn = str(winner) if pnone(winner) is not None else "Unknown"
            rows.append((fips, emap[yr], cmap.get(wn), wn))

    execute_values(cur,
        """INSERT INTO fact_county_election_summary
           (fips,election_id,winner_candidate_id,winner_name_raw)
           VALUES %s ON CONFLICT (fips,election_id) DO NOTHING""",
        rows)
    print(f"  winner history (2016/2020): {len(rows)}")


def load_indicators(cur):
    rows = []
    for _, code, name, cat, unit, vtype in DEMO_INDICATORS:
        rows.append((code, name, cat, unit, vtype))
    for _, code, name, cat, unit, vtype in POP_INDICATORS:
        rows.append((code, name, cat, unit, vtype))
    execute_values(cur,
        """INSERT INTO dim_indicator (indicator_code,indicator_name,category,unit,value_type)
           VALUES %s ON CONFLICT (indicator_code) DO NOTHING""",
        rows)
    print(f"  indicators: {len(rows)}")


def load_demographics(cur, dem, el, known_fips):
    dfips = dem.merge(
        el[["fips", "county_name", "state_abbr"]].rename(columns={"state_abbr": "state_name"}),
        on=["county_name", "state_name"],
        how="inner",
    )
    print(f"  demographics matched: {len(dfips)}/{len(dem)}")

    cur.execute("SELECT indicator_code, indicator_id FROM dim_indicator")
    imap = {c: i for c, i in cur.fetchall()}

    white_nh_candidates = [c for c in dfips.columns if "white" in c.lower() and "hispanic" in c.lower() and c != "ethnicity_white_nonhispanic_pct"]
    if white_nh_candidates and "ethnicity_white_nonhispanic_pct" not in dfips.columns:
        dfips = dfips.rename(columns={white_nh_candidates[0]: "ethnicity_white_nonhispanic_pct"})

    available_cols = set(dfips.columns)
    rows = []
    for r in dfips.itertuples(index=False):
        fips = str(r.fips).zfill(5)
        if fips not in known_fips:
            continue
        for col, code, *_ in DEMO_INDICATORS:
            if col not in available_cols:
                continue
            val = pnone(getattr(r, col, None))
            if val is None:
                continue
            iid = imap.get(code)
            if iid:
                rows.append((fips, iid, "current", float(val)))

    execute_values(cur,
        "INSERT INTO fact_county_metric (fips,indicator_id,period_label,metric_value) VALUES %s ON CONFLICT DO NOTHING",
        rows, page_size=2000)
    print(f"  demographic metrics: {len(rows)}")


def load_pop_density(cur, pop, known_fips):
    cur.execute("SELECT indicator_code, indicator_id FROM dim_indicator")
    imap = {c: i for c, i in cur.fetchall()}

    rows = []
    for r in pop.itertuples(index=False):
        fips = str(r.fips).zfill(5)
        if fips not in known_fips:
            continue
        for col, code, *_ in POP_INDICATORS:
            val = pnone(getattr(r, col, None))
            if val is None:
                continue
            iid = imap.get(code)
            if iid:
                rows.append((fips, iid, "current", float(val)))

    execute_values(cur,
        "INSERT INTO fact_county_metric (fips,indicator_id,period_label,metric_value) VALUES %s ON CONFLICT DO NOTHING",
        rows, page_size=2000)
    print(f"  pop density metrics: {len(rows)}")


def load_urban_class(cur, urban, known_fips):
    rows = []
    for r in urban.itertuples(index=False):
        fips = str(r.fips).zfill(5)
        if fips not in known_fips:
            continue
        rows.append((fips, 2003, to_code_int(r.rucc_2003), to_code_int(r.uic_2003)))
        rows.append((fips, 2013, to_code_int(r.rucc_2013), to_code_int(r.uic_2013)))

    execute_values(cur,
        """INSERT INTO fact_county_urban_class
           (fips,classification_year,rural_urban_code,urban_influence_code)
           VALUES %s ON CONFLICT DO NOTHING""",
        rows, page_size=500)
    print(f"  urban_class: {len(rows)} ({len(rows)//2} counties × 2 years)")


def load_education(cur, edu, known_fips):
    cur.execute("SELECT education_level_code, education_level_id FROM dim_education_level")
    elmap = {c: i for c, i in cur.fetchall()}

    rows = []
    for r in edu.itertuples(index=False):
        fips = str(r.fips).zfill(5)
        if fips not in known_fips:
            continue
        db_code = EDU_LEVEL_MAP.get(r.level_code)
        elid = elmap.get(db_code) if db_code else None
        if not elid:
            continue
        rows.append((fips, str(r.period), elid, pnone(r.adults_count), pnone(r.adults_pct)))

    execute_values(cur,
        """INSERT INTO fact_county_education
           (fips,period_label,education_level_id,adults_count,adults_pct)
           VALUES %s ON CONFLICT DO NOTHING""",
        rows, page_size=2000)
    print(f"  education: {len(rows)}")


def load_religion(cur, rel, known_fips):
    groups = rel[["group_code", "group_name"]].drop_duplicates("group_code")
    group_rows = [
        (str(r.group_code), str(r.group_name))
        for r in groups.itertuples(index=False)
    ]
    execute_values(cur,
        "INSERT INTO dim_religious_group (group_code,group_name) VALUES %s ON CONFLICT (group_code) DO NOTHING",
        group_rows)
    print(f"  religious groups: {len(group_rows)}")

    rows = []
    for r in rel.itertuples(index=False):
        fips = str(r.fips).zfill(5)
        if fips not in known_fips:
            continue
        rows.append((
            fips, str(r.group_code),
            pnone(r.congregations), pnone(r.adherents),
            pnone(r.adherents_pct_total_adherents),
            pnone(r.adherents_pct_total_population),
        ))

    execute_values(cur,
        """INSERT INTO fact_county_religion
           (fips,group_code,congregations,adherents,pct_total_adherents,pct_total_population)
           VALUES %s ON CONFLICT DO NOTHING""",
        rows, page_size=2000)
    print(f"  religion: {len(rows)}")


# ── Test queries ──────────────────────────────────────────────────────────────
QUERIES = [
    ("Q1 · Row counts per table", """
        SELECT 'dim_state'                    AS tbl, COUNT(*) AS n FROM dim_state              UNION ALL
        SELECT 'dim_county',                               COUNT(*) FROM dim_county              UNION ALL
        SELECT 'dim_rucc_code',                            COUNT(*) FROM dim_rucc_code           UNION ALL
        SELECT 'dim_uic_code',                             COUNT(*) FROM dim_uic_code            UNION ALL
        SELECT 'fact_county_candidate_votes',              COUNT(*) FROM fact_county_candidate_votes UNION ALL
        SELECT 'fact_county_election_summary',             COUNT(*) FROM fact_county_election_summary UNION ALL
        SELECT 'fact_county_metric',                       COUNT(*) FROM fact_county_metric      UNION ALL
        SELECT 'fact_county_urban_class',                  COUNT(*) FROM fact_county_urban_class UNION ALL
        SELECT 'fact_county_education',                    COUNT(*) FROM fact_county_education   UNION ALL
        SELECT 'fact_county_religion',                     COUNT(*) FROM fact_county_religion
        ORDER BY 1"""),

    ("Q2 · 2024 national vote totals by candidate", """
        SELECT c.candidate_name,
               SUM(v.votes) AS total_votes,
               ROUND(AVG(v.vote_pct)::numeric, 2) AS avg_county_pct
        FROM fact_county_candidate_votes v
        JOIN dim_candidate c ON c.candidate_id = v.candidate_id
        JOIN dim_election  e ON e.election_id  = v.election_id AND e.election_year = 2024
        GROUP BY c.candidate_name ORDER BY total_votes DESC"""),

    ("Q3 · Top 5 most competitive counties (2024)", """
        SELECT dc.county_name, ds.state_abbr,
               ROUND(es.competitiveness_score::numeric, 2) AS comp_score,
               ROUND(es.margin_pct::numeric, 2) AS margin_pct
        FROM fact_county_election_summary es
        JOIN dim_county   dc ON dc.fips = es.fips
        JOIN dim_state    ds ON ds.state_abbr = dc.state_abbr
        JOIN dim_election e  ON e.election_id  = es.election_id AND e.election_year = 2024
        ORDER BY es.competitiveness_score DESC LIMIT 5"""),

    ("Q4 · 2024 county count won by each candidate", """
        SELECT es.winner_name_raw, COUNT(*) AS counties_won
        FROM fact_county_election_summary es
        JOIN dim_election e ON e.election_id = es.election_id AND e.election_year = 2024
        GROUP BY es.winner_name_raw ORDER BY counties_won DESC"""),

    ("Q5 · Counties that flipped party 2016 → 2024", """
        SELECT COUNT(*) AS flipped
        FROM fact_county_election_summary h16
        JOIN fact_county_election_summary h24 ON h24.fips = h16.fips
        JOIN dim_election e16 ON e16.election_id = h16.election_id AND e16.election_year = 2016
        JOIN dim_election e24 ON e24.election_id = h24.election_id AND e24.election_year = 2024
        WHERE h16.winner_name_raw <> h24.winner_name_raw
          AND h16.winner_name_raw NOT IN ('Unknown')
          AND h24.winner_name_raw NOT IN ('Unknown')"""),

    ("Q6 · Top 5 religions by national adherent count", """
        SELECT rg.group_name, SUM(fr.adherents) AS total_adherents
        FROM fact_county_religion fr
        JOIN dim_religious_group rg ON rg.group_code = fr.group_code
        GROUP BY rg.group_name ORDER BY total_adherents DESC LIMIT 5"""),

    ("Q7 · Avg bachelor's degree pct trend by decade", """
        SELECT fe.period_label, ROUND(AVG(fe.adults_pct)::numeric, 2) AS avg_pct
        FROM fact_county_education fe
        JOIN dim_education_level el ON el.education_level_id = fe.education_level_id
          AND el.education_level_code = 'bachelors_or_higher'
        GROUP BY fe.period_label ORDER BY fe.period_label"""),

    ("Q8 · Rural-urban code vs avg Trump 2024 vote %", """
        SELECT uc.rural_urban_code, COUNT(DISTINCT uc.fips) AS counties,
               ROUND(AVG(v.vote_pct)::numeric, 2) AS avg_trump_pct
        FROM fact_county_urban_class uc
        JOIN fact_county_candidate_votes v ON v.fips = uc.fips
        JOIN dim_candidate c ON c.candidate_id = v.candidate_id AND c.candidate_name = 'Trump'
        JOIN dim_election  e ON e.election_id  = v.election_id  AND e.election_year  = 2024
        WHERE uc.classification_year = 2013 AND uc.rural_urban_code IS NOT NULL
        GROUP BY uc.rural_urban_code ORDER BY avg_trump_pct DESC"""),

    ("Q9 · Median income by 2024 winner", """
        SELECT es.winner_name_raw,
               ROUND(AVG(fm.metric_value)::numeric) AS avg_median_income,
               COUNT(*) AS counties
        FROM fact_county_election_summary es
        JOIN dim_election  e  ON e.election_id  = es.election_id AND e.election_year = 2024
        JOIN fact_county_metric fm ON fm.fips = es.fips
        JOIN dim_indicator di ON di.indicator_id = fm.indicator_id
          AND di.indicator_code = 'income_median_household'
        GROUP BY es.winner_name_raw ORDER BY avg_median_income DESC"""),

    ("Q10 · vw_county_election_2024 – 5 closest margins", """
        SELECT fips, county_name, state_abbr, winner_name_raw,
               ROUND(pct_trump::numeric,  1) AS pct_trump,
               ROUND(pct_harris::numeric, 1) AS pct_harris,
               ROUND(margin_pct::numeric, 2) AS margin_pct
        FROM vw_county_election_2024 ORDER BY margin_pct LIMIT 5"""),
]


def run_test_queries(cur):
    hdr("TEST QUERIES")
    for label, sql in QUERIES:
        print(f"\n  {label}")
        try:
            cur.execute(sql)
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            w = max(len(c) for c in cols) + 2
            w = max(w, 20)
            header = " | ".join(f"{c:<{w}}" for c in cols)
            print(f"  {header}")
            print(f"  {'─' * len(header)}")
            for row in rows:
                vals = []
                for v in row:
                    s = str(v) if v is not None else "NULL"
                    vals.append(f"{s:<{w}}")
                print("  " + " | ".join(vals))
        except Exception as exc:
            print(f"  ERROR: {exc}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    hdr("Loading CSVs")
    el    = pd.read_csv(f"{CLEANED}/elections_clean.csv",          dtype={"fips": str})
    dem   = pd.read_csv(f"{CLEANED}/demographics_clean.csv")
    pop   = pd.read_csv(f"{CLEANED}/population_density_clean.csv", dtype={"fips": str})
    urban = pd.read_csv(f"{CLEANED}/urban_class_clean.csv",        dtype={"fips": str})
    edu   = pd.read_csv(f"{CLEANED}/education_clean.csv",          dtype={"fips": str})
    rel   = pd.read_csv(f"{CLEANED}/religion_clean.csv",           dtype={"fips": str}, low_memory=False)
    print(f"  el={len(el)}  dem={len(dem)}  pop={len(pop)}  urban={len(urban)}  edu={len(edu)}  rel={len(rel)}")

    hdr("Connecting")
    conn = psycopg2.connect(DSN)
    conn.autocommit = False
    cur  = conn.cursor()
    print(f"  {DSN.split('@')[-1]}")

    try:
        hdr("dim_state");         load_states(cur, el);                            conn.commit()
        hdr("dim_county");        known = load_counties(cur, el);                  conn.commit()
        hdr("Elections 2024");    load_elections_2024(cur, el, known);             conn.commit()
        hdr("Winner history");    load_winner_history(cur, el, known);             conn.commit()
        hdr("dim_indicator");     load_indicators(cur);                            conn.commit()
        hdr("Demographics");      load_demographics(cur, dem, el, known);          conn.commit()
        hdr("Pop density");       load_pop_density(cur, pop, known);               conn.commit()
        hdr("Urban class");       load_urban_class(cur, urban, known);             conn.commit()
        hdr("Education");         load_education(cur, edu, known);                 conn.commit()
        hdr("Religion");          load_religion(cur, rel, known);                  conn.commit()

        run_test_queries(cur)
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

    print("\n  ETL complete.\n")


if __name__ == "__main__":
    main()
