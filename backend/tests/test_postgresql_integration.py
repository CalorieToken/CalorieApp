from __future__ import annotations

import asyncio
import hashlib
import multiprocessing
import os
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import Session, create_engine, select

import app.database as db_module
import app.main as main_module
from app.account_data_import import AccountDataImportPlan, PlannedFoodLogImport
from app.account_data_import_transaction import (
    execute_account_data_import_transaction,
)
from app.capacity import database_capacity_snapshot, database_used_bytes
from app.capacity_probe import EXIT_PAUSE, capacity_probe_from_session
from app.data_growth import (
    DataGrowthAdmissionRejected,
    create_food_log_with_subject_budget,
)
from app.main import SESSION_COOKIE_NAME, app
from app.inactive_account_erasure_execution import (
    execute_inactive_account_erasure,
)
from app.inactive_account_erasure_preflight import (
    preflight_inactive_account_erasure,
)
from app.inactive_account_preview import preview_inactive_accounts
from app.models import (
    AccountDataImportReceiptDB,
    AuthSessionDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodAttributeAssertionCorrectionAuditDB,
    FoodAttributeAssertionDB,
    FoodAttributeAssertionIngestAuditDB,
    FoodAttributeAssertionModerationAuditDB,
    FoodLogDB,
    FoodProductDB,
    FoodProductSourceLinkDB,
    FoodSourceDB,
    FoodSourceModerationAuditDB,
    FoodSourceRecordDB,
    InactiveAccountNoticeDB,
    OriginLoginHandoffDB,
    PendingLoginLocaleDB,
    PendingLoginStateDB,
    utc_now,
)
from app.provider_rate_governor import PostgreSQLSlidingWindowRateGovernor
from app.postgresql_locking import (
    POSTGRESQL_ADVISORY_LOCK_TIMEOUT_MILLISECONDS,
    acquire_bounded_transaction_advisory_locks,
)
from app.postgresql_privileges import (
    APPLICATION_APPEND_DELETE_TABLES,
    APPLICATION_AUDIT_TABLES,
    apply_postgresql_application_privileges,
    verify_postgresql_application_privileges,
)
from app.route_rate_limiter import (
    PostgreSQLRouteRateLimiter,
    RouteRateLimitRejected,
    RouteRatePolicy,
)
from app.schema_migrations import SCHEMA_HEAD, current_revision, upgrade_database
from app.schema_migrations.versions.v20260830_0001 import food_log as migration_food_log
from app.source_admission import AdapterAdmissionRejected
from app.services.identity import (
    IdentityStartAdmissionRejected,
    create_limited_login_transaction,
)
from app.services.source_assertion_correction import (
    SOURCE_ASSERTION_CORRECTION_SCOPE,
    SourceAssertionCorrectionRejected,
    correct_source_assertion,
)
from app.services.source_assertion_ingest import (
    SOURCE_ASSERTION_INGEST_SCOPE,
    SourceAssertionIngestRejected,
    ingest_source_assertion,
)
from app.services.source_assertion_moderation import (
    SOURCE_ASSERTION_MODERATION_SCOPE,
    SourceAssertionModerationRejected,
    moderate_source_assertion,
)
from app.services.source_catalog import ingest_source_record
from app.services.source_moderation import (
    SOURCE_MODERATION_SCOPE,
    SourceModerationRejected,
    moderate_source_record,
)


POSTGRES_TEST_URL_ENV = "CALORIEAPP_POSTGRES_TEST_DATABASE_URL"
ASSERTION_OBSERVED_AT = datetime(2026, 8, 31, 12, 0, 0)


def _shared_rate_governor_process_attempt(
    args: tuple[str, str, int],
) -> tuple[str, int | None, int | None]:
    raw_url, provider_key, limit = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    governor = PostgreSQLSlidingWindowRateGovernor(
        worker_engine,
        provider_key=provider_key,
        limit=limit,
        window_seconds=60,
    )
    try:
        asyncio.run(governor.acquire())
    except AdapterAdmissionRejected as exc:
        return ("rejected", exc.status_code, exc.retry_after_seconds)
    finally:
        worker_engine.dispose()
    return ("admitted", None, None)


def _shared_route_limiter_process_attempt(
    args: tuple[str, str, int],
) -> tuple[str, int | None, int | None]:
    raw_url, route_key, limit = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    limiter = PostgreSQLRouteRateLimiter(worker_engine)
    policy = RouteRatePolicy(route_key, limit)
    try:
        asyncio.run(limiter.acquire(policy))
    except RouteRateLimitRejected as exc:
        return ("rejected", exc.status_code, exc.retry_after_seconds)
    finally:
        worker_engine.dispose()
    return ("admitted", None, None)


def _identity_start_process_attempt(
    args: tuple[str, str, int, int],
) -> tuple[str, int | None, int | None, str | None]:
    raw_url, client_id, start_limit, outstanding_limit = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    try:
        with Session(worker_engine) as session:
            create_limited_login_transaction(
                session,
                client_id=client_id,
                state_lifetime_seconds=300,
                start_limit=start_limit,
                outstanding_limit=outstanding_limit,
            )
    except IdentityStartAdmissionRejected as exc:
        return (
            "rejected",
            exc.status_code,
            exc.retry_after_seconds,
            exc.reason,
        )
    finally:
        worker_engine.dispose()
    return ("admitted", None, None, None)


def _food_log_growth_process_attempt(
    args: tuple[str, str, int, int],
) -> tuple[str, int | None, str | None]:
    raw_url, owner_id, limit, index = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    try:
        with Session(worker_engine) as session:
            create_food_log_with_subject_budget(
                session,
                FoodLogDB(
                    product_name=f"concurrent-{index}",
                    calories=1,
                    owner_id=owner_id,
                ),
                limit=limit,
            )
    except DataGrowthAdmissionRejected as exc:
        return ("rejected", exc.status_code, exc.reason)
    finally:
        worker_engine.dispose()
    return ("admitted", None, None)


def _source_ingest_process_attempt(
    args: tuple[str, str, int],
) -> tuple[str, int | None, str | None]:
    raw_url, source_key, index = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    try:
        with Session(worker_engine) as session:
            result = ingest_source_record(
                session,
                source_key=source_key,
                external_record_id=f"concurrent-{index}",
                source_version_or_content_digest="version-1",
            )
    except DataGrowthAdmissionRejected as exc:
        return ("rejected", exc.status_code, exc.reason)
    finally:
        worker_engine.dispose()
    return ("created" if result.created else "duplicate", None, None)


def _source_moderation_process_attempt(
    args: tuple[str, str, int],
) -> tuple[str, int | None, str | None]:
    raw_url, source_record_id, index = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    try:
        with Session(worker_engine) as session:
            result = moderate_source_record(
                session,
                source_record_id=source_record_id,
                target_status="validated" if index % 2 == 0 else "rejected",
                expected_version=1,
                idempotency_key=f"concurrent-moderation-{index}",
                moderator_reference="moderator-ci",
                authorization_scope=SOURCE_MODERATION_SCOPE,
                reason_code="synthetic-quality-reviewed",
            )
    except SourceModerationRejected as exc:
        return ("rejected", exc.status_code, exc.reason)
    finally:
        worker_engine.dispose()
    return ("moderated" if result.created else "duplicate", None, None)


