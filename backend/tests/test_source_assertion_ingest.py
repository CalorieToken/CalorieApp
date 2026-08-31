from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

import pytest
from sqlalchemy import event, inspect
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import SQLModel, Session, create_engine, select

from app.models import (
    FoodAttributeAssertionDB,
    FoodAttributeAssertionIngestAuditDB,
    FoodProductDB,
    FoodProductSourceLinkDB,
    FoodSourceDB,
    FoodSourceRecordDB,
)
from app.services.source_assertion_ingest import (
    SOURCE_ASSERTION_INGEST_SCOPE,
    SourceAssertionIngestRejected,
    ingest_source_assertion,
)


OBSERVED_AT = datetime(2026, 8, 31, 12, 0, 0)


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


def _seed(
    session: Session,
    *,
    source_status: str = "enabled",
    record_status: str = "validated",
    product_status: str = "active",
    link_status: str = "validated",
    assertion_limit: int = 3,
    record_count: int = 1,
) -> tuple[FoodSourceDB, FoodProductDB, list[FoodSourceRecordDB]]:
    source = FoodSourceDB(
        source_key="synthetic-assertions",
        source_category="open-dataset",
        operator_name="Synthetic Assertion Source",
        status=source_status,
        licence_id="synthetic-test-only",
        terms_reference="https://example.test/terms",
        attribution_text="Synthetic test data",
        record_limit=max(record_count, 1),
        assertion_limit=assertion_limit,
    )
    product = FoodProductDB(status=product_status)
    records = [
        FoodSourceRecordDB(
            source_id=source.id,
            external_record_id=f"record-{index}",
            source_version_or_content_digest="version-1",
            verification_status=record_status,
            verification_version=2,
        )
        for index in range(record_count)
    ]
    session.add_all([source, product])
    session.commit()
    session.add_all(records)
    session.commit()
    links = [
        FoodProductSourceLinkDB(
            food_product_id=product.id,
            source_record_id=record.id,
            match_method="synthetic-reviewed-match",
            match_confidence=1,
            review_status=link_status,
        )
        for record in records
    ]
    session.add_all(links)
    session.commit()
    return source, product, records


def _ingest(
    session: Session,
    product_id: str,
    record_id: str,
    *,
    idempotency_key: str = "assertion-ingest-1",
    expected_version: int = 2,
    attribute_key: str = "nutrition.energy",
    value: str = "100",
    observed_at: datetime = OBSERVED_AT,
):
    return ingest_source_assertion(
        session,
        food_product_id=product_id,
        source_record_id=record_id,
        expected_source_record_version=expected_version,
        idempotency_key=idempotency_key,
        submitter_reference="adapter-synthetic-test",
        authorization_scope=SOURCE_ASSERTION_INGEST_SCOPE,
        attribute_key=attribute_key,
        value=value,
        unit_or_value_type="kcal-per-100g",
        observed_or_effective_at=observed_at,
    )


def test_assertion_ingest_is_idempotent_quarantined_audited_and_budgeted(
    tmp_path,
) -> None:
    engine = _engine(tmp_path / "assertion-ingest.db")
    try:
        with Session(engine) as session:
            source, product, records = _seed(session, assertion_limit=2)
            first = _ingest(session, product.id, records[0].id)
            duplicate = _ingest(session, product.id, records[0].id)
            second = _ingest(
                session,
                product.id,
                records[0].id,
                idempotency_key="assertion-ingest-2",
                attribute_key="nutrition.protein",
                value="7.5",
            )

            assert first.created is True
            assert duplicate.created is False
            assert duplicate.assertion.id == first.assertion.id
            assert duplicate.audit.id == first.audit.id
            assert second.created is True
            assert first.assertion.verification_status == "quarantined"
            assert first.assertion.verification_version == 1
            assert first.assertion.supersedes_assertion_id is None
            assert first.audit.assertion_id == first.assertion.id
            assert first.audit.food_product_id == product.id
            assert first.audit.source_record_id == records[0].id
            assert first.audit.expected_source_record_version == 2
            assert first.audit.resulting_assertion_version == 1
            assert first.audit.authorization_scope == SOURCE_ASSERTION_INGEST_SCOPE

            with pytest.raises(SourceAssertionIngestRejected) as rejected:
                _ingest(
                    session,
                    product.id,
                    records[0].id,
                    idempotency_key="assertion-ingest-3",
                    attribute_key="nutrition.fat",
                    value="3.2",
                )
            assert rejected.value.reason == "source_assertion_budget_reached"
            assert rejected.value.status_code == 409
            assert rejected.value.retry_after_seconds is None

            assertions = session.exec(select(FoodAttributeAssertionDB)).all()
            audits = session.exec(
                select(FoodAttributeAssertionIngestAuditDB)
            ).all()
            assert len(assertions) == source.assertion_limit == 2
            assert len(audits) == 2

        columns = {
            column["name"]
            for column in inspect(engine).get_columns(
                "food_attribute_assertion_ingest_audit"
            )
        }
        assert "free_text" not in columns
        assert "raw_payload" not in columns
        assert "email" not in columns
        assert "ip_address" not in columns
    finally:
        engine.dispose()


