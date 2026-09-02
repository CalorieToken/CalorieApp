import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CANONICAL_WORDPRESS_APP_URL = "https://calorietoken.net/index.php/calorieapp/"
NON_CANONICAL_WORDPRESS_APP_URL = "https://calorietoken.net/calorieapp/"


def test_frontend_uses_canonical_wordpress_calorieapp_route():
    panel_source = (
        REPO_ROOT / "frontend" / "components" / "XamanLoginPanel.tsx"
    ).read_text(encoding="utf-8")
    env_example = (REPO_ROOT / "frontend" / ".env.example").read_text(
        encoding="utf-8"
    )

    for source in (panel_source, env_example):
        assert CANONICAL_WORDPRESS_APP_URL in source
        assert NON_CANONICAL_WORDPRESS_APP_URL not in source


def test_backend_proxy_preserves_bounded_retry_after_header():
    proxy_source = (
        REPO_ROOT / "frontend" / "app" / "api" / "backend" / "[...path]" / "route.ts"
    ).read_text(encoding="utf-8")

    assert '"retry-after"' in proxy_source


def test_account_export_ui_is_versioned_private_and_proxy_allowlisted():
    export_source = (
        REPO_ROOT / "frontend" / "components" / "AccountDataExportButton.tsx"
    ).read_text(encoding="utf-8")
    panel_source = (
        REPO_ROOT / "frontend" / "components" / "XamanLoginPanel.tsx"
    ).read_text(encoding="utf-8")
    proxy_source = (
        REPO_ROOT / "frontend" / "app" / "api" / "backend" / "[...path]" / "route.ts"
    ).read_text(encoding="utf-8")
    account_copy = json.loads(
        (
            REPO_ROOT / "frontend" / "config" / "account-privacy-copy.json"
        ).read_text(encoding="utf-8")
    )["locales"]["en"]["export"]

    assert '"/api/backend"' in export_source
    assert "${BACKEND_BASE_URL}/api/identity/export" in export_source
    assert '"calorieapp-account-data-v1"' in export_source
    assert '"calorieapp-account-data-v1.json"' in export_source
    assert 'cache: "no-store"' in export_source
    assert "isVersionedAccountExport(payload)" in export_source
    assert "candidate.inactive_account_notices" in export_source
    assert "getAccountPrivacyCopy(locale)" in export_source
    assert "warning" in account_copy["description"]
    assert "history for inactive accounts" in account_copy["description"]
    assert "URL.revokeObjectURL(objectUrl)" in export_source
    assert "localStorage" not in export_source
    assert "sessionStorage" not in export_source
    assert "dangerouslySetInnerHTML" not in export_source
    assert "fetch(" not in export_source

    assert "<AccountDataExportButton" in panel_source
    assert 'pattern: /^api\\/identity\\/(me|export)$/' in proxy_source
    assert '"content-disposition"' in proxy_source