def _source_assertion_ingest_process_attempt(
    args: tuple[str, str, str, int],
) -> tuple[str, int | None, str | None]:
    raw_url, food_product_id, source_record_id, index = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    try:
        with Session(worker_engine) as session:
            result = ingest_source_assertion(
                session,
                food_product_id=food_product_id,
                source_record_id=source_record_id,
                expected_source_record_version=2,
                idempotency_key=f"concurrent-assertion-{index}",
                submitter_reference="adapter-synthetic-ci",
                authorization_scope=SOURCE_ASSERTION_INGEST_SCOPE,
                attribute_key="nutrition.energy",
                value="100",
                unit_or_value_type="kcal-per-100g",
                observed_or_effective_at=ASSERTION_OBSERVED_AT,
            )
    except SourceAssertionIngestRejected as exc:
        return ("rejected", exc.status_code, exc.reason)
    finally:
        worker_engine.dispose()
    return ("created" if result.created else "duplicate", None, None)


def _source_assertion_moderation_process_attempt(
    args: tuple[str, str, int],
) -> tuple[str, int | None, str | None]:
    raw_url, assertion_id, index = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    try:
        with Session(worker_engine) as session:
            result = moderate_source_assertion(
                session,
                assertion_id=assertion_id,
                target_status="validated" if index % 2 == 0 else "rejected",
                expected_version=1,
                idempotency_key=f"concurrent-assertion-moderation-{index}",
                moderator_reference="moderator-ci",
                authorization_scope=SOURCE_ASSERTION_MODERATION_SCOPE,
                reason_code="synthetic-quality-reviewed",
            )
    except SourceAssertionModerationRejected as exc:
        return ("rejected", exc.status_code, exc.reason)
    finally:
        worker_engine.dispose()
    return ("moderated" if result.created else "duplicate", None, None)


def _source_assertion_correction_process_attempt(
    args: tuple[str, str, int],
) -> tuple[str, int | None, str | None]:
    raw_url, predecessor_assertion_id, index = args
    worker_engine = create_engine(raw_url, pool_pre_ping=True)
    try:
        with Session(worker_engine) as session:
            result = correct_source_assertion(
                session,
                predecessor_assertion_id=predecessor_assertion_id,
                expected_predecessor_version=2,
                idempotency_key=f"concurrent-assertion-correction-{index}",
                corrector_reference="corrector-ci",
                authorization_scope=SOURCE_ASSERTION_CORRECTION_SCOPE,
                reason_code="synthetic-evidence-corrected",
                attribute_key="nutrition.energy",
                value=str(105 + index),
                unit_or_value_type="kcal-per-100g",
                observed_or_effective_at=ASSERTION_OBSERVED_AT
                + timedelta(minutes=index + 1),
            )
    except SourceAssertionCorrectionRejected as exc:
        return ("rejected", exc.status_code, exc.reason)
    finally:
        worker_engine.dispose()
    return ("corrected" if result.created else "duplicate", None, None)


def _required_postgresql_test_url() -> str:
    raw_url = os.getenv(POSTGRES_TEST_URL_ENV, "").strip()
    if not raw_url:
        pytest.skip(f"{POSTGRES_TEST_URL_ENV} is not configured")

    parsed = make_url(raw_url)
    if parsed.get_backend_name() != "postgresql":
        pytest.fail(f"{POSTGRES_TEST_URL_ENV} must use PostgreSQL")
    if parsed.host not in {"127.0.0.1", "localhost", "::1"}:
        pytest.fail(f"{POSTGRES_TEST_URL_ENV} must target a loopback-only test server")
    if parsed.database != "calorieapp_ci_test":
        pytest.fail(f"{POSTGRES_TEST_URL_ENV} must target calorieapp_ci_test")
    return raw_url


def _reset_synthetic_database(engine: Engine) -> None:
    """Reset only the hard-coded loopback CI database guarded above."""
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP SCHEMA IF EXISTS public CASCADE")
        connection.exec_driver_sql("CREATE SCHEMA public")


def _execute_as_role(
    engine: Engine,
    role_name: str,
    statement: str,
    parameters: tuple[object, ...] = (),
) -> None:
    quoted_role = engine.dialect.identifier_preparer.quote_identifier(role_name)
    with engine.begin() as connection:
        connection.exec_driver_sql(f"SET LOCAL ROLE {quoted_role}")
        connection.exec_driver_sql(statement, parameters)


def _assert_application_role_rejected(
    engine: Engine,
    role_name: str,
    statement: str,
    parameters: tuple[object, ...] = (),
) -> None:
    with pytest.raises(SQLAlchemyError) as rejected:
        _execute_as_role(engine, role_name, statement, parameters)
    assert getattr(rejected.value.orig, "sqlstate", None) == "42501"


def _drop_synthetic_application_role(engine: Engine, role_name: str) -> None:
    """Revoke this proof's grants before dropping its synthetic runtime role."""
    quoted_role = engine.dialect.identifier_preparer.quote_identifier(role_name)
    quoted_public = engine.dialect.identifier_preparer.quote_identifier("public")
    with engine.begin() as connection:
        database_name = connection.exec_driver_sql(
            "SELECT current_database()"
        ).scalar_one()
        quoted_database = engine.dialect.identifier_preparer.quote_identifier(
            database_name
        )
        connection.exec_driver_sql(
            f"REVOKE ALL PRIVILEGES ON DATABASE {quoted_database} FROM {quoted_role}"
        )
        connection.exec_driver_sql(
            f"REVOKE ALL PRIVILEGES ON SCHEMA {quoted_public} FROM {quoted_role}"
        )
        connection.exec_driver_sql(
            f"REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "
            f"{quoted_public} FROM {quoted_role}"
        )
        connection.exec_driver_sql(
            f"REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "
            f"{quoted_public} FROM {quoted_role}"
        )
        connection.exec_driver_sql(f"DROP ROLE IF EXISTS {quoted_role}")


@pytest.fixture()
def postgres_engine() -> Engine:
    raw_url = _required_postgresql_test_url()
    engine = create_engine(raw_url, pool_pre_ping=True)
    _reset_synthetic_database(engine)
    try:
        yield engine
    finally:
        engine.dispose()
        cleanup_engine = create_engine(raw_url, pool_pre_ping=True)
        try:
            _reset_synthetic_database(cleanup_engine)
        finally:
            cleanup_engine.dispose()


def _create_user_session(engine: Engine, subject: str) -> tuple[str, str]:
    now = utc_now()
    token = token_urlsafe(48)
    user = CalorieAppUserDB(status="active")
    with Session(engine) as session:
        session.add(user)
        session.flush()
        session.add(
            ExternalIdentityDB(
                calorieapp_user_id=user.id,
                provider="synthetic_ci",
                external_subject=subject,
                created_at=now,
                last_verified_at=now,
            )
        )
        session.add(
            AuthSessionDB(
                session_token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
                calorieapp_user_id=user.id,
                created_at=now,
                last_seen_at=now,
                expires_at=now + timedelta(hours=8),
            )
        )
        session.commit()
        return user.id, token


def _client(engine: Engine, token: str) -> TestClient:
    db_module.engine = engine
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, token)
    return client


