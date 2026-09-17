export type AccountJourneyStep = "test" | "practice" | "move" | "finish";
export type AccountJourneyProgress = { step: AccountJourneyStep; moveIndex: number };
const key = "calorieapp:account-guide-position:v1";

// Navigation only; no account identifiers, exports or recovery material.
export function readAccountJourney(): AccountJourneyProgress | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) || "null");
    if (!value || Object.keys(value).length !== 2 || !["test", "practice", "move", "finish"].includes(value.step)
      || !Number.isInteger(value.moveIndex) || value.moveIndex < 0 || value.moveIndex > 4) return null;
    return { step: value.step, moveIndex: value.moveIndex };
  } catch { return null; }
}

export function saveAccountJourney(value: AccountJourneyProgress): void {
  try { window.sessionStorage.setItem(key, JSON.stringify({ step: value.step, moveIndex: value.moveIndex })); }
  catch { /* The mounted guide also works when tab storage is unavailable. */ }
}
