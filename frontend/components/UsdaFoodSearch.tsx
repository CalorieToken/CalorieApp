"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { FoodSearchItem } from "@/components/foodTypes";
import { discoveryCopy, edibleGrams, searchUsda, similarFoodNames, usdaLogItem, usdaNutrition } from "@/lib/foodDiscovery";
import type { UsdaCatalogue, UsdaFood } from "@/lib/foodDiscovery";
import { localeDirection } from "@/lib/locales";

export function UsdaFoodSearch({ locale, disabled, onChoose, onEditing }: {
  locale: string; disabled: boolean; onChoose: (food: FoodSearchItem) => void; onEditing: () => void;
}) {
  const copy = discoveryCopy(locale);
  const [catalogue, setCatalogue] = useState<UsdaCatalogue | null>(null);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [selected, setSelected] = useState<UsdaFood | null>(null);
  const [amount, setAmount] = useState("100");
  const [amountLocale, setAmountLocale] = useState(locale);
  const [limit, setLimit] = useState(12);
  const request = useRef<AbortController | null>(null);
  const detail = useRef<HTMLDivElement>(null);
  const grams = edibleGrams(amount, amountLocale);
  const values = selected ? usdaNutrition(selected, grams ?? NaN) : null;
  const logItem = selected && grams !== null ? usdaLogItem(selected, grams) : null;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const matches = useMemo(() => catalogue && submitted !== null ? searchUsda(catalogue.foods, submitted) : [], [catalogue, submitted]);
  const alternatives = useMemo(() => selected && catalogue ? similarFoodNames(selected, catalogue.foods,
    food => food.description, food => String(food.fdc_id)) : [], [selected, catalogue]);
  useEffect(() => () => { const active = request.current; request.current = null; active?.abort(); }, []);
  useEffect(() => { if (selected) detail.current?.focus({ preventScroll: true }); }, [selected]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || state === "loading" || !query.trim()) return;
    onEditing(); setSelected(null); setLimit(12); setSubmitted(query.trim());
    if (catalogue) return;
    const controller = new AbortController(); request.current = controller;
    setState("loading");
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      // This fixed first-party snapshot needs no USDA API key or visitor query.
      const response = await fetch("/data/usda-search-foods.json", { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new Error("Catalogue unavailable");
      const data = await response.json() as UsdaCatalogue;
      if (data.version !== 1 || data.source !== "USDA FoodData Central" || !Array.isArray(data.foods)) throw new Error("Invalid catalogue");
      if (request.current !== controller) return;
      setCatalogue(data); setState("idle");
    } catch {
      if (request.current === controller) setState("failed");
    } finally {
      clearTimeout(timer);
      if (request.current === controller) request.current = null;
    }
  }
  function choose(food: UsdaFood) { onEditing(); setSelected(food); setAmount("100"); setAmountLocale(locale); }

  return <details className="min-w-0 rounded-xl border border-brand-secondary/20 bg-white p-4 sm:p-5" lang={locale} dir={localeDirection(locale)}>
    <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold text-brand-primary focus-visible:ring-2 focus-visible:ring-brand-secondary">{copy.usdaTitle}</summary>
    <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.usdaIntro}</p>
    <form onSubmit={search} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 basis-48 text-sm font-semibold text-brand-primary">{copy.query}
        <input value={query} onChange={event => setQuery(event.target.value)} maxLength={160} required
          className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-brand-secondary/40 px-3 text-base" />
      </label>
      <button type="submit" disabled={disabled || state === "loading" || !query.trim()}
        className="min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{state === "loading" ? copy.loading : copy.search}</button>
    </form>
    <p role="status" className="mt-3 text-sm text-brand-secondary">{state === "failed" ? copy.failed : state === "loading" ? copy.loading : submitted !== null && catalogue ? matches.length ? copy.found.replace("{count}", number.format(matches.length)) : copy.empty : ""}</p>
    {matches.length ? <ul className="mt-3 space-y-2">{matches.slice(0, limit).map(food => <li key={food.fdc_id}>
      <button type="button" disabled={disabled} onClick={() => choose(food)} aria-pressed={selected?.fdc_id === food.fdc_id}
        className="min-h-11 w-full rounded-lg border border-brand-secondary/20 p-3 text-start text-sm text-brand-primary hover:bg-brand-bg disabled:opacity-50">
        <bdi lang="en" className="block break-words font-semibold">{food.description}</bdi>
        <bdi className="mt-1 block text-xs text-brand-secondary">FDC {food.fdc_id} · {food.data_type} · {food.edition}</bdi>
      </button>
    </li>)}</ul> : null}
    {matches.length > limit ? <button type="button" onClick={() => setLimit(limit + 12)} className="mt-3 min-h-11 rounded-full border border-brand-secondary px-4 py-2 text-sm text-brand-secondary">{copy.more}</button> : null}
    {selected && values ? <div ref={detail} tabIndex={-1} className="mt-5 min-w-0 rounded-xl border-2 border-brand-secondary/30 bg-brand-bg p-4 outline-none">
      <p className="text-sm text-brand-secondary">{copy.selected}</p>
      <h3 className="mt-1 break-words font-bold text-brand-primary"><bdi lang="en">{selected.description}</bdi></h3>
      <p className="mt-2 text-sm text-brand-secondary">{copy.amountNote}</p>
      <label className="mt-3 block text-sm font-semibold text-brand-primary">{copy.grams}
        <input type="text" inputMode="decimal" value={amount} maxLength={9} dir="ltr" disabled={disabled}
          onChange={event => { onEditing(); setAmount(event.target.value); setAmountLocale(locale); }} aria-invalid={grams === null}
          className="mt-2 block min-h-11 w-36 max-w-full rounded-lg border border-brand-secondary/40 bg-white px-3 text-base" />
      </label>
      {grams === null ? <p role="alert" className="mt-2 text-sm text-red-700">{copy.invalidGrams}</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-3">{([['calories', copy.calories, 'kcal'], ['protein', copy.protein, 'g'], ['fat', copy.fat, 'g'], ['carbohydrates', copy.carbohydrates, 'g']] as const).map(([key, label, unit]) => <div key={key} className="min-w-0 break-words">
        <dt className="text-xs text-brand-secondary">{label}</dt><dd className="mt-1 font-semibold text-brand-primary">{values[key] === null ? copy.unavailable : <bdi>{number.format(values[key]!)} {unit}</bdi>}</dd>
      </div>)}</dl>
      <p className="mt-3 text-xs text-brand-secondary">{copy.notScore}</p>
      {!logItem && grams !== null ? <p className="mt-2 text-sm text-brand-secondary">{copy.cannotLog}</p> : null}
      <button type="button" disabled={disabled || !logItem} onClick={() => { if (logItem) onChoose(logItem); }}
        className="mt-4 min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{copy.choose}</button>
      <a href={`https://fdc.nal.usda.gov/food-details/${selected.fdc_id}/nutrients`} target="_blank" rel="noopener noreferrer"
        className="mt-2 flex min-h-11 items-center text-sm font-semibold text-brand-secondary underline">{copy.source} · <bdi>FDC {selected.fdc_id}</bdi></a>
      {alternatives.length ? <details className="mt-3 border-t border-brand-secondary/20 pt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-primary">{copy.alternatives}</summary>
        <p className="text-sm text-brand-secondary">{copy.suggestionNote}</p><ul className="mt-2 space-y-2">{alternatives.map(food => <li key={food.fdc_id}><button type="button" disabled={disabled} onClick={() => choose(food)}
          className="min-h-11 w-full rounded-lg border border-brand-secondary/30 bg-white p-3 text-start text-sm text-brand-secondary"><bdi lang="en">{food.description}</bdi></button></li>)}</ul>
      </details> : null}
    </div> : null}
    {catalogue ? <p className="mt-4 text-xs text-brand-secondary">{copy.recorded}: <bdi>{catalogue.retrieved_on}</bdi> · <a className="underline" href="https://fdc.nal.usda.gov/download-datasets/" target="_blank" rel="noopener noreferrer">USDA FoodData Central</a> · CC0 1.0</p> : null}
  </details>;
}
