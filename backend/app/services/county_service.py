from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.dimensions import DimCounty, DimState
from app.schemas.counties import CountyOut, CountyDetailOut, StateOut


class CountyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self, state: str | None = None):
        stmt = select(DimCounty).order_by(DimCounty.state_abbr, DimCounty.county_name)
        if state:
            stmt = stmt.where(DimCounty.state_abbr == state.upper())
        result = await self.db.execute(stmt)
        return [CountyOut.model_validate(c) for c in result.scalars().all()]

    async def get_by_fips(self, fips: str):
        result = await self.db.execute(
            select(
                DimCounty.fips,
                DimCounty.state_abbr,
                DimCounty.county_name,
                DimCounty.county_type,
                DimCounty.latitude,
                DimCounty.longitude,
                DimState.state_name,
                DimState.region,
            )
            .join(DimState, DimCounty.state_abbr == DimState.state_abbr)
            .where(DimCounty.fips == fips)
        )
        row = result.mappings().one_or_none()
        return dict(row) if row else None

    async def search(self, query: str):
        result = await self.db.execute(
            select(
                DimCounty.fips,
                DimCounty.state_abbr,
                DimCounty.county_name,
                DimCounty.county_type,
            )
            .where(DimCounty.county_search_text.ilike(f"%{query}%"))
            .order_by(DimCounty.state_abbr, DimCounty.county_name)
            .limit(50)
        )
        return [dict(r) for r in result.mappings().all()]

    async def get_states(self):
        result = await self.db.execute(select(DimState).order_by(DimState.state_name))
        return [StateOut.model_validate(s) for s in result.scalars().all()]

    async def get_state_detail(self, state_abbr: str):
        result = await self.db.execute(
            select(DimState).where(DimState.state_abbr == state_abbr.upper())
        )
        state = result.scalar_one_or_none()
        return StateOut.model_validate(state) if state else None
