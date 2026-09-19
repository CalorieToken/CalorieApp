export type AccountJourneyProgress = { route: "test" | "move"; index: number };
const key = "calorieapp:account-guide-position:v2";

// Navigation only. Never persist recovery material, addresses or acknowledgements.
export function readAccountJourney(): AccountJourneyProgress | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) || "null");
    if (!value || Object.keys(value).length !== 2 || !["test", "move"].includes(value.route)
      || !Number.isInteger(value.index) || value.index < 0 || value.index > (value.route === "test" ? 5 : 6)) return null;
    return { route: value.route, index: value.index };
  } catch { return null; }
}

export function saveAccountJourney(value: AccountJourneyProgress): void {
  try { window.sessionStorage.setItem(key, JSON.stringify({ route: value.route, index: value.index })); }
  catch { /* The mounted guide also works when tab storage is unavailable. */ }
}

export function clearAccountJourney(): void {
  try { window.sessionStorage.removeItem(key); }
  catch { /* The mounted workspace still clears its own guide state. */ }
}
