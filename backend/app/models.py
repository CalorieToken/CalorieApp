"""
SQLModel table definitions for CalorieApp backend.
FoodLogDB maps to the provider-neutral food_log table.
Also includes identity tables: CalorieAppUser, ExternalIdentity, AuthorizationCode.
"""
from datetime import UTC, datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKeyConstraint,
    Index,
    UniqueConstraint,
)
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    """Return naive UTC for compatibility with SQLite DateTime columns."""
    return datetime.now(UTC).replace(tzinfo=None)


class FoodLogDB(SQLModel, table=True):
    """Persistent food log entry owned by one internal CalorieApp user."""

    __tablename__ = "food_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    product_name: str = Field(min_length=1, max_length=120)
    calories: float = Field(ge=0)
    protein: float = Field(default=0.0, ge=0)
    fat: float = Field(default=0.0, ge=0)
    carbohydrates: float = Field(default=0.0, ge=0)
    portion_percentage: Optional[float] = Field(default=None, ge=1, le=100)
    barcode: Optional[str] = Field(default=None, max_length=64)
    image_url: Optional[str] = Field(default=None, max_length=500)
    brand: Optional[str] = Field(default=None, max_length=160)
    serving_size: Optional[str] = Field(default=None, max_length=80)
    nutri_score: Optional[str] = Field(default=None, max_length=2)
    created_at: datetime = Field(default_factory=utc_now)
    owner_id: Optional[str] = Field(
        default=None,
        foreign_key="calorieappuser.id",
        index=True,
    )


