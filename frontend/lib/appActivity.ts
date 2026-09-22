/** Approximate open-app sessions, never accounts, wallets, IPs or browsing histories. */
export const ACTIVITY_WINDOW_MS = 5 * 60_000;
export function createActivityCounter(capacity = 2000) {
  const sessions = new Map<string, number>();
  let saturatedUntil = 0;
  function prune(now: number) {
    for (const [id, seen] of sessions) if (now - seen >= ACTIVITY_WINDOW_MS) sessions.delete(id);
  }
  return {
    touch(id: string, now = Date.now()) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return false;
      prune(now);
      if (!sessions.has(id) && sessions.size >= capacity) { saturatedUntil = now + ACTIVITY_WINDOW_MS; return false; }
      sessions.set(id, now);
      return true;
    },
    snapshot(now = Date.now()) {
      prune(now);
      return { active: now < saturatedUntil ? null : sessions.size, windowMinutes: 5, approximate: true };
    },
  };
}

// Current deployment runs one Next server. Do not advertise this as a unique-person
// count or reuse it across multiple instances without a shared TTL store.
export const appActivity = createActivityCounter();
