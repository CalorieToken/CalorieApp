from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy import event, inspect
from sqlalchemy.exc import IntegrityError
from sqlmodel import SQLModel, Session, create_engine, select

from app.models import (
    CalorieAppUserDB,
    FoodAttributeAssertionDB,
    FoodLogDB,
    FoodProductDB,
    FoodProductSourceLinkDB,
    FoodSourceDB,
    FoodSourceRecordDB,
)
from app.services.source_assertion_catalog import (
    export_product_assertion_evidence,
)


OBSERVED_AT = datetime(2026, 8, 31, 12, 0, 0)


def _engine(tmp_path, name: str):
    engine = create_engine(f"sqlite:///{tmp_path / name}")

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    SQLModel.metadata.create_all(engine)
    return engine


def _source(source_key: str, licence_id: str) -> FoodSourceDB:
    return FoodSourceDB(
        source_key=source_key,
        source_category="open-dataset",
        operator_name=f"Synthetic {source_key}",
        status="enabled",
        licence_id=licence_id,
        terms_reference=f"https://example.test/{source_key}/terms",
        attribution_text=f"Attribution for {source_key}",
        record_limit=20,
    )


def _record(source: FoodSourceDB, external_id: str) -> FoodSourceRecordDB:
    return FoodSourceRecordDB(
        source_id=source.id,
        external_record_id=external_id,
        source_version_or_content_digest="version-1",
        retrieved_or_submitted_at=OBSERVED_AT,
        verification_status="validated",
        verification_version=2,
    )


def _link(
    product: FoodProductDB,
    record: FoodSourceRecordDB,
) -> FoodProductSourceLinkDB:
    return FoodProductSourceLinkDB(
        food_product_id=product.id,
        source_record_id=record.id,
        match_method="synthetic-reviewed-match",
        match_confidence=0.95,
        review_status="validated",
    )


def _assertion(
    product: FoodProductDB,
    record: FoodSourceRecordDB,
    *,
    value: str,
    observed_at: datetime = OBSERVED_AT,
    supersedes: str | None = None,
) -> FoodAttributeAssertionDB:
    return FoodAttributeAssertionDB(
        food_product_id=product.id,
        source_record_id=record.id,
        attribute_key="energy-kcal-per-100g",
        value=value,
        unit_or_value_type="kcal-per-100g",
        observed_or_effective_at=observed_at,
        verification_status="validated",
        verification_version=2,
        supersedes_assertion_id=supersedes,
    )


def test_conflicting_assertions_remain_separate_with_source_licensing(tmp_path) -> None:
    engine = _engine(tmp_path, "conflicts.db")
    try:
        with Session(engine) as session:
            source_a = _source("synthetic-a", "licence-a")
            source_b = _source("synthetic-b", "licence-b")
            session.add_all([source_a, source_b])
            session.commit()

            record_a = _record(source_a, "record-a")
            record_b = _record(source_b, "record-b")
            product = FoodProductDB(status="active")
            session.add_all([record_a, record_b, product])
            session.commit()
            session.add_all([_link(product, record_a), _link(product, record_b)])
            session.commit()
            session.add_all(
                [
                    _assertion(product, record_a, value="100"),
                    _assertion(product, record_b, value="120"),
                ]
            )
            session.commit()

            evidence = export_product_assertion_evidence(
                session,
                food_product_id=product.id,
            )

            assert [(item.source_key, item.value) for item in evidence] == [
                ("synthetic-a", "100"),
                ("synthetic-b", "120"),
            ]
            assert {item.licence_id for item in evidence} == {
                "licence-a",
                "licence-b",
            }
            assert all(item.terms_reference for item in evidence)
            assert all(item.attribution_text for item in evidence)
            assert {item.link_review_status for item in evidence} == {"validated"}
            assert {item.match_method for item in evidence} == {
                "synthetic-reviewed-match"
            }
            assert len(session.exec(select(FoodAttributeAssertionDB)).all()) == 2
    finally:
        engine.dispose()


