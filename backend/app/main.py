import logging
import os
import hmac
import json
import re
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import compare_digest, token_urlsafe
from typing import Annotated, Optional
from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit

import httpx
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from httpx import HTTPError
from pydantic import ValidationError
from sqlalchemy import delete, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import Session, select

from . import database as db_module
from .account_data_import import (
    AccountDataImportSafetyError,
    plan_account_data_import,
)
from .account_data_import_release import (
    ACCOUNT_DATA_IMPORT_ACKNOWLEDGEMENT,
    ACCOUNT_DATA_IMPORT_REQUEST_VALUE,
    AccountDataImportReleaseGateError,
    require_account_data_import_release_gate,
)
from .account_data_import_transaction import (
    IMPORT_TRANSACTION_VERSION,
    AccountDataImportTransactionSafetyError,
    execute_account_data_import_transaction,
)
from .capacity import (
    OnboardingCapacityPaused,
    enforce_new_user_onboarding_capacity,
    validate_capacity_configuration,
)
from .database import database_readiness, get_session, init_db
from .data_growth import (
    DataGrowthAdmissionRejected,
    create_food_log_with_subject_budget,
)
from .inactive_account_notice import cancel_inactive_account_notices_for_activity
from .locales import resolve_locale
from .models import (
    AccountDataImportReceiptDB,
    AuthSessionDB,
    AuthorizationCodeDB,
    BridgeAuthNonceDB,
    CalorieAppUserDB,
    ExternalIdentityDB,
    FoodLogDB,
    InactiveAccountNoticeDB,
    OriginLoginHandoffDB,
)
from .request_limits import RequestBodyLimitMiddleware
from .route_rate_limiter import (
    DatabaseBackedRouteRateLimiter,
    RouteRateLimitMiddleware,
)
from .source_admission import AdapterAdmissionRejected
from .schemas import (
    AccountErasureRequest,
    AccountErasureResponse,
    AccountDataImportResponse,
    AccountDataExportResponse,
    AccountExportAccount,
    AccountExportAuthSession,
    AccountExportExternalIdentity,
    AccountExportInactiveAccountNotice,
    AccountExportImportReceipt,
    AccountExportLoginHandoff,
    CurrentUserResponse,
    FoodLog,
    FoodLogCreate,
    IdentityCallbackResponse,
    FoodSearchResponse,
    IdentityCallbackRequest,
    IdentityClaimsResponse,
    IdentityLoginStatusRequest,
    IdentityLoginStatusResponse,
    IdentityStartRequest,
    IdentityStateValidationRequest,
    IdentityStateValidationResponse,
    IdentityStartResponse,
    LogoutResponse,
)
from .services.identity import (
    IdentityStartAdmissionRejected,
    claim_origin_login_handoff,
    cleanup_pending_login_states,
    complete_origin_login_handoff,
    consume_pending_login_state,
    create_limited_login_transaction,
    fail_origin_login_handoff,
    get_pending_login_locale,
    get_or_create_user_from_external_identity,
    restore_pending_login_state_after_transient_failure,
    validate_pending_login_state,
    validate_identity_start_admission_configuration,
    validate_origin_login_handoff,
)
from .services.open_food_facts import search_food_products

logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME = "calorieapp_session"
SESSION_TOKEN_BYTES = 48
SESSION_ABSOLUTE_LIFETIME_SECONDS = 8 * 60 * 60
SESSION_IDLE_LIFETIME_SECONDS = 30 * 60
BRIDGE_STATE_VALIDATE_CONTEXT = "login_state_validate"

# Read configuration from environment
_CORS_ORIGINS_STR = os.getenv("CORS_ORIGINS", "http://localhost:3000")
_CORS_ORIGINS = [origin.strip() for origin in _CORS_ORIGINS_STR.split(",") if origin.strip()]

_WORDPRESS_URL = os.getenv("WORDPRESS_URL", "https://calorietoken.net")
_WORDPRESS_BRIDGE_SECRET = os.getenv("WORDPRESS_BRIDGE_SECRET", "")
_CALORIEAPP_CLIENT_ID = os.getenv("CALORIEAPP_CLIENT_ID", "calorieapp-backend")
_WORDPRESS_BRIDGE_AUTHORIZE_URL = os.getenv(
    "WORDPRESS_BRIDGE_AUTHORIZE_URL",
    f"{_WORDPRESS_URL.rstrip('/')}/?calorieapp_authorize=1",
)
_WORDPRESS_BRIDGE_EXCHANGE_URL = os.getenv(
    "WORDPRESS_BRIDGE_EXCHANGE_URL",
    f"{_WORDPRESS_URL.rstrip('/')}/index.php/wp-json/calorieapp/v1/exchange",
)
_CALORIEAPP_POST_LOGIN_REDIRECT = os.getenv("CALORIEAPP_POST_LOGIN_REDIRECT", "/")
_LOGIN_STATE_LIFETIME_SECONDS = int(os.getenv("LOGIN_STATE_LIFETIME_SECONDS", "300"))
_SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "true").lower() in {"1", "true", "yes"}
_SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "lax").strip().lower()
_CALORIEAPP_ENV_RAW = os.getenv("CALORIEAPP_ENV")
_CALORIEAPP_ENV = _CALORIEAPP_ENV_RAW.strip().lower() if _CALORIEAPP_ENV_RAW and _CALORIEAPP_ENV_RAW.strip() else None
_BRIDGE_AUTH_MAX_AGE_SECONDS = int(os.getenv("BRIDGE_AUTH_MAX_AGE_SECONDS", "300"))
_BRIDGE_AUTH_MAX_FUTURE_SECONDS = int(os.getenv("BRIDGE_AUTH_MAX_FUTURE_SECONDS", "30"))
_BRIDGE_NONCE_RETENTION_SECONDS = int(
    os.getenv(
        "BRIDGE_NONCE_RETENTION_SECONDS",
        str(max(_BRIDGE_AUTH_MAX_AGE_SECONDS + _BRIDGE_AUTH_MAX_FUTURE_SECONDS, 330)),
    )
)
_ACCOUNT_ERASURE_ENABLED = os.getenv("ACCOUNT_ERASURE_ENABLED", "false").lower() in {
    "1",
    "true",
    "yes",
}
_ACCOUNT_DATA_IMPORT_ENABLED = os.getenv(
    "ACCOUNT_DATA_IMPORT_ENABLED",
    "false",
).lower() in {"1", "true", "yes"}
_ACCOUNT_DATA_IMPORT_APPROVED_COMMIT_SHA = os.getenv(
    "ACCOUNT_DATA_IMPORT_APPROVED_COMMIT_SHA",
    "",
).strip()
_CALORIEAPP_RELEASE_COMMIT_SHA = os.getenv(
    "CALORIEAPP_RELEASE_COMMIT_SHA",
    "",
).strip()
_IDENTITY_PROVIDER = "wordpress_xumm"

