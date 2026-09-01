from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import pytest
from sqlalchemy import event, inspect
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import SQLModel, Session, create_engine, select

from app.models import (
    FoodAttributeAssertionDB,
    FoodAttributeAssertionModerationAuditDB,
    FoodProductDB,
    FoodProductSourceLinkDB,
    FoodSourceDB,
    FoodSourceRecordDB,
)
from app.services.source_assertion_ingest import (
    SOURCE_ASSERTION_INGEST_SCOPE,
    ingest_source_assertion,
)
from app.services.source_assertion_moderation import (
    SOURCE_ASSERTION_MODERATION_SCOPE,
    SourceAssertionModerationRejected,
    moderate_source_assertion,
)


OBSERVED_AT = datetime(2026, 9, 1, 8, 0, 0)


def _engine(path, *, concurrent: bool = False):
    engine = create_engine(
        f"sqlite:///{path}",
        connect_args={"check_same_thread": False} if concurrent else {},
    )

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    SQLModel.metadata.create_all(engine)
    return engine


def _seed_assertion(session: Session) -> FoodAttributeAssertionDB:
    source = FoodSourceDB(
        source_key="synthetic-assertion-moderation",
        source_category="open-dataset",
        operator_name="Synthetic Assertion Moderation Source",
        status="enabled",
        licence_id="synthetic-test-only",
        terms_reference="https://example.test/terms",
        attribution_text="Synthetic test data",
        record_limit=2,
        assertion_limit=2,
    )
    product = FoodProductDB(status="active")
    record = FoodSourceRecordDB(
        source_id=source.id,
        external_record_id="record-1",
        source_version_or_content_digest="version-1",
        verification_status="validated",
        verification_version=2,
    )
    session.add_all([source, product])
    session.commit()
    session.add(record)
    session.commit()
    session.add(
        FoodProductSourceLinkDB(
            food_product_id=product.id,
            source_record_id=record.id,
            match_method="synthetic-reviewed-match",
            match_confidence=1,
            review_status="validated",
        )
    )
    session.commit()
    return ingest_source_assertion(
        session,
        food_product_id=product.id,
        source_record_id=record.id,
        expected_source_record_version=2,
        idempotency_key="assertion-ingest-1",
        submitter_reference="adapter-synthetic-test",
        authorization_scope=SOURCE_ASSERTION_INGEST_SCOPE,
        attribute_key="nutrition.energy",
        value="100",
        unit_or_value_type="kcal-per-100g",
        observed_or_effective_at=OBSERVED_AT,
    ).assertion


def _moderate(
    session: Session,
    assertion_id: str,
    *,
    target_status: str = "validated",
    expected_version: int = 1,
    idempotency_key: str = "assertion-decision-1",
):
    return moderate_source_assertion(
        session,
        assertion_id=assertion_id,
        target_status=target_status,
        expected_version=expected_version,
        idempotency_key=idempotency_key,
        moderator_reference="moderator-test",
        authorization_scope=SOURCE_ASSERTION_MODERATION_SCOPE,
        reason_code="synthetic-quality-reviewed",
    )


def test_assertion_moderation_is_terminal_versioned_idempotent_and_audited(
    tmp_path,
) -> None:
    engine = _engine(tmp_path / "assertion-moderation.db")
    try:
        with Session(engine) as session:
            assertion = _seed_assertion(session)
            original_evidence = (
                assertion.food_product_id,
                assertion.source_record_id,
                assertion.attribute_key,
                assertion.value,
                assertion.unit_or_value_type,
                assertion.observed_or_effective_at,
                assertion.supersedes_assertion_id,
            )
            result = _moderate(session, assertion.id)
            duplicate = _moderate(session, assertion.id)

            assert result.created is True
            assert duplicate.created is False
            assert duplicate.audit.id == result.audit.id
            assert result.assertion.verification_status == "validated"
            assert result.assertion.verification_version == 2
            assert result.audit.previous_status == "quarantined"
            assert result.audit.new_status == "validated"
            assert result.audit.expected_version == 1
            assert result.audit.resulting_version == 2
            assert result.audit.authorization_scope == SOURCE_ASSERTION_MODERATION_SCOPE
            assert (
                result.assertion.food_product_id,
                result.assertion.source_record_id,
                result.assertion.attribute_key,
                result.assertion.value,
                result.assertion.unit_or_value_type,
                result.assertion.observed_or_effective_at,
                result.assertion.supersedes_assertion_id,
            ) == original_evidence
            assert len(
                session.exec(select(FoodAttributeAssertionModerationAuditDB)).all()
            ) == 1

            with pytest.raises(SourceAssertionModerationRejected) as reused_key:
                _moderate(
                    session,
                    assertion.id,
                    target_status="rejected",
                )
            assert (
                reused_key.value.reason
                == "source_assertion_moderation_idempotency_conflict"
            )
            assert reused_key.value.status_code == 409

            with pytest.raises(SourceAssertionModerationRejected) as terminal:
                _moderate(
                    session,
                    assertion.id,
                    expected_version=2,
                    idempotency_key="assertion-decision-2",
                )
            assert terminal.value.reason == "source_assertion_already_moderated"
            assert terminal.value.status_code == 409

        columns = {
            column["name"]
            for column in inspect(engine).get_columns(
                "food_attribute_assertion_moderation_audit"
            )
        }
        assert "free_text" not in columns
        assert "payload" not in columns
        assert "email" not in columns
        assert "ip_address" not in columns
    finally:
        engine.dispose()


