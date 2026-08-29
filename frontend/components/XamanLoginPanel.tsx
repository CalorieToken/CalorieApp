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

type PendingLogin = {
  state: string;
  expiresAt: string;
  browserHandoffToken: string;
};

const BACKEND_BASE_URL = "/api/backend";
const LOGIN_STATUS_POLL_INTERVAL_MS = 5_000;
const LOGIN_STATUS_FALLBACK_LIFETIME_MS = 5 * 60_000;
const LOGIN_STATUS_RATE_LIMIT_DELAY_MS = 15_000;
const LOGIN_STATUS_MAX_RETRY_AFTER_MS = 60_000;
const LOGIN_START_RETRY_WINDOW_MS = 2 * 60_000;
const EMBEDDED_LOGIN_START_RETRY_WINDOW_MS = 5 * 60_000;
const LOGIN_START_RETRY_DELAY_MS = 15_000;
const LOGIN_START_REQUEST_TIMEOUT_MS = 70_000;
const PENDING_LOGIN_STORAGE_KEY = "calorieapp-pending-xaman-login";
const LOGIN_RETURN_STORAGE_KEY = "calorieapp-login-return";
const WORDPRESS_APP_URL =
  process.env.NEXT_PUBLIC_WORDPRESS_APP_URL?.trim() ||
  "https://calorietoken.net/calorieapp/";

type ParentBridgeMessage = {
  type?: unknown;
  requestId?: unknown;
  message?: unknown;
  code?: unknown;
  state?: unknown;
};

function isAllowedParentOrigin(value: string): boolean {
  try {
    const origin = new URL(value);
    const isProduction =
      origin.protocol === "https:" &&
      ["calorietoken.net", "www.calorietoken.net"].includes(origin.hostname);
    const isLocal =
      ["http:", "https:"].includes(origin.protocol) &&
      ["localhost", "127.0.0.1"].includes(origin.hostname);

    return isProduction || isLocal;
  } catch {
    return false;
  }
}

function trustedParentOrigin(): string | null {
  if (window.parent === window || !document.referrer) {
    return null;
  }

  try {
    const origin = new URL(document.referrer);
    return isAllowedParentOrigin(origin.origin) ? origin.origin : null;
  } catch {
    return null;
  }
}