def test_postgresql_empty_database_migrates_and_is_ready(
    postgres_engine: Engine,
) -> None:
    assert (
        upgrade_database(
            postgres_engine,
            approval_reference="CI-POSTGRES-EMPTY-DATABASE",
        )
        == SCHEMA_HEAD
    )
    assert current_revision(postgres_engine) == SCHEMA_HEAD
    assert db_module.database_readiness(postgres_engine) == {
        "status": "ready",
        "database_revision": SCHEMA_HEAD,
    }
    assert "food_log" in inspect(postgres_engine).get_table_names()
    assert "account_data_import_receipt" in inspect(
        postgres_engine
    ).get_table_names()
    assert "food_source" in inspect(postgres_engine).get_table_names()
    assert "food_source_record" in inspect(postgres_engine).get_table_names()
    assert "food_source_moderation_audit" in inspect(
        postgres_engine
    ).get_table_names()
    assert "food_product" in inspect(postgres_engine).get_table_names()
    assert "food_product_source_link" in inspect(postgres_engine).get_table_names()
    assert "food_attribute_assertion" in inspect(postgres_engine).get_table_names()
    assert "food_attribute_assertion_ingest_audit" in inspect(
        postgres_engine
    ).get_table_names()
    assert "food_attribute_assertion_moderation_audit" in inspect(
        postgres_engine
    ).get_table_names()
    assert "food_attribute_assertion_correction_audit" in inspect(
        postgres_engine
    ).get_table_names()


    assert "provider_rate_event" in inspect(postgres_engine).get_table_names()
    assert "route_rate_event" in inspect(postgres_engine).get_table_names()
    food_log_indexes = {
        index["name"]: tuple(index["column_names"])
        for index in inspect(postgres_engine).get_indexes("food_log")
    }
    assert food_log_indexes["ix_food_log_owner_id"] == ("owner_id",)
    source_record_columns = {
        column["name"]
        for column in inspect(postgres_engine).get_columns("food_source_record")
    }
    assert "verification_version" in source_record_columns
    source_columns = {
        column["name"]
        for column in inspect(postgres_engine).get_columns("food_source")
    }
    assert "assertion_limit" in source_columns
    pending_columns = {
        column["name"]
        for column in inspect(postgres_engine).get_columns("pendingloginstate")
    }
    pending_indexes = {
        index["name"]: tuple(index["column_names"])
        for index in inspect(postgres_engine).get_indexes("pendingloginstate")
    }
    assert "client_id" in pending_columns
    assert pending_indexes["ix_pendingloginstate_client_created"] == (
        "client_id",
        "created_at",
    )
    assert pending_indexes["ix_pendingloginstate_client_expires"] == (
        "client_id",
        "expires_at",
    )


def test_postgresql_import_receipt_constraint_accepts_v1_and_v2_only(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-RECEIPT-VERSION-CONSTRAINT",
    )
    target_user_id = f"synthetic-receipt-version-{uuid4().hex}"
    with Session(postgres_engine) as session:
        session.add(CalorieAppUserDB(id=target_user_id, status="active"))
        session.commit()
        session.add_all(
            [
                AccountDataImportReceiptDB(
                    target_account_id=target_user_id,
                    private_import_digest="1" * 64,
                    plan_version="calorieapp-account-data-import-plan-v1",
                    export_version="calorieapp-account-data-v1",
                    food_log_count=0,
                ),
                AccountDataImportReceiptDB(
                    target_account_id=target_user_id,
                    private_import_digest="2" * 64,
                    plan_version="calorieapp-account-data-import-plan-v1",
                    export_version="calorieapp-account-data-v2",
                    food_log_count=0,
                ),
            ]
        )
        session.commit()

        session.add(
            AccountDataImportReceiptDB(
                target_account_id=target_user_id,
                private_import_digest="3" * 64,
                plan_version="calorieapp-account-data-import-plan-v1",
                export_version="calorieapp-account-data-v3",
                food_log_count=0,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


def test_postgresql_account_import_is_atomic_private_and_replay_safe(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-ACCOUNT-IMPORT-TRANSACTION",
    )
    target_user_id = "synthetic-postgresql-import-target"
    with Session(postgres_engine) as session:
        session.add(CalorieAppUserDB(id=target_user_id, status="active"))
        session.commit()

    plan = AccountDataImportPlan(
        plan_version="calorieapp-account-data-import-plan-v1",
        export_version="calorieapp-account-data-v1",
        private_import_digest="a" * 64,
        source_account_id="synthetic-postgresql-import-source",
        target_account_id=target_user_id,
        exported_at=datetime(2026, 9, 2, 12),
        food_logs=(
            PlannedFoodLogImport(
                source_record_id=41,
                target_owner_id=target_user_id,
                product_name="Synthetic imported apple",
                calories=52,
                protein=0.3,
                fat=0.2,
                carbohydrates=14,
                portion_percentage=100,
                barcode="synthetic-import-barcode",
                image_url=None,
                brand="Synthetic orchard",
                serving_size="100 g",
                nutri_score="A",
                created_at=datetime(2026, 8, 31, 10, 30),
            ),
        ),
        ignored_collection_counts=(),
    )

    with Session(postgres_engine) as session:
        staged = execute_account_data_import_transaction(
            session,
            plan,
            authenticated_target_account_id=target_user_id,
            confirmed_target_account_id=target_user_id,
            environment="test",
            execute=True,
            approval_reference="synthetic-postgresql-import-rollback-proof",
        )
        assert staged.action == "staged_insert"
        assert staged.staged_food_log_rows == 1
        assert staged.staged_receipt_rows == 1
        assert len(session.exec(select(FoodLogDB)).all()) == 1
        assert len(session.exec(select(AccountDataImportReceiptDB)).all()) == 1
        with Session(postgres_engine) as contender:
            with pytest.raises(DataGrowthAdmissionRejected) as locked:
                create_food_log_with_subject_budget(
                    contender,
                    FoodLogDB(
                        product_name="Concurrent synthetic food log",
                        calories=1,
                        owner_id=target_user_id,
                    ),
                )
            assert locked.value.status_code == 503
            assert locked.value.reason == "data_growth_admission_unavailable"
        session.rollback()

    with Session(postgres_engine) as session:
        assert session.exec(select(FoodLogDB)).all() == []
        assert session.exec(select(AccountDataImportReceiptDB)).all() == []
        created = execute_account_data_import_transaction(
            session,
            plan,
            authenticated_target_account_id=target_user_id,
            confirmed_target_account_id=target_user_id,
            environment="test",
            execute=True,
            approval_reference="synthetic-postgresql-import-commit-proof",
        )
        assert created.action == "staged_insert"
        session.commit()

    with Session(postgres_engine) as session:
        replay = execute_account_data_import_transaction(
            session,
            plan,
            authenticated_target_account_id=target_user_id,
            confirmed_target_account_id=target_user_id,
            environment="test",
            execute=True,
            approval_reference="synthetic-postgresql-import-replay-proof",
        )
        assert replay.action == "idempotent_noop"
        assert len(session.exec(select(FoodLogDB)).all()) == 1
        assert len(session.exec(select(AccountDataImportReceiptDB)).all()) == 1
        session.rollback()


def test_postgresql_application_role_is_row_only_and_audits_are_insert_only(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-APPLICATION-ROLE",
    )
    role_name = f"calorieapp_ci_runtime_{uuid4().hex[:12]}"
    quoted_role = postgres_engine.dialect.identifier_preparer.quote_identifier(
        role_name
    )
    with postgres_engine.begin() as connection:
        connection.exec_driver_sql(
            f"CREATE ROLE {quoted_role} NOLOGIN NOSUPERUSER NOCREATEDB "
            "NOCREATEROLE NOREPLICATION NOBYPASSRLS"
        )

    try:
        source = FoodSourceDB(
            source_key=f"privilege-proof-{uuid4().hex}",
            source_category="synthetic-ci",
            operator_name="Synthetic CI Source",
            status="enabled",
            licence_id="synthetic-test-only",
            terms_reference="https://example.test/terms",
            attribution_text="Synthetic CI data",
            record_limit=2,
        )
        record = FoodSourceRecordDB(
            source_id=source.id,
            external_record_id="privilege-proof-record",
            source_version_or_content_digest="version-1",
        )
        record_id = record.id
        with Session(postgres_engine) as session:
            session.add(source)
            session.commit()
            session.add(record)
            session.commit()
            receipt_target = CalorieAppUserDB(
                id="synthetic-privilege-import-target",
                status="active",
            )
            session.add(receipt_target)
            session.commit()

        with postgres_engine.begin() as connection:
            proof = apply_postgresql_application_privileges(
                connection,
                role_name,
                approval_reference="CI-POSTGRES-APPLICATION-ROLE",
            )
        assert proof.application_role == role_name
        assert proof.insert_only_audit_table_count == len(APPLICATION_AUDIT_TABLES)
        assert proof.append_delete_table_count == len(
            APPLICATION_APPEND_DELETE_TABLES
        )
        assert proof.read_only_table_count == 1
        assert proof.sequence_count >= 1

        audit_id = str(uuid4())
        with postgres_engine.begin() as connection:
            connection.exec_driver_sql(f"SET LOCAL ROLE {quoted_role}")
            connection.exec_driver_sql(
                """
                UPDATE food_source_record
                SET verification_status = 'validated', verification_version = 2
                WHERE id = %s
                """,
                (record_id,),
            )
            connection.exec_driver_sql(
                """
                INSERT INTO food_source_moderation_audit (
                    id, source_record_id, idempotency_key, expected_version,
                    resulting_version, previous_status, new_status,
                    moderator_reference, authorization_scope, reason_code,
                    created_at
                ) VALUES (%s, %s, %s, 1, 2, 'quarantined', 'validated',
                          'synthetic-ci', 'catalog:source-record:moderate',
                          'synthetic-reviewed', %s)
                """,
                (
                    audit_id,
                    record_id,
                    f"privilege-proof-{uuid4().hex}",
                    utc_now(),
                ),
            )
        _execute_as_role(
            postgres_engine,
            role_name,
            """
            INSERT INTO food_log (
                product_name, calories, protein, fat, carbohydrates, created_at
            ) VALUES ('Synthetic privilege proof', 1, 0, 0, 0, %s)
            """,
            (utc_now(),),
        )
        receipt_id = str(uuid4())
        _execute_as_role(
            postgres_engine,
            role_name,
            """
            INSERT INTO account_data_import_receipt (
                id, target_account_id, private_import_digest, plan_version,
                export_version, food_log_count, created_at
            ) VALUES (%s, 'synthetic-privilege-import-target', %s,
                      'calorieapp-account-data-import-plan-v1',
                      'calorieapp-account-data-v1', 0, %s)
            """,
            (receipt_id, "b" * 64, utc_now()),
        )

        _assert_application_role_rejected(
            postgres_engine,
            role_name,
            "UPDATE food_source_moderation_audit SET reason_code = 'rewritten' "
            "WHERE id = %s",
            (audit_id,),
        )
        _assert_application_role_rejected(
            postgres_engine,
            role_name,
            "UPDATE account_data_import_receipt SET food_log_count = 1 "
            "WHERE id = %s",
            (receipt_id,),
        )
        _execute_as_role(
            postgres_engine,
            role_name,
            "DELETE FROM account_data_import_receipt WHERE id = %s",
            (receipt_id,),
        )
        _assert_application_role_rejected(
            postgres_engine,
            role_name,
            "DELETE FROM food_source_moderation_audit WHERE id = %s",
            (audit_id,),
        )
        _assert_application_role_rejected(
            postgres_engine,
            role_name,
            "TRUNCATE TABLE food_source_moderation_audit",
        )
        _assert_application_role_rejected(
            postgres_engine,
            role_name,
            "UPDATE calorie_schema_revision SET approval_reference = 'rewritten'",
        )
        _assert_application_role_rejected(
            postgres_engine,
            role_name,
            "CREATE TABLE public.privilege_escape (id INTEGER)",
        )
        _assert_application_role_rejected(
            postgres_engine,
            role_name,
            "CREATE TEMPORARY TABLE privilege_escape_temp (id INTEGER)",
        )

        with postgres_engine.connect() as connection:
            checked = verify_postgresql_application_privileges(
                connection,
                role_name,
            )
            stored_reason = connection.exec_driver_sql(
                "SELECT reason_code FROM food_source_moderation_audit WHERE id = %s",
                (audit_id,),
            ).scalar_one()
        assert checked == proof
        assert stored_reason == "synthetic-reviewed"
    finally:
        _drop_synthetic_application_role(postgres_engine, role_name)


def test_postgresql_transaction_advisory_lock_wait_is_bounded(
    postgres_engine: Engine,
) -> None:
    lock_key = 6_104_202_608_31
    with postgres_engine.connect() as holder, postgres_engine.connect() as contender:
        holder_transaction = holder.begin()
        contender_transaction = contender.begin()
        try:
            holder.exec_driver_sql(
                "SELECT pg_advisory_xact_lock(%s)",
                (lock_key,),
            )
            started = time.monotonic()
            with pytest.raises(SQLAlchemyError) as rejected:
                acquire_bounded_transaction_advisory_locks(
                    contender,
                    [lock_key],
                )
            elapsed = time.monotonic() - started
        finally:
            contender_transaction.rollback()
            holder_transaction.rollback()

    assert getattr(rejected.value.orig, "sqlstate", None) == "55P03"
    assert elapsed < max(
        5.0,
        POSTGRESQL_ADVISORY_LOCK_TIMEOUT_MILLISECONDS / 1000 * 5,
    )


def test_postgresql_shared_rate_window_is_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SHARED-RATE-GOVERNOR",
    )
    raw_url = _required_postgresql_test_url()
    provider_key = f"synthetic_ci_{uuid4().hex}"
    arguments = [(raw_url, provider_key, 8)] * 12

    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=4, mp_context=context) as executor:
        results = list(executor.map(_shared_rate_governor_process_attempt, arguments))

    assert [result[0] for result in results].count("admitted") == 8
    rejected = [result for result in results if result[0] == "rejected"]
    assert len(rejected) == 4
    assert all(status_code == 429 for _, status_code, _ in rejected)
    assert all(1 <= retry_after <= 60 for _, _, retry_after in rejected)

    with postgres_engine.connect() as connection:
        count = connection.exec_driver_sql(
            "SELECT COUNT(*) FROM provider_rate_event WHERE provider_key = %s",
            (provider_key,),
        ).scalar_one()
    assert count == 8


