"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { FoodSearchItem } from "@/components/foodTypes";
import { discoveryCopy, edibleGrams, searchUsda, similarFoodNames, usdaLogItem, usdaNutrition } from "@/lib/foodDiscovery";
import type { UsdaCatalogue, UsdaFood } from "@/lib/foodDiscovery";
import { foodExperience } from "@/lib/foodExperience";
import { FoodImage } from "@/components/FoodImage";

/** The existing source, gram calculation and explicit-save callback are retained. */
export function UsdaFoodSearch({ locale, disabled, canLog = true, onChoose, onEditing, confirmation, feedback }: {
  locale: string;
  disabled: boolean;
  canLog?: boolean;
  onChoose: (food: FoodSearchItem) => void;
  onEditing: () => void;
  confirmation?: ReactNode;
  feedback?: ReactNode;
}) {
  const copy = discoveryCopy(locale);
  const ui = foodExperience(locale);
  const [catalogue, setCatalogue] = useState<UsdaCatalogue | null>(null);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [selected, setSelected] = useState<UsdaFood | null>(null);
  const [amount, setAmount] = useState("100");
  // Preserve the numeric interpretation when the display language changes.
  const [amountLocale, setAmountLocale] = useState(locale);
  const [limit, setLimit] = useState(6);
  const request = useRef<AbortController | null>(null);
  const detail = useRef<HTMLDivElement>(null);
  const resultsList = useRef<HTMLUListElement>(null);
  const listPosition = useRef(0);
  const restorePosition = useRef<number | null>(null);
  const [anchorId, setAnchorId] = useState<number | null>(null);
  const [history, setHistory] = useState<{ food: UsdaFood; amount: string; amountLocale: string; scrollTop: number }[]>([]);
  const queryInput = useRef<HTMLInputElement>(null);
  const grams = edibleGrams(amount, amountLocale);
  const values = selected ? usdaNutrition(selected, grams ?? NaN) : null;
  const logItem = selected && grams !== null ? usdaLogItem(selected, grams) : null;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const matches = useMemo(() => catalogue && submitted !== null ? searchUsda(catalogue.foods, submitted) : [], [catalogue, submitted]);
  const alternatives = useMemo(() => selected && catalogue ? similarFoodNames(selected, catalogue.foods,
    food => food.description, food => String(food.fdc_id)) : [], [selected, catalogue]);

  useEffect(() => () => {
    const active = request.current;
    request.current = null;
    active?.abort();
  }, []);
  useEffect(() => {
    if (restorePosition.current !== null && resultsList.current) {
      resultsList.current.scrollTop = restorePosition.current;
      restorePosition.current = null;
    }
    if (!selected) return;
    detail.current?.focus({ preventScroll: true });
  }, [selected]);

  function editQuery(value: string) {
    if (disabled || state === "loading") return;
    onEditing();
    setQuery(value);
    setSelected(null); setAnchorId(null); setHistory([]);
    setSubmitted(null);
    setState("idle");
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || state === "loading" || !query.trim()) return;
    onEditing(); setSelected(null); setAnchorId(null); setHistory([]); setLimit(6); setSubmitted(query.trim());
    if (catalogue) return;
    const controller = new AbortController(); request.current = controller;
    setState("loading");
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      // Same fixed first-party snapshot. No user search is sent to USDA.
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

  function choose(food: UsdaFood, alternative = false) {
    if (disabled) return;
    if (!selected || !alternative) {
      setAnchorId(food.fdc_id);
      listPosition.current = resultsList.current?.scrollTop ?? 0;
      setHistory([]);
    } else {
      setHistory(previous => [...previous, { food: selected, amount, amountLocale, scrollTop: resultsList.current?.scrollTop ?? 0 }]);
    }
    onEditing(); setSelected(food); setAmount("100"); setAmountLocale(locale);
  }
  function changeFood() {
    if (disabled) return;
    const trigger = resultsList.current?.querySelector<HTMLButtonElement>(`button[data-fdc-id="${anchorId}"]`);
    onEditing(); setSelected(null); setAnchorId(null); setHistory([]);
    restorePosition.current = listPosition.current;
    trigger?.focus({ preventScroll: true });
  }


  function previousFood() {
    const previous = history[history.length - 1];
    if (!previous || disabled) return;
    onEditing();
    setHistory(current => current.slice(0, -1));
    setSelected(previous.food); setAmount(previous.amount); setAmountLocale(previous.amountLocale);
    restorePosition.current = previous.scrollTop;
  }

  const selectedCard = selected && values ? <div ref={detail} data-testid="usda-selected-food" tabIndex={-1} className="mt-5 min-w-0 rounded-xl border-2 border-brand-secondary/30 bg-brand-bg p-4 focus-visible:ring-2 focus-visible:ring-brand-secondary">
      {history.length ? <button type="button" onClick={previousFood} disabled={disabled}
        className="mb-3 min-h-11 w-full rounded-full border-2 border-brand-secondary bg-white px-4 py-2 text-start text-sm font-semibold text-brand-secondary disabled:opacity-50">
        {copy.backToProduct.replace("{food}", history[history.length - 1].food.description)}
      </button> : null}
      <button type="button" onClick={changeFood} disabled={disabled} className="mb-3 min-h-11 rounded-full border border-brand-secondary bg-white px-4 py-2 text-sm font-semibold text-brand-secondary disabled:opacity-50">{ui.copy.changeFood}</button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <FoodImage item={{ product_name: selected.description, category: selected.category, image_url: null, barcode: null,
          brand: `USDA FoodData Central · FDC ${selected.fdc_id}` }} size={96}
          className="h-24 w-full shrink-0 sm:w-24" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-brand-secondary">{copy.selected}</p>
          <h3 className="mt-1 break-words font-bold text-brand-primary"><bdi lang="en">{selected.description}</bdi></h3>
        </div>
      </div>
      <p className="mt-2 text-sm text-brand-secondary">{copy.amountNote}</p>
      <label className="mt-3 block text-sm font-semibold text-brand-primary">{copy.grams}
        <input type="text" inputMode="decimal" value={amount} maxLength={9} dir="ltr" disabled={disabled}
          onChange={event => { if (disabled) return; onEditing(); setAmount(event.target.value); setAmountLocale(locale); }} aria-invalid={grams === null}
          className="mt-2 block min-h-11 w-36 max-w-full rounded-lg border border-brand-secondary/40 bg-white px-3 text-base" />
      </label>
      {grams === null ? <p role="alert" className="mt-2 text-sm text-red-700">{copy.invalidGrams}</p> : null}
      {!confirmation ? <dl data-testid="usda-nutrition-preview" className="mt-4 grid grid-cols-2 gap-3">{([['calories', copy.calories, 'kcal'], ['protein', copy.protein, 'g'], ['fat', copy.fat, 'g'], ['carbohydrates', copy.carbohydrates, 'g']] as const).map(([key, label, unit]) => <div key={key} className="min-w-0 break-words">
        <dt className="text-sm text-brand-secondary">{label}</dt><dd className="mt-1 font-semibold text-brand-primary">{values[key] === null ? copy.unavailable : <bdi>{number.format(values[key]!)} {unit}</bdi>}</dd>
      </div>)}</dl> : null}
      <p className="mt-3 text-sm text-brand-secondary">{ui.copy.gradeUnavailable}</p>
      {canLog && !logItem && grams !== null ? <p className="mt-2 text-sm text-brand-secondary">{copy.cannotLog}</p> : null}
      {canLog ? confirmation || <button type="button" disabled={disabled || !logItem} onClick={() => { if (!disabled && logItem) onChoose(logItem); }}
        className="mt-4 min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{ui.copy.reviewAmount}</button> : null}
      {canLog ? feedback : null}
      <a href={`https://fdc.nal.usda.gov/food-details/${selected.fdc_id}/nutrients`} target="_blank" rel="noopener noreferrer"
        className="mt-2 block min-h-11 break-words py-2 text-sm font-semibold text-brand-secondary underline">{copy.source} &middot; <bdi>FDC {selected.fdc_id}</bdi></a>
      {alternatives.length ? <details className="mt-3 border-t border-brand-secondary/20 pt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-primary">{copy.alternatives}</summary>
        <p className="text-sm text-brand-secondary">{copy.suggestionNote}</p><ul className="mt-2 space-y-2">{alternatives.map(food => <li key={food.fdc_id}><button type="button" disabled={disabled} onClick={() => choose(food, true)}
          className="min-h-11 w-full rounded-lg border border-brand-secondary/30 bg-white p-3 text-start text-sm text-brand-secondary"><bdi lang="en">{food.description}</bdi></button></li>)}</ul>
      </details> : null}
    </div> : feedback;

  return <section data-testid="usda-food-search" className="min-w-0 rounded-xl border border-brand-secondary/20 bg-white p-4 sm:p-5" lang={ui.locale} dir={ui.direction}>
    <h2 className="text-lg font-bold text-brand-primary">{ui.copy.sourceTitle} <span className="text-sm font-normal">(USDA)</span></h2>
    {<>
      <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{ui.copy.sourceIntro}</p>
      <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{ui.copy.sourceOriginal}</p>
    </>}
    <form onSubmit={search} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 basis-48 text-sm font-semibold text-brand-primary">{copy.query}
        <input ref={queryInput} value={query} onChange={event => editQuery(event.target.value)} maxLength={160} required
          disabled={disabled || state === "loading"} type="search" autoComplete="off" enterKeyHint="search"
          className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-brand-secondary/40 px-3 text-base" />
      </label>
      <button type="submit" disabled={disabled || state === "loading" || !query.trim()}
        className="min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{state === "loading" ? copy.loading : copy.search}</button>
    </form>
    <p role="status" className="mt-3 text-sm text-brand-secondary">{state === "failed" ? copy.failed : state === "loading" ? copy.loading : !selected && submitted !== null && catalogue ? matches.length ? copy.found.replace("{count}", number.format(matches.length)) : copy.empty : ""}</p>
    {matches.length ? <ul ref={resultsList} style={{ overflowAnchor: "none" }} className="mt-3 max-h-[55dvh] space-y-2 overflow-y-auto overscroll-contain pe-1">{matches.slice(0, limit).map(food => <li key={food.fdc_id}>
      <button type="button" disabled={disabled} data-fdc-id={food.fdc_id} aria-expanded={anchorId === food.fdc_id} onClick={() => choose(food)}
        className={`min-h-11 w-full rounded-lg border p-3 text-start text-sm text-brand-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-secondary disabled:opacity-50 ${anchorId === food.fdc_id ? "border-brand-primary bg-brand-primary/5" : "border-brand-secondary/20 hover:bg-brand-bg"}`}>
        <bdi lang="en" className="block break-words font-semibold">{food.description}</bdi>
        <bdi className="mt-1 block text-xs text-brand-secondary">FDC {food.fdc_id} &middot; {food.data_type} &middot; {food.edition}</bdi>
      </button>
      {anchorId === food.fdc_id ? selectedCard : null}
    </li>)}</ul> : null}
    {!selected && matches.length > limit ? <button type="button" disabled={disabled} onClick={() => setLimit(value => value + 6)} className="mt-3 min-h-11 rounded-full border border-brand-secondary px-4 py-2 text-sm text-brand-secondary">{copy.more}</button> : null}

    <details className="mt-4 border-t border-brand-secondary/20 pt-2">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-secondary">{ui.copy.sourceDetails}</summary>
      <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.usdaIntro}</p>
      <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.notScore}</p>
      {catalogue ? <p className="mt-3 text-sm text-brand-secondary">{copy.recorded}: <bdi>{catalogue.retrieved_on}</bdi> &middot; <a className="underline" href="https://fdc.nal.usda.gov/download-datasets/" target="_blank" rel="noopener noreferrer">USDA FoodData Central</a> &middot; CC0 1.0</p> : null}
    </details>
  </section>;
}
