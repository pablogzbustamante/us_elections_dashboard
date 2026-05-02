# Elections Data Dashboard

Full-stack electoral analytics platform with a React frontend, FastAPI backend, and PostgreSQL database, all containerised with Docker.

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

No other software needed.

## Running the app

```bash
docker compose up --build
```

What happens automatically:

1. PostgreSQL starts and the schema is created from `db.sql`
2. The ETL loader runs once and populates the database from the CSV files in `backend/datasets/` (~1 minute on first run; skipped on subsequent runs)
3. The FastAPI backend starts on port 8000
4. The React frontend is built and served by nginx on port 80

Open **http://localhost** in your browser when all services are healthy.

> First build takes 3–5 minutes while Docker downloads base images and installs dependencies. Subsequent starts are fast.

## Stopping

```bash
docker compose down          # stop containers, keep DB data
docker compose down -v       # stop containers AND delete DB data
```

## Re-loading data

If you need to wipe and re-import the data:

```bash
docker compose down -v                      # delete the DB volume
docker compose up --build                   # fresh start + auto ETL
```

Or run the ETL manually without deleting data (safe to re-run, uses ON CONFLICT DO NOTHING):

```bash
docker compose run --rm reload
```

## Ports

| Service  | URL                        | Notes                    |
|----------|----------------------------|--------------------------|
| Frontend | http://localhost           | Main app                 |
| Backend  | http://localhost:8000/docs | FastAPI Swagger UI       |
| Database | localhost:5433             | PostgreSQL (user/pass: elections) |

## Smart Query (AI)

The Smart Query page uses the Groq API. The key is pre-configured in `.env` — no action required.

If the key expires, replace `GROQ_API_KEY` in `.env` and restart:

```bash
docker compose restart backend
```

## Zipping to share

Before zipping, exclude large generated directories to keep the file small:

**Windows (PowerShell):**
```powershell
# From the project root
$exclude = @("node_modules","frontend\node_modules","backend\.venv",".venv","frontend\dist","__pycache__",".git")
Get-ChildItem -Recurse | Where-Object {
    $path = $_.FullName
    -not ($exclude | Where-Object { $path -like "*\$_\*" -or $path -like "*\$_" })
} | Compress-Archive -DestinationPath elections-dashboard.zip
```

Or simply zip the folder in Explorer and then delete the `node_modules` and `dist` entries from inside the zip.

**Mac / Linux:**
```bash
zip -r elections-dashboard.zip . \
  --exclude "*/node_modules/*" --exclude "*/.venv/*" \
  --exclude "*/dist/*" --exclude "*/__pycache__/*" \
  --exclude "*/.git/*"
```
