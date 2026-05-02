from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.election_service import ElectionService

router = APIRouter(prefix="/elections", tags=["elections"])


@router.get("/")
async def list_elections(db: AsyncSession = Depends(get_db)):
    return await ElectionService(db).get_elections()


@router.get("/swing-counties")
async def swing_counties(
    from_id: int = Query(..., description="Source election ID"),
    to_id: int = Query(..., description="Target election ID"),
    db: AsyncSession = Depends(get_db),
):
    return await ElectionService(db).get_swing_counties(from_id, to_id)


@router.get("/{election_id}/results")
async def election_results(
    election_id: int,
    state: str | None = Query(None, description="Filter by 2-letter state abbreviation"),
    db: AsyncSession = Depends(get_db),
):
    return await ElectionService(db).get_results_by_election(election_id, state)


@router.get("/{election_id}/county/{fips}")
async def county_result(
    election_id: int,
    fips: str,
    db: AsyncSession = Depends(get_db),
):
    result = await ElectionService(db).get_county_results(fips, election_id)
    if result["summary"] is None:
        raise HTTPException(status_code=404, detail="No results found for this county/election")
    return result


@router.get("/{election_id}/winner-history/{fips}")
async def winner_history(
    election_id: int,
    fips: str,
    db: AsyncSession = Depends(get_db),
):
    return await ElectionService(db).get_winner_history(fips)
