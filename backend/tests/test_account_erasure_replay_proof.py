"""Tests for pure privacy-minimized account-erasure replay proofs."""

from dataclasses import fields
from datetime import UTC, datetime, timedelta, timezone
import json

import pytest

import app.account_erasure_replay_proof as replay_module
from app.account_erasure_replay_proof import (
    ERASURE_REASONS,
    MAXIMUM_BACKUP_RETENTION_DAYS,
    MAXIMUM_USER_ID_BYTES,
    REPLAY_PROOF_ALGORITHM,
    REPLAY_PROOF_SCHEMA_VERSION,
    AccountErasureReplayProof,
    build_account_erasure_replay_proof,
    verify_account_erasure_replay_proof,
)


SECRET = b"synthetic-erasure-replay-key-not-for-production" * 2
USER_ID = "synthetic-replay-user"
ERASED_AT = datetime(2026, 9, 2, 12, 30, 45, 123456, tzinfo=UTC)
AUTHORIZATION_DIGEST = "a" * 64


def _proof(**overrides) -> AccountErasureReplayProof:
    values = {
        "secret_key": SECRET,
        "user_id": USER_ID,
        "erasure_reason": "inactive-account-retention",
        "erased_at": ERASED_AT,
        "authorization_reference_sha256": AUTHORIZATION_DIGEST,
    }
    values.update(overrides)
    return build_account_erasure_replay_proof(**values)


def _verify(
    expected_subject_digest: object,
    expected_evidence_digest: object,
    **overrides,
) -> bool:
    values = {
        "expected_subject_digest": expected_subject_digest,
        "expected_evidence_digest": expected_evidence_digest,
        "secret_key": SECRET,
        "user_id": USER_ID,
        "erasure_reason": "inactive-account-retention",
        "erased_at": ERASED_AT,
        "authorization_reference_sha256": AUTHORIZATION_DIGEST,
    }
    values.update(overrides)
    return verify_account_erasure_replay_proof(**values)


def test_builder_returns_deterministic_bounded_pseudonymous_proof() -> None:
    first = _proof()
    second = _proof()

    assert REPLAY_PROOF_SCHEMA_VERSION == (
        "calorieapp-account-erasure-replay-proof-v1"
    )
    assert REPLAY_PROOF_ALGORITHM == "hmac-sha256-v1"
    assert ERASURE_REASONS == {
        "authenticated-user-request",
        "inactive-account-retention",
    }
    assert first == second
    assert first.erasure_reason == "inactive-account-retention"
    assert first.erased_at == ERASED_AT.replace(tzinfo=None)
    assert first.replay_required_until == (
        ERASED_AT.replace(tzinfo=None)
        + timedelta(days=MAXIMUM_BACKUP_RETENTION_DAYS)
    )
    assert first.subject_digest == (
        "d620ad66b7b67d4e85a5c40b2dfa51fc2bf810ede10718dedacc4187114368f9"
    )
    assert first.evidence_digest == (
        "cf10e38cdb0bd711340a068726747f0d7a2406a4be9fdee1e9d9e0bcc66b7117"
    )
    assert len(first.subject_digest) == 64
    assert len(first.evidence_digest) == 64
    int(first.subject_digest, 16)
    int(first.evidence_digest, 16)
    assert {field.name for field in fields(first)} == {
        "subject_digest",
        "erasure_reason",
        "erased_at",
        "replay_required_until",
        "evidence_digest",
    }
    serialized = json.dumps(first.as_payload())
    assert USER_ID not in serialized
    assert AUTHORIZATION_DIGEST not in serialized
    assert SECRET.hex() not in serialized
    assert USER_ID not in repr(first)


def test_subject_selector_is_stable_while_context_proof_changes() -> None:
    baseline = _proof()
    changed_reason = _proof(erasure_reason="authenticated-user-request")
    changed_time = _proof(erased_at=ERASED_AT + timedelta(seconds=1))
    changed_authorization = _proof(authorization_reference_sha256="b" * 64)

    assert changed_reason.subject_digest == baseline.subject_digest
    assert changed_time.subject_digest == baseline.subject_digest
    assert changed_authorization.subject_digest == baseline.subject_digest
    assert changed_reason.evidence_digest != baseline.evidence_digest
    assert changed_time.evidence_digest != baseline.evidence_digest
    assert changed_authorization.evidence_digest != baseline.evidence_digest

    changed_user = _proof(user_id="other-synthetic-user")
    assert changed_user.subject_digest != baseline.subject_digest
    assert changed_user.evidence_digest != baseline.evidence_digest


def test_matching_proof_verifies() -> None:
    proof = _proof()

    assert _verify(proof.subject_digest, proof.evidence_digest) is True


