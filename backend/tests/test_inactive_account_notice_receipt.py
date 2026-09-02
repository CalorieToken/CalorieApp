"""Tests for privacy-minimized inactive-account delivery receipt proof."""

from dataclasses import fields
from datetime import UTC, datetime, timedelta, timezone

import pytest

from app.inactive_account_notice_receipt import (
    EVIDENCE_ALGORITHM,
    MAXIMUM_RECEIPT_BYTES,
    InactiveAccountNoticeDeliveryEvidence,
    successful_delivery_receipt_to_evidence,
)


SECRET = b"synthetic-test-key-not-for-production" * 2
ANCHOR = datetime(2024, 1, 1, tzinfo=UTC)
NOTICE_START = datetime(2025, 12, 2, tzinfo=UTC)
DELIVERED = datetime(2025, 12, 5, tzinfo=UTC)
RETENTION_DUE = datetime(2026, 1, 1, tzinfo=UTC)


def _evidence(**overrides) -> InactiveAccountNoticeDeliveryEvidence:
    values = {
        "secret_key": SECRET,
        "provider_receipt": "synthetic-provider-receipt-123",
        "user_id": "synthetic-user",
        "activity_anchor_at": ANCHOR,
        "notice_window_started_at": NOTICE_START,
        "retention_due_at": RETENTION_DUE,
        "delivered_at": DELIVERED,
        "delivery_channel": "synthetic-email",
    }
    values.update(overrides)
    return successful_delivery_receipt_to_evidence(**values)


def test_successful_receipt_builds_deterministic_minimized_evidence() -> None:
    first = _evidence()
    second = _evidence()

    assert EVIDENCE_ALGORITHM == "hmac-sha256-v1"
    assert first == second
    assert first.delivery_channel == "synthetic-email"
    assert first.delivered_at == DELIVERED
    assert len(first.delivery_evidence_digest) == 64
    int(first.delivery_evidence_digest, 16)
    assert {field.name for field in fields(first)} == {
        "delivery_channel",
        "delivered_at",
        "delivery_evidence_digest",
    }
    assert "synthetic-provider-receipt-123" not in repr(first)
    assert SECRET.hex() not in repr(first)


def test_receipt_and_context_changes_produce_different_digests() -> None:
    baseline = _evidence().delivery_evidence_digest

    assert _evidence(provider_receipt="other").delivery_evidence_digest != baseline
    assert _evidence(user_id="other-user").delivery_evidence_digest != baseline
    assert (
        _evidence(delivery_channel="synthetic-sms").delivery_evidence_digest
        != baseline
    )
    assert (
        _evidence(delivered_at=DELIVERED + timedelta(seconds=1))
        .delivery_evidence_digest
        != baseline
    )


def test_equivalent_timezones_produce_the_same_evidence() -> None:
    plus_one = timezone(timedelta(hours=1))

    shifted = _evidence(
        activity_anchor_at=ANCHOR.astimezone(plus_one),
        notice_window_started_at=NOTICE_START.astimezone(plus_one),
        retention_due_at=RETENTION_DUE.astimezone(plus_one),
        delivered_at=DELIVERED.astimezone(plus_one),
    )

    assert shifted == _evidence()
    assert shifted.delivered_at.tzinfo is UTC


@pytest.mark.parametrize("secret_key", [b"", b"too-short", "not-bytes"])
def test_secret_key_must_be_bytes_with_minimum_length(secret_key) -> None:
    with pytest.raises(ValueError, match="secret_key"):
        _evidence(secret_key=secret_key)


@pytest.mark.parametrize(
    "provider_receipt",
    ["", "x" * (MAXIMUM_RECEIPT_BYTES + 1)],
)
def test_receipt_must_be_nonempty_and_bounded(provider_receipt: str) -> None:
    with pytest.raises(ValueError, match="provider_receipt"):
        _evidence(provider_receipt=provider_receipt)


@pytest.mark.parametrize(
    "delivery_channel",
    ["", "Email", "contains space", "x" * 41],
)
def test_channel_must_be_a_bounded_provider_neutral_key(
    delivery_channel: str,
) -> None:
    with pytest.raises(ValueError, match="delivery_channel"):
        _evidence(delivery_channel=delivery_channel)


def test_timestamps_require_explicit_timezone() -> None:
    with pytest.raises(ValueError, match="delivered_at"):
        _evidence(delivered_at=DELIVERED.replace(tzinfo=None))


@pytest.mark.parametrize(
    "overrides",
    [
        {"notice_window_started_at": ANCHOR},
        {"delivered_at": NOTICE_START - timedelta(seconds=1)},
        {"delivered_at": RETENTION_DUE},
    ],
)
def test_policy_timeline_must_be_valid(overrides: dict) -> None:
    with pytest.raises(ValueError, match="timeline"):
        _evidence(**overrides)
