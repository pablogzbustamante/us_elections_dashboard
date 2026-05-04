from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.election_service import ElectionService

router = APIRouter(prefix="/elections", tags=["elections"])


@router.get("/")
async def list_elections(db: AsyncSession = Depends(get_db)):
    return await ElectionService(db).get_elections()


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


