"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { AgeExperienceControl, useAgeExperience } from "@/components/AgeExperienceControl";
import { FoodSearchPlaceholder, type FoodWorkspaceView } from "@/components/FoodSearchPlaceholder";
import { AccountWelcome } from "@/components/AccountWelcome";
import welcomeTranslations from "@/config/account-welcome-copy.json";
import { TestnetEntry } from "@/components/TestnetEntry";
import profileTranslations from "@/config/account-profile-copy.json";
import { XamanLoginPanel, type MeResponse } from "@/components/XamanLoginPanel";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { diaryCopy } from "@/lib/foodDiary";
import { foodExperience } from "@/lib/foodExperience";
import { discoveryCopy } from "@/lib/foodDiscovery";
import { getFoodUi } from "@/lib/foodUi";
import journeyTranslations from "@/config/testnet-entry-copy.json";
import setupTranslations from "@/config/account-setup-copy.json";
import { clearAccountJourney, readAccountJourney } from "@/lib/accountJourney";
import { clearAccountGuideEntry, connectAppEntry, type AppEntryTarget } from "@/lib/appEntryBridge";
import { postNavigationTarget } from "@/lib/navigationBridge";

type WorkspaceTab = "account" | "journey" | FoodWorkspaceView;

export function CalorieAppWorkspace() {
  const display = useDisplayLanguage();
  const { copy: foodCopy, locale, direction } = getFoodUi(
    display.enabled ? display.locale : "en"
  );
  const experience = foodExperience(locale);
  const diary = diaryCopy(locale);
  const journey = journeyTranslations[locale as keyof typeof journeyTranslations] ?? journeyTranslations.en;
  const setup = setupTranslations[locale as keyof typeof setupTranslations] ?? setupTranslations.en;
  const [ageBand, setAgeBand, ageResolved = true] = useAgeExperience();
  const allowPersonalFeatures = ageBand === "adult";
  const [account, setAccount] = useState<MeResponse | null>(null);
  const profileCopy = profileTranslations[locale as keyof typeof profileTranslations] ?? profileTranslations.en;
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("account");
  const [tabHistory, setTabHistory] = useState<WorkspaceTab[]>([]);
  const [requestedJourney, setRequestedJourney] = useState<{ step: "test" | "move"; serial: number }>();
  const [returnToJourney, setReturnToJourney] = useState(false);
  const [journeyInstance, setJourneyInstance] = useState(0);
  const [cancelJourneyRequest, setCancelJourneyRequest] = useState(0);
  const [pendingEntry, setPendingEntry] = useState<AppEntryTarget | null>(null);
  const [requestedFoodEntry, setRequestedFoodEntry] = useState<{ target: AppEntryTarget; serial: number }>();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    ...(allowPersonalFeatures ? [{ id: "account" as const, label: profileCopy.account }] : []),
    { id: "packaged", label: foodCopy.searchTitle },
    { id: "basic", label: experience.copy.sourceTitle },
    ...(allowPersonalFeatures ? [{ id: "diary" as const, label: diary.title }] : []),
  ];
  const visibleTab: WorkspaceTab = !allowPersonalFeatures && (activeTab === "account" || activeTab === "journey" || activeTab === "diary")
    ? "packaged" : activeTab;

  useEffect(() => {
    setReturnToJourney(readAccountJourney() !== null);
    try { window.sessionStorage.removeItem("calorieapp.nickname.v1"); } catch { /* Discard the old, unbound tab-only nickname. */ }
  }, []);

  useEffect(() => connectAppEntry(setPendingEntry), []);

  useEffect(() => {
    if (!pendingEntry || !ageResolved || !ageBand) return;
    const personal = ["test-account", "move-account", "account", "account-export", "food-diary"].includes(pendingEntry);
    if (personal && !allowPersonalFeatures) return;
    if (pendingEntry === "test-account" || pendingEntry === "move-account") {
      const step = pendingEntry === "test-account" ? "test" : "move";
      setRequestedJourney(current => ({ step, serial: (current?.serial ?? 0) + 1 }));
      setReturnToJourney(true);
      setActiveTab("journey");
    } else {
      const tab: WorkspaceTab = pendingEntry === "account" || pendingEntry === "account-export" ? "account"
        : pendingEntry === "food-diary" ? "diary" : pendingEntry === "basic-foods" ? "basic" : "packaged";
      setActiveTab(tab);
      setRequestedFoodEntry(current => ({ target: pendingEntry, serial: (current?.serial ?? 0) + 1 }));
      window.requestAnimationFrame(() => {
        const element = document.getElementById(`calorie-panel-${tab}`);
        if (element) postNavigationTarget("calorieapp-navigation", element);
        if (pendingEntry === "account-export") {
          window.dispatchEvent(new CustomEvent("calorieapp:open-account-tools", { detail: { destination: "export" } }));
        } else if (tab !== "packaged") {
          document.getElementById(`calorie-tab-${tab}`)?.focus({ preventScroll: true });
        }
      });
    }
    setPendingEntry(null);
  }, [pendingEntry, ageResolved, ageBand, allowPersonalFeatures]);

  useEffect(() => {
    if (ageBand && !allowPersonalFeatures) {
      setAccount(null);
      setActiveTab(current => current === "account" || current === "journey" || current === "diary" ? "packaged" : current);
    }
  }, [ageBand, allowPersonalFeatures]);

  function selectTab(tab: WorkspaceTab, focus = false, remember = true) {
    if (remember && tab !== visibleTab && visibleTab !== "journey") setTabHistory(history => [...history.slice(-9), visibleTab]);
    setActiveTab(tab);
    if (focus) {
      const index = tabs.findIndex((item) => item.id === tab);
      window.requestAnimationFrame(() => tabRefs.current[index]?.focus({ preventScroll: true }));
    }
    window.requestAnimationFrame(() => postNavigationTarget("calorieapp-navigation",
      document.getElementById(`calorie-tab-${tab}`) ?? document.getElementById(`calorie-panel-${tab}`), true));
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    const forwardKey = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backwardKey = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
    if (event.key === forwardKey || event.key === "ArrowDown") next = (index + 1) % tabs.length;
    else if (event.key === backwardKey || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(tabs[next].id, true);
  }

  function openJourney(step: "test" | "move") {
    setRequestedJourney(current => ({ step, serial: (current?.serial ?? 0) + 1 }));
    setReturnToJourney(true);
    selectTab("journey");
  }

  const navigateFromJourney = useCallback((destination: "account" | "packaged" | "diary") => {
    setReturnToJourney(true);
    setActiveTab(destination);
    window.requestAnimationFrame(() => document.getElementById(`calorie-tab-${destination}`)?.focus({ preventScroll: true }));
    window.requestAnimationFrame(() => postNavigationTarget("calorieapp-navigation", document.getElementById(`calorie-tab-${destination}`), true));
  }, []);

  const cancelJourney = useCallback(() => {
    clearAccountJourney();
    clearAccountGuideEntry();
    setPendingEntry(null);
    setRequestedJourney(undefined);
    setReturnToJourney(false);
    setCancelJourneyRequest(0);
    // Remounting disposes of private recovery data and aborts pending requests.
    setJourneyInstance(current => current + 1);
    setActiveTab("account");
    window.requestAnimationFrame(() => document.getElementById("calorie-tab-account")?.focus({ preventScroll: true }));
    window.requestAnimationFrame(() => postNavigationTarget("calorieapp-account", document.getElementById("calorie-tab-account"), true));
  }, []);

  function openAccountTools(destination?: "export" | "import" | "session") {
    setReturnToJourney(true);
    selectTab("account", true);
    window.requestAnimationFrame(() => {
      if (destination !== "session") window.dispatchEvent(new CustomEvent("calorieapp:open-account-tools", { detail: { destination } }));
    });
  }

  return (
    <div
      lang={locale}
      dir={direction}
      className="calorie-age-shell"
      data-age-band={ageBand ?? "unselected"}
    >
      {ageResolved && !allowPersonalFeatures && visibleTab !== "journey" ? <AgeExperienceControl band={ageBand} onChange={setAgeBand} /> : null}
      {!ageResolved || !ageBand ? null : <>
      {visibleTab !== "journey" ? <div className="sticky top-0 z-20 mb-2 flex min-h-11 flex-wrap items-center justify-between gap-x-3 rounded-lg border border-brand-secondary/15 bg-white px-3 py-1 text-xs text-brand-secondary">
        <p>CalorieApp <span aria-hidden="true">›</span> <strong>{tabs.find(tab => tab.id === visibleTab)?.label}</strong></p>
        {tabHistory.length && tabs.some(tab => tab.id === tabHistory[tabHistory.length - 1]) ? <button type="button"
          onClick={() => { const previous = tabHistory[tabHistory.length - 1]; setTabHistory(history => history.slice(0, -1)); selectTab(previous, true, false); }}
          className="min-h-11 font-semibold underline focus-visible:ring-2 focus-visible:ring-brand-secondary">
          ← {discoveryCopy(locale).backToProduct.replace("{food}", tabs.find(tab => tab.id === tabHistory[tabHistory.length - 1])!.label)}
        </button> : null}
      </div> : null}
      {allowPersonalFeatures && account && visibleTab !== "journey" ? <button type="button" onClick={() => selectTab("account", true)} className="mb-3 flex min-h-11 max-w-full items-center gap-2 rounded-full border border-brand-primary/20 bg-white px-4 py-2 text-sm font-bold text-brand-primary" data-account-identity>
        <span aria-hidden="true">●</span><bdi className="min-w-0 break-words">{account.nickname ? profileCopy.hello.replace("{nickname}", account.nickname) : profileCopy.account}</bdi>
      </button> : null}
      <div
        role="tablist"
        hidden={visibleTab === "journey"}
        aria-label={`${experience.copy.navigation} CalorieApp`}
        className={`calorie-workspace-tabs mb-5 grid min-w-0 auto-rows-fr grid-cols-2 gap-2 rounded-2xl border border-brand-secondary/20 bg-brand-bg p-2 ${allowPersonalFeatures ? "lg:grid-cols-4" : ""}`}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => { tabRefs.current[index] = node; }}
            id={`calorie-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={visibleTab === tab.id}
            aria-controls={`calorie-panel-${tab.id}`}
            tabIndex={visibleTab === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => handleTabKey(event, index)}
            className={`min-h-12 min-w-0 rounded-xl px-3 py-3 text-xs font-bold leading-snug [overflow-wrap:anywhere] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 sm:text-sm ${
              visibleTab === tab.id
                ? "bg-brand-primary text-white shadow-sm"
                : "bg-white text-brand-primary hover:bg-brand-secondary/10"
            }`}
          >
            <span className="block"><bdi>{tab.label}</bdi></span>
          </button>
        ))}
      </div>

      {allowPersonalFeatures && returnToJourney && visibleTab !== "journey" ? <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-brand-secondary/20 bg-white p-3">
        <button type="button" onClick={() => selectTab("journey")} className="min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 text-sm font-bold text-brand-secondary">{journey.returnGuide}</button>
        <button type="button" onClick={() => setCancelJourneyRequest(current => current + 1)} className="min-h-11 rounded-full px-4 py-2 text-sm font-semibold text-brand-secondary underline">{setup.cancelGuide}</button>
      </div> : null}

      {allowPersonalFeatures ? <section
        id="calorie-panel-account"
        role="tabpanel"
        aria-labelledby="calorie-tab-account"
        hidden={visibleTab !== "account"}
        className="calorie-workspace-panel"
      >
        <XamanLoginPanel onAccountChange={setAccount}
          moreOptionsLabel={(welcomeTranslations[locale as keyof typeof welcomeTranslations] ?? welcomeTranslations.en).more}
          welcome={loginAction => <AccountWelcome locale={locale}
            onBrowse={() => selectTab("packaged", true)} onSetup={() => openJourney("test")}>{loginAction}</AccountWelcome>}
          settings={<AgeExperienceControl band={ageBand} onChange={setAgeBand} />}
          guides={<div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => openJourney("test")} className="min-h-12 rounded-xl border border-brand-secondary/20 bg-white p-3 text-sm font-bold text-brand-primary">{journey.testRoute}</button>
          <button type="button" onClick={() => openJourney("move")} className="min-h-12 rounded-xl border border-brand-secondary/20 bg-white p-3 text-sm font-bold text-brand-primary">{journey.moveRoute}</button>
          </div>}
        />
      </section> : null}

      {allowPersonalFeatures ? <section
        id="calorie-panel-journey"
        role="tabpanel"
        aria-label={journey.journeyTab}
        hidden={visibleTab !== "journey"}
        className="calorie-workspace-panel"
      >
        <TestnetEntry
          key={journeyInstance}
          active={visibleTab === "journey"}
          requestedJourney={requestedJourney}
          cancelRequest={cancelJourneyRequest}
          onCancel={cancelJourney}
          onNavigate={navigateFromJourney}
          onOpenAccountTools={openAccountTools}
        />
      </section> : null}

      <FoodSearchPlaceholder
        activeView={visibleTab === "account" || visibleTab === "journey" ? null : visibleTab}
        requestedEntry={requestedFoodEntry}
        onOpenAccount={() => selectTab("account", true)}
        onOpenSearch={() => selectTab("packaged", true)}
        onOpenBasic={() => selectTab("basic", true)}
        onOpenDiary={() => selectTab("diary", true)}
        allowPersonalLog={allowPersonalFeatures}
      />
      </>}
    </div>
  );
}
