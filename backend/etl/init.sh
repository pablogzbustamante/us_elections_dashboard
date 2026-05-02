#!/bin/sh
# Run ETL only if the database is empty (idempotent first-run loader).

LOADED=$(python - <<'PYEOF'
import os, sys
try:
    import psycopg2
    dsn = (
        os.environ.get("DATABASE_URL", "")
            .replace("+asyncpg://", "://")
            .replace("+psycopg2://", "://")
    )
    conn = psycopg2.connect(dsn)
    cur  = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM dim_state")
    n = cur.fetchone()[0]
    conn.close()
    print("yes" if n > 0 else "no")
except Exception as e:
    print("no")
PYEOF
)

if [ "$LOADED" = "yes" ]; then
    echo "[init] Data already loaded — skipping ETL."
else
    echo "[init] Loading data for the first time (this takes ~1 min)..."
    python etl/load.py
    echo "[init] ETL complete."
fi
