"""Internal, bounded ingestion of quarantined source assertions."""

from __future__ import annotations

import hashlib
import re
from contextlib import nullcontext
from dataclasses import dataclass
from datetime import datetime
from threading import Lock

import sqlalchemy as sa
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from ..data_growth import DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS
from ..models import (
    FoodAttributeAssertionDB,
    FoodAttributeAssertionIngestAuditDB,
    FoodProductDB,
    FoodProductSourceLinkDB,
    FoodSourceDB,
    FoodSourceRecordDB,
    utc_now,
)
from ..postgresql_locking import acquire_bounded_transaction_advisory_locks
from ..source_assertion_policy import normalize_source_assertion_value


SOURCE_ASSERTION_INGEST_SCOPE = "catalog:source-assertion:ingest"
_ID_PATTERN = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,62}[A-Za-z0-9])?")
_IDEMPOTENCY_KEY_PATTERN = re.compile(
    r"[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,126}[A-Za-z0-9])?"
)
_SUBMITTER_REFERENCE_PATTERN = re.compile(
    r"[a-z0-9](?:[a-z0-9._:-]{0,118}[a-z0-9])?"
)
_ATTRIBUTE_KEY_PATTERN = re.compile(
    r"[a-z0-9](?:[a-z0-9._-]{0,118}[a-z0-9])?"
)
_UNIT_PATTERN = re.compile(r"[a-z0-9](?:[a-z0-9._:/-]{0,78}[a-z0-9])?")
_sqlite_assertion_ingest_lock = Lock()


class SourceAssertionIngestRejected(Exception):
    """Reject assertion ingest without retaining assertion or audit state."""

    def __init__(
        self,
        reason: str,
        *,
        status_code: int,
        retry_after_seconds: int | None = None,
    ) -> None:
        if status_code not in {403, 404, 409, 503}:
            raise ValueError("source assertion ingest status_code is invalid")
        if status_code == 503 and retry_after_seconds is None:
            raise ValueError("503 assertion ingest rejection requires Retry-After")
        if status_code != 503 and retry_after_seconds is not None:
            raise ValueError("only unavailable assertion ingest uses Retry-After")
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class SourceAssertionIngestResult:
    assertion: FoodAttributeAssertionDB
    audit: FoodAttributeAssertionIngestAuditDB
    created: bool


def _validate_request(
    *,
    food_product_id: str,
    source_record_id: str,
    expected_source_record_version: int,
    idempotency_key: str,
    submitter_reference: str,
    authorization_scope: str,
    attribute_key: str,
    value: str,
    unit_or_value_type: str,
    observed_or_effective_at: datetime,
) -> str:
    for field_name, field_value in (
        ("food_product_id", food_product_id),
        ("source_record_id", source_record_id),
    ):
        if not _ID_PATTERN.fullmatch(field_value):
            raise ValueError(f"{field_name} must use the reviewed identifier format")
    if (
        type(expected_source_record_version) is not int
        or expected_source_record_version <= 0
    ):
        raise ValueError("expected_source_record_version must be a positive integer")
    if not _IDEMPOTENCY_KEY_PATTERN.fullmatch(idempotency_key):
        raise ValueError(
            "idempotency_key must use the reviewed 1 to 128 character format"
        )
    if not _SUBMITTER_REFERENCE_PATTERN.fullmatch(submitter_reference):
        raise ValueError("submitter_reference must use the pseudonymous format")
    if authorization_scope != SOURCE_ASSERTION_INGEST_SCOPE:
        raise SourceAssertionIngestRejected(
            "source_assertion_ingest_scope_denied",
            status_code=403,
        )
    if not _ATTRIBUTE_KEY_PATTERN.fullmatch(attribute_key):
        raise ValueError("attribute_key must use the reviewed namespaced format")
    if not _UNIT_PATTERN.fullmatch(unit_or_value_type):
        raise ValueError("unit_or_value_type must use the reviewed controlled format")
    normalized_value = normalize_source_assertion_value(
        attribute_key=attribute_key,
        value=value,
        unit_or_value_type=unit_or_value_type,
    )
    if observed_or_effective_at.tzinfo is not None:
        raise ValueError("observed_or_effective_at must be a naive UTC datetime")
    return normalized_value


def _advisory_lock_key(domain: str, value: str) -> int:
    raw = int.from_bytes(
        hashlib.sha256(f"{domain}:{value}".encode("utf-8")).digest()[:8],
        byteorder="big",
        signed=False,
    )
    return raw - (1 << 64) if raw >= (1 << 63) else raw


