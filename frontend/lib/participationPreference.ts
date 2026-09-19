import type { AgeBand } from "@/lib/ageExperience";

export const PARTICIPATION_CHOICE_KEY = "calorie.participation.choice.v1";

export type ParticipationMode = "nonparticipant" | "participant";
export type StorageScope = "session-temporary" | "persistent-until-revoked";
export type ComputeScope = "session-only" | "remember-until-revoked";

export type ParticipationChoice = {
  version: 1;
  mode: ParticipationMode;
  storage: boolean;
  compute: boolean;
  validator: boolean;
  storageScope: StorageScope;
  computeScope: ComputeScope;
};

export const defaultParticipationChoice: ParticipationChoice = Object.freeze({
  version: 1,
  mode: "nonparticipant",
  storage: false,
  compute: false,
  validator: false,
  storageScope: "session-temporary",
  computeScope: "session-only",
});

export function parseParticipationChoice(value: string | null): ParticipationChoice {
  if (!value) return {...defaultParticipationChoice};
  try {
    const parsed = JSON.parse(value) as Partial<ParticipationChoice>;
    if (parsed.version !== 1) return {...defaultParticipationChoice};
    if (parsed.mode !== "nonparticipant" && parsed.mode !== "participant") {
      return {...defaultParticipationChoice};
    }
    const storageScope: StorageScope =
      parsed.storageScope === "persistent-until-revoked"
        ? "persistent-until-revoked"
        : "session-temporary";
    const computeScope: ComputeScope =
      parsed.computeScope === "remember-until-revoked"
        ? "remember-until-revoked"
        : "session-only";
    return {
      version: 1,
      mode: parsed.mode,
      storage: parsed.storage === true,
      compute: parsed.compute === true,
      validator: parsed.validator === true,
      storageScope,
      computeScope,
    };
  } catch {
    return {...defaultParticipationChoice};
  }
}

export function normalizeParticipationChoice(
  choice: ParticipationChoice,
  ageBand: AgeBand
): ParticipationChoice {
  if (ageBand !== "adult") {
    return {...defaultParticipationChoice};
  }
  if (choice.mode === "nonparticipant") {
    return {
      ...choice,
      storage: false,
      compute: false,
      validator: false,
    };
  }
  return choice;
}

export function participationRoleCount(choice: ParticipationChoice): number {
  return [choice.storage, choice.compute, choice.validator].filter(Boolean).length;
}
