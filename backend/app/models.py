"""
SQLModel table definitions for CalorieApp backend.
FoodLogDB maps to the food_log table in calorieapp.db.
"""
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class FoodLogDB(SQLModel, table=True):
    """Persistent food log entry stored in SQLite."""

    __tablename__ = "food_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    product_name: str = Field(min_length=1, max_length=120)
    calories: float = Field(ge=0)
    protein: float = Field(default=0.0, ge=0)
    fat: float = Field(default=0.0, ge=0)
    carbohydrates: float = Field(default=0.0, ge=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