def _matches_request(
    assertion: FoodAttributeAssertionDB,
    audit: FoodAttributeAssertionIngestAuditDB,
    *,
    food_product_id: str,
    source_record_id: str,
    expected_source_record_version: int,
    submitter_reference: str,
    authorization_scope: str,
    attribute_key: str,
    value: str,
    unit_or_value_type: str,
    observed_or_effective_at: datetime,
) -> bool:
    return (
        assertion.food_product_id == food_product_id
        and assertion.source_record_id == source_record_id
        and assertion.attribute_key == attribute_key
        and assertion.value == value
        and assertion.unit_or_value_type == unit_or_value_type
        and assertion.observed_or_effective_at == observed_or_effective_at
        and assertion.verification_status == "quarantined"
        and assertion.verification_version == 1
        and assertion.supersedes_assertion_id is None
        and audit.expected_source_record_version == expected_source_record_version
        and audit.resulting_assertion_version == 1
        and audit.submitter_reference == submitter_reference
        and audit.authorization_scope == authorization_scope
    )


def _ingest_locked(
    session: Session,
    *,
    food_product_id: str,
    source_record_id: str,
    expected_source_record_version: int,
    idempotency_key: str,
    submitter_reference: str,
    authorization_scope: str,
    attribute_key: str,
    value: str,
    unit_or_value_type: str,
    observed_or_effective_at: datetime,
) -> SourceAssertionIngestResult:
    existing_audit = session.exec(
        select(FoodAttributeAssertionIngestAuditDB).where(
            FoodAttributeAssertionIngestAuditDB.idempotency_key == idempotency_key
        )
    ).first()
    if existing_audit is not None:
        existing_assertion = session.get(
            FoodAttributeAssertionDB,
            existing_audit.assertion_id,
        )
        if existing_assertion is None or not _matches_request(
            existing_assertion,
            existing_audit,
            food_product_id=food_product_id,
            source_record_id=source_record_id,
            expected_source_record_version=expected_source_record_version,
            submitter_reference=submitter_reference,
            authorization_scope=authorization_scope,
            attribute_key=attribute_key,
            value=value,
            unit_or_value_type=unit_or_value_type,
            observed_or_effective_at=observed_or_effective_at,
        ):
            raise SourceAssertionIngestRejected(
                "source_assertion_ingest_idempotency_conflict",
                status_code=409,
            )
        session.commit()
        session.refresh(existing_assertion)
        session.refresh(existing_audit)
        return SourceAssertionIngestResult(
            existing_assertion,
            existing_audit,
            False,
        )

    record = session.get(FoodSourceRecordDB, source_record_id)
    if record is None:
        raise SourceAssertionIngestRejected(
            "source_record_not_found",
            status_code=404,
        )
    if record.verification_version != expected_source_record_version:
        raise SourceAssertionIngestRejected(
            "source_record_version_conflict",
            status_code=409,
        )
    if record.verification_status != "validated":
        raise SourceAssertionIngestRejected(
            "source_record_not_validated",
            status_code=409,
        )
    source = session.get(FoodSourceDB, record.source_id)
    if source is None or source.status != "enabled":
        raise SourceAssertionIngestRejected(
            "source_assertion_ingest_not_enabled",
            status_code=409,
        )
    if session.get_bind().dialect.name == "postgresql":
        acquire_bounded_transaction_advisory_locks(
            session,
            [
                _advisory_lock_key(
                    "source-assertion-ingest-source",
                    source.id,
                )
            ],
        )
    product = session.get(FoodProductDB, food_product_id)
    if product is None:
        raise SourceAssertionIngestRejected(
            "food_product_not_found",
            status_code=404,
        )
    if product.status != "active":
        raise SourceAssertionIngestRejected(
            "food_product_not_active",
            status_code=409,
        )
    link = session.exec(
        select(FoodProductSourceLinkDB).where(
            FoodProductSourceLinkDB.food_product_id == food_product_id,
            FoodProductSourceLinkDB.source_record_id == source_record_id,
        )
    ).first()
    if link is None or link.review_status != "validated":
        raise SourceAssertionIngestRejected(
            "product_source_link_not_validated",
            status_code=409,
        )

    existing_evidence = session.exec(
        select(FoodAttributeAssertionDB).where(
            FoodAttributeAssertionDB.food_product_id == food_product_id,
            FoodAttributeAssertionDB.source_record_id == source_record_id,
            FoodAttributeAssertionDB.attribute_key == attribute_key,
            FoodAttributeAssertionDB.value == value,
            FoodAttributeAssertionDB.unit_or_value_type == unit_or_value_type,
            FoodAttributeAssertionDB.observed_or_effective_at
            == observed_or_effective_at,
        )
    ).first()
    if existing_evidence is not None:
        raise SourceAssertionIngestRejected(
            "source_assertion_evidence_already_exists",
            status_code=409,
        )

    assertion_count = int(
        session.exec(
            select(sa.func.count(FoodAttributeAssertionDB.id))
            .join(
                FoodSourceRecordDB,
                FoodSourceRecordDB.id == FoodAttributeAssertionDB.source_record_id,
            )
            .where(FoodSourceRecordDB.source_id == source.id)
        ).one()
    )
    if assertion_count >= source.assertion_limit:
        raise SourceAssertionIngestRejected(
            "source_assertion_budget_reached",
            status_code=409,
        )

    assertion = FoodAttributeAssertionDB(
        food_product_id=food_product_id,
        source_record_id=source_record_id,
        attribute_key=attribute_key,
        value=value,
        unit_or_value_type=unit_or_value_type,
        observed_or_effective_at=observed_or_effective_at,
        verification_status="quarantined",
        verification_version=1,
        supersedes_assertion_id=None,
        created_at=utc_now(),
    )
    audit = FoodAttributeAssertionIngestAuditDB(
        assertion_id=assertion.id,
        food_product_id=food_product_id,
        source_record_id=source_record_id,
        idempotency_key=idempotency_key,
        expected_source_record_version=expected_source_record_version,
        resulting_assertion_version=1,
        submitter_reference=submitter_reference,
        authorization_scope=authorization_scope,
        created_at=utc_now(),
    )
    session.add_all([assertion, audit])
    session.commit()
    session.refresh(assertion)
    session.refresh(audit)
    return SourceAssertionIngestResult(assertion, audit, True)


