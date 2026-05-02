from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from .schema import StructuredQuery
from .query_builder import build_query


async def execute_query(db: AsyncSession, query: StructuredQuery) -> list[dict]:
    sql, params = build_query(query)
    result = await db.execute(text(sql), params)
    rows = [dict(r) for r in result.mappings().all()]
    # Convert Decimal / None to JSON-serializable types
    clean = []
    for row in rows:
        item = {}
        for k, v in row.items():
            if v is None:
                item[k] = None
            elif hasattr(v, "__float__"):
                item[k] = round(float(v), 4)
            else:
                item[k] = v
        clean.append(item)
    return clean
