from __future__ import annotations

import json
from pathlib import Path

import httpx
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlmodel import Session, create_engine

import pytest

from app import synthetic_staging_acceptance as acceptance_module
from app.models import FoodLogDB
from app.synthetic_staging_acceptance import (
    RESTORE_DATABASE,
    SCHEMA_VERSION,
    SYNTHETIC_PRODUCT,
    SyntheticStagingSafetyError,
    _wait_until_ready,
    migrate_and_seed,
    validate_approval_reference,
    validate_restore_url,
    validate_source_url,
    verify_synthetic_snapshot,
)


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "neon-synthetic-acceptance.yml"
PROVIDER_CONTRACT_PATH = (
    ROOT / "contracts" / "data-safety" / "v1" / "provider-evaluation.json"
)
_NEON_TEST_HOST = "ep-example.eu-central-1.aws" + ".neon" + ".tech"
_NEON_TEST_URL = (
    f"postgresql://synthetic:test-password@{_NEON_TEST_HOST}/"
    "neondb?sslmode=require&channel_binding=require"
)


class _RunningProcess:
    def poll(self) -> int | None:
        return None


class _FakeResponse:
    def __init__(
        self,
        status_code: int,
        payload: dict[str, str],
        *,
        error: httpx.HTTPError | None = None,
    ) -> None:
        self.status_code = status_code
        self._payload = payload
        self._error = error

    def json(self) -> dict[str, str]:
        return self._payload

    def raise_for_status(self) -> None:
        if self._error is not None:
            raise self._error
        response = httpx.Response(
            self.status_code,
            request=httpx.Request("GET", "http://synthetic.test"),
        )
        response.raise_for_status()


class _ReadinessClient:
    def __init__(
        self,
        health_responses: list[_FakeResponse | httpx.HTTPError],
        ready_response: _FakeResponse | httpx.HTTPError,
    ) -> None:
        self.health_responses = health_responses
        self.ready_response = ready_response
        self.calls: list[tuple[str, float | None]] = []

    def __enter__(self) -> _ReadinessClient:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def get(self, url: str, *, timeout: float | None = None) -> _FakeResponse:
        self.calls.append((url, timeout))
        response: _FakeResponse | httpx.HTTPError
        if url.endswith("/health"):
            response = self.health_responses.pop(0)
        else:
            response = self.ready_response
        if isinstance(response, httpx.HTTPError):
            raise response
        return response


def _install_readiness_client(
    monkeypatch: pytest.MonkeyPatch,
    client: _ReadinessClient,
) -> dict[str, object]:
    options: dict[str, object] = {}

    def client_factory(**kwargs: object) -> _ReadinessClient:
        options.update(kwargs)
        return client

    monkeypatch.setattr(acceptance_module.httpx, "Client", client_factory)
    monkeypatch.setattr(acceptance_module.time, "sleep", lambda _seconds: None)
    return options


def test_readiness_waits_for_health_then_checks_database_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _ReadinessClient(
        [
            httpx.ConnectError("not listening"),
            _FakeResponse(503, {"status": "starting"}),
            _FakeResponse(
                200,
                {"status": "ok", "service": "calorieapp-backend"},
            ),
        ],
        _FakeResponse(
            200,
            {
                "status": "ready",
                "service": "calorieapp-backend",
                "database_revision": acceptance_module.SCHEMA_HEAD,
            },
        ),
    )
    options = _install_readiness_client(monkeypatch, client)

    _wait_until_ready(_RunningProcess(), "http://127.0.0.1:12345")

    assert options == {
        "timeout": acceptance_module._BACKEND_HEALTH_REQUEST_TIMEOUT_SECONDS,
        "trust_env": False,
    }
    assert client.calls == [
        ("http://127.0.0.1:12345/health", None),
        ("http://127.0.0.1:12345/health", None),
        ("http://127.0.0.1:12345/health", None),
        (
            "http://127.0.0.1:12345/ready",
            acceptance_module._BACKEND_READY_REQUEST_TIMEOUT_SECONDS,
        ),
    ]


