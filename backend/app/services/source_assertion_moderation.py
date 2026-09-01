"""Internal, versioned moderation for quarantined source assertions."""

from __future__ import annotations

import hashlib
import re
from contextlib import nullcontext
from dataclasses import dataclass
from threading import Lock

from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from ..data_growth import DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS
from ..models import (
    FoodAttributeAssertionDB,
    FoodAttributeAssertionModerationAuditDB,
    FoodProductDB,
    FoodProductSourceLinkDB,
    FoodSourceDB,
    FoodSourceRecordDB,
    utc_now,
)
from ..postgresql_locking import acquire_bounded_transaction_advisory_locks
from ..source_assertion_policy import normalize_source_assertion_value


SOURCE_ASSERTION_MODERATION_SCOPE = "catalog:source-assertion:moderate"
SOURCE_ASSERTION_MODERATION_TARGET_STATUSES = frozenset({"validated", "rejected"})
_ID_PATTERN = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,62}[A-Za-z0-9])?")
_IDEMPOTENCY_KEY_PATTERN = re.compile(
    r"[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,126}[A-Za-z0-9])?"
)
_MODERATOR_REFERENCE_PATTERN = re.compile(
    r"[a-z0-9](?:[a-z0-9._:-]{0,118}[a-z0-9])?"
)
_REASON_CODE_PATTERN = re.compile(r"[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?")
_sqlite_assertion_moderation_lock = Lock()


class SourceAssertionModerationRejected(Exception):
    """Fail a moderation attempt without changing assertion or audit history."""

    def __init__(
        self,
        reason: str,
        *,
        status_code: int,
        retry_after_seconds: int | None = None,
    ) -> None:
        if status_code not in {403, 404, 409, 503}:
            raise ValueError("source assertion moderation status_code is invalid")
        if status_code == 503 and retry_after_seconds is None:
            raise ValueError("503 assertion moderation rejection requires Retry-After")
        if status_code != 503 and retry_after_seconds is not None:
            raise ValueError("only unavailable assertion moderation uses Retry-After")
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class SourceAssertionModerationResult:
    assertion: FoodAttributeAssertionDB
    audit: FoodAttributeAssertionModerationAuditDB
    created: bool


def _validate_request(
    *,
    assertion_id: str,
    target_status: str,
    expected_version: int,
    idempotency_key: str,
    moderator_reference: str,
    authorization_scope: str,
    reason_code: str,
) -> None:
    if not _ID_PATTERN.fullmatch(assertion_id):
        raise ValueError("assertion_id must use the reviewed identifier format")
    if target_status not in SOURCE_ASSERTION_MODERATION_TARGET_STATUSES:
        raise ValueError("target_status must be validated or rejected")
    if type(expected_version) is not int or expected_version <= 0:
        raise ValueError("expected_version must be a positive integer")
    if not _IDEMPOTENCY_KEY_PATTERN.fullmatch(idempotency_key):
        raise ValueError(
            "idempotency_key must use the reviewed 1 to 128 character format"
        )
    if not _MODERATOR_REFERENCE_PATTERN.fullmatch(moderator_reference):
        raise ValueError(
            "moderator_reference must use the reviewed pseudonymous format"
        )
    if authorization_scope != SOURCE_ASSERTION_MODERATION_SCOPE:
        raise SourceAssertionModerationRejected(
            "source_assertion_moderation_scope_denied",
            status_code=403,
        )
    if not _REASON_CODE_PATTERN.fullmatch(reason_code):
        raise ValueError("reason_code must use the reviewed 1 to 80 character format")


def _advisory_lock_key(domain: str, value: str) -> int:
    raw = int.from_bytes(
        hashlib.sha256(f"{domain}:{value}".encode("utf-8")).digest()[:8],
        byteorder="big",
        signed=False,
    )
    return raw - (1 << 64) if raw >= (1 << 63) else raw


def _matches_request(
    audit: FoodAttributeAssertionModerationAuditDB,
    *,
    assertion_id: str,
    target_status: str,
    expected_version: int,
    moderator_reference: str,
    authorization_scope: str,
    reason_code: str,
) -> bool:
    return (
        audit.assertion_id == assertion_id
        and audit.new_status == target_status
        and audit.expected_version == expected_version
        and audit.moderator_reference == moderator_reference
        and audit.authorization_scope == authorization_scope
        and audit.reason_code == reason_code
    )


