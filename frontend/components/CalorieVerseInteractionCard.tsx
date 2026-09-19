"use client";

import type { AgeBand } from "@/lib/ageExperience";
import {
  interactionCopy,
  interactionForRegion,
  type CalorieVerseInteractionProgress,
} from "@/lib/calorieVerseInteractions";

export function CalorieVerseInteractionCard({
  regionId,
  ageBand,
  locale,
  progress,
  onComplete,
  onReset,
}: {
  regionId: string;
  ageBand: AgeBand;
  locale: string;
  progress: CalorieVerseInteractionProgress;
  onComplete(interactionId: string): void;
  onReset(interactionId: string): void;
}) {
  const interaction = interactionForRegion(regionId, ageBand);
  if (!interaction) return null;

  const copy = interactionCopy(locale);
  const itemCopy = copy.interactions[interaction.id];
  if (!itemCopy) return null;

  const completed = progress.completed_ids.includes(interaction.id);

  return (
    <section
      className={completed ? "calorieverse-interaction is-complete" : "calorieverse-interaction"}
      aria-labelledby={"interaction-" + interaction.id}
    >
      <div className="calorieverse-interaction-head">
        <div>
          <small>{copy.title}</small>
          <h3 id={"interaction-" + interaction.id}>{itemCopy.title}</h3>
        </div>
        <span>{progress.completed_ids.length} / 4 {copy.progress}</span>
      </div>

      <p>{completed ? itemCopy.done : itemCopy.body}</p>
      <p className="calorieverse-interaction-optional">{copy.optional}</p>

      <div className="calorieverse-interaction-actions">
        {completed ? (
          <>
            <strong>✓ {copy.completed}</strong>
            <button type="button" onClick={() => onReset(interaction.id)}>
              {copy.reset}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onComplete(interaction.id)}>
            {itemCopy.action}
          </button>
        )}
      </div>
    </section>
  );
}