if not _WORDPRESS_BRIDGE_SECRET:
    logger.warning(
        "WORDPRESS_BRIDGE_SECRET not set. "
        "Server-to-server identity exchange will not work."
    )


def _validate_session_cookie_security_configuration() -> None:
    if _SESSION_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
        raise RuntimeError("SESSION_COOKIE_SAMESITE must be lax, strict, or none")
    if _SESSION_COOKIE_SAMESITE == "none" and not _SESSION_COOKIE_SECURE:
        raise RuntimeError("SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true")
    if _SESSION_COOKIE_SECURE:
        return

    if _CALORIEAPP_ENV != "local":
        environment = "unset" if _CALORIEAPP_ENV is None else _CALORIEAPP_ENV
        raise RuntimeError(
            "SESSION_COOKIE_SECURE=false is only allowed when CALORIEAPP_ENV=local "
            f"(current={environment})"
        )


def _validate_cors_security_configuration() -> None:
    if not _CORS_ORIGINS:
        raise RuntimeError("CORS_ORIGINS must contain at least one explicit origin")

    seen: set[str] = set()
    for origin in _CORS_ORIGINS:
        if origin == "*":
            raise RuntimeError("CORS_ORIGINS cannot use '*' with credentialed requests")
        if origin in seen:
            raise RuntimeError(f"CORS_ORIGINS contains duplicate origin: {origin}")
        seen.add(origin)

        try:
            parsed = urlsplit(origin)
            parsed.port
        except ValueError as exc:
            raise RuntimeError(f"CORS_ORIGINS contains an invalid origin: {origin}") from exc
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise RuntimeError(f"CORS_ORIGINS contains an invalid origin: {origin}")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise RuntimeError(f"CORS_ORIGINS must contain origins only: {origin}")
        if parsed.path:
            raise RuntimeError(f"CORS_ORIGINS must not contain a path or trailing slash: {origin}")

        hostname = (parsed.hostname or "").lower()
        is_loopback = hostname in {"localhost", "127.0.0.1", "::1"}
        if parsed.scheme != "https" and not is_loopback:
            raise RuntimeError(
                "CORS_ORIGINS requires HTTPS except for localhost development origins: "
                f"{origin}"
            )


def _parse_secure_bridge_url(name: str, value: str):
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as exc:
        raise RuntimeError(f"{name} is not a valid URL") from exc

    if not parsed.hostname:
        raise RuntimeError(f"{name} must be an absolute URL")

    hostname = parsed.hostname.lower()
    is_local_loopback = hostname in {"localhost", "127.0.0.1", "::1"}

    if parsed.scheme != "https":
        if not (
            _CALORIEAPP_ENV == "local"
            and parsed.scheme == "http"
            and is_local_loopback
        ):
            raise RuntimeError(
                f"{name} must use HTTPS except for loopback URLs when CALORIEAPP_ENV=local"
            )

    if parsed.username or parsed.password or parsed.fragment:
        raise RuntimeError(f"{name} must not contain credentials or a fragment")
    return parsed, port


def _validate_identity_url_configuration() -> None:
    try:
        validate_identity_start_admission_configuration(
            _CALORIEAPP_CLIENT_ID,
            _LOGIN_STATE_LIFETIME_SECONDS,
        )
    except ValueError as exc:
        raise RuntimeError(str(exc)) from exc

    wordpress, wordpress_port = _parse_secure_bridge_url("WORDPRESS_URL", _WORDPRESS_URL)
    if wordpress.path not in {"", "/"} or wordpress.query:
        raise RuntimeError("WORDPRESS_URL must contain only the site origin")

    wordpress_origin = (wordpress.scheme, wordpress.hostname.lower(), wordpress_port)
    is_local_wordpress = (
        _CALORIEAPP_ENV == "local"
        and wordpress.scheme == "http"
        and wordpress.hostname.lower() in {"localhost", "127.0.0.1", "::1"}
    )

    for name, value in (
        ("WORDPRESS_BRIDGE_AUTHORIZE_URL", _WORDPRESS_BRIDGE_AUTHORIZE_URL),
        ("WORDPRESS_BRIDGE_EXCHANGE_URL", _WORDPRESS_BRIDGE_EXCHANGE_URL),
    ):
        parsed, port = _parse_secure_bridge_url(name, value)
        endpoint_origin = (parsed.scheme, parsed.hostname.lower(), port)
        if endpoint_origin != wordpress_origin:
            raise RuntimeError(f"{name} must use the same origin as WORDPRESS_URL")

        query_items = parse_qsl(parsed.query, keep_blank_values=True)

        if name == "WORDPRESS_BRIDGE_AUTHORIZE_URL" and parsed.query:
            if parsed.path not in {"", "/"} or query_items != [("calorieapp_authorize", "1")]:
                raise RuntimeError(
                    "WORDPRESS_BRIDGE_AUTHORIZE_URL query form must be exactly "
                    "/?calorieapp_authorize=1"
                )
            continue

        if name == "WORDPRESS_BRIDGE_EXCHANGE_URL" and parsed.query:
            if not is_local_wordpress:
                raise RuntimeError(
                    "WORDPRESS_BRIDGE_EXCHANGE_URL may use a rest_route query only for "
                    "loopback URLs when CALORIEAPP_ENV=local"
                )
            if parsed.path != "/index.php" or query_items != [("rest_route", "/calorieapp/v1/exchange")]:
                raise RuntimeError(
                    "WORDPRESS_BRIDGE_EXCHANGE_URL local query form must be exactly "
                    "/index.php?rest_route=/calorieapp/v1/exchange"
                )
            continue

        if parsed.query:
            raise RuntimeError(f"{name} contains an unsupported query string")
        if not parsed.path or parsed.path == "/":
            raise RuntimeError(f"{name} must contain a fixed endpoint path")

    redirect = _CALORIEAPP_POST_LOGIN_REDIRECT
    if (
        not redirect.startswith("/")
        or redirect.startswith("//")
        or "\\" in redirect
        or any(ord(character) < 32 for character in redirect)
    ):
        raise RuntimeError("CALORIEAPP_POST_LOGIN_REDIRECT must be a safe local app path")

    parsed_redirect = urlsplit(redirect)
    if parsed_redirect.scheme or parsed_redirect.netloc:
        raise RuntimeError("CALORIEAPP_POST_LOGIN_REDIRECT must be a safe local app path")


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create database tables on startup."""
    _validate_session_cookie_security_configuration()
    _validate_cors_security_configuration()
    _validate_identity_url_configuration()
    validate_capacity_configuration()
    init_db()
    logger.info("Database initialized")
    logger.info("CORS origins: %s", _CORS_ORIGINS)
    logger.info("WordPress URL: %s", _WORDPRESS_URL)
    yield


app = FastAPI(
    title="CalorieApp Backend API",
    description="V2 identity foundation + food and nutrition tracking",
    version="0.2.0",
    lifespan=lifespan,
)

_ROUTE_RATE_LIMITER = DatabaseBackedRouteRateLimiter(lambda: db_module.engine)


@app.middleware("http")
async def apply_response_security_headers(request: Request, call_next):
    """Apply API security headers and keep private responses out of caches."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"

    path = request.url.path
    if (
        path.startswith("/api/identity/")
        or path == "/logs"
        or path.startswith("/logs/")
        or path == "/log-food"
    ):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response

