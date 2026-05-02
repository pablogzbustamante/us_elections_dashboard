from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def national_summary(
    election_id: int = Query(..., description="Election ID to summarize"),
    db: AsyncSession = Depends(get_db),
):
    """National KPI bar: total votes, candidate breakdown, competitive county count."""
    return await DashboardService(db).get_national_summary(election_id)


@router.get("/trends")
async def trends(db: AsyncSession = Depends(get_db)):
    """Multi-election trend data for the main line chart (2016 / 2020 / 2024)."""
    return await DashboardService(db).get_trends()


@router.get("/state-summary")
async def state_summary(
    election_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """State-level aggregated results table."""
    return await DashboardService(db).get_state_summary(election_id)


@router.get("/competitive-counties")
async def competitive_counties(
    election_id: int = Query(...),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Most contested counties ordered by competitiveness score."""
    return await DashboardService(db).get_competitive_counties(election_id, limit)


@router.get("/map")
async def map_data(
    election_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Full county-level results for choropleth map rendering."""
    return await DashboardService(db).get_map_data(election_id)


@router.get("/party-comparison")
async def party_comparison(
    election_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Per-party county win counts and aggregate vote share."""
    return await DashboardService(db).get_party_comparison(election_id)


@router.get("/region-breakdown")
async def region_breakdown(
    election_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Vote totals broken down by Census region."""
    return await DashboardService(db).get_region_breakdown(election_id)


@router.get("/state-map")
async def state_map_data(
    election_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """State-level results for the hero choropleth map (winner by actual vote totals)."""
    return await DashboardService(db).get_state_map_data(election_id)


@router.get("/swing-analysis")
async def swing_analysis(
    from_election_id: int = Query(..., description="Earlier election ID"),
    to_election_id: int = Query(..., description="Later election ID"),
    db: AsyncSession = Depends(get_db),
):
    """County-level swing in vote share between two elections."""
    return await DashboardService(db).get_swing_analysis(from_election_id, to_election_id)
