from typing import Optional, List, Any
from pydantic import BaseModel, Field


class Geography(BaseModel):
    level: str = "national"
    states: List[str] = Field(default_factory=list)
    counties: List[str] = Field(default_factory=list)


class QueryFilter(BaseModel):
    field: str
    operator: str
    value: Any


class Sort(BaseModel):
    field: str
    direction: str = "desc"


class CampaignFrame(BaseModel):
    party: Optional[str] = None
    objective: Optional[str] = None


class Ambiguity(BaseModel):
    is_ambiguous: bool = False
    clarifying_question: Optional[str] = None


class StructuredQuery(BaseModel):
    intent: str = "search_counties"
    language: str = "en"
    geography: Geography = Field(default_factory=Geography)
    filters: List[QueryFilter] = Field(default_factory=list)
    metrics: List[str] = Field(default_factory=list)
    sort: Optional[Sort] = None
    limit: int = 50
    visualization_type: Optional[str] = None
    campaign_frame: Optional[CampaignFrame] = None
    ambiguity: Ambiguity = Field(default_factory=Ambiguity)
    interpretation: str = ""
