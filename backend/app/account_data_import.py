"""Pure fail-closed planning for a future account-data import.

The planner accepts only the reviewed CalorieApp v1 private export, requires
explicit confirmation of its source account, and prepares food-log inserts for
an already authenticated target account. It has no endpoint, database session,
file, provider, network, commit or deployment capability.

Authentication state is deliberately not portable. External identities,
sessions, authorization events, browser handoffs and inactive-account notices
must be re-established or handled through separately reviewed flows.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import hashlib
import json
from typing import Any

from pydantic import ValidationError

from .schemas import AccountDataExportResponse


IMPORT_PLAN_VERSION = "calorieapp-account-data-import-plan-v1"
SUPPORTED_EXPORT_VERSION = "calorieapp-account-data-v1"
MAXIMUM_IMPORT_BYTES = 5 * 1024 * 1024
MAXIMUM_COLLECTION_ITEMS = 10_000
MAXIMUM_USER_ID_BYTES = 255

REQUIRED_EXCLUDED_SECURITY_FIELDS = frozenset(
    {
        "authorization_code_hash",
        "authorization_state",
        "login_session_id",
        "session_token_hash",
        "handoff_state_hash",
        "handoff_token_hash",
        "notice_delivery_evidence_digest",
    }
)

_IMPORT_DIGEST_DOMAIN = b"calorieapp.account-data.import.v1\x00"
_TOP_LEVEL_FIELDS = frozenset(
    {
        "export_version",
        "exported_at",
        "account",
        "external_identities",
        "food_logs",
        "authentication_sessions",
        "authorization_events",
        "login_handoffs",
        "inactive_account_notices",
        "excluded_security_fields",
    }
)
_ACCOUNT_FIELDS = frozenset(
    {
        "user_id",
        "status",
        "created_at",
        "updated_at",
        "last_authenticated_activity_at",
    }
)
_COLLECTION_FIELDS = {
    "external_identities": frozenset(
        {
            "provider",
            "external_subject",
            "xrpl_address",
            "created_at",
            "last_verified_at",
        }
    ),
    "food_logs": frozenset(
        {
            "id",
            "product_name",
            "calories",
            "protein",
            "fat",
            "carbohydrates",
            "portion_percentage",
            "barcode",
            "image_url",
            "brand",
            "serving_size",
            "nutri_score",
            "created_at",
        }
    ),
    "authentication_sessions": frozenset(
        {
            "created_at",
            "last_seen_at",
            "expires_at",
            "revoked_at",
        }
    ),
    "authorization_events": frozenset(
        {
            "external_subject",
            "created_at",
            "expires_at",
            "used_at",
            "used_by_ip",
        }
    ),
    "login_handoffs": frozenset(
        {
            "status",
            "created_at",
            "expires_at",
            "completed_at",
            "claimed_at",
            "failure_code",
        }
    ),
    "inactive_account_notices": frozenset(
        {
            "status",
            "activity_anchor_at",
            "notice_window_started_at",
            "retention_due_at",
            "delivered_at",
            "delivery_channel",
            "cancelled_at",
            "recorded_at",
        }
    ),
}
_TIMESTAMP_FIELDS = {
    "external_identities": ("created_at", "last_verified_at"),
    "food_logs": ("created_at",),
    "authentication_sessions": (
        "created_at",
        "last_seen_at",
        "expires_at",
        "revoked_at",
    ),
    "authorization_events": ("created_at", "expires_at", "used_at"),
    "login_handoffs": (
        "created_at",
        "expires_at",
        "completed_at",
        "claimed_at",
    ),
    "inactive_account_notices": (
        "activity_anchor_at",
        "notice_window_started_at",
        "retention_due_at",
        "delivered_at",
        "cancelled_at",
        "recorded_at",
    ),
}


class AccountDataImportSafetyError(ValueError):
    """Raised when an untrusted export cannot produce a safe import plan."""


@dataclass(frozen=True, slots=True, repr=False)
class PlannedFoodLogImport:
    """One portable food-log snapshot with a newly assigned target owner."""

    source_record_id: int
    target_owner_id: str
    product_name: str
    calories: float
    protein: float
    fat: float
    carbohydrates: float
    portion_percentage: float | None
    barcode: str | None
    image_url: str | None
    brand: str | None
    serving_size: str | None
    nutri_score: str | None
    created_at: datetime

    def __repr__(self) -> str:
        """Keep private food-log and account values out of debug output."""

        return "PlannedFoodLogImport(<private>)"

    def as_insert_values(self) -> dict[str, object]:
        """Return values for a future insert without reusing the source row ID."""

        return {
            "owner_id": self.target_owner_id,
            "product_name": self.product_name,
            "calories": self.calories,
            "protein": self.protein,
            "fat": self.fat,
            "carbohydrates": self.carbohydrates,
            "portion_percentage": self.portion_percentage,
            "barcode": self.barcode,
            "image_url": self.image_url,
            "brand": self.brand,
            "serving_size": self.serving_size,
            "nutri_score": self.nutri_score,
            "created_at": self.created_at,
        }


@dataclass(frozen=True, slots=True, repr=False)
class AccountDataImportPlan:
    """Private deterministic plan; it is not authorization to write data."""

    plan_version: str
    export_version: str
    private_import_digest: str
    source_account_id: str
    target_account_id: str
    exported_at: datetime
    food_logs: tuple[PlannedFoodLogImport, ...]
    ignored_collection_counts: tuple[tuple[str, int], ...]

    def __repr__(self) -> str:
        """Keep the complete private plan out of debug output."""

        return "AccountDataImportPlan(<private>)"


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise AccountDataImportSafetyError(
                "payload contains a duplicate JSON key"
            )
        result[key] = value
    return result


def _reject_nonfinite_number(value: str) -> None:
    raise AccountDataImportSafetyError(f"non-finite JSON number: {value}")


def _parse_payload(payload: bytes) -> dict[str, Any]:
    if not isinstance(payload, bytes):
        raise AccountDataImportSafetyError("payload must be UTF-8 JSON bytes")
    if not payload:
        raise AccountDataImportSafetyError("payload must not be empty")
    if len(payload) > MAXIMUM_IMPORT_BYTES:
        raise AccountDataImportSafetyError("payload exceeds the import byte limit")

    try:
        decoded = payload.decode("utf-8")
        parsed = json.loads(
            decoded,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_nonfinite_number,
        )
    except AccountDataImportSafetyError:
        raise
    except (UnicodeDecodeError, ValueError, RecursionError):
        raise AccountDataImportSafetyError(
            "payload is not valid bounded JSON"
        ) from None
    if not isinstance(parsed, dict):
        raise AccountDataImportSafetyError("payload must be a JSON object")
    return parsed


def _require_exact_fields(
    value: object,
    expected_fields: frozenset[str],
    *,
    field_name: str,
) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AccountDataImportSafetyError(f"{field_name} must be an object")
    actual_fields = frozenset(value)
    if actual_fields != expected_fields:
        raise AccountDataImportSafetyError(
            f"{field_name} does not match the reviewed v1 fields"
        )
    return value


def _require_explicit_timezone(value: object, *, field_name: str) -> None:
    if value is None:
        return
    if not isinstance(value, str):
        raise AccountDataImportSafetyError(
            f"{field_name} must be an ISO-8601 timestamp"
        )
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise AccountDataImportSafetyError(
            f"{field_name} must be an ISO-8601 timestamp"
        ) from None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise AccountDataImportSafetyError(
            f"{field_name} must include an explicit timezone"
        )


def _bounded_user_id(value: object, *, field_name: str) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise AccountDataImportSafetyError(
            f"{field_name} must be a non-empty exact identifier"
        )
    if len(value) > MAXIMUM_USER_ID_BYTES:
        raise AccountDataImportSafetyError(f"{field_name} exceeds its byte limit")
    if len(value.encode("utf-8")) > MAXIMUM_USER_ID_BYTES:
        raise AccountDataImportSafetyError(f"{field_name} exceeds its byte limit")
    return value


def _validate_shape(parsed: dict[str, Any]) -> None:
    _require_exact_fields(parsed, _TOP_LEVEL_FIELDS, field_name="payload")
    account = _require_exact_fields(
        parsed["account"],
        _ACCOUNT_FIELDS,
        field_name="account",
    )
    _require_explicit_timezone(parsed["exported_at"], field_name="exported_at")
    for field in ("created_at", "updated_at", "last_authenticated_activity_at"):
        _require_explicit_timezone(account[field], field_name=f"account.{field}")

    for collection_name, expected_fields in _COLLECTION_FIELDS.items():
        collection = parsed[collection_name]
        if not isinstance(collection, list):
            raise AccountDataImportSafetyError(
                f"{collection_name} must be an array"
            )
        if len(collection) > MAXIMUM_COLLECTION_ITEMS:
            raise AccountDataImportSafetyError(
                f"{collection_name} exceeds the import item limit"
            )
        for index, item in enumerate(collection):
            item_name = f"{collection_name}[{index}]"
            item_fields = _require_exact_fields(
                item,
                expected_fields,
                field_name=item_name,
            )
            for timestamp_field in _TIMESTAMP_FIELDS[collection_name]:
                _require_explicit_timezone(
                    item_fields[timestamp_field],
                    field_name=f"{item_name}.{timestamp_field}",
                )

    if parsed["authorization_events"]:
        raise AccountDataImportSafetyError(
            "v1 authorization_events must remain empty"
        )
    excluded = parsed["excluded_security_fields"]
    if not isinstance(excluded, list) or any(
        not isinstance(field, str) for field in excluded
    ):
        raise AccountDataImportSafetyError(
            "excluded_security_fields must be an array of strings"
        )
    if (
        len(excluded) != len(REQUIRED_EXCLUDED_SECURITY_FIELDS)
        or frozenset(excluded) != REQUIRED_EXCLUDED_SECURITY_FIELDS
    ):
        raise AccountDataImportSafetyError(
            "excluded_security_fields does not match the reviewed v1 boundary"
        )


def _validate_timeline(export: AccountDataExportResponse) -> None:
    account = export.account
    if not account.created_at <= account.updated_at <= export.exported_at:
        raise AccountDataImportSafetyError("account timestamps are inconsistent")
    if not (
        account.created_at
        <= account.last_authenticated_activity_at
        <= export.exported_at
    ):
        raise AccountDataImportSafetyError(
            "account activity timestamp is inconsistent"
        )
    if any(
        food_log.created_at > export.exported_at
        for food_log in export.food_logs
    ):
        raise AccountDataImportSafetyError(
            "food log cannot be newer than the export"
        )


def _private_import_digest(
    parsed: dict[str, Any],
    *,
    target_user_id: str,
) -> str:
    canonical_payload = {
        **parsed,
        "excluded_security_fields": sorted(parsed["excluded_security_fields"]),
    }
    canonical = json.dumps(
        canonical_payload,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    digest = hashlib.sha256()
    digest.update(_IMPORT_DIGEST_DOMAIN)
    target_bytes = target_user_id.encode("utf-8")
    digest.update(len(target_bytes).to_bytes(2, "big"))
    digest.update(target_bytes)
    digest.update(canonical)
    return digest.hexdigest()


def plan_account_data_import(
    payload: bytes,
    *,
    confirmed_source_user_id: str,
    target_user_id: str,
) -> AccountDataImportPlan:
    """Validate one private export and prepare a non-mutating import plan.

    The caller must authenticate and authorize ``target_user_id`` separately.
    The source account identifier must be confirmed explicitly rather than
    inferred from an external identity contained in the export.
    """

    parsed = _parse_payload(payload)
    _validate_shape(parsed)
    if parsed["export_version"] != SUPPORTED_EXPORT_VERSION:
        raise AccountDataImportSafetyError("export version is not supported")
    confirmed_source = _bounded_user_id(
        confirmed_source_user_id,
        field_name="confirmed_source_user_id",
    )
    selected_target = _bounded_user_id(
        target_user_id,
        field_name="target_user_id",
    )

    try:
        export = AccountDataExportResponse.model_validate_json(
            payload,
            strict=True,
        )
    except ValidationError:
        raise AccountDataImportSafetyError(
            "payload does not match the reviewed v1 export schema"
        ) from None
    if export.account.user_id != confirmed_source:
        raise AccountDataImportSafetyError(
            "source account confirmation does not match the export"
        )

    source_ids = [food_log.id for food_log in export.food_logs]
    if any(source_id <= 0 for source_id in source_ids):
        raise AccountDataImportSafetyError("food log source IDs must be positive")
    if len(source_ids) != len(set(source_ids)):
        raise AccountDataImportSafetyError("food log source IDs must be unique")
    _validate_timeline(export)

    food_logs = tuple(
        PlannedFoodLogImport(
            source_record_id=food_log.id,
            target_owner_id=selected_target,
            product_name=food_log.product_name,
            calories=food_log.calories,
            protein=food_log.protein,
            fat=food_log.fat,
            carbohydrates=food_log.carbohydrates,
            portion_percentage=food_log.portion_percentage,
            barcode=food_log.barcode,
            image_url=food_log.image_url,
            brand=food_log.brand,
            serving_size=food_log.serving_size,
            nutri_score=food_log.nutri_score,
            created_at=food_log.created_at.astimezone(UTC).replace(tzinfo=None),
        )
        for food_log in export.food_logs
    )
    ignored_counts = tuple(
        (collection_name, len(getattr(export, collection_name)))
        for collection_name in (
            "external_identities",
            "authentication_sessions",
            "authorization_events",
            "login_handoffs",
            "inactive_account_notices",
        )
    )
    return AccountDataImportPlan(
        plan_version=IMPORT_PLAN_VERSION,
        export_version=SUPPORTED_EXPORT_VERSION,
        private_import_digest=_private_import_digest(
            parsed,
            target_user_id=selected_target,
        ),
        source_account_id=export.account.user_id,
        target_account_id=selected_target,
        exported_at=export.exported_at.astimezone(UTC).replace(tzinfo=None),
        food_logs=food_logs,
        ignored_collection_counts=ignored_counts,
    )
