"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { announceAuthState } from "@/components/authEvents";
import {
  backendRequest,
  backendUnavailableMessage,
  BackendRequestTimeoutError,
  waitForBackendReady,
} from "@/lib/backendRequest";

type MeResponse = {
  user_id: string;
  created_at: string;
};

type LoginStartResponse = {
  state: string;
  expires_at: string;
  wordpress_signin_url: string;
  browser_handoff_token: string;
};

type LoginStatusResponse = {
  status: "pending" | "failed" | "authenticated";
  redirect_to?: string | null;
};

const BACKEND_BASE_URL = "/api/backend";
const LOGIN_STATUS_POLL_INTERVAL_MS = 5_000;
const LOGIN_STATUS_FALLBACK_LIFETIME_MS = 5 * 60_000;
const LOGIN_STATUS_RATE_LIMIT_DELAY_MS = 15_000;
const LOGIN_STATUS_MAX_RETRY_AFTER_MS = 60_000;
const LOGIN_START_RETRY_WINDOW_MS = 2 * 60_000;
const LOGIN_START_RETRY_DELAY_MS = 15_000;
const XAMAN_LAUNCH_MESSAGE_TYPE = "calorieapp-xaman-navigate";
const XAMAN_LAUNCH_ERROR_TYPE = "calorieapp-xaman-error";