def test_verification_compares_both_digests_in_constant_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    proof = _proof()
    calls: list[tuple[str, str]] = []
    real_compare = replay_module.hmac.compare_digest

    def record_compare(actual: str, expected: str) -> bool:
        calls.append((actual, expected))
        return real_compare(actual, expected)

    monkeypatch.setattr(replay_module.hmac, "compare_digest", record_compare)

    assert _verify(proof.subject_digest, proof.evidence_digest) is True
    assert calls == [
        (proof.subject_digest, proof.subject_digest),
        (proof.evidence_digest, proof.evidence_digest),
    ]


@pytest.mark.parametrize(
    "overrides",
    [
        {"secret_key": b"different-synthetic-replay-key" * 2},
        {"user_id": "other-synthetic-user"},
        {"erasure_reason": "authenticated-user-request"},
        {"erased_at": ERASED_AT + timedelta(seconds=1)},
        {"authorization_reference_sha256": "b" * 64},
    ],
)
def test_changed_secret_or_context_does_not_verify(overrides: dict) -> None:
    proof = _proof()

    assert _verify(proof.subject_digest, proof.evidence_digest, **overrides) is False


@pytest.mark.parametrize(
    ("subject_digest", "evidence_digest"),
    [
        ("", "a" * 64),
        ("a" * 63, "a" * 64),
        ("A" * 64, "a" * 64),
        ("a" * 64, ""),
        ("a" * 64, "z" * 64),
        (None, "a" * 64),
        ("a" * 64, None),
    ],
)
def test_malformed_expected_digest_does_not_verify(
    subject_digest: object,
    evidence_digest: object,
) -> None:
    assert _verify(subject_digest, evidence_digest) is False


def test_verification_propagates_invalid_authorized_audit_context() -> None:
    proof = _proof()

    with pytest.raises(ValueError, match="erasure_reason"):
        _verify(
            proof.subject_digest,
            proof.evidence_digest,
            erasure_reason="not-approved",
        )


def test_equivalent_timezone_produces_the_same_proof() -> None:
    plus_two = timezone(timedelta(hours=2))

    assert _proof(erased_at=ERASED_AT.astimezone(plus_two)) == _proof()


@pytest.mark.parametrize("secret_key", [b"", b"too-short", "not-bytes"])
def test_secret_key_must_be_bytes_with_minimum_length(secret_key) -> None:
    with pytest.raises(ValueError, match="secret_key"):
        _proof(secret_key=secret_key)


@pytest.mark.parametrize(
    "user_id",
    ["", "x" * (MAXIMUM_USER_ID_BYTES + 1), "é" * 128],
)
def test_user_id_must_be_nonempty_and_utf8_bounded(user_id: str) -> None:
    with pytest.raises(ValueError, match="user_id"):
        _proof(user_id=user_id)


def test_oversized_user_id_is_rejected_before_utf8_allocation() -> None:
    class OversizedHostileString(str):
        def __len__(self) -> int:
            return MAXIMUM_USER_ID_BYTES + 1

        def encode(self, *args, **kwargs) -> bytes:
            raise AssertionError("oversized input must not be encoded")

    with pytest.raises(ValueError, match="user_id"):
        _proof(user_id=OversizedHostileString("synthetic-user"))


@pytest.mark.parametrize(
    "erasure_reason",
    ["", "inactive", "Authenticated-User-Request", None],
)
def test_erasure_reason_must_be_explicitly_approved(erasure_reason) -> None:
    with pytest.raises(ValueError, match="erasure_reason"):
        _proof(erasure_reason=erasure_reason)


@pytest.mark.parametrize(
    "authorization_digest",
    ["", "a" * 63, "A" * 64, "z" * 64, None],
)
def test_authorization_reference_must_be_lowercase_sha256(
    authorization_digest,
) -> None:
    with pytest.raises(ValueError, match="authorization_reference_sha256"):
        _proof(authorization_reference_sha256=authorization_digest)


def test_erased_at_requires_an_explicit_timezone() -> None:
    with pytest.raises(ValueError, match="erased_at must include a timezone"):
        _proof(erased_at=ERASED_AT.replace(tzinfo=None))


def test_erased_at_wrong_type_has_a_predictable_error() -> None:
    with pytest.raises(ValueError, match=r"^erased_at must be a datetime$"):
        _proof(erased_at="2026-09-02T12:30:45Z")


def test_timestamp_overflow_is_mapped_to_a_value_error() -> None:
    with pytest.raises(ValueError, match="replay horizon"):
        _proof(erased_at=datetime.max.replace(tzinfo=UTC))
