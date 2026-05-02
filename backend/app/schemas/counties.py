from pydantic import BaseModel


class StateOut(BaseModel):
    state_abbr: str
    state_name: str
    region: str | None
    division: str | None

    model_config = {"from_attributes": True}


class CountyOut(BaseModel):
    fips: str
    state_abbr: str
    county_name: str
    county_type: str | None
    latitude: float | None
    longitude: float | None

    model_config = {"from_attributes": True}


class CountyDetailOut(CountyOut):
    state_name: str
    region: str | None
