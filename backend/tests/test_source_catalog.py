from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import SQLModel, Session, create_engine, select

from app.data_growth import DataGrowthAdmissionRejected
from app.models import FoodSourceDB, FoodSourceRecordDB
from app.services.source_catalog import ingest_source_record


def _source(
    source_key: str,
    *,
    limit: int,
    status: str = "enabled",
) -> FoodSourceDB:
    return FoodSourceDB(
        source_key=source_key,
        source_category="open-dataset",
        operator_name="Synthetic Test Source",
        status=status,
        licence_id="synthetic-test-only",
        terms_reference="https://example.test/terms",
        attribution_text="Synthetic test data",
        record_limit=limit,
    )


def test_source_ingest_is_idempotent_quarantined_and_budgeted(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'catalog.db'}")
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            session.add(_source("synthetic-a", limit=2))
            session.add(_source("synthetic-b", limit=1))
            session.commit()

            first = ingest_source_record(
                session,
                source_key="synthetic-a",
                external_record_id="record-1",
                source_version_or_content_digest="version-1",
            )
            second = ingest_source_record(
                session,
                source_key="synthetic-a",
                external_record_id="record-2",
                source_version_or_content_digest="version-1",
            )
            duplicate = ingest_source_record(
                session,
                source_key="synthetic-a",
                external_record_id="record-1",
                source_version_or_content_digest="version-1",
            )

            assert first.created is True
            assert second.created is True
            assert duplicate.created is False
            assert duplicate.record.id == first.record.id
            assert first.record.verification_status == "quarantined"

            with pytest.raises(DataGrowthAdmissionRejected) as rejected:
                ingest_source_record(
                    session,
                    source_key="synthetic-a",
                    external_record_id="record-3",
                    source_version_or_content_digest="version-1",
                )
            assert rejected.value.reason == "source_record_budget_reached"
            assert rejected.value.status_code == 409
            assert rejected.value.retry_after_seconds is None

            other_source = ingest_source_record(
                session,
                source_key="synthetic-b",
                external_record_id="record-1",
                source_version_or_content_digest="version-1",
            )
            assert other_source.created is True

            records = session.exec(select(FoodSourceRecordDB)).all()
            assert len(records) == 3
            assert {record.verification_status for record in records} == {
                "quarantined"
            }

        columns = {
            column["name"]
            for column in inspect(engine).get_columns("food_source_record")
        }
        assert "raw_payload" not in columns
        assert "payload" not in columns
        assert "user_id" not in columns
    finally:
        engine.dispose()


def test_database_rejects_non_positive_source_budget(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'invalid-source.db'}")
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            session.add(_source("invalid-limit", limit=0))
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
            assert session.exec(select(FoodSourceDB)).all() == []
    finally:
        engine.dispose()


@pytest.mark.parametrize("source_key", ["unknown", "paused-source"])
def test_unregistered_or_paused_source_fails_closed(tmp_path, source_key: str) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / f'{source_key}.db'}")
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            if source_key == "paused-source":
                session.add(_source(source_key, limit=5, status="paused"))
                session.commit()

            with pytest.raises(DataGrowthAdmissionRejected) as rejected:
                ingest_source_record(
                    session,
                    source_key=source_key,
                    external_record_id="record-1",
                    source_version_or_content_digest="version-1",
                )

            expected_reason = (
                "source_not_registered"
                if source_key == "unknown"
                else "source_ingest_not_enabled"
            )
            assert rejected.value.reason == expected_reason
            assert session.exec(select(FoodSourceRecordDB)).all() == []
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    ("source_key", "external_id", "version"),
    [
        ("Invalid Key", "record", "v1"),
        ("valid-key", "", "v1"),
        ("valid-key", "   ", "v1"),
        ("valid-key", "record", ""),
        ("valid-key", "record", "   "),
        ("valid-key", " record", "v1"),
        ("valid-key", "record ", "v1"),
        ("valid-key", "record", " v1"),
        ("valid-key", "record", "v1 "),
        ("x" * 101, "record", "v1"),
        ("valid-key", "x" * 256, "v1"),
        ("valid-key", "record", "x" * 129),
    ],
)
def test_invalid_source_ingest_identity_is_rejected_before_database_work(
    source_key: str,
    external_id: str,
    version: str,
) -> None:
    class UnusedSession:
        def get_bind(self):
            raise AssertionError("database must not be touched")

    with pytest.raises(ValueError):
        ingest_source_record(  # type: ignore[arg-type]
            UnusedSession(),
            source_key=source_key,
            external_record_id=external_id,
            source_version_or_content_digest=version,
        )


def test_timezone_aware_source_timestamp_is_rejected_before_database_work() -> None:
    class UnusedSession:
        def get_bind(self):
            raise AssertionError("database must not be touched")

    with pytest.raises(ValueError, match="naive UTC"):
        ingest_source_record(  # type: ignore[arg-type]
            UnusedSession(),
            source_key="synthetic-source",
            external_record_id="record-1",
            source_version_or_content_digest="version-1",
            retrieved_or_submitted_at=datetime.now(UTC),
        )


def test_source_ingest_database_failure_fails_closed() -> None:
    class BrokenSession:
        rolled_back = False

        def get_bind(self):
            raise SQLAlchemyError("synthetic database failure")

        def rollback(self) -> None:
            self.rolled_back = True

    session = BrokenSession()
    with pytest.raises(DataGrowthAdmissionRejected) as rejected:
        ingest_source_record(  # type: ignore[arg-type]
            session,
            source_key="synthetic-source",
            external_record_id="record-1",
            source_version_or_content_digest="version-1",
        )

    assert rejected.value.reason == "source_ingest_admission_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5
    assert session.rolled_back is True


def test_sqlite_source_budget_serializes_concurrent_local_writers(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'concurrent-catalog.db'}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            session.add(_source("concurrent-source", limit=3))
            session.commit()

        def attempt(index: int) -> str:
            with Session(engine) as session:
                try:
                    result = ingest_source_record(
                        session,
                        source_key="concurrent-source",
                        external_record_id=f"record-{index}",
                        source_version_or_content_digest="version-1",
                    )
                except DataGrowthAdmissionRejected as exc:
                    return exc.reason
            return "created" if result.created else "duplicate"

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(attempt, range(8)))

        assert results.count("created") == 3
        assert results.count("source_record_budget_reached") == 5
        with Session(engine) as session:
            assert len(session.exec(select(FoodSourceRecordDB)).all()) == 3
    finally:
        engine.dispose()
