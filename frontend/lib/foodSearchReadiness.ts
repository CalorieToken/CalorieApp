import { BACKEND_WAKE_BASE_URL, waitForBackendReady } from "@/lib/backendRequest";

const READY_TTL_MS = 60_000;

/** A page-scoped public health probe, shared by preparation and the first search. */
export function createFoodSearchReadiness() {
  let readyUntil = 0;
  let pending: Promise<void> | null = null;
  let controller: AbortController | null = null;
  let disposed = false;

  function prepare(signal?: AbortSignal): Promise<void> {
    if (disposed || signal?.aborted) {
      return Promise.reject(signal?.reason ?? new Error("Food search preparation cancelled"));
    }
    if (Date.now() < readyUntil) return Promise.resolve();
    if (!pending) {
      controller = new AbortController();
      pending = waitForBackendReady(BACKEND_WAKE_BASE_URL, controller.signal)
        .then(() => { if (!disposed) readyUntil = Date.now() + READY_TTL_MS; })
        .finally(() => { pending = null; controller = null; });
    }
    const preparation = pending;
    if (!signal) return preparation;
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(signal.reason ?? new Error("Food search cancelled"));
      signal.addEventListener("abort", onAbort, { once: true });
      preparation.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
      if (signal.aborted) onAbort();
    });
  }
  return {
    prepare,
    dispose() { disposed = true; readyUntil = 0; controller?.abort(); },
  };
}
