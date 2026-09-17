"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { AgeExperienceControl, useAgeExperience } from "@/components/AgeExperienceControl";
import { FoodSearchPlaceholder, type FoodWorkspaceView } from "@/components/FoodSearchPlaceholder";
import { TestnetEntry } from "@/components/TestnetEntry";
import profileTranslations from "@/config/account-profile-copy.json";
import { XamanLoginPanel, type MeResponse } from "@/components/XamanLoginPanel";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { diaryCopy } from "@/lib/foodDiary";
import { foodExperience } from "@/lib/foodExperience";
import { getFoodUi } from "@/lib/foodUi";
import journeyTranslations from "@/config/testnet-entry-copy.json";
import { readAccountJourney } from "@/lib/accountJourney";

type WorkspaceTab = "account" | "journey" | FoodWorkspaceView;

export function CalorieAppWorkspace() {
  const display = useDisplayLanguage();
  const { copy: foodCopy, locale, direction } = getFoodUi(
    display.enabled ? display.locale : "en"
  );
  const experience = foodExperience(locale);
  const diary = diaryCopy(locale);
  const journey = journeyTranslations[locale as keyof typeof journeyTranslations] ?? journeyTranslations.en;
  const [ageBand, setAgeBand, ageResolved = true] = useAgeExperience();
  const allowPersonalFeatures = ageBand === "adult";
  const [account, setAccount] = useState<MeResponse | null>(null);
  const profileCopy = profileTranslations[locale as keyof typeof profileTranslations] ?? profileTranslations.en;
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("account");
  const [requestedJourney, setRequestedJourney] = useState<{ step: "test" | "move"; serial: number }>();
  const [returnToJourney, setReturnToJourney] = useState(false);
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

  useEffect(() => {
    if (ageBand && !allowPersonalFeatures) {
      setAccount(null);
      setActiveTab(current => current === "account" || current === "journey" || current === "diary" ? "packaged" : current);
    }
  }, [ageBand, allowPersonalFeatures]);

  function selectTab(tab: WorkspaceTab, focus = false) {
    setActiveTab(tab);
    if (focus) {
      const index = tabs.findIndex((item) => item.id === tab);
      window.requestAnimationFrame(() => tabRefs.current[index]?.focus({ preventScroll: true }));
    }
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

      {allowPersonalFeatures && returnToJourney && visibleTab !== "journey" ? <div className="mb-4 rounded-xl border border-brand-secondary/20 bg-white p-3">
        <button type="button" onClick={() => selectTab("journey")} className="min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 text-sm font-bold text-brand-secondary">{journey.returnGuide}</button>
      </div> : null}

      {allowPersonalFeatures ? <section
        id="calorie-panel-account"
        role="tabpanel"
        aria-labelledby="calorie-tab-account"
        hidden={visibleTab !== "account"}
        className="calorie-workspace-panel"
      >
        <XamanLoginPanel onAccountChange={setAccount}
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
          active={visibleTab === "journey"}
          requestedJourney={requestedJourney}
          onNavigate={navigateFromJourney}
          onOpenAccountTools={openAccountTools}
        />
      </section> : null}

      <FoodSearchPlaceholder
        activeView={visibleTab === "account" || visibleTab === "journey" ? null : visibleTab}
        onOpenAccount={() => selectTab("account", true)}
        allowPersonalLog={allowPersonalFeatures}
      />
      </>}
    </div>
  );
}
