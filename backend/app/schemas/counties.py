from pydantic import BaseModel


class CountyOut(BaseModel):
    fips: str
    state_abbr: str
    county_name: str
    county_type: str | None

    model_config = {"from_attributes": True}