function createBrowserRequestId(): string {
  if (typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function isAllowedWordPressSigninUrl(value: string): boolean {
  try {
    const target = new URL(value);
    return (
      target.protocol === "https:" &&
      target.hostname === "calorietoken.net" &&
      target.searchParams.has("xl-signin")
    );
  } catch {
    return false;
  }
}

function clearPendingLogin() {
  window.sessionStorage.removeItem(PENDING_LOGIN_STORAGE_KEY);
}

function storePendingLogin(data: LoginStartResponse) {
  const pendingLogin: PendingLogin = {
    state: data.state,
    expiresAt: data.expires_at,
    browserHandoffToken: data.browser_handoff_token,
  };

  window.sessionStorage.setItem(
    PENDING_LOGIN_STORAGE_KEY,
    JSON.stringify(pendingLogin)
  );
}

function readPendingLogin(): PendingLogin | null {
  const stored = window.sessionStorage.getItem(PENDING_LOGIN_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const value = JSON.parse(stored) as Partial<PendingLogin>;
    const expiresAt = Date.parse(value.expiresAt ?? "");
    if (
      typeof value.state !== "string" ||
      value.state.length < 32 ||
      typeof value.browserHandoffToken !== "string" ||
      value.browserHandoffToken.length < 32 ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      clearPendingLogin();
      return null;
    }

    return {
      state: value.state,
      expiresAt: value.expiresAt as string,
      browserHandoffToken: value.browserHandoffToken,
    };
  } catch {
    clearPendingLogin();
    return null;
  }
}

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
  onRateLimited: () => void,
  retryWindowMs = LOGIN_START_RETRY_WINDOW_MS
): Promise<LoginStartResponse> {
  const deadline = Date.now() + retryWindowMs;

  while (Date.now() < deadline) {
    const response = await backendRequest(
      `${BACKEND_BASE_URL}/api/identity/login/start`,
      { method: "POST", signal },
      Math.max(
        1,
        Math.min(LOGIN_START_REQUEST_TIMEOUT_MS, deadline - Date.now())
      )
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

export function XamanLoginPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<MeResponse | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const loginAbortController = useRef<AbortController | null>(null);
  const parentOrigin = useRef<string | null>(null);
  const embeddedRequestId = useRef("");
  const embeddedLoginStart = useRef<LoginStartResponse | null>(null);

  const refreshCurrentUser = useCallback(async (): Promise<MeResponse | null> => {
    try {
      const response = await backendRequest(
        `${BACKEND_BASE_URL}/api/identity/me`
      );
      if (!response.ok) {
        setCurrentUser(null);
        if (response.status === 401) {
          announceAuthState(false);
        }
        return null;
      }
      const data = (await response.json()) as MeResponse;
      setCurrentUser(data);
      return data;
    } catch {
      setCurrentUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    loginAbortController.current = controller;

    async function restoreLogin() {
      const user = await refreshCurrentUser();
      if (cancelled || controller.signal.aborted) {
        return;
      }

      if (user) {
        clearPendingLogin();
        if (window.sessionStorage.getItem(LOGIN_RETURN_STORAGE_KEY)) {
          window.sessionStorage.removeItem(LOGIN_RETURN_STORAGE_KEY);
          setSuccessNotice(
            "Sign-in completed. You can continue safely in this browser."
          );
        }
        return;
      }

      const pendingLogin = readPendingLogin();
      if (!pendingLogin) {
        return;
      }

      setError(null);
      setIsLoading(true);
      setLoginStatus("Restoring the Xaman sign-in started from this tab...");

      try {
        await waitForOriginLogin(
          pendingLogin.state,
          pendingLogin.browserHandoffToken,
          pendingLogin.expiresAt,
          controller.signal
        );
        clearPendingLogin();

        const restoredUser = await refreshCurrentUser();
        if (!restoredUser) {
          throw new Error("Restored session was unavailable");
        }
        if (cancelled) {
          return;
        }

        announceAuthState(true);
        setSuccessNotice(
          "Sign-in completed. Your session was restored in this browser."
        );
        setLoginStatus(null);
        setIsLoading(false);
      } catch {
        if (controller.signal.aborted || cancelled) {
          return;
        }

        clearPendingLogin();
        setError(
          "The earlier Xaman sign-in could not be restored. Start again from this tab."
        );
        setLoginStatus(null);
        setIsLoading(false);
      }
    }

    void restoreLogin();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshCurrentUser]);

  useEffect(() => {
    let origin = trustedParentOrigin();
    parentOrigin.current = origin;
    setIsEmbedded(origin !== null);

    const postHeight = () => {
      if (!origin) {
        return;
      }
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0
      );
      window.parent.postMessage(
        {
          type: "calorieapp:frame:height",
          requestId: embeddedRequestId.current,
          height,
        },
        origin
      );
    };

    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(postHeight) : null;
    resizeObserver?.observe(document.documentElement);
    postHeight();

    const handleParentMessage = async (event: MessageEvent<ParentBridgeMessage>) => {
      if (
        event.source === window.parent &&
        event.data?.type === "calorieapp:bridge:init" &&
        isAllowedParentOrigin(event.origin)
      ) {
        origin = event.origin;
        parentOrigin.current = event.origin;
        setIsEmbedded(true);
        postHeight();
        return;
      }

      if (
        !origin ||
        event.origin !== origin ||
        event.source !== window.parent ||
        !event.data ||
        event.data.requestId !== embeddedRequestId.current
      ) {
        return;
      }

      if (event.data.type === "calorieapp:login:progress") {
        if (typeof event.data.message === "string") {
          setLoginStatus(event.data.message);
        }
        return;
      }

      if (event.data.type === "calorieapp:login:error") {
        if (typeof event.data.message === "string") {
          setError(event.data.message);
          setLoginStatus(null);
          setIsLoading(false);
        }
        return;
      }

      if (event.data.type !== "calorieapp:login:authorization") {
        return;
      }

      const pending = embeddedLoginStart.current;
      if (
        !pending ||
        typeof event.data.code !== "string" ||
        typeof event.data.state !== "string" ||
        event.data.state !== pending.state
      ) {
        setError("The WordPress sign-in response did not match this CalorieApp request.");
        setLoginStatus(null);
        setIsLoading(false);
        return;
      }

      try {
        setLoginStatus("Activating CalorieApp in this browser...");
        const response = await backendRequest(
          `${BACKEND_BASE_URL}/api/identity/callback`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: event.data.code, state: event.data.state }),
          },
          70_000
        );
        if (!response.ok) {
          throw new Error(`Callback failed with ${response.status}`);
        }

        const restoredUser = await refreshCurrentUser();
        if (!restoredUser) {
          throw new Error("CalorieApp session was unavailable");
        }

        embeddedLoginStart.current = null;
        announceAuthState(true);
        setError(null);
        setLoginStatus(null);
        setIsLoading(false);
        setSuccessNotice(
          "Signed in to WordPress and CalorieApp in this browser."
        );
        window.parent.postMessage(
          {
            type: "calorieapp:login:complete",
            requestId: embeddedRequestId.current,
          },
          origin
        );
      } catch (requestError) {
        const message = backendUnavailableMessage(
          requestError,
          "WordPress is signed in, but CalorieApp could not finish. Please try again."
        );
        setError(message);
        setLoginStatus(null);
        setIsLoading(false);
        window.parent.postMessage(
          {
            type: "calorieapp:login:backend-error",
            requestId: embeddedRequestId.current,
            message,
          },
          origin
        );
      }
    };

    window.addEventListener("message", handleParentMessage);
    window.parent.postMessage({ type: "calorieapp:bridge:ready" }, "*");
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("message", handleParentMessage);
    };
  }, [refreshCurrentUser]);

  async function handleLogin() {
    const controller = new AbortController();
    let startupNoticeTimer: number | null = null;
    let xamanNavigationStarted = false;
    loginAbortController.current?.abort();
    loginAbortController.current = controller;

    setError(null);
    setSuccessNotice(null);
    setIsLoading(true);

    if (isEmbedded && parentOrigin.current) {
      const requestId = createBrowserRequestId();
      embeddedRequestId.current = requestId;
      embeddedLoginStart.current = null;
      setLoginStatus(
        "Preparing Xaman and starting CalorieApp securely in the background..."
      );

      window.parent.postMessage(
        { type: "calorieapp:login:start", requestId },
        parentOrigin.current
      );

      try {
        const data = await startLoginWithRetry(
          controller.signal,
          () => {
            setLoginStatus(
              "Xaman can continue while CalorieApp waits safely for its service."
            );
          },
          EMBEDDED_LOGIN_START_RETRY_WINDOW_MS
        );
        if (
          data.state.length < 32 ||
          data.browser_handoff_token.length < 32 ||
          !Number.isFinite(Date.parse(data.expires_at)) ||
          Date.parse(data.expires_at) <= Date.now()
        ) {
          throw new Error("Missing CalorieApp login state");
        }

        embeddedLoginStart.current = data;
        window.parent.postMessage(
          {
            type: "calorieapp:login:state",
            requestId,
            state: data.state,
          },
          parentOrigin.current
        );
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }
        const message = backendUnavailableMessage(
          requestError,
          "CalorieApp could not prepare its session. WordPress sign-in was not changed."
        );
        setError(message);
        setLoginStatus(null);
        setIsLoading(false);
        window.parent.postMessage(
          {
            type: "calorieapp:login:backend-error",
            requestId,
            message,
          },
          parentOrigin.current
        );
      }
      return;
    }

    if (!isEmbedded) {
      setLoginStatus("Opening the secure CalorieApp page on CalorieToken.net...");
      window.location.assign(WORDPRESS_APP_URL);
      return;
    }

    setLoginStatus(
      "Preparing Xaman in this tab. Please wait without refreshing."
    );

    try {
      startupNoticeTimer = window.setTimeout(() => {
        if (!controller.signal.aborted) {
          setLoginStatus(
            "Starting the secure CalorieApp service. A first request can take about a minute and will continue automatically."
          );
        }
      }, 8_000);

      // Keep the mobile browser on the CalorieApp origin while Render wakes.
      // A direct cross-origin health request can be blocked by browser privacy
      // controls before the WordPress/Xaman navigation has even started.
      await waitForBackendReady(BACKEND_BASE_URL, controller.signal);
      window.clearTimeout(startupNoticeTimer);
      startupNoticeTimer = null;
      setLoginStatus("Service ready. Opening Xaman...");

      const data = await startLoginWithRetry(controller.signal, () => {
        setLoginStatus(
          "CalorieApp is temporarily busy. Waiting safely before opening Xaman..."
        );
      });
      if (
        data.state.length < 32 ||
        data.browser_handoff_token.length < 32 ||
        !Number.isFinite(Date.parse(data.expires_at)) ||
        Date.parse(data.expires_at) <= Date.now() ||
        !isAllowedWordPressSigninUrl(data.wordpress_signin_url)
      ) {
        throw new Error("Missing signin handoff data");
      }

      storePendingLogin(data);
      setLoginStatus("Opening Xaman from this tab...");
      xamanNavigationStarted = true;
      window.location.assign(data.wordpress_signin_url);

      // Some mobile browsers keep this document alive while Xaman opens and
      // later return the callback through the configured default browser. Keep
      // claiming the secure handoff here so this initiating tab signs in as
      // soon as the callback finishes, without requiring a refresh.
      setLoginStatus(
        "Waiting for Xaman sign-in to finish. This tab will sign in automatically."
      );
      await waitForOriginLogin(
        data.state,
        data.browser_handoff_token,
        data.expires_at,
        controller.signal
      );
      clearPendingLogin();

      const restoredUser = await refreshCurrentUser();
      if (!restoredUser) {
        throw new Error("Restored session was unavailable");
      }

      announceAuthState(true);
      setSuccessNotice(
        "Sign-in completed. This original CalorieApp tab is signed in too."
      );
      setLoginStatus(null);
      setIsLoading(false);
    } catch (requestError) {
      if (controller.signal.aborted) {
        return;
      }

      clearPendingLogin();
      setError(
        backendUnavailableMessage(
          requestError,
          xamanNavigationStarted
            ? "Xaman sign-in did not finish in this tab. Please try again."
            : "Xaman could not be opened from this tab. Please try again."
        )
      );
      setLoginStatus(null);
      setIsLoading(false);
    } finally {
      if (startupNoticeTimer !== null) {
        window.clearTimeout(startupNoticeTimer);
      }
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
        <span className="font-semibold">Phone browser notice:</span>{" "}
        {isEmbedded
          ? "Xaman opens without a browser return link. After signing, use Close or Back to return to this same page; WordPress and CalorieApp will then sign in together."
          : "Secure Xaman sign-in is completed on CalorieToken.net so WordPress and CalorieApp can sign in together in the same browser."}
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
          {isLoading
            ? "Preparing Xaman..."
            : isEmbedded
              ? "Continue in Xaman"
              : "Open secure sign-in"}
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