def test_assertion_ingest_rejects_reused_key_and_duplicate_evidence(tmp_path) -> None:
    engine = _engine(tmp_path / "assertion-conflicts.db")
    try:
        with Session(engine) as session:
            _, product, records = _seed(session, assertion_limit=5)
            _ingest(session, product.id, records[0].id)

            with pytest.raises(SourceAssertionIngestRejected) as reused:
                _ingest(
                    session,
                    product.id,
                    records[0].id,
                    attribute_key="nutrition.protein",
                )
            assert reused.value.reason == "source_assertion_ingest_idempotency_conflict"
            assert reused.value.status_code == 409

            with pytest.raises(SourceAssertionIngestRejected) as evidence:
                _ingest(
                    session,
                    product.id,
                    records[0].id,
                    idempotency_key="different-ingest-key",
                )
            assert evidence.value.reason == "source_assertion_evidence_already_exists"
            assert evidence.value.status_code == 409
            assert len(session.exec(select(FoodAttributeAssertionDB)).all()) == 1
            assert len(
                session.exec(select(FoodAttributeAssertionIngestAuditDB)).all()
            ) == 1
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    ("seed_overrides", "expected_version", "reason"),
    [
        ({}, 1, "source_record_version_conflict"),
        ({"record_status": "quarantined"}, 2, "source_record_not_validated"),
        ({"source_status": "paused"}, 2, "source_assertion_ingest_not_enabled"),
        ({"product_status": "staged"}, 2, "food_product_not_active"),
        ({"link_status": "quarantined"}, 2, "product_source_link_not_validated"),
    ],
)
def test_assertion_ingest_requires_reviewed_active_lineage(
    tmp_path,
    seed_overrides: dict[str, str],
    expected_version: int,
    reason: str,
) -> None:
    engine = _engine(tmp_path / f"{reason}.db")
    try:
        with Session(engine) as session:
            _, product, records = _seed(session, **seed_overrides)
            with pytest.raises(SourceAssertionIngestRejected) as rejected:
                _ingest(
                    session,
                    product.id,
                    records[0].id,
                    expected_version=expected_version,
                )
            assert rejected.value.reason == reason
            assert rejected.value.status_code == 409
            assert session.exec(select(FoodAttributeAssertionDB)).all() == []
            assert session.exec(
                select(FoodAttributeAssertionIngestAuditDB)
            ).all() == []
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    ("missing_field", "reason"),
    [
        ("record", "source_record_not_found"),
        ("product", "food_product_not_found"),
    ],
)
def test_assertion_ingest_rejects_missing_lineage_without_audit(
    tmp_path,
    missing_field: str,
    reason: str,
) -> None:
    engine = _engine(tmp_path / f"missing-{missing_field}.db")
    try:
        with Session(engine) as session:
            _, product, records = _seed(session)
            product_id = "missing-product" if missing_field == "product" else product.id
            record_id = "missing-record" if missing_field == "record" else records[0].id
            with pytest.raises(SourceAssertionIngestRejected) as rejected:
                _ingest(session, product_id, record_id)
            assert rejected.value.reason == reason
            assert rejected.value.status_code == 404
            assert session.exec(select(FoodAttributeAssertionDB)).all() == []
            assert session.exec(
                select(FoodAttributeAssertionIngestAuditDB)
            ).all() == []
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "overrides",
    [
        {"food_product_id": " product-1"},
        {"source_record_id": "record?"},
        {"expected_source_record_version": 0},
        {"expected_source_record_version": True},
        {"idempotency_key": " ingest-key"},
        {"submitter_reference": "Adapter Name"},
        {"attribute_key": "Nutrition.Energy"},
        {"value": " 100"},
        {"value": "100\n"},
        {"value": "x" * 256},
        {"unit_or_value_type": "KCAL"},
        {"observed_or_effective_at": datetime.now(UTC)},
    ],
)
def test_invalid_assertion_request_is_rejected_before_database_work(
    overrides: dict[str, object],
) -> None:
    class UnusedSession:
        def get_bind(self):
            raise AssertionError("database must not be touched")

    values: dict[str, object] = {
        "food_product_id": "product-1",
        "source_record_id": "record-1",
        "expected_source_record_version": 2,
        "idempotency_key": "assertion-ingest-1",
        "submitter_reference": "adapter-synthetic-test",
        "authorization_scope": SOURCE_ASSERTION_INGEST_SCOPE,
        "attribute_key": "nutrition.energy",
        "value": "100",
        "unit_or_value_type": "kcal-per-100g",
        "observed_or_effective_at": OBSERVED_AT,
    }
    values.update(overrides)
    with pytest.raises(ValueError):
        ingest_source_assertion(UnusedSession(), **values)  # type: ignore[arg-type]