def test_assertion_moderation_rejects_stale_version_without_audit(tmp_path) -> None:
    engine = _engine(tmp_path / "stale-assertion.db")
    try:
        with Session(engine) as session:
            assertion = _seed_assertion(session)
            with pytest.raises(SourceAssertionModerationRejected) as rejected:
                _moderate(
                    session,
                    assertion.id,
                    expected_version=2,
                    idempotency_key="stale-assertion-decision",
                )
            assert rejected.value.reason == "source_assertion_version_conflict"
            assert rejected.value.status_code == 409
            assert session.exec(
                select(FoodAttributeAssertionModerationAuditDB)
            ).all() == []
            session.refresh(assertion)
            assert assertion.verification_status == "quarantined"
            assert assertion.verification_version == 1
    finally:
        engine.dispose()


def test_assertion_moderation_rejects_missing_assertion_without_audit(
    tmp_path,
) -> None:
    engine = _engine(tmp_path / "missing-assertion.db")
    try:
        with Session(engine) as session:
            with pytest.raises(SourceAssertionModerationRejected) as rejected:
                _moderate(session, "missing-assertion")
            assert rejected.value.reason == "source_assertion_not_found"
            assert rejected.value.status_code == 404
            assert session.exec(
                select(FoodAttributeAssertionModerationAuditDB)
            ).all() == []
    finally:
        engine.dispose()


@pytest.mark.parametrize("invalid_value", ["1e2", "100.000000"])
def test_assertion_validation_rechecks_canonical_content_policy(
    tmp_path,
    invalid_value: str,
) -> None:
    engine = _engine(tmp_path / f"invalid-content-{invalid_value}.db")
    try:
        with Session(engine) as session:
            assertion = _seed_assertion(session)
            assertion.value = invalid_value
            session.add(assertion)
            session.commit()

            with pytest.raises(SourceAssertionModerationRejected) as rejected:
                _moderate(session, assertion.id)
            assert rejected.value.reason == "source_assertion_content_policy_conflict"
            assert rejected.value.status_code == 409
            assert session.exec(
                select(FoodAttributeAssertionModerationAuditDB)
            ).all() == []
            session.refresh(assertion)
            assert assertion.verification_status == "quarantined"
            assert assertion.verification_version == 1
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    ("entity_name", "invalid_status"),
    [
        ("source", "paused"),
        ("record", "rejected"),
        ("product", "staged"),
        ("link", "rejected"),
    ],
)
def test_assertion_validation_requires_current_active_reviewed_lineage(
    tmp_path,
    entity_name: str,
    invalid_status: str,
) -> None:
    engine = _engine(tmp_path / f"invalid-lineage-{entity_name}.db")
    try:
        with Session(engine) as session:
            assertion = _seed_assertion(session)
            record = session.get(FoodSourceRecordDB, assertion.source_record_id)
            assert record is not None
            source = session.get(FoodSourceDB, record.source_id)
            product = session.get(FoodProductDB, assertion.food_product_id)
            link = session.exec(
                select(FoodProductSourceLinkDB).where(
                    FoodProductSourceLinkDB.food_product_id
                    == assertion.food_product_id,
                    FoodProductSourceLinkDB.source_record_id
                    == assertion.source_record_id,
                )
            ).one()
            entities = {
                "source": (source, "status"),
                "record": (record, "verification_status"),
                "product": (product, "status"),
                "link": (link, "review_status"),
            }
            entity, field_name = entities[entity_name]
            assert entity is not None
            setattr(entity, field_name, invalid_status)
            session.add(entity)
            session.commit()

            with pytest.raises(SourceAssertionModerationRejected) as rejected:
                _moderate(session, assertion.id)
            assert rejected.value.reason == "source_assertion_lineage_not_active"
            assert rejected.value.status_code == 409
            assert session.exec(
                select(FoodAttributeAssertionModerationAuditDB)
            ).all() == []
    finally:
        engine.dispose()


