"""Read-only dependent-data preflight for one inactive-account candidate.

The preflight is internal and transaction-bound. It has no delete, commit,
endpoint, provider, queue, scheduler or production activation capability.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from .inactive_account_erasure_eligibility import (
    InactiveAccountErasureEligibilitySafetyError,
    lock_inactive_account_erasure_candidate,
)
from .models import (
    AuthSessionDB,
    AuthorizationCodeDB,
    ExternalIdentityDB,
    FoodLogDB,
    InactiveAccountNoticeDB,
    OriginLoginHandoffDB,
)


MAXIMUM_ROWS_PER_RELATION = 10_000
MAXIMUM_TOTAL_DELETE_ROWS = 20_000
MAXIMUM_SUBJECTS_PER_QUERY = 500


class InactiveAccountErasurePreflightSafetyError(RuntimeError):
    """Raised when a candidate cannot be planned safely and unambiguously."""


@dataclass(frozen=True, slots=True)
class InactiveAccountErasurePreflight:
    """Minimal internal deletion-shape counts for one locked candidate."""

    notice_id: str
    user_id: str
    evaluated_at: datetime
    food_log_rows: int
    external_identity_rows: int
    origin_login_handoff_rows: int
    auth_session_rows: int
    inactive_account_notice_rows: int
    inbound_session_reference_rows: int

    @property
    def total_delete_rows(self) -> int:
        return 1 + sum(
            (
                self.food_log_rows,
                self.external_identity_rows,
                self.origin_login_handoff_rows,
                self.auth_session_rows,
                self.inactive_account_notice_rows,
            )
        )


def _bounded_count(
    session: Session,
    model: Any,
    criterion: Any,
    *,
    relation: str,
) -> int:
    count = int(
        session.exec(
            select(sa.func.count()).select_from(model).where(criterion)
        ).one()
    )
    if count > MAXIMUM_ROWS_PER_RELATION:
        raise InactiveAccountErasurePreflightSafetyError(
            f"{relation} exceeds the single-account preflight limit"
        )
    return count


def _external_subjects(session: Session, user_id: str) -> list[str]:
    subjects = session.exec(
        select(ExternalIdentityDB.external_subject)
        .where(ExternalIdentityDB.calorieapp_user_id == user_id)
        .order_by(ExternalIdentityDB.id)
        .limit(MAXIMUM_ROWS_PER_RELATION + 1)
    ).all()
    if len(subjects) > MAXIMUM_ROWS_PER_RELATION:
        raise InactiveAccountErasurePreflightSafetyError(
            "externalidentity exceeds the single-account preflight limit"
        )
    return sorted(set(subjects))


def _subject_chunks(external_subjects: list[str]) -> Iterator[list[str]]:
    for offset in range(0, len(external_subjects), MAXIMUM_SUBJECTS_PER_QUERY):
        yield external_subjects[offset : offset + MAXIMUM_SUBJECTS_PER_QUERY]


def _require_unambiguous_identity_ownership(
    session: Session,
    user_id: str,
    external_subjects: list[str],
) -> None:
    if not external_subjects:
        return

    for subject_chunk in _subject_chunks(external_subjects):
        ambiguous_identity = session.exec(
            select(ExternalIdentityDB.id).where(
                ExternalIdentityDB.external_subject.in_(subject_chunk),
                ExternalIdentityDB.calorieapp_user_id != user_id,
            )
        ).first()
        if ambiguous_identity is not None:
            raise InactiveAccountErasurePreflightSafetyError(
                "account identity requires operator review before erasure"
            )

    for subject_chunk in _subject_chunks(external_subjects):
        legacy_authorization = session.exec(
            select(AuthorizationCodeDB.id).where(
                AuthorizationCodeDB.external_subject.in_(subject_chunk)
            )
        ).first()
        if legacy_authorization is not None:
            raise InactiveAccountErasurePreflightSafetyError(
                "account authorization history requires operator review before erasure"
            )


def preflight_inactive_account_erasure(
    session: Session,
    *,
    notice_id: str,
    as_of: datetime,
) -> InactiveAccountErasurePreflight | None:
    """Lock one eligible candidate and plan its bounded deletion shape.

    The returned counts are necessary safety evidence only. They never
    authorize erasure. The caller retains ownership of commit or rollback and
    must keep any future separately reviewed action in the same transaction.
    """

    try:
        candidate = lock_inactive_account_erasure_candidate(
            session,
            notice_id=notice_id,
            as_of=as_of,
        )
        if candidate is None:
            return None

        with session.no_autoflush:
            external_subjects = _external_subjects(session, candidate.user_id)
            _require_unambiguous_identity_ownership(
                session,
                candidate.user_id,
                external_subjects,
            )

            food_log_rows = _bounded_count(
                session,
                FoodLogDB,
                FoodLogDB.owner_id == candidate.user_id,
                relation="food_log",
            )
            external_identity_rows = _bounded_count(
                session,
                ExternalIdentityDB,
                ExternalIdentityDB.calorieapp_user_id == candidate.user_id,
                relation="externalidentity",
            )
            origin_login_handoff_rows = _bounded_count(
                session,
                OriginLoginHandoffDB,
                OriginLoginHandoffDB.calorieapp_user_id == candidate.user_id,
                relation="originloginhandoff",
            )
            auth_session_rows = _bounded_count(
                session,
                AuthSessionDB,
                AuthSessionDB.calorieapp_user_id == candidate.user_id,
                relation="authsession",
            )
            inactive_account_notice_rows = _bounded_count(
                session,
                InactiveAccountNoticeDB,
                InactiveAccountNoticeDB.calorieapp_user_id == candidate.user_id,
                relation="inactive_account_notice",
            )
            owned_session_ids = select(AuthSessionDB.id).where(
                AuthSessionDB.calorieapp_user_id == candidate.user_id
            )
            inbound_session_reference_rows = _bounded_count(
                session,
                AuthSessionDB,
                AuthSessionDB.replaced_by_session_id.in_(owned_session_ids),
                relation="inbound_authsession_reference",
            )

        result = InactiveAccountErasurePreflight(
            notice_id=candidate.notice_id,
            user_id=candidate.user_id,
            evaluated_at=candidate.evaluated_at,
            food_log_rows=food_log_rows,
            external_identity_rows=external_identity_rows,
            origin_login_handoff_rows=origin_login_handoff_rows,
            auth_session_rows=auth_session_rows,
            inactive_account_notice_rows=inactive_account_notice_rows,
            inbound_session_reference_rows=inbound_session_reference_rows,
        )
        if result.total_delete_rows > MAXIMUM_TOTAL_DELETE_ROWS:
            raise InactiveAccountErasurePreflightSafetyError(
                "candidate exceeds the total single-account preflight limit"
            )
        return result
    except InactiveAccountErasurePreflightSafetyError:
        raise
    except InactiveAccountErasureEligibilitySafetyError as exc:
        raise InactiveAccountErasurePreflightSafetyError(
            "inactive-account erasure eligibility is unavailable"
        ) from exc
    except SQLAlchemyError as exc:
        raise InactiveAccountErasurePreflightSafetyError(
            "inactive-account erasure preflight is unavailable"
        ) from exc