# Shared route admission runs before endpoint work. Body limits are added after
# it so malformed/oversize mutations are rejected without consuming shared
# route capacity. CORS remains outermost for approved browser origins.
app.add_middleware(RouteRateLimitMiddleware, limiter=_ROUTE_RATE_LIMITER)
app.add_middleware(RequestBodyLimitMiddleware)

# Enable credentials for session-based authentication
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,  # Changed to support session cookies
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# Dependency alias for cleaner function signatures.
DbSession = Annotated[Session, Depends(get_session)]


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _hash_session_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def _generate_session_token() -> str:
    return token_urlsafe(SESSION_TOKEN_BYTES)


def _cleanup_auth_sessions(session: Session) -> None:
    now = datetime.now(UTC)
    session.exec(
        delete(AuthSessionDB).where(
            (AuthSessionDB.expires_at < now) | (AuthSessionDB.revoked_at.is_not(None))
        )
    )
    session.commit()


def _cleanup_bridge_auth_nonces(session: Session) -> None:
    now = datetime.now(UTC)
    session.exec(delete(BridgeAuthNonceDB).where(BridgeAuthNonceDB.expires_at < now))
    session.commit()


def _hash_bridge_nonce(nonce: str) -> str:
    return sha256(nonce.encode("utf-8")).hexdigest()


def _is_valid_bridge_nonce(nonce: str) -> bool:
    if len(nonce) < 16 or len(nonce) > 255:
        return False
    return bool(re.fullmatch(r"[A-Za-z0-9._~-]+", nonce))


def _is_valid_bridge_signature(signature: str) -> bool:
    return bool(re.fullmatch(r"[0-9a-fA-F]{64}", signature))


def _bridge_auth_canonical_payload(
    *,
    client_id: str,
    timestamp: int,
    nonce: str,
    state: str,
) -> str:
    """Deterministic payload string for bridge HMAC verification.

    v1 format is canonical JSON with fixed logical field order and no
    insignificant whitespace:
    {"version":"v1","client_id":"...","timestamp":"...","nonce":"...","state":"..."}

    Rules:
    - field order is fixed exactly as shown above;
    - timestamp is serialized as a decimal string;
    - separators are exactly "," and ":" with no spaces;
    - ensure_ascii=False and UTF-8 encoding are used for signing bytes;
    - field values are signed as provided without value normalization.
    """
    # Build explicitly in fixed order so ordering is protocol-defined and not
    # dependent on dictionary insertion semantics.
    pieces = [
        '"version":"v1"',
        '"client_id":' + json.dumps(client_id, ensure_ascii=False, separators=(",", ":")),
        '"timestamp":' + json.dumps(str(timestamp), ensure_ascii=False, separators=(",", ":")),
        '"nonce":' + json.dumps(nonce, ensure_ascii=False, separators=(",", ":")),
        '"state":' + json.dumps(state, ensure_ascii=False, separators=(",", ":")),
    ]
    return "{" + ",".join(pieces) + "}"


def _bridge_auth_signature(payload: str, secret: str) -> str:
    return hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        "sha256",
    ).hexdigest()


def _reserve_bridge_auth_nonce(
    session: Session,
    *,
    client_id: str,
    nonce: str,
    context: str,
) -> bool:
    now = datetime.now(UTC)
    row = BridgeAuthNonceDB(
        client_id=client_id,
        nonce_hash=_hash_bridge_nonce(nonce),
        context=context,
        created_at=now,
        expires_at=now + timedelta(seconds=_BRIDGE_NONCE_RETENTION_SECONDS),
    )
    session.add(row)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return False
    return True


def _authenticate_bridge_state_validate_request(
    *,
    request: Request,
    session: Session,
    state: str,
) -> tuple[bool, str]:
    if not _WORDPRESS_BRIDGE_SECRET:
        return False, "missing_config"

    client_id = request.headers.get("x-calorieapp-client-id", "").strip()
    if not client_id:
        return False, "missing_client_id"
    if not compare_digest(client_id, _CALORIEAPP_CLIENT_ID):
        return False, "invalid_client_id"

    raw_timestamp = request.headers.get("x-calorieapp-timestamp", "").strip()
    if not raw_timestamp:
        return False, "missing_timestamp"
    try:
        timestamp = int(raw_timestamp)
    except ValueError:
        return False, "malformed_timestamp"

    now_ts = int(datetime.now(UTC).timestamp())
    if timestamp < now_ts - _BRIDGE_AUTH_MAX_AGE_SECONDS:
        return False, "stale_timestamp"
    if timestamp > now_ts + _BRIDGE_AUTH_MAX_FUTURE_SECONDS:
        return False, "future_timestamp"

    nonce = request.headers.get("x-calorieapp-nonce", "").strip()
    if not nonce:
        return False, "missing_nonce"
    if not _is_valid_bridge_nonce(nonce):
        return False, "malformed_nonce"

    signature = request.headers.get("x-calorieapp-signature", "").strip()
    if not signature:
        return False, "missing_signature"
    if not _is_valid_bridge_signature(signature):
        return False, "malformed_signature"

    canonical_payload = _bridge_auth_canonical_payload(
        client_id=client_id,
        timestamp=timestamp,
        nonce=nonce,
        state=state,
    )
    expected_signature = _bridge_auth_signature(canonical_payload, _WORDPRESS_BRIDGE_SECRET)
    if not compare_digest(signature.lower(), expected_signature):
        return False, "invalid_signature"

    _cleanup_bridge_auth_nonces(session)
    reserved = _reserve_bridge_auth_nonce(
        session,
        client_id=client_id,
        nonce=nonce,
        context=BRIDGE_STATE_VALIDATE_CONTEXT,
    )
    if not reserved:
        return False, "replayed_nonce"

    return True, "ok"


def _lookup_auth_session_by_token(
    session: Session,
    session_token: str,
) -> Optional[AuthSessionDB]:
    return session.exec(
        select(AuthSessionDB).where(
            AuthSessionDB.session_token_hash == _hash_session_token(session_token)
        )
    ).first()


