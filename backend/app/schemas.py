from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class FoodLogCreate(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=120)
    calories: float = Field(..., ge=0)
    protein: float = Field(default=0, ge=0)
    fat: float = Field(default=0, ge=0)
    carbohydrates: float = Field(default=0, ge=0)
    portion_percentage: Optional[float] = Field(default=None, ge=1, le=100)
    barcode: Optional[str] = Field(default=None, max_length=64)
    image_url: Optional[str] = Field(default=None, max_length=500)
    brand: Optional[str] = Field(default=None, max_length=160)
    serving_size: Optional[str] = Field(default=None, max_length=80)
    nutri_score: Optional[str] = Field(default=None, min_length=1, max_length=2)


class FoodLog(FoodLogCreate):
    id: int
    created_at: datetime


class FoodSearchResult(BaseModel):
    product_name: str
    calories: float = 0
    protein: float = 0
    fat: float = 0
    carbohydrates: float = 0
    image_url: Optional[str] = None
    barcode: Optional[str] = None
    brand: Optional[str] = None
    serving_size: Optional[str] = None
    nutri_score: Optional[str] = None


class FoodSearchResponse(BaseModel):
    query: str
    results: list[FoodSearchResult]
