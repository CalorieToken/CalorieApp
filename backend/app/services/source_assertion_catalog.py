"""Read-only provenance and licensing evidence for source assertions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlmodel import Session, select

from ..models import (
    FoodAttributeAssertionDB,
    FoodProductSourceLinkDB,
    FoodSourceDB,
    FoodSourceRecordDB,
)


@dataclass(frozen=True)
class LicensedAssertionEvidence:
    assertion_id: str
    food_product_id: str
    source_record_id: str
    source_key: str
    attribute_key: str
    value: str
    unit_or_value_type: str
    observed_or_effective_at: datetime
    verification_status: str
    verification_version: int
    supersedes_assertion_id: str | None
    match_method: str
    match_confidence: float
    link_review_status: str
    licence_id: str
    terms_reference: str
    attribution_text: str


def export_product_assertion_evidence(
    session: Session,
    *,
    food_product_id: str,
) -> tuple[LicensedAssertionEvidence, ...]:
    """Return every assertion separately with its own source reuse evidence."""

    if (
        not food_product_id.strip()
        or food_product_id != food_product_id.strip()
        or len(food_product_id) > 64
    ):
        raise ValueError("food_product_id must contain 1 to 64 characters")

    statement = (
        select(
            FoodAttributeAssertionDB,
            FoodProductSourceLinkDB,
            FoodSourceRecordDB,
            FoodSourceDB,
        )
        .join(
            FoodProductSourceLinkDB,
            (FoodProductSourceLinkDB.food_product_id
             == FoodAttributeAssertionDB.food_product_id)
            & (FoodProductSourceLinkDB.source_record_id
               == FoodAttributeAssertionDB.source_record_id),
        )
        .join(
            FoodSourceRecordDB,
            FoodSourceRecordDB.id == FoodAttributeAssertionDB.source_record_id,
        )
        .join(FoodSourceDB, FoodSourceDB.id == FoodSourceRecordDB.source_id)
        .where(FoodAttributeAssertionDB.food_product_id == food_product_id)
        .order_by(
            FoodAttributeAssertionDB.attribute_key,
            FoodSourceDB.source_key,
            FoodAttributeAssertionDB.observed_or_effective_at,
            FoodAttributeAssertionDB.id,
        )
    )
    rows = session.exec(statement).all()
    return tuple(
        LicensedAssertionEvidence(
            assertion_id=assertion.id,
            food_product_id=assertion.food_product_id,
            source_record_id=assertion.source_record_id,
            source_key=source.source_key,
            attribute_key=assertion.attribute_key,
            value=assertion.value,
            unit_or_value_type=assertion.unit_or_value_type,
            observed_or_effective_at=assertion.observed_or_effective_at,
            verification_status=assertion.verification_status,
            verification_version=assertion.verification_version,
            supersedes_assertion_id=assertion.supersedes_assertion_id,
            match_method=link.match_method,
            match_confidence=link.match_confidence,
            link_review_status=link.review_status,
            licence_id=source.licence_id,
            terms_reference=source.terms_reference,
            attribution_text=source.attribution_text,
        )
        for assertion, link, _, source in rows
    )