def _revoke_auth_session(
    session: Session,
    auth_session: AuthSessionDB,
    *,
    replaced_by_session_id: Optional[str] = None,
) -> None:
    if auth_session.revoked_at is not None:
        return

    auth_session.revoked_at = datetime.now(UTC)
    if replaced_by_session_id:
        auth_session.replaced_by_session_id = replaced_by_session_id
    session.add(auth_session)


def _record_authenticated_activity(
    session: Session,
    user_id: str,
    observed_at: datetime,
) -> None:
    """Advance the durable account marker without allowing clock regression."""

    normalized_observed_at = (
        observed_at.astimezone(UTC).replace(tzinfo=None)
        if observed_at.tzinfo is not None
        else observed_at
    )
    session.exec(
        update(CalorieAppUserDB)
        .where(CalorieAppUserDB.id == user_id)
        .where(
            CalorieAppUserDB.last_authenticated_activity_at
            < normalized_observed_at
        )
        .values(last_authenticated_activity_at=normalized_observed_at)
        .execution_options(synchronize_session=False)
    )
    cancel_inactive_account_notices_for_activity(
        session,
        user_id=user_id,
        observed_at=normalized_observed_at,
    )


def _create_auth_session(
    session: Session,
    user_id: str,
    *,
    replaced_session: Optional[AuthSessionDB] = None,
) -> tuple[str, AuthSessionDB]:
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=SESSION_ABSOLUTE_LIFETIME_SECONDS)

    for _ in range(3):
        session_token = _generate_session_token()
        token_hash = _hash_session_token(session_token)
        existing = session.exec(
            select(AuthSessionDB).where(AuthSessionDB.session_token_hash == token_hash)
        ).first()
        if existing:
            continue

        auth_session = AuthSessionDB(
            session_token_hash=token_hash,
            calorieapp_user_id=user_id,
            created_at=now,
            last_seen_at=now,
            expires_at=expires_at,
        )
        session.add(auth_session)
        session.flush()

        if replaced_session is not None:
            _revoke_auth_session(
                session,
                replaced_session,
                replaced_by_session_id=auth_session.id,
            )

        _record_authenticated_activity(session, user_id, now)
        session.commit()
        session.refresh(auth_session)
        return session_token, auth_session

    raise RuntimeError("Unable to allocate unique session token")


def _set_auth_session_cookie(response: Response, session_token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=_SESSION_COOKIE_SECURE,
        samesite=_SESSION_COOKIE_SAMESITE,
        path="/",
        max_age=SESSION_ABSOLUTE_LIFETIME_SECONDS,
    )


def _resolve_auth_session(
    session: Session,
    session_token: str,
) -> tuple[Optional[CalorieAppUserDB], Optional[AuthSessionDB], str]:
    auth_session = _lookup_auth_session_by_token(session, session_token)
    if auth_session is None:
        return None, None, "unknown"

    now = datetime.now(UTC)
    if auth_session.revoked_at is not None:
        return None, auth_session, "revoked"

    expires_at = _as_utc(auth_session.expires_at)
    if now > expires_at:
        return None, auth_session, "expired"

    last_seen_at = _as_utc(auth_session.last_seen_at)
    if now > last_seen_at + timedelta(seconds=SESSION_IDLE_LIFETIME_SECONDS):
        return None, auth_session, "idle_expired"

    user = session.get(CalorieAppUserDB, auth_session.calorieapp_user_id)
    if user is None:
        return None, auth_session, "user_not_found"

    auth_session.last_seen_at = now
    session.add(auth_session)
    _record_authenticated_activity(session, user.id, now)
    session.commit()
    session.refresh(user)

    return user, auth_session, "ok"


def get_current_user(
    session: DbSession,
    session_token: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> CalorieAppUserDB:
    """
    Get the currently authenticated user from session cookie.
    Raises 401 if not authenticated.
    """
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    _cleanup_auth_sessions(session)
    user, _, reason = _resolve_auth_session(session, session_token)
    if reason != "ok" or user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return user


def get_current_auth_session(
    session: DbSession,
    session_token: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> AuthSessionDB:
    """Resolve current session for operations that require revocation (logout)."""
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    _cleanup_auth_sessions(session)
    _, auth_session, reason = _resolve_auth_session(session, session_token)
    if reason != "ok" or auth_session is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return auth_session


CurrentUser = Annotated[CalorieAppUserDB, Depends(get_current_user)]
CurrentAuthSession = Annotated[AuthSessionDB, Depends(get_current_auth_session)]


def _is_valid_state_format(state: str) -> bool:
    if len(state) < 32 or len(state) > 255:
        return False
    return all(ch.isalnum() or ch in "-_.~" for ch in state)


def _build_wordpress_signin_url(state: str, locale: str) -> str:
    parsed = urlsplit(_WORDPRESS_BRIDGE_AUTHORIZE_URL)
    query_items = parse_qsl(parsed.query, keep_blank_values=True)
    query_items.append(("state", state))
    query_items.append(("locale", locale))
    bridge_authorize_url = urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            urlencode(query_items),
            parsed.fragment,
        )
    )
    return f"{_WORDPRESS_URL.rstrip('/')}/?xl-signin&redirect={quote_plus(bridge_authorize_url)}"


def _exchange_code_for_claims(code: str, state: str) -> IdentityClaimsResponse:
    if not _WORDPRESS_BRIDGE_SECRET:
        raise HTTPException(status_code=500, detail="WordPress bridge secret is not configured")

    try:
        response = httpx.post(
            _WORDPRESS_BRIDGE_EXCHANGE_URL,
            json={"code": code, "state": state},
            headers={
                "X-CalorieApp-Bridge-Secret": _WORDPRESS_BRIDGE_SECRET,
                "X-CalorieApp-Client-Id": _CALORIEAPP_CLIENT_ID,
            },
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        logger.warning("WordPress bridge exchange failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=502, detail="WordPress bridge exchange failed") from exc

    if response.status_code != 200:
        logger.warning("WordPress bridge rejected code exchange (status=%s)", response.status_code)
        raise HTTPException(status_code=400, detail="Authorization code exchange rejected")

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid bridge exchange response") from exc

    try:
        return IdentityClaimsResponse.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="Bridge identity claims were malformed") from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "calorieapp-backend"}


@app.get("/ready")
def ready() -> dict[str, str]:
    """Confirm that the database is reachable and exactly at schema head."""
    return {
        **database_readiness(),
        "service": "calorieapp-backend",
    }


# =========================================================================
# Identity Endpoints
# =========================================================================


