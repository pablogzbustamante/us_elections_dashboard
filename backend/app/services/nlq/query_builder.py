"""
Builds a safe parameterized SQL query from a validated StructuredQuery.
All user input goes through :param bindings - no string interpolation of values.
"""
from typing import Tuple
from .schema import StructuredQuery

# ── Base CTE ──────────────────────────────────────────────────────────────────

_BASE_CTE = """
WITH election_24 AS (
    SELECT
        c.fips,
        c.county_name,
        c.state_abbr,
        s.state_name,
        es.total_votes,
        es.winner_name_raw                                                          AS winner_2024,
        es.margin_pct                                                               AS margin_2024,
        es.competitiveness_score,
        MAX(v.vote_pct) FILTER (WHERE LOWER(cand.candidate_name) LIKE '%trump%')   AS trump_pct,
        MAX(v.vote_pct) FILTER (WHERE LOWER(cand.candidate_name) LIKE '%harris%')  AS harris_pct,
        MAX(v.votes)    FILTER (WHERE LOWER(cand.candidate_name) LIKE '%trump%')   AS votes_trump,
        MAX(v.votes)    FILTER (WHERE LOWER(cand.candidate_name) LIKE '%harris%')  AS votes_harris
    FROM dim_county c
    JOIN dim_state s ON s.state_abbr = c.state_abbr
    JOIN dim_election e ON e.election_year = 2024 AND e.office = 'President'
    LEFT JOIN fact_county_election_summary es
        ON es.fips = c.fips AND es.election_id = e.election_id
    LEFT JOIN fact_county_candidate_votes v
        ON v.fips = c.fips AND v.election_id = e.election_id
    LEFT JOIN dim_candidate cand ON cand.candidate_id = v.candidate_id
    GROUP BY c.fips, c.county_name, c.state_abbr, s.state_name,
             es.total_votes, es.winner_name_raw, es.margin_pct, es.competitiveness_score
),
election_20 AS (
    SELECT
        c.fips,
        es20.winner_name_raw AS winner_2020,
        es20.margin_pct      AS margin_2020,
        MAX(v.vote_pct) FILTER (WHERE LOWER(cand.candidate_name) LIKE '%trump%') AS trump_pct_2020,
        MAX(v.vote_pct) FILTER (WHERE LOWER(cand.candidate_name) LIKE '%biden%') AS biden_pct_2020
    FROM dim_county c
    JOIN dim_election e ON e.election_year = 2020 AND e.office = 'President'
    LEFT JOIN fact_county_election_summary es20
        ON es20.fips = c.fips AND es20.election_id = e.election_id
    LEFT JOIN fact_county_candidate_votes v
        ON v.fips = c.fips AND v.election_id = e.election_id
    LEFT JOIN dim_candidate cand ON cand.candidate_id = v.candidate_id
    GROUP BY c.fips, es20.winner_name_raw, es20.margin_pct
),
metrics AS (
    SELECT
        m.fips,
        MAX(CASE WHEN i.indicator_code = 'income_median_household'   THEN m.metric_value END) AS median_household_income,
        MAX(CASE WHEN i.indicator_code = 'income_per_capita'         THEN m.metric_value END) AS per_capita_income,
        MAX(CASE WHEN i.indicator_code = 'ethnicity_hispanic_pct'    THEN m.metric_value END) AS hispanic_or_latino,
        MAX(CASE WHEN i.indicator_code = 'ethnicity_white_nh_pct'    THEN m.metric_value END) AS white_alone,
        MAX(CASE WHEN i.indicator_code = 'ethnicity_black_pct'       THEN m.metric_value END) AS black_alone,
        MAX(CASE WHEN i.indicator_code = 'ethnicity_asian_pct'       THEN m.metric_value END) AS asian_alone,
        MAX(CASE WHEN i.indicator_code = 'ethnicity_native_pct'      THEN m.metric_value END) AS american_indian_alaska_native,
        MAX(CASE WHEN i.indicator_code = 'ethnicity_pi_pct'          THEN m.metric_value END) AS native_hawaiian_pacific_islander,
        MAX(CASE WHEN i.indicator_code = 'ethnicity_two_or_more_pct' THEN m.metric_value END) AS two_or_more_races,
        MAX(CASE WHEN i.indicator_code = 'misc_foreign_born_pct'     THEN m.metric_value END) AS foreign_born,
        MAX(CASE WHEN i.indicator_code = 'population_2020'           THEN m.metric_value END) AS population,
        MAX(CASE WHEN i.indicator_code = 'pop_density_per_sqmi'      THEN m.metric_value END) AS population_density,
        MAX(CASE WHEN i.indicator_code = 'age_pct_65_older'          THEN m.metric_value END) AS age_65_plus,
        MAX(CASE WHEN i.indicator_code = 'age_pct_under_18'          THEN m.metric_value END) AS age_under_18,
        MAX(CASE WHEN i.indicator_code = 'age_pct_under_5'           THEN m.metric_value END) AS age_under_5,
        MAX(CASE WHEN i.indicator_code = 'housing_homeownership_pct' THEN m.metric_value END) AS homeownership_rate,
        MAX(CASE WHEN i.indicator_code = 'housing_median_value'      THEN m.metric_value END) AS median_home_value,
        MAX(CASE WHEN i.indicator_code = 'housing_households'        THEN m.metric_value END) AS households,
        MAX(CASE WHEN i.indicator_code = 'housing_units'             THEN m.metric_value END) AS housing_units,
        MAX(CASE WHEN i.indicator_code = 'edu_bachelors_pct'         THEN m.metric_value END) AS bachelor_degree_or_higher,
        MAX(CASE WHEN i.indicator_code = 'edu_hs_or_higher_pct'      THEN m.metric_value END) AS high_school_or_higher,
        MAX(CASE WHEN i.indicator_code = 'misc_mean_travel_time_min' THEN m.metric_value END) AS mean_travel_time,
        MAX(CASE WHEN i.indicator_code = 'misc_pct_female'           THEN m.metric_value END) AS percent_female,
        MAX(CASE WHEN i.indicator_code = 'misc_veterans'             THEN m.metric_value END) AS veterans,
        MAX(CASE WHEN i.indicator_code = 'misc_lang_noneng_pct'      THEN m.metric_value END) AS language_noneng
    FROM fact_county_metric m
    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
    WHERE m.period_label = 'current'
    GROUP BY m.fips
),
religion AS (
    SELECT
        r.fips,
        COALESCE(SUM(r.pct_total_population), 0) AS religious_adherence
    FROM fact_county_religion r
    GROUP BY r.fips
),
flat AS (
    SELECT
        e24.fips,
        e24.county_name,
        e24.state_abbr,
        e24.state_name,
        e24.total_votes,
        e24.winner_2024,
        e24.trump_pct,
        e24.harris_pct,
        e24.votes_trump,
        e24.votes_harris,
        e24.margin_2024,
        e24.competitiveness_score,
        e20.winner_2020,
        e20.trump_pct_2020,
        e20.biden_pct_2020,
        e20.margin_2020,
        (COALESCE(e24.trump_pct, 0) - COALESCE(e20.trump_pct_2020, 0)) AS swing_2020_2024,
        m.median_household_income,
        m.per_capita_income,
        m.hispanic_or_latino,
        m.white_alone,
        m.black_alone,
        m.asian_alone,
        m.american_indian_alaska_native,
        m.native_hawaiian_pacific_islander,
        m.two_or_more_races,
        m.foreign_born,
        m.population,
        m.population_density,
        m.age_65_plus,
        m.age_under_18,
        m.age_under_5,
        m.homeownership_rate,
        m.median_home_value,
        m.households,
        m.housing_units,
        m.bachelor_degree_or_higher,
        m.high_school_or_higher,
        m.mean_travel_time,
        m.percent_female,
        m.veterans,
        m.language_noneng,
        r.religious_adherence,
        GREATEST(0.0, 100.0 - COALESCE(e24.margin_2024, 50) * 2)       AS opportunity_score,
        COALESCE(e24.margin_2024, 50)                                    AS risk_score,
        GREATEST(0.0, 100.0 - COALESCE(e24.margin_2024, 50) * 2) * 0.4
            + LEAST(COALESCE(e24.total_votes, 0) / 500000.0, 1.0) * 30
            + GREATEST(0.0, 50.0 - COALESCE(e24.margin_2024, 50))       AS priority_score,
        CASE
            WHEN COALESCE(e24.margin_2024, 50) <= 2   THEN 'Invest'
            WHEN COALESCE(e24.margin_2024, 50) <= 5   THEN 'Persuade'
            WHEN COALESCE(e24.margin_2024, 50) <= 10
                 AND LOWER(COALESCE(e24.winner_2024,'')) LIKE '%trump%'  THEN 'Defend'
            WHEN COALESCE(e24.margin_2024, 50) <= 10  THEN 'Persuade'
            WHEN LOWER(COALESCE(e24.winner_2024,'')) LIKE '%trump%'      THEN 'Monitor'
            ELSE 'Low Priority'
        END AS recommended_action
    FROM election_24 e24
    LEFT JOIN election_20 e20 ON e24.fips = e20.fips
    LEFT JOIN metrics m       ON e24.fips = m.fips
    LEFT JOIN religion r      ON e24.fips = r.fips
)
"""

