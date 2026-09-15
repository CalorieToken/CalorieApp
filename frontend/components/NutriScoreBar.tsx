"use client";

import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { formatFoodUi, recordedGradeStyle } from "@/lib/foodUi";
import { foodExperience, productGrade, PRODUCT_GRADES } from "@/lib/foodExperience";

/** Source-supplied product grade, never a portion score or a daily health rating. */
export function NutriScoreBar({ grade, locale: requestedLocale }: { grade?: string | null; locale?: string }) {
  const display = useDisplayLanguage();
  const { copy, locale, direction } = foodExperience(requestedLocale ?? (display.enabled ? display.locale : "en"));
  const selected = productGrade(grade);
  return (
    <div className="mt-3 max-w-md rounded-lg border border-brand-secondary/20 bg-white p-3" lang={locale} dir={direction}>
      <p className="text-sm font-semibold text-brand-primary" data-product-grade={selected ?? "unavailable"}>
        {selected ? formatFoodUi(copy.productGrade, { grade: selected }) : copy.gradeUnavailable}
      </p>
      {selected ? (
        <div className="mt-2 flex max-w-72 items-center gap-1 rounded-lg bg-white p-1" aria-hidden="true" dir="ltr">
          {PRODUCT_GRADES.map(letter => (
            <span key={letter} style={recordedGradeStyle(letter)}
              className={`flex min-w-0 flex-1 items-center justify-center rounded text-base font-bold ${letter === selected ? "h-12 ring-2 ring-brand-secondary ring-offset-2" : "h-9 opacity-60"}`}>
              {letter}
            </span>
          ))}
        </div>
      ) : null}
      <details className="mt-2 text-sm text-brand-secondary">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">{copy.sourceDetails}</summary>
        <p className="leading-relaxed">{copy.productNote}</p>
      </details>
    </div>
  );
}