@app.post("/api/identity/login/start", response_model=IdentityStartResponse)
def identity_login_start(
    request: Request,
    session: DbSession,
    payload: Optional[IdentityStartRequest] = None,
) -> IdentityStartResponse:
    """
    Start the login flow.

    Creates a high-entropy state, stores a pending login transaction,
    and returns the fixed WordPress XUMM signin URL that targets the bridge.
    """
    requested_locale = (
        payload.locale
        if payload is not None and payload.locale
        else request.headers.get("accept-language")
    )
    locale = resolve_locale(requested_locale)
    try:
        cleanup_pending_login_states(session)
        state, pending, browser_handoff_token = create_limited_login_transaction(
            session=session,
            client_id=_CALORIEAPP_CLIENT_ID,
            state_lifetime_seconds=_LOGIN_STATE_LIFETIME_SECONDS,
            post_login_redirect=_CALORIEAPP_POST_LOGIN_REDIRECT,
            locale=locale,
        )
    except IdentityStartAdmissionRejected as exc:
        logger.warning("Login start admission rejected (reason=%s)", exc.reason)
        raise HTTPException(
            status_code=exc.status_code,
            detail=(
                "Too many login attempts"
                if exc.status_code == 429
                else "Login admission temporarily unavailable"
            ),
            headers={
                "Retry-After": str(exc.retry_after_seconds),
                "Cache-Control": "no-store",
                "Pragma": "no-cache",
            },
        ) from exc
    except SQLAlchemyError as exc:
        session.rollback()
        logger.warning("Login start cleanup unavailable")
        raise HTTPException(
            status_code=503,
            detail="Login admission temporarily unavailable",
            headers={
                "Retry-After": "5",
                "Cache-Control": "no-store",
                "Pragma": "no-cache",
            },
        ) from exc
    wordpress_signin_url = _build_wordpress_signin_url(state, locale)

    logger.info("Login flow started (expires_at=%s)", pending.expires_at)

    return IdentityStartResponse(
        state=state,
        expires_at=pending.expires_at,
        wordpress_signin_url=wordpress_signin_url,
        browser_handoff_token=browser_handoff_token,
        locale=locale,
    )


@app.post("/api/identity/login/state/validate", response_model=IdentityStateValidationResponse)
def identity_validate_pending_state(
    request: Request,
    payload: IdentityStateValidationRequest,
    session: DbSession,
) -> IdentityStateValidationResponse:
    """Server-to-server endpoint for bridge validation of pending login state."""
    authenticated, reason = _authenticate_bridge_state_validate_request(
        request=request,
        session=session,
        state=payload.state,
    )
    if not authenticated:
        if reason == "missing_config":
            raise HTTPException(status_code=500, detail="Bridge authentication is not configured")
        if reason in {
            "missing_timestamp",
            "malformed_timestamp",
            "stale_timestamp",
            "future_timestamp",
            "missing_nonce",
            "malformed_nonce",
            "missing_signature",
            "malformed_signature",
            "replayed_nonce",
        }:
            raise HTTPException(status_code=400, detail="Bridge authentication failed")
        raise HTTPException(status_code=403, detail="Bridge authentication failed")

    cleanup_pending_login_states(session)
    is_valid, reason, pending = validate_pending_login_state(session, payload.state)
    if not is_valid or pending is None:
        if reason == "expired":
            raise HTTPException(status_code=400, detail="Login state expired")
        if reason == "consumed":
            raise HTTPException(status_code=400, detail="Login state already consumed")
        raise HTTPException(status_code=400, detail="Unknown login state")

    return IdentityStateValidationResponse(
        valid=True,
        expires_at=pending.expires_at,
        locale=get_pending_login_locale(session, payload.state),
    )


@app.post("/api/identity/callback", response_model=IdentityCallbackResponse)
def identity_callback(
    payload: IdentityCallbackRequest,
    session: DbSession,
    request: Request,
    response: Response,
) -> IdentityCallbackResponse:
    """
    Browser callback contract: code + state only.

    Backend atomically reserves the pending state, exchanges code with the
    WordPress bridge, restores the state only for transient bridge failures,
    resolves/creates CalorieApp user identity, and issues the session cookie.
    """
    code = payload.code.strip()
    state = payload.state.strip()

    if not code or not state or not _is_valid_state_format(state):
        raise HTTPException(status_code=400, detail="code and state are required")

    cleanup_pending_login_states(session)
    locale = get_pending_login_locale(session, state)
    consumed, reason = consume_pending_login_state(session, state)
    if not consumed:
        if reason == "expired":
            raise HTTPException(status_code=400, detail="Login state expired")
        if reason == "consumed":
            raise HTTPException(status_code=400, detail="Login state already consumed")
        raise HTTPException(status_code=400, detail="Unknown login state")

    try:
        claims = _exchange_code_for_claims(code=code, state=state)
    except HTTPException as exc:
        if exc.status_code in {502, 503, 504}:
            restored = restore_pending_login_state_after_transient_failure(session, state)
            if not restored:
                fail_origin_login_handoff(session, state)
            raise
        fail_origin_login_handoff(session, state)
        raise
    except Exception:
        fail_origin_login_handoff(session, state)
        raise

    try:
        user, created = get_or_create_user_from_external_identity(
            session=session,
            provider=_IDENTITY_PROVIDER,
            external_subject=claims.external_subject,
            xrpl_address=claims.xrpl_address,
            new_user_guard=enforce_new_user_onboarding_capacity,
        )
    except OnboardingCapacityPaused as exc:
        fail_origin_login_handoff(session, state)
        raise HTTPException(
            status_code=503,
            detail="New account onboarding is temporarily paused",
            headers={"Retry-After": "3600"},
        ) from exc
    except Exception:
        fail_origin_login_handoff(session, state)
        raise

    if not complete_origin_login_handoff(session, state, user.id):
        logger.warning("Origin browser handoff could not be completed")

    _cleanup_auth_sessions(session)
    replaced_session: Optional[AuthSessionDB] = None
    existing_token = request.cookies.get(SESSION_COOKIE_NAME)
    if existing_token:
        replaced_session = _lookup_auth_session_by_token(session, existing_token)

    session_token, _ = _create_auth_session(
        session=session,
        user_id=user.id,
        replaced_session=replaced_session,
    )

    _set_auth_session_cookie(response, session_token)

    logger.info("Identity callback succeeded (created=%s)", created)

    return IdentityCallbackResponse(
        user_id=user.id,
        created=created,
        redirect_to=_CALORIEAPP_POST_LOGIN_REDIRECT,
        locale=locale,
    )


