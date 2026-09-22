"use client";
import { useState } from "react";
import translations from "@/config/xaman-install-copy.json";
import journey from "@/config/testnet-entry-copy.json";

export function XamanInstallGuide({ locale, onReady }: { locale: string; onReady: () => void }) {
  const copy = translations[locale as keyof typeof translations] ?? translations.en;
  const navigation = journey[locale as keyof typeof journey] ?? journey.en;
  const [device, setDevice] = useState<"android" | "ios" | "computer" | null>(null);
  const [step, setStep] = useState(0);
  const button = "min-h-11 rounded-xl border border-brand-secondary/30 px-3 py-2 text-sm font-semibold text-brand-secondary focus-visible:ring-2 focus-visible:ring-brand-primary";
  return <div data-xaman-install className="mt-4 rounded-2xl border border-brand-secondary/20 bg-brand-bg p-4">
    <fieldset><legend className="text-sm font-bold text-brand-primary">{copy.device}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{([["android", "Android"], ["ios", "iPhone"], ["computer", copy.computer]] as const).map(([key,label]) =>
        <button key={key} type="button" aria-pressed={device === key} onClick={() => { setDevice(key); setStep(0); }} className={`${button} ${device === key ? "bg-white ring-2 ring-brand-secondary" : ""}`}>{label}</button>)}
      </div>
    </fieldset>
    {device === "computer" ? <p className="mt-3 text-sm text-brand-secondary">{copy.desktop}</p> : device ? <>
      <p className="mt-4 text-xs font-bold text-brand-secondary">{navigation.stepOf.replace("{current}", String(step + 1)).replace("{total}", "3")}</p>
      <div className="mt-2 text-sm leading-relaxed text-brand-secondary" aria-live="polite">
        {step === 0 ? <><p>{copy.store}</p><p className="mt-2">{copy.install}</p>
          <a href={device === "android" ? "https://play.google.com/store/apps/details?id=com.xrpllabs.xumm" : "https://apps.apple.com/app/id1492302343"}
            target="_blank" rel="noopener noreferrer" className={`${button} mt-3 inline-flex items-center bg-white`}>Xaman · {device === "android" ? "Google Play" : "App Store"} ↗</a>
        </> : <p>{step === 1 ? copy.open : copy.return}</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {step > 0 ? <button type="button" className={button} onClick={() => setStep(value => value - 1)}>← {navigation.previous}</button> : null}
        <button type="button" className={`${button} bg-white`} onClick={() => step < 2 ? setStep(value => value + 1) : onReady()}>{step < 2 ? navigation.next : navigation.continueApp} →</button>
      </div>
    </> : null}
    <button type="button" className="mt-3 min-h-11 text-start text-sm font-semibold text-brand-secondary underline" onClick={onReady}>{copy.already}</button>
  </div>;
}
