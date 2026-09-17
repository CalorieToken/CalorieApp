"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { localeDirection } from "@/lib/locales";
import translations from "@/config/testnet-entry-copy.json";
import { readAccountJourney, saveAccountJourney } from "@/lib/accountJourney";

const origins = ["https://calorietoken.net", "https://www.calorietoken.net"];
const prefix = "calorieapp:testnet-guide:";
const steps = ["test", "practice", "move", "finish"] as const;

type JourneyStep = typeof steps[number];
export type AccountJourneyDestination = "account" | "packaged" | "diary";

type TestnetEntryProps = {
  requestedJourney?: { step: "test" | "move"; serial: number };
  onNavigate: (destination: AccountJourneyDestination) => void;
  onOpenAccountTools: (destination?: "export" | "import" | "session") => void;
};

export function exactGuideMessage(value: unknown, type: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return Object.keys(data).length === 2 && data.type === prefix + type && data.version === 1;
}

export function TestnetEntry({ requestedJourney, onNavigate, onOpenAccountTools }: TestnetEntryProps) {
  const display = useDisplayLanguage();
  const locale = display.enabled && display.locale in translations ? display.locale : "en";
  const copy = translations[locale as keyof typeof translations];
  const [host, setHost] = useState<string | null>(null);
  const [step, setStep] = useState<JourneyStep>("test");
  const [moveIndex, setMoveIndex] = useState(0);
  const [restored, setRestored] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const moveTitle = useRef<HTMLHeadingElement | null>(null);
  const launchRef = useRef<HTMLAnchorElement | null>(null);
  const importEnabled = process.env.NEXT_PUBLIC_ACCOUNT_DATA_IMPORT_UI_ENABLED === "true";
  const stepIndex = steps.indexOf(step);

  useEffect(() => {
    const saved = readAccountJourney();
    if (saved) { setStep(saved.step); setMoveIndex(saved.moveIndex); }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (requestedJourney) { setStep(requestedJourney.step); setNotice(null); }
  }, [requestedJourney]);
  useEffect(() => {
    if (restored && (requestedJourney || readAccountJourney())) saveAccountJourney({ step, moveIndex });
  }, [step, moveIndex, restored, requestedJourney]);

  useEffect(() => {
    if (window.parent === window) return;
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || !origins.includes(event.origin)) return;
      if (exactGuideMessage(event.data, "available")) {
        setHost(event.origin);
        return;
      }
      if (exactGuideMessage(event.data, "complete")) {
        setHost(event.origin);
        setStep("practice");
        setNotice(copy.completed);
        onNavigate("account");
        return;
      }
      if (exactGuideMessage(event.data, "closed")) {
        setHost(event.origin);
        setNotice(copy.closed);
        window.requestAnimationFrame(() => launchRef.current?.focus());
      }
    };
    window.addEventListener("message", receive);
    origins.forEach(origin => window.parent.postMessage({ type: prefix + "ready", version: 1 }, origin));
    return () => window.removeEventListener("message", receive);
  }, [copy.closed, copy.completed, onNavigate]);

  function selectStep(next: JourneyStep, focus = false) {
    setStep(next);
    setNotice(null);
    saveAccountJourney({ step: next, moveIndex });
    if (focus) {
      const index = steps.indexOf(next);
      window.requestAnimationFrame(() => tabRefs.current[index]?.focus());
    }
  }

  function handleStepKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    const forward = localeDirection(locale) === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = localeDirection(locale) === "rtl" ? "ArrowRight" : "ArrowLeft";
    if (event.key === forward || event.key === "ArrowDown") next = (index + 1) % steps.length;
    else if (event.key === backward || event.key === "ArrowUp") next = (index - 1 + steps.length) % steps.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = steps.length - 1;
    else return;
    event.preventDefault();
    selectStep(steps[next], true);
  }

  function openGuide(event: React.MouseEvent<HTMLAnchorElement>) {
    saveAccountJourney({ step, moveIndex });
    if (!host || window.parent === window) return;
    event.preventDefault();
    setNotice(null);
    window.parent.postMessage({ type: prefix + "open", version: 1 }, host);
  }

  function selectMove(next: number) {
    setMoveIndex(next);
    saveAccountJourney({ step: "move", moveIndex: next });
    window.requestAnimationFrame(() => moveTitle.current?.focus());
  }

  const labels: Record<JourneyStep, string> = {
    test: copy.testStep,
    practice: copy.practiceStep,
    move: copy.moveStep,
    finish: copy.finishStep,
  };

  return (
    <section className="calorie-journey-card rounded-2xl border border-brand-secondary/20 bg-white p-4 shadow-sm sm:p-6"
      lang={locale} dir={localeDirection(locale)} aria-labelledby="account-journey-title">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-secondary/70">{copy.journeyTab}</p>
      <h2 id="account-journey-title" className="mt-1 text-xl font-bold text-brand-primary">{copy.journeyTitle}</h2>
      <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.journeyIntro}</p>

      <div role="tablist" aria-label={copy.journeyTitle}
        className="calorie-journey-steps mt-5 grid grid-cols-2 gap-2 rounded-xl bg-brand-bg p-2 sm:grid-cols-4">
        {steps.map((item, index) => (
          <button key={item} ref={node => { tabRefs.current[index] = node; }} type="button"
            id={`account-journey-tab-${item}`} role="tab" aria-selected={step === item}
            aria-controls={`account-journey-panel-${item}`} tabIndex={step === item ? 0 : -1}
            onClick={() => selectStep(item)} onKeyDown={event => handleStepKey(event, index)}
            className={`min-h-12 rounded-lg px-2 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary ${step === item ? "bg-brand-primary text-white shadow-sm" : "bg-white text-brand-primary hover:bg-brand-secondary/10"}`}>
            {labels[item]}
          </button>
        ))}
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-brand-secondary/10"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={stepIndex + 1}
        aria-label={copy.journeyTitle}
      >
        <span className="block h-full rounded-full bg-brand-primary transition-[width]"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs font-semibold text-brand-secondary" aria-live="polite">{stepIndex + 1} / {steps.length}</p>
      {notice ? <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{notice}</p> : null}

      <div id="account-journey-panel-test" role="tabpanel" aria-labelledby="account-journey-tab-test"
        hidden={step !== "test"} className="calorie-journey-panel mt-4">
        <h3 className="text-base font-bold text-brand-primary">{copy.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.description}</p>
        <div role="note" className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">
          <strong className="block">{copy.seedTitle}</strong>
          <span className="mt-1 block">{copy.seedWarning}</span>
        </div>
        <a ref={launchRef} href="https://calorietoken.net/index.php/calorieapp/#ctstyle-testnet" target="_top" onClick={openGuide}
          className="mt-4 inline-flex min-h-12 items-center rounded-full bg-brand-primary px-5 py-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary">
          {copy.start}
        </a>
        <p className="mt-3 text-xs leading-relaxed text-brand-secondary">{copy.scope}</p>
      </div>

      <div id="account-journey-panel-practice" role="tabpanel" aria-labelledby="account-journey-tab-practice"
        hidden={step !== "practice"} className="calorie-journey-panel mt-4">
        <h3 className="text-base font-bold text-brand-primary">{copy.practiceStep}</h3>
        <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.practiceText}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate("account")}
            className="min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-bold text-white">{copy.openSignIn}</button>
          <button type="button" onClick={() => onNavigate("packaged")}
            className="min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-bold text-white">{copy.openSearch}</button>
          <button type="button" onClick={() => onNavigate("diary")}
            className="min-h-11 rounded-full border-2 border-brand-secondary bg-white px-5 py-2 text-sm font-bold text-brand-secondary">{copy.openDiary}</button>
        </div>
      </div>

      <div id="account-journey-panel-move" role="tabpanel" aria-labelledby="account-journey-tab-move"
        hidden={step !== "move"} className="calorie-journey-panel mt-4">
        <h3 className="text-base font-bold text-brand-primary">{copy.moveStep}</h3>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold leading-relaxed text-amber-950">{copy.moveText}</p>
        <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={copy.moveRoute}>
          {copy.moveLabels.map((label, index) => <button key={label} type="button" onClick={() => selectMove(index)}
            aria-current={moveIndex === index ? "step" : undefined}
            className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold ${moveIndex === index ? "border-brand-primary bg-brand-primary text-white" : "border-brand-secondary/20 bg-brand-bg text-brand-secondary"}`}>
            {index + 1}. {label}
          </button>)}
        </nav>
        <p className="mt-4 text-xs font-semibold text-brand-secondary" aria-live="polite">{copy.stepOf.replace("{current}", String(moveIndex + 1)).replace("{total}", "5")}</p>
        <h4 ref={moveTitle} tabIndex={-1} className="mt-2 text-lg font-bold text-brand-primary">{copy.moveLabels[moveIndex]}</h4>
        <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.moveSteps[moveIndex]}</p>
        {moveIndex === 0 || moveIndex === 4 ? <p className="mt-4 rounded-lg bg-brand-bg px-3 py-2 text-sm leading-relaxed text-brand-secondary">
          {importEnabled ? copy.importReady : copy.importPending}
        </p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {moveIndex === 0 ? <button type="button" onClick={() => onOpenAccountTools("export")}
            className="min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-bold text-white">{copy.openExportTools}</button> : null}
          {moveIndex === 1 ? <button type="button" onClick={() => onOpenAccountTools("session")}
            className="min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-bold text-white">{copy.openSignOut}</button> : null}
          {moveIndex === 2 ? <a href="https://help.xaman.app/app/getting-started-with-xaman/your-first-xrp-ledger-account/how-to-create-an-xrpl-account" target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-full bg-brand-primary px-5 py-2 text-sm font-bold text-white">{copy.openXamanInstructions}</a> : null}
          {moveIndex === 3 ? <button type="button" onClick={() => onNavigate("account")}
            className="min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-bold text-white">{copy.openSignIn}</button> : null}
          {moveIndex === 4 && importEnabled ? <button type="button" onClick={() => onOpenAccountTools("import")}
            className="min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-bold text-white">{copy.openImportTools}</button> : null}
        </div>
      </div>

      <div id="account-journey-panel-finish" role="tabpanel" aria-labelledby="account-journey-tab-finish"
        hidden={step !== "finish"} className="calorie-journey-panel mt-4">
        <h3 className="text-base font-bold text-brand-primary">{copy.finishStep}</h3>
        <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.finishText}</p>
        <button type="button" onClick={() => onNavigate("packaged")}
          className="mt-4 min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-bold text-white">{copy.continueApp}</button>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-brand-secondary/10 pt-4">
        <button type="button" onClick={() => step === "move" && moveIndex > 0 ? selectMove(moveIndex - 1) : selectStep(steps[Math.max(0, stepIndex - 1)], true)} disabled={stepIndex === 0}
          className="min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 text-sm font-bold text-brand-secondary disabled:opacity-40">{copy.previous}</button>
        <button type="button" onClick={() => step === "move" && moveIndex < 4 ? selectMove(moveIndex + 1) : selectStep(steps[Math.min(steps.length - 1, stepIndex + 1)], true)} disabled={stepIndex === steps.length - 1}
          className="min-h-11 rounded-full bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{copy.next}</button>
      </div>
    </section>
  );
}
