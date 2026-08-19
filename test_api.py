# Smoke test runner for CalorieApp backend.
# Requires the backend to be running on 127.0.0.1:8000.
# Run: python test_api.py

import json
import urllib.request

BACKEND = "http://127.0.0.1:8000"


def call(method: str, path: str, body: dict | None = None) -> tuple[int | None, str]:
    """Make an HTTP request and return (status_code, response_text)."""
    url = f"{BACKEND}{path}"
    req = urllib.request.Request(url, method=method)
    data: bytes | None = None
    if body is not None:
        req.add_header("Content-Type", "application/json")
        data = json.dumps(body).encode("utf-8")
    try:
        with urllib.request.urlopen(req, data=data, timeout=10) as r:
            return r.getcode(), r.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")
    except Exception as exc:
        return None, str(exc)


def report(label: str, status: int | None, expected: int, body: str = "") -> None:
    result = "PASS" if status == expected else "FAIL"
    print(f"{result}  [{status}]  {label}")


# --- health ---
status, body = call("GET", "/health")
report("GET /health", status, 200)

# --- search valid ---
status, body = call("GET", "/search-food?q=banana")
mojibake = "FAIL" if body and "\u00c3" in body else "PASS"
report("GET /search-food?q=banana", status, 200)
print(f"       UTF-8 mojibake check: {mojibake}")

# --- search empty query ---
status, _ = call("GET", "/search-food?q=")
report("GET /search-food?q= (empty)", status, 422)

# --- search missing param ---
status, _ = call("GET", "/search-food")
report("GET /search-food (no param)", status, 422)

# --- log food valid (unified schema) ---
status, body = call("POST", "/log-food", {
    "product_name": "Apple",
    "calories": 95.0,
    "protein": 0.5,
    "fat": 0.3,
    "carbohydrates": 25.0,
})
report("POST /log-food valid", status, 200)
if status == 200:
    data = json.loads(body)
    has_id = "id" in data and "created_at" in data
    print(f"       Schema check (id + created_at): {'PASS' if has_id else 'FAIL'}")

# --- log food invalid (negative calories) ---
status, _ = call("POST", "/log-food", {
    "product_name": "Bad",
    "calories": -10.0,
})
report("POST /log-food invalid (negative calories)", status, 422)

# --- get logs ---
status, body = call("GET", "/logs")
report("GET /logs", status, 200)
if status == 200:
    logs = json.loads(body)
    print(f"       Logs returned: {len(logs)} item(s)")

