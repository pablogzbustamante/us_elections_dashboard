from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.dimensions import DimCounty, DimState


class CountyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_fips(self, fips: str):
        result = await self.db.execute(
            select(
                DimCounty.fips,
                DimCounty.state_abbr,
                DimCounty.county_name,
                DimCounty.county_type,
                DimState.state_name,
            )
            .join(DimState, DimCounty.state_abbr == DimState.state_abbr)
            .where(DimCounty.fips == fips)
        )
        row = result.mappings().one_or_none()
        return dict(row) if row else None
