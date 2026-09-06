export const DEFAULT_BACKEND_TIMEOUT_MS = 20_000;
export const DEFAULT_BACKEND_WARMUP_TIMEOUT_MS = 180_000;

// Render may not wake one free service from another free service's proxy
// request. In production this public URL is raced with the browser-safe
// same-origin health route; all application requests continue to use the
// same-origin proxy. Keep the public browser path brand-specific: privacy
// filters can block generic `/api/backend/*` request paths before they leave
// the browser.
export const BACKEND_WAKE_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_WAKE_URL?.trim() || "/api/calorieapp";

const BACKEND_WARMUP_ATTEMPT_TIMEOUT_MS = 70_000;
const BACKEND_WARMUP_INITIAL_RETRY_DELAY_MS = 5_000;
const BACKEND_WARMUP_MAX_RETRY_DELAY_MS = 30_000;
const BACKEND_WARMUP_RATE_LIMIT_DELAY_MS = 30_000;
const BACKEND_WARMUP_MAX_RETRY_AFTER_MS = 60_000;

export class BackendRequestTimeoutError extends Error {
  constructor() {
    super("Backend request timed out");
    this.name = "BackendRequestTimeoutError";
  }
}

export async function backendRequest(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_BACKEND_TIMEOUT_MS
) {
  const controller = new AbortController();
  const externalSignal = init.signal;
  let didTimeout = false;

  const abortFromExternalSignal = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal?.aborted) {
    abortFromExternalSignal();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, {
      once: true,
    });
  }

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      credentials: init.credentials ?? "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new BackendRequestTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw signal.reason ?? new Error("Request aborted");
  }
}

function retryAfterDelayMs(response: Response): number | null {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    if (seconds < 0) {
      return null;
    }

    return Math.min(
      seconds * 1_000,
      BACKEND_WARMUP_MAX_RETRY_AFTER_MS
    );
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return null;
  }

  const delayMs = retryAt - Date.now();
  if (delayMs <= 0) {
    return null;
  }

  return Math.min(delayMs, BACKEND_WARMUP_MAX_RETRY_AFTER_MS);
}

function retryDelayMs(response: Response | null, retryCount: number): number {
  if (response?.status === 429) {
    return retryAfterDelayMs(response) ?? BACKEND_WARMUP_RATE_LIMIT_DELAY_MS;
  }

  return Math.min(
    BACKEND_WARMUP_INITIAL_RETRY_DELAY_MS * 2 ** retryCount,
    BACKEND_WARMUP_MAX_RETRY_DELAY_MS
  );
}

async function discardResponseBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // The response may already be consumed or closed. Nothing else is needed.
  }
}

/**
 * Render free services can take 50 seconds or more to wake after inactivity.
 * Probe one health route until the backend returns the expected JSON response,
 * so callers do not fail on Render's temporary loading page.
 */
async function waitForBackendReadyAt(
  backendBaseUrl: string,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_BACKEND_WARMUP_TIMEOUT_MS
) {
  const deadline = Date.now() + timeoutMs;
  let retryCount = 0;

  while (Date.now() < deadline) {
    throwIfAborted(signal);

    const remainingMs = deadline - Date.now();
    const attemptTimeoutMs = Math.max(
      1,
      Math.min(BACKEND_WARMUP_ATTEMPT_TIMEOUT_MS, remainingMs)
    );

    let retryResponse: Response | null = null;

    try {
      const response = await backendRequest(
        `${backendBaseUrl}/health`,
        { cache: "no-store", credentials: "omit", signal },
        attemptTimeoutMs
      );

      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.includes("application/json")) {
        const data = (await response.json()) as { status?: unknown };
        if (data.status === "ok") {
          return;
        }
      }

      retryResponse = response;
      await discardResponseBody(response);

      // Render's edge can temporarily return a non-ready 4xx as well as 5xx
      // responses while a free service is fully spun down. Retry slowly and
      // respect rate-limit guidance instead of polling every few seconds.
    } catch {
      throwIfAborted(signal);
    }

    const requestedDelayMs = retryDelayMs(retryResponse, retryCount);
    retryCount += 1;
    const boundedRetryDelayMs = Math.min(
      requestedDelayMs,
      Math.max(0, deadline - Date.now())
    );
    if (boundedRetryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, boundedRetryDelayMs));
      throwIfAborted(signal);
    }
  }

  throwIfAborted(signal);
  throw new BackendRequestTimeoutError();
}

/**
 * Wake the backend through both browser-safe same-origin routing and the
 * optional public Render origin. Privacy-focused browsers can block the
 * cross-origin probe, while Render can occasionally fail to wake one free
 * service from another. Whichever path becomes ready first wins.
 */
export async function waitForBackendReady(
  backendBaseUrl: string,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_BACKEND_WARMUP_TIMEOUT_MS
) {
  const sameOriginBaseUrl = "/api/calorieapp";
  const normalizedBaseUrl = backendBaseUrl.replace(/\/$/, "");

  if (normalizedBaseUrl === sameOriginBaseUrl) {
    return waitForBackendReadyAt(sameOriginBaseUrl, signal, timeoutMs);
  }

  throwIfAborted(signal);
  const directController = new AbortController();
  const sameOriginController = new AbortController();
  const abortBoth = () => {
    directController.abort(signal?.reason);
    sameOriginController.abort(signal?.reason);
  };

  signal?.addEventListener("abort", abortBoth, { once: true });

  try {
    await Promise.any([
      waitForBackendReadyAt(
        normalizedBaseUrl,
        directController.signal,
        timeoutMs
      ),
      waitForBackendReadyAt(
        sameOriginBaseUrl,
        sameOriginController.signal,
        timeoutMs
      ),
    ]);
  } catch {
    throwIfAborted(signal);
    throw new BackendRequestTimeoutError();
  } finally {
    abortBoth();
    signal?.removeEventListener("abort", abortBoth);
  }
}

export function backendUnavailableMessage(
  error: unknown,
  fallbackMessage: string,
  timeoutMessage = "The CalorieApp service is taking longer than expected to start. Please wait a few minutes before trying again; repeated refreshes can slow startup."
) {
  if (error instanceof BackendRequestTimeoutError) {
    return timeoutMessage;
  }

  return fallbackMessage;
}
