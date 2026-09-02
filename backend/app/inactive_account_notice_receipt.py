"""Privacy-minimized proof derived from a successful delivery receipt.

This module is deliberately pure: it cannot contact a provider, persist a row,
schedule work or authorize erasure. A future reviewed delivery adapter may call
it only after the provider has confirmed successful delivery.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import hashlib
import hmac
import json
import re


EVIDENCE_ALGORITHM = "hmac-sha256-v1"
MINIMUM_SECRET_BYTES = 32
MAXIMUM_RECEIPT_BYTES = 4096
MAXIMUM_USER_ID_BYTES = 255
_DOMAIN = b"calorieapp.inactive-account-notice.delivery-evidence.v1\x00"
_CHANNEL_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,39}$")
_DIGEST_PATTERN = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True, slots=True)
class InactiveAccountNoticeDeliveryEvidence:
    """Only minimized values approved for persistence using naive UTC."""

    delivery_channel: str
    delivered_at: datetime
    delivery_evidence_digest: str


def _canonical_timestamp(value: datetime, *, field_name: str) -> str:
    if not isinstance(value, datetime):
        raise ValueError(f"{field_name} must be a datetime with a timezone")
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone")
    return value.astimezone(UTC).isoformat(timespec="microseconds").replace(
        "+00:00",
        "Z",
    )


def _bounded_utf8(
    value: str,
    *,
    field_name: str,
    maximum_bytes: int,
) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field_name} must be a non-empty string")
    # Every Unicode code point needs at least one UTF-8 byte. Reject impossible
    # values before allocating an encoded copy of a potentially hostile string.
    if len(value) > maximum_bytes:
        raise ValueError(f"{field_name} exceeds its byte limit")
    if len(value.encode("utf-8")) > maximum_bytes:
        raise ValueError(f"{field_name} exceeds its byte limit")
    return value


def successful_delivery_receipt_to_evidence(
    *,
    secret_key: bytes,
    provider_receipt: str,
    user_id: str,
    activity_anchor_at: datetime,
    notice_window_started_at: datetime,
    retention_due_at: datetime,
    delivered_at: datetime,
    delivery_channel: str,
) -> InactiveAccountNoticeDeliveryEvidence:
    """Derive minimized evidence after a provider confirms delivery.

    The HMAC binds the opaque receipt to the internal account, policy timeline
    and provider-neutral channel. Neither the secret nor the raw receipt is
    returned, logged or persisted by this function.
    """

    if not isinstance(secret_key, bytes) or len(secret_key) < MINIMUM_SECRET_BYTES:
        raise ValueError(
            f"secret_key must contain at least {MINIMUM_SECRET_BYTES} bytes"
        )
    _bounded_utf8(
        provider_receipt,
        field_name="provider_receipt",
        maximum_bytes=MAXIMUM_RECEIPT_BYTES,
    )
    _bounded_utf8(
        user_id,
        field_name="user_id",
        maximum_bytes=MAXIMUM_USER_ID_BYTES,
    )
    if not isinstance(delivery_channel, str) or not _CHANNEL_PATTERN.fullmatch(
        delivery_channel
    ):
        raise ValueError("delivery_channel must be a bounded provider-neutral key")

    anchor = _canonical_timestamp(
        activity_anchor_at,
        field_name="activity_anchor_at",
    )
    notice_start = _canonical_timestamp(
        notice_window_started_at,
        field_name="notice_window_started_at",
    )
    delivery = _canonical_timestamp(delivered_at, field_name="delivered_at")
    retention_due = _canonical_timestamp(
        retention_due_at,
        field_name="retention_due_at",
    )
    if not (
        activity_anchor_at < notice_window_started_at
        and notice_window_started_at <= delivered_at
        and delivered_at < retention_due_at
    ):
        raise ValueError("inactive-account notice timeline is invalid")

    payload = json.dumps(
        {
            "activity_anchor_at": anchor,
            "delivery_channel": delivery_channel,
            "delivered_at": delivery,
            "notice_window_started_at": notice_start,
            "provider_receipt": provider_receipt,
            "retention_due_at": retention_due,
            "user_id": user_id,
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    digest_builder = hmac.new(secret_key, digestmod=hashlib.sha256)
    digest_builder.update(_DOMAIN)
    digest_builder.update(payload)
    digest = digest_builder.hexdigest()

    return InactiveAccountNoticeDeliveryEvidence(
        delivery_channel=delivery_channel,
        delivered_at=delivered_at.astimezone(UTC).replace(tzinfo=None),
        delivery_evidence_digest=digest,
    )


def verify_successful_delivery_receipt_evidence(
    *,
    expected_digest: str,
    secret_key: bytes,
    provider_receipt: str,
    user_id: str,
    activity_anchor_at: datetime,
    notice_window_started_at: datetime,
    retention_due_at: datetime,
    delivered_at: datetime,
    delivery_channel: str,
) -> bool:
    """Verify minimized evidence without exposing secret or raw receipt data."""

    if not isinstance(expected_digest, str) or not _DIGEST_PATTERN.fullmatch(
        expected_digest
    ):
        return False
    actual = successful_delivery_receipt_to_evidence(
        secret_key=secret_key,
        provider_receipt=provider_receipt,
        user_id=user_id,
        activity_anchor_at=activity_anchor_at,
        notice_window_started_at=notice_window_started_at,
        retention_due_at=retention_due_at,
        delivered_at=delivered_at,
        delivery_channel=delivery_channel,
    )
    return hmac.compare_digest(actual.delivery_evidence_digest, expected_digest)