def test_postgresql_missing_governor_table_fails_closed(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SHARED-RATE-FAIL-CLOSED",
    )
    with postgres_engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE provider_rate_event")

    governor = PostgreSQLSlidingWindowRateGovernor(
        postgres_engine,
        provider_key=f"synthetic_ci_{uuid4().hex}",
        limit=8,
        window_seconds=60,
    )
    with pytest.raises(AdapterAdmissionRejected) as rejected:
        asyncio.run(governor.acquire())
    assert rejected.value.reason == "shared_rate_governor_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5


def test_postgresql_shared_route_window_is_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SHARED-ROUTE-LIMITER",
    )
    raw_url = _required_postgresql_test_url()
    route_key = f"synthetic_route_{uuid4().hex}"
    arguments = [(raw_url, route_key, 8)] * 12

    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=4, mp_context=context) as executor:
        results = list(executor.map(_shared_route_limiter_process_attempt, arguments))

    assert [result[0] for result in results].count("admitted") == 8
    rejected = [result for result in results if result[0] == "rejected"]
    assert len(rejected) == 4
    assert all(status_code == 429 for _, status_code, _ in rejected)
    assert all(1 <= retry_after <= 60 for _, _, retry_after in rejected)

    with postgres_engine.connect() as connection:
        count = connection.exec_driver_sql(
            "SELECT COUNT(*) FROM route_rate_event WHERE route_key = %s",
            (route_key,),
        ).scalar_one()
    assert count == 8


def test_postgresql_missing_route_rate_table_fails_closed(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SHARED-ROUTE-FAIL-CLOSED",
    )
    with postgres_engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE route_rate_event")

    limiter = PostgreSQLRouteRateLimiter(postgres_engine)
    with pytest.raises(RouteRateLimitRejected) as rejected:
        asyncio.run(
            limiter.acquire(RouteRatePolicy(f"synthetic_route_{uuid4().hex}", 8))
        )
    assert rejected.value.reason == "shared_route_limiter_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5