def test_readiness_rejects_wrong_schema_without_retrying_ready(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _ReadinessClient(
        [
            _FakeResponse(
                200,
                {"status": "ok", "service": "calorieapp-backend"},
            )
        ],
        _FakeResponse(
            200,
            {
                "status": "ready",
                "service": "calorieapp-backend",
                "database_revision": "unexpected",
            },
        ),
    )
    _install_readiness_client(monkeypatch, client)

    with pytest.raises(SyntheticStagingSafetyError, match="unexpected readiness"):
        _wait_until_ready(_RunningProcess(), "http://127.0.0.1:12345")

    assert [url for url, _timeout in client.calls].count(
        "http://127.0.0.1:12345/ready"
    ) == 1


def test_readiness_timeout_fails_closed_without_retrying_ready(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _ReadinessClient(
        [
            _FakeResponse(
                200,
                {"status": "ok", "service": "calorieapp-backend"},
            )
        ],
        httpx.ReadTimeout("database validation timed out"),
    )
    _install_readiness_client(monkeypatch, client)

    with pytest.raises(SyntheticStagingSafetyError, match="readiness check failed"):
        _wait_until_ready(_RunningProcess(), "http://127.0.0.1:12345")

    assert [url for url, _timeout in client.calls].count(
        "http://127.0.0.1:12345/ready"
    ) == 1


@pytest.mark.parametrize(
    "raw_url",
    [
        "",
        "sqlite:///synthetic.db",
        "postgresql://user:pass@example.com/db?sslmode=require&channel_binding=require",
        f"postgresql://user@{_NEON_TEST_HOST}/db?sslmode=require&channel_binding=require",
        f"postgresql://user:pass@{_NEON_TEST_HOST}/db",
        f"postgresql://user:pass@{_NEON_TEST_HOST}/db?sslmode=require",
        f"postgresql://user:pass@{_NEON_TEST_HOST}/db?sslmode=require&channel_binding=require&application_name=unsafe",
        f"postgresql://user:pass@{_NEON_TEST_HOST}:5444/db?sslmode=require&channel_binding=require",
    ],
)
def test_source_url_rejects_targets_outside_exact_neon_tls_boundary(
    raw_url: str,
) -> None:
    with pytest.raises(SyntheticStagingSafetyError):
        validate_source_url(raw_url)


def test_source_url_accepts_neon_tls_connection_without_rendering_secret() -> None:
    parsed = validate_source_url(_NEON_TEST_URL)

    assert parsed.host == _NEON_TEST_HOST
    assert parsed.database == "neondb"


@pytest.mark.parametrize(
    "raw_url",
    [
        "",
        "sqlite:///restore.db",
        "postgresql://user:pass@database.example/calorieapp_synthetic_exit",
        "postgresql://user@127.0.0.1/calorieapp_synthetic_exit",
        "postgresql://user:pass@127.0.0.1/wrong",
        "postgresql://user:pass@127.0.0.1/calorieapp_synthetic_exit?sslmode=disable",
    ],
)
def test_restore_url_rejects_non_disposable_targets(raw_url: str) -> None:
    with pytest.raises(SyntheticStagingSafetyError):
        validate_restore_url(raw_url)


def test_restore_url_accepts_exact_loopback_database() -> None:
    parsed = validate_restore_url(
        f"postgresql://synthetic:secret@127.0.0.1:5432/{RESTORE_DATABASE}"
    )

    assert parsed == make_url(
        f"postgresql://synthetic:secret@127.0.0.1:5432/{RESTORE_DATABASE}"
    )


@pytest.mark.parametrize(
    "reference",
    [
        "",
        "STEP1-SYNTHETIC-ACCEPTANCE",
        "STEP1-SYNTHETIC-ACCEPTANCE-2026-9-3",
        "STEP1-SYNTHETIC-ACCEPTANCE-2026-09-03-extra",
        "$(unsafe)",
    ],
)
def test_approval_reference_is_low_cardinality(reference: str) -> None:
    with pytest.raises(SyntheticStagingSafetyError):
        validate_approval_reference(reference)


def test_migration_seed_and_independent_verification_use_only_fixed_synthetic_rows(
    tmp_path,
) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'acceptance.sqlite'}")
    try:
        snapshot = migrate_and_seed(
            engine,
            "STEP1-SYNTHETIC-ACCEPTANCE-2026-09-03",
        )
        verified = verify_synthetic_snapshot(engine, expected_food_log_count=1)
    finally:
        engine.dispose()

    assert snapshot == verified
    assert snapshot.payload("verified") == {
        "schema_version": SCHEMA_VERSION,
        "status": "verified",
        "user_count": 1,
        "identity_count": 1,
        "auth_session_count": 1,
        "food_log_count": 1,
    }


def test_migration_refuses_a_nonempty_source(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'nonempty.sqlite'}")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE unexpected (id INTEGER PRIMARY KEY)"))
        with pytest.raises(SyntheticStagingSafetyError, match="not empty"):
            migrate_and_seed(
                engine,
                "STEP1-SYNTHETIC-ACCEPTANCE-2026-09-03",
            )
    finally:
        engine.dispose()


