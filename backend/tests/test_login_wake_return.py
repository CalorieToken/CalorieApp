"""A public startup navigation returns only to the configured website."""

from fastapi.testclient import TestClient

import app.main as main


def test_wake_returns_to_website_without_creating_a_session(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(main, "_WORDPRESS_URL", "https://calorietoken.net")
    response = client.get("/health?resume_login=true", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "https://calorietoken.net/index.php/calorieapp/"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "set-cookie" not in response.headers


def test_wake_ignores_supplied_redirect_and_authentication_values(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(main, "_WORDPRESS_URL", "https://calorietoken.net/")
    response = client.get(
        "/health?resume_login=true&redirect=https://attacker.example/"
        "&state=untrusted&code=untrusted&return_to=//attacker.example/",
        follow_redirects=False,
    )
    assert response.status_code == 303
    assert response.headers["location"] == "https://calorietoken.net/index.php/calorieapp/"
    assert "set-cookie" not in response.headers


def test_normal_health_probe_remains_json(client: TestClient) -> None:
    for path in ("/health", "/health?resume_login=false"):
        response = client.get(path, follow_redirects=False)
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert "location" not in response.headers
