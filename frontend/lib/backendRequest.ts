export const DEFAULT_BACKEND_TIMEOUT_MS = 20_000;
export const DEFAULT_BACKEND_WARMUP_TIMEOUT_MS = 65_000;

const BACKEND_WARMUP_ATTEMPT_TIMEOUT_MS = 12_000;
const BACKEND_WARMUP_RETRY_DELAY_MS = 2_000;

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
      credentials: "include",
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

/**
 * Render free services can take 50 seconds or more to wake after inactivity.
 * Probe the same-origin health route until the backend returns the expected
 * JSON response, so callers do not fail on Render's temporary loading page.
 */
export async function waitForBackendReady(
  backendBaseUrl: string,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_BACKEND_WARMUP_TIMEOUT_MS
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    throwIfAborted(signal);

    const remainingMs = deadline - Date.now();
    const attemptTimeoutMs = Math.max(
      1,
      Math.min(BACKEND_WARMUP_ATTEMPT_TIMEOUT_MS, remainingMs)
    );

    try {
      const response = await backendRequest(
        `${backendBaseUrl}/health`,
        { cache: "no-store", signal },
        attemptTimeoutMs
      );

      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.includes("application/json")) {
        const data = (await response.json()) as { status?: unknown };
        if (data.status === "ok") {
          return;
        }
      }

      if (response.status >= 400 && response.status < 500) {
        throw new Error("Backend health check rejected");
      }
    } catch (error) {
      throwIfAborted(signal);

      if (
        error instanceof Error &&
        error.message === "Backend health check rejected"
      ) {
        throw error;
      }
    }

    const retryDelayMs = Math.min(
      BACKEND_WARMUP_RETRY_DELAY_MS,
      Math.max(0, deadline - Date.now())
    );
    if (retryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throwIfAborted(signal);
  throw new BackendRequestTimeoutError();
}

export function backendUnavailableMessage(
  error: unknown,
  fallbackMessage: string
) {
  if (error instanceof BackendRequestTimeoutError) {
    return "The CalorieApp service is taking longer than expected to start. Please wait a moment and try again.";
  }

  return fallbackMessage;
}
