import { trustedWordPressParentOrigin } from "@/lib/navigationBridge";

const PREFIX = "calorieapp:entry:";
export const APP_ENTRY_TARGETS = ["test-account", "move-account", "account", "account-export", "food-search", "food-scan", "food-compare", "basic-foods", "food-diary"] as const;
export type AppEntryTarget = typeof APP_ENTRY_TARGETS[number];
export function entryFromHash(hash: string): AppEntryTarget | null {
  const value = hash === "#ctstyle-testnet" ? "test-account" : hash.slice(1);
  return APP_ENTRY_TARGETS.includes(value as AppEntryTarget) ? value as AppEntryTarget : null;
}

/** A cancelled guide must not be opened again by its consumed launch URL. */
export function clearAccountGuideEntry(): void {
  const target = entryFromHash(window.location.hash);
  if (target === "test-account" || target === "move-account") {
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }
  const origin = trustedWordPressParentOrigin();
  if (origin) window.parent.postMessage({ type: PREFIX + "cancel", version: 1 }, origin);
}

/** Navigation only: the native guide retains its age and account-creation gates. */
export function connectAppEntry(open: (target: AppEntryTarget) => void): () => void {
  const origin = trustedWordPressParentOrigin();
  const seen = new Set<string>();
  const fromParent = (event: MessageEvent) => {
    const data = event.data;
    if (!origin || event.origin !== origin || event.source !== window.parent ||
        !data || typeof data !== "object" || Array.isArray(data) ||
        Object.keys(data).length !== 4 || data.type !== PREFIX + "open" ||
        data.version !== 1 || !APP_ENTRY_TARGETS.includes(data.target) ||
        typeof data.requestId !== "string" || !/^entry-[0-9]{1,10}$/.test(data.requestId) ||
        seen.has(data.requestId)) return;
    seen.add(data.requestId);
    open(data.target);
  };
  const fromLocation = () => {
    const target = entryFromHash(window.location.hash);
    if (window.parent === window && target) open(target);
  };
  window.addEventListener("message", fromParent);
  window.addEventListener("hashchange", fromLocation);
  fromLocation();
  if (origin) window.parent.postMessage({ type: PREFIX + "ready", version: 1 }, origin);
  return () => {
    window.removeEventListener("message", fromParent);
    window.removeEventListener("hashchange", fromLocation);
  };
}
