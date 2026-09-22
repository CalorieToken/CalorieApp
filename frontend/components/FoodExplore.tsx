"use client";

import { ReactNode, useId, useState } from "react";
import { FoodPropertyIcon } from "@/components/FoodPropertyIcon";
import { discoveryCopy } from "@/lib/foodDiscovery";
import { recipeCopy } from "@/lib/foodRecipes";

/** One product, one visible section. Native buttons also work with keyboard and touch. */
export function FoodExplore({ locale, nutrition, comparison, recipes, labels, initialSection = "nutrition", onBack, backLabel, productName, currentSection, onSectionChange }: {
  locale: string; nutrition: ReactNode; comparison?: ReactNode; recipes?: ReactNode; labels: ReactNode;
  initialSection?: string; onBack?: () => void; backLabel?: string;
  productName?: string; currentSection?: string; onSectionChange?: (section: string) => void;
}) {
  const copy = discoveryCopy(locale);
  const id = useId();
  const [active, setActive] = useState(initialSection);
  const sections = [
    { key: "nutrition", label: copy.nutrition, icon: "calories" as const, content: nutrition },
    { key: "comparison", label: copy.alternatives, icon: "score" as const, content: comparison },
    { key: "recipes", label: recipeCopy(locale).title, icon: "recipe" as const, content: recipes },
    { key: "labels", label: copy.labelsTitle, icon: "label" as const, content: labels },
  ].filter(section => section.content != null);
  const selected = sections.find(section => section.key === (currentSection ?? active)) || sections[0];
  return <div>
    <div className="sticky top-0 z-10 bg-white py-2">
      <p className="mb-1 truncate text-xs text-brand-secondary" title={productName}><bdi>{productName}</bdi> <span aria-hidden="true"> › </span><strong>{selected.label}</strong></p>
      {onBack ? <button type="button" onClick={onBack} className="mb-1 min-h-11 text-sm font-semibold text-brand-secondary underline focus-visible:ring-2 focus-visible:ring-brand-primary">← {backLabel}</button> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {sections.map(section => <button key={section.key} id={`${id}-${section.key}`} type="button"
        aria-pressed={selected.key === section.key} aria-controls={`${id}-panel`}
        onClick={() => { setActive(section.key); onSectionChange?.(section.key); }}
        className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-brand-primary ${selected.key === section.key ? "border-brand-secondary bg-brand-secondary text-white" : "border-brand-secondary/20 bg-white text-brand-secondary"}`}>
        <FoodPropertyIcon kind={section.icon} />{section.label}
      </button>)}
      </div>
    </div>
    <section id={`${id}-panel`} aria-labelledby={`${id}-${selected.key}`} className="pt-3">
      {/* Keep local filters when switching sections; hidden panels cannot be tabbed into. */}
      {sections.map(section => <div key={section.key} hidden={selected.key !== section.key}>{section.content}</div>)}
    </section>
  </div>;
}
