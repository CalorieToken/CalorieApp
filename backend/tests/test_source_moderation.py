from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import SQLModel, Session, create_engine, select

from app.models import (
    FoodSourceDB,
    FoodSourceModerationAuditDB,
    FoodSourceRecordDB,
)
from app.services.source_catalog import ingest_source_record
from app.services.source_moderation import (
    SOURCE_MODERATION_SCOPE,
    SourceModerationRejected,
    moderate_source_record,
)


def _source() -> FoodSourceDB:
    return FoodSourceDB(
        source_key="synthetic-moderation",
        source_category="open-dataset",
        operator_name="Synthetic Test Source",
        status="enabled",
        licence_id="synthetic-test-only",
        terms_reference="https://example.test/terms",
        attribution_text="Synthetic test data",
        record_limit=20,
    )


def _seed_record(session: Session) -> FoodSourceRecordDB:
    session.add(_source())
    session.commit()
    return ingest_source_record(
        session,
        source_key="synthetic-moderation",
        external_record_id="record-1",
        source_version_or_content_digest="version-1",
    ).record


def _moderate(
    session: Session,
    record_id: str,
    *,
    target_status: str = "validated",
    expected_version: int = 1,
    idempotency_key: str = "decision-1",
):
    return moderate_source_record(
        session,
        source_record_id=record_id,
        target_status=target_status,
        expected_version=expected_version,
        idempotency_key=idempotency_key,
        moderator_reference="moderator-test",
        authorization_scope=SOURCE_MODERATION_SCOPE,
        reason_code="synthetic-quality-reviewed",
    )


def test_source_moderation_is_terminal_versioned_idempotent_and_audited(
    tmp_path,
) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'moderation.db'}")
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            record = _seed_record(session)
            assert record.verification_status == "quarantined"
            assert record.verification_version == 1

            result = _moderate(session, record.id)
            duplicate = _moderate(session, record.id)

            assert result.created is True
            assert duplicate.created is False
            assert duplicate.audit.id == result.audit.id
            assert result.record.verification_status == "validated"
            assert result.record.verification_version == 2
            assert result.audit.previous_status == "quarantined"
            assert result.audit.new_status == "validated"
            assert result.audit.expected_version == 1
            assert result.audit.resulting_version == 2
            assert result.audit.authorization_scope == SOURCE_MODERATION_SCOPE
            assert len(session.exec(select(FoodSourceModerationAuditDB)).all()) == 1

            with pytest.raises(SourceModerationRejected) as reused_key:
                _moderate(
                    session,
                    record.id,
                    target_status="rejected",
                )
            assert reused_key.value.reason == "source_moderation_idempotency_conflict"
            assert reused_key.value.status_code == 409

            with pytest.raises(SourceModerationRejected) as terminal:
                _moderate(
                    session,
                    record.id,
                    expected_version=2,
                    idempotency_key="decision-2",
                )
            assert terminal.value.reason == "source_record_already_moderated"
            assert terminal.value.status_code == 409
            assert len(session.exec(select(FoodSourceModerationAuditDB)).all()) == 1

        columns = {
            column["name"]
            for column in inspect(engine).get_columns(
                "food_source_moderation_audit"
            )
        }
        assert "free_text" not in columns
        assert "payload" not in columns
        assert "email" not in columns
        assert "ip_address" not in columns
    finally:
        engine.dispose()


def test_source_moderation_rejects_stale_expected_version_without_audit(
    tmp_path,
) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'stale.db'}")
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            record = _seed_record(session)
            with pytest.raises(SourceModerationRejected) as rejected:
                _moderate(
                    session,
                    record.id,
                    expected_version=2,
                    idempotency_key="stale-decision",
                )
            assert rejected.value.reason == "source_record_version_conflict"
            assert rejected.value.status_code == 409
            assert session.exec(select(FoodSourceModerationAuditDB)).all() == []
            session.refresh(record)
            assert record.verification_status == "quarantined"
            assert record.verification_version == 1
    finally:
        engine.dispose()


