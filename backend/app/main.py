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
from urllib.parse import quote_plus, urlencode

import httpx
from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from httpx import HTTPError
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .database import get_session, init_db
from .models import AuthSessionDB, BridgeAuthNonceDB, CalorieAppUserDB, FoodLogDB
from .schemas import (
    CurrentUserResponse,
    FoodLog,
    FoodLogCreate,
    IdentityCallbackResponse,
    FoodSearchResponse,
    IdentityCallbackRequest,
    IdentityClaimsResponse,
    IdentityStateValidationRequest,
    IdentityStateValidationResponse,
    IdentityStartResponse,
    LogoutResponse,
)
from .services.identity import (
    cleanup_pending_login_states,
    consume_pending_login_state,
    create_pending_login_state,
    get_or_create_user_from_external_identity,
    validate_pending_login_state,
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
    f"{_WORDPRESS_URL.rstrip('/')}/wp-json/calorieapp/v1/authorize",
)
_WORDPRESS_BRIDGE_EXCHANGE_URL = os.getenv(
    "WORDPRESS_BRIDGE_EXCHANGE_URL",
    f"{_WORDPRESS_URL.rstrip('/')}/wp-json/calorieapp/v1/exchange",
)
_CALORIEAPP_POST_LOGIN_REDIRECT = os.getenv("CALORIEAPP_POST_LOGIN_REDIRECT", "/dashboard")
_LOGIN_STATE_LIFETIME_SECONDS = int(os.getenv("LOGIN_STATE_LIFETIME_SECONDS", "300"))
_SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "true").lower() in {"1", "true", "yes"}
_BRIDGE_AUTH_MAX_AGE_SECONDS = int(os.getenv("BRIDGE_AUTH_MAX_AGE_SECONDS", "300"))
_BRIDGE_AUTH_MAX_FUTURE_SECONDS = int(os.getenv("BRIDGE_AUTH_MAX_FUTURE_SECONDS", "30"))
_BRIDGE_NONCE_RETENTION_SECONDS = int(
    os.getenv(
        "BRIDGE_NONCE_RETENTION_SECONDS",
        str(max(_BRIDGE_AUTH_MAX_AGE_SECONDS + _BRIDGE_AUTH_MAX_FUTURE_SECONDS, 330)),
    )
)
_IDENTITY_PROVIDER = "wordpress_xumm"

if not _WORDPRESS_BRIDGE_SECRET:
    logger.warning(
        "WORDPRESS_BRIDGE_SECRET not set. "
        "Server-to-server identity exchange will not work."
    )


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create database tables on startup."""
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

        session.commit()
        session.refresh(auth_session)
        return session_token, auth_session

    raise RuntimeError("Unable to allocate unique session token")


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
    session.commit()

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


def _build_wordpress_signin_url(state: str) -> str:
    bridge_authorize_url = f"{_WORDPRESS_BRIDGE_AUTHORIZE_URL}?{urlencode({'state': state})}"
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
        logger.warning("WordPress bridge exchange failed: %s", exc)
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
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Bridge identity claims were malformed") from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "calorieapp-backend"}


# =========================================================================
# Identity Endpoints
# =========================================================================


@app.post("/api/identity/login/start", response_model=IdentityStartResponse)
def identity_login_start(session: DbSession) -> IdentityStartResponse:
    """
    Start the login flow.

    Creates a high-entropy state, stores a pending login transaction,
    and returns the fixed WordPress XUMM signin URL that targets the bridge.
    """
    cleanup_pending_login_states(session)
    state, pending = create_pending_login_state(
        session=session,
        state_lifetime_seconds=_LOGIN_STATE_LIFETIME_SECONDS,
        post_login_redirect=_CALORIEAPP_POST_LOGIN_REDIRECT,
    )
    wordpress_signin_url = _build_wordpress_signin_url(state)

    logger.info(
        "Login flow started (state=%s expires_at=%s)",
        state[:12],
        pending.expires_at,
    )

    return IdentityStartResponse(
        state=state,
        expires_at=pending.expires_at,
        wordpress_signin_url=wordpress_signin_url,
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

    return IdentityStateValidationResponse(valid=True, expires_at=pending.expires_at)


@app.post("/api/identity/callback", response_model=IdentityCallbackResponse)
def identity_callback(
    payload: IdentityCallbackRequest,
    session: DbSession,
    request: Request,
    response: Response,
) -> IdentityCallbackResponse:
    """
    Browser callback contract: code + state only.

    Browser callback contract remains code + state only.
    Backend validates pending state, exchanges code with WordPress bridge,
    resolves/creates CalorieApp user identity, and issues CalorieApp session cookie.
    """
    code = payload.code.strip()
    state = payload.state.strip()

    if not code or not state or not _is_valid_state_format(state):
        raise HTTPException(status_code=400, detail="code and state are required")

    cleanup_pending_login_states(session)
    consumed, reason = consume_pending_login_state(session, state)
    if not consumed:
        if reason == "expired":
            raise HTTPException(status_code=400, detail="Login state expired")
        if reason == "consumed":
            raise HTTPException(status_code=400, detail="Login state already consumed")
        raise HTTPException(status_code=400, detail="Unknown login state")

    claims = _exchange_code_for_claims(code=code, state=state)

    user, created = get_or_create_user_from_external_identity(
        session=session,
        provider=_IDENTITY_PROVIDER,
        external_subject=claims.external_subject,
        xrpl_address=claims.xrpl_address,
    )

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

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=_SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
        max_age=SESSION_ABSOLUTE_LIFETIME_SECONDS,
    )

    logger.warning(
        "Identity callback success (state=%s user_id=%s created=%s code_length=%s)",
        state[:12],
        user.id,
        created,
        len(code),
    )

    return IdentityCallbackResponse(
        user_id=user.id,
        created=created,
        redirect_to=_CALORIEAPP_POST_LOGIN_REDIRECT,
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
        samesite="lax",
    )

    logger.info("User logged out (user_id=%s)", current_user.id)

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
    session.add(entry)
    session.commit()
    session.refresh(entry)
    logger.info(
        "Logged food item: %s (id=%s, owner=%s)",
        entry.product_name,
        entry.id,
        current_user.id,
    )
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
    logger.info("Returning %s logged food items for user=%s", len(entries), current_user.id)
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
    logger.info("Deleted food log entry id=%s (owner=%s)", log_id, current_user.id)
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
    logger.info("Deleted all food logs for user=%s (count=%s)", current_user.id, deleted_count)
    return {"deleted_count": deleted_count}


@app.get("/search-food", response_model=FoodSearchResponse)
async def search_food(q: str = Query(..., min_length=1, max_length=120)) -> FoodSearchResponse:
    try:
        results = await search_food_products(q)
    except HTTPError as exc:
        logger.warning("Open Food Facts search failed for query=%s: %s", q, exc)
        raise HTTPException(status_code=502, detail="Open Food Facts request failed") from exc

    logger.info("Food search query=%s returned %s results", q, len(results))
    return FoodSearchResponse(query=q, results=results)
