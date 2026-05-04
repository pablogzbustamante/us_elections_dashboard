from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_national_summary(self, election_id: int):
        """
        Top KPI bar: national vote totals per candidate, total counties,
        competitive county count, and average absolute margin.
        """
        agg_result = await self.db.execute(
            text("""
                SELECT
                    SUM(total_votes)                                              AS total_votes,
                    COUNT(*)                                                       AS total_counties,
                    SUM(CASE WHEN competitiveness_score >= 0.7 THEN 1 ELSE 0 END) AS competitive_counties,
                    ROUND(AVG(ABS(margin_pct))::numeric, 2)                       AS avg_abs_margin_pct
                FROM fact_county_election_summary
                WHERE election_id = :election_id
                  AND total_votes IS NOT NULL
            """),
            {"election_id": election_id},
        )
        agg = dict(agg_result.mappings().one())

        cand_result = await self.db.execute(
            text("""
                SELECT
                    cand.candidate_name,
                    p.party_code,
                    SUM(v.votes)                                                            AS national_votes,
                    ROUND(
                        100.0 * SUM(v.votes) / NULLIF(SUM(SUM(v.votes)) OVER (), 0),
                        2
                    )                                                                        AS vote_pct
                FROM fact_county_candidate_votes v
                JOIN dim_candidate cand ON v.candidate_id = cand.candidate_id
                LEFT JOIN dim_party p ON cand.party_id = p.party_id
                WHERE v.election_id = :election_id
                GROUP BY cand.candidate_name, p.party_code
                ORDER BY national_votes DESC
            """),
            {"election_id": election_id},
        )
        candidates = [dict(r) for r in cand_result.mappings().all()]

        return {**agg, "candidates": candidates}

    async def get_trends(self):
        """
        Aggregate national vote totals by party per election year - powers the
        trend line chart (analog of Traffic / ROI / Conversions over time).
        """
        result = await self.db.execute(
            text("""
                SELECT
                    e.election_year,
                    p.party_code,
                    SUM(v.votes)                                                    AS total_votes,
                    ROUND(AVG(v.vote_pct)::numeric, 4)                              AS avg_vote_pct,
                    COUNT(DISTINCT v.fips)                                           AS counties_won
                FROM fact_county_candidate_votes v
                JOIN dim_election e    ON v.election_id   = e.election_id
                JOIN dim_candidate cand ON v.candidate_id = cand.candidate_id
                LEFT JOIN dim_party p  ON cand.party_id   = p.party_id
                WHERE p.party_code IN ('REP', 'DEM')
                GROUP BY e.election_year, p.party_code
                ORDER BY e.election_year, p.party_code
            """)
        )
        return [dict(r) for r in result.mappings().all()]

    async def get_state_summary(self, election_id: int):
        """
        State-level aggregated results table - analog of the Lead Quality table
        showing per-row performance with quality tags.
        """
        result = await self.db.execute(
            text("""
                SELECT
                    c.state_abbr,
                    st.state_name,
                    SUM(s.total_votes)                                              AS total_votes,
                    ROUND(AVG(s.margin_pct)::numeric, 4)                            AS avg_margin_pct,
                    COUNT(*)                                                         AS county_count,
                    SUM(CASE WHEN s.competitiveness_score >= 0.7 THEN 1 ELSE 0 END) AS competitive_counties,
                    MODE() WITHIN GROUP (ORDER BY s.winner_name_raw)                AS state_winner
                FROM fact_county_election_summary s
                JOIN dim_county c  ON s.fips          = c.fips
                JOIN dim_state st  ON c.state_abbr    = st.state_abbr
                WHERE s.election_id = :election_id
                  AND s.total_votes IS NOT NULL
                GROUP BY c.state_abbr, st.state_name
                ORDER BY st.state_name
            """),
            {"election_id": election_id},
        )
        return [dict(r) for r in result.mappings().all()]

    async def get_competitive_counties(self, election_id: int, limit: int = 25):
        """
        Most contested counties ordered by competitiveness score - the 'hot leads'
        in the dashboard table, analog to NEEDS REVIEW rows.
        """
        result = await self.db.execute(
            text("""
                SELECT
                    s.fips,
                    c.county_name,
                    c.state_abbr,
                    s.total_votes,
                    s.winner_name_raw,
                    ROUND(s.margin_pct::numeric, 4)             AS margin_pct,
                    ROUND(s.competitiveness_score::numeric, 4)  AS competitiveness_score,
                    p.party_code                                 AS winner_party
                FROM fact_county_election_summary s
                JOIN dim_county c ON s.fips = c.fips
                LEFT JOIN dim_candidate cand ON s.winner_candidate_id = cand.candidate_id
                LEFT JOIN dim_party p ON cand.party_id = p.party_id
                WHERE s.election_id          = :election_id
                  AND s.competitiveness_score IS NOT NULL
                ORDER BY s.competitiveness_score DESC
                LIMIT :limit
            """),
            {"election_id": election_id, "limit": limit},
        )
        return [dict(r) for r in result.mappings().all()]

    async def get_map_data(self, election_id: int):
        """
        Full county-level result set for choropleth map rendering.
        """
        result = await self.db.execute(
            text("""
                SELECT
                    s.fips,
                    c.county_name,
                    c.state_abbr,
                    s.total_votes,
                    s.winner_name_raw,
                    ROUND(s.margin_pct::numeric, 4)            AS margin_pct,
                    ROUND(s.competitiveness_score::numeric, 4) AS competitiveness_score,
                    p.party_code                               AS winner_party,
                    h2020.winner_name_raw                      AS winner_2020,
                    h2016.winner_name_raw                      AS winner_2016
                FROM fact_county_election_summary s
                JOIN dim_county c            ON s.fips             = c.fips
                LEFT JOIN dim_candidate cand ON s.winner_candidate_id = cand.candidate_id
                LEFT JOIN dim_party p        ON cand.party_id         = p.party_id
                LEFT JOIN (
                    SELECT h.fips, h.winner_name_raw
                    FROM fact_county_election_winner_history h
                    JOIN dim_election e ON h.election_id = e.election_id
                    WHERE e.election_year = 2020
                ) h2020 ON s.fips = h2020.fips
                LEFT JOIN (
                    SELECT h.fips, h.winner_name_raw
                    FROM fact_county_election_winner_history h
                    JOIN dim_election e ON h.election_id = e.election_id
                    WHERE e.election_year = 2016
                ) h2016 ON s.fips = h2016.fips
                WHERE s.election_id = :election_id
            """),
            {"election_id": election_id},
        )
        return [dict(r) for r in result.mappings().all()]

    async def get_party_comparison(self, election_id: int):
        """
        Per-party county win counts and aggregate vote share - right-panel
        stats analog (Followers / Interactions / Likes counts).
        """
        result = await self.db.execute(
            text("""
                SELECT
                    p.party_code,
                    COUNT(*)                               AS counties_won,
                    SUM(s.total_votes)                     AS total_votes_in_won_counties,
                    ROUND(AVG(ABS(s.margin_pct))::numeric, 4) AS avg_margin_pct
                FROM fact_county_election_summary s
                JOIN dim_candidate cand ON s.winner_candidate_id = cand.candidate_id
                JOIN dim_party p        ON cand.party_id         = p.party_id
                WHERE s.election_id = :election_id
                  AND s.winner_candidate_id IS NOT NULL
                GROUP BY p.party_code
                ORDER BY counties_won DESC
            """),
            {"election_id": election_id},
        )
        return [dict(r) for r in result.mappings().all()]

    async def get_state_map_data(self, election_id: int):
        """
        State-level vote aggregations for the hero choropleth map.
        Uses actual vote totals to determine winner, not county-mode heuristic.
        Returns state_fips (2-digit) for matching against us-atlas TopoJSON.
        """
        result = await self.db.execute(
            text("""
                WITH party_votes AS (
                    SELECT
                        LEFT(c.fips, 2)  AS state_fips,
                        c.state_abbr,
                        st.state_name,
                        SUM(CASE WHEN p.party_code = 'DEM' THEN v.votes ELSE 0 END) AS dem_votes,
                        SUM(CASE WHEN p.party_code = 'REP' THEN v.votes ELSE 0 END) AS rep_votes
                    FROM fact_county_candidate_votes v
                    JOIN dim_county    c    ON v.fips          = c.fips
                    JOIN dim_state     st   ON c.state_abbr    = st.state_abbr
                    JOIN dim_candidate cand ON v.candidate_id  = cand.candidate_id
                    LEFT JOIN dim_party p   ON cand.party_id   = p.party_id
                    WHERE v.election_id = :election_id
                      AND p.party_code IN ('REP', 'DEM')
                    GROUP BY LEFT(c.fips, 2), c.state_abbr, st.state_name
                ),
                county_stats AS (
                    SELECT
                        LEFT(c.fips, 2)  AS state_fips,
                        SUM(s.total_votes)                                              AS total_votes,
                        COUNT(*)                                                         AS county_count,
                        SUM(CASE WHEN s.competitiveness_score >= 0.7 THEN 1 ELSE 0 END) AS competitive_counties
                    FROM fact_county_election_summary s
                    JOIN dim_county c ON s.fips = c.fips
                    WHERE s.election_id = :election_id
                      AND s.total_votes IS NOT NULL
                    GROUP BY LEFT(c.fips, 2)
                )
                SELECT
                    pv.state_fips,
                    pv.state_abbr,
                    pv.state_name,
                    pv.dem_votes,
                    pv.rep_votes,
                    cs.total_votes,
                    cs.county_count,
                    cs.competitive_counties
                FROM party_votes pv
                LEFT JOIN county_stats cs ON pv.state_fips = cs.state_fips
                ORDER BY pv.state_name
            """),
            {"election_id": election_id},
        )
        rows = []
        for r in result.mappings().all():
            row = dict(r)
            dem = row.get("dem_votes") or 0
            rep = row.get("rep_votes") or 0
            rd_total = dem + rep
            if rd_total > 0:
                if rep >= dem:
                    row["winner_party"] = "REPUBLICAN"
                    row["margin_pct"] = round((rep - dem) / rd_total * 100, 2)
                else:
                    row["winner_party"] = "DEMOCRAT"
                    row["margin_pct"] = round((dem - rep) / rd_total * 100, 2)
            else:
                row["winner_party"] = None
                row["margin_pct"] = None
            rows.append(row)
        return rows

    async def get_swing_analysis(self, from_election_id: int, to_election_id: int):
        """
        County-level swing: change in Republican/Democrat vote share between two elections.
        """
        result = await self.db.execute(
            text("""
                WITH base AS (
                    SELECT
                        v.fips,
                        p.party_code,
                        v.vote_pct,
                        v.election_id
                    FROM fact_county_candidate_votes v
                    JOIN dim_candidate cand ON v.candidate_id = cand.candidate_id
                    LEFT JOIN dim_party p ON cand.party_id = p.party_id
                    WHERE v.election_id IN (:from_id, :to_id)
                      AND p.party_code IN ('REP', 'DEM')
                )
                SELECT
                    a.fips,
                    c.county_name,
                    c.state_abbr,
                    a.party_code,
                    ROUND((b.vote_pct - a.vote_pct)::numeric, 4) AS swing_pct
                FROM base a
                JOIN base b ON a.fips = b.fips AND a.party_code = b.party_code
                              AND b.election_id = :to_id
                JOIN dim_county c ON a.fips = c.fips
                WHERE a.election_id = :from_id
                  AND b.vote_pct IS NOT NULL
                  AND a.vote_pct IS NOT NULL
                ORDER BY ABS(b.vote_pct - a.vote_pct) DESC
            """),
            {"from_id": from_election_id, "to_id": to_election_id},
        )
        return [dict(r) for r in result.mappings().all()]
