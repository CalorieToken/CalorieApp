"""Pure privacy-minimized proof for future restore-erasure replay.

This module creates no key, database row, file, artifact or provider record. It
cannot scan a restored database or perform erasure. A future separately
reviewed replay store may persist its pseudonymous output only under the
selected backup-retention and access-control boundary.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import json
import re


REPLAY_PROOF_SCHEMA_VERSION = "calorieapp-account-erasure-replay-proof-v1"
REPLAY_PROOF_ALGORITHM = "hmac-sha256-v1"
MINIMUM_SECRET_BYTES = 32
MAXIMUM_USER_ID_BYTES = 255
MAXIMUM_BACKUP_RETENTION_DAYS = 30
ERASURE_REASONS = frozenset(
    {
        "authenticated-user-request",
        "inactive-account-retention",
    }
)

_SUBJECT_DOMAIN = b"calorieapp.account-erasure.replay-subject.v1\x00"
_EVIDENCE_DOMAIN = b"calorieapp.account-erasure.replay-evidence.v1\x00"
_DIGEST_PATTERN = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True, slots=True)
class AccountErasureReplayProof:
    """Pseudonymous evidence requiring protected independent persistence."""

    subject_digest: str
    erasure_reason: str
    erased_at: datetime
    replay_required_until: datetime
    evidence_digest: str

    def as_payload(self) -> dict[str, object]:
        """Return the versioned proof without its raw subject or authorization."""

        return {
            "schema_version": REPLAY_PROOF_SCHEMA_VERSION,
            "algorithm": REPLAY_PROOF_ALGORITHM,
            "subject_digest": self.subject_digest,
            "erasure_reason": self.erasure_reason,
            "erased_at": f"{self.erased_at.isoformat(timespec='microseconds')}Z",
            "replay_required_until": (
                f"{self.replay_required_until.isoformat(timespec='microseconds')}Z"
            ),
            "evidence_digest": self.evidence_digest,
        }


def _secret_key(secret_key: bytes) -> bytes:
    if not isinstance(secret_key, bytes) or len(secret_key) < MINIMUM_SECRET_BYTES:
        raise ValueError(
            f"secret_key must contain at least {MINIMUM_SECRET_BYTES} bytes"
        )
    return secret_key


def _bounded_utf8(value: str, *, field_name: str, maximum_bytes: int) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field_name} must be a non-empty string")
    if len(value) > maximum_bytes:
        raise ValueError(f"{field_name} exceeds its byte limit")
    if len(value.encode("utf-8")) > maximum_bytes:
        raise ValueError(f"{field_name} exceeds its byte limit")
    return value


def _naive_utc(value: datetime, *, field_name: str) -> datetime:
    if not isinstance(value, datetime):
        raise ValueError(f"{field_name} must be a datetime")
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone")
    return value.astimezone(UTC).replace(tzinfo=None)


def _canonical_timestamp(value: datetime) -> str:
    return f"{value.isoformat(timespec='microseconds')}Z"


def _validated_digest(value: object, *, field_name: str) -> str:
    if not isinstance(value, str) or not _DIGEST_PATTERN.fullmatch(value):
        raise ValueError(f"{field_name} must be a lowercase SHA-256 digest")
    return value


def _hmac_digest(secret_key: bytes, domain: bytes, payload: bytes) -> str:
    digest_builder = hmac.new(secret_key, digestmod=hashlib.sha256)
    digest_builder.update(domain)
    digest_builder.update(payload)
    return digest_builder.hexdigest()


def build_account_erasure_replay_proof(
    *,
    secret_key: bytes,
    user_id: str,
    erasure_reason: str,
    erased_at: datetime,
    authorization_reference_sha256: str,
) -> AccountErasureReplayProof:
    """Build a bounded replay selector and context proof without persistence.

    ``subject_digest`` can match a user identifier found in a restored backup
    only when the caller still holds the same secret key. It remains
    pseudonymous personal data and is not safe for public logs or artifacts.
    """

    selected_secret = _secret_key(secret_key)
    selected_user_id = _bounded_utf8(
        user_id,
        field_name="user_id",
        maximum_bytes=MAXIMUM_USER_ID_BYTES,
    )
    if not isinstance(erasure_reason, str) or erasure_reason not in ERASURE_REASONS:
        raise ValueError("erasure_reason is not an approved replay reason")
    authorization_digest = _validated_digest(
        authorization_reference_sha256,
        field_name="authorization_reference_sha256",
    )
    erased_utc = _naive_utc(erased_at, field_name="erased_at")
    try:
        replay_until = erased_utc + timedelta(
            days=MAXIMUM_BACKUP_RETENTION_DAYS
        )
    except OverflowError as exc:
        raise ValueError("erased_at cannot represent the replay horizon") from exc

    subject_digest = _hmac_digest(
        selected_secret,
        _SUBJECT_DOMAIN,
        selected_user_id.encode("utf-8"),
    )
    evidence_payload = json.dumps(
        {
            "authorization_reference_sha256": authorization_digest,
            "erased_at": _canonical_timestamp(erased_utc),
            "erasure_reason": erasure_reason,
            "replay_required_until": _canonical_timestamp(replay_until),
            "schema_version": REPLAY_PROOF_SCHEMA_VERSION,
            "subject_digest": subject_digest,
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    evidence_digest = _hmac_digest(
        selected_secret,
        _EVIDENCE_DOMAIN,
        evidence_payload,
    )
    return AccountErasureReplayProof(
        subject_digest=subject_digest,
        erasure_reason=erasure_reason,
        erased_at=erased_utc,
        replay_required_until=replay_until,
        evidence_digest=evidence_digest,
    )


def verify_account_erasure_replay_proof(
    *,
    expected_subject_digest: object,
    expected_evidence_digest: object,
    secret_key: bytes,
    user_id: str,
    erasure_reason: str,
    erased_at: datetime,
    authorization_reference_sha256: str,
) -> bool:
    """Recompute and compare both digests for authorized replay audit input."""

    if (
        not isinstance(expected_subject_digest, str)
        or not _DIGEST_PATTERN.fullmatch(expected_subject_digest)
        or not isinstance(expected_evidence_digest, str)
        or not _DIGEST_PATTERN.fullmatch(expected_evidence_digest)
    ):
        return False
    actual = build_account_erasure_replay_proof(
        secret_key=secret_key,
        user_id=user_id,
        erasure_reason=erasure_reason,
        erased_at=erased_at,
        authorization_reference_sha256=authorization_reference_sha256,
    )
    subject_matches = hmac.compare_digest(
        actual.subject_digest,
        expected_subject_digest,
    )
    evidence_matches = hmac.compare_digest(
        actual.evidence_digest,
        expected_evidence_digest,
    )
    return subject_matches and evidence_matches