def test_assertion_ingest_scope_denial_precedes_database_work() -> None:
    class UnusedSession:
        def get_bind(self):
            raise AssertionError("database must not be touched")

    with pytest.raises(SourceAssertionIngestRejected) as rejected:
        ingest_source_assertion(  # type: ignore[arg-type]
            UnusedSession(),
            food_product_id="product-1",
            source_record_id="record-1",
            expected_source_record_version=2,
            idempotency_key="assertion-ingest-1",
            submitter_reference="adapter-synthetic-test",
            authorization_scope="catalog:read",
            attribute_key="nutrition.energy",
            value="100",
            unit_or_value_type="kcal-per-100g",
            observed_or_effective_at=OBSERVED_AT,
        )
    assert rejected.value.reason == "source_assertion_ingest_scope_denied"
    assert rejected.value.status_code == 403
    assert rejected.value.retry_after_seconds is None


def test_assertion_ingest_database_failure_fails_closed() -> None:
    class BrokenSession:
        rolled_back = False

        def get_bind(self):
            raise SQLAlchemyError("synthetic database failure")

        def rollback(self) -> None:
            self.rolled_back = True

    session = BrokenSession()
    with pytest.raises(SourceAssertionIngestRejected) as rejected:
        _ingest(session, "product-1", "record-1")  # type: ignore[arg-type]
    assert rejected.value.reason == "source_assertion_ingest_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5
    assert session.rolled_back is True


def test_database_rejects_non_positive_source_assertion_budget(tmp_path) -> None:
    engine = _engine(tmp_path / "invalid-assertion-limit.db")
    try:
        with Session(engine) as session:
            session.add(
                FoodSourceDB(
                    source_key="invalid-assertion-limit",
                    source_category="open-dataset",
                    operator_name="Synthetic Assertion Source",
                    status="enabled",
                    licence_id="synthetic-test-only",
                    terms_reference="https://example.test/terms",
                    attribution_text="Synthetic test data",
                    record_limit=1,
                    assertion_limit=0,
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
            assert session.exec(select(FoodSourceDB)).all() == []
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    ("field_name", "invalid_value"),
    [
        ("resulting_assertion_version", 2),
        ("authorization_scope", "catalog:read"),
    ],
)
def test_database_rejects_invalid_assertion_ingest_audit(
    tmp_path,
    field_name: str,
    invalid_value: object,
) -> None:
    engine = _engine(tmp_path / f"invalid-audit-{field_name}.db")
    try:
        with Session(engine) as session:
            _, product, records = _seed(session)
            result = _ingest(session, product.id, records[0].id)
            setattr(result.audit, field_name, invalid_value)
            session.add(result.audit)
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
            persisted = session.get(
                FoodAttributeAssertionIngestAuditDB,
                result.audit.id,
            )
            assert persisted is not None
            assert getattr(persisted, field_name) != invalid_value
    finally:
        engine.dispose()


def test_sqlite_assertion_budget_serializes_concurrent_local_writers(
    tmp_path,
) -> None:
    engine = _engine(tmp_path / "concurrent-assertions.db", concurrent=True)
    try:
        with Session(engine) as session:
            _, product, records = _seed(
                session,
                assertion_limit=3,
                record_count=8,
            )
            product_id = product.id
            record_ids = [record.id for record in records]

        def attempt(index: int) -> str:
            with Session(engine) as session:
                try:
                    result = _ingest(
                        session,
                        product_id,
                        record_ids[index],
                        idempotency_key=f"concurrent-assertion-{index}",
                    )
                except SourceAssertionIngestRejected as exc:
                    return exc.reason
            return "created" if result.created else "duplicate"

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(attempt, range(8)))

        assert results.count("created") == 3
        assert results.count("source_assertion_budget_reached") == 5
        with Session(engine) as session:
            assert len(session.exec(select(FoodAttributeAssertionDB)).all()) == 3
            assert len(
                session.exec(select(FoodAttributeAssertionIngestAuditDB)).all()
            ) == 3
    finally:
        engine.dispose()
