from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.county_service import CountyService

router = APIRouter(prefix="/states", tags=["states"])


@router.get("/")
async def list_states(db: AsyncSession = Depends(get_db)):
    return await CountyService(db).get_states()


@router.get("/{state_abbr}")
async def get_state(state_abbr: str, db: AsyncSession = Depends(get_db)):
    state = await CountyService(db).get_state_detail(state_abbr)
    if not state:
        raise HTTPException(status_code=404, detail="State not found")
    return state


@router.get("/{state_abbr}/counties")
async def state_counties(state_abbr: str, db: AsyncSession = Depends(get_db)):
    return await CountyService(db).get_all(state_abbr)
