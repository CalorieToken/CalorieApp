"use client";

import Link from "next/link";

import { AgeExperienceControl, useAgeExperience } from "@/components/AgeExperienceControl";
import { CalorieStudio } from "@/components/CalorieStudio";
import { DisplayLanguagePicker } from "@/components/DisplayLanguageProvider";
import { ParticipationChoiceCard } from "@/components/ParticipationChoiceCard";

export function CalorieStudioPage() {
  const [ageBand, setAgeBand, resolved = true] = useAgeExperience();

  if (!resolved) return null;

  return (
    <main data-calorieapp-content className="gallery-page" data-public-surface="CalorieStudio">
      <div className="gallery-page-shell">
        <header className="gallery-page-topbar">
          <Link href="/gameverse" className="gallery-back">← CalorieVerse</Link>
          <DisplayLanguagePicker />
        </header>
        {!ageBand ? (
          <section className="gallery-age-entry">
            <AgeExperienceControl band={ageBand} onChange={setAgeBand} />
          </section>
        ) : (
          <>
            <AgeExperienceControl band={ageBand} onChange={setAgeBand} />
            <ParticipationChoiceCard ageBand={ageBand} compact />
            <CalorieStudio ageBand={ageBand} />
          </>
        )}
      </div>
    </main>
  );
}
