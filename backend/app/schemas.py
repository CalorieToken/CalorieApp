from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# =========================================================================
# Food Log Schemas
# =========================================================================


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


# =========================================================================
# Identity Schemas
# =========================================================================


class IdentityStartResponse(BaseModel):
    """Response when starting the login flow."""

    state: str
    expires_at: datetime
    wordpress_signin_url: str


class IdentityCallbackRequest(BaseModel):
    """Browser callback contract for a pending login attempt.

    The callback is intentionally limited to code + state. The server-side
    pending login information is kept in a server-side lookup keyed by state,
    so the browser never controls the backend's internal login-session ID.
    """

    code: str = Field(..., min_length=1, max_length=255)
    state: str = Field(..., min_length=1, max_length=255)


class IdentityCallbackResponse(BaseModel):
    """Response after a successful browser callback + server exchange."""

    user_id: str
    created: bool
    redirect_to: str


class IdentityExchangeRequest(BaseModel):
    """Request from CalorieApp frontend to exchange code server-to-server."""

    code: str
    state: str
    client_id: str  # CalorieApp backend identifier


class IdentityStateValidationRequest(BaseModel):
    """Bridge-to-backend request for validating a pending login state."""

    state: str = Field(..., min_length=32, max_length=255)


class IdentityStateValidationResponse(BaseModel):
    """Result for bridge state validation."""

    valid: bool
    expires_at: datetime


class IdentityClaimsResponse(BaseModel):
    """Verified identity claims from WordPress bridge."""

    external_subject: str
    xrpl_address: Optional[str]
    issued_at: datetime
    expires_at: datetime
    jti: str  # Unique ID for this issuance


class CurrentUserResponse(BaseModel):
    """Current authenticated user information."""

    user_id: str
    created_at: datetime


class LogoutResponse(BaseModel):
    """Response after logout."""

    message: str