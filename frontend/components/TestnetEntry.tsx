"use client";

import { useEffect, useRef, useState } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { localeDirection } from "@/lib/locales";
import translations from "@/config/testnet-entry-copy.json";
import setupTranslations from "@/config/account-setup-copy.json";
import { readAccountJourney, saveAccountJourney } from "@/lib/accountJourney";
import { postNavigationTarget } from "@/lib/navigationBridge";
import { checkTestnetAccount, createTestnetAccount, testnetWait, TestnetRequestError, type TestnetAccount, type TestnetFailure } from "@/lib/testnetAccount";

export type AccountJourneyDestination = "account" | "packaged" | "diary";
type Route = "test" | "move";
type TestnetEntryProps = {
  active?: boolean;
  requestedJourney?: { step: Route; serial: number };
  onNavigate: (destination: AccountJourneyDestination) => void;
  onOpenAccountTools: (destination?: "export" | "import" | "session") => void;
};
const primary = "min-h-11 rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2";
const secondary = "min-h-11 rounded-xl border border-brand-secondary/30 bg-white px-4 py-3 text-sm font-bold text-brand-secondary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary";

function Acknowledgement({ checked, disabled = false, onChange, children }: {
  checked: boolean; disabled?: boolean; onChange: (value: boolean) => void; children: React.ReactNode;
}) {
  return <label className={`mt-4 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-brand-secondary/20 bg-brand-bg p-3 text-sm font-semibold leading-relaxed text-brand-secondary ${disabled ? "opacity-50" : ""}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-primary" />
    <span>{children}</span>
  </label>;
}

export function TestnetEntry({ active = true, requestedJourney, onNavigate, onOpenAccountTools }: TestnetEntryProps) {
  const display = useDisplayLanguage();
  const locale = display.enabled && display.locale in translations ? display.locale as keyof typeof translations : "en";
  const copy = translations[locale], setup = setupTranslations[locale];
  const [route, setRoute] = useState<Route | null>(null);
  const [index, setIndex] = useState(0);
  const positions = useRef({ test: 0, move: 0 });
  const [restored, setRestored] = useState(false);
  const [restartNotice, setRestartNotice] = useState(false);
  const [account, setAccount] = useState<TestnetAccount | null>(null);
  const accountRef = useRef<TestnetAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<TestnetFailure | null>(null);
  const [funding, setFunding] = useState<"created" | "checking" | "funded" | "pending">("created");
  const [shown, setShown] = useState(false);
  const [accessed, setAccessed] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(false);
  savedRef.current = saved;
  const [imported, setImported] = useState(false);
  const [mainSaved, setMainSaved] = useState(false);
  const [copyNotice, setCopyNotice] = useState<"copiedSafe" | "manualCopy" | null>(null);
  const [waits, setWaits] = useState({ create: 0, check: 0 });
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const viewGeneration = useRef(0);
  const currentView = useRef({ route, index, active });
  currentView.current = { route, index, active };
  const heading = useRef<HTMLHeadingElement | null>(null);
  const importEnabled = process.env.NEXT_PUBLIC_ACCOUNT_DATA_IMPORT_UI_ENABLED === "true";

  function choose(next: Route) {
    setRoute(next); setIndex(positions.current[next]);
  }
  function go(next: number) {
    if (!route) return;
    setShown(false); setCopyNotice(null); viewGeneration.current++;
    positions.current[route] = next;
    setIndex(next);
    saveAccountJourney({ route, index: next });
  }

  useEffect(() => {
    const previous = readAccountJourney();
    if (previous) {
      // Recovery data and acknowledgements are deliberately not restored.
      // Revisiting migration after a login still requires the backup checkpoint.
      const next = previous.route === "test" ? 0 : Math.min(previous.index, 3);
      positions.current[previous.route] = next;
      setRoute(previous.route); setIndex(next);
      setRestartNotice(previous.route === "test" && previous.index > 0);
    }
    setRestored(true);
  }, []);
  useEffect(() => { if (requestedJourney) choose(requestedJourney.step); }, [requestedJourney]);
  useEffect(() => {
    if (restored && route) saveAccountJourney({ route, index });
  }, [route, index, restored]);
  useEffect(() => {
    viewGeneration.current++; setShown(false); setCopyNotice(null);
    if (!active) return;
    const frame = window.requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      const screen = heading.current?.closest("[data-account-guide]") ?? null;
      if (!postNavigationTarget("calorieapp-navigation", screen)) screen?.scrollIntoView?.({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route, index, active]);
  useEffect(() => {
    const tick = () => setWaits({ create: testnetWait("create"), check: testnetWait("check") });
    tick(); const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const conceal = () => { viewGeneration.current++; setShown(false); setCopyNotice(null); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (accountRef.current && !savedRef.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const clear = () => {
      generation.current++; request.current?.abort(); request.current = null;
      accountRef.current = null; setAccount(null); setCreating(false);
      setAccessed(false); setSaved(false); setImported(false); conceal();
      positions.current.test = 0;
      if (currentView.current.route === "test") { setIndex(0); setRestartNotice(true); }
    };
    document.addEventListener("visibilitychange", conceal);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", clear);
    return () => {
      generation.current++; viewGeneration.current++;
      request.current?.abort(); request.current = null; accountRef.current = null;
      document.removeEventListener("visibilitychange", conceal);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", clear);
    };
  }, []);

  async function verify(value: TestnetAccount) {
    if (request.current || testnetWait("check")) return;
    const controller = new AbortController(), current = generation.current;
    request.current = controller; setFunding("checking");
    const funded = await checkTestnetAccount(value.address, controller.signal);
    if (current === generation.current && !controller.signal.aborted) setFunding(funded ? "funded" : "pending");
    if (request.current === controller) request.current = null;
  }
  async function create() {
    if (request.current || accountRef.current || testnetWait("create")) return;
    const controller = new AbortController(), current = generation.current;
    request.current = controller; setCreating(true); setFailure(null);
    try {
      const value = await createTestnetAccount(controller.signal);
      if (current !== generation.current || controller.signal.aborted) return;
      accountRef.current = value; setAccount(value); setRestartNotice(false);
      positions.current.test = 2;
      if (currentView.current.route === "test") setIndex(2);
    } catch (error) {
      if (current === generation.current && !controller.signal.aborted) setFailure(error instanceof TestnetRequestError ? error.code : "connectionFailed");
    } finally {
      if (request.current === controller) request.current = null;
      if (current === generation.current) setCreating(false);
    }
    if (current === generation.current && accountRef.current) await verify(accountRef.current);
  }
  async function copySecret() {
    const value = accountRef.current, current = viewGeneration.current;
    if (!value || !active) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(value.secret);
      if (current !== viewGeneration.current || !currentView.current.active || accountRef.current !== value) return;
      setAccessed(true); setCopyNotice("copiedSafe");
    } catch {
      if (current !== viewGeneration.current || !currentView.current.active || accountRef.current !== value) return;
      setShown(true); setAccessed(true); setCopyNotice("manualCopy");
    }
  }

  const testTitles = [setup.beforeStart, setup.stepCreate, setup.saveTitle, setup.stepNetwork, setup.stepImport, setup.stepReturn];
  const moveTitles = [copy.moveLabels[0], copy.moveLabels[1], copy.moveLabels[2], setup.mainBackupTitle, copy.moveLabels[3], copy.moveLabels[4], copy.continueApp];
  const titles = route === "move" ? moveTitles : testTitles;
  const canNext = route === "move" ? index !== 3 || mainSaved
    : index === 1 ? !!account : index === 2 ? saved : index === 4 ? imported : true;
  const secretControls = account && active ? <div className="mt-4 rounded-xl border border-brand-secondary/20 p-3">
    <p className="text-xs font-bold text-brand-secondary">{setup.recovery}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className={secondary} aria-expanded={shown} aria-controls="account-guide-secret" onClick={() => { setShown(value => !value); setAccessed(true); }}>{setup.show}</button>
      <button type="button" className={secondary} onClick={copySecret}>{setup.copySeed}</button>
    </div>
    <code id="account-guide-secret" dir="ltr" hidden={!shown} className="mt-3 block break-all rounded-lg bg-brand-bg p-3 text-sm text-brand-secondary">{shown ? account.secret : ""}</code>
    {copyNotice ? <p role="status" className="mt-2 text-xs leading-relaxed text-brand-secondary">{setup[copyNotice]}</p> : null}
  </div> : null;
  const warning = (text: string) => <p role="note" className="mt-3 rounded-xl border-s-4 border-brand-accent bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">{text}</p>;
  const official = <a className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-secondary underline" href="https://xrpl.org/resources/dev-tools/xrp-faucets" target="_blank" rel="noopener noreferrer">{setup.official} ↗</a>;

  return <section className="calorie-journey-card rounded-2xl border border-brand-secondary/20 bg-white shadow-sm"
    lang={locale} dir={localeDirection(locale)} aria-labelledby="account-journey-title" data-account-guide={route ?? "choose"}>
    <header className="border-b border-brand-secondary/10 px-4 pb-4 pt-3 sm:px-6">
      <button type="button" onClick={() => { setShown(false); onNavigate("account"); }} className="-ms-2 mb-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-brand-secondary">
        <span aria-hidden="true">{localeDirection(locale) === "rtl" ? "→" : "←"}</span>{setup.backToAccount}
      </button>
      <p className="text-xs font-bold text-brand-secondary">{route === "test" ? copy.testRoute : route === "move" ? copy.moveRoute : copy.journeyTab}</p>
      {route ? <>
        <p className="mt-2 text-xs text-brand-secondary" aria-live="polite">{copy.stepOf.replace("{current}", String(index + 1)).replace("{total}", String(titles.length))}</p>
        <div role="progressbar" aria-label={route === "test" ? copy.testRoute : copy.moveRoute} aria-valuemin={1} aria-valuemax={titles.length} aria-valuenow={index + 1} className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-secondary/10">
          <span className="block h-full bg-brand-primary" style={{ width: `${((index + 1) / titles.length) * 100}%` }} />
        </div>
      </> : null}
    </header>
    <div key={`${route}-${index}`} data-account-guide-screen className="p-4 sm:p-6">
      <h2 id="account-journey-title" ref={heading} tabIndex={-1} className="text-xl font-bold leading-snug text-brand-primary focus:outline-none">{route ? titles[index] : copy.journeyTitle}</h2>
      {!route ? <>
        <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{copy.journeyIntro}</p>
        <div className="mt-5 grid gap-3">
          <button type="button" className={primary} onClick={() => choose("test")}>{copy.testRoute}</button>
          <button type="button" className={secondary} onClick={() => choose("move")}>{copy.moveRoute}</button>
        </div>
      </> : route === "test" ? <>
        {index === 0 ? <>
          <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{setup.ready}</p>
          {warning(setup.testOnly)}
          {restartNotice ? <p role="status" className="mt-3 text-sm leading-relaxed text-brand-secondary">{setup.restartNotice}</p> : null}
        </> : null}
        {index === 1 ? <>
          <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{setup.privacy}</p>
          {account ? <p role="status" className="mt-4 text-sm font-bold text-brand-primary">{setup.created}</p> : <>
            <button type="button" className={`${primary} mt-4 w-full`} disabled={creating || waits.create > 0} onClick={create}>{creating ? setup.creating : waits.create > 0 ? setup.waitCreate.replace("{seconds}", String(waits.create)) : setup.create}</button>
            {failure ? <div role="alert" className="mt-3 text-sm leading-relaxed text-brand-secondary"><p>{setup[failure]}</p>{official}</div> : null}
          </>}
        </> : null}
        {index === 2 ? <>
          {warning(copy.seedWarning)}
          <p className="mt-3 text-xs leading-relaxed text-brand-secondary">{setup.privacyNote}</p>
          {secretControls}
          <Acknowledgement checked={saved} disabled={!accessed} onChange={setSaved}>{setup.saveAck}</Acknowledgement>
        </> : null}
        {index === 3 ? <>
          <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{setup.import1}</p>
          <a className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-secondary underline" href="https://help.xaman.app/app/learning-more-about-xaman/how-to-access-testnet-on-xrp-ledger" target="_blank" rel="noopener noreferrer">{setup.networkHelp} ↗</a>
        </> : null}
        {index === 4 ? <>
          {secretControls}
          <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{setup.import2}</p>
          {account ? <p className="mt-3 text-xs text-brand-secondary">{setup.account}<code dir="ltr" className="mt-1 block break-all rounded-lg bg-brand-bg p-2">{account.address}</code></p> : null}
          <Acknowledgement checked={imported} onChange={setImported}>{setup.testImported}</Acknowledgement>
        </> : null}
        {index === 5 ? <>
          <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{setup.import3}</p>
          {account ? <code dir="ltr" className="mt-3 block break-all rounded-lg bg-brand-bg p-3 text-xs text-brand-secondary">{account.address}</code> : null}
          <p role="status" className="mt-3 text-sm font-semibold text-brand-secondary">{setup[funding]}</p>
          {account && funding !== "funded" ? <button type="button" className={`${secondary} mt-3`} disabled={funding === "checking" || waits.check > 0} onClick={() => verify(account)}>{waits.check > 0 ? setup.waitCheck.replace("{seconds}", String(waits.check)) : setup.check}</button> : null}
        </> : null}
      </> : <>
        {index === 0 ? <>
          {warning(copy.moveText)}
          <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{copy.moveSteps[0]}</p>
          <p className="mt-3 rounded-xl bg-brand-bg p-3 text-sm leading-relaxed text-brand-secondary">{importEnabled ? copy.importReady : copy.importPending}</p>
          <button type="button" className={`${secondary} mt-4`} onClick={() => onOpenAccountTools("export")}>{copy.openExportTools}</button>
        </> : null}
        {index === 1 ? <>
          <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{copy.moveSteps[1]}</p>
          <button type="button" className={`${secondary} mt-4`} onClick={() => onOpenAccountTools("session")}>{copy.openSignOut}</button>
        </> : null}
        {index === 2 ? <>
          <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{copy.moveSteps[2]}</p>
          <a href="https://help.xaman.app/" target="_blank" rel="noopener noreferrer" className={`${secondary} mt-4 inline-flex items-center`}>{copy.openXamanInstructions} ↗</a>
        </> : null}
        {index === 3 ? <>
          {warning(setup.mainBackupText)}
          <Acknowledgement checked={mainSaved} onChange={setMainSaved}>{setup.mainBackupAck}</Acknowledgement>
        </> : null}
        {index === 4 ? <>
          <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{copy.moveSteps[3]}</p>
          <button type="button" className={`${secondary} mt-4`} onClick={() => onNavigate("account")}>{copy.openSignIn}</button>
        </> : null}
        {index === 5 ? <>
          <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{importEnabled ? copy.moveSteps[4] : copy.importPending}</p>
          {importEnabled ? <button type="button" className={`${secondary} mt-4`} onClick={() => onOpenAccountTools("import")}>{copy.openImportTools}</button> : null}
        </> : null}
        {index === 6 ? <p className="mt-3 text-sm leading-relaxed text-brand-secondary">{importEnabled ? copy.finishText : copy.importPending}</p> : null}
      </>}
    </div>
    {route ? <footer className="flex items-center justify-between gap-3 border-t border-brand-secondary/10 bg-white px-4 py-3 sm:px-6">
      <button type="button" className={secondary} disabled={creating} onClick={() => index > 0 ? go(index - 1) : setRoute(null)}>{copy.previous}</button>
      {index < titles.length - 1 ? <button type="button" className={primary} disabled={!canNext || creating} onClick={() => go(index + 1)}>{copy.next}</button>
        : <button type="button" className={primary} onClick={() => onNavigate(route === "test" ? "account" : "packaged")}>{route === "test" ? copy.openSignIn : copy.continueApp}</button>}
    </footer> : null}
  </section>;
}
