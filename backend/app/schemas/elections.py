from pydantic import BaseModel


class ElectionOut(BaseModel):
    election_id: int
    election_year: int
    office: str
    election_type: str | None
    country: str

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
