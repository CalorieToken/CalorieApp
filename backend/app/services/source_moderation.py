"""Internal, versioned moderation for quarantined food-source records."""

from __future__ import annotations

import hashlib
import re
from contextlib import nullcontext
from dataclasses import dataclass
from threading import Lock

import sqlalchemy as sa
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from ..data_growth import DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS
from ..models import (
    FoodSourceModerationAuditDB,
    FoodSourceRecordDB,
    utc_now,
)


SOURCE_MODERATION_SCOPE = "catalog:source-record:moderate"
SOURCE_MODERATION_TARGET_STATUSES = frozenset({"validated", "rejected"})
_IDEMPOTENCY_KEY_PATTERN = re.compile(
    r"[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,126}[A-Za-z0-9])?"
)
_MODERATOR_REFERENCE_PATTERN = re.compile(
    r"[a-z0-9](?:[a-z0-9._:-]{0,118}[a-z0-9])?"
)
_REASON_CODE_PATTERN = re.compile(r"[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?")
_sqlite_moderation_lock = Lock()


class SourceModerationRejected(Exception):
    """Fail a moderation attempt without changing its record or audit history."""

    def __init__(
        self,
        reason: str,
        *,
        status_code: int,
        retry_after_seconds: int | None = None,
    ) -> None:
        if status_code not in {403, 404, 409, 503}:
            raise ValueError("source moderation status_code is invalid")
        if status_code == 503 and retry_after_seconds is None:
            raise ValueError("503 source moderation rejection requires Retry-After")
        if status_code != 503 and retry_after_seconds is not None:
            raise ValueError("only unavailable moderation responses use Retry-After")
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class SourceModerationResult:
    record: FoodSourceRecordDB
    audit: FoodSourceModerationAuditDB
    created: bool


def _validate_request(
    *,
    source_record_id: str,
    target_status: str,
    expected_version: int,
    idempotency_key: str,
    moderator_reference: str,
    authorization_scope: str,
    reason_code: str,
) -> None:
    if (
        not source_record_id.strip()
        or source_record_id != source_record_id.strip()
        or len(source_record_id) > 64
    ):
        raise ValueError("source_record_id must contain 1 to 64 characters")
    if target_status not in SOURCE_MODERATION_TARGET_STATUSES:
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
    if authorization_scope != SOURCE_MODERATION_SCOPE:
        raise SourceModerationRejected(
            "source_moderation_scope_denied",
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
    audit: FoodSourceModerationAuditDB,
    *,
    source_record_id: str,
    target_status: str,
    expected_version: int,
    moderator_reference: str,
    authorization_scope: str,
    reason_code: str,
) -> bool:
    return (
        audit.source_record_id == source_record_id
        and audit.new_status == target_status
        and audit.expected_version == expected_version
        and audit.moderator_reference == moderator_reference
        and audit.authorization_scope == authorization_scope
        and audit.reason_code == reason_code
    )


def _moderate_locked(
    session: Session,
    *,
    source_record_id: str,
    target_status: str,
    expected_version: int,
    idempotency_key: str,
    moderator_reference: str,
    authorization_scope: str,
    reason_code: str,
) -> SourceModerationResult:
    existing = session.exec(
        select(FoodSourceModerationAuditDB).where(
            FoodSourceModerationAuditDB.idempotency_key == idempotency_key
        )
    ).first()
    if existing is not None:
        if not _matches_request(
            existing,
            source_record_id=source_record_id,
            target_status=target_status,
            expected_version=expected_version,
            moderator_reference=moderator_reference,
            authorization_scope=authorization_scope,
            reason_code=reason_code,
        ):
            raise SourceModerationRejected(
                "source_moderation_idempotency_conflict",
                status_code=409,
            )
        record = session.get(FoodSourceRecordDB, source_record_id)
        if (
            record is None
            or record.verification_version != existing.resulting_version
            or record.verification_status != existing.new_status
        ):
            raise TypeError("Moderation audit does not match its source record")
        session.commit()
        session.refresh(record)
        session.refresh(existing)
        return SourceModerationResult(record, existing, False)

    record = session.get(FoodSourceRecordDB, source_record_id)
    if record is None:
        raise SourceModerationRejected(
            "source_record_not_found",
            status_code=404,
        )
    if record.verification_version != expected_version:
        raise SourceModerationRejected(
            "source_record_version_conflict",
            status_code=409,
        )
    if record.verification_status != "quarantined":
        raise SourceModerationRejected(
            "source_record_already_moderated",
            status_code=409,
        )

    audit = FoodSourceModerationAuditDB(
        source_record_id=source_record_id,
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
    record.verification_status = target_status
    record.verification_version = expected_version + 1
    session.add_all([record, audit])
    session.commit()
    session.refresh(record)
    session.refresh(audit)
    return SourceModerationResult(record, audit, True)


def moderate_source_record(
    session: Session,
    *,
    source_record_id: str,
    target_status: str,
    expected_version: int,
    idempotency_key: str,
    moderator_reference: str,
    authorization_scope: str,
    reason_code: str,
) -> SourceModerationResult:
    """Apply one terminal decision and append its audit in one transaction."""

    _validate_request(
        source_record_id=source_record_id,
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
            lock_keys = sorted(
                {
                    _advisory_lock_key("source-moderation-record", source_record_id),
                    _advisory_lock_key("source-moderation-idempotency", idempotency_key),
                }
            )
            for lock_key in lock_keys:
                session.exec(
                    sa.text("SELECT pg_advisory_xact_lock(:lock_key)"),
                    params={"lock_key": lock_key},
                )
            local_lock = nullcontext()
        elif backend == "sqlite":
            local_lock = _sqlite_moderation_lock
        else:
            raise TypeError("unsupported database backend for source moderation")

        with local_lock:
            return _moderate_locked(
                session,
                source_record_id=source_record_id,
                target_status=target_status,
                expected_version=expected_version,
                idempotency_key=idempotency_key,
                moderator_reference=moderator_reference,
                authorization_scope=authorization_scope,
                reason_code=reason_code,
            )
    except SourceModerationRejected:
        session.rollback()
        raise
    except (SQLAlchemyError, TypeError) as exc:
        session.rollback()
        raise SourceModerationRejected(
            "source_moderation_unavailable",
            status_code=503,
            retry_after_seconds=DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS,
        ) from exc
