"use client";

import { useEffect, useId, useState } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import {
  type AgeBand,
  ageBandFromParent,
  ageExperienceCopy,
  postAgeBandToParent,
  readSessionAgeBand,
  requestAgeBandFromParent,
  storeSessionAgeBand,
} from "@/lib/ageExperience";

export function useAgeExperience(): [AgeBand | null, (value: AgeBand | null) => void, boolean] {
  const [band, setBand] = useState<AgeBand | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const stored = readSessionAgeBand();
    if (stored) {
      setBand(stored);
      setResolved(true);
    }
    function onMessage(event: MessageEvent<unknown>) {
      const received = ageBandFromParent(event);
      if (!received) return;
      storeSessionAgeBand(received);
      setBand(received);
      setResolved(true);
    }
    window.addEventListener("message", onMessage);
    const parentRequested = requestAgeBandFromParent();
    let wait: ReturnType<typeof setTimeout> | undefined;
    if (!stored) {
      if (parentRequested) wait = setTimeout(() => setResolved(true), 800);
      else setResolved(true);
    }
    return () => {
      window.removeEventListener("message", onMessage);
      if (wait) clearTimeout(wait);
    };
  }, []);

  function update(value: AgeBand | null) {
    storeSessionAgeBand(value);
    setBand(value);
    setResolved(true);
    if (value) postAgeBandToParent(value);
  }
  return [band, update, resolved];
}

export function AgeExperienceControl({band, onChange}: {
  band: AgeBand | null;
  onChange: (value: AgeBand | null) => void;
}) {
  const display = useDisplayLanguage();
  const {copy, locale, direction} = ageExperienceCopy(display.enabled ? display.locale : "en");
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const options: Array<{band: AgeBand; label: string; note: string}> = [
    {band: "child", label: copy.child, note: copy.childNote},
    {band: "teen", label: copy.teen, note: copy.teenNote},
    {band: "adult", label: copy.adult, note: copy.adultNote},
  ];

  const current = band ? options.find(option => option.band === band)! : null;

  if (band && !editing) return (
    <div lang={locale} dir={direction} className="calorie-age-summary mb-3 flex justify-end" data-age-band={band}>
      <button type="button" onClick={() => setEditing(true)}
        className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-brand-secondary/25 bg-white px-3 py-2 text-xs font-semibold text-brand-secondary shadow-sm transition hover:border-brand-secondary/50 hover:bg-brand-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
        <span className="truncate"><bdi>{current?.label}</bdi></span>
        <span aria-hidden="true">·</span>
        <span className="shrink-0">{copy.change}</span>
      </button>
    </div>
  );

  return (
    <section aria-labelledby={titleId} lang={locale} dir={direction}
      className="calorie-age-picker mb-6 rounded-2xl border-2 border-brand-primary/25 bg-brand-bg p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-xl font-bold text-brand-primary">{copy.title}</h2>
        {band ? <button type="button" onClick={() => setEditing(false)}
          className="min-h-11 shrink-0 rounded-full border-2 border-brand-secondary bg-white px-4 py-2 text-sm font-semibold text-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          aria-label={copy.close}>{copy.close}</button> : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.intro}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {options.map(option => <button key={option.band} type="button" data-age-option={option.band} onClick={() => { onChange(option.band); setEditing(false); }}
          aria-pressed={band === option.band}
          className="min-h-28 rounded-xl border-2 border-brand-secondary/30 bg-white p-4 text-start transition hover:border-brand-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2">
          <span className="block font-bold text-brand-primary"><bdi>{option.label}</bdi></span>
          <span className="mt-2 block text-sm leading-relaxed text-brand-secondary">{option.note}</span>
        </button>)}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-brand-secondary">{copy.privacy}</p>
    </section>
  );
}
