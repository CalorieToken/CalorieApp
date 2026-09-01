"""Internal, retained corrections for terminal source assertions."""

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
    FoodAttributeAssertionCorrectionAuditDB,
    FoodAttributeAssertionDB,
    FoodProductDB,
    FoodProductSourceLinkDB,
    FoodSourceDB,
    FoodSourceRecordDB,
    utc_now,
)
from ..postgresql_locking import acquire_bounded_transaction_advisory_locks
from ..source_assertion_policy import normalize_source_assertion_value


SOURCE_ASSERTION_CORRECTION_SCOPE = "catalog:source-assertion:correct"
_ID_PATTERN = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,62}[A-Za-z0-9])?")
_IDEMPOTENCY_KEY_PATTERN = re.compile(
    r"[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,126}[A-Za-z0-9])?"
)
_CORRECTOR_REFERENCE_PATTERN = re.compile(
    r"[a-z0-9](?:[a-z0-9._:-]{0,118}[a-z0-9])?"
)
_ATTRIBUTE_KEY_PATTERN = re.compile(
    r"[a-z0-9](?:[a-z0-9._-]{0,118}[a-z0-9])?"
)
_UNIT_PATTERN = re.compile(r"[a-z0-9](?:[a-z0-9._:/-]{0,78}[a-z0-9])?")
_REASON_CODE_PATTERN = re.compile(r"[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?")
_sqlite_assertion_correction_lock = Lock()


class SourceAssertionCorrectionRejected(Exception):
    """Reject a correction without changing assertion or audit history."""

    def __init__(
        self,
        reason: str,
        *,
        status_code: int,
        retry_after_seconds: int | None = None,
    ) -> None:
        if status_code not in {403, 404, 409, 503}:
            raise ValueError("source assertion correction status_code is invalid")
        if status_code == 503 and retry_after_seconds is None:
            raise ValueError("503 assertion correction rejection requires Retry-After")
        if status_code != 503 and retry_after_seconds is not None:
            raise ValueError("only unavailable assertion correction uses Retry-After")
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


def _correction_unavailable() -> SourceAssertionCorrectionRejected:
    return SourceAssertionCorrectionRejected(
        "source_assertion_correction_unavailable",
        status_code=503,
        retry_after_seconds=DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS,
    )


@dataclass(frozen=True)
class SourceAssertionCorrectionResult:
    assertion: FoodAttributeAssertionDB
    audit: FoodAttributeAssertionCorrectionAuditDB
    created: bool


def _validate_request(
    *,
    predecessor_assertion_id: str,
    expected_predecessor_version: int,
    idempotency_key: str,
    corrector_reference: str,
    authorization_scope: str,
    reason_code: str,
    attribute_key: str,
    value: str,
    unit_or_value_type: str,
    observed_or_effective_at: datetime,
) -> str:
    if not _ID_PATTERN.fullmatch(predecessor_assertion_id):
        raise ValueError(
            "predecessor_assertion_id must use the reviewed identifier format"
        )
    if (
        type(expected_predecessor_version) is not int
        or expected_predecessor_version <= 0
    ):
        raise ValueError("expected_predecessor_version must be a positive integer")
    if not _IDEMPOTENCY_KEY_PATTERN.fullmatch(idempotency_key):
        raise ValueError(
            "idempotency_key must use the reviewed 1 to 128 character format"
        )
    if not _CORRECTOR_REFERENCE_PATTERN.fullmatch(corrector_reference):
        raise ValueError("corrector_reference must use the pseudonymous format")
    if authorization_scope != SOURCE_ASSERTION_CORRECTION_SCOPE:
        raise SourceAssertionCorrectionRejected(
            "source_assertion_correction_scope_denied",
            status_code=403,
        )
    if not _REASON_CODE_PATTERN.fullmatch(reason_code):
        raise ValueError("reason_code must use the reviewed 1 to 80 character format")
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
    predecessor: FoodAttributeAssertionDB,
    correction: FoodAttributeAssertionDB,
    audit: FoodAttributeAssertionCorrectionAuditDB,
    *,
    predecessor_assertion_id: str,
    expected_predecessor_version: int,
    corrector_reference: str,
    authorization_scope: str,
    reason_code: str,
    attribute_key: str,
    value: str,
    unit_or_value_type: str,
    observed_or_effective_at: datetime,
) -> bool:
    return (
        audit.predecessor_assertion_id == predecessor_assertion_id
        and audit.correction_assertion_id == correction.id
        and audit.expected_predecessor_version == expected_predecessor_version
        and audit.resulting_correction_version == 1
        and audit.corrector_reference == corrector_reference
        and audit.authorization_scope == authorization_scope
        and audit.reason_code == reason_code
        and correction.food_product_id == predecessor.food_product_id
        and correction.source_record_id == predecessor.source_record_id
        and correction.attribute_key == attribute_key
        and correction.value == value
        and correction.unit_or_value_type == unit_or_value_type
        and correction.observed_or_effective_at == observed_or_effective_at
        and correction.supersedes_assertion_id == predecessor.id
    )


