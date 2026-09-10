/** A UI pause complements, and never replaces, the backend's provider limits. */
export function foodSearchRetryAt(status: number, retryAfter: string | null, now = Date.now()): number {
  if (status !== 429 && status !== 502 && status !== 503 && status !== 504) return 0;
  const minimumMs = status === 429 ? 60_000 : 30_000;
  const value = retryAfter?.trim();
  let delayMs = 0;
  if (value) {
    const seconds = Number(value);
    delayMs = Number.isFinite(seconds) && seconds >= 0
      ? seconds * 1_000
      : Date.parse(value) - now;
  }
  // Do not shorten a valid provider-directed pause. Ignore invalid/overflowing headers.
  if (!Number.isFinite(delayMs) || delayMs < 0 || !Number.isSafeInteger(Math.ceil(now + delayMs))) delayMs = 0;
  return now + Math.max(minimumMs, delayMs);
}
