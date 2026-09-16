"use client";

import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { formatFoodUi, recordedGradeStyle } from "@/lib/foodUi";
import { foodExperience, productGrade } from "@/lib/foodExperience";

/** Source-supplied product grade, never a portion score or a daily health rating. */
export function NutriScoreBar({ grade, locale: requestedLocale, compact = false }: { grade?: string | null; locale?: string; compact?: boolean }) {
  const display = useDisplayLanguage();
  const { copy, locale, direction } = foodExperience(requestedLocale ?? (display.enabled ? display.locale : "en"));
  const selected = productGrade(grade);
  const grades = ["A", "B", "C", "D", "E"] as const;
  return (
    <div className={`mt-3 max-w-md rounded-lg border border-brand-secondary/20 bg-brand-bg px-3 ${compact ? "py-2" : "py-2.5"}`} lang={locale} dir={direction}>
      <div className="flex min-w-0 items-center gap-3">
        {selected ? (
          <span aria-hidden="true" style={recordedGradeStyle(selected)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base font-extrabold shadow-sm" dir="ltr">
            {selected}
          </span>
        ) : null}
        <p className="min-w-0 text-sm font-semibold text-brand-primary" data-product-grade={selected ?? "unavailable"}>
          {selected ? formatFoodUi(copy.productGrade, { grade: selected }) : copy.gradeUnavailable}
        </p>
      </div>
      <div role="img" aria-label={selected ? formatFoodUi(copy.productGrade, { grade: selected }) : copy.gradeUnavailable}
        className="mt-2 grid grid-cols-5 gap-1" dir="ltr">
        {grades.map(item => <span key={item} aria-hidden="true" style={recordedGradeStyle(item)}
          className={`flex h-7 items-center justify-center rounded-md text-xs font-extrabold transition ${selected === item ? "scale-105 ring-2 ring-brand-primary ring-offset-1" : "opacity-35 grayscale-[35%]"}`}>
          {item}
        </span>)}
      </div>
      {!compact ? <details className="mt-1 text-xs text-brand-secondary">
        <summary className="min-h-10 cursor-pointer py-2 font-semibold">{copy.sourceDetails}</summary>
        <p className="pb-1 leading-relaxed">{copy.productNote}</p>
      </details> : null}
    </div>
  );
}