def test_postgresql_food_log_subject_budget_is_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-FOOD-LOG-GROWTH",
    )
    raw_url = _required_postgresql_test_url()
    with Session(postgres_engine) as session:
        user = CalorieAppUserDB(status="active")
        session.add(user)
        session.commit()
        owner_id = user.id

    arguments = [(raw_url, owner_id, 8, index) for index in range(12)]
    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=4, mp_context=context) as executor:
        results = list(executor.map(_food_log_growth_process_attempt, arguments))

    assert [result[0] for result in results].count("admitted") == 8
    rejected = [result for result in results if result[0] == "rejected"]
    assert len(rejected) == 4
    assert {result[1] for result in rejected} == {409}
    assert {result[2] for result in rejected} == {
        "food_log_subject_budget_reached"
    }

    with Session(postgres_engine) as session:
        entries = session.exec(
            select(FoodLogDB).where(FoodLogDB.owner_id == owner_id)
        ).all()
    assert len(entries) == 8


def test_postgresql_source_ingest_budget_is_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SOURCE-INGEST-GROWTH",
    )
    raw_url = _required_postgresql_test_url()
    source_key = f"synthetic-{uuid4().hex}"
    with Session(postgres_engine) as session:
        session.add(
            FoodSourceDB(
                source_key=source_key,
                source_category="open-dataset",
                operator_name="Synthetic CI Source",
                status="enabled",
                licence_id="synthetic-test-only",
                terms_reference="https://example.test/terms",
                attribution_text="Synthetic CI data",
                record_limit=8,
            )
        )
        session.commit()

    arguments = [(raw_url, source_key, index) for index in range(12)]
    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=4, mp_context=context) as executor:
        results = list(executor.map(_source_ingest_process_attempt, arguments))

    assert [result[0] for result in results].count("created") == 8
    rejected = [result for result in results if result[0] == "rejected"]
    assert len(rejected) == 4
    assert {result[1] for result in rejected} == {409}
    assert {result[2] for result in rejected} == {"source_record_budget_reached"}

    admitted_index = next(
        index for index, result in enumerate(results) if result[0] == "created"
    )
    with Session(postgres_engine) as session:
        duplicate = ingest_source_record(
            session,
            source_key=source_key,
            external_record_id=f"concurrent-{admitted_index}",
            source_version_or_content_digest="version-1",
        )
        records = session.exec(select(FoodSourceRecordDB)).all()
    assert duplicate.created is False
    assert len(records) == 8
    assert {record.verification_status for record in records} == {"quarantined"}


def test_postgresql_source_moderation_is_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SOURCE-MODERATION",
    )
    raw_url = _required_postgresql_test_url()
    source_key = f"moderation-{uuid4().hex}"
    with Session(postgres_engine) as session:
        session.add(
            FoodSourceDB(
                source_key=source_key,
                source_category="open-dataset",
                operator_name="Synthetic CI Source",
                status="enabled",
                licence_id="synthetic-test-only",
                terms_reference="https://example.test/terms",
                attribution_text="Synthetic CI data",
                record_limit=2,
            )
        )
        session.commit()
        record_id = ingest_source_record(
            session,
            source_key=source_key,
            external_record_id="moderated-record",
            source_version_or_content_digest="version-1",
        ).record.id

    decision_count = 12
    worker_count = 4
    arguments = [
        (raw_url, record_id, index) for index in range(decision_count)
    ]
    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(
        max_workers=worker_count,
        mp_context=context,
    ) as executor:
        results = list(executor.map(_source_moderation_process_attempt, arguments))

    assert [result[0] for result in results].count("moderated") == 1
    rejected = [result for result in results if result[0] == "rejected"]
    assert len(rejected) == decision_count - 1
    assert {result[1] for result in rejected} == {409}
    assert {result[2] for result in rejected} == {
        "source_record_version_conflict"
    }

    admitted_index = next(
        index for index, result in enumerate(results) if result[0] == "moderated"
    )
    expected_status = "validated" if admitted_index % 2 == 0 else "rejected"
    with Session(postgres_engine) as session:
        duplicate = moderate_source_record(
            session,
            source_record_id=record_id,
            target_status=expected_status,
            expected_version=1,
            idempotency_key=f"concurrent-moderation-{admitted_index}",
            moderator_reference="moderator-ci",
            authorization_scope=SOURCE_MODERATION_SCOPE,
            reason_code="synthetic-quality-reviewed",
        )
        record = session.get(FoodSourceRecordDB, record_id)
        audits = session.exec(select(FoodSourceModerationAuditDB)).all()
    assert duplicate.created is False
    assert record is not None
    assert record.verification_status == expected_status
    assert record.verification_version == 2
    assert len(audits) == 1


def test_postgresql_source_assertion_budget_is_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SOURCE-ASSERTION-INGEST",
    )
    raw_url = _required_postgresql_test_url()
    source_key = f"assertions-{uuid4().hex}"
    source = FoodSourceDB(
        source_key=source_key,
        source_category="open-dataset",
        operator_name="Synthetic CI Assertion Source",
        status="enabled",
        licence_id="synthetic-test-only",
        terms_reference="https://example.test/terms",
        attribution_text="Synthetic CI data",
        record_limit=12,
        assertion_limit=8,
    )
    product = FoodProductDB(status="active")
    records = [
        FoodSourceRecordDB(
            source_id=source.id,
            external_record_id=f"assertion-record-{index}",
            source_version_or_content_digest="version-1",
            verification_status="validated",
            verification_version=2,
        )
        for index in range(12)
    ]
    with Session(postgres_engine) as session:
        session.add_all([source, product])
        session.commit()
        session.add_all(records)
        session.commit()
        session.add_all(
            [
                FoodProductSourceLinkDB(
                    food_product_id=product.id,
                    source_record_id=record.id,
                    match_method="synthetic-reviewed-match",
                    match_confidence=1,
                    review_status="validated",
                )
                for record in records
            ]
        )
        session.commit()
        product_id = product.id
        record_ids = [record.id for record in records]

    arguments = [
        (raw_url, product_id, record_id, index)
        for index, record_id in enumerate(record_ids)
    ]
    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=4, mp_context=context) as executor:
        results = list(
            executor.map(_source_assertion_ingest_process_attempt, arguments)
        )

    assert [result[0] for result in results].count("created") == 8
    rejected = [result for result in results if result[0] == "rejected"]
    assert len(rejected) == 4
    assert {result[1] for result in rejected} == {409}
    assert {result[2] for result in rejected} == {
        "source_assertion_budget_reached"
    }

    admitted_index = next(
        index for index, result in enumerate(results) if result[0] == "created"
    )
    with Session(postgres_engine) as session:
        duplicate = ingest_source_assertion(
            session,
            food_product_id=product_id,
            source_record_id=record_ids[admitted_index],
            expected_source_record_version=2,
            idempotency_key=f"concurrent-assertion-{admitted_index}",
            submitter_reference="adapter-synthetic-ci",
            authorization_scope=SOURCE_ASSERTION_INGEST_SCOPE,
            attribute_key="nutrition.energy",
            value="100",
            unit_or_value_type="kcal-per-100g",
            observed_or_effective_at=ASSERTION_OBSERVED_AT,
        )
        assertions = session.exec(
            select(FoodAttributeAssertionDB).where(
                FoodAttributeAssertionDB.food_product_id == product_id
            )
        ).all()
        audits = session.exec(
            select(FoodAttributeAssertionIngestAuditDB).where(
                FoodAttributeAssertionIngestAuditDB.food_product_id == product_id
            )
        ).all()
    assert duplicate.created is False
    assert len(assertions) == 8
    assert len(audits) == 8
    assert {assertion.verification_status for assertion in assertions} == {
        "quarantined"
    }
    assert {assertion.verification_version for assertion in assertions} == {1}