# ── Filter clause builder ─────────────────────────────────────────────────────

def _filter_clause(filters, params: dict) -> str:
    parts = []
    for idx, f in enumerate(filters):
        col = f.field  # column alias in `flat` CTE
        pname = f"f{idx}"

        op = f.operator

        # winner fields: case-insensitive substring match
        if f.field in ("winner_2024", "winner_2020") and op == "=":
            parts.append(f"LOWER({col}) LIKE LOWER(:{pname})")
            params[pname] = f"%{f.value}%"

        elif op == "=":
            parts.append(f"{col} = :{pname}")
            params[pname] = f.value

        elif op == "!=":
            parts.append(f"{col} != :{pname}")
            params[pname] = f.value

        elif op == ">":
            parts.append(f"{col} > :{pname}")
            params[pname] = f.value

        elif op == ">=":
            parts.append(f"{col} >= :{pname}")
            params[pname] = f.value

        elif op == "<":
            parts.append(f"{col} < :{pname}")
            params[pname] = f.value

        elif op == "<=":
            parts.append(f"{col} <= :{pname}")
            params[pname] = f.value

        elif op == "between":
            parts.append(f"{col} BETWEEN :{pname}_lo AND :{pname}_hi")
            params[f"{pname}_lo"] = f.value[0]
            params[f"{pname}_hi"] = f.value[1]

        elif op == "contains":
            parts.append(f"{col} ILIKE :{pname}")
            params[pname] = f"%{f.value}%"

    return " AND ".join(parts) if parts else None


