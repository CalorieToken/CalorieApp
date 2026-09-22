export const CALORIEAPP_NAVIGATION_MESSAGE = "calorieapp:navigation:target";

export type CalorieAppNavigationTarget =
  | "calorieapp-navigation"
  | "calorieapp-account"
  | "calorieapp-add"
  | "calorieapp-diary";

export function trustedWordPressParentOrigin(): string | null {
  if (typeof window === "undefined" || typeof document === "undefined" ||
      window.parent === window || !document.referrer) return null;
  try {
    const parent = new URL(document.referrer);
    const production = parent.protocol === "https:" &&
      ["calorietoken.net", "www.calorietoken.net"].includes(parent.hostname);
    const local = ["http:", "https:"].includes(parent.protocol) &&
      ["localhost", "127.0.0.1"].includes(parent.hostname);
    return production || local ? parent.origin : null;
  } catch {
    return null;
  }
}

/**
 * Ask the exact approved WordPress parent to align its page with an in-app task.
 * Only a fixed target and a finite in-frame offset cross the iframe boundary.
 */
export function postNavigationTarget(
  target: CalorieAppNavigationTarget,
  element: (Pick<Element, "getBoundingClientRect"> & Partial<Pick<Element, "scrollIntoView">>) | null,
  reveal = false
): boolean {
  // Only explicit user navigation opts in. Nearest alignment keeps visible
  // content still and respects inner result lists without smooth-scroll races.
  if (reveal) element?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
  const origin = trustedWordPressParentOrigin();
  if (!origin || !element) return false;
  const rectangle = element.getBoundingClientRect();
  const offset = Math.round(rectangle.top + (window.scrollY || 0));
  if (!Number.isFinite(offset) || offset < 0) return false;
  window.parent.postMessage({
    type: CALORIEAPP_NAVIGATION_MESSAGE,
    version: 1,
    target,
    offset,
  }, origin);
  return true;
}
