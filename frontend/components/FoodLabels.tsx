import { FoodSearchItem } from "@/components/foodTypes";
import { discoveryCopy, foodSourceUrl, recordedFoodLabels } from "@/lib/foodDiscovery";

export function FoodLabels({ food, locale, embedded = false }: { food: FoodSearchItem; locale: string; embedded?: boolean }) {
  const labels = recordedFoodLabels(food, locale), copy = discoveryCopy(locale), source = foodSourceUrl(food);
  const content = <>
    {!labels.length ? <p className="text-sm font-semibold text-brand-secondary">{copy.unavailable}</p> : null}
    {labels.length ? <ul className="mt-2 flex flex-wrap gap-2">{labels.map(label => <li key={label.name} className="rounded-full border border-brand-secondary/25 px-3 py-1 text-sm text-brand-secondary"><bdi>{label.name}</bdi></li>)}</ul> : null}
    <p className="mt-2 text-xs leading-relaxed text-brand-secondary">{copy.labelsNote}</p>
    {source ? <a href={source} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-secondary underline">{copy.productSource} · Open Food Facts ↗</a> : null}
  </>;
  return embedded ? <div>{content}</div> : <details className="mt-3 rounded-xl border border-brand-secondary/20 p-3">
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-secondary">{copy.labelsTitle}{labels.length ? ` · ${labels.length}` : ""}</summary>
    {content}
  </details>;
}