def _require_validation_eligibility(
    session: Session,
    assertion: FoodAttributeAssertionDB,
) -> None:
    try:
        normalized_value = normalize_source_assertion_value(
            attribute_key=assertion.attribute_key,
            value=assertion.value,
            unit_or_value_type=assertion.unit_or_value_type,
        )
    except ValueError as exc:
        raise SourceAssertionModerationRejected(
            "source_assertion_content_policy_conflict",
            status_code=409,
        ) from exc
    if normalized_value != assertion.value:
        raise SourceAssertionModerationRejected(
            "source_assertion_content_policy_conflict",
            status_code=409,
        )

    record = session.get(FoodSourceRecordDB, assertion.source_record_id)
    source = session.get(FoodSourceDB, record.source_id) if record is not None else None
    product = session.get(FoodProductDB, assertion.food_product_id)
    link = session.exec(
        select(FoodProductSourceLinkDB).where(
            FoodProductSourceLinkDB.food_product_id == assertion.food_product_id,
            FoodProductSourceLinkDB.source_record_id == assertion.source_record_id,
        )
    ).first()
    if (
        record is None
        or record.verification_status != "validated"
        or source is None
        or source.status != "enabled"
        or product is None
        or product.status != "active"
        or link is None
        or link.review_status != "validated"
    ):
        raise SourceAssertionModerationRejected(
            "source_assertion_lineage_not_active",
            status_code=409,
        )


def _moderate_locked(
    session: Session,
    *,
    assertion_id: str,
    target_status: str,
    expected_version: int,
    idempotency_key: str,
    moderator_reference: str,
    authorization_scope: str,
    reason_code: str,
) -> SourceAssertionModerationResult:
    existing = session.exec(
        select(FoodAttributeAssertionModerationAuditDB).where(
            FoodAttributeAssertionModerationAuditDB.idempotency_key
            == idempotency_key
        )
    ).first()
    if existing is not None:
        if not _matches_request(
            existing,
            assertion_id=assertion_id,
            target_status=target_status,
            expected_version=expected_version,
            moderator_reference=moderator_reference,
            authorization_scope=authorization_scope,
            reason_code=reason_code,
        ):
            raise SourceAssertionModerationRejected(
                "source_assertion_moderation_idempotency_conflict",
                status_code=409,
            )
        assertion = session.get(FoodAttributeAssertionDB, assertion_id)
        if (
            assertion is None
            or assertion.verification_version != existing.resulting_version
            or assertion.verification_status != existing.new_status
        ):
            raise TypeError("Moderation audit does not match its source assertion")
        session.commit()
        session.refresh(assertion)
        session.refresh(existing)
        return SourceAssertionModerationResult(assertion, existing, False)

    assertion = session.get(FoodAttributeAssertionDB, assertion_id)
    if assertion is None:
        raise SourceAssertionModerationRejected(
            "source_assertion_not_found",
            status_code=404,
        )
    if assertion.verification_version != expected_version:
        raise SourceAssertionModerationRejected(
            "source_assertion_version_conflict",
            status_code=409,
        )
    if assertion.verification_status != "quarantined":
        raise SourceAssertionModerationRejected(
            "source_assertion_already_moderated",
            status_code=409,
        )
    if target_status == "validated":
        _require_validation_eligibility(session, assertion)

    audit = FoodAttributeAssertionModerationAuditDB(
        assertion_id=assertion_id,
        idempotency_key=idempotency_key,
        expected_version=expected_version,
        resulting_version=expected_version + 1,
        previous_status="quarantined",
        new_status=target_status,
        moderator_reference=moderator_reference,
        authorization_scope=authorization_scope,
        reason_code=reason_code,
        created_at=utc_now(),
    )
    assertion.verification_status = target_status
    assertion.verification_version = expected_version + 1
    session.add_all([assertion, audit])
    session.commit()
    session.refresh(assertion)
    session.refresh(audit)
    return SourceAssertionModerationResult(assertion, audit, True)


def moderate_source_assertion(
    session: Session,
    *,
    assertion_id: str,
    target_status: str,
    expected_version: int,
    idempotency_key: str,
    moderator_reference: str,
    authorization_scope: str,
    reason_code: str,
) -> SourceAssertionModerationResult:
    """Apply one terminal assertion decision and append its audit atomically."""

    _validate_request(
        assertion_id=assertion_id,
        target_status=target_status,
        expected_version=expected_version,
        idempotency_key=idempotency_key,
        moderator_reference=moderator_reference,
        authorization_scope=authorization_scope,
        reason_code=reason_code,
    )

    try:
        backend = session.get_bind().dialect.name
        if backend == "postgresql":
            acquire_bounded_transaction_advisory_locks(
                session,
                {
                    _advisory_lock_key(
                        "source-assertion-moderation-assertion",
                        assertion_id,
                    ),
                    _advisory_lock_key(
                        "source-assertion-moderation-idempotency",
                        idempotency_key,
                    ),
                },
            )
            local_lock = nullcontext()
        elif backend == "sqlite":
            local_lock = _sqlite_assertion_moderation_lock
        else:
            raise TypeError("unsupported database backend for assertion moderation")

        with local_lock:
            return _moderate_locked(
                session,
                assertion_id=assertion_id,
                target_status=target_status,
                expected_version=expected_version,
                idempotency_key=idempotency_key,
                moderator_reference=moderator_reference,
                authorization_scope=authorization_scope,
                reason_code=reason_code,
            )
    except SourceAssertionModerationRejected:
        session.rollback()
        raise
    except (SQLAlchemyError, TypeError) as exc:
        session.rollback()
        raise SourceAssertionModerationRejected(
            "source_assertion_moderation_unavailable",
            status_code=503,
            retry_after_seconds=DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS,
        ) from exc
