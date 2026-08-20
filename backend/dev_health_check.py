"""
Developer health-check for CalorieApp MVP.

Checks:
- frontend listener on port 3000
- backend listener on port 8000
- exactly one backend listener PID on 8000 and that PID commandline contains uvicorn + app.main:app
- GET /health == 200
- GET /search-food?q=banana == 200
- POST /log-food works
- GET /logs contains the new entry
- backend restart through start-backend.ps1
- persistence survives restart
- UTF-8 round-trip check (no U+00C3 mojibake marker)

Exit:
- 0 if all checks pass
- 1 otherwise
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from http.cookiejar import Cookie, CookieJar
from datetime import UTC, datetime, timedelta
from pathlib import Path
from secrets import token_urlsafe

from sqlmodel import Session

from app.database import engine
from app.models import AuthSessionDB, CalorieAppUserDB

BACKEND_URL = "http://127.0.0.1:8000"
START_SCRIPT = Path(__file__).resolve().parent / "start-backend.ps1"
SESSION_COOKIE_NAME = "calorieapp_session"
SESSION_TOKEN_BYTES = 48
SESSION_ABSOLUTE_LIFETIME_SECONDS = 8 * 60 * 60


def create_authenticated_cookiejar() -> CookieJar:
    """Create a production-compatible opaque session for development smoke checks."""
    with Session(engine) as session:
        user = CalorieAppUserDB(status="active")
        session.add(user)
        session.commit()
        session.refresh(user)

        session_token = token_urlsafe(SESSION_TOKEN_BYTES)
        token_hash = hashlib.sha256(session_token.encode("utf-8")).hexdigest()
        now = datetime.now(UTC)

        auth_session = AuthSessionDB(
            session_token_hash=token_hash,
            calorieapp_user_id=user.id,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(seconds=SESSION_ABSOLUTE_LIFETIME_SECONDS),
        )
        session.add(auth_session)
        session.commit()

    jar = CookieJar()
    jar.set_cookie(
        Cookie(
            version=0,
            name=SESSION_COOKIE_NAME,
            value=session_token,
            port=None,
            port_specified=False,
            domain="127.0.0.1",
            domain_specified=False,
            domain_initial_dot=False,
            path="/",
            path_specified=True,
            secure=False,
            expires=None,
            discard=False,
            comment=None,
            comment_url=None,
            rest={},
            rfc2109=False,
        )
    )
    return jar


def run_ps(command: str) -> str:
    result = subprocess.run(
        ["powershell", "-NoProfile", "-Command", command],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    return result.stdout.strip()


def backend_listener_pids() -> list[int]:
    out = run_ps(
        "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | "
        "Select-Object -ExpandProperty OwningProcess"
    )
    pids = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            pids.append(int(line))
        except ValueError:
            continue
    return sorted(list(set(pids)))


def frontend_listener_pid() -> int | None:
    out = run_ps(
        "(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | "
        "Select-Object -ExpandProperty OwningProcess | Select-Object -First 1)"
    )
    if not out:
        return None
    try:
        return int(out.splitlines()[-1].strip())
    except ValueError:
        return None


def commandline_for_pid(pid: int) -> str:
    out = run_ps(
        f"(Get-CimInstance Win32_Process -Filter \"ProcessId = {pid}\" | "
        "Select-Object -ExpandProperty CommandLine)"
    )
    return out or ""


def stop_stale_backend_processes() -> None:
    run_ps(
        "Get-CimInstance Win32_Process | "
        "Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -like '*uvicorn*' -and $_.CommandLine -like '*app.main:app*' } | "
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )
    # Also clear any stale listeners on 8000 regardless of commandline match.
    run_ps(
        "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | "
        "ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
    )


def start_backend_with_script() -> bool:
    if not START_SCRIPT.exists():
        return False
    stop_stale_backend_processes()
    run_ps(
        f"Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','{START_SCRIPT}' -WindowStyle Hidden"
    )
    return wait_health(30)


def wait_health(timeout_sec: int) -> bool:
    end_time = time.time() + timeout_sec
    while time.time() < end_time:
        code, _ = http_get("/health", timeout=3)
        if code == 200:
            return True
        time.sleep(1)
    return False


def http_get(path: str, timeout: int = 20, cookie_jar: CookieJar | None = None) -> tuple[int | None, str]:
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar or CookieJar()))
    try:
        with opener.open(f"{BACKEND_URL}{path}", timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception:
        return None, ""


def http_post_json(path: str, payload: dict, timeout: int = 20, cookie_jar: CookieJar | None = None) -> tuple[int | None, dict]:
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar or CookieJar()))
    req = urllib.request.Request(
        f"{BACKEND_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with opener.open(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, {"error": body}
    except Exception as e:
        return None, {"error": str(e)}


def print_check(name: str, ok: bool, detail: str = "") -> bool:
    tag = "PASS" if ok else "FAIL"
    if detail:
        print(f"[{tag}] {name}: {detail}")
    else:
        print(f"[{tag}] {name}")
    return ok


def main() -> int:
    print("CalorieApp Developer Health Check")
    print("-")

    all_ok = True

    started = start_backend_with_script()
    all_ok &= print_check("Backend startup via start-backend.ps1", started)

    frontend_pid = frontend_listener_pid()
    all_ok &= print_check("Frontend listener on 3000", frontend_pid is not None, f"pid={frontend_pid}")

    backend_pids = backend_listener_pids()
    single_listener = len(backend_pids) == 1
    backend_pid = backend_pids[0] if single_listener else None
    all_ok &= print_check("Backend listener on 8000", single_listener, f"pids={backend_pids}")

    cmdline_ok = False
    cmdline = ""
    if backend_pid is not None:
        cmdline = commandline_for_pid(backend_pid)
        cmdline_ok = ("uvicorn" in cmdline.lower()) and ("app.main:app" in cmdline.lower())
    all_ok &= print_check("Exactly one backend uvicorn app.main process", cmdline_ok, f"pid={backend_pid}")

    # Reconfirm health after process checks to avoid transient race windows.
    stable = wait_health(10)
    all_ok &= print_check("Backend stable after normalization", stable)

    health_status, _ = http_get("/health")
    all_ok &= print_check("GET /health returns 200", health_status == 200, f"status={health_status}")

    search_status, _ = http_get("/search-food?q=banana")
    all_ok &= print_check("GET /search-food?q=banana returns 200", search_status == 200, f"status={search_status}")

    marker_name = f"HealthCheck Entry {int(time.time())}"
    session_cookie_jar = create_authenticated_cookiejar()
    post_status, _ = http_post_json(
        "/log-food",
        {
            "product_name": marker_name,
            "calories": 123.0,
            "protein": 4.5,
            "fat": 2.3,
            "carbohydrates": 15.1,
        },
        cookie_jar=session_cookie_jar,
    )
    all_ok &= print_check("POST /log-food works", post_status == 200, f"status={post_status}")

    logs_status, logs_raw = http_get("/logs", cookie_jar=session_cookie_jar)
    logs: list[dict] = []
    if logs_status == 200:
        try:
            parsed = json.loads(logs_raw)
            if isinstance(parsed, list):
                logs = [x for x in parsed if isinstance(x, dict)]
        except json.JSONDecodeError:
            logs = []

    has_marker = any(item.get("product_name") == marker_name for item in logs)
    all_ok &= print_check("GET /logs returns newly added entry", logs_status == 200 and has_marker, f"status={logs_status}")

    restarted = start_backend_with_script()
    all_ok &= print_check("Backend restart via start-backend.ps1", restarted)

    logs2_status, logs2_raw = http_get("/logs", cookie_jar=session_cookie_jar)
    logs2: list[dict] = []
    if logs2_status == 200:
        try:
            parsed2 = json.loads(logs2_raw)
            if isinstance(parsed2, list):
                logs2 = [x for x in parsed2 if isinstance(x, dict)]
        except json.JSONDecodeError:
            logs2 = []

    persisted = any(item.get("product_name") == marker_name for item in logs2)
    all_ok &= print_check("Persistence survives clean restart", logs2_status == 200 and persisted, f"status={logs2_status}")

    utf_status, utf_body = http_post_json(
        "/log-food",
        {
            "product_name": "Sant\u00e9 HealthCheck",
            "calories": 1.0,
            "protein": 0.0,
            "fat": 0.0,
            "carbohydrates": 0.0,
        },
        cookie_jar=session_cookie_jar,
    )
    utf_value = utf_body.get("product_name", "") if isinstance(utf_body, dict) else ""
    utf_ok = utf_status == 200 and ("\u00c3" not in utf_value) and ("\u00e9" in utf_value)
    all_ok &= print_check("UTF-8 round-trip remains intact", utf_ok, f"value={repr(utf_value)}")

    print("-")
    print("RESULT: SUCCESS" if all_ok else "RESULT: FAILED")
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