function delay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("Login cancelled"));
      return;
    }

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      reject(signal.reason ?? new Error("Login cancelled"));
    };
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitForOriginLogin(
  state: string,
  browserHandoffToken: string,
  expiresAt: string,
  signal: AbortSignal
) {
  const parsedExpiry = Date.parse(expiresAt);
  const deadline = Number.isFinite(parsedExpiry)
    ? parsedExpiry
    : Date.now() + LOGIN_STATUS_FALLBACK_LIFETIME_MS;

  while (Date.now() < deadline) {
    await delay(LOGIN_STATUS_POLL_INTERVAL_MS, signal);

    let response: Response;
    try {
      response = await backendRequest(
        `${BACKEND_BASE_URL}/api/identity/login/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state,
            browser_handoff_token: browserHandoffToken,
          }),
          signal,
        }
      );
    } catch {
      if (signal.aborted) {
        throw signal.reason ?? new Error("Login cancelled");
      }
      continue;
    }

    if (response.status === 429) {
      const retryAfterSeconds = Number(
        response.headers.get("retry-after")?.trim()
      );
      const retryDelay = Number.isFinite(retryAfterSeconds)
        ? Math.min(
            Math.max(0, retryAfterSeconds * 1_000),
            LOGIN_STATUS_MAX_RETRY_AFTER_MS
          )
        : LOGIN_STATUS_RATE_LIMIT_DELAY_MS;
      await delay(retryDelay, signal);
      continue;
    }
    if ([502, 503, 504].includes(response.status)) {
      continue;
    }
    if (!response.ok) {
      throw new Error(`Login status failed with ${response.status}`);
    }

    const payload = (await response.json()) as LoginStatusResponse;
    if (payload.status === "authenticated") {
      return;
    }
    if (payload.status === "failed") {
      throw new Error("Xaman callback failed");
    }
  }

  throw new Error("Login handoff expired");
}

function retryAfterMilliseconds(response: Response): number {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) {
    return LOGIN_START_RETRY_DELAY_MS;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, LOGIN_STATUS_MAX_RETRY_AFTER_MS);
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return LOGIN_START_RETRY_DELAY_MS;
  }

  return Math.min(
    Math.max(0, retryAt - Date.now()),
    LOGIN_STATUS_MAX_RETRY_AFTER_MS
  );
}

async function startLoginWithRetry(
  signal: AbortSignal,
  onRateLimited: () => void
): Promise<LoginStartResponse> {
  const deadline = Date.now() + LOGIN_START_RETRY_WINDOW_MS;

  while (Date.now() < deadline) {
    const response = await backendRequest(
      `${BACKEND_BASE_URL}/api/identity/login/start`,
      { method: "POST", signal }
    );

    if (response.ok) {
      return (await response.json()) as LoginStartResponse;
    }

    if (response.status === 429) {
      onRateLimited();
      await delay(retryAfterMilliseconds(response), signal);
      continue;
    }

    if ([502, 503, 504].includes(response.status)) {
      await delay(LOGIN_START_RETRY_DELAY_MS, signal);
      continue;
    }

    throw new Error(`Unable to start login (${response.status})`);
  }

  throw new BackendRequestTimeoutError();
}

function sendXamanLocationToLaunchTab(
  loginWindow: Window,
  attemptId: string,
  wordpressSigninUrl: string
) {
  const message = {
    type: XAMAN_LAUNCH_MESSAGE_TYPE,
    attemptId,
    url: wordpressSigninUrl,
  };

  // Repeat briefly so a slow mobile browser cannot miss the message while the
  // holding page is still attaching its listener. Once navigation starts, the
  // target-origin check prevents delivery to the external page.
  [0, 300, 1_000, 2_500].forEach((delayMs) => {
    window.setTimeout(() => {
      if (!loginWindow.closed) {
        loginWindow.postMessage(message, window.location.origin);
      }
    }, delayMs);
  });
}

export function XamanLoginPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<MeResponse | null>(null);
  const loginAbortController = useRef<AbortController | null>(null);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const response = await backendRequest(
        `${BACKEND_BASE_URL}/api/identity/me`
      );
      if (!response.ok) {
        setCurrentUser(null);
        if (response.status === 401) {
          announceAuthState(false);
        }
        return;
      }
      const data = (await response.json()) as MeResponse;
      setCurrentUser(data);
    } catch {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    refreshCurrentUser();

    if (window.sessionStorage.getItem("calorieapp-login-return")) {
      window.sessionStorage.removeItem("calorieapp-login-return");
      setSuccessNotice(
        "Sign-in completed in your default browser. You can continue safely in this tab."
      );
    }

    return () => {
      loginAbortController.current?.abort();
    };
  }, [refreshCurrentUser]);

  async function handleLogin() {
    const attemptId = window.crypto.randomUUID();
    const loginWindow = window.open(
      `/auth/launching?attempt=${encodeURIComponent(attemptId)}`,
      "calorieapp-xaman-login"
    );
    const controller = new AbortController();
    loginAbortController.current?.abort();
    loginAbortController.current = controller;

    setError(null);
    setSuccessNotice(null);
    setIsLoading(true);
    setLoginStatus(
      "Preparing Xaman. On phones, expect the return page to open in your configured default browser, possibly in a new tab. Keep this original CalorieApp tab open; it will sign in automatically too."
    );

    try {
      await waitForBackendReady(BACKEND_BASE_URL, controller.signal);
      setLoginStatus("Service ready. Opening Xaman...");

      const data = await startLoginWithRetry(controller.signal, () => {
        setLoginStatus(
          "CalorieApp is temporarily busy. Waiting safely before opening Xaman; keep both tabs open."
        );
      });
      if (!data.wordpress_signin_url || !data.browser_handoff_token) {
        throw new Error("Missing signin handoff data");
      }

      if (!loginWindow || loginWindow.closed) {
        window.location.assign(data.wordpress_signin_url);
        return;
      }

      sendXamanLocationToLaunchTab(
        loginWindow,
        attemptId,
        data.wordpress_signin_url
      );
      setLoginStatus(
        "Approve the request in Xaman. On phones, the return page normally opens in your configured default browser, possibly in a new tab. Keep this original tab open; it will sign in automatically too."
      );

      await waitForOriginLogin(
        data.state,
        data.browser_handoff_token,
        data.expires_at,
        controller.signal
      );

      try {
        loginWindow.close();
      } catch {
        // A browser may keep the external Xaman tab open. The login still succeeded.
      }

      await refreshCurrentUser();
      announceAuthState(true);
      setSuccessNotice(
        "Sign-in completed. You can continue in this original CalorieApp tab."
      );
      setLoginStatus(null);
      setIsLoading(false);
    } catch (requestError) {
      if (controller.signal.aborted) {
        return;
      }

      try {
        if (loginWindow && !loginWindow.closed) {
          loginWindow.postMessage(
            { type: XAMAN_LAUNCH_ERROR_TYPE, attemptId },
            window.location.origin
          );
          loginWindow.close();
        }
      } catch {
        // The external sign-in window may no longer be script-controllable.
      }
      setError(
        backendUnavailableMessage(
          requestError,
          "Sign-in could not be confirmed in this tab. You can continue in the browser Xaman opened, or try again."
        )
      );
      setLoginStatus(null);
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    setError(null);
    setIsLoggingOut(true);

    try {
      const response = await backendRequest(`${BACKEND_BASE_URL}/api/identity/logout`, {
        method: "POST",
      });

      if (response.status === 401) {
        setCurrentUser(null);
        announceAuthState(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to logout");
      }

      setCurrentUser(null);
      announceAuthState(false);
    } catch (requestError) {
      setError(
        backendUnavailableMessage(
          requestError,
          "Unable to logout right now. Please try again."
        )
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <section className="rounded-2xl border border-brand-secondary/20 bg-brand-primary/5 p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-secondary/70">
        Optional account access
      </p>
      <h2 className="mt-1 text-base font-semibold text-brand-primary">Sign in with Xaman</h2>
      <p className="mt-1 text-sm text-brand-secondary/90">
        Sign in securely to save, review, and manage your personal food log.
      </p>
      <div
        role="note"
        className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950"
      >
        <span className="font-semibold">Phone browser notice:</span> Expect the
        Xaman return page to open in your configured default browser, possibly
        in a new tab. Keep this original CalorieApp tab open; it will sign in
        automatically too.
      </div>

      {currentUser ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brand-primary">
            Signed in to CalorieApp
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center justify-center rounded-full border border-brand-primary px-5 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleLogin}
          disabled={isLoading}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Preparing Xaman..." : "Continue in Xaman"}
        </button>
      )}

      {isLoading && loginStatus ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs leading-relaxed text-brand-secondary"
        >
          {loginStatus}
        </p>
      ) : null}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {successNotice && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800"
        >
          {successNotice}
        </p>
      )}
    </section>
  );
}