def test_postgresql_source_assertion_moderation_is_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SOURCE-ASSERTION-MODERATION",
    )
    raw_url = _required_postgresql_test_url()
    source = FoodSourceDB(
        source_key=f"assertion-moderation-{uuid4().hex}",
        source_category="open-dataset",
        operator_name="Synthetic CI Assertion Moderation Source",
        status="enabled",
        licence_id="synthetic-test-only",
        terms_reference="https://example.test/terms",
        attribution_text="Synthetic CI data",
        record_limit=2,
        assertion_limit=2,
    )
    product = FoodProductDB(status="active")
    record = FoodSourceRecordDB(
        source_id=source.id,
        external_record_id="moderated-assertion-record",
        source_version_or_content_digest="version-1",
        verification_status="validated",
        verification_version=2,
    )
    with Session(postgres_engine) as session:
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
        assertion_id = ingest_source_assertion(
            session,
            food_product_id=product.id,
            source_record_id=record.id,
            expected_source_record_version=2,
            idempotency_key="assertion-moderation-ingest",
            submitter_reference="adapter-synthetic-ci",
            authorization_scope=SOURCE_ASSERTION_INGEST_SCOPE,
            attribute_key="nutrition.energy",
            value="100",
            unit_or_value_type="kcal-per-100g",
            observed_or_effective_at=ASSERTION_OBSERVED_AT,
        ).assertion.id

    decision_count = 12
    arguments = [
        (raw_url, assertion_id, index) for index in range(decision_count)
    ]
    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=4, mp_context=context) as executor:
        results = list(
            executor.map(_source_assertion_moderation_process_attempt, arguments)
        )

    assert [result[0] for result in results].count("moderated") == 1
    rejected = [result for result in results if result[0] == "rejected"]
    assert len(rejected) == decision_count - 1
    assert {result[1] for result in rejected} == {409}
    assert {result[2] for result in rejected} == {
        "source_assertion_version_conflict"
    }

    admitted_index = next(
        index for index, result in enumerate(results) if result[0] == "moderated"
    )
    expected_status = "validated" if admitted_index % 2 == 0 else "rejected"
    with Session(postgres_engine) as session:
        duplicate = moderate_source_assertion(
            session,
            assertion_id=assertion_id,
            target_status=expected_status,
            expected_version=1,
            idempotency_key=f"concurrent-assertion-moderation-{admitted_index}",
            moderator_reference="moderator-ci",
            authorization_scope=SOURCE_ASSERTION_MODERATION_SCOPE,
            reason_code="synthetic-quality-reviewed",
        )
        assertion = session.get(FoodAttributeAssertionDB, assertion_id)
        audits = session.exec(
            select(FoodAttributeAssertionModerationAuditDB)
        ).all()
    assert duplicate.created is False
    assert assertion is not None
    assert assertion.verification_status == expected_status
    assert assertion.verification_version == 2
    assert len(audits) == 1


def test_postgresql_source_assertion_correction_is_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-SOURCE-ASSERTION-CORRECTION",
    )
    raw_url = _required_postgresql_test_url()
    source = FoodSourceDB(
        source_key=f"assertion-correction-{uuid4().hex}",
        source_category="open-dataset",
        operator_name="Synthetic CI Assertion Correction Source",
        status="enabled",
        licence_id="synthetic-test-only",
        terms_reference="https://example.test/terms",
        attribution_text="Synthetic CI data",
        record_limit=2,
        assertion_limit=20,
    )
    product = FoodProductDB(status="active")
    product_id = product.id
    record = FoodSourceRecordDB(
        source_id=source.id,
        external_record_id="corrected-assertion-record",
        source_version_or_content_digest="version-1",
        verification_status="validated",
        verification_version=2,
    )
    with Session(postgres_engine) as session:
        session.add_all([source, product])
        session.commit()
        session.add(record)
        session.commit()
        session.add(
            FoodProductSourceLinkDB(
                food_product_id=product_id,
                source_record_id=record.id,
                match_method="synthetic-reviewed-match",
                match_confidence=1,
                review_status="validated",
            )
        )
        session.commit()
        predecessor_id = ingest_source_assertion(
            session,
            food_product_id=product_id,
            source_record_id=record.id,
            expected_source_record_version=2,
            idempotency_key="assertion-correction-ingest",
            submitter_reference="adapter-synthetic-ci",
            authorization_scope=SOURCE_ASSERTION_INGEST_SCOPE,
            attribute_key="nutrition.energy",
            value="100",
            unit_or_value_type="kcal-per-100g",
            observed_or_effective_at=ASSERTION_OBSERVED_AT,
        ).assertion.id
        moderate_source_assertion(
            session,
            assertion_id=predecessor_id,
            target_status="validated",
            expected_version=1,
            idempotency_key="assertion-correction-predecessor-moderation",
            moderator_reference="moderator-ci",
            authorization_scope=SOURCE_ASSERTION_MODERATION_SCOPE,
            reason_code="synthetic-quality-reviewed",
        )

    decision_count = 12
    arguments = [
        (raw_url, predecessor_id, index) for index in range(decision_count)
    ]
    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=4, mp_context=context) as executor:
        results = list(
            executor.map(_source_assertion_correction_process_attempt, arguments)
        )

    assert [result[0] for result in results].count("corrected") == 1
    rejected = [result for result in results if result[0] == "rejected"]
    assert len(rejected) == decision_count - 1
    assert {result[1] for result in rejected} == {409}
    assert {result[2] for result in rejected} == {
        "source_assertion_already_corrected"
    }

    admitted_index = next(
        index for index, result in enumerate(results) if result[0] == "corrected"
    )
    with Session(postgres_engine) as session:
        duplicate = correct_source_assertion(
            session,
            predecessor_assertion_id=predecessor_id,
            expected_predecessor_version=2,
            idempotency_key=f"concurrent-assertion-correction-{admitted_index}",
            corrector_reference="corrector-ci",
            authorization_scope=SOURCE_ASSERTION_CORRECTION_SCOPE,
            reason_code="synthetic-evidence-corrected",
            attribute_key="nutrition.energy",
            value=str(105 + admitted_index),
            unit_or_value_type="kcal-per-100g",
            observed_or_effective_at=ASSERTION_OBSERVED_AT
            + timedelta(minutes=admitted_index + 1),
        )
        predecessor = session.get(FoodAttributeAssertionDB, predecessor_id)
        assertions = session.exec(
            select(FoodAttributeAssertionDB).where(
                FoodAttributeAssertionDB.food_product_id == product_id
            )
        ).all()
        audits = session.exec(
            select(FoodAttributeAssertionCorrectionAuditDB)
        ).all()
    assert duplicate.created is False
    assert predecessor is not None
    assert predecessor.verification_status == "validated"
    assert predecessor.verification_version == 2
    assert len(assertions) == 2
    correction = next(item for item in assertions if item.id != predecessor_id)
    assert correction.verification_status == "quarantined"
    assert correction.verification_version == 1
    assert correction.supersedes_assertion_id == predecessor_id
    assert len(audits) == 1


