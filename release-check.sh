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

step "Identity Bridge contracts, provenance and release builder"
"$python_bin" "$repo_root/tools/sync_identity_contracts.py" --check
"$python_bin" -m unittest \
    tools.tests.test_identity_contracts \
    tools.tests.test_build_wordpress_plugin_release \
    tools.tests.test_build_v2_release_manifest \
    tools.tests.test_deployment_smoke_test \
    tools.tests.test_offline_age_custody \
    tools.tests.test_tracked_secret_patterns

step "Schema migration smoke test"
(
    migration_db="$(mktemp)"
    trap 'rm -f -- "$migration_db"' EXIT
    cd "$repo_root/backend"
    CALORIEAPP_ENV=test DATABASE_URL="sqlite:///$migration_db" \
        "$python_bin" -m app.schema_cli upgrade
    CALORIEAPP_ENV=test DATABASE_URL="sqlite:///$migration_db" \
        "$python_bin" -m app.schema_cli check
)

step "Optional PostgreSQL integration"
if [[ -n "${CALORIEAPP_POSTGRES_TEST_DATABASE_URL:-}" ]]; then
    (
        cd "$repo_root/backend"
        CALORIEAPP_POSTGRES_TEST_DATABASE_URL="$CALORIEAPP_POSTGRES_TEST_DATABASE_URL" \
            "$python_bin" -m pytest tests/test_postgresql_integration.py -q
    )
else
    printf '[SKIP] CALORIEAPP_POSTGRES_TEST_DATABASE_URL is not configured\n'
fi

step "Frontend lint"
(
    cd "$repo_root/frontend"
    ./node_modules/.bin/next lint
)

step "Frontend account and locale contract tests"
node --test \
    "$repo_root/tools/tests/account_data_export_validation.test.mjs" \
    "$repo_root/tools/tests/account_erasure_ui.test.mjs" \
    "$repo_root/tools/tests/account_privacy_locales.test.mjs" \
    "$repo_root/tools/tests/calorieapp_embed_readiness.test.mjs" \
    "$repo_root/tools/tests/identity_locales.test.mjs" \
    "$repo_root/tools/tests/xaman_login_start_retry.test.mjs"

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
"$python_bin" "$repo_root/tools/check_tracked_secret_patterns.py"
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
