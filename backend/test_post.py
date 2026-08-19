# Manual POST smoke test for CalorieApp backend.
# Requires the backend to be running on 127.0.0.1:8000.
# Run: python test_post.py

import json
import urllib.request

BACKEND = "http://127.0.0.1:8000"


def post(path, body):
    url = f"{BACKEND}{path}"
    req = urllib.request.Request(url, method="POST")
    req.add_header("Content-Type", "application/json")
    data = json.dumps(body).encode("utf-8")
    try:
        with urllib.request.urlopen(req, data=data, timeout=10) as r:
            return r.getcode(), json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")
    except Exception as exc:
        return None, str(exc)


def report(label, status, expected):
    result = "PASS" if status == expected else "FAIL"
    print(f"{result}  [{status}]  {label}")


print("--- POST /log-food tests ---")

# Valid payload - full unified schema
status, body = post("/log-food", {
    "product_name": "Banana Test",
    "calories": 89.0,
    "protein": 1.1,
    "fat": 0.3,
    "carbohydrates": 23.0,
})
report("POST /log-food valid (full schema)", status, 200)
if status == 200 and isinstance(body, dict):
    print(f"       id={body.get('id')}  created_at={body.get('created_at')}")

# Valid payload - minimal (macros default to 0)
status, body = post("/log-food", {"product_name": "Plain Rice", "calories": 130.0})
report("POST /log-food valid (minimal schema)", status, 200)

# Invalid: negative calories
status, _ = post("/log-food", {"product_name": "Bad", "calories": -50.0})
report("POST /log-food invalid (negative calories)", status, 422)

# Invalid: missing product_name
status, _ = post("/log-food", {"calories": 100.0})
report("POST /log-food invalid (missing product_name)", status, 422)

# Invalid: empty product_name (min_length=1)
status, _ = post("/log-food", {"product_name": "", "calories": 100.0})
report("POST /log-food invalid (empty product_name)", status, 422)
