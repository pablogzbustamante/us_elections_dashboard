from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine
from app.routers import elections, counties, analytics, dashboard, chat_query, standard_query


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="US Elections Dashboard API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(elections.router, prefix="/api")
app.include_router(counties.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(chat_query.router, prefix="/api")
app.include_router(standard_query.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