def test_source_moderation_rejects_missing_record_without_audit(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'missing.db'}")
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            with pytest.raises(SourceModerationRejected) as rejected:
                _moderate(session, "missing-record")
            assert rejected.value.reason == "source_record_not_found"
            assert rejected.value.status_code == 404
            assert session.exec(select(FoodSourceModerationAuditDB)).all() == []
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "overrides",
    [
        {"source_record_id": " record"},
        {"target_status": "quarantined"},
        {"expected_version": 0},
        {"expected_version": True},
        {"idempotency_key": " decision"},
        {"moderator_reference": "Moderator Name"},
        {"reason_code": "free text"},
    ],
)
def test_invalid_moderation_request_is_rejected_before_database_work(
    overrides: dict[str, object],
) -> None:
    class UnusedSession:
        def get_bind(self):
            raise AssertionError("database must not be touched")

    values: dict[str, object] = {
        "source_record_id": "record-1",
        "target_status": "validated",
        "expected_version": 1,
        "idempotency_key": "decision-1",
        "moderator_reference": "moderator-test",
        "authorization_scope": SOURCE_MODERATION_SCOPE,
        "reason_code": "synthetic-quality-reviewed",
    }
    values.update(overrides)
    with pytest.raises(ValueError):
        moderate_source_record(UnusedSession(), **values)  # type: ignore[arg-type]


def test_moderation_scope_denial_precedes_database_work() -> None:
    class UnusedSession:
        def get_bind(self):
            raise AssertionError("database must not be touched")

    with pytest.raises(SourceModerationRejected) as rejected:
        moderate_source_record(  # type: ignore[arg-type]
            UnusedSession(),
            source_record_id="record-1",
            target_status="validated",
            expected_version=1,
            idempotency_key="decision-1",
            moderator_reference="moderator-test",
            authorization_scope="catalog:read",
            reason_code="synthetic-quality-reviewed",
        )
    assert rejected.value.reason == "source_moderation_scope_denied"
    assert rejected.value.status_code == 403
    assert rejected.value.retry_after_seconds is None


def test_moderation_database_failure_fails_closed() -> None:
    class BrokenSession:
        rolled_back = False

        def get_bind(self):
            raise SQLAlchemyError("synthetic database failure")

        def rollback(self) -> None:
            self.rolled_back = True

    session = BrokenSession()
    with pytest.raises(SourceModerationRejected) as rejected:
        _moderate(session, "record-1")  # type: ignore[arg-type]
    assert rejected.value.reason == "source_moderation_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5
    assert session.rolled_back is True


def test_database_rejects_invalid_moderation_versions(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'invalid-audit.db'}")
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            record = _seed_record(session)
            session.add(
                FoodSourceModerationAuditDB(
                    source_record_id=record.id,
                    idempotency_key="invalid-version",
                    expected_version=1,
                    resulting_version=3,
                    previous_status="quarantined",
                    new_status="validated",
                    moderator_reference="moderator-test",
                    authorization_scope=SOURCE_MODERATION_SCOPE,
                    reason_code="synthetic-quality-reviewed",
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
            assert session.exec(select(FoodSourceModerationAuditDB)).all() == []
    finally:
        engine.dispose()


def test_sqlite_moderation_serializes_concurrent_local_decisions(tmp_path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'concurrent-moderation.db'}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            record_id = _seed_record(session).id

        def attempt(index: int) -> str:
            with Session(engine) as session:
                try:
                    result = _moderate(
                        session,
                        record_id,
                        target_status="validated" if index % 2 == 0 else "rejected",
                        idempotency_key=f"concurrent-{index}",
                    )
                except SourceModerationRejected as exc:
                    return exc.reason
            return "moderated" if result.created else "duplicate"

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(attempt, range(8)))

        assert results.count("moderated") == 1
        assert results.count("source_record_version_conflict") == 7
        with Session(engine) as session:
            record = session.get(FoodSourceRecordDB, record_id)
            assert record is not None
            assert record.verification_version == 2
            assert record.verification_status in {"validated", "rejected"}
            assert len(session.exec(select(FoodSourceModerationAuditDB)).all()) == 1
    finally:
        engine.dispose()
