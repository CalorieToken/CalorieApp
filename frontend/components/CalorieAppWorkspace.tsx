"use client";

import { KeyboardEvent, useRef, useState } from "react";
import { FoodSearchPlaceholder, type FoodWorkspaceView } from "@/components/FoodSearchPlaceholder";
import { TestnetEntry } from "@/components/TestnetEntry";
import { XamanLoginPanel } from "@/components/XamanLoginPanel";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { getAuthUi } from "@/lib/authUi";
import { diaryCopy } from "@/lib/foodDiary";
import { foodExperience } from "@/lib/foodExperience";
import { getFoodUi } from "@/lib/foodUi";

type WorkspaceTab = "account" | FoodWorkspaceView;

export function CalorieAppWorkspace() {
  const display = useDisplayLanguage();
  const { copy: foodCopy, locale, direction } = getFoodUi(
    display.enabled ? display.locale : "en"
  );
  const experience = foodExperience(locale);
  const diary = diaryCopy(locale);
  const auth = getAuthUi(locale);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("account");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "account", label: auth.copy.accountTools },
    { id: "packaged", label: foodCopy.searchTitle },
    { id: "basic", label: experience.copy.sourceTitle },
    { id: "diary", label: diary.title },
  ];

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

  return (
    <div lang={locale} dir={direction}>
      <div
        role="tablist"
        aria-label={`${experience.copy.navigation} CalorieApp`}
        className="mb-5 grid min-w-0 grid-cols-2 gap-2 rounded-2xl border border-brand-secondary/20 bg-brand-bg p-2 sm:grid-cols-4"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => { tabRefs.current[index] = node; }}
            id={`calorie-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`calorie-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => handleTabKey(event, index)}
            className={`min-h-12 min-w-0 rounded-xl px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 ${
              activeTab === tab.id
                ? "bg-brand-primary text-white shadow-sm"
                : "bg-white text-brand-primary hover:bg-brand-secondary/10"
            }`}
          >
            <span className="block break-words"><bdi>{tab.label}</bdi></span>
          </button>
        ))}
      </div>

      <section
        id="calorie-panel-account"
        role="tabpanel"
        aria-labelledby="calorie-tab-account"
        hidden={activeTab !== "account"}
      >
        <XamanLoginPanel />
        <TestnetEntry />
      </section>

      <FoodSearchPlaceholder
        activeView={activeTab === "account" ? null : activeTab}
        onOpenAccount={() => selectTab("account", true)}
      />
    </div>
  );
}
