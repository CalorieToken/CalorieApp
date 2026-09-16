import { formatFoodUi, recordedGradeStyle } from "@/lib/foodUi";
import { foodExperience, gradeCoverage } from "@/lib/foodExperience";
import type { RecordedGrades } from "@/lib/foodExperience";
import { foodSourceCopy, validFoodSourceCounts } from "@/lib/foodSource";
import type { FoodSourceCounts } from "@/lib/foodSource";

/** Distribution for the server-selected diary period, not the loaded-page subset. */
export function RecordedGradeSummary({ summary, sources, locale }: {
  summary: RecordedGrades;
  sources?: FoodSourceCounts | null;
  locale: string;
}) {
  const ui = foodExperience(locale);
  const sourceUi = foodSourceCopy(locale);
  const sourceCounts = validFoodSourceCounts(sources);
  const counts = sourceCounts && summary.total === sourceCounts.open_food_facts
    ? gradeCoverage(summary) : null;
  const number = new Intl.NumberFormat(ui.locale);
  return (
    <section className="mt-4 min-w-0 rounded-xl border border-brand-secondary/20 bg-brand-bg p-4" lang={ui.locale} dir={ui.direction}>
      <h4 className="text-base font-bold text-brand-primary">{sourceUi.copy.sourcesTitle}</h4>
      <p className="mt-1 text-sm leading-relaxed text-brand-secondary">{sourceUi.copy.sourceScope}</p>
      {sourceCounts ? <>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {([
            ["open_food_facts", sourceUi.copy.openFoodFacts],
            ["usda", sourceUi.copy.usda],
            ["other", sourceUi.copy.other],
          ] as const).map(([key, label]) => <div key={key} className="min-w-0 rounded-lg border border-brand-secondary/15 bg-white px-3 py-2">
            <dt className="break-words text-xs text-brand-secondary"><bdi>{label}</bdi></dt>
            <dd className="mt-1 text-lg font-bold text-brand-primary"><bdi>{number.format(sourceCounts[key])}</bdi></dd>
          </div>)}
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-brand-secondary">{sourceUi.copy.totalsNote}</p>
      </> : <p className="mt-3 text-sm text-brand-secondary">{sourceUi.copy.sourcesUnavailable}</p>}

      <div className="mt-4 border-t border-brand-secondary/20 pt-4">
      <h5 className="text-sm font-bold text-brand-primary">{sourceUi.copy.gradeHeading}</h5>
      <p className="mt-1 text-sm leading-relaxed text-brand-secondary">{sourceUi.copy.gradeScope}</p>
      {counts ? <>
        <p className="mt-3 text-sm font-semibold text-brand-primary">
          {formatFoodUi(ui.copy.coverage, { known: number.format(counts.known), total: number.format(counts.total) })}
        </p>
        {counts.known ? (
          <dl className="mt-3 grid grid-cols-5 gap-1 text-center" dir="ltr">
            {counts.grades.map(({ grade, count }) => (
              <div key={grade} className="min-w-0 rounded-lg border border-brand-secondary/20 bg-white p-2">
                <dt className="rounded py-1 text-base font-bold" style={recordedGradeStyle(grade)}><bdi>{grade}</bdi></dt>
                <dd className="mt-2 break-words text-base font-semibold text-brand-primary"><bdi>{number.format(count)}</bdi></dd>
              </div>
            ))}
          </dl>
        ) : <p className="mt-3 text-sm text-brand-secondary">{ui.copy.noGrades}</p>}
        <p className="mt-3 text-sm leading-relaxed text-brand-secondary">
          {formatFoodUi(ui.copy.missing, { missing: number.format(counts.missing) })}
        </p>
      </> : <p className="mt-3 text-sm text-brand-secondary">{ui.copy.coverageUnavailable}</p>}
      <details className="mt-2 text-sm text-brand-secondary">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">{ui.copy.sourceDetails}</summary>
        <p className="leading-relaxed">{ui.copy.gradeExplanation}</p>
      </details>
      </div>
    </section>
  );
}