def test_account_import_ui_is_hidden_fail_closed_and_proxy_allowlisted():
    import_source = (
        REPO_ROOT / "frontend" / "components" / "AccountDataImportPanel.tsx"
    ).read_text(encoding="utf-8")
    request_policy_source = (
        REPO_ROOT / "frontend" / "lib" / "accountImportRequest.ts"
    ).read_text(encoding="utf-8")
    panel_source = (
        REPO_ROOT / "frontend" / "components" / "XamanLoginPanel.tsx"
    ).read_text(encoding="utf-8")
    proxy_source = (
        REPO_ROOT / "frontend" / "app" / "api" / "backend" / "[...path]" / "route.ts"
    ).read_text(encoding="utf-8")
    frontend_env = (REPO_ROOT / "frontend" / ".env.example").read_text(
        encoding="utf-8"
    )
    backend_env = (REPO_ROOT / "backend" / ".env.example").read_text(
        encoding="utf-8"
    )

    assert "ACCOUNT_IMPORT_PATH" in import_source
    assert "${BACKEND_BASE_URL}/${ACCOUNT_IMPORT_PATH}" in import_source
    assert 'method: "POST"' in import_source
    assert 'cache: "no-store"' in import_source
    assert "selectedFile.arrayBuffer()" in import_source
    assert "isAccountDataImportConfirmationReady" in import_source
    assert "ACCOUNT_IMPORT_MAX_USER_ID_BYTES = 255" in import_source
    assert "sourceConfirmation === sourceConfirmation.trim()" in import_source
    assert "isAccountDataImportResponse" in import_source
    assert "localStorage" not in import_source
    assert "sessionStorage" not in import_source
    assert "FileReader" not in import_source
    assert "dangerouslySetInnerHTML" not in import_source

    assert "ACCOUNT_IMPORT_REQUEST_HEADER" in request_policy_source
    assert 'request.headers.get("sec-fetch-site") === "same-origin"' in (
        request_policy_source
    )
    assert "<AccountDataImportPanel" in panel_source
    assert "NEXT_PUBLIC_ACCOUNT_DATA_IMPORT_UI_ENABLED" in panel_source
    assert "NEXT_PUBLIC_ACCOUNT_DATA_IMPORT_UI_ENABLED=false" in frontend_env
    assert "ACCOUNT_DATA_IMPORT_ENABLED=false" in backend_env
    assert "ACCOUNT_DATA_IMPORT_APPROVED_COMMIT_SHA=" in backend_env
    assert "CALORIEAPP_RELEASE_COMMIT_SHA=" in backend_env
    assert 'pattern: /^api\\/identity\\/import$/' in proxy_source
    assert "isTrustedAccountImportRequest(path, request)" in proxy_source


def test_account_erasure_ui_is_hidden_fail_closed_and_proxy_allowlisted():
    erasure_source = (
        REPO_ROOT / "frontend" / "components" / "AccountErasurePanel.tsx"
    ).read_text(encoding="utf-8")
    request_policy_source = (
        REPO_ROOT / "frontend" / "lib" / "accountErasureRequest.ts"
    ).read_text(encoding="utf-8")
    panel_source = (
        REPO_ROOT / "frontend" / "components" / "XamanLoginPanel.tsx"
    ).read_text(encoding="utf-8")
    proxy_source = (
        REPO_ROOT / "frontend" / "app" / "api" / "backend" / "[...path]" / "route.ts"
    ).read_text(encoding="utf-8")
    frontend_env = (REPO_ROOT / "frontend" / ".env.example").read_text(
        encoding="utf-8"
    )
    backend_env = (REPO_ROOT / "backend" / ".env.example").read_text(
        encoding="utf-8"
    )

    assert "${BACKEND_BASE_URL}/api/identity/account" in erasure_source
    assert 'method: "DELETE"' in erasure_source
    assert 'cache: "no-store"' in erasure_source
    assert '"delete-my-calorieapp-account"' in erasure_source
    assert "isAccountErasureConfirmationReady" in erasure_source
    assert "isAccountErasureResponse(payload)" in erasure_source
    assert "localStorage" not in erasure_source
    assert "sessionStorage" not in erasure_source
    assert "fetch(" not in erasure_source

    assert "ACCOUNT_ERASURE_REQUEST_HEADER" in request_policy_source
    assert 'fetchSite === "same-origin"' in request_policy_source
    assert "(!fetchSite ||" not in request_policy_source
    assert "<AccountErasurePanel" in panel_source
    assert "NEXT_PUBLIC_ACCOUNT_ERASURE_UI_ENABLED" in panel_source
    assert "NEXT_PUBLIC_ACCOUNT_ERASURE_UI_ENABLED=false" in frontend_env
    assert "ACCOUNT_ERASURE_ENABLED=false" in backend_env
    assert 'pattern: /^api\\/identity\\/account$/' in proxy_source
    assert "isTrustedAccountErasureRequest(path, request)" in proxy_source