class FoodSourceDB(SQLModel, table=True):
    """Reviewed source registration; no public onboarding route exists."""

    __tablename__ = "food_source"
    __table_args__ = (
        UniqueConstraint("source_key", name="uq_food_source_key"),
        CheckConstraint(
            "status IN ('staged', 'enabled', 'paused', 'disabled')",
            name="ck_food_source_status",
        ),
        CheckConstraint("record_limit > 0", name="ck_food_source_record_limit"),
        CheckConstraint(
            "assertion_limit > 0",
            name="ck_food_source_assertion_limit",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    source_key: str = Field(max_length=100)
    source_category: str = Field(max_length=80)
    operator_name: str = Field(max_length=160)
    status: str = Field(default="staged", max_length=20)
    licence_id: str = Field(max_length=120)
    terms_reference: str = Field(max_length=500)
    attribution_text: str = Field(max_length=500)
    record_limit: int = Field(gt=0)
    created_at: datetime = Field(default_factory=utc_now)
    assertion_limit: int = Field(default=1000, gt=0)


class FoodSourceRecordDB(SQLModel, table=True):
    """Immutable, source-specific record identity without a raw payload."""

    __tablename__ = "food_source_record"
    __table_args__ = (
        UniqueConstraint(
            "source_id",
            "external_record_id",
            "source_version_or_content_digest",
            name="uq_food_source_record_idempotency",
        ),
        CheckConstraint(
            "verification_status IN ('quarantined', 'validated', 'rejected')",
            name="ck_food_source_record_verification_status",
        ),
        CheckConstraint(
            "verification_version > 0",
            name="ck_food_source_record_verification_version",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    source_id: str = Field(foreign_key="food_source.id", index=True)
    external_record_id: str = Field(max_length=255)
    source_version_or_content_digest: str = Field(max_length=128)
    retrieved_or_submitted_at: datetime = Field(default_factory=utc_now)
    verification_status: str = Field(default="quarantined", max_length=20)
    verification_version: int = Field(default=1, gt=0)


class FoodSourceModerationAuditDB(SQLModel, table=True):
    """Minimal append-only evidence for one terminal source-record decision."""

    __tablename__ = "food_source_moderation_audit"
    __table_args__ = (
        UniqueConstraint(
            "idempotency_key",
            name="uq_food_source_moderation_audit_idempotency",
        ),
        CheckConstraint(
            "previous_status = 'quarantined'",
            name="ck_food_source_moderation_audit_previous_status",
        ),
        CheckConstraint(
            "new_status IN ('validated', 'rejected')",
            name="ck_food_source_moderation_audit_new_status",
        ),
        CheckConstraint(
            "expected_version > 0 AND resulting_version = expected_version + 1",
            name="ck_food_source_moderation_audit_versions",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    source_record_id: str = Field(
        foreign_key="food_source_record.id",
        index=True,
    )
    idempotency_key: str = Field(max_length=128)
    expected_version: int = Field(gt=0)
    resulting_version: int = Field(gt=1)
    previous_status: str = Field(max_length=20)
    new_status: str = Field(max_length=20)
    moderator_reference: str = Field(max_length=120)
    authorization_scope: str = Field(max_length=80)
    reason_code: str = Field(max_length=80)
    created_at: datetime = Field(default_factory=utc_now)


class FoodProductDB(SQLModel, table=True):
    """Source-neutral catalog identity without a provider-owned display value."""

    __tablename__ = "food_product"
    __table_args__ = (
        CheckConstraint(
            "status IN ('staged', 'active', 'deprecated')",
            name="ck_food_product_status",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    status: str = Field(default="staged", max_length=20)
    created_at: datetime = Field(default_factory=utc_now)


class FoodProductSourceLinkDB(SQLModel, table=True):
    """Reviewable match between one source record and a neutral product."""

    __tablename__ = "food_product_source_link"
    __table_args__ = (
        UniqueConstraint(
            "food_product_id",
            "source_record_id",
            name="uq_food_product_source_link_pair",
        ),
        CheckConstraint(
            "match_confidence >= 0 AND match_confidence <= 1",
            name="ck_food_product_source_link_confidence",
        ),
        CheckConstraint(
            "review_status IN ('quarantined', 'validated', 'rejected')",
            name="ck_food_product_source_link_review_status",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    food_product_id: str = Field(foreign_key="food_product.id", index=True)
    source_record_id: str = Field(foreign_key="food_source_record.id", index=True)
    match_method: str = Field(max_length=80)
    match_confidence: float = Field(ge=0, le=1)
    review_status: str = Field(default="quarantined", max_length=20)
    created_at: datetime = Field(default_factory=utc_now)


class FoodAttributeAssertionDB(SQLModel, table=True):
    """Immutable source-specific fact with optional correction provenance."""

    __tablename__ = "food_attribute_assertion"
    __table_args__ = (
        ForeignKeyConstraint(
            ("food_product_id", "source_record_id"),
            (
                "food_product_source_link.food_product_id",
                "food_product_source_link.source_record_id",
            ),
            name="fk_food_attribute_assertion_product_source_link",
        ),
        UniqueConstraint(
            "food_product_id",
            "source_record_id",
            "attribute_key",
            "value",
            "unit_or_value_type",
            "observed_or_effective_at",
            name="uq_food_attribute_assertion_evidence",
        ),
        UniqueConstraint(
            "id",
            "food_product_id",
            "source_record_id",
            name="uq_food_attribute_assertion_lineage_target",
        ),
        Index(
            "ux_food_assertion_correction_lineage",
            "id",
            "supersedes_assertion_id",
            unique=True,
        ),
        Index(
            "ux_food_assertion_correction_predecessor",
            "supersedes_assertion_id",
            unique=True,
        ),
        ForeignKeyConstraint(
            (
                "supersedes_assertion_id",
                "food_product_id",
                "source_record_id",
            ),
            (
                "food_attribute_assertion.id",
                "food_attribute_assertion.food_product_id",
                "food_attribute_assertion.source_record_id",
            ),
            name="fk_food_attribute_assertion_supersedes_same_lineage",
        ),
        CheckConstraint(
            "verification_status IN ('quarantined', 'validated', 'rejected')",
            name="ck_food_attribute_assertion_verification_status",
        ),
        CheckConstraint(
            "verification_version > 0",
            name="ck_food_attribute_assertion_verification_version",
        ),
        CheckConstraint(
            "supersedes_assertion_id IS NULL OR supersedes_assertion_id <> id",
            name="ck_food_attribute_assertion_not_self_superseding",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    food_product_id: str = Field(index=True)
    source_record_id: str = Field(index=True)
    attribute_key: str = Field(max_length=120)
    value: str = Field(max_length=255)
    unit_or_value_type: str = Field(max_length=80)
    observed_or_effective_at: datetime
    verification_status: str = Field(default="quarantined", max_length=20)
    verification_version: int = Field(default=1, gt=0)
    supersedes_assertion_id: Optional[str] = Field(
        default=None,
        index=True,
    )
    created_at: datetime = Field(default_factory=utc_now)


class FoodAttributeAssertionIngestAuditDB(SQLModel, table=True):
    """Minimal append-only receipt for one internal assertion ingest."""

    __tablename__ = "food_attribute_assertion_ingest_audit"
    __table_args__ = (
        ForeignKeyConstraint(
            ("assertion_id", "food_product_id", "source_record_id"),
            (
                "food_attribute_assertion.id",
                "food_attribute_assertion.food_product_id",
                "food_attribute_assertion.source_record_id",
            ),
            name="fk_food_assertion_ingest_audit_assertion_lineage",
        ),
        UniqueConstraint(
            "assertion_id",
            name="uq_food_assertion_ingest_audit_assertion",
        ),
        UniqueConstraint(
            "idempotency_key",
            name="uq_food_assertion_ingest_audit_idempotency",
        ),
        CheckConstraint(
            "expected_source_record_version > 0 "
            "AND resulting_assertion_version = 1",
            name="ck_food_assertion_ingest_audit_versions",
        ),
        CheckConstraint(
            "authorization_scope = 'catalog:source-assertion:ingest'",
            name="ck_food_assertion_ingest_audit_scope",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    assertion_id: str = Field(index=True)
    food_product_id: str = Field(index=True)
    source_record_id: str = Field(index=True)
    idempotency_key: str = Field(max_length=128)
    expected_source_record_version: int = Field(gt=0)
    resulting_assertion_version: int = Field(default=1, ge=1, le=1)
    submitter_reference: str = Field(max_length=120)
    authorization_scope: str = Field(max_length=80)
    created_at: datetime = Field(default_factory=utc_now)


class FoodAttributeAssertionModerationAuditDB(SQLModel, table=True):
    """Minimal append-only evidence for one terminal assertion decision."""

    __tablename__ = "food_attribute_assertion_moderation_audit"
    __table_args__ = (
        UniqueConstraint(
            "assertion_id",
            name="uq_food_assertion_moderation_audit_assertion",
        ),
        UniqueConstraint(
            "idempotency_key",
            name="uq_food_assertion_moderation_audit_idempotency",
        ),
        CheckConstraint(
            "previous_status = 'quarantined'",
            name="ck_food_assertion_moderation_audit_previous_status",
        ),
        CheckConstraint(
            "new_status IN ('validated', 'rejected')",
            name="ck_food_assertion_moderation_audit_new_status",
        ),
        CheckConstraint(
            "expected_version > 0 AND resulting_version = expected_version + 1",
            name="ck_food_assertion_moderation_audit_versions",
        ),
        CheckConstraint(
            "authorization_scope = 'catalog:source-assertion:moderate'",
            name="ck_food_assertion_moderation_audit_scope",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    assertion_id: str = Field(
        foreign_key="food_attribute_assertion.id",
        index=True,
    )
    idempotency_key: str = Field(max_length=128)
    expected_version: int = Field(gt=0)
    resulting_version: int = Field(gt=1)
    previous_status: str = Field(max_length=20)
    new_status: str = Field(max_length=20)
    moderator_reference: str = Field(max_length=120)
    authorization_scope: str = Field(max_length=80)
    reason_code: str = Field(max_length=80)
    created_at: datetime = Field(default_factory=utc_now)


class FoodAttributeAssertionCorrectionAuditDB(SQLModel, table=True):
    """Minimal append-only receipt for one retained assertion correction."""

    __tablename__ = "food_attribute_assertion_correction_audit"
    __table_args__ = (
        ForeignKeyConstraint(
            ("correction_assertion_id", "predecessor_assertion_id"),
            (
                "food_attribute_assertion.id",
                "food_attribute_assertion.supersedes_assertion_id",
            ),
            name="fk_food_assertion_correction_audit_lineage",
        ),
        UniqueConstraint(
            "predecessor_assertion_id",
            name="uq_food_assertion_correction_audit_predecessor",
        ),
        UniqueConstraint(
            "correction_assertion_id",
            name="uq_food_assertion_correction_audit_correction",
        ),
        UniqueConstraint(
            "idempotency_key",
            name="uq_food_assertion_correction_audit_idempotency",
        ),
        CheckConstraint(
            "expected_predecessor_version > 0 "
            "AND resulting_correction_version = 1",
            name="ck_food_assertion_correction_audit_versions",
        ),
        CheckConstraint(
            "predecessor_assertion_id <> correction_assertion_id",
            name="ck_food_assertion_correction_audit_distinct_assertions",
        ),
        CheckConstraint(
            "authorization_scope = 'catalog:source-assertion:correct'",
            name="ck_food_assertion_correction_audit_scope",
        ),
        Index(
            "ix_food_assert_corr_audit_predecessor",
            "predecessor_assertion_id",
        ),
        Index(
            "ix_food_assert_corr_audit_correction",
            "correction_assertion_id",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    predecessor_assertion_id: str = Field(foreign_key="food_attribute_assertion.id")
    correction_assertion_id: str = Field(foreign_key="food_attribute_assertion.id")
    idempotency_key: str = Field(max_length=128)
    expected_predecessor_version: int = Field(gt=0)
    resulting_correction_version: int = Field(default=1, ge=1, le=1)
    corrector_reference: str = Field(max_length=120)
    authorization_scope: str = Field(max_length=80)
    reason_code: str = Field(max_length=80)
    created_at: datetime = Field(default_factory=utc_now)


class CalorieAppUserDB(SQLModel, table=True):
    """Internal CalorieApp user identity. Immutable identifier."""

    __tablename__ = "calorieappuser"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    status: str = Field(default="active")


class ExternalIdentityDB(SQLModel, table=True):
    """Link CalorieAppUser to an external identity provider."""

    __tablename__ = "externalidentity"
    __table_args__ = (
        UniqueConstraint("provider", "external_subject", name="uq_externalidentity_provider_subject"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    calorieapp_user_id: str = Field(foreign_key="calorieappuser.id")
    provider: str = Field(max_length=50, index=True)  # e.g., "wordpress_xumm"
    external_subject: str = Field(max_length=255, index=True)  # e.g., WordPress user ID
    xrpl_address: Optional[str] = Field(default=None, max_length=34)  # XRPL r-address
    created_at: datetime = Field(default_factory=utc_now)
    last_verified_at: datetime = Field(default_factory=utc_now)


class AuthorizationCodeDB(SQLModel, table=True):
    """One-time authorization code for code exchange flow."""

    __tablename__ = "authorizationcode"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    code_hash: str = Field(max_length=255, unique=True)  # SHA256 hash of the actual code
    external_subject: str = Field(max_length=255)  # WordPress user ID
    xrpl_address: Optional[str] = Field(default=None, max_length=34)
    state: str = Field(max_length=255)  # CSRF state value
    login_session_id: str = Field(max_length=255)  # Unique login attempt identifier
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime  # When the code expires (default 60s)
    used_at: Optional[datetime] = Field(default=None)  # When code was exchanged
    used_by_ip: Optional[str] = Field(default=None, max_length=45)  # IPv4 or IPv6


class PendingLoginStateDB(SQLModel, table=True):
    """Persistent login transaction state used for XUMM callback protection."""

    __tablename__ = "pendingloginstate"
    __table_args__ = (
        Index(
            "ix_pendingloginstate_client_created",
            "client_id",
            "created_at",
        ),
        Index(
            "ix_pendingloginstate_client_expires",
            "client_id",
            "expires_at",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    state_hash: str = Field(max_length=64, unique=True, index=True)
    status: str = Field(default="pending", max_length=20, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
    consumed_at: Optional[datetime] = Field(default=None)
    post_login_redirect: Optional[str] = Field(default=None, max_length=255)
    client_id: str = Field(default="legacy", max_length=120)


class PendingLoginLocaleDB(SQLModel, table=True):
    """Ephemeral locale context bound to a hashed login state."""

    __tablename__ = "pendingloginlocale"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    state_hash: str = Field(max_length=64, unique=True, index=True)
    locale: str = Field(default="en", max_length=16)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime = Field(index=True)


class OriginLoginHandoffDB(SQLModel, table=True):
    """One-time proof that lets the browser which started login claim a session."""

    __tablename__ = "originloginhandoff"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    state_hash: str = Field(max_length=64, unique=True, index=True)
    handoff_token_hash: str = Field(max_length=64, index=True)
    status: str = Field(default="pending", max_length=20, index=True)
    calorieapp_user_id: Optional[str] = Field(
        default=None,
        foreign_key="calorieappuser.id",
        index=True,
    )
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime = Field(index=True)
    completed_at: Optional[datetime] = Field(default=None)
    claimed_at: Optional[datetime] = Field(default=None)
    failure_code: Optional[str] = Field(default=None, max_length=40)


class AuthSessionDB(SQLModel, table=True):
    """Opaque server-side authentication session."""

    __tablename__ = "authsession"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    session_token_hash: str = Field(max_length=64, unique=True, index=True)
    calorieapp_user_id: str = Field(foreign_key="calorieappuser.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    last_seen_at: datetime = Field(default_factory=utc_now, index=True)
    expires_at: datetime = Field(index=True)
    revoked_at: Optional[datetime] = Field(default=None, index=True)
    replaced_by_session_id: Optional[str] = Field(default=None, foreign_key="authsession.id")


class BridgeAuthNonceDB(SQLModel, table=True):
    """One-time nonce records used for bridge-auth replay protection."""

    __tablename__ = "bridgeauthnonce"
    __table_args__ = (
        UniqueConstraint("client_id", "nonce_hash", "context", name="uq_bridgeauthnonce_context_nonce"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    client_id: str = Field(max_length=120, index=True)
    nonce_hash: str = Field(max_length=64, index=True)
    context: str = Field(max_length=60, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime = Field(index=True)


class ProviderRateEventDB(SQLModel, table=True):
    """Low-cardinality shared admission event without request or user data."""

    __tablename__ = "provider_rate_event"
    __table_args__ = (
        Index(
            "ix_provider_rate_event_provider_admitted",
            "provider_key",
            "admitted_at",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, max_length=36)
    provider_key: str = Field(max_length=100)
    admitted_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class RouteRateEventDB(SQLModel, table=True):
    """Low-cardinality shared route admission without request identity data."""

    __tablename__ = "route_rate_event"
    __table_args__ = (
        Index(
            "ix_route_rate_event_route_admitted",
            "route_key",
            "admitted_at",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True, max_length=36)
    route_key: str = Field(max_length=100)
    admitted_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