@app.post("/api/identity/login/status", response_model=IdentityLoginStatusResponse)
def identity_login_status(
    payload: IdentityLoginStatusRequest,
    session: DbSession,
    request: Request,
    response: Response,
) -> IdentityLoginStatusResponse:
    """Let only the browser that started login claim the completed identity."""
    state = payload.state.strip()
    handoff_token = payload.browser_handoff_token.strip()
    if not _is_valid_state_format(state) or not _is_valid_state_format(handoff_token):
        raise HTTPException(status_code=400, detail="Invalid login status proof")

    cleanup_pending_login_states(session)
    locale = get_pending_login_locale(session, state)
    valid, status, existing = validate_origin_login_handoff(
        session,
        state,
        handoff_token,
    )
    if not valid:
        if status == "expired":
            raise HTTPException(status_code=410, detail="Login handoff expired")
        raise HTTPException(status_code=404, detail="Login handoff not found")

    if status == "pending":
        return IdentityLoginStatusResponse(status="pending", locale=locale)
    if status == "failed":
        return IdentityLoginStatusResponse(status="failed", locale=locale)

    if status == "claimed" and existing is not None and existing.calorieapp_user_id:
        existing_token = request.cookies.get(SESSION_COOKIE_NAME)
        if existing_token:
            existing_user, _, reason = _resolve_auth_session(session, existing_token)
            if reason == "ok" and existing_user is not None and existing_user.id == existing.calorieapp_user_id:
                return IdentityLoginStatusResponse(
                    status="authenticated",
                    redirect_to=_CALORIEAPP_POST_LOGIN_REDIRECT,
                    locale=locale,
                )
        raise HTTPException(status_code=409, detail="Login handoff already claimed")

    claimed, claim_status, handoff = claim_origin_login_handoff(
        session,
        state,
        handoff_token,
    )
    if not claimed or handoff is None or not handoff.calorieapp_user_id:
        if claim_status == "pending":
            return IdentityLoginStatusResponse(status="pending", locale=locale)
        if claim_status == "failed":
            return IdentityLoginStatusResponse(status="failed", locale=locale)
        raise HTTPException(status_code=409, detail="Login handoff already claimed")

    _cleanup_auth_sessions(session)
    replaced_session: Optional[AuthSessionDB] = None
    existing_token = request.cookies.get(SESSION_COOKIE_NAME)
    if existing_token:
        existing_user, current_session, reason = _resolve_auth_session(session, existing_token)
        if reason == "ok" and existing_user is not None and existing_user.id == handoff.calorieapp_user_id:
            return IdentityLoginStatusResponse(
                status="authenticated",
                redirect_to=_CALORIEAPP_POST_LOGIN_REDIRECT,
                locale=locale,
            )
        replaced_session = current_session

    session_token, _ = _create_auth_session(
        session=session,
        user_id=handoff.calorieapp_user_id,
        replaced_session=replaced_session,
    )
    _set_auth_session_cookie(response, session_token)

    return IdentityLoginStatusResponse(
        status="authenticated",
        redirect_to=_CALORIEAPP_POST_LOGIN_REDIRECT,
        locale=locale,
    )


@app.get("/api/identity/me", response_model=CurrentUserResponse)
def identity_me(
    current_user: CurrentUser,
) -> CurrentUserResponse:
    """
    Get current authenticated user information.

    Requires valid session cookie.
    """
    return CurrentUserResponse(
        user_id=current_user.id,
        created_at=current_user.created_at,
    )


@app.get("/api/identity/export", response_model=AccountDataExportResponse)
def identity_export(
    response: Response,
    session: DbSession,
    current_user: CurrentUser,
) -> AccountDataExportResponse:
    """Return a versioned private export of linked data without authentication secrets."""
    identities = session.exec(
        select(ExternalIdentityDB)
        .where(ExternalIdentityDB.calorieapp_user_id == current_user.id)
        .order_by(ExternalIdentityDB.created_at, ExternalIdentityDB.id)
    ).all()
    external_subjects = [identity.external_subject for identity in identities]

    # Authorization activity predates a direct internal-user foreign key. Refuse
    # export rather than returning another user's activity when a legacy subject is
    # ambiguously linked across providers or accounts.
    if external_subjects:
        ambiguous_identity = session.exec(
            select(ExternalIdentityDB).where(
                ExternalIdentityDB.external_subject.in_(external_subjects),
                ExternalIdentityDB.calorieapp_user_id != current_user.id,
            )
        ).first()
        if ambiguous_identity is not None:
            raise HTTPException(
                status_code=409,
                detail="Account identity requires operator review before export",
            )

    food_logs = session.exec(
        select(FoodLogDB)
        .where(FoodLogDB.owner_id == current_user.id)
        .order_by(FoodLogDB.created_at, FoodLogDB.id)
    ).all()
    auth_sessions = session.exec(
        select(AuthSessionDB)
        .where(AuthSessionDB.calorieapp_user_id == current_user.id)
        .order_by(AuthSessionDB.created_at, AuthSessionDB.id)
    ).all()
    handoffs = session.exec(
        select(OriginLoginHandoffDB)
        .where(OriginLoginHandoffDB.calorieapp_user_id == current_user.id)
        .order_by(OriginLoginHandoffDB.created_at, OriginLoginHandoffDB.id)
    ).all()
    inactive_account_notices = session.exec(
        select(InactiveAccountNoticeDB)
        .where(InactiveAccountNoticeDB.calorieapp_user_id == current_user.id)
        .order_by(
            InactiveAccountNoticeDB.activity_anchor_at,
            InactiveAccountNoticeDB.id,
        )
    ).all()
    import_receipts = session.exec(
        select(AccountDataImportReceiptDB)
        .where(AccountDataImportReceiptDB.target_account_id == current_user.id)
        .order_by(
            AccountDataImportReceiptDB.created_at,
            AccountDataImportReceiptDB.id,
        )
    ).all()

    response.headers["Content-Disposition"] = (
        'attachment; filename="calorieapp-account-data-v2.json"'
    )

    return AccountDataExportResponse(
        export_version="calorieapp-account-data-v2",
        exported_at=datetime.now(UTC),
        account=AccountExportAccount(
            user_id=current_user.id,
            status=current_user.status,
            created_at=current_user.created_at,
            updated_at=current_user.updated_at,
            last_authenticated_activity_at=(
                current_user.last_authenticated_activity_at
            ),
        ),
        external_identities=[
            AccountExportExternalIdentity(
                provider=identity.provider,
                external_subject=identity.external_subject,
                xrpl_address=identity.xrpl_address,
                created_at=identity.created_at,
                last_verified_at=identity.last_verified_at,
            )
            for identity in identities
        ],
        food_logs=[FoodLog.model_validate(entry.model_dump()) for entry in food_logs],
        authentication_sessions=[
            AccountExportAuthSession(
                created_at=auth_session.created_at,
                last_seen_at=auth_session.last_seen_at,
                expires_at=auth_session.expires_at,
                revoked_at=auth_session.revoked_at,
            )
            for auth_session in auth_sessions
        ],
        # Legacy authorization rows have only a subject, not direct internal-user
        # and provider ownership. Preserve the v1 field while withholding rows
        # until a migration can prove ownership without inference.
        authorization_events=[],
        login_handoffs=[
            AccountExportLoginHandoff(
                status=handoff.status,
                created_at=handoff.created_at,
                expires_at=handoff.expires_at,
                completed_at=handoff.completed_at,
                claimed_at=handoff.claimed_at,
                failure_code=handoff.failure_code,
            )
            for handoff in handoffs
        ],
        inactive_account_notices=[
            AccountExportInactiveAccountNotice(
                status=notice.status,
                activity_anchor_at=notice.activity_anchor_at,
                notice_window_started_at=notice.notice_window_started_at,
                retention_due_at=notice.retention_due_at,
                delivered_at=notice.delivered_at,
                delivery_channel=notice.delivery_channel,
                cancelled_at=notice.cancelled_at,
                recorded_at=notice.recorded_at,
            )
            for notice in inactive_account_notices
        ],
        account_import_receipts=[
            AccountExportImportReceipt(
                imported_at=receipt.created_at,
                food_log_count=receipt.food_log_count,
                source_export_version=receipt.export_version,
                import_plan_version=receipt.plan_version,
            )
            for receipt in import_receipts
        ],
        excluded_security_fields=[
            "authorization_code_hash",
            "authorization_state",
            "login_session_id",
            "session_token_hash",
            "handoff_state_hash",
            "handoff_token_hash",
            "notice_delivery_evidence_digest",
            "private_import_digest",
        ],
    )


