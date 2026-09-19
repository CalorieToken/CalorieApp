import interactionConfig from "@/config/calorieverse-interactions.json";
import copyConfig from "@/config/calorieverse-interaction-copy.json";
import type { AgeBand } from "@/lib/ageExperience";
import { resolveLocale } from "@/lib/locales";

export const CALORIEVERSE_INTERACTION_KEY = "calorie.calorieverse.interactions.v1";

export type CalorieVerseInteraction = {
  id: string;
  region_id: string;
  ages: AgeBand[];
  effect: string;
  supports: string[];
};

export type CalorieVerseInteractionProgress = {
  version: 1;
  completed_ids: string[];
};

export type CalorieVerseInteractionCopy = {
  title: string;
  optional: string;
  completed: string;
  progress: string;
  reset: string;
  interactions: Record<string, {
    title: string;
    body: string;
    action: string;
    done: string;
  }>;
};

export type CalorieVerseWorldEffects = {
  farmMarketLink: boolean;
  creatorBeacon: boolean;
  routeWhisper: boolean;
};

const interactions = interactionConfig.interactions as CalorieVerseInteraction[];
const knownIds = new Set(interactions.map(item => item.id));

export function interactionCopy(locale?: string | null): CalorieVerseInteractionCopy {
  const resolved = resolveLocale(locale);
  const source = copyConfig as unknown as Record<string, CalorieVerseInteractionCopy>;
  return source[resolved] ?? source.en;
}

export function interactionForRegion(
  regionId: string,
  ageBand: AgeBand
): CalorieVerseInteraction | null {
  return interactions.find(item =>
    item.region_id === regionId && item.ages.includes(ageBand)
  ) ?? null;
}

export function parseInteractionProgress(value: string | null): CalorieVerseInteractionProgress {
  if (!value) return {version: 1, completed_ids: []};
  try {
    const parsed = JSON.parse(value) as Partial<CalorieVerseInteractionProgress>;
    if (parsed.version !== 1 || !Array.isArray(parsed.completed_ids)) {
      return {version: 1, completed_ids: []};
    }
    return {
      version: 1,
      completed_ids: [...new Set(
        parsed.completed_ids.filter(id => typeof id === "string" && knownIds.has(id))
      )],
    };
  } catch {
    return {version: 1, completed_ids: []};
  }
}

export function completeInteraction(
  progress: CalorieVerseInteractionProgress,
  interactionId: string
): CalorieVerseInteractionProgress {
  if (!knownIds.has(interactionId)) return progress;
  return {
    version: 1,
    completed_ids: [...new Set([...progress.completed_ids, interactionId])],
  };
}

export function resetInteraction(
  progress: CalorieVerseInteractionProgress,
  interactionId: string
): CalorieVerseInteractionProgress {
  return {
    version: 1,
    completed_ids: progress.completed_ids.filter(id => id !== interactionId),
  };
}

export function deriveWorldEffects(
  progress: CalorieVerseInteractionProgress
): CalorieVerseWorldEffects {
  const completed = new Set(progress.completed_ids);
  return {
    farmMarketLink:
      completed.has("food-data-inspection") &&
      completed.has("farm-water-balance"),
    creatorBeacon: completed.has("gallery-world-display"),
    routeWhisper: completed.has("helpbot-local-hint"),
  };
}

export const calorieVerseInteractionConfig = interactionConfig;
