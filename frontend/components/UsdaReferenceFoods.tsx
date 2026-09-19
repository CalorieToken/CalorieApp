"use client";

import { useEffect, useState } from "react";
import { parseReferenceGrams, referenceNutrientAmount } from "@/lib/usdaReference";
import reference from "@/data/usda-reference-foods.json";
import translations from "@/config/usda-reference-copy.json";
import { localeDirection, resolveLocale } from "@/lib/locales";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";

// This bundled reference is deliberately independent of FoodSearchItem and the
// private diary. It has no provider requests, account state or logging action.
export function UsdaReferenceFoods() {
  const [initialLocale, setLocale] = useState("en");
  const [weight, setWeight] = useState("100");
  const grams = parseReferenceGrams(weight);
  const display = useDisplayLanguage();
  const locale = display.enabled ? display.locale : initialLocale;
  useEffect(() => {
    setLocale(resolveLocale(
      new URLSearchParams(window.location.search).get("locale") ||
      document.documentElement.lang || navigator.languages?.join(",") || navigator.language
    ));
  }, []);
  const copy = translations[locale as keyof typeof translations] ?? translations.en;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const metrics = [
    { id: 2047, label: copy.energy, unit: "kcal" },
    { id: 1003, label: copy.protein, unit: "g" },
    { id: 1004, label: copy.fat, unit: "g" },
    { id: 1005, label: copy.carbohydrates, unit: "g" },
  ];

  return (
    <details
      id="usda-reference-foods"
      lang={locale}
      dir={localeDirection(locale)}
      className="mt-6 min-w-0 rounded-md border border-brand-secondary/20 bg-brand-bg"
    >
      <summary className="min-h-11 cursor-pointer rounded-md px-4 py-3 text-sm font-semibold text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary">
        {copy.title} · <bdi>USDA</bdi>
      </summary>
      <div className="px-4 pb-4 text-sm text-brand-secondary">
        <p>{copy.scope}</p>
        <p className="mt-2 font-semibold">{grams === 100 ? copy.basis : grams !== null ? copy.calculated.replace("{grams}", number.format(grams)) : copy.invalidWeight}</p>
        <div className="mt-3 rounded-xl border border-brand-secondary/20 bg-white p-3">
          <label htmlFor="usda-reference-weight" className="block font-semibold">{copy.weight}</label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input id="usda-reference-weight" inputMode="decimal" type="text" value={weight}
              onChange={event => setWeight(event.target.value)} maxLength={8} dir="ltr"
              aria-invalid={grams === null} aria-describedby="usda-reference-weight-note"
              className="min-h-11 w-32 max-w-full rounded-lg border border-brand-secondary/40 px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary" />
            <button type="button" onClick={() => setWeight("100")}
              className="min-h-11 rounded-lg px-3 font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand-primary">{copy.resetWeight}</button>
          </div>
          <p id="usda-reference-weight-note" className="mt-2 text-xs">{grams === null ? copy.invalidWeight : copy.calculationNote}</p>
          {grams !== null && grams !== 100 ? <p className="mt-2 font-semibold" role="status">{copy.calculated.replace("{grams}", number.format(grams))}</p> : null}
        </div>
        <ul className="mt-3 divide-y divide-brand-secondary/15">
          {reference.foods.map((food) => (
            <li key={food.fdc_id} className="min-w-0 py-4">
              <h3 lang="en" dir="ltr" className="break-words font-semibold text-brand-primary">
                {food.description}
              </h3>
              <dl className="mt-2 grid grid-cols-2 gap-3">
                {metrics.map((metric) => {
                  const nutrient = food.nutrients.find((item) => item.id === metric.id);
                  const amount = referenceNutrientAmount(nutrient, metric.unit, grams);
                  return (
                    <div key={metric.id} className="min-w-0 break-words">
                      <dt className="text-xs">{metric.label}</dt>
                      <dd className="mt-1 font-semibold">
                        {amount !== null ? <bdi>{amount > 0 && amount < 0.01 ? `<${number.format(0.01)}` : number.format(amount)} {metric.unit}</bdi> : copy.unavailable}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <a
                href={`https://fdc.nal.usda.gov/food-search/?query=${encodeURIComponent(food.description)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-11 flex-wrap items-center gap-1 rounded-sm py-2 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary"
              >
                {copy.source} · <bdi>FDC {food.fdc_id}</bdi>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed">{copy.method}</p>
        <p className="mt-2 text-xs">
          {copy.snapshot}{" "}<time dateTime={reference.retrieved_on}><bdi>{reference.retrieved_on}</bdi></time>
          {" · "}<a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">USDA FoodData Central</a>
          {" · "}<a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">CC0 1.0</a>
        </p>
      </div>
    </details>
  );
}
