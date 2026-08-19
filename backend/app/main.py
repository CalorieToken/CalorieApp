import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from httpx import HTTPError
from sqlmodel import Session, select

from .database import get_session, init_db
from .models import FoodLogDB
from .schemas import FoodLog, FoodLogCreate, FoodSearchResponse
from .services.open_food_facts import search_food_products

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create database tables on startup; nothing special needed on shutdown."""
    init_db()
    logger.info("Database initialized")
    yield


app = FastAPI(
    title="CalorieApp Backend API",
    description="V1 non-financial food and nutrition API",
    version="0.1.0",
    lifespan=lifespan,
)

# V1 allows frontend-backend communication only; no financial or wallet features.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency alias for cleaner function signatures.
DbSession = Annotated[Session, Depends(get_session)]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "calorieapp-backend"}


@app.post("/log-food", response_model=FoodLog)
def log_food(payload: FoodLogCreate, session: DbSession) -> FoodLog:
    """Persist a food log entry to SQLite and return it with assigned id/created_at."""
    entry = FoodLogDB(
        product_name=payload.product_name,
        calories=payload.calories,
        protein=payload.protein,
        fat=payload.fat,
        carbohydrates=payload.carbohydrates,
        created_at=datetime.now(UTC),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    logger.info("Logged food item: %s (id=%s)", entry.product_name, entry.id)
    # Return as Pydantic FoodLog to preserve the existing response schema.
    return FoodLog.model_validate(entry.model_dump())


@app.get("/logs", response_model=list[FoodLog])
def get_logs(
    session: DbSession,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[FoodLog]:
    """Return logged food items, newest first. Optional limit param (default 100)."""
    entries = session.exec(select(FoodLogDB).order_by(FoodLogDB.id.desc()).limit(limit)).all()  # type: ignore[attr-defined]
    logger.info("Returning %s logged food items", len(entries))
    return [FoodLog.model_validate(e.model_dump()) for e in entries]


@app.get("/search-food", response_model=FoodSearchResponse)
async def search_food(q: str = Query(..., min_length=1, max_length=120)) -> FoodSearchResponse:
    try:
        results = await search_food_products(q)
    except HTTPError as exc:
        logger.warning("Open Food Facts search failed for query=%s: %s", q, exc)
        raise HTTPException(status_code=502, detail="Open Food Facts request failed") from exc

    logger.info("Food search query=%s returned %s results", q, len(results))
    return FoodSearchResponse(query=q, results=results)
