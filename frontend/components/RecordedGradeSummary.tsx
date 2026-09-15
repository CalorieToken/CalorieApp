import { formatFoodUi, recordedGradeStyle } from "@/lib/foodUi";
import { foodExperience, gradeCoverage } from "@/lib/foodExperience";
import type { RecordedGrades } from "@/lib/foodExperience";

/** Distribution for the server-selected diary period, not the loaded-page subset. */
export function RecordedGradeSummary({ summary, locale }: { summary: RecordedGrades; locale: string }) {
  const ui = foodExperience(locale);
  const counts = gradeCoverage(summary);
  const number = new Intl.NumberFormat(ui.locale);
  return (
    <section className="mt-4 min-w-0 rounded-xl border border-brand-secondary/20 bg-brand-bg p-4" lang={ui.locale} dir={ui.direction}>
      <h4 className="text-base font-bold text-brand-primary">{ui.copy.gradeTitle}</h4>
      <p className="mt-1 text-sm leading-relaxed text-brand-secondary">{ui.copy.gradeScope}</p>
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
    </section>
  );
}
