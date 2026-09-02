from datetime import UTC, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# =========================================================================
# Food Log Schemas
# =========================================================================


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class FoodLogCreate(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, str_strip_whitespace=True)

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

    @field_validator("barcode", "image_url", "brand", "serving_size", mode="after")
    @classmethod
    def empty_optional_text_to_none(cls, value: Optional[str]) -> Optional[str]:
        return value or None

    @field_validator("nutri_score", mode="after")
    @classmethod
    def normalize_nutri_score(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.upper()
        if normalized not in {"A", "B", "C", "D", "E"}:
            raise ValueError("nutri_score must be one of A, B, C, D, or E")
        return normalized


class FoodLog(FoodLogCreate):
    id: int
    created_at: datetime

    @field_validator("created_at", mode="after")
    @classmethod
    def serialize_created_at_as_utc(cls, value: datetime) -> datetime:
        return _ensure_utc(value)


class FoodSearchResult(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

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


class IdentityStartRequest(BaseModel):
    """Optional browser locale context for a new login transaction."""

    model_config = ConfigDict(str_strip_whitespace=True)

    locale: Optional[str] = Field(default=None, max_length=64)


class IdentityStartResponse(BaseModel):
    """Response when starting the login flow."""

    state: str
    expires_at: datetime
    wordpress_signin_url: str
    browser_handoff_token: str
    locale: str

    @field_validator("expires_at", mode="after")
    @classmethod
    def serialize_expires_at_as_utc(cls, value: datetime) -> datetime:
        return _ensure_utc(value)


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
    locale: str


class IdentityLoginStatusRequest(BaseModel):
    """Proof presented only by the browser that started the login."""

    state: str = Field(..., min_length=32, max_length=255)
    browser_handoff_token: str = Field(..., min_length=32, max_length=255)


class IdentityLoginStatusResponse(BaseModel):
    """Progress or completion result for the original browser tab."""

    status: Literal["pending", "failed", "authenticated"]
    redirect_to: Optional[str] = None
    locale: str


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
    locale: str

    @field_validator("expires_at", mode="after")
    @classmethod
    def serialize_expires_at_as_utc(cls, value: datetime) -> datetime:
        return _ensure_utc(value)


class IdentityClaimsResponse(BaseModel):
    """Verified identity claims from WordPress bridge."""

    external_subject: str
    xrpl_address: Optional[str]
    issued_at: datetime
    expires_at: datetime
    jti: str  # Unique ID for this issuance

    @field_validator("issued_at", "expires_at", mode="after")
    @classmethod
    def normalize_claim_timestamps_to_utc(cls, value: datetime) -> datetime:
        return _ensure_utc(value)


class CurrentUserResponse(BaseModel):
    """Current authenticated user information."""

    user_id: str
    created_at: datetime

    @field_validator("created_at", mode="after")
    @classmethod
    def serialize_created_at_as_utc(cls, value: datetime) -> datetime:
        return _ensure_utc(value)


class AccountExportAccount(BaseModel):
    """Portable non-secret account fields owned by the authenticated user."""

    user_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    last_authenticated_activity_at: datetime

    @field_validator(
        "created_at",
        "updated_at",
        "last_authenticated_activity_at",
        mode="after",
    )
    @classmethod
    def normalize_account_timestamps(cls, value: datetime) -> datetime:
        return _ensure_utc(value)


class AccountExportExternalIdentity(BaseModel):
    """External identity link included in the user's private export."""

    provider: str
    external_subject: str
    xrpl_address: Optional[str]
    created_at: datetime
    last_verified_at: datetime

    @field_validator("created_at", "last_verified_at", mode="after")
    @classmethod
    def normalize_identity_timestamps(cls, value: datetime) -> datetime:
        return _ensure_utc(value)


class AccountExportAuthSession(BaseModel):
    """Session activity metadata without token hashes or internal identifiers."""

    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    revoked_at: Optional[datetime]

    @field_validator(
        "created_at",
        "last_seen_at",
        "expires_at",
        "revoked_at",
        mode="after",
    )
    @classmethod
    def normalize_session_timestamps(
        cls,
        value: Optional[datetime],
    ) -> Optional[datetime]:
        return _ensure_utc(value) if value is not None else None


class AccountExportAuthorizationEvent(BaseModel):
    """Reserved v1 shape for authorization activity with proven ownership."""

    external_subject: str
    created_at: datetime
    expires_at: datetime
    used_at: Optional[datetime]
    used_by_ip: Optional[str]

    @field_validator("created_at", "expires_at", "used_at", mode="after")
    @classmethod
    def normalize_authorization_timestamps(
        cls,
        value: Optional[datetime],
    ) -> Optional[datetime]:
        return _ensure_utc(value) if value is not None else None


class AccountExportLoginHandoff(BaseModel):
    """Browser handoff activity without state or handoff-token hashes."""

    status: str
    created_at: datetime
    expires_at: datetime
    completed_at: Optional[datetime]
    claimed_at: Optional[datetime]
    failure_code: Optional[str]

    @field_validator(
        "created_at",
        "expires_at",
        "completed_at",
        "claimed_at",
        mode="after",
    )
    @classmethod
    def normalize_handoff_timestamps(
        cls,
        value: Optional[datetime],
    ) -> Optional[datetime]:
        return _ensure_utc(value) if value is not None else None


class AccountExportInactiveAccountNotice(BaseModel):
    """Lifecycle evidence without internal or provider receipt identifiers."""

    status: Literal["delivered", "cancelled"]
    activity_anchor_at: datetime
    notice_window_started_at: datetime
    retention_due_at: datetime
    delivered_at: datetime
    delivery_channel: str
    cancelled_at: Optional[datetime]
    recorded_at: datetime

    @field_validator(
        "activity_anchor_at",
        "notice_window_started_at",
        "retention_due_at",
        "delivered_at",
        "cancelled_at",
        "recorded_at",
        mode="after",
    )
    @classmethod
    def normalize_notice_timestamps(
        cls,
        value: Optional[datetime],
    ) -> Optional[datetime]:
        return _ensure_utc(value) if value is not None else None


class AccountDataExportBase(BaseModel):
    """Fields shared by reviewed CalorieApp account-data export versions."""

    exported_at: datetime
    account: AccountExportAccount
    external_identities: list[AccountExportExternalIdentity]
    food_logs: list[FoodLog]
    authentication_sessions: list[AccountExportAuthSession]
    authorization_events: list[AccountExportAuthorizationEvent]
    login_handoffs: list[AccountExportLoginHandoff]
    inactive_account_notices: list[AccountExportInactiveAccountNotice]
    excluded_security_fields: list[str]

    @field_validator("exported_at", mode="after")
    @classmethod
    def normalize_export_timestamp(cls, value: datetime) -> datetime:
        return _ensure_utc(value)


class AccountDataExportV1Response(AccountDataExportBase):
    """Legacy v1 export retained for fail-closed import compatibility."""

    export_version: Literal["calorieapp-account-data-v1"]


class AccountExportImportReceipt(BaseModel):
    """Account-owned import history without private replay evidence."""

    imported_at: datetime
    food_log_count: int = Field(..., ge=0, le=10_000)
    source_export_version: Literal[
        "calorieapp-account-data-v1",
        "calorieapp-account-data-v2",
    ]
    import_plan_version: Literal["calorieapp-account-data-import-plan-v1"]

    @field_validator("imported_at", mode="after")
    @classmethod
    def normalize_import_timestamp(cls, value: datetime) -> datetime:
        return _ensure_utc(value)


class AccountDataExportResponse(AccountDataExportBase):
    """Current v2 export with minimal private import-history summaries."""

    export_version: Literal["calorieapp-account-data-v2"]
    account_import_receipts: list[AccountExportImportReceipt]


class AccountDataImportResponse(BaseModel):
    """Minimal result for one reviewed private account-data import."""

    import_version: Literal["calorieapp-account-data-import-transaction-v1"]
    status: Literal["imported", "already_imported"]
    imported_food_log_rows: int = Field(..., ge=0, le=10_000)


class AccountErasureRequest(BaseModel):
    """Explicit confirmation bound to the authenticated internal account."""

    model_config = ConfigDict(str_strip_whitespace=True)

    confirm_user_id: str = Field(..., min_length=1, max_length=64)
    acknowledgement: Literal["delete-my-calorieapp-account"]


class AccountErasureResponse(BaseModel):
    """Minimal response after irreversible primary-store erasure."""

    status: Literal["erased"]


class LogoutResponse(BaseModel):
    """Response after logout."""

    message: str
