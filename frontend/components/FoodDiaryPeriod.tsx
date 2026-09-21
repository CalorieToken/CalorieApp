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
  const button = "min-h-11 min-w-0 rounded-full border-2 border-brand-secondary px-3 py-2 text-sm font-semibold leading-snug text-brand-secondary [overflow-wrap:anywhere] hover:bg-brand-secondary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:opacity-50";
  return <div className="calorie-diary-period rounded-2xl border border-brand-secondary/20 bg-brand-bg p-4 sm:p-6">
    <h2 className="text-lg font-bold text-brand-primary">{copy.title}</h2>
    <div className="mt-3 grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={copy.title}>
      {(["day", "week", "month", "all"] as DiaryPeriod[]).map(value => <button key={value} type="button"
        disabled={disabled} aria-pressed={period === value} onClick={() => onChange(value, date)}
        className={`${button} ${period === value ? "bg-brand-secondary !text-white" : "bg-white"}`}>{copy[value]}</button>)}
    </div>
    {period !== "all" ? <div className="mt-4">
      <label className="mb-1 block text-xs text-brand-secondary" htmlFor={dateId}>{copy.date}</label>
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-stretch gap-2" data-diary-date-controls>
      <button type="button" className={`${button} !px-0 text-xl`} disabled={disabled} aria-label={copy.previous} onClick={() => onChange(period, moveDiaryDate(period, date, -1))}><span aria-hidden="true" className="block rtl:rotate-180">‹</span></button>
        <input id={dateId} type="date" value={date} min="1900-01-01" max="2100-12-31" disabled={disabled}
          onChange={e => { if (e.target.value && e.target.validity.valid) onChange(period, e.target.value); }}
          className="min-h-11 w-full min-w-0 max-w-full rounded-lg border border-brand-secondary/30 bg-white px-2 text-base text-brand-secondary" />
      <button type="button" className={`${button} !px-0 text-xl`} disabled={disabled} aria-label={copy.next} onClick={() => onChange(period, moveDiaryDate(period, date, 1))}><span aria-hidden="true" className="block rtl:rotate-180">›</span></button>
      </div>
      <button type="button" className={`${button} mt-2 w-full bg-white`} disabled={disabled} onClick={() => onChange(period, localDiaryDate())}>{period === "week" ? copy.thisWeek : period === "month" ? copy.thisMonth : copy.today}</button>
    </div> : null}
    <p className="mt-4 font-semibold text-brand-primary" role="status"><bdi>{label}</bdi></p>
    <p className="mt-2 text-xs text-brand-secondary/80">{copy.scope}</p>
  </div>;
}