def test_postgresql_identity_start_limits_are_atomic_across_processes(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-IDENTITY-START-ADMISSION",
    )
    raw_url = _required_postgresql_test_url()
    rate_client = f"synthetic_rate_{uuid4().hex}"
    outstanding_client = f"synthetic_outstanding_{uuid4().hex}"
    arguments = (
        [(raw_url, rate_client, 8, 50)] * 12
        + [(raw_url, outstanding_client, 50, 8)] * 12
    )

    context = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(max_workers=4, mp_context=context) as executor:
        results = list(executor.map(_identity_start_process_attempt, arguments))

    rate_results = results[:12]
    outstanding_results = results[12:]
    assert [result[0] for result in rate_results].count("admitted") == 8
    assert [result[0] for result in outstanding_results].count("admitted") == 8

    rate_rejections = [result for result in rate_results if result[0] == "rejected"]
    outstanding_rejections = [
        result for result in outstanding_results if result[0] == "rejected"
    ]
    assert len(rate_rejections) == 4
    assert len(outstanding_rejections) == 4
    assert all(result[1] == 429 for result in rate_rejections + outstanding_rejections)
    assert all(1 <= result[2] <= 60 for result in rate_rejections + outstanding_rejections)
    assert {result[3] for result in rate_rejections} == {"login_start_rate_limit"}
    assert {result[3] for result in outstanding_rejections} == {
        "outstanding_login_limit"
    }

    with Session(postgres_engine) as session:
        for client_id in (rate_client, outstanding_client):
            state_hashes = session.exec(
                select(PendingLoginStateDB.state_hash).where(
                    PendingLoginStateDB.client_id == client_id
                )
            ).all()
            assert len(state_hashes) == 8
            assert len(
                session.exec(
                    select(PendingLoginLocaleDB).where(
                        PendingLoginLocaleDB.state_hash.in_(state_hashes)
                    )
                ).all()
            ) == 8
            assert len(
                session.exec(
                    select(OriginLoginHandoffDB).where(
                        OriginLoginHandoffDB.state_hash.in_(state_hashes)
                    )
                ).all()
            ) == 8


def test_postgresql_missing_identity_state_table_fails_closed(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-IDENTITY-START-FAIL-CLOSED",
    )
    with postgres_engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE pendingloginstate")

    with Session(postgres_engine) as session:
        with pytest.raises(IdentityStartAdmissionRejected) as rejected:
            create_limited_login_transaction(
                session,
                client_id=f"synthetic_missing_{uuid4().hex}",
                state_lifetime_seconds=300,
            )
    assert rejected.value.reason == "login_admission_unavailable"
    assert rejected.value.status_code == 503
    assert rejected.value.retry_after_seconds == 5


def test_postgresql_capacity_signal_enforces_exact_configured_budget(
    postgres_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-CAPACITY-SIGNAL",
    )
    with Session(postgres_engine) as session:
        used_bytes = database_used_bytes(session)
        assert used_bytes > 0
        monkeypatch.setenv(
            "CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES",
            str(used_bytes),
        )
        snapshot = database_capacity_snapshot(session)
        probe = capacity_probe_from_session(
            session,
            {"CALORIEAPP_DATABASE_CAPACITY_LIMIT_BYTES": str(used_bytes)},
        )

    assert snapshot is not None
    assert snapshot.used_bytes >= used_bytes
    assert snapshot.onboarding_paused is True
    assert probe.exit_code == EXIT_PAUSE
    assert probe.payload["level"] == "pause"
    assert probe.payload["threshold_percent"] == 95
    assert "used_bytes" not in probe.payload
    assert "limit_bytes" not in probe.payload


