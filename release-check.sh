#!/usr/bin/env bash

set -euo pipefail

export NEXT_TELEMETRY_DISABLED=1

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python_bin="${CALORIEAPP_PYTHON:-$repo_root/.venv/bin/python}"

step() {
    printf '\n[STEP] %s\n' "$1"
}

if [[ ! -x "$python_bin" ]]; then
    printf '[ERROR] Python environment not found: %s\n' "$python_bin" >&2
    printf '[HINT] Set CALORIEAPP_PYTHON to the intended Python executable.\n' >&2
    exit 1
fi

if [[ ! -x "$repo_root/frontend/node_modules/.bin/next" ]]; then
    printf '[ERROR] Frontend dependencies are not installed.\n' >&2
    printf '[HINT] Run npm ci in frontend/ before this check.\n' >&2
    exit 1
fi

step "Backend tests"
"$python_bin" -m pytest "$repo_root/backend/tests" -q

step "Backend Python compilation"
"$python_bin" -m compileall -q "$repo_root/backend/app"

step "Frontend lint"
(
    cd "$repo_root/frontend"
    ./node_modules/.bin/next lint
)

step "Frontend production build"
(
    cd "$repo_root/frontend"
    ./node_modules/.bin/next build
)

step "Git whitespace validation"
git -C "$repo_root" diff --check

step "Legal and licensing boundary"
"$python_bin" "$repo_root/tools/check_legal_boundaries.py"

step "Tracked artifact boundary"
tracked_forbidden="$(
    git -C "$repo_root" ls-files \
        | grep -E '(^|/)(\.env($|\.)|node_modules/|\.next/|\.venv/|__pycache__/|[^/]+\.(db|sqlite|sqlite3)$)' \
        | grep -Ev '(^|/)(\.env\.example|[^/]+\.env\.example|[^/]+\.env\.staging\.example)$' \
        || true
)"

if [[ -n "$tracked_forbidden" ]]; then
    printf '[ERROR] Forbidden runtime or secret-bearing paths are tracked:\n%s\n' "$tracked_forbidden" >&2
    exit 1
fi

printf '\n[SUCCESS] Offline release checks passed\n'
