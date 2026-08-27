export const DEFAULT_BACKEND_TIMEOUT_MS = 20_000;

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

export function backendUnavailableMessage(
  error: unknown,
  fallbackMessage: string
) {
  if (error instanceof BackendRequestTimeoutError) {
    return "The CalorieApp service is taking longer than expected to start. Please wait a moment and try again.";
  }

  return fallbackMessage;
}
