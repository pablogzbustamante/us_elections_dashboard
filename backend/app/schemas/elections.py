from pydantic import BaseModel


class ElectionOut(BaseModel):
    election_id: int
    election_year: int
    office: str
    election_type: str | None
    country: str

    model_config = {"from_attributes": True}


class CandidateVotesOut(BaseModel):
    fips: str
    election_id: int
    candidate_id: int
    candidate_name: str
    party_code: str
    votes: int | None
    vote_pct: float | None
    is_winner: bool | None

    model_config = {"from_attributes": True}


class CountyElectionSummaryOut(BaseModel):
    fips: str
    election_id: int
    total_votes: int | None
    winner_name_raw: str | None
    margin_votes: int | None
    margin_pct: float | None
    competitiveness_score: float | None

    model_config = {"from_attributes": True}


class WinnerHistoryOut(BaseModel):
    fips: str
    election_year: int
    winner_name_raw: str | None
    party_code: str | None

    model_config = {"from_attributes": True}


class ElectionResultsOut(BaseModel):
    """Wide view matching vw_county_election_2024."""
    fips: str
    county_name: str
    state_abbr: str
    state_name: str
    total_votes: int | None
    winner_name_raw: str | None
    margin_pct: float | None
    competitiveness_score: float | None
    candidates: list[CandidateVotesOut]

    model_config = {"from_attributes": True}
