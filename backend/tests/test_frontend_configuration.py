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

    assert '"/api/backend"' in export_source
    assert "${BACKEND_BASE_URL}/api/identity/export" in export_source
    assert '"calorieapp-account-data-v1"' in export_source
    assert '"calorieapp-account-data-v1.json"' in export_source
    assert 'cache: "no-store"' in export_source
    assert "isVersionedAccountExport(payload)" in export_source
    assert "URL.revokeObjectURL(objectUrl)" in export_source
    assert "localStorage" not in export_source
    assert "sessionStorage" not in export_source
    assert "dangerouslySetInnerHTML" not in export_source
    assert "fetch(" not in export_source

    assert "<AccountDataExportButton" in panel_source
    assert 'pattern: /^api\\/identity\\/(me|export)$/' in proxy_source
    assert '"content-disposition"' in proxy_source
