from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.dimensions import DimElection, DimCounty, DimCandidate, DimParty
from app.models.facts import (
    FactCountyCandidateVotes,
    FactCountyElectionSummary,
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
                FactCountyElectionSummary.fips,
                DimElection.election_year,
                FactCountyElectionSummary.winner_name_raw,
                DimParty.party_code,
            )
            .join(DimElection, FactCountyElectionSummary.election_id == DimElection.election_id)
            .join(
                DimCandidate,
                FactCountyElectionSummary.winner_candidate_id == DimCandidate.candidate_id,
                isouter=True,
            )
            .join(DimParty, DimCandidate.party_id == DimParty.party_id, isouter=True)
            .where(FactCountyElectionSummary.fips == fips)
            .order_by(DimElection.election_year)
        )
        return [dict(r) for r in result.mappings().all()]
