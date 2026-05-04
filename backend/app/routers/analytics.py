from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/indicators")
async def list_indicators(db: AsyncSession = Depends(get_db)):
    return await AnalyticsService(db).get_indicators()


@router.get("/counties/{fips}/demographics")
async def demographics(
    fips: str,
    period: str | None = Query(None, description="e.g. '2020'"),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_demographics(fips, period)


@router.get("/counties/{fips}/education")
async def education(
    fips: str,
    period: str | None = Query(None, description="e.g. '2015-19'"),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_education(fips, period)


@router.get("/counties/{fips}/religion")
async def religion(fips: str, db: AsyncSession = Depends(get_db)):
    return await AnalyticsService(db).get_religion(fips)


@router.get("/education/county-summary")
async def education_county_summary(
    election_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_education_county_summary(election_id)


@router.get("/age/county-summary")
async def age_county_summary(
    election_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_age_county_summary(election_id)


@router.get("/ethnicity/county-summary")
async def ethnicity_county_summary(
    election_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_ethnicity_county_summary(election_id)


@router.get("/income/inequality-proxy")
async def inequality_proxy(
    election_id: int = Query(...),
    state: str | None = Query(None),
    limit: int = Query(50, ge=5, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_inequality_proxy(election_id, state, limit)


@router.get("/income/population")
async def income_population(
    election_id: int = Query(...),
    state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_income_population(election_id, state)


@router.get("/income/segments")
async def income_segments(
    election_id: int = Query(...),
    state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_income_segments(election_id, state)


@router.get("/housing/affordability")
async def housing_affordability(
    election_id: int = Query(...),
    state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_housing_affordability(election_id, state)


@router.get("/economic/stress")
async def economic_stress(
    election_id: int = Query(...),
    state: str | None = Query(None),
    limit: int = Query(20, ge=5, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_economic_stress(election_id, state, limit)


@router.get("/income/competitiveness")
async def income_competitiveness(
    election_id: int = Query(...),
    state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_income_competitiveness(election_id, state)


@router.get("/income/quintile-breakdown")
async def income_quintile_breakdown(
    election_id: int = Query(...),
    state: str | None = Query(None, description="2-letter state abbreviation to filter"),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_income_quintiles(election_id, state)


@router.get("/income/persuasion-segments")
async def persuasion_segments(
    election_id: int = Query(...),
    state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_persuasion_segments(election_id, state)


@router.get("/correlation")
async def correlation(
    indicator: str = Query(..., description="Indicator code, e.g. 'pct_college_or_higher'"),
    election_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService(db).get_correlation(indicator, election_id)
