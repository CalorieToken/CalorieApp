from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import pytest
from sqlalchemy import event, inspect
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import SQLModel, Session, create_engine, select

from app.models import (
    CalorieAppUserDB,
    FoodAttributeAssertionCorrectionAuditDB,
    FoodAttributeAssertionDB,
    FoodLogDB,
    FoodProductDB,
    FoodProductSourceLinkDB,
    FoodSourceDB,
    FoodSourceRecordDB,
)
from app.services.source_assertion_correction import (
    SOURCE_ASSERTION_CORRECTION_SCOPE,
    SourceAssertionCorrectionRejected,
    correct_source_assertion,
)
from app.services.source_assertion_ingest import (
    SOURCE_ASSERTION_INGEST_SCOPE,
    ingest_source_assertion,
)
from app.services.source_assertion_moderation import (
    SOURCE_ASSERTION_MODERATION_SCOPE,
    moderate_source_assertion,
)


OBSERVED_AT = datetime(2026, 9, 1, 8, 0, 0)
CORRECTED_AT = datetime(2026, 9, 1, 9, 0, 0)


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


def _seed_predecessor(
    session: Session,
    *,
    terminal_status: str | None = "validated",
    assertion_limit: int = 4,
) -> tuple[
    FoodAttributeAssertionDB,
    FoodSourceDB,
    FoodSourceRecordDB,
    FoodProductDB,
    FoodProductSourceLinkDB,
]:
    source = FoodSourceDB(
        source_key="synthetic-assertion-correction",
        source_category="open-dataset",
        operator_name="Synthetic Assertion Correction Source",
        status="enabled",
        licence_id="synthetic-test-only",
        terms_reference="https://example.test/terms",
        attribution_text="Synthetic test data",
        record_limit=2,
        assertion_limit=assertion_limit,
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
    link = FoodProductSourceLinkDB(
        food_product_id=product.id,
        source_record_id=record.id,
        match_method="synthetic-reviewed-match",
        match_confidence=1,
        review_status="validated",
    )
    session.add(link)
    session.commit()
    assertion = ingest_source_assertion(
        session,
        food_product_id=product.id,
        source_record_id=record.id,
        expected_source_record_version=2,
        idempotency_key="assertion-correction-ingest",
        submitter_reference="adapter-synthetic-test",
        authorization_scope=SOURCE_ASSERTION_INGEST_SCOPE,
        attribute_key="nutrition.energy",
        value="100",
        unit_or_value_type="kcal-per-100g",
        observed_or_effective_at=OBSERVED_AT,
    ).assertion
    if terminal_status is not None:
        assertion = moderate_source_assertion(
            session,
            assertion_id=assertion.id,
            target_status=terminal_status,
            expected_version=1,
            idempotency_key="assertion-correction-predecessor-moderation",
            moderator_reference="moderator-test",
            authorization_scope=SOURCE_ASSERTION_MODERATION_SCOPE,
            reason_code="synthetic-quality-reviewed",
        ).assertion
    return assertion, source, record, product, link


def _correct(
    session: Session,
    predecessor_assertion_id: str,
    *,
    expected_predecessor_version: int = 2,
    idempotency_key: str = "assertion-correction-1",
    value: str = "105",
    observed_at: datetime = CORRECTED_AT,
):
    return correct_source_assertion(
        session,
        predecessor_assertion_id=predecessor_assertion_id,
        expected_predecessor_version=expected_predecessor_version,
        idempotency_key=idempotency_key,
        corrector_reference="corrector-test",
        authorization_scope=SOURCE_ASSERTION_CORRECTION_SCOPE,
        reason_code="synthetic-evidence-corrected",
        attribute_key="nutrition.energy",
        value=value,
        unit_or_value_type="kcal-per-100g",
        observed_or_effective_at=observed_at,
    )


def test_assertion_correction_retains_history_snapshot_and_minimal_audit(
    tmp_path,
) -> None:
    engine = _engine(tmp_path / "assertion-correction.db")
    try:
        with Session(engine) as session:
            predecessor, _, _, _, _ = _seed_predecessor(session)
            user = CalorieAppUserDB()
            snapshot = FoodLogDB(
                owner_id=user.id,
                product_name="Synthetic Snapshot",
                calories=100,
            )
            session.add_all([user, snapshot])
            session.commit()

            result = _correct(session, predecessor.id, value="105.0")
            duplicate = _correct(session, predecessor.id, value="105.00")

            assert result.created is True
            assert duplicate.created is False
            assert duplicate.assertion.id == result.assertion.id
            assert duplicate.audit.id == result.audit.id
            assert result.assertion.value == "105"
            assert result.assertion.verification_status == "quarantined"
            assert result.assertion.verification_version == 1
            assert result.assertion.supersedes_assertion_id == predecessor.id
            assert result.audit.predecessor_assertion_id == predecessor.id
            assert result.audit.correction_assertion_id == result.assertion.id
            assert result.audit.expected_predecessor_version == 2
            assert result.audit.resulting_correction_version == 1
            assert result.audit.authorization_scope == SOURCE_ASSERTION_CORRECTION_SCOPE

            session.refresh(predecessor)
            session.refresh(snapshot)
            assert predecessor.value == "100"
            assert predecessor.verification_status == "validated"
            assert predecessor.verification_version == 2
            assert predecessor.supersedes_assertion_id is None
            assert snapshot.calories == 100
            assert len(session.exec(select(FoodAttributeAssertionDB)).all()) == 2
            assert len(
                session.exec(select(FoodAttributeAssertionCorrectionAuditDB)).all()
            ) == 1

        columns = {
            column["name"]
            for column in inspect(engine).get_columns(
                "food_attribute_assertion_correction_audit"
            )
        }
        assert "free_text" not in columns
        assert "payload" not in columns
        assert "email" not in columns
        assert "ip_address" not in columns
        assert "wallet_address" not in columns
    finally:
        engine.dispose()


def test_assertion_correction_allows_a_rejected_terminal_predecessor(tmp_path) -> None:
    engine = _engine(tmp_path / "rejected-predecessor.db")
    try:
        with Session(engine) as session:
            predecessor, _, _, _, _ = _seed_predecessor(
                session,
                terminal_status="rejected",
            )
            result = _correct(session, predecessor.id)
            assert result.created is True
            assert result.assertion.verification_status == "quarantined"
            assert result.assertion.supersedes_assertion_id == predecessor.id
    finally:
        engine.dispose()


def test_assertion_correction_requires_a_terminal_predecessor(tmp_path) -> None:
    engine = _engine(tmp_path / "quarantined-predecessor.db")
    try:
        with Session(engine) as session:
            predecessor, _, _, _, _ = _seed_predecessor(
                session,
                terminal_status=None,
            )
            with pytest.raises(SourceAssertionCorrectionRejected) as rejected:
                _correct(
                    session,
                    predecessor.id,
                    expected_predecessor_version=1,
                )
            assert (
                rejected.value.reason
                == "source_assertion_correction_predecessor_not_terminal"
            )
            assert rejected.value.status_code == 409
            assert session.exec(
                select(FoodAttributeAssertionCorrectionAuditDB)
            ).all() == []
    finally:
        engine.dispose()


def test_assertion_correction_rejects_stale_or_missing_predecessor(tmp_path) -> None:
    engine = _engine(tmp_path / "stale-predecessor.db")
    try:
        with Session(engine) as session:
            predecessor, _, _, _, _ = _seed_predecessor(session)
            with pytest.raises(SourceAssertionCorrectionRejected) as stale:
                _correct(
                    session,
                    predecessor.id,
                    expected_predecessor_version=1,
                )
            assert stale.value.reason == "source_assertion_correction_version_conflict"
            assert stale.value.status_code == 409

            with pytest.raises(SourceAssertionCorrectionRejected) as missing:
                _correct(
                    session,
                    "missing-assertion",
                    idempotency_key="missing-correction",
                )
            assert (
                missing.value.reason
                == "source_assertion_correction_predecessor_not_found"
            )
            assert missing.value.status_code == 404
    finally:
        engine.dispose()


def test_assertion_correction_prevents_forks_and_idempotency_reuse(tmp_path) -> None:
    engine = _engine(tmp_path / "correction-conflicts.db")
    try:
        with Session(engine) as session:
            predecessor, _, _, _, _ = _seed_predecessor(session)
            _correct(session, predecessor.id)

            with pytest.raises(SourceAssertionCorrectionRejected) as reused:
                _correct(session, predecessor.id, value="106")
            assert (
                reused.value.reason
                == "source_assertion_correction_idempotency_conflict"
            )
            assert reused.value.status_code == 409

            with pytest.raises(SourceAssertionCorrectionRejected) as forked:
                _correct(
                    session,
                    predecessor.id,
                    idempotency_key="assertion-correction-2",
                    value="106",
                )
            assert forked.value.reason == "source_assertion_already_corrected"
            assert forked.value.status_code == 409
            assert len(session.exec(select(FoodAttributeAssertionDB)).all()) == 2
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
def test_assertion_correction_rechecks_active_reviewed_lineage(
    tmp_path,
    entity_name: str,
    invalid_status: str,
) -> None:
    engine = _engine(tmp_path / f"invalid-correction-lineage-{entity_name}.db")
    try:
        with Session(engine) as session:
            predecessor, source, record, product, link = _seed_predecessor(session)
            entities = {
                "source": (source, "status"),
                "record": (record, "verification_status"),
                "product": (product, "status"),
                "link": (link, "review_status"),
            }
            entity, field_name = entities[entity_name]
            setattr(entity, field_name, invalid_status)
            session.add(entity)
            session.commit()

            with pytest.raises(SourceAssertionCorrectionRejected) as rejected:
                _correct(session, predecessor.id)
            assert (
                rejected.value.reason
                == "source_assertion_correction_lineage_not_active"
            )
            assert rejected.value.status_code == 409
            assert session.exec(
                select(FoodAttributeAssertionCorrectionAuditDB)
            ).all() == []
    finally:
        engine.dispose()


def test_assertion_correction_respects_the_shared_source_budget(tmp_path) -> None:
    engine = _engine(tmp_path / "correction-budget.db")
    try:
        with Session(engine) as session:
            predecessor, _, _, _, _ = _seed_predecessor(
                session,
                assertion_limit=1,
            )
            with pytest.raises(SourceAssertionCorrectionRejected) as rejected:
                _correct(session, predecessor.id)
            assert rejected.value.reason == "source_assertion_budget_reached"
            assert rejected.value.status_code == 409
            assert len(session.exec(select(FoodAttributeAssertionDB)).all()) == 1
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "overrides",
    [
        {"predecessor_assertion_id": " predecessor"},
        {"expected_predecessor_version": 0},
        {"expected_predecessor_version": True},
        {"idempotency_key": " correction"},
        {"corrector_reference": "Corrector Name"},
        {"reason_code": "free text"},
        {"attribute_key": "unknown.attribute"},
        {"value": "private@example.test"},
        {"unit_or_value_type": "wrong-unit"},
        {"observed_or_effective_at": datetime.now().astimezone()},
    ],
)
def test_invalid_assertion_correction_is_rejected_before_database_work(
    overrides: dict[str, object],
) -> None:
    class UnusedSession:
        def get_bind(self):
            raise AssertionError("database must not be touched")

    values: dict[str, object] = {
        "predecessor_assertion_id": "assertion-1",
        "expected_predecessor_version": 2,
        "idempotency_key": "assertion-correction-1",
        "corrector_reference": "corrector-test",
        "authorization_scope": SOURCE_ASSERTION_CORRECTION_SCOPE,
        "reason_code": "synthetic-evidence-corrected",
        "attribute_key": "nutrition.energy",
        "value": "105",
        "unit_or_value_type": "kcal-per-100g",
        "observed_or_effective_at": CORRECTED_AT,
    }
    values.update(overrides)
    with pytest.raises(ValueError):
        correct_source_assertion(UnusedSession(), **values)  # type: ignore[arg-type]


