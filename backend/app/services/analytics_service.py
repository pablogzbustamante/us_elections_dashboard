from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models.dimensions import DimIndicator, DimEducationLevel, DimReligiousGroup
from app.models.facts import (
    FactCountyMetric,
    FactCountyEducation,
    FactCountyReligion,
)


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_demographics(self, fips: str, period: str | None = None):
        stmt = (
            select(
                FactCountyMetric.fips,
                DimIndicator.indicator_code,
                DimIndicator.indicator_name,
                DimIndicator.category,
                DimIndicator.unit,
                FactCountyMetric.period_label,
                FactCountyMetric.metric_value,
            )
            .join(DimIndicator, FactCountyMetric.indicator_id == DimIndicator.indicator_id)
            .where(FactCountyMetric.fips == fips)
            .order_by(DimIndicator.category, DimIndicator.indicator_name)
        )
        if period:
            stmt = stmt.where(FactCountyMetric.period_label == period)
        result = await self.db.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def get_education(self, fips: str, period: str | None = None):
        stmt = (
            select(
                FactCountyEducation.fips,
                FactCountyEducation.period_label,
                DimEducationLevel.education_level_code,
                DimEducationLevel.education_level_name,
                DimEducationLevel.level_order,
                FactCountyEducation.adults_count,
                FactCountyEducation.adults_pct,
            )
            .join(
                DimEducationLevel,
                FactCountyEducation.education_level_id == DimEducationLevel.education_level_id,
            )
            .where(FactCountyEducation.fips == fips)
            .order_by(FactCountyEducation.period_label, DimEducationLevel.level_order)
        )
        if period:
            stmt = stmt.where(FactCountyEducation.period_label == period)
        result = await self.db.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def get_religion(self, fips: str):
        result = await self.db.execute(
            select(
                FactCountyReligion.fips,
                DimReligiousGroup.group_code,
                DimReligiousGroup.group_name,
                FactCountyReligion.congregations,
                FactCountyReligion.adherents,
                FactCountyReligion.pct_total_population,
            )
            .join(DimReligiousGroup, FactCountyReligion.group_code == DimReligiousGroup.group_code)
            .where(FactCountyReligion.fips == fips)
            .order_by(FactCountyReligion.adherents.desc())
        )
        return [dict(r) for r in result.mappings().all()]

    async def get_correlation(self, indicator_code: str, election_id: int):
        """Pearson correlation between a demographic indicator and county vote margin."""
        result = await self.db.execute(
            text("""
                SELECT
                    corr(m.metric_value, s.margin_pct) AS correlation,
                    COUNT(*)                            AS sample_size
                FROM fact_county_metric m
                JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                JOIN fact_county_election_summary s ON m.fips = s.fips
                WHERE i.indicator_code = :indicator_code
                  AND s.election_id   = :election_id
                  AND m.metric_value  IS NOT NULL
                  AND s.margin_pct    IS NOT NULL
            """),
            {"indicator_code": indicator_code, "election_id": election_id},
        )
        row = dict(result.mappings().one())

        scatter_result = await self.db.execute(
            text("""
                SELECT
                    m.fips,
                    m.metric_value,
                    s.margin_pct,
                    s.competitiveness_score
                FROM fact_county_metric m
                JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                JOIN fact_county_election_summary s ON m.fips = s.fips
                WHERE i.indicator_code = :indicator_code
                  AND s.election_id   = :election_id
                  AND m.metric_value  IS NOT NULL
                  AND s.margin_pct    IS NOT NULL
                ORDER BY m.fips
            """),
            {"indicator_code": indicator_code, "election_id": election_id},
        )
        data = [dict(r) for r in scatter_result.mappings().all()]

        return {
            "indicator_code": indicator_code,
            "election_id": election_id,
            "correlation": float(row["correlation"]) if row["correlation"] is not None else None,
            "sample_size": row["sample_size"],
            "data": data,
        }

    async def get_education_county_summary(self, election_id: int):
        result = await self.db.execute(
            text("""
                SELECT
                    c.fips,
                    c.county_name,
                    c.state_abbr,
                    MAX(CASE WHEN dl.education_level_code = 'bachelors_or_higher'      THEN fe.adults_pct END) AS pct_bachelors,
                    MAX(CASE WHEN dl.education_level_code = 'high_school_only'         THEN fe.adults_pct END) AS pct_hs_only,
                    MAX(CASE WHEN dl.education_level_code = 'some_college_or_associate' THEN fe.adults_pct END) AS pct_some_college,
                    MAX(CASE WHEN dl.education_level_code = 'less_than_high_school'    THEN fe.adults_pct END) AS pct_less_than_hs,
                    s.margin_pct,
                    s.competitiveness_score,
                    s.total_votes,
                    s.winner_name_raw
                FROM dim_county c
                JOIN fact_county_education fe ON c.fips = fe.fips
                JOIN dim_education_level dl   ON fe.education_level_id = dl.education_level_id
                LEFT JOIN fact_county_election_summary s
                    ON c.fips = s.fips AND s.election_id = :election_id
                WHERE fe.period_label = '2015-19'
                GROUP BY
                    c.fips, c.county_name, c.state_abbr,
                    s.margin_pct, s.competitiveness_score, s.total_votes, s.winner_name_raw
                ORDER BY c.state_abbr, c.county_name
            """),
            {"election_id": election_id},
        )
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            ba = float(r["pct_bachelors"] or 0)
            hs = float(r["pct_hs_only"] or 0)
            sc = float(r["pct_some_college"] or 0)
            r["pct_bachelors"] = round(ba, 4)
            r["pct_hs_or_higher"] = round(ba + hs + sc, 4)
        return rows

    async def get_age_county_summary(self, election_id: int):
        result = await self.db.execute(
            text("""
                SELECT
                    c.fips,
                    c.county_name,
                    c.state_abbr,
                    MAX(CASE WHEN i.indicator_code = 'age_pct_under_18' THEN m.metric_value END) AS pct_under_18,
                    MAX(CASE WHEN i.indicator_code = 'age_pct_65_older' THEN m.metric_value END) AS pct_65_older,
                    s.total_votes
                FROM dim_county c
                JOIN fact_county_metric m ON c.fips = m.fips
                JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                LEFT JOIN fact_county_election_summary s
                    ON c.fips = s.fips AND s.election_id = :election_id
                WHERE i.category = 'Age'
                  AND m.period_label = 'current'
                GROUP BY c.fips, c.county_name, c.state_abbr, s.total_votes
                ORDER BY c.state_abbr, c.county_name
            """),
            {"election_id": election_id},
        )
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            u18 = float(r["pct_under_18"] or 0)
            o65 = float(r["pct_65_older"] or 0)
            r["pct_under_18"] = round(u18, 4)
            r["pct_65_older"] = round(o65, 4)
            r["pct_18_64"]    = round(max(0.0, 100.0 - u18 - o65), 4)
            r["total_votes"]  = int(r["total_votes"] or 0)
        return rows

    async def get_ethnicity_county_summary(self, election_id: int):
        result = await self.db.execute(
            text("""
                SELECT
                    c.fips,
                    c.county_name,
                    c.state_abbr,
                    MAX(CASE WHEN i.indicator_code = 'ethnicity_white_nh_pct'    THEN m.metric_value END) AS pct_white,
                    MAX(CASE WHEN i.indicator_code = 'ethnicity_hispanic_pct'    THEN m.metric_value END) AS pct_hispanic,
                    MAX(CASE WHEN i.indicator_code = 'ethnicity_black_pct'       THEN m.metric_value END) AS pct_black,
                    MAX(CASE WHEN i.indicator_code = 'ethnicity_asian_pct'       THEN m.metric_value END) AS pct_asian,
                    MAX(CASE WHEN i.indicator_code = 'ethnicity_native_pct'      THEN m.metric_value END) AS pct_native,
                    MAX(CASE WHEN i.indicator_code = 'ethnicity_pi_pct'          THEN m.metric_value END) AS pct_pi,
                    MAX(CASE WHEN i.indicator_code = 'ethnicity_two_or_more_pct' THEN m.metric_value END) AS pct_two_or_more,
                    s.margin_pct,
                    s.competitiveness_score,
                    s.total_votes
                FROM dim_county c
                JOIN fact_county_metric m ON c.fips = m.fips
                JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                LEFT JOIN fact_county_election_summary s
                    ON c.fips = s.fips AND s.election_id = :election_id
                WHERE i.category = 'Ethnicity'
                  AND m.period_label = 'current'
                GROUP BY
                    c.fips, c.county_name, c.state_abbr,
                    s.margin_pct, s.competitiveness_score, s.total_votes
                ORDER BY c.state_abbr, c.county_name
            """),
            {"election_id": election_id},
        )
        rows = [dict(r) for r in result.mappings().all()]
        eth_keys = ["pct_white", "pct_hispanic", "pct_black", "pct_asian", "pct_native", "pct_pi", "pct_two_or_more"]
        for r in rows:
            for k in eth_keys:
                r[k] = round(float(r[k] or 0), 4)
        return rows

    async def get_income_quintiles(self, election_id: int, state: str | None = None):
        state_clause = "AND c.state_abbr = :state" if state else ""
        params: dict = {"election_id": election_id}
        if state:
            params["state"] = state
        result = await self.db.execute(
            text(f"""
                WITH income_data AS (
                    SELECT
                        m.fips,
                        m.metric_value                                   AS income,
                        NTILE(5) OVER (ORDER BY m.metric_value)          AS quintile
                    FROM fact_county_metric m
                    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                    JOIN dim_county c    ON m.fips = c.fips
                    WHERE i.indicator_code = 'income_median_household'
                      AND m.period_label   = 'current'
                      AND m.metric_value   IS NOT NULL
                      {state_clause}
                ),
                candidate_pcts AS (
                    SELECT
                        v.fips,
                        MAX(CASE WHEN LOWER(cand.candidate_name) LIKE '%trump%'  THEN v.vote_pct END) AS pct_trump,
                        MAX(CASE WHEN LOWER(cand.candidate_name) LIKE '%harris%' THEN v.vote_pct END) AS pct_harris
                    FROM fact_county_candidate_votes v
                    JOIN dim_candidate cand ON v.candidate_id = cand.candidate_id
                    WHERE v.election_id = :election_id
                    GROUP BY v.fips
                )
                SELECT
                    id.quintile,
                    ROUND(MIN(id.income))                        AS income_min,
                    ROUND(MAX(id.income))                        AS income_max,
                    ROUND(AVG(id.income))                        AS income_avg,
                    ROUND(AVG(cp.pct_trump)::numeric,  2)        AS avg_pct_trump,
                    ROUND(AVG(cp.pct_harris)::numeric, 2)        AS avg_pct_harris,
                    COUNT(*)                                     AS county_count
                FROM income_data id
                JOIN candidate_pcts cp ON id.fips = cp.fips
                WHERE cp.pct_trump IS NOT NULL AND cp.pct_harris IS NOT NULL
                GROUP BY id.quintile
                ORDER BY id.quintile
            """),
            params,
        )
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            r["avg_pct_trump"]  = float(r["avg_pct_trump"]  or 0)
            r["avg_pct_harris"] = float(r["avg_pct_harris"] or 0)
            r["income_min"]     = int(r["income_min"] or 0)
            r["income_max"]     = int(r["income_max"] or 0)
            r["income_avg"]     = int(r["income_avg"] or 0)
            r["county_count"]   = int(r["county_count"] or 0)
        return rows

    async def get_inequality_proxy(self, election_id: int, state: str | None = None, limit: int = 20):
        state_clause = "AND c.state_abbr = :state" if state else ""
        params: dict = {"election_id": election_id, "limit": limit}
        if state:
            params["state"] = state
        result = await self.db.execute(
            text(f"""
                WITH pivoted AS (
                    SELECT
                        m.fips,
                        MAX(CASE WHEN i.indicator_code = 'income_median_household' THEN m.metric_value END) AS income,
                        MAX(CASE WHEN i.indicator_code = 'income_per_capita'       THEN m.metric_value END) AS per_capita
                    FROM fact_county_metric m
                    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                    WHERE i.indicator_code IN ('income_median_household', 'income_per_capita')
                      AND m.period_label = 'current'
                    GROUP BY m.fips
                )
                SELECT
                    c.fips,
                    c.county_name,
                    c.state_abbr,
                    ROUND(p.income)                        AS income,
                    ROUND(p.per_capita)                    AS per_capita,
                    ROUND(p.income - p.per_capita)         AS inequality_proxy,
                    s.winner_name_raw,
                    s.margin_pct,
                    s.competitiveness_score,
                    s.total_votes
                FROM pivoted p
                JOIN dim_county c ON p.fips = c.fips
                LEFT JOIN fact_county_election_summary s
                    ON c.fips = s.fips AND s.election_id = :election_id
                WHERE p.income IS NOT NULL AND p.per_capita IS NOT NULL
                  {state_clause}
                ORDER BY (p.income - p.per_capita) DESC
                LIMIT :limit
            """),
            params,
        )
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            r["income"]            = int(r["income"] or 0)
            r["per_capita"]        = int(r["per_capita"] or 0)
            r["inequality_proxy"]  = int(r["inequality_proxy"] or 0)
            r["margin_pct"]        = round(float(r["margin_pct"] or 0), 2)
            r["competitiveness_score"] = round(float(r["competitiveness_score"] or 0), 2)
            r["total_votes"]       = int(r["total_votes"] or 0)
        return rows

    async def get_income_population(self, election_id: int, state: str | None = None):
        state_clause = "AND c.state_abbr = :state" if state else ""
        params: dict = {"election_id": election_id}
        if state:
            params["state"] = state
        result = await self.db.execute(
            text(f"""
                WITH thresholds AS (
                    SELECT
                        PERCENTILE_CONT(0.30) WITHIN GROUP (ORDER BY m.metric_value) AS p30,
                        PERCENTILE_CONT(0.70) WITHIN GROUP (ORDER BY m.metric_value) AS p70
                    FROM fact_county_metric m
                    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                    WHERE i.indicator_code = 'income_median_household'
                      AND m.period_label   = 'current'
                      AND m.metric_value   IS NOT NULL
                ),
                pivoted AS (
                    SELECT
                        m.fips,
                        MAX(CASE WHEN i.indicator_code = 'income_median_household' THEN m.metric_value END) AS income,
                        MAX(CASE WHEN i.indicator_code = 'population_2020'         THEN m.metric_value END) AS population
                    FROM fact_county_metric m
                    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                    WHERE i.indicator_code IN ('income_median_household', 'population_2020')
                      AND m.period_label = 'current'
                    GROUP BY m.fips
                )
                SELECT
                    c.fips,
                    c.county_name,
                    c.state_abbr,
                    ROUND(p.income)      AS income,
                    ROUND(p.population)  AS population,
                    CASE
                        WHEN p.income <  t.p30 THEN 'Low Income'
                        WHEN p.income <= t.p70 THEN 'Middle Income'
                        ELSE                        'High Income'
                    END                  AS segment,
                    s.winner_name_raw,
                    s.margin_pct,
                    s.total_votes
                FROM pivoted p
                JOIN dim_county c   ON p.fips = c.fips
                CROSS JOIN thresholds t
                LEFT JOIN fact_county_election_summary s
                    ON c.fips = s.fips AND s.election_id = :election_id
                WHERE p.income IS NOT NULL AND p.population IS NOT NULL
                  {state_clause}
                ORDER BY p.population DESC
            """),
            params,
        )
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            r["income"]     = int(r["income"] or 0)
            r["population"] = int(r["population"] or 0)
            r["margin_pct"] = round(float(r["margin_pct"] or 0), 2)
            r["total_votes"]= int(r["total_votes"] or 0)
        return rows

    async def get_income_segments(self, election_id: int, state: str | None = None):
        state_clause = "AND c.state_abbr = :state" if state else ""
        params: dict = {"election_id": election_id}
        if state:
            params["state"] = state
        result = await self.db.execute(
            text(f"""
                WITH income_thresholds AS (
                    SELECT
                        PERCENTILE_CONT(0.30) WITHIN GROUP (ORDER BY m.metric_value) AS p30,
                        PERCENTILE_CONT(0.70) WITHIN GROUP (ORDER BY m.metric_value) AS p70
                    FROM fact_county_metric m
                    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                    WHERE i.indicator_code = 'income_median_household'
                      AND m.period_label   = 'current'
                      AND m.metric_value   IS NOT NULL
                ),
                segmented AS (
                    SELECT
                        c.fips,
                        m.metric_value AS income,
                        CASE
                            WHEN m.metric_value <  t.p30 THEN 'Low Income'
                            WHEN m.metric_value <= t.p70 THEN 'Middle Income'
                            ELSE                              'High Income'
                        END AS segment,
                        CASE
                            WHEN m.metric_value <  t.p30 THEN 1
                            WHEN m.metric_value <= t.p70 THEN 2
                            ELSE                              3
                        END AS sort_order,
                        ROUND(t.p30) AS threshold_low,
                        ROUND(t.p70) AS threshold_high
                    FROM fact_county_metric m
                    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                    JOIN dim_county c    ON m.fips = c.fips
                    CROSS JOIN income_thresholds t
                    WHERE i.indicator_code = 'income_median_household'
                      AND m.period_label   = 'current'
                      AND m.metric_value   IS NOT NULL
                      {state_clause}
                )
                SELECT
                    s.segment,
                    s.sort_order,
                    ROUND(MIN(s.income))           AS income_min,
                    ROUND(MAX(s.income))           AS income_max,
                    MIN(s.threshold_low)           AS threshold_low,
                    MIN(s.threshold_high)          AS threshold_high,
                    CASE
                        WHEN LOWER(es.winner_name_raw) LIKE '%trump%'  THEN 'Trump'
                        WHEN LOWER(es.winner_name_raw) LIKE '%harris%' THEN 'Harris'
                        ELSE 'Other'
                    END AS winner,
                    COUNT(*)                               AS county_count,
                    COALESCE(SUM(es.total_votes), 0)       AS total_votes,
                    ROUND(AVG(ABS(es.margin_pct))::numeric, 2) AS avg_margin
                FROM segmented s
                LEFT JOIN fact_county_election_summary es
                    ON s.fips = es.fips AND es.election_id = :election_id
                GROUP BY s.segment, s.sort_order, winner
                ORDER BY s.sort_order, winner
            """),
            params,
        )
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            r["county_count"]  = int(r["county_count"] or 0)
            r["total_votes"]   = int(r["total_votes"] or 0)
            r["avg_margin"]    = float(r["avg_margin"] or 0)
            r["income_min"]    = int(r["income_min"] or 0)
            r["income_max"]    = int(r["income_max"] or 0)
            r["threshold_low"] = int(r["threshold_low"] or 0)
            r["threshold_high"]= int(r["threshold_high"] or 0)
        return rows

    async def get_housing_affordability(self, election_id: int, state: str | None = None):
        state_clause = "AND c.state_abbr = :state" if state else ""
        params: dict = {"election_id": election_id}
        if state:
            params["state"] = state
        result = await self.db.execute(
            text(f"""
                WITH pivoted AS (
                    SELECT
                        m.fips,
                        MAX(CASE WHEN i.indicator_code = 'income_median_household' THEN m.metric_value END) AS income,
                        MAX(CASE WHEN i.indicator_code = 'housing_median_value'    THEN m.metric_value END) AS housing_value,
                        MAX(CASE WHEN i.indicator_code = 'housing_persons_per_hh'  THEN m.metric_value END) AS persons_per_hh
                    FROM fact_county_metric m
                    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                    WHERE i.indicator_code IN (
                        'income_median_household', 'housing_median_value', 'housing_persons_per_hh'
                    ) AND m.period_label = 'current'
                    GROUP BY m.fips
                )
                SELECT
                    c.fips,
                    c.county_name,
                    c.state_abbr,
                    ROUND(p.income::numeric, 0)                                        AS income,
                    ROUND(p.housing_value::numeric, 0)                                 AS housing_value,
                    ROUND(p.persons_per_hh::numeric, 2)                                AS persons_per_hh,
                    ROUND((p.housing_value / NULLIF(p.income, 0))::numeric, 2)         AS affordability_ratio,
                    s.winner_name_raw,
                    s.margin_pct,
                    s.competitiveness_score,
                    s.total_votes
                FROM pivoted p
                JOIN dim_county c ON p.fips = c.fips
                LEFT JOIN fact_county_election_summary s
                    ON c.fips = s.fips AND s.election_id = :election_id
                WHERE p.income IS NOT NULL AND p.housing_value IS NOT NULL
                  {state_clause}
                ORDER BY affordability_ratio DESC NULLS LAST
            """),
            params,
        )
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            r["income"]               = int(r["income"] or 0)
            r["housing_value"]        = int(r["housing_value"] or 0)
            r["persons_per_hh"]       = float(r["persons_per_hh"] or 0)
            r["affordability_ratio"]  = float(r["affordability_ratio"] or 0)
            r["margin_pct"]           = round(float(r["margin_pct"] or 0), 2)
            r["total_votes"]          = int(r["total_votes"] or 0)
        return rows

    async def get_economic_stress(self, election_id: int, state: str | None = None, limit: int = 20):
        state_clause = "AND c.state_abbr = :state" if state else ""
        params: dict = {"election_id": election_id, "limit": limit}
        if state:
            params["state"] = state
        result = await self.db.execute(
            text(f"""
                WITH pivoted AS (
                    SELECT
                        m.fips,
                        MAX(CASE WHEN i.indicator_code = 'income_median_household'   THEN m.metric_value END) AS income,
                        MAX(CASE WHEN i.indicator_code = 'income_per_capita'         THEN m.metric_value END) AS per_capita,
                        MAX(CASE WHEN i.indicator_code = 'misc_mean_travel_time_min' THEN m.metric_value END) AS commute,
                        MAX(CASE WHEN i.indicator_code = 'housing_homeownership_pct' THEN m.metric_value END) AS homeownership
                    FROM fact_county_metric m
                    JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                    WHERE i.indicator_code IN (
                        'income_median_household', 'income_per_capita',
                        'misc_mean_travel_time_min', 'housing_homeownership_pct'
                    ) AND m.period_label = 'current'
                    GROUP BY m.fips
                ),
                ranges AS (
                    SELECT
                        MIN(income)       AS income_min,  MAX(income)       AS income_max,
                        MIN(per_capita)   AS pc_min,      MAX(per_capita)   AS pc_max,
                        MIN(commute)      AS commute_min, MAX(commute)      AS commute_max,
                        MIN(homeownership)AS hw_min,      MAX(homeownership)AS hw_max
                    FROM pivoted
                    WHERE income IS NOT NULL AND per_capita IS NOT NULL
                      AND commute IS NOT NULL AND homeownership IS NOT NULL
                ),
                scored AS (
                    SELECT
                        p.fips,
                        p.income, p.per_capita, p.commute, p.homeownership,
                        (
                            (1 - (p.income       - r.income_min) / NULLIF(r.income_max - r.income_min, 0))
                          + (1 - (p.per_capita   - r.pc_min)     / NULLIF(r.pc_max     - r.pc_min,     0))
                          + (    (p.commute       - r.commute_min)/ NULLIF(r.commute_max- r.commute_min, 0))
                          + (1 - (p.homeownership - r.hw_min)     / NULLIF(r.hw_max     - r.hw_min,     0))
                        ) / 4.0 * 100 AS stress_score
                    FROM pivoted p
                    CROSS JOIN ranges r
                    WHERE p.income IS NOT NULL AND p.per_capita IS NOT NULL
                      AND p.commute IS NOT NULL AND p.homeownership IS NOT NULL
                )
                SELECT
                    c.fips,
                    c.county_name,
                    c.state_abbr,
                    ROUND(sc.stress_score::numeric, 1)   AS stress_score,
                    ROUND(sc.income::numeric, 0)         AS income,
                    ROUND(sc.per_capita::numeric, 0)     AS per_capita,
                    ROUND(sc.commute::numeric, 1)        AS commute_min,
                    ROUND(sc.homeownership::numeric, 1)  AS homeownership_pct,
                    s.winner_name_raw,
                    s.margin_pct,
                    s.competitiveness_score,
                    s.total_votes
                FROM scored sc
                JOIN dim_county c ON sc.fips = c.fips
                LEFT JOIN fact_county_election_summary s
                    ON c.fips = s.fips AND s.election_id = :election_id
                WHERE 1=1 {state_clause}
                ORDER BY sc.stress_score DESC
                LIMIT :limit
            """),
            params,
        )
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            r["stress_score"]      = float(r["stress_score"] or 0)
            r["income"]            = int(r["income"] or 0)
            r["per_capita"]        = int(r["per_capita"] or 0)
            r["commute_min"]       = float(r["commute_min"] or 0)
            r["homeownership_pct"] = float(r["homeownership_pct"] or 0)
            r["margin_pct"]        = round(float(r["margin_pct"] or 0), 2)
            r["total_votes"]       = int(r["total_votes"] or 0)
        return rows

    async def get_income_competitiveness(self, election_id: int, state: str | None = None):
        state_clause = "AND c.state_abbr = :state" if state else ""
        params: dict = {"election_id": election_id}
        if state:
            params["state"] = state
        result = await self.db.execute(
            text(f"""
                SELECT
                    c.fips,
                    c.county_name,
                    c.state_abbr,
                    m.metric_value                          AS income,
                    s.competitiveness_score,
                    s.margin_pct,
                    s.total_votes,
                    s.winner_name_raw
                FROM fact_county_metric m
                JOIN dim_indicator i  ON m.indicator_id = i.indicator_id
                JOIN dim_county c     ON m.fips = c.fips
                JOIN fact_county_election_summary s
                    ON c.fips = s.fips AND s.election_id = :election_id
                WHERE i.indicator_code = 'income_median_household'
                  AND m.period_label   = 'current'
                  AND m.metric_value   IS NOT NULL
                  AND s.competitiveness_score IS NOT NULL
                  {state_clause}
                ORDER BY s.competitiveness_score DESC
            """),
            params,
        )
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            r["income"]               = int(r["income"] or 0)
            r["competitiveness_score"]= round(float(r["competitiveness_score"] or 0), 2)
            r["margin_pct"]           = round(float(r["margin_pct"] or 0), 2)
            r["total_votes"]          = int(r["total_votes"] or 0)
        return rows

    async def get_persuasion_segments(self, election_id: int, state: str | None = None):
        state_clause = "AND c.state_abbr = :state" if state else ""
        params: dict = {"election_id": election_id}
        if state:
            params["state"] = state
        result = await self.db.execute(
            text(f"""
                WITH edu_pivoted AS (
                    SELECT
                        fe.fips,
                        COALESCE(MAX(CASE WHEN dl.education_level_code = 'bachelors_or_higher'       THEN fe.adults_pct END), 0) AS pct_bachelors,
                        COALESCE(MAX(CASE WHEN dl.education_level_code = 'high_school_only'          THEN fe.adults_pct END), 0) AS pct_hs_only,
                        COALESCE(MAX(CASE WHEN dl.education_level_code = 'some_college_or_associate' THEN fe.adults_pct END), 0) AS pct_some_college
                    FROM fact_county_education fe
                    JOIN dim_education_level dl ON fe.education_level_id = dl.education_level_id
                    WHERE fe.period_label = '2015-19'
                    GROUP BY fe.fips
                ),
                edu_computed AS (
                    SELECT
                        fips,
                        pct_bachelors,
                        pct_bachelors + pct_hs_only + pct_some_college AS pct_hs_or_higher
                    FROM edu_pivoted
                    WHERE pct_bachelors IS NOT NULL
                ),
                thresholds AS (
                    SELECT
                        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pct_hs_or_higher) AS hs_median,
                        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pct_bachelors)    AS bachelor_median
                    FROM edu_computed
                ),
                segmented AS (
                    SELECT
                        e.fips,
                        ROUND(e.pct_bachelors::numeric,    2) AS pct_bachelors,
                        ROUND(e.pct_hs_or_higher::numeric, 2) AS pct_hs_or_higher,
                        CASE
                            WHEN e.pct_hs_or_higher >= t.hs_median AND e.pct_bachelors <  t.bachelor_median THEN 'Mass Persuasion'
                            WHEN e.pct_hs_or_higher >= t.hs_median AND e.pct_bachelors >= t.bachelor_median THEN 'Informed Electorate'
                            WHEN e.pct_hs_or_higher <  t.hs_median AND e.pct_bachelors <  t.bachelor_median THEN 'Low Engagement'
                            WHEN e.pct_hs_or_higher <  t.hs_median AND e.pct_bachelors >= t.bachelor_median THEN 'Niche Educated'
                        END AS segment
                    FROM edu_computed e
                    CROSS JOIN thresholds t
                )
                SELECT
                    c.fips,
                    c.county_name,
                    c.state_abbr,
                    ROUND(m.metric_value) AS income,
                    sg.segment,
                    sg.pct_bachelors,
                    sg.pct_hs_or_higher,
                    s.winner_name_raw,
                    s.margin_pct
                FROM segmented sg
                JOIN dim_county c ON sg.fips = c.fips
                JOIN fact_county_metric m ON sg.fips = m.fips
                JOIN dim_indicator i ON m.indicator_id = i.indicator_id
                LEFT JOIN fact_county_election_summary s
                    ON sg.fips = s.fips AND s.election_id = :election_id
                WHERE i.indicator_code = 'income_median_household'
                  AND m.period_label   = 'current'
                  AND m.metric_value   IS NOT NULL
                  AND sg.segment       IS NOT NULL
                  {state_clause}
                ORDER BY sg.segment, m.metric_value
            """),
            params,
        )
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            r["income"]          = int(r["income"] or 0)
            r["pct_bachelors"]   = float(r["pct_bachelors"] or 0)
            r["pct_hs_or_higher"]= float(r["pct_hs_or_higher"] or 0)
            r["margin_pct"]      = round(float(r["margin_pct"] or 0), 2)
        return rows

    async def get_indicators(self):
        """List all available demographic indicator codes and metadata."""
        result = await self.db.execute(
            select(DimIndicator).order_by(DimIndicator.category, DimIndicator.indicator_name)
        )
        rows = result.scalars().all()
        return [
            {
                "indicator_id": r.indicator_id,
                "indicator_code": r.indicator_code,
                "indicator_name": r.indicator_name,
                "category": r.category,
                "unit": r.unit,
                "value_type": r.value_type,
            }
            for r in rows
        ]