def test_assertion_rejection_remains_available_for_invalid_evidence(tmp_path) -> None:
    engine = _engine(tmp_path / "reject-invalid-evidence.db")
    try:
        with Session(engine) as session:
            assertion = _seed_assertion(session)
            assertion.value = "1e2"
            session.add(assertion)
            session.commit()

            result = _moderate(
                session,
                assertion.id,
                target_status="rejected",
            )
            assert result.created is True
            assert result.assertion.verification_status == "rejected"
            assert result.assertion.verification_version == 2
            assert result.assertion.value == "1e2"
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "overrides",
    [
        {"assertion_id": " assertion"},
        {"target_status": "quarantined"},
        {"expected_version": 0},
        {"expected_version": True},
        {"idempotency_key": " decision"},
        {"moderator_reference": "Moderator Name"},
        {"reason_code": "free text"},
    ],
)
def test_invalid_assertion_moderation_is_rejected_before_database_work(
    overrides: dict[str, object],
) -> None:
    class UnusedSession:
        def get_bind(self):
            raise AssertionError("database must not be touched")

    values: dict[str, object] = {
        "assertion_id": "assertion-1",
        "target_status": "validated",
        "expected_version": 1,
        "idempotency_key": "assertion-decision-1",
        "moderator_reference": "moderator-test",
        "authorization_scope": SOURCE_ASSERTION_MODERATION_SCOPE,
        "reason_code": "synthetic-quality-reviewed",
    }
    values.update(overrides)
    with pytest.raises(ValueError):
        moderate_source_assertion(UnusedSession(), **values)  # type: ignore[arg-type]


def test_assertion_moderation_scope_denial_precedes_database_work() -> None:
    class UnusedSession:
        def get_bind(self):
            raise AssertionError("database must not be touched")

    with pytest.raises(SourceAssertionModerationRejected) as rejected:
        moderate_source_assertion(  # type: ignore[arg-type]
            UnusedSession(),
            assertion_id="assertion-1",
            target_status="validated",
            expected_version=1,
            idempotency_key="assertion-decision-1",
            moderator_reference="moderator-test",
            authorization_scope="catalog:read",
            reason_code="synthetic-quality-reviewed",
        )
    assert rejected.value.reason == "source_assertion_moderation_scope_denied"
    assert rejected.value.status_code == 403
    assert rejected.value.retry_after_seconds is None


def test_assertion_moderation_database_failure_fails_closed() -> None:
    class BrokenSession:
        rolled_back = False

        def get_bind(self):
            raise SQLAlchemyError("synthetic database failure")

        def rollback(self) -> None:
            self.rolled_back = True

    session = BrokenSession()
    with pytest.raises(SourceAssertionModerationRejected) as rejected:
        _moderate(session, "assertion-1")  # type: ignore[arg-type]
    assert rejected.value.reason == "source_assertion_moderation_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5
    assert session.rolled_back is True


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("resulting_version", 3),
        ("new_status", "quarantined"),
        ("authorization_scope", "catalog:read"),
    ],
)
def test_database_rejects_invalid_assertion_moderation_audit(
    tmp_path,
    field_name: str,
    invalid_value: object,
) -> None:
    engine = _engine(tmp_path / f"invalid-assertion-audit-{field_name}.db")
    try:
        with Session(engine) as session:
            assertion = _seed_assertion(session)
            audit = FoodAttributeAssertionModerationAuditDB(
                assertion_id=assertion.id,
                idempotency_key=f"invalid-{field_name}",
                expected_version=1,
                resulting_version=2,
                previous_status="quarantined",
                new_status="validated",
                moderator_reference="moderator-test",
                authorization_scope=SOURCE_ASSERTION_MODERATION_SCOPE,
                reason_code="synthetic-quality-reviewed",
            )
            setattr(audit, field_name, invalid_value)
            session.add(audit)
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
            assert session.exec(
                select(FoodAttributeAssertionModerationAuditDB)
            ).all() == []
    finally:
        engine.dispose()


def test_sqlite_assertion_moderation_serializes_concurrent_decisions(
    tmp_path,
) -> None:
    engine = _engine(tmp_path / "concurrent-assertion-moderation.db", concurrent=True)
    try:
        with Session(engine) as session:
            assertion_id = _seed_assertion(session).id

        def attempt(index: int) -> str:
            with Session(engine) as session:
                try:
                    result = _moderate(
                        session,
                        assertion_id,
                        target_status="validated" if index % 2 == 0 else "rejected",
                        idempotency_key=f"concurrent-assertion-decision-{index}",
                    )
                except SourceAssertionModerationRejected as exc:
                    return exc.reason
            return "moderated" if result.created else "duplicate"

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(attempt, range(8)))

        assert results.count("moderated") == 1
        assert results.count("source_assertion_version_conflict") == 7
        with Session(engine) as session:
            assertion = session.get(FoodAttributeAssertionDB, assertion_id)
            assert assertion is not None
            assert assertion.verification_version == 2
            assert assertion.verification_status in {"validated", "rejected"}
            assert len(
                session.exec(select(FoodAttributeAssertionModerationAuditDB)).all()
            ) == 1
    finally:
        engine.dispose()
