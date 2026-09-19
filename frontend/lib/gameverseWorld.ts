import worldConfig from "@/config/gameverse-world.json";
import copyConfig from "@/config/gameverse-copy.json";
import { resolveLocale } from "@/lib/locales";
import type { AgeBand } from "@/lib/ageExperience";

export type GameverseRegion = {
  id: string;
  kind: string;
  x: number;
  y: number;
  visible_ages: AgeBand[];
  interactive_ages: AgeBand[];
  destination: string | null;
};

export type GameverseCopy = {
  title: string;
  subtitle: string;
  world: string;
  identity: string;
  identityNote: string;
  explore: string;
  walk: string;
  open: string;
  visited: string;
  locked: string;
  mazeReady: string;
  mountains: string;
  mountainHint: string;
  ecosystem: string;
  optional: string;
  ageChild: string;
  ageTeen: string;
  ageAdult: string;
  locations: Record<string, string>;
  descriptions: Record<string, string>;
};

export const gameverseWorld = worldConfig;
export const gameverseRegions = worldConfig.regions as GameverseRegion[];

export function gameverseCopy(locale?: string | null): {
  locale: string;
  copy: GameverseCopy;
} {
  const resolved = resolveLocale(locale);
  const source = copyConfig as unknown as Record<string, GameverseCopy>;
  return { locale: source[resolved] ? resolved : "en", copy: source[resolved] ?? source.en };
}

export function regionCopy(locale: string, regionId: string): {
  name: string;
  description: string;
  descriptionFallback: boolean;
} {
  const { copy } = gameverseCopy(locale);
  const english = copyConfig.en;
  const names = copy.locations as Record<string, string>;
  const descriptions = copy.descriptions as Record<string, string>;
  const englishDescriptions = english.descriptions as Record<string, string>;
  return {
    name: names[regionId] ?? (english.locations as Record<string, string>)[regionId] ?? regionId,
    description: descriptions[regionId] ?? englishDescriptions[regionId] ?? "",
    descriptionFallback: !descriptions[regionId] && Boolean(englishDescriptions[regionId]),
  };
}

export function regionsForAge(ageBand: AgeBand): GameverseRegion[] {
  return gameverseRegions.filter(region => region.visible_ages.includes(ageBand));
}

export function regionIsInteractive(region: GameverseRegion, ageBand: AgeBand): boolean {
  return region.interactive_ages.includes(ageBand);
}

export function uniqueVisited(regionIds: readonly string[]): string[] {
  return [...new Set(regionIds.filter(id => gameverseRegions.some(region => region.id === id)))];
}

export function mazeUnlocked(regionIds: readonly string[]): boolean {
  const visited = uniqueVisited(regionIds).filter(id => id !== "maze-gate");
  return visited.length >= worldConfig.progression.maze_unlock_after_unique_regions;
}

export function starterIdentity(): {
  starter_character_id: string;
  render_asset_key: string;
} {
  return {
    starter_character_id: worldConfig.starter_character.starter_character_id,
    render_asset_key: worldConfig.starter_character.render_asset_key,
  };
}