@app.post("/api/identity/import", response_model=AccountDataImportResponse)
async def identity_import(
    request: Request,
    session: DbSession,
    current_user: CurrentUser,
    source_account_confirmation: Annotated[
        Optional[str],
        Header(alias="X-CalorieApp-Import-Source-Account"),
    ] = None,
    target_account_confirmation: Annotated[
        Optional[str],
        Header(alias="X-CalorieApp-Import-Target-Account"),
    ] = None,
    acknowledgement: Annotated[
        Optional[str],
        Header(alias="X-CalorieApp-Import-Acknowledgement"),
    ] = None,
    request_purpose: Annotated[
        Optional[str],
        Header(alias="X-CalorieApp-Request"),
    ] = None,
) -> AccountDataImportResponse:
    """Import private food history into one authenticated clean account.

    This route remains disabled by default, rejects production, and is bound
    to one exact reviewed deployment commit. The request body is the original
    export JSON so duplicate-key and byte-boundary checks remain effective.
    """

    try:
        approval_reference = require_account_data_import_release_gate(
            enabled=_ACCOUNT_DATA_IMPORT_ENABLED,
            environment=_CALORIEAPP_ENV,
            approved_commit_sha=_ACCOUNT_DATA_IMPORT_APPROVED_COMMIT_SHA,
            running_commit_sha=_CALORIEAPP_RELEASE_COMMIT_SHA,
        )
    except AccountDataImportReleaseGateError:
        raise HTTPException(
            status_code=503,
            detail="Account data import is not enabled",
        ) from None

    if request_purpose != ACCOUNT_DATA_IMPORT_REQUEST_VALUE:
        raise HTTPException(status_code=403, detail="Import request was not allowed")
    if acknowledgement != ACCOUNT_DATA_IMPORT_ACKNOWLEDGEMENT:
        raise HTTPException(status_code=409, detail="Import acknowledgement did not match")
    if target_account_confirmation != current_user.id:
        raise HTTPException(status_code=409, detail="Account confirmation did not match")

    content_type = request.headers.get("content-type", "").partition(";")[0].strip().lower()
    if content_type != "application/json":
        raise HTTPException(
            status_code=415,
            detail="Account data import requires a JSON export",
        )

    payload = await request.body()
    try:
        plan = plan_account_data_import(
            payload,
            confirmed_source_user_id=source_account_confirmation or "",
            target_user_id=current_user.id,
        )
        result = execute_account_data_import_transaction(
            session,
            plan,
            authenticated_target_account_id=current_user.id,
            confirmed_target_account_id=target_account_confirmation,
            environment=_CALORIEAPP_ENV or "",
            execute=True,
            approval_reference=approval_reference,
        )
        session.commit()
    except AccountDataImportSafetyError:
        session.rollback()
        raise HTTPException(
            status_code=422,
            detail="Account data import did not match the reviewed export format",
        ) from None
    except AccountDataImportTransactionSafetyError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Account data import could not be applied safely",
        ) from None
    except SQLAlchemyError:
        session.rollback()
        raise HTTPException(
            status_code=503,
            detail="Account data import is temporarily unavailable",
        ) from None

    logger.info("Authenticated account-data import committed")
    return AccountDataImportResponse(
        import_version=IMPORT_TRANSACTION_VERSION,
        status=(
            "imported"
            if result.action == "staged_insert"
            else "already_imported"
        ),
        imported_food_log_rows=result.staged_food_log_rows,
    )


@app.delete("/api/identity/account", response_model=AccountErasureResponse)
def identity_erase_account(
    payload: AccountErasureRequest,
    response: Response,
    session: DbSession,
    current_user: CurrentUser,
) -> AccountErasureResponse:
    """Erase one authenticated account from the primary store when explicitly enabled.

    The endpoint is disabled by default. Enabling it remains a human release decision
    after the recovery window, backup-erasure schedule, privacy notice and translated
    confirmation UI have been approved.
    """
    if not _ACCOUNT_ERASURE_ENABLED:
        raise HTTPException(status_code=503, detail="Account erasure is not enabled")

    if payload.confirm_user_id != current_user.id:
        raise HTTPException(status_code=409, detail="Account confirmation did not match")

    identities = session.exec(
        select(ExternalIdentityDB).where(
            ExternalIdentityDB.calorieapp_user_id == current_user.id
        )
    ).all()
    external_subjects = sorted({identity.external_subject for identity in identities})

    # Authorization activity predates direct internal-user and provider ownership.
    # Refuse erasure rather than assigning or deleting another user's legacy activity.
    if external_subjects:
        ambiguous_identity = session.exec(
            select(ExternalIdentityDB).where(
                ExternalIdentityDB.external_subject.in_(external_subjects),
                ExternalIdentityDB.calorieapp_user_id != current_user.id,
            )
        ).first()
        if ambiguous_identity is not None:
            raise HTTPException(
                status_code=409,
                detail="Account identity requires operator review before erasure",
            )

        legacy_authorization = session.exec(
            select(AuthorizationCodeDB).where(
                AuthorizationCodeDB.external_subject.in_(external_subjects)
            )
        ).first()
        if legacy_authorization is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Account authorization history requires operator review "
                    "before erasure"
                ),
            )

    try:
        session.exec(delete(FoodLogDB).where(FoodLogDB.owner_id == current_user.id))
        session.exec(
            delete(AccountDataImportReceiptDB).where(
                AccountDataImportReceiptDB.target_account_id == current_user.id
            )
        )
        session.exec(
            delete(InactiveAccountNoticeDB).where(
                InactiveAccountNoticeDB.calorieapp_user_id == current_user.id
            )
        )
        session.exec(
            delete(OriginLoginHandoffDB).where(
                OriginLoginHandoffDB.calorieapp_user_id == current_user.id
            )
        )

        # Break both outgoing and incoming self-references before removing every
        # session for the account. An older session cookie can belong to another
        # account while pointing at the replacement session created after login.
        auth_sessions = session.exec(
            select(AuthSessionDB).where(
                AuthSessionDB.calorieapp_user_id == current_user.id
            )
        ).all()
        auth_session_ids = [
            auth_session.id
            for auth_session in auth_sessions
            if auth_session.id is not None
        ]
        inbound_references = (
            session.exec(
                select(AuthSessionDB).where(
                    AuthSessionDB.replaced_by_session_id.in_(auth_session_ids)
                )
            ).all()
            if auth_session_ids
            else []
        )
        for inbound_reference in inbound_references:
            inbound_reference.replaced_by_session_id = None
            session.add(inbound_reference)
        for auth_session in auth_sessions:
            auth_session.replaced_by_session_id = None
            session.add(auth_session)
        session.flush()
        session.exec(
            delete(AuthSessionDB).where(
                AuthSessionDB.calorieapp_user_id == current_user.id
            )
        )

        session.exec(
            delete(ExternalIdentityDB).where(
                ExternalIdentityDB.calorieapp_user_id == current_user.id
            )
        )
        session.exec(
            delete(CalorieAppUserDB).where(CalorieAppUserDB.id == current_user.id)
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        domain=None,
        secure=_SESSION_COOKIE_SECURE,
        httponly=True,
        samesite=_SESSION_COOKIE_SAMESITE,
    )
    logger.info("Authenticated account erased from primary store")
    return AccountErasureResponse(status="erased")


