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