def test_verification_rejects_extra_application_data(tmp_path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'extra.sqlite'}")
    try:
        migrate_and_seed(engine, "STEP1-SYNTHETIC-ACCEPTANCE-2026-09-03")
        with Session(engine) as session:
            session.add(
                FoodLogDB(
                    owner_id="00000000-0000-0000-0000-000000000092",
                    product_name="Unexpected row",
                    calories=1,
                )
            )
            session.commit()
        with pytest.raises(SyntheticStagingSafetyError, match="unexpected"):
            verify_synthetic_snapshot(engine, expected_food_log_count=1)
    finally:
        engine.dispose()


def test_workflow_is_manual_main_only_review_gated_and_encrypted() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    contract = json.loads(PROVIDER_CONTRACT_PATH.read_text(encoding="utf-8"))
    recipient = contract["preconfiguration_review"]["portable_backup"][
        "encryption_public_recipient"
    ]

    assert "workflow_dispatch:" in workflow
    assert "timeout-minutes: 40" in workflow
    assert "pull_request:" not in workflow
    assert "\n  push:" not in workflow
    assert "if: github.ref == 'refs/heads/main'" in workflow
    assert "name: neon-synthetic-restore" in workflow
    assert 'test "${REVIEWED_COMMIT}" = "${GITHUB_SHA}"' in workflow
    assert "SYNTHETIC-ONLY-NO-REAL-DATA" in workflow
    assert "secrets.CALORIEAPP_SYNTHETIC_NEON_DATABASE_URL" in workflow
    assert "secrets.CALORIEAPP_SYNTHETIC_AGE_IDENTITY" in workflow
    assert f"CALORIEAPP_SYNTHETIC_AGE_RECIPIENT: {recipient}" in workflow
    assert workflow.count(
        'psql --dbname="${CALORIEAPP_SYNTHETIC_NEON_DATABASE_URL}"'
    ) == 2
    assert 'pg_dump --dbname="${CALORIEAPP_SYNTHETIC_NEON_DATABASE_URL}"' in workflow
    assert "--format=custom --no-owner --no-privileges" in workflow
    assert "PGDATABASE=" not in workflow
    assert "age --encrypt" in workflow
    assert "shred --force --remove" in workflow
    assert "path: ${{ runner.temp }}/calorieapp-synthetic-neon.dump.age" in workflow
    assert "retention-days: 30" in workflow
    assert "pg_postmaster_start_time()" in workflow
    assert "capacity-pause-exercise.json" in workflow
    assert 'test "${pause_status}" -eq 30' in workflow
    assert "pg_restore" in workflow
    assert "verify-restore" in workflow
