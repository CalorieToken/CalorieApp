import { recordedGradeStyle } from "@/lib/foodUi";

/** Display the supplied product grade; never infer a grade from diary totals. */
export function NutriScoreBar({ grade }: { grade?: string | null }) {
  const selected = grade?.trim().toUpperCase();
  if (!recordedGradeStyle(selected)) return null;
  return (
    <div className="mt-3 max-w-64" role="img" aria-label={`Nutri-Score: ${selected}`} dir="ltr">
      <p className="mb-1 text-xs font-bold text-brand-secondary">Nutri-Score</p>
      <div className="flex items-center gap-1 rounded-lg bg-white p-1">
        {["A", "B", "C", "D", "E"].map((letter) => (
          <span
            key={letter}
            aria-hidden="true"
            style={recordedGradeStyle(letter)}
            className={`flex min-w-0 flex-1 items-center justify-center rounded text-sm font-bold ${letter === selected ? "h-10 ring-2 ring-brand-secondary ring-offset-2" : "h-8 opacity-70"}`}
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}
