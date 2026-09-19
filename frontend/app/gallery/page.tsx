"use client";

import { AgeExperienceControl, useAgeExperience } from "@/components/AgeExperienceControl";
import { DisplayLanguagePicker } from "@/components/DisplayLanguageProvider";
import { GameverseCreatorGallery } from "@/components/GameverseCreatorGallery";
import { ParticipationChoiceCard } from "@/components/ParticipationChoiceCard";

export default function GalleryPage() {
  const [ageBand, setAgeBand, resolved = true] = useAgeExperience();

  if (!resolved) return null;

  return (
    <main data-calorieapp-content className="gallery-page">
      <div className="gallery-page-shell">
        <header className="gallery-page-topbar">
          <a href="/gameverse" className="gallery-back">← Gameverse</a>
          <DisplayLanguagePicker />
        </header>
        {!ageBand ? (
          <section className="gallery-age-entry">
            <AgeExperienceControl band={ageBand} onChange={setAgeBand} />
          </section>
        ) : (
          <>
            <AgeExperienceControl band={ageBand} onChange={setAgeBand} />
            <ParticipationChoiceCard ageBand={ageBand} />
            <GameverseCreatorGallery ageBand={ageBand} />
          </>
        )}
      </div>
    </main>
  );
}
