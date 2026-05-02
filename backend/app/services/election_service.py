from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models.dimensions import DimElection, DimCounty, DimState, DimCandidate, DimParty
from app.models.facts import (
    FactCountyCandidateVotes,
    FactCountyElectionSummary,
    FactCountyElectionWinnerHistory,
)
from app.schemas.elections import ElectionOut, CountyElectionSummaryOut


class ElectionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_elections(self):
        result = await self.db.execute(
            select(DimElection).order_by(DimElection.election_year.desc())
        )
        return [ElectionOut.model_validate(e) for e in result.scalars().all()]

    async def get_results_by_election(self, election_id: int, state: str | None = None):
        stmt = (
            select(
                DimCounty.fips,
                DimCounty.county_name,
                DimCounty.state_abbr,
                DimState.state_name,
                FactCountyElectionSummary.total_votes,
                FactCountyElectionSummary.winner_name_raw,
                FactCountyElectionSummary.margin_pct,
                FactCountyElectionSummary.competitiveness_score,
            )
            .join(FactCountyElectionSummary, DimCounty.fips == FactCountyElectionSummary.fips)
            .join(DimState, DimCounty.state_abbr == DimState.state_abbr)
            .where(FactCountyElectionSummary.election_id == election_id)
            .order_by(DimCounty.state_abbr, DimCounty.county_name)
        )
        if state:
            stmt = stmt.where(DimCounty.state_abbr == state.upper())
        result = await self.db.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def get_county_results(self, fips: str, election_id: int):
        summary_result = await self.db.execute(
            select(FactCountyElectionSummary).where(
                FactCountyElectionSummary.fips == fips,
                FactCountyElectionSummary.election_id == election_id,
            )
        )
        summary = summary_result.scalar_one_or_none()

        cand_result = await self.db.execute(
            select(
                FactCountyCandidateVotes.votes,
                FactCountyCandidateVotes.vote_pct,
                FactCountyCandidateVotes.is_winner,
                DimCandidate.candidate_name,
                DimParty.party_code,
            )
            .join(DimCandidate, FactCountyCandidateVotes.candidate_id == DimCandidate.candidate_id)
            .join(DimParty, DimCandidate.party_id == DimParty.party_id, isouter=True)
            .where(
                FactCountyCandidateVotes.fips == fips,
                FactCountyCandidateVotes.election_id == election_id,
            )
            .order_by(FactCountyCandidateVotes.votes.desc())
        )
        candidates = [dict(r) for r in cand_result.mappings().all()]

        return {
            "summary": CountyElectionSummaryOut.model_validate(summary) if summary else None,
            "candidates": candidates,
        }

    async def get_winner_history(self, fips: str):
        result = await self.db.execute(
            select(
                FactCountyElectionWinnerHistory.fips,
                DimElection.election_year,
                FactCountyElectionWinnerHistory.winner_name_raw,
                DimParty.party_code,
            )
            .join(DimElection, FactCountyElectionWinnerHistory.election_id == DimElection.election_id)
            .join(
                DimCandidate,
                FactCountyElectionWinnerHistory.winner_candidate_id == DimCandidate.candidate_id,
                isouter=True,
            )
            .join(DimParty, DimCandidate.party_id == DimParty.party_id, isouter=True)
            .where(FactCountyElectionWinnerHistory.fips == fips)
            .order_by(DimElection.election_year)
        )
        return [dict(r) for r in result.mappings().all()]

    async def get_swing_counties(self, election_id_a: int, election_id_b: int):
        """Counties that flipped party between two elections."""
        result = await self.db.execute(
            text("""
                SELECT
                    h1.fips,
                    c.county_name,
                    c.state_abbr,
                    h1.winner_name_raw  AS winner_a,
                    p1.party_code       AS party_a,
                    h2.winner_name_raw  AS winner_b,
                    p2.party_code       AS party_b
                FROM fact_county_election_winner_history h1
                JOIN fact_county_election_winner_history h2
                    ON h1.fips = h2.fips AND h2.election_id = :id_b
                JOIN dim_county c ON h1.fips = c.fips
                LEFT JOIN dim_candidate cand1 ON h1.winner_candidate_id = cand1.candidate_id
                LEFT JOIN dim_party p1 ON cand1.party_id = p1.party_id
                LEFT JOIN dim_candidate cand2 ON h2.winner_candidate_id = cand2.candidate_id
                LEFT JOIN dim_party p2 ON cand2.party_id = p2.party_id
                WHERE h1.election_id = :id_a
                  AND p1.party_code IS DISTINCT FROM p2.party_code
                ORDER BY c.state_abbr, c.county_name
            """),
            {"id_a": election_id_a, "id_b": election_id_b},
        )
        return [dict(r) for r in result.mappings().all()]
