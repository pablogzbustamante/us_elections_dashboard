from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.county_service import CountyService
from app.services.election_service import ElectionService

router = APIRouter(prefix="/counties", tags=["counties"])


@router.get("/")
async def list_counties(
    state: str | None = Query(None, description="Filter by 2-letter state abbreviation"),
    db: AsyncSession = Depends(get_db),
):
    return await CountyService(db).get_all(state)


@router.get("/search")
async def search_counties(
    q: str = Query(..., min_length=2, description="County name search term"),
    db: AsyncSession = Depends(get_db),
):
    return await CountyService(db).search(q)


@router.get("/{fips}")
async def get_county(fips: str, db: AsyncSession = Depends(get_db)):
    county = await CountyService(db).get_by_fips(fips)
    if not county:
        raise HTTPException(status_code=404, detail="County not found")
    return county


@router.get("/{fips}/winner-history")
async def winner_history(fips: str, db: AsyncSession = Depends(get_db)):
    return await ElectionService(db).get_winner_history(fips)