def _geo_clause(geography, params: dict) -> str | None:
    parts = []
    if geography.states:
        placeholders = [f":gs{i}" for i in range(len(geography.states))]
        for i, s in enumerate(geography.states):
            params[f"gs{i}"] = s.upper()
        parts.append(f"state_abbr IN ({', '.join(placeholders)})")
    if geography.counties:
        placeholders = [f":gc{i}" for i in range(len(geography.counties))]
        for i, c in enumerate(geography.counties):
            params[f"gc{i}"] = c
        parts.append(f"county_name ILIKE ANY(ARRAY[{', '.join(placeholders)}])")
    return " AND ".join(parts) if parts else None


def _sort_clause(sort, default_col: str = "priority_score") -> str:
    if not sort:
        return f"{default_col} DESC NULLS LAST"
    col = sort.field
    direction = "ASC" if sort.direction == "asc" else "DESC"
    return f"{col} {direction} NULLS LAST"


# ── Public API ────────────────────────────────────────────────────────────────

def build_query(query: StructuredQuery) -> Tuple[str, dict]:
    """Return (sql, params) ready for SQLAlchemy text()."""
    params: dict = {"lim": query.limit}

    where_parts = []

    geo = _geo_clause(query.geography, params)
    if geo:
        where_parts.append(geo)

    flt = _filter_clause(query.filters, params)
    if flt:
        where_parts.append(flt)

    # For rank_campaign_priorities, require non-null election data
    if query.intent == "rank_campaign_priorities":
        where_parts.append("margin_2024 IS NOT NULL")

    where_sql = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    # Default sort by intent
    default_sort = {
        "rank_campaign_priorities": "priority_score",
        "search_counties": "margin_2024",
        "compare_regions": "state_abbr",
    }.get(query.intent, "priority_score")

    order_sql = "ORDER BY " + _sort_clause(query.sort, default_sort)

    sql = f"{_BASE_CTE} SELECT * FROM flat {where_sql} {order_sql} LIMIT :lim"
    return sql, params
