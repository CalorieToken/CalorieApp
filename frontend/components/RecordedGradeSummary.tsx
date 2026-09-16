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
    <section className="mt-4 min-w-0 rounded-xl border border-brand-secondary/20 bg-brand-bg p-3 sm:p-4" lang={ui.locale} dir={ui.direction}>
      <h4 className="text-sm font-bold text-brand-primary">{sourceUi.copy.gradeHeading}</h4>
      <p className="mt-1 text-sm leading-relaxed text-brand-secondary">{sourceUi.copy.gradeScope}</p>
      {counts ? <>
        <p className="mt-2 text-sm font-semibold text-brand-primary">
          {formatFoodUi(ui.copy.coverage, { known: number.format(counts.known), total: number.format(counts.total) })}
        </p>
        {counts.known ? (
          <>
          <div role="img"
            aria-label={counts.grades.map(({grade, count}) => `${grade}: ${number.format(count)}`).join(", ")}
            className="mt-3 flex h-8 w-full overflow-hidden rounded-full border-2 border-white bg-white shadow-sm ring-1 ring-brand-secondary/20"
            dir="ltr">
            {counts.grades.filter(({count}) => count > 0).map(({grade, count}) => (
              <span key={grade} style={{...recordedGradeStyle(grade), width: `${(count / counts.known) * 100}%`}}
                className="flex h-full min-w-0 items-center justify-center overflow-hidden text-xs font-extrabold"
                title={`${grade}: ${number.format(count)}`}>
                <span aria-hidden="true">{grade}</span>
              </span>
            ))}
          </div>
          <dl className="mt-2 grid grid-cols-5 gap-1 text-center" dir="ltr">
            {counts.grades.map(({ grade, count }) => (
              <div key={grade} className="min-w-0 overflow-hidden rounded-lg border border-brand-secondary/20 bg-white">
                <dt className="py-1 text-sm font-bold" style={recordedGradeStyle(grade)}><bdi>{grade}</bdi></dt>
                <dd className="break-words px-1 py-1.5 text-sm font-semibold text-brand-primary"><bdi>{number.format(count)}</bdi></dd>
              </div>
            ))}
          </dl>
          </>
        ) : <p className="mt-3 text-sm text-brand-secondary">{ui.copy.noGrades}</p>}
        <p className="mt-2 text-xs leading-relaxed text-brand-secondary">
          {formatFoodUi(ui.copy.missing, { missing: number.format(counts.missing) })}
        </p>
      </> : <p className="mt-3 text-sm text-brand-secondary">{ui.copy.coverageUnavailable}</p>}

      <details className="mt-2 border-t border-brand-secondary/15 pt-1 text-sm text-brand-secondary">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">{sourceUi.copy.sourcesTitle}</summary>
        <p className="leading-relaxed">{sourceUi.copy.sourceScope}</p>
        {sourceCounts ? <>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            {([
              ["open_food_facts", sourceUi.copy.openFoodFacts],
              ["usda", sourceUi.copy.usda],
              ["other", sourceUi.copy.other],
            ] as const).map(([key, label]) => <div key={key} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-brand-secondary/15 bg-white px-3 py-2 sm:block">
              <dt className="break-words text-xs text-brand-secondary"><bdi>{label}</bdi></dt>
              <dd className="text-base font-bold text-brand-primary sm:mt-1"><bdi>{number.format(sourceCounts[key])}</bdi></dd>
            </div>)}
          </dl>
          <p className="mt-2 text-xs leading-relaxed">{sourceUi.copy.totalsNote}</p>
        </> : <p className="mt-3">{sourceUi.copy.sourcesUnavailable}</p>}
        <p className="mt-2 text-xs leading-relaxed">{ui.copy.gradeExplanation}</p>
      </details>
    </section>
  );
}