def _require_active_lineage(
    session: Session,
    predecessor: FoodAttributeAssertionDB,
) -> FoodSourceDB:
    record = session.get(FoodSourceRecordDB, predecessor.source_record_id)
    source = session.get(FoodSourceDB, record.source_id) if record is not None else None
    product = session.get(FoodProductDB, predecessor.food_product_id)
    link = session.exec(
        select(FoodProductSourceLinkDB).where(
            FoodProductSourceLinkDB.food_product_id == predecessor.food_product_id,
            FoodProductSourceLinkDB.source_record_id == predecessor.source_record_id,
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
        raise SourceAssertionCorrectionRejected(
            "source_assertion_correction_lineage_not_active",
            status_code=409,
        )
    return source


def _correct_locked(
    session: Session,
    *,
    backend: str,
    predecessor_assertion_id: str,
    expected_predecessor_version: int,
    idempotency_key: str,
    corrector_reference: str,
    authorization_scope: str,
    reason_code: str,
    attribute_key: str,
    value: str,
    unit_or_value_type: str,
    observed_or_effective_at: datetime,
) -> SourceAssertionCorrectionResult:
    existing_audit = session.exec(
        select(FoodAttributeAssertionCorrectionAuditDB).where(
            FoodAttributeAssertionCorrectionAuditDB.idempotency_key
            == idempotency_key
        )
    ).first()
    if existing_audit is not None:
        predecessor = session.get(
            FoodAttributeAssertionDB,
            existing_audit.predecessor_assertion_id,
        )
        correction = session.get(
            FoodAttributeAssertionDB,
            existing_audit.correction_assertion_id,
        )
        if predecessor is None or correction is None:
            raise _correction_unavailable()
        if not _matches_request(
            predecessor,
            correction,
            existing_audit,
            predecessor_assertion_id=predecessor_assertion_id,
            expected_predecessor_version=expected_predecessor_version,
            corrector_reference=corrector_reference,
            authorization_scope=authorization_scope,
            reason_code=reason_code,
            attribute_key=attribute_key,
            value=value,
            unit_or_value_type=unit_or_value_type,
            observed_or_effective_at=observed_or_effective_at,
        ):
            raise SourceAssertionCorrectionRejected(
                "source_assertion_correction_idempotency_conflict",
                status_code=409,
            )
        session.commit()
        session.refresh(correction)
        session.refresh(existing_audit)
        return SourceAssertionCorrectionResult(correction, existing_audit, False)

    predecessor = session.get(FoodAttributeAssertionDB, predecessor_assertion_id)
    if predecessor is None:
        raise SourceAssertionCorrectionRejected(
            "source_assertion_correction_predecessor_not_found",
            status_code=404,
        )
    if predecessor.verification_version != expected_predecessor_version:
        raise SourceAssertionCorrectionRejected(
            "source_assertion_correction_version_conflict",
            status_code=409,
        )
    if predecessor.verification_status not in {"validated", "rejected"}:
        raise SourceAssertionCorrectionRejected(
            "source_assertion_correction_predecessor_not_terminal",
            status_code=409,
        )

    existing_correction = session.exec(
        select(FoodAttributeAssertionDB).where(
            FoodAttributeAssertionDB.supersedes_assertion_id == predecessor.id
        )
    ).first()
    if existing_correction is not None:
        raise SourceAssertionCorrectionRejected(
            "source_assertion_already_corrected",
            status_code=409,
        )

    source = _require_active_lineage(session, predecessor)
    if backend == "postgresql":
        acquire_bounded_transaction_advisory_locks(
            session,
            [_advisory_lock_key("source-assertion-ingest-source", source.id)],
        )

    existing_evidence = session.exec(
        select(FoodAttributeAssertionDB).where(
            FoodAttributeAssertionDB.food_product_id == predecessor.food_product_id,
            FoodAttributeAssertionDB.source_record_id == predecessor.source_record_id,
            FoodAttributeAssertionDB.attribute_key == attribute_key,
            FoodAttributeAssertionDB.value == value,
            FoodAttributeAssertionDB.unit_or_value_type == unit_or_value_type,
            FoodAttributeAssertionDB.observed_or_effective_at
            == observed_or_effective_at,
        )
    ).first()
    if existing_evidence is not None:
        raise SourceAssertionCorrectionRejected(
            "source_assertion_correction_evidence_already_exists",
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
        raise SourceAssertionCorrectionRejected(
            "source_assertion_budget_reached",
            status_code=409,
        )

    correction = FoodAttributeAssertionDB(
        food_product_id=predecessor.food_product_id,
        source_record_id=predecessor.source_record_id,
        attribute_key=attribute_key,
        value=value,
        unit_or_value_type=unit_or_value_type,
        observed_or_effective_at=observed_or_effective_at,
        verification_status="quarantined",
        verification_version=1,
        supersedes_assertion_id=predecessor.id,
        created_at=utc_now(),
    )
    audit = FoodAttributeAssertionCorrectionAuditDB(
        predecessor_assertion_id=predecessor.id,
        correction_assertion_id=correction.id,
        idempotency_key=idempotency_key,
        expected_predecessor_version=expected_predecessor_version,
        resulting_correction_version=1,
        corrector_reference=corrector_reference,
        authorization_scope=authorization_scope,
        reason_code=reason_code,
        created_at=utc_now(),
    )
    session.add(correction)
    session.flush()
    session.add(audit)
    session.commit()
    session.refresh(correction)
    session.refresh(audit)
    return SourceAssertionCorrectionResult(correction, audit, True)


def correct_source_assertion(
    session: Session,
    *,
    predecessor_assertion_id: str,
    expected_predecessor_version: int,
    idempotency_key: str,
    corrector_reference: str,
    authorization_scope: str,
    reason_code: str,
    attribute_key: str,
    value: str,
    unit_or_value_type: str,
    observed_or_effective_at: datetime,
) -> SourceAssertionCorrectionResult:
    """Create one quarantined correction while retaining its predecessor."""

    normalized_value = _validate_request(
        predecessor_assertion_id=predecessor_assertion_id,
        expected_predecessor_version=expected_predecessor_version,
        idempotency_key=idempotency_key,
        corrector_reference=corrector_reference,
        authorization_scope=authorization_scope,
        reason_code=reason_code,
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
                        "source-assertion-correction-predecessor",
                        predecessor_assertion_id,
                    ),
                    _advisory_lock_key(
                        "source-assertion-correction-idempotency",
                        idempotency_key,
                    ),
                },
            )
            local_lock = nullcontext()
        elif backend == "sqlite":
            local_lock = _sqlite_assertion_correction_lock
        else:
            raise _correction_unavailable()

        with local_lock:
            return _correct_locked(
                session,
                backend=backend,
                predecessor_assertion_id=predecessor_assertion_id,
                expected_predecessor_version=expected_predecessor_version,
                idempotency_key=idempotency_key,
                corrector_reference=corrector_reference,
                authorization_scope=authorization_scope,
                reason_code=reason_code,
                attribute_key=attribute_key,
                value=normalized_value,
                unit_or_value_type=unit_or_value_type,
                observed_or_effective_at=observed_or_effective_at,
            )
    except SourceAssertionCorrectionRejected:
        session.rollback()
        raise
    except SQLAlchemyError as exc:
        session.rollback()
        raise _correction_unavailable() from exc
