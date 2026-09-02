"""Fail-closed release gate for the authenticated account-data import route."""

from __future__ import annotations

import re
from secrets import compare_digest


ACCOUNT_DATA_IMPORT_ACKNOWLEDGEMENT = "import-private-food-history"
ACCOUNT_DATA_IMPORT_REQUEST_VALUE = "account-import"
REVIEWED_COMMIT_PATTERN = re.compile(r"^[0-9a-f]{40}$")
NON_PRODUCTION_IMPORT_ENVIRONMENTS = frozenset({"local", "staging", "test"})


class AccountDataImportReleaseGateError(RuntimeError):
    """Raised when the disabled-by-default import route is not release-bound."""


def require_account_data_import_release_gate(
    *,
    enabled: bool,
    environment: str | None,
    approved_commit_sha: str,
    running_commit_sha: str,
) -> str:
    """Return a bounded approval reference for one exact reviewed commit.

    Both commit values are operator-controlled deployment configuration, but
    they serve different purposes: one records the commit approved for import,
    while the other identifies the code that is actually running. Requiring an
    exact match prevents a later deployment from inheriting import enablement.
    """

    if enabled is not True:
        raise AccountDataImportReleaseGateError(
            "account-data import is disabled"
        )
    if environment not in NON_PRODUCTION_IMPORT_ENVIRONMENTS:
        raise AccountDataImportReleaseGateError(
            "account-data import requires a non-production environment"
        )
    if not REVIEWED_COMMIT_PATTERN.fullmatch(approved_commit_sha):
        raise AccountDataImportReleaseGateError(
            "approved account-data import commit is not configured"
        )
    if not REVIEWED_COMMIT_PATTERN.fullmatch(running_commit_sha):
        raise AccountDataImportReleaseGateError(
            "running account-data import commit is not configured"
        )
    if not compare_digest(approved_commit_sha, running_commit_sha):
        raise AccountDataImportReleaseGateError(
            "running account-data import commit was not approved"
        )
    return f"reviewed-import-commit:{approved_commit_sha}"