def test_assertion_correction_scope_denial_precedes_database_work() -> None:
    class UnusedSession:
        def get_bind(self):
            raise AssertionError("database must not be touched")

    with pytest.raises(SourceAssertionCorrectionRejected) as rejected:
        correct_source_assertion(  # type: ignore[arg-type]
            UnusedSession(),
            predecessor_assertion_id="assertion-1",
            expected_predecessor_version=2,
            idempotency_key="assertion-correction-1",
            corrector_reference="corrector-test",
            authorization_scope="catalog:read",
            reason_code="synthetic-evidence-corrected",
            attribute_key="nutrition.energy",
            value="105",
            unit_or_value_type="kcal-per-100g",
            observed_or_effective_at=CORRECTED_AT,
        )
    assert rejected.value.reason == "source_assertion_correction_scope_denied"
    assert rejected.value.status_code == 403
    assert rejected.value.retry_after_seconds is None


def test_assertion_correction_database_failure_fails_closed() -> None:
    class BrokenSession:
        rolled_back = False

        def get_bind(self):
            raise SQLAlchemyError("synthetic database failure")

        def rollback(self) -> None:
            self.rolled_back = True

    session = BrokenSession()
    with pytest.raises(SourceAssertionCorrectionRejected) as rejected:
        _correct(session, "assertion-1")  # type: ignore[arg-type]
    assert rejected.value.reason == "source_assertion_correction_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5
    assert session.rolled_back is True


