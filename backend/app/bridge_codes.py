"""Short-lived codes issued for authenticated WordPress identity assertions.

Uses the existing authorization-code table and origin-browser callback. No
session is created by the bridge request; only the callback may consume it.
"""

import json
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import compare_digest, token_urlsafe

from fastapi import HTTPException
from sqlalchemy import delete, update
from sqlmodel import Session, select

from .models import AuthorizationCodeDB, PendingLoginStateDB
from .schemas import BridgeCodeRequest, BridgeCodeResponse, IdentityClaimsResponse
from .services.identity import get_pending_login_locale, hash_login_state

BACKEND_CODE_PREFIX = "cb1."
BRIDGE_CODE_CONTEXT = "issue_login_code_v1"
BACKEND_CODE_RECORD_PREFIX = "bridge-code:"


def bridge_code_canonical_payload(
    *, client_id: str, timestamp: int, nonce: str, payload: BridgeCodeRequest
) -> str:
    # Fixed field order, UTF-8, no whitespace; mirrored by WordPress.
    return json.dumps(
        {
            "version": "v2",
            "purpose": BRIDGE_CODE_CONTEXT,
            "client_id": client_id,
            "timestamp": str(timestamp),
            "nonce": nonce,
            "state": payload.state,
            "external_subject": payload.external_subject,
            "xrpl_address": payload.xrpl_address,
            "locale": payload.locale,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )


def issue_bridge_code(
    session: Session, payload: BridgeCodeRequest, *, client_id: str
) -> BridgeCodeResponse:
    now = datetime.now(UTC)
    state_hash = hash_login_state(payload.state)
    # Expire only this transport's cache records, in a bounded batch. Retain
    # all rows for an unexpired state so its three-code allowance never resets.
    live_state = (
        select(PendingLoginStateDB.id)
        .where(PendingLoginStateDB.state_hash == AuthorizationCodeDB.state)
        .where(PendingLoginStateDB.expires_at >= now)
        .exists()
    )
    expired_ids = session.exec(
        select(AuthorizationCodeDB.id)
        .where(AuthorizationCodeDB.login_session_id.startswith(BACKEND_CODE_RECORD_PREFIX))
        .where(AuthorizationCodeDB.expires_at < now)
        .where(~live_state)
        .order_by(AuthorizationCodeDB.expires_at, AuthorizationCodeDB.id)
        .limit(200)
    ).all()
    if expired_ids:
        session.exec(delete(AuthorizationCodeDB).where(AuthorizationCodeDB.id.in_(expired_ids)))
    # Serialize issuance per login transaction on PostgreSQL. This also
    # serializes against the callback's atomic pending-state reservation.
    pending = session.exec(
        select(PendingLoginStateDB)
        .where(PendingLoginStateDB.state_hash == state_hash)
        .with_for_update()
    ).first()
    if (
        pending is None
        or pending.status != "pending"
        or pending.consumed_at is not None
        or pending.client_id != client_id
        or pending.expires_at.replace(tzinfo=UTC) <= now
    ):
        raise HTTPException(400, "Unknown, expired or consumed login state")
    if get_pending_login_locale(session, payload.state) != payload.locale:
        raise HTTPException(409, "Login locale mismatch")
    existing = session.exec(
        select(AuthorizationCodeDB.id).where(
            AuthorizationCodeDB.login_session_id == BACKEND_CODE_RECORD_PREFIX + pending.id
        )
    ).all()
    if len(existing) >= 3:
        raise HTTPException(429, "Authorization refresh limit reached")

    code = BACKEND_CODE_PREFIX + token_urlsafe(32)
    expires_at = min(pending.expires_at.replace(tzinfo=UTC), now + timedelta(seconds=60))
    row = AuthorizationCodeDB(
        code_hash=sha256(code.encode("utf-8")).hexdigest(),
        external_subject=payload.external_subject,
        xrpl_address=payload.xrpl_address,
        state=state_hash,
        login_session_id=BACKEND_CODE_RECORD_PREFIX + pending.id,
        created_at=now,
        expires_at=expires_at,
    )
    session.add(row)
    session.commit()
    return BridgeCodeResponse(code=code, expires_at=expires_at, jti=row.id, locale=payload.locale)


def consume_bridge_code(session: Session, *, code: str, state: str) -> IdentityClaimsResponse:
    now = datetime.now(UTC)
    row = session.exec(
        select(AuthorizationCodeDB).where(
            AuthorizationCodeDB.code_hash == sha256(code.encode("utf-8")).hexdigest()
        )
    ).first()
    if row is None or not compare_digest(row.state, hash_login_state(state)):
        raise HTTPException(400, "Authorization code exchange rejected")
    changed = session.exec(
        update(AuthorizationCodeDB)
        .where(AuthorizationCodeDB.id == row.id)
        .where(AuthorizationCodeDB.used_at.is_(None))
        .where(AuthorizationCodeDB.expires_at > now)
        .values(used_at=now)
        .execution_options(synchronize_session=False)
    ).rowcount
    if changed != 1:
        session.rollback()
        raise HTTPException(400, "Authorization code exchange rejected")
    claims = IdentityClaimsResponse(
        external_subject=row.external_subject,
        xrpl_address=row.xrpl_address,
        issued_at=row.created_at,
        expires_at=row.expires_at,
        jti=row.id,
    )
    session.commit()
    return claims
