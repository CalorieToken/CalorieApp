"""Owner-scoped diary pages and whole-period totals, without changing stored logs."""
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import and_, case, func
from sqlmodel import Session, select

from .models import FoodLogDB
from .schemas import FoodLog, FoodLogOverview


def food_log_overview(session: Session, owner_id: int, start: datetime | None,
                      end: datetime | None, before: int | None, limit: int) -> FoodLogOverview:
    if (start is None) != (end is None):
        raise HTTPException(422, "Supply both start and end, or neither")
    conditions = [FoodLogDB.owner_id == owner_id]
    if start is not None and end is not None:
        if start.utcoffset() is None or end.utcoffset() is None:
            raise HTTPException(422, "Diary boundaries must include a time zone")
        if end <= start or (end - start).total_seconds() > 32 * 86400:
            raise HTTPException(422, "Diary range must be positive and at most 32 days")
        # The existing table stores UTC in timezone-naive SQL DateTime columns.
        conditions += [FoodLogDB.created_at >= start.astimezone(UTC).replace(tzinfo=None),
                       FoodLogDB.created_at < end.astimezone(UTC).replace(tzinfo=None)]
    # New CalorieApp entries already carry enough bounded provenance to report
    # the two active discovery lanes without changing private stored rows:
    # OFF products retain their product barcode, while our fixed USDA lane uses
    # the exact FoodData Central brand prefix and intentionally has no barcode.
    # Anything that cannot be established from those fields remains "other";
    # it is never guessed into either source.
    open_food_facts = and_(
        FoodLogDB.barcode.is_not(None),
        func.length(func.trim(FoodLogDB.barcode)) > 0,
    )
    usda = and_(
        FoodLogDB.barcode.is_(None),
        func.lower(func.trim(func.coalesce(FoodLogDB.brand, ""))).like(
            "usda fooddata central · fdc %"
        ),
    )
    columns = [func.count(FoodLogDB.id)] + [
        func.coalesce(func.sum(getattr(FoodLogDB, key)), 0)
        for key in ("calories", "protein", "fat", "carbohydrates")
    ] + [func.coalesce(func.sum(case((and_(open_food_facts,
                                               func.upper(func.trim(FoodLogDB.nutri_score)) == grade), 1), else_=0)), 0)
         for grade in "ABCDE"] + [
        func.coalesce(func.sum(case((open_food_facts, 1), else_=0)), 0),
        func.coalesce(func.sum(case((usda, 1), else_=0)), 0),
    ]
    totals = session.exec(select(*columns).where(*conditions)).one()
    page_conditions = conditions + ([FoodLogDB.id < before] if before is not None else [])
    entries = session.exec(select(FoodLogDB).where(*page_conditions)
                           .order_by(FoodLogDB.id.desc()).limit(limit + 1)).all()
    open_food_facts_count = int(totals[10])
    usda_count = int(totals[11])
    total_count = int(totals[0])
    return FoodLogOverview(
        entries=[FoodLog.model_validate(row.model_dump()) for row in entries[:limit]],
        next_before=entries[limit - 1].id if len(entries) > limit else None,
        count=total_count, calories=totals[1], protein=totals[2], fat=totals[3], carbohydrates=totals[4],
        grades=dict(zip("ABCDE", totals[5:10])),
        sources={
            "open_food_facts": open_food_facts_count,
            "usda": usda_count,
            "other": total_count - open_food_facts_count - usda_count,
        },
    )
