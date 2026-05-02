from decimal import Decimal
from datetime import date, datetime, time
from uuid import UUID
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from app.database import get_db

router = APIRouter(prefix="/standard-query", tags=["standard-query"])

# Keywords that must not appear anywhere in a query
_WRITE_RE = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|"
    r"EXEC|EXECUTE|CALL|COPY|VACUUM|REPLACE|MERGE|UPSERT|"
    r"BEGIN|COMMIT|ROLLBACK|SET\s+TRANSACTION)\b",
    re.IGNORECASE,
)


def _strip_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    sql = re.sub(r"--[^\n]*", " ", sql)
    return sql.strip()


def _validate_readonly(sql: str) -> str:
    clean = _strip_comments(sql)
    if not clean:
        raise HTTPException(400, "Query cannot be empty")
    if not re.match(r"^SELECT\b", clean, re.IGNORECASE):
        raise HTTPException(400, "Only SELECT queries are allowed")
    if _WRITE_RE.search(clean):
        raise HTTPException(400, "Write operations are not permitted")
    return sql.rstrip(";").strip()


def _serialize(val):
    if val is None:
        return None
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (datetime, date, time)):
        return val.isoformat()
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, bytes):
        return val.hex()
    return val


class QueryRequest(BaseModel):
    sql: str


# ── Schema endpoint ────────────────────────────────────────────

@router.get("/schema")
async def get_schema(db: AsyncSession = Depends(get_db)):
    """Return all public tables, columns, and FK relationships."""

    cols_q = text("""
        SELECT
            t.relname                                        AS table_name,
            a.attname                                        AS column_name,
            format_type(a.atttypid, a.atttypmod)            AS data_type,
            a.attnum                                         AS ordinal_position,
            NOT a.attnotnull                                 AS is_nullable,
            EXISTS (
                SELECT 1 FROM pg_constraint c
                WHERE c.conrelid = t.oid
                  AND c.contype = 'p'
                  AND a.attnum = ANY(c.conkey)
            )                                                AS is_primary_key
        FROM pg_class t
        JOIN pg_namespace n  ON n.oid = t.relnamespace
        JOIN pg_attribute a  ON a.attrelid = t.oid
        WHERE n.nspname = 'public'
          AND t.relkind = 'r'
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY t.relname, a.attnum
    """)

    fk_q = text("""
        SELECT
            cl.relname   AS source_table,
            a.attname    AS source_column,
            clf.relname  AS target_table,
            af.attname   AS target_column
        FROM pg_constraint c
        JOIN pg_class     cl  ON cl.oid  = c.conrelid
        JOIN pg_class     clf ON clf.oid = c.confrelid
        JOIN pg_namespace n   ON n.oid   = cl.relnamespace
        JOIN pg_attribute a   ON a.attrelid  = c.conrelid  AND a.attnum  = c.conkey[1]
        JOIN pg_attribute af  ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
        WHERE c.contype = 'f'
          AND n.nspname = 'public'
        ORDER BY source_table, source_column
    """)

    cols_result = await db.execute(cols_q)
    fk_result   = await db.execute(fk_q)

    tables: dict = {}
    for row in cols_result.fetchall():
        tname, cname, dtype, ordinal, nullable, is_pk = row
        if tname not in tables:
            tables[tname] = {"name": tname, "columns": []}
        tables[tname]["columns"].append({
            "name": cname,
            "type": dtype,
            "nullable": bool(nullable),
            "is_primary_key": bool(is_pk),
        })

    relationships = [
        {
            "source_table":  row[0],
            "source_column": row[1],
            "target_table":  row[2],
            "target_column": row[3],
        }
        for row in fk_result.fetchall()
    ]

    return {"tables": list(tables.values()), "relationships": relationships}


# ── Execute endpoint ───────────────────────────────────────────

@router.post("/execute")
async def execute_query(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    """Execute a read-only SQL query and return results (capped at 1 000 rows)."""
    validated = _validate_readonly(req.sql)

    try:
        result  = await db.execute(text(validated))
        columns = list(result.keys())
        raw     = result.fetchmany(1000)
    except Exception as exc:
        raise HTTPException(400, f"Query error: {exc}") from exc

    rows = [
        {col: _serialize(val) for col, val in zip(columns, row)}
        for row in raw
    ]

    return {
        "columns": columns,
        "rows":    rows,
        "total":   len(rows),
        "capped":  len(rows) == 1000,
    }
