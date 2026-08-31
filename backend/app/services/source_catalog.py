"""Internal, budgeted persistence for immutable food-source records."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from threading import Lock

import sqlalchemy as sa
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from ..data_growth import (
    DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS,
    DataGrowthAdmissionRejected,
)
from ..models import FoodSourceDB, FoodSourceRecordDB, utc_now


SOURCE_KEY_PATTERN = re.compile(r"[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?")
_sqlite_source_lock = Lock()


@dataclass(frozen=True)
class SourceRecordIngestResult:
    record: FoodSourceRecordDB
    created: bool


def _postgresql_lock_key(source_key: str) -> int:
    raw = int.from_bytes(
        hashlib.sha256(f"food-source-ingest:{source_key}".encode("utf-8")).digest()[:8],
        byteorder="big",
        signed=False,
    )
    return raw - (1 << 64) if raw >= (1 << 63) else raw


def _validate_ingest_fields(
    source_key: str,
    external_record_id: str,
    source_version_or_content_digest: str,
) -> None:
    if not SOURCE_KEY_PATTERN.fullmatch(source_key):
        raise ValueError("source_key must use the reviewed lowercase key format")
    if not external_record_id.strip() or len(external_record_id) > 255:
        raise ValueError("external_record_id must contain 1 to 255 characters")
    if (
        not source_version_or_content_digest.strip()
        or len(source_version_or_content_digest) > 128
    ):
        raise ValueError(
            "source_version_or_content_digest must contain 1 to 128 characters"
        )


def _ingest_locked(
    session: Session,
    *,
    source_key: str,
    external_record_id: str,
    source_version_or_content_digest: str,
    retrieved_or_submitted_at: datetime,
) -> SourceRecordIngestResult:
    source = session.exec(
        select(FoodSourceDB).where(FoodSourceDB.source_key == source_key)
    ).first()
    if source is None:
        raise DataGrowthAdmissionRejected(
            "source_not_registered",
            status_code=409,
        )
    if source.status != "enabled":
        raise DataGrowthAdmissionRejected(
            "source_ingest_not_enabled",
            status_code=409,
        )

    existing = session.exec(
        select(FoodSourceRecordDB).where(
            FoodSourceRecordDB.source_id == source.id,
            FoodSourceRecordDB.external_record_id == external_record_id,
            FoodSourceRecordDB.source_version_or_content_digest
            == source_version_or_content_digest,
        )
    ).first()
    if existing is not None:
        session.commit()
        session.refresh(existing)
        return SourceRecordIngestResult(existing, False)

    record_count = int(
        session.exec(
            select(sa.func.count(FoodSourceRecordDB.id)).where(
                FoodSourceRecordDB.source_id == source.id
            )
        ).one()
    )
    if record_count >= source.record_limit:
        raise DataGrowthAdmissionRejected(
            "source_record_budget_reached",
            status_code=409,
        )

    record = FoodSourceRecordDB(
        source_id=source.id,
        external_record_id=external_record_id,
        source_version_or_content_digest=source_version_or_content_digest,
        retrieved_or_submitted_at=retrieved_or_submitted_at,
        verification_status="quarantined",
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return SourceRecordIngestResult(record, True)


def ingest_source_record(
    session: Session,
    *,
    source_key: str,
    external_record_id: str,
    source_version_or_content_digest: str,
    retrieved_or_submitted_at: datetime | None = None,
) -> SourceRecordIngestResult:
    """Idempotently persist one quarantined record and complete its transaction."""

    _validate_ingest_fields(
        source_key,
        external_record_id,
        source_version_or_content_digest,
    )
    timestamp = retrieved_or_submitted_at or utc_now()

    try:
        backend = session.get_bind().dialect.name
        if backend == "postgresql":
            session.exec(
                sa.text("SELECT pg_advisory_xact_lock(:lock_key)"),
                params={"lock_key": _postgresql_lock_key(source_key)},
            )
            return _ingest_locked(
                session,
                source_key=source_key,
                external_record_id=external_record_id,
                source_version_or_content_digest=source_version_or_content_digest,
                retrieved_or_submitted_at=timestamp,
            )
        if backend == "sqlite":
            with _sqlite_source_lock:
                return _ingest_locked(
                    session,
                    source_key=source_key,
                    external_record_id=external_record_id,
                    source_version_or_content_digest=source_version_or_content_digest,
                    retrieved_or_submitted_at=timestamp,
                )
        raise TypeError("unsupported database backend for source ingest")
    except DataGrowthAdmissionRejected:
        session.rollback()
        raise
    except (SQLAlchemyError, TypeError) as exc:
        session.rollback()
        raise DataGrowthAdmissionRejected(
            "source_ingest_admission_unavailable",
            status_code=503,
            retry_after_seconds=DATA_GROWTH_UNAVAILABLE_RETRY_SECONDS,
        ) from exc
