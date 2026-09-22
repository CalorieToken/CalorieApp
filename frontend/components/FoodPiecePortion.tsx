"use client";
import { type PieceAmount } from "@/lib/foodPieces";
import translations from "@/config/food-pieces-copy.json";

export function FoodPiecePortion({ value, onChange, locale, disabled, valid }: {
  value: PieceAmount; onChange: (value: PieceAmount) => void; locale: string; disabled: boolean; valid: boolean;
}) {
  const copy = translations[locale as keyof typeof translations] ?? translations.en;
  return <fieldset className="mt-3 rounded-xl border border-brand-secondary/20 bg-white p-3">
    <legend className="px-1 text-sm font-semibold text-brand-secondary">{copy.title}</legend>
    <p className="text-xs leading-relaxed text-brand-secondary">{copy.help}</p>
    <label className="mt-3 block text-sm text-brand-secondary">{copy.basis}
      <select value={value.basis} disabled={disabled} onChange={event => onChange({ ...value, basis: event.target.value as PieceAmount["basis"] })} className="mt-1 min-h-11 w-full rounded-lg border border-brand-secondary/30 bg-white px-2">
        <option value="pack">{copy.pack}</option><option value="piece">{copy.piece}</option>
      </select>
    </label>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      {([['eaten',copy.eaten], ...(value.basis === "pack" ? [['total',copy.total]] : []), ['weight',value.basis === "pack" ? copy.packWeight : copy.pieceWeight]] as [keyof Pick<PieceAmount,"eaten"|"total"|"weight">,string][]).map(([key,label]) => <label key={key} className="text-sm text-brand-secondary">{label}
        <input type="text" inputMode="decimal" maxLength={9} value={value[key]} disabled={disabled} onChange={event => onChange({ ...value, [key]: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-brand-secondary/30 px-2" />
      </label>)}
    </div>
    {!valid ? <p className="mt-2 text-xs text-brand-secondary">{copy.incomplete}</p> : null}
  </fieldset>;
}