def ingest_source_assertion(
    session: Session,
    *,
    food_product_id: str,
    source_record_id: str,
    expected_source_record_version: int,
    idempotency_key: str,
    submitter_reference: str,
    authorization_scope: str,
    attribute_key: str,
    value: str,
    unit_or_value_type: str,
    observed_or_effective_at: datetime,
) -> SourceAssertionIngestResult:
    """Insert one quarantined assertion and audit receipt atomically."""

    normalized_value = _validate_request(
        food_product_id=food_product_id,
        source_record_id=source_record_id,
        expected_source_record_version=expected_source_record_version,
        idempotency_key=idempotency_key,
        submitter_reference=submitter_reference,
        authorization_scope=authorization_scope,
        attribute_key=attribute_key,
        value=value,
        unit_or_value_type=unit_or_value_type,
        observed_or_effective_at=observed_or_effective_at,
    )

    try:
        backend = session.get_bind().dialect.name
        if backend == "postgresql":
            acquire_bounded_transaction_advisory_locks(
                session,
                {
                    _advisory_lock_key(
                        "source-assertion-ingest-record",
                        source_record_id,
                    ),
                    _advisory_lock_key(
                        "source-assertion-ingest-idempotency",
                        idempotency_key,
                    ),
                },
            )
            local_lock = nullcontext()
        elif backend == "sqlite":
            local_lock = _sqlite_assertion_ingest_lock
        else:
            raise TypeError("unsupported database backend for assertion ingest")

        with local_lock:
            return _ingest_locked(
                session,
                food_product_id=food_product_id,
                source_record_id=source_record_id,
                expected_source_record_version=expected_source_record_version,
                idempotency_key=idempotency_key,
                submitter_reference=submitter_reference,
                authorization_scope=authorization_scope,
                attribute_key=attribute_key,
                value=normalized_value,
                unit_or_value_type=unit_or_value_type,
                observed_or_effective_at=observed_or_effective_at,
            )
    except SourceAssertionIngestRejected:
        session.rollback()
        raise
    except (SQLAlchemyError, TypeError) as exc:
        session.rollback()
        raise SourceAssertionIngestRejected(
            "source_assertion_ingest_unavailable",
            status_code=503,
            retry_after_seconds=DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS,
        ) from exc