def test_assertion_correction_unsupported_backend_fails_closed_explicitly() -> None:
    class UnsupportedDialect:
        name = "mysql"

    class UnsupportedBind:
        dialect = UnsupportedDialect()

    class UnsupportedBackendSession:
        rolled_back = False

        def get_bind(self):
            return UnsupportedBind()

        def rollback(self) -> None:
            self.rolled_back = True

    session = UnsupportedBackendSession()
    with pytest.raises(SourceAssertionCorrectionRejected) as rejected:
        _correct(session, "assertion-1")  # type: ignore[arg-type]
    assert rejected.value.reason == "source_assertion_correction_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5
    assert rejected.value.__cause__ is None
    assert session.rolled_back is True


def test_correction_idempotency_survives_later_moderation(tmp_path) -> None:
    engine = _engine(tmp_path / "correction-after-moderation.db")
    try:
        with Session(engine) as session:
            predecessor, _, _, _, _ = _seed_predecessor(session)
            correction = _correct(session, predecessor.id).assertion
            moderate_source_assertion(
                session,
                assertion_id=correction.id,
                target_status="validated",
                expected_version=1,
                idempotency_key="correction-moderation",
                moderator_reference="moderator-test",
                authorization_scope=SOURCE_ASSERTION_MODERATION_SCOPE,
                reason_code="synthetic-quality-reviewed",
            )

            duplicate = _correct(session, predecessor.id)
            assert duplicate.created is False
            assert duplicate.assertion.id == correction.id
            assert duplicate.assertion.verification_status == "validated"
            assert duplicate.assertion.verification_version == 2
    finally:
        engine.dispose()


def test_sqlite_assertion_correction_serializes_concurrent_decisions(
    tmp_path,
) -> None:
    engine = _engine(tmp_path / "concurrent-assertion-correction.db", concurrent=True)
    try:
        with Session(engine) as session:
            predecessor_id = _seed_predecessor(session)[0].id

        def attempt(index: int) -> str:
            with Session(engine) as session:
                try:
                    result = _correct(
                        session,
                        predecessor_id,
                        idempotency_key=f"concurrent-correction-{index}",
                        value=str(105 + index),
                        observed_at=CORRECTED_AT + timedelta(minutes=index),
                    )
                except SourceAssertionCorrectionRejected as exc:
                    return exc.reason
            return "corrected" if result.created else "duplicate"

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(attempt, range(8)))

        assert results.count("corrected") == 1
        assert results.count("source_assertion_already_corrected") == 7
        with Session(engine) as session:
            assertions = session.exec(select(FoodAttributeAssertionDB)).all()
            audits = session.exec(
                select(FoodAttributeAssertionCorrectionAuditDB)
            ).all()
        assert len(assertions) == 2
        assert len(audits) == 1
    finally:
        engine.dispose()
