from pydantic import BaseModel


class MetricOut(BaseModel):
    fips: str
    indicator_code: str
    indicator_name: str
    category: str | None
    unit: str | None
    period_label: str
    metric_value: float | None

    model_config = {"from_attributes": True}


class EducationOut(BaseModel):
    fips: str
    period_label: str
    education_level_code: str
    education_level_name: str
    level_order: int | None
    adults_count: int | None
    adults_pct: float | None

    model_config = {"from_attributes": True}


class ReligionOut(BaseModel):
    fips: str
    group_code: str
    group_name: str
    congregations: int | None
    adherents: int | None
    pct_total_population: float | None

    model_config = {"from_attributes": True}
