"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { AgeExperienceControl, useAgeExperience } from "@/components/AgeExperienceControl";
import { FoodSearchPlaceholder, type FoodWorkspaceView } from "@/components/FoodSearchPlaceholder";
import { TestnetEntry } from "@/components/TestnetEntry";
import { NicknameProfile } from "@/components/NicknameProfile";
import { XamanLoginPanel } from "@/components/XamanLoginPanel";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { getAuthUi } from "@/lib/authUi";
import { diaryCopy } from "@/lib/foodDiary";
import { foodExperience } from "@/lib/foodExperience";
import { getFoodUi } from "@/lib/foodUi";
import journeyTranslations from "@/config/testnet-entry-copy.json";

type WorkspaceTab = "account" | "journey" | FoodWorkspaceView;

export function CalorieAppWorkspace() {
  const display = useDisplayLanguage();
  const { copy: foodCopy, locale, direction } = getFoodUi(
    display.enabled ? display.locale : "en"
  );
  const experience = foodExperience(locale);
  const diary = diaryCopy(locale);
  const auth = getAuthUi(locale);
  const journey = journeyTranslations[locale as keyof typeof journeyTranslations] ?? journeyTranslations.en;
  const [ageBand, setAgeBand, ageResolved = true] = useAgeExperience();
  const allowPersonalFeatures = ageBand === "adult";
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("account");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    ...(allowPersonalFeatures ? [{ id: "account" as const, label: auth.copy.accountTools }] : []),
    ...(allowPersonalFeatures ? [{ id: "journey" as const, label: journey.journeyTab }] : []),
    { id: "packaged", label: foodCopy.searchTitle },
    { id: "basic", label: experience.copy.sourceTitle },
    ...(allowPersonalFeatures ? [{ id: "diary" as const, label: diary.title }] : []),
  ];
  const visibleTab: WorkspaceTab = !allowPersonalFeatures && (activeTab === "account" || activeTab === "journey" || activeTab === "diary")
    ? "packaged" : activeTab;

  useEffect(() => {
    if (ageBand && !allowPersonalFeatures) {
      setActiveTab(current => current === "account" || current === "journey" || current === "diary" ? "packaged" : current);
    }
  }, [ageBand, allowPersonalFeatures]);

  function selectTab(tab: WorkspaceTab, focus = false) {
    setActiveTab(tab);
    if (focus) {
      const index = tabs.findIndex((item) => item.id === tab);
      window.requestAnimationFrame(() => tabRefs.current[index]?.focus());
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

  function openAccountTools() {
    selectTab("account", true);
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("calorieapp:open-account-tools"));
    });
  }

  return (
    <div lang={locale} dir={direction}>
      {ageResolved ? <AgeExperienceControl band={ageBand} onChange={setAgeBand} /> : null}
      {!ageResolved || !ageBand ? null : <>
      <div
        role="tablist"
        aria-label={`${experience.copy.navigation} CalorieApp`}
        className={`mb-5 grid min-w-0 grid-cols-2 gap-2 rounded-2xl border border-brand-secondary/20 bg-brand-bg p-2 ${allowPersonalFeatures ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
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
            className={`min-h-12 min-w-0 rounded-xl px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 ${
              visibleTab === tab.id
                ? "bg-brand-primary text-white shadow-sm"
                : "bg-white text-brand-primary hover:bg-brand-secondary/10"
            }`}
          >
            <span className="block break-words"><bdi>{tab.label}</bdi></span>
          </button>
        ))}
      </div>

      {allowPersonalFeatures ? <section
        id="calorie-panel-account"
        role="tabpanel"
        aria-labelledby="calorie-tab-account"
        hidden={visibleTab !== "account"}
      >
        <NicknameProfile />
        <XamanLoginPanel />
      </section> : null}

      {allowPersonalFeatures ? <section
        id="calorie-panel-journey"
        role="tabpanel"
        aria-labelledby="calorie-tab-journey"
        hidden={visibleTab !== "journey"}
      >
        <TestnetEntry
          onNavigate={destination => selectTab(destination, true)}
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
