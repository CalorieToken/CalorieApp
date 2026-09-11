"use client";
import { useId } from "react";
import { DiaryPeriod, diaryCopy, diaryRange, localDiaryDate, moveDiaryDate } from "@/lib/foodDiary";

export function FoodDiaryPeriod({period, date, locale, disabled, onChange}: {
  period: DiaryPeriod; date: string; locale: string; disabled: boolean;
  onChange: (period: DiaryPeriod, date: string) => void;
}) {
  const copy = diaryCopy(locale), dateId = useId();
  const range = diaryRange(period, date);
  const format = (value: Date) => new Intl.DateTimeFormat(locale, {day: "numeric", month: "long", year: "numeric"}).format(value);
  const label = range ? (period === "day" ? format(range.start)
    : `${format(range.start)} – ${format(new Date(range.end.getTime() - 1))}`) : copy.all;
  const button = "min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 text-sm font-semibold text-brand-secondary hover:bg-brand-secondary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:opacity-50";
  return <div className="rounded-2xl border border-brand-secondary/20 bg-brand-bg p-5 sm:p-6">
    <h2 className="text-lg font-bold text-brand-primary">{copy.title}</h2>
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={copy.title}>
      {(["day", "week", "month", "all"] as DiaryPeriod[]).map(value => <button key={value} type="button"
        disabled={disabled} aria-pressed={period === value} onClick={() => onChange(value, date)}
        className={`${button} ${period === value ? "bg-brand-secondary !text-white" : "bg-white"}`}>{copy[value]}</button>)}
    </div>
    {period !== "all" ? <div className="mt-4 flex flex-wrap items-end gap-2">
      <button type="button" className={button} disabled={disabled} aria-label={copy.previous} onClick={() => onChange(period, moveDiaryDate(period, date, -1))}>‹</button>
      <div className="min-w-0 flex-1 basis-40"><label className="block text-xs text-brand-secondary" htmlFor={dateId}>{copy.date}</label>
        <input id={dateId} type="date" value={date} min="1900-01-01" max="2100-12-31" disabled={disabled}
          onChange={e => { if (e.target.value && e.target.validity.valid) onChange(period, e.target.value); }}
          className="min-h-11 w-full min-w-0 rounded-lg border border-brand-secondary/30 bg-white px-3 text-brand-secondary" /></div>
      <button type="button" className={button} disabled={disabled} aria-label={copy.next} onClick={() => onChange(period, moveDiaryDate(period, date, 1))}>›</button>
      <button type="button" className={button} disabled={disabled} onClick={() => onChange(period, localDiaryDate())}>{copy.today}</button>
    </div> : null}
    <p className="mt-4 font-semibold text-brand-primary" role="status"><bdi>{label}</bdi></p>
    <p className="mt-2 text-xs text-brand-secondary/80">{copy.scope}</p>
  </div>;
}