def test_postgresql_legacy_food_log_is_preserved(
    postgres_engine: Engine,
) -> None:
    with postgres_engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE food_log (
                id INTEGER PRIMARY KEY,
                product_name VARCHAR(120) NOT NULL,
                calories DOUBLE PRECISION NOT NULL,
                protein DOUBLE PRECISION NOT NULL,
                fat DOUBLE PRECISION NOT NULL,
                carbohydrates DOUBLE PRECISION NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            INSERT INTO food_log
                (id, product_name, calories, protein, fat, carbohydrates, created_at)
            VALUES
                (1, 'Synthetic Legacy Record', 123, 4, 5, 6, '2026-01-01 00:00:00')
            """
        )

    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-LEGACY-DATABASE",
    )

    inspector = inspect(postgres_engine)
    actual_columns = {
        str(column["name"]) for column in inspector.get_columns("food_log")
    }
    expected_columns = {column.name for column in migration_food_log.columns}
    assert actual_columns == expected_columns

    with postgres_engine.connect() as connection:
        row = connection.exec_driver_sql(
            "SELECT id, product_name, owner_id FROM food_log WHERE id = 1"
        ).one()
    assert tuple(row) == (1, "Synthetic Legacy Record", None)
    assert any(
        foreign_key["constrained_columns"] == ["owner_id"]
        and foreign_key["referred_table"] == "calorieappuser"
        for foreign_key in inspector.get_foreign_keys("food_log")
    )


def test_postgresql_identity_history_survives_application_engine_restart(
    postgres_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw_url = _required_postgresql_test_url()
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-IDENTITY-PERSISTENCE",
    )
    user_a_id, token_a = _create_user_session(postgres_engine, "synthetic-user-a")
    user_b_id, token_b = _create_user_session(postgres_engine, "synthetic-user-b")

    original_engine = db_module.engine
    monkeypatch.setenv("CALORIEAPP_ENV", "staging")
    try:
        with _client(postgres_engine, token_a) as client_a:
            response_a = client_a.post(
                "/log-food",
                json={"product_name": "Synthetic Apple", "calories": 52},
            )
            assert response_a.status_code == 200
            log_a_id = response_a.json()["id"]

        with _client(postgres_engine, token_b) as client_b:
            response_b = client_b.post(
                "/log-food",
                json={"product_name": "Synthetic Oats", "calories": 389},
            )
            assert response_b.status_code == 200
            log_b_id = response_b.json()["id"]

        postgres_engine.dispose()
        restarted_engine = create_engine(raw_url, pool_pre_ping=True)
        try:
            with _client(restarted_engine, token_a) as restarted_a:
                assert restarted_a.get("/ready").json()["database_revision"] == SCHEMA_HEAD
                logs_a = restarted_a.get("/logs")
                assert logs_a.status_code == 200
                assert [item["product_name"] for item in logs_a.json()] == [
                    "Synthetic Apple"
                ]
                assert restarted_a.delete(f"/logs/{log_b_id}").status_code == 403

            with _client(restarted_engine, token_b) as restarted_b:
                logs_b = restarted_b.get("/logs")
                assert logs_b.status_code == 200
                assert [item["product_name"] for item in logs_b.json()] == [
                    "Synthetic Oats"
                ]
        finally:
            restarted_engine.dispose()

        verification_engine = create_engine(raw_url, pool_pre_ping=True)
        try:
            with Session(verification_engine) as session:
                persisted = session.exec(select(FoodLogDB).order_by(FoodLogDB.id)).all()
                assert [(entry.id, entry.owner_id) for entry in persisted] == [
                    (log_a_id, user_a_id),
                    (log_b_id, user_b_id),
                ]
        finally:
            verification_engine.dispose()
    finally:
        db_module.engine = original_engine


def test_postgresql_account_erasure_clears_cross_account_session_reference(
    postgres_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-ACCOUNT-ERASURE-REFERENCES",
    )
    other_user_id, _ = _create_user_session(
        postgres_engine,
        "synthetic-erasure-reference-owner",
    )
    target_user_id, target_token = _create_user_session(
        postgres_engine,
        "synthetic-erasure-target",
    )

    with Session(postgres_engine) as session:
        target_session = session.exec(
            select(AuthSessionDB).where(
                AuthSessionDB.calorieapp_user_id == target_user_id
            )
        ).one()
        other_session = session.exec(
            select(AuthSessionDB).where(
                AuthSessionDB.calorieapp_user_id == other_user_id
            )
        ).one()
        other_session.replaced_by_session_id = target_session.id
        session.add(other_session)
        session.commit()
        other_session_id = other_session.id

    original_engine = db_module.engine
    monkeypatch.setattr(main_module, "_ACCOUNT_ERASURE_ENABLED", True)
    try:
        with _client(postgres_engine, target_token) as client:
            response = client.request(
                "DELETE",
                "/api/identity/account",
                json={
                    "confirm_user_id": target_user_id,
                    "acknowledgement": "delete-my-calorieapp-account",
                },
            )
            assert response.status_code == 200

        with Session(postgres_engine) as session:
            assert session.get(CalorieAppUserDB, target_user_id) is None
            assert session.get(CalorieAppUserDB, other_user_id) is not None
            preserved_session = session.get(AuthSessionDB, other_session_id)
            assert preserved_session is not None
            assert preserved_session.replaced_by_session_id is None
    finally:
        db_module.engine = original_engine


def test_postgresql_inactive_account_preview_is_aggregate_and_read_only(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-INACTIVE-ACCOUNT-PREVIEW",
    )
    with Session(postgres_engine) as session:
        session.add_all(
            [
                CalorieAppUserDB(
                    id="synthetic-preview-due",
                    status="active",
                    last_authenticated_activity_at=datetime(2024, 1, 1),
                ),
                CalorieAppUserDB(
                    id="synthetic-preview-new",
                    status="active",
                    last_authenticated_activity_at=datetime(2026, 1, 1),
                ),
            ]
        )
        session.commit()

    with Session(postgres_engine) as session:
        payload = preview_inactive_accounts(
            session,
            as_of=datetime(2026, 9, 1, 12, 0, 0),
            batch_limit=10,
        ).as_payload()
        assert session.in_transaction() is False

    assert payload["evaluated_accounts"] == 2
    assert payload["retention_boundary_reached_accounts"] == 1
    assert payload["notice_window_accounts"] == 0
    assert "synthetic-preview-due" not in str(payload)

    with Session(postgres_engine) as session:
        assert session.get(CalorieAppUserDB, "synthetic-preview-due") is not None
        assert session.get(CalorieAppUserDB, "synthetic-preview-new") is not None


def test_postgresql_inactive_account_erasure_preflight_is_read_only(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-INACTIVE-ERASURE-PREFLIGHT",
    )
    user_id = "synthetic-erasure-preflight-user"
    notice_id = "synthetic-erasure-preflight-notice"
    with Session(postgres_engine) as session:
        session.add_all(
            [
                CalorieAppUserDB(
                    id=user_id,
                    status="active",
                    last_authenticated_activity_at=datetime(2024, 1, 1),
                ),
                InactiveAccountNoticeDB(
                    id=notice_id,
                    calorieapp_user_id=user_id,
                    activity_anchor_at=datetime(2024, 1, 1),
                    notice_window_started_at=datetime(2025, 12, 2),
                    retention_due_at=datetime(2026, 1, 1),
                    delivered_at=datetime(2025, 12, 5),
                    delivery_channel="synthetic-ci",
                    delivery_evidence_digest="a" * 64,
                    status="delivered",
                    recorded_at=datetime(2025, 12, 5, 0, 0, 1),
                ),
                FoodLogDB(
                    product_name="Synthetic private preflight food",
                    calories=1,
                    owner_id=user_id,
                ),
            ]
        )
        session.commit()

    with Session(postgres_engine) as session:
        plan = preflight_inactive_account_erasure(
            session,
            notice_id=notice_id,
            as_of=datetime(2026, 1, 2, tzinfo=UTC),
        )
        assert plan is not None
        assert plan.user_id == user_id
        assert plan.food_log_rows == 1
        assert plan.inactive_account_notice_rows == 1
        assert plan.total_delete_rows == 3
        session.rollback()

    with Session(postgres_engine) as session:
        assert session.get(CalorieAppUserDB, user_id) is not None
        assert session.get(InactiveAccountNoticeDB, notice_id) is not None
        assert session.exec(
            select(FoodLogDB).where(FoodLogDB.owner_id == user_id)
        ).one().product_name == "Synthetic private preflight food"


def test_postgresql_inactive_account_erasure_execution_stages_and_rolls_back(
    postgres_engine: Engine,
) -> None:
    upgrade_database(
        postgres_engine,
        approval_reference="CI-POSTGRES-INACTIVE-ERASURE-EXECUTION",
    )
    user_id = "synthetic-erasure-execution-user"
    notice_id = "synthetic-erasure-execution-notice"
    target_session_id = "synthetic-erasure-execution-target-session"
    inbound_session_id = "synthetic-erasure-execution-inbound-session"
    other_user_id = "synthetic-erasure-execution-other-user"
    with Session(postgres_engine) as session:
        target_user = CalorieAppUserDB(
            id=user_id,
            status="active",
            last_authenticated_activity_at=datetime(2024, 1, 1),
        )
        other_user = CalorieAppUserDB(id=other_user_id, status="active")
        target_session = AuthSessionDB(
            id=target_session_id,
            session_token_hash="d" * 64,
            calorieapp_user_id=user_id,
            created_at=datetime(2024, 1, 1),
            last_seen_at=datetime(2024, 1, 1),
            expires_at=datetime(2026, 1, 1),
        )
        session.add_all([target_user, other_user])
        session.flush()
        session.add(target_session)
        session.flush()
        session.add_all(
            [
                InactiveAccountNoticeDB(
                    id=notice_id,
                    calorieapp_user_id=user_id,
                    activity_anchor_at=datetime(2024, 1, 1),
                    notice_window_started_at=datetime(2025, 12, 2),
                    retention_due_at=datetime(2026, 1, 1),
                    delivered_at=datetime(2025, 12, 5),
                    delivery_channel="synthetic-ci",
                    delivery_evidence_digest="e" * 64,
                    status="delivered",
                    recorded_at=datetime(2025, 12, 5, 0, 0, 1),
                ),
                FoodLogDB(
                    product_name="Synthetic private execution food",
                    calories=1,
                    owner_id=user_id,
                ),
                AuthSessionDB(
                    id=inbound_session_id,
                    session_token_hash="f" * 64,
                    calorieapp_user_id=other_user_id,
                    created_at=datetime(2024, 1, 1),
                    last_seen_at=datetime(2024, 1, 1),
                    expires_at=datetime(2026, 1, 1),
                    replaced_by_session_id=target_session_id,
                ),
            ]
        )
        session.commit()

    with Session(postgres_engine) as session:
        result = execute_inactive_account_erasure(
            session,
            notice_id=notice_id,
            as_of=datetime(2026, 1, 2, tzinfo=UTC),
            environment="test",
            execute=True,
            approval_reference="synthetic-postgresql-rollback-proof",
        )
        assert result is not None
        assert result.food_log_rows_deleted == 1
        assert result.auth_session_rows_deleted == 1
        assert result.inactive_account_notice_rows_deleted == 1
        assert result.inbound_session_references_cleared == 1
        assert result.user_rows_deleted == 1
        assert result.total_delete_rows == 4
        assert session.get(CalorieAppUserDB, user_id) is None
        preserved = session.get(AuthSessionDB, inbound_session_id)
        assert preserved is not None
        assert preserved.replaced_by_session_id is None
        session.rollback()

    with Session(postgres_engine) as session:
        assert session.get(CalorieAppUserDB, user_id) is not None
        assert session.get(InactiveAccountNoticeDB, notice_id) is not None
        assert session.get(AuthSessionDB, target_session_id) is not None
        restored = session.get(AuthSessionDB, inbound_session_id)
        assert restored is not None
        assert restored.replaced_by_session_id == target_session_id
        assert session.exec(
            select(FoodLogDB).where(FoodLogDB.owner_id == user_id)
        ).one().product_name == "Synthetic private execution food"