@app.post("/api/identity/logout", response_model=LogoutResponse)
def identity_logout(
    response: Response,
    session: DbSession,
    current_auth_session: CurrentAuthSession,
    current_user: CurrentUser,
) -> LogoutResponse:
    """
    Logout: invalidate session cookie.

    Does not log out of WordPress/XUMM.
    """
    _revoke_auth_session(session, current_auth_session)
    session.commit()

    # Clear the session cookie
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        domain=None,
        secure=_SESSION_COOKIE_SECURE,
        httponly=True,
        samesite=_SESSION_COOKIE_SAMESITE,
    )

    logger.info("User logged out")

    return LogoutResponse(message="Logged out successfully")


# =========================================================================
# Food Log Endpoints (Require Authentication)
# =========================================================================


@app.post("/log-food", response_model=FoodLog)
def log_food(
    payload: FoodLogCreate,
    session: DbSession,
    current_user: CurrentUser,
) -> FoodLog:
    """
    Persist a food log entry. Requires authentication.
    Entry is associated with the current user.
    """
    nutri_score = payload.nutri_score.strip().upper() if payload.nutri_score else None
    portion_percentage = payload.portion_percentage if payload.portion_percentage is not None else 100.0
    entry = FoodLogDB(
        product_name=payload.product_name,
        calories=payload.calories,
        protein=payload.protein,
        fat=payload.fat,
        carbohydrates=payload.carbohydrates,
        portion_percentage=portion_percentage,
        barcode=payload.barcode,
        image_url=payload.image_url,
        brand=payload.brand,
        serving_size=payload.serving_size,
        nutri_score=nutri_score,
        created_at=datetime.now(UTC),
        owner_id=current_user.id,
    )
    try:
        create_food_log_with_subject_budget(session, entry)
    except DataGrowthAdmissionRejected as exc:
        logger.warning("Food log growth admission rejected (reason=%s)", exc.reason)
        headers = None
        if exc.retry_after_seconds is not None:
            headers = {"Retry-After": str(exc.retry_after_seconds)}
        raise HTTPException(
            status_code=exc.status_code,
            detail=(
                "Food log storage budget reached"
                if exc.status_code == 409
                else "Food log storage admission temporarily unavailable"
            ),
            headers=headers,
        ) from exc
    logger.info("Food item logged")
    return FoodLog.model_validate(entry.model_dump())


@app.get("/logs", response_model=list[FoodLog])
def get_logs(
    session: DbSession,
    current_user: CurrentUser,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[FoodLog]:
    """
    Return logged food items for the current user, newest first.
    Requires authentication.

    Legacy V1.2 records with owner_id=NULL are intentionally excluded from
    normal user queries. They remain in the database for migration/admin review,
    but are not treated as visible user food logs because ownership is not known.
    """
    entries = session.exec(
        select(FoodLogDB)
        .where(FoodLogDB.owner_id == current_user.id)
        .order_by(FoodLogDB.id.desc())
        .limit(limit)
    ).all()
    logger.info("Returning logged food items (count=%s)", len(entries))
    return [FoodLog.model_validate(e.model_dump()) for e in entries]


@app.delete("/logs/{log_id}")
def delete_log(
    log_id: int,
    session: DbSession,
    current_user: CurrentUser,
) -> dict[str, int]:
    """
    Delete one logged food entry by id.
    User can only delete their own entries.
    """
    entry = session.get(FoodLogDB, log_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Log entry not found")

    if entry.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's log entry")

    session.delete(entry)
    session.commit()
    logger.info("Food log entry deleted")
    return {"deleted_id": log_id}


@app.delete("/logs")
def delete_all_logs(
    session: DbSession,
    current_user: CurrentUser,
) -> dict[str, int]:
    """
    Delete all logged food entries for the current user.
    Requires authentication.
    """
    entries = session.exec(
        select(FoodLogDB).where(FoodLogDB.owner_id == current_user.id)
    ).all()
    deleted_count = len(entries)
    for entry in entries:
        session.delete(entry)
    session.commit()
    logger.info("All food logs deleted (count=%s)", deleted_count)
    return {"deleted_count": deleted_count}


@app.get("/search-food", response_model=FoodSearchResponse)
async def search_food(q: str = Query(..., min_length=1, max_length=120)) -> FoodSearchResponse:
    query = q.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Search query must contain visible characters")

    try:
        results = await search_food_products(query)
    except AdapterAdmissionRejected as exc:
        logger.warning(
            "Open Food Facts admission rejected (reason=%s)",
            exc.reason,
        )
        raise HTTPException(
            status_code=exc.status_code,
            detail=(
                "Food search rate limit reached"
                if exc.status_code == 429
                else "Food search temporarily unavailable"
            ),
            headers={
                "Retry-After": str(exc.retry_after_seconds),
                "Cache-Control": "no-store",
                "Pragma": "no-cache",
            },
        ) from exc
    except HTTPError as exc:
        logger.warning("Open Food Facts search failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Open Food Facts request failed") from exc

    logger.info("Food search completed (results=%s)", len(results))
    return FoodSearchResponse(query=query, results=results)
