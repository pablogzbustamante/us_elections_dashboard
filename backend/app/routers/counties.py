from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.county_service import CountyService
from app.services.election_service import ElectionService

router = APIRouter(prefix="/counties", tags=["counties"])


@router.get("/{fips}")
async def get_county(fips: str, db: AsyncSession = Depends(get_db)):
    county = await CountyService(db).get_by_fips(fips)
    if not county:
        raise HTTPException(status_code=404, detail="County not found")
    return county


@router.get("/{fips}/winner-history")
async def winner_history(fips: str, db: AsyncSession = Depends(get_db)):
    return await ElectionService(db).get_winner_history(fips)