def test_correction_preserves_prior_assertion_and_private_snapshot(tmp_path) -> None:
    engine = _engine(tmp_path, "correction.db")
    try:
        with Session(engine) as session:
            user = CalorieAppUserDB()
            snapshot = FoodLogDB(
                owner_id=user.id,
                product_name="Synthetic Snapshot",
                calories=100,
            )
            source = _source("synthetic-correction", "licence-correction")
            session.add_all([user, snapshot, source])
            session.commit()

            record = _record(source, "record-correction")
            product = FoodProductDB(status="active")
            session.add_all([record, product])
            session.commit()
            session.add(_link(product, record))
            session.commit()

            original = _assertion(product, record, value="100")
            session.add(original)
            session.commit()
            corrected = _assertion(
                product,
                record,
                value="105",
                observed_at=datetime(2026, 8, 31, 13, 0, 0),
                supersedes=original.id,
            )
            session.add(corrected)
            session.commit()

            session.refresh(snapshot)
            assert snapshot.calories == 100
            assertions = session.exec(
                select(FoodAttributeAssertionDB).order_by(
                    FoodAttributeAssertionDB.observed_or_effective_at
                )
            ).all()
            assert [item.value for item in assertions] == ["100", "105"]
            assert assertions[1].supersedes_assertion_id == assertions[0].id
            assert len(
                export_product_assertion_evidence(
                    session,
                    food_product_id=product.id,
                )
            ) == 2
    finally:
        engine.dispose()


def test_assertion_requires_the_reviewable_product_source_pair(tmp_path) -> None:
    engine = _engine(tmp_path, "provenance.db")
    try:
        with Session(engine) as session:
            source = _source("synthetic-provenance", "licence-provenance")
            session.add(source)
            session.commit()
            record = _record(source, "record-provenance")
            linked_product = FoodProductDB(status="active")
            unlinked_product = FoodProductDB(status="active")
            session.add_all([record, linked_product, unlinked_product])
            session.commit()
            session.add(_link(linked_product, record))
            session.commit()

            session.add(_assertion(unlinked_product, record, value="100"))
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
            assert session.exec(select(FoodAttributeAssertionDB)).all() == []
    finally:
        engine.dispose()


def test_identical_evidence_can_exist_for_distinct_valid_product_links(
    tmp_path,
) -> None:
    engine = _engine(tmp_path, "multi-product-evidence.db")
    try:
        with Session(engine) as session:
            source = _source("synthetic-multi-product", "licence-multi-product")
            session.add(source)
            session.commit()
            record = _record(source, "record-multi-product")
            product_a = FoodProductDB(status="active")
            product_b = FoodProductDB(status="active")
            session.add_all([record, product_a, product_b])
            session.commit()
            session.add_all([_link(product_a, record), _link(product_b, record)])
            session.commit()

            session.add_all(
                [
                    _assertion(product_a, record, value="100"),
                    _assertion(product_b, record, value="100"),
                ]
            )
            session.commit()

            assertions = session.exec(select(FoodAttributeAssertionDB)).all()
            assert len(assertions) == 2
            assert {item.food_product_id for item in assertions} == {
                product_a.id,
                product_b.id,
            }
    finally:
        engine.dispose()


def test_correction_must_stay_with_the_same_product_and_source_record(
    tmp_path,
) -> None:
    engine = _engine(tmp_path, "correction-lineage.db")
    try:
        with Session(engine) as session:
            source = _source("synthetic-lineage", "licence-lineage")
            session.add(source)
            session.commit()
            record = _record(source, "record-lineage")
            product_a = FoodProductDB(status="active")
            product_b = FoodProductDB(status="active")
            session.add_all([record, product_a, product_b])
            session.commit()
            session.add_all([_link(product_a, record), _link(product_b, record)])
            session.commit()

            original = _assertion(product_a, record, value="100")
            session.add(original)
            session.commit()
            session.add(
                _assertion(
                    product_b,
                    record,
                    value="105",
                    observed_at=datetime(2026, 8, 31, 13, 0, 0),
                    supersedes=original.id,
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()
            assert session.exec(select(FoodAttributeAssertionDB)).all() == [
                original
            ]
    finally:
        engine.dispose()


def test_catalog_schema_contains_no_private_identity_or_raw_payload_columns(
    tmp_path,
) -> None:
    engine = _engine(tmp_path, "privacy.db")
    try:
        forbidden = {
            "raw_payload",
            "email",
            "session_id",
            "wallet_address",
            "ip_address",
            "calorieapp_user_id",
            "owner_id",
        }
        for table_name in (
            "food_product",
            "food_product_source_link",
            "food_attribute_assertion",
        ):
            columns = {
                column["name"]
                for column in inspect(engine).get_columns(table_name)
            }
            assert columns.isdisjoint(forbidden)
    finally:
        engine.dispose()


@pytest.mark.parametrize("food_product_id", ["", " product", "product ", "x" * 65])
def test_invalid_export_identity_is_rejected_before_database_work(
    food_product_id: str,
) -> None:
    class UnusedSession:
        def exec(self, _statement):
            raise AssertionError("database must not be touched")

    with pytest.raises(ValueError):
        export_product_assertion_evidence(  # type: ignore[arg-type]
            UnusedSession(),
            food_product_id=food_product_id,
        )
