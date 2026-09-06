"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AccountDataExportButton } from "@/components/AccountDataExportButton";
import { AccountDataImportPanel } from "@/components/AccountDataImportPanel";
import { AccountErasurePanel } from "@/components/AccountErasurePanel";
import { announceAuthState } from "@/components/authEvents";
import {
  BACKEND_WAKE_BASE_URL,
  backendRequest,
  backendUnavailableMessage,
  BackendRequestTimeoutError,
  waitForBackendReady,
} from "@/lib/backendRequest";
import { resolveLocale } from "@/lib/locales";

type MeResponse = {
  user_id: string;
  created_at: string;
};

type LoginStartResponse = {
  state: string;
  expires_at: string;
  wordpress_signin_url: string;
  browser_handoff_token: string;
  locale: string;
};

type LoginStatusResponse = {
  status: "pending" | "failed" | "authenticated";
  redirect_to?: string | null;
  locale: string;
};

type LoginCallbackResponse = {
  user_id: string;
  created: boolean;
  redirect_to: string;
  locale: string;
};

type PendingLogin = {
  state: string;
  expiresAt: string;
  browserHandoffToken: string;
  locale: string;
};

const BACKEND_BASE_URL = "/api/backend";
const ACCOUNT_ERASURE_UI_ENABLED =
  process.env.NEXT_PUBLIC_ACCOUNT_ERASURE_UI_ENABLED === "true";
const ACCOUNT_DATA_IMPORT_UI_ENABLED =
  process.env.NEXT_PUBLIC_ACCOUNT_DATA_IMPORT_UI_ENABLED === "true";
const LOGIN_STATUS_INITIAL_POLL_INTERVAL_MS = 5_000;
const LOGIN_STATUS_MIDDLE_POLL_INTERVAL_MS = 10_000;
const LOGIN_STATUS_LONG_POLL_INTERVAL_MS = 20_000;
const LOGIN_STATUS_TRANSIENT_MAX_DELAY_MS = 30_000;
const LOGOUT_REQUEST_TIMEOUT_MS = 75_000;
const LOGOUT_RETRY_TIMEOUT_MS = 15_000;
const LOGIN_STATUS_MIDDLE_PHASE_AFTER_MS = 30_000;
const LOGIN_STATUS_LONG_PHASE_AFTER_MS = 90_000;
const LOGIN_STATUS_FALLBACK_LIFETIME_MS = 5 * 60_000;
const LOGIN_STATUS_RATE_LIMIT_DELAY_MS = 15_000;
const LOGIN_STATUS_MAX_RETRY_AFTER_MS = 60_000;
const LOGIN_START_RETRY_WINDOW_MS = 2 * 60_000;
const EMBEDDED_LOGIN_START_RETRY_WINDOW_MS = 5 * 60_000;
const LOGIN_START_RETRY_DELAY_MS = 15_000;
const LOGIN_START_RATE_LIMIT_DELAY_MS = 30_000;
const LOGIN_START_REQUEST_TIMEOUT_MS = 75_000;
const LOGIN_CALLBACK_REQUEST_TIMEOUT_MS = 70_000;
const LOGIN_COMPLETION_RETRY_WINDOW_MS = 2 * 60_000;
const LOGIN_COMPLETION_RETRY_DELAY_MS = 5_000;
const LOGIN_COMPLETION_RATE_LIMIT_DELAY_MS = 30_000;
const LOGIN_COOKIE_CONFIRMATION_RETRY_WINDOW_MS = 10_000;
const MAX_EMBEDDED_AUTHORIZATION_REFRESHES = 2;
const PENDING_LOGIN_STORAGE_KEY = "calorieapp-pending-xaman-login";
const LOGIN_RETURN_STORAGE_KEY = "calorieapp-login-return";
const BRIDGE_STATE_ALREADY_CONSUMED_MESSAGE =
  "State is unknown, expired, or already used";
const WORDPRESS_APP_URL =
  process.env.NEXT_PUBLIC_WORDPRESS_APP_URL?.trim() ||
  "https://calorietoken.net/index.php/calorieapp/";

type ParentBridgeMessage = {
  type?: unknown;
  requestId?: unknown;
  message?: unknown;
  code?: unknown;
  state?: unknown;
  expires_at?: unknown;
  locale?: unknown;
  refresh?: unknown;
};

type EmbeddedAuthorizationRefreshReason =
  | "rate-limited"
  | "callback-uncertain";

export class EmbeddedAuthorizationRefreshRequiredError extends Error {
  constructor(
    readonly retryAfterMs: number,
    readonly reason: EmbeddedAuthorizationRefreshReason
  ) {
    super("A fresh WordPress authorization code is required");
    this.name = "EmbeddedAuthorizationRefreshRequiredError";
  }
}

export function embeddedAuthorizationRefreshDelayMs(
  error: unknown,
  completedRefreshes: number,
  pendingExpiresAt: string,
  nowMs = Date.now()
): number | null {
  if (
    !(error instanceof EmbeddedAuthorizationRefreshRequiredError) ||
    completedRefreshes >= MAX_EMBEDDED_AUTHORIZATION_REFRESHES
  ) {
    return null;
  }

  const expiresAtMs = Date.parse(pendingExpiresAt);
  const retryAfterMs = Math.max(0, error.retryAfterMs);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs - nowMs <= retryAfterMs) {
    return null;
  }

  return retryAfterMs;
}

type LoginSurfaceMode = "checking" | "embedded" | "standalone";

function initialLocale(): string {
  if (typeof window === "undefined") {
    return "en";
  }

  const queryLocale = new URLSearchParams(window.location.search).get("locale");
  const documentLocale = document.documentElement.lang;
  const browserLocale = navigator.languages?.join(",") || navigator.language;
  return resolveLocale(queryLocale || documentLocale || browserLocale);
}

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

function expectsEmbeddedBridge(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.parent !== window ||
    new URLSearchParams(window.location.search).get("embedded") === "1"
  );
}

export function resolveLoginSurfaceMode(
  bridgeInitialized: boolean,
  embeddedBridgeExpected: boolean
): LoginSurfaceMode {
  if (bridgeInitialized) {
    return "embedded";
  }
  return embeddedBridgeExpected ? "checking" : "standalone";
}

function createBrowserRequestId(): string {
  if (typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function clearPendingLogin() {
  window.sessionStorage.removeItem(PENDING_LOGIN_STORAGE_KEY);
}

function storePendingLogin(data: LoginStartResponse) {
  const pendingLogin: PendingLogin = {
    state: data.state,
    expiresAt: data.expires_at,
    browserHandoffToken: data.browser_handoff_token,
    locale: data.locale,
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
      locale: resolveLocale(typeof value.locale === "string" ? value.locale : "en"),
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

export function loginStatusPollDelayMs(
  elapsedMs: number,
  consecutiveTransientFailures = 0
): number {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const baseDelay =
    safeElapsedMs >= LOGIN_STATUS_LONG_PHASE_AFTER_MS
      ? LOGIN_STATUS_LONG_POLL_INTERVAL_MS
      : safeElapsedMs >= LOGIN_STATUS_MIDDLE_PHASE_AFTER_MS
      ? LOGIN_STATUS_MIDDLE_POLL_INTERVAL_MS
      : LOGIN_STATUS_INITIAL_POLL_INTERVAL_MS;
  const failureDelay = Math.min(
    LOGIN_STATUS_TRANSIENT_MAX_DELAY_MS,
    LOGIN_STATUS_INITIAL_POLL_INTERVAL_MS *
      2 ** Math.max(0, consecutiveTransientFailures)
  );
  return Math.max(baseDelay, failureDelay);
}

export async function waitForOriginLogin(
  state: string,
  browserHandoffToken: string,
  expiresAt: string,
  signal: AbortSignal,
  expectedLocale = "en",
  initialDelayMs = LOGIN_STATUS_INITIAL_POLL_INTERVAL_MS
) {
  const parsedExpiry = Date.parse(expiresAt);
  const deadline = Number.isFinite(parsedExpiry)
    ? parsedExpiry
    : Date.now() + LOGIN_STATUS_FALLBACK_LIFETIME_MS;
  const pollingStartedAt = Date.now();
  let consecutiveTransientFailures = 0;
  let nextPollDelayMs = Math.max(0, initialDelayMs);

  while (Date.now() < deadline) {
    if (nextPollDelayMs > 0) {
      await delay(
        Math.min(nextPollDelayMs, Math.max(0, deadline - Date.now())),
        signal
      );
    }
    if (Date.now() >= deadline) {
      break;
    }

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
      consecutiveTransientFailures += 1;
      nextPollDelayMs = loginStatusPollDelayMs(
        Date.now() - pollingStartedAt,
        consecutiveTransientFailures
      );
      continue;
    }

    if (response.status === 429) {
      consecutiveTransientFailures += 1;
      nextPollDelayMs = Math.max(
        loginStatusPollDelayMs(
          Date.now() - pollingStartedAt,
          consecutiveTransientFailures
        ),
        retryAfterMilliseconds(response, LOGIN_STATUS_RATE_LIMIT_DELAY_MS)
      );
      await discardLoginResponse(response);
      continue;
    }
    if ([502, 503, 504].includes(response.status)) {
      consecutiveTransientFailures += 1;
      nextPollDelayMs = Math.max(
        loginStatusPollDelayMs(
          Date.now() - pollingStartedAt,
          consecutiveTransientFailures
        ),
        retryAfterMilliseconds(response, 0)
      );
      await discardLoginResponse(response);
      continue;
    }
    if (!response.ok) {
      await discardLoginResponse(response);
      throw new Error(`Login status failed with ${response.status}`);
    }

    const payload = (await response.json()) as LoginStatusResponse;
    if (resolveLocale(payload.locale) !== expectedLocale) {
      throw new Error("Login status language context did not match");
    }
    if (payload.status === "authenticated") {
      return;
    }
    if (payload.status === "failed") {
      throw new Error("Xaman callback failed");
    }
    consecutiveTransientFailures = 0;
    nextPollDelayMs = loginStatusPollDelayMs(Date.now() - pollingStartedAt);
  }

  throw new Error("Login handoff expired");
}

function retryAfterMilliseconds(
  response: Response,
  fallbackMs = LOGIN_START_RATE_LIMIT_DELAY_MS
): number {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) {
    return fallbackMs;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, LOGIN_STATUS_MAX_RETRY_AFTER_MS);
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return fallbackMs;
  }

  return Math.min(
    Math.max(0, retryAt - Date.now()),
    LOGIN_STATUS_MAX_RETRY_AFTER_MS
  );
}

async function discardLoginResponse(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // The small error body may already have been consumed by the runtime.
  }
}

async function waitForAuthenticatedUserBeforeHandoff(
  signal: AbortSignal,
  retryWindowMs = LOGIN_COOKIE_CONFIRMATION_RETRY_WINDOW_MS
): Promise<MeResponse | null> {
  const deadline = Date.now() + retryWindowMs;
  let nextRetryDelayMs = 0;

  while (Date.now() < deadline) {
    if (nextRetryDelayMs > 0) {
      await delay(
        Math.min(nextRetryDelayMs, Math.max(0, deadline - Date.now())),
        signal
      );
    }
    if (Date.now() >= deadline) {
      break;
    }

    let response: Response;
    try {
      response = await backendRequest(
        `${BACKEND_BASE_URL}/api/identity/me`,
        { signal }
      );
    } catch (requestError) {
      if (signal.aborted) {
        throw signal.reason ?? requestError;
      }
      nextRetryDelayMs = LOGIN_COMPLETION_RETRY_DELAY_MS;
      continue;
    }

    if (response.ok) {
      return (await response.json()) as MeResponse;
    }

    if (response.status === 401) {
      await discardLoginResponse(response);
      return null;
    }
    if (![429, 502, 503, 504].includes(response.status)) {
      await discardLoginResponse(response);
      throw new Error(`CalorieApp session check failed with ${response.status}`);
    }

    nextRetryDelayMs =
      response.status === 429
        ? retryAfterMilliseconds(
            response,
            LOGIN_COMPLETION_RATE_LIMIT_DELAY_MS
          )
        : LOGIN_COMPLETION_RETRY_DELAY_MS;
    await discardLoginResponse(response);
  }

  return null;
}

async function recoverUncertainEmbeddedCallback(
  pending: LoginStartResponse,
  signal: AbortSignal,
  retryWindowMs: number
): Promise<MeResponse | null> {
  let response: Response;
  try {
    response = await backendRequest(
      `${BACKEND_BASE_URL}/api/identity/login/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: pending.state,
          browser_handoff_token: pending.browser_handoff_token,
        }),
        signal,
      }
    );
  } catch (requestError) {
    if (signal.aborted) {
      throw signal.reason ?? requestError;
    }
    return null;
  }

  if ([429, 502, 503, 504].includes(response.status)) {
    await discardLoginResponse(response);
    return null;
  }
  if (!response.ok) {
    await discardLoginResponse(response);
    throw new Error(`Login status failed with ${response.status}`);
  }

  const payload = (await response.json()) as LoginStatusResponse;
  if (resolveLocale(payload.locale) !== resolveLocale(pending.locale)) {
    throw new Error("Login status language context did not match");
  }
  if (payload.status === "failed") {
    throw new Error("Xaman callback failed");
  }
  if (payload.status !== "authenticated") {
    return null;
  }

  try {
    return await waitForAuthenticatedUserAfterLogin(signal, retryWindowMs);
  } catch (sessionError) {
    if (signal.aborted) {
      throw signal.reason ?? sessionError;
    }
    return null;
  }
}

async function recoverOrRequireFreshAuthorization(
  pending: LoginStartResponse,
  signal: AbortSignal,
  deadline: number,
  retryAfterMs: number,
  reason: EmbeddedAuthorizationRefreshReason
): Promise<MeResponse> {
  const recoveredUser = await recoverUncertainEmbeddedCallback(
    pending,
    signal,
    Math.max(1, deadline - Date.now())
  );
  if (recoveredUser) {
    return recoveredUser;
  }

  throw new EmbeddedAuthorizationRefreshRequiredError(retryAfterMs, reason);
}

export async function waitForAuthenticatedUserAfterLogin(
  signal: AbortSignal,
  retryWindowMs = LOGIN_COMPLETION_RETRY_WINDOW_MS
): Promise<MeResponse> {
  const deadline = Date.now() + retryWindowMs;
  let nextRetryDelayMs = 0;

  while (Date.now() < deadline) {
    if (nextRetryDelayMs > 0) {
      await delay(
        Math.min(nextRetryDelayMs, Math.max(0, deadline - Date.now())),
        signal
      );
    }
    if (Date.now() >= deadline) {
      break;
    }

    let response: Response;
    try {
      response = await backendRequest(
        `${BACKEND_BASE_URL}/api/identity/me`,
        { signal }
      );
    } catch (requestError) {
      if (signal.aborted) {
        throw signal.reason ?? requestError;
      }
      nextRetryDelayMs = LOGIN_COMPLETION_RETRY_DELAY_MS;
      continue;
    }

    if (response.ok) {
      return (await response.json()) as MeResponse;
    }

    if (![429, 502, 503, 504].includes(response.status)) {
      await discardLoginResponse(response);
      throw new Error(`CalorieApp session check failed with ${response.status}`);
    }

    nextRetryDelayMs =
      response.status === 429
        ? retryAfterMilliseconds(
            response,
            LOGIN_COMPLETION_RATE_LIMIT_DELAY_MS
          )
        : LOGIN_COMPLETION_RETRY_DELAY_MS;
    await discardLoginResponse(response);
  }

  throw new BackendRequestTimeoutError();
}

export async function completeEmbeddedLogin(
  pending: LoginStartResponse,
  code: string,
  state: string,
  signal: AbortSignal,
  retryWindowMs = LOGIN_COMPLETION_RETRY_WINDOW_MS
): Promise<MeResponse> {
  if (state !== pending.state) {
    throw new Error("WordPress callback state did not match this browser");
  }

  const parsedExpiry = Date.parse(pending.expires_at);
  const deadline = Math.min(
    Number.isFinite(parsedExpiry)
      ? parsedExpiry
      : Date.now() + retryWindowMs,
    Date.now() + retryWindowMs
  );
  if (Date.now() >= deadline) {
    throw new BackendRequestTimeoutError();
  }

  let response: Response;
  try {
    response = await backendRequest(
      `${BACKEND_BASE_URL}/api/identity/callback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
        signal,
      },
      Math.max(
        1,
        Math.min(LOGIN_CALLBACK_REQUEST_TIMEOUT_MS, deadline - Date.now())
      )
    );
  } catch (requestError) {
    if (signal.aborted) {
      throw signal.reason ?? requestError;
    }
    return recoverOrRequireFreshAuthorization(
      pending,
      signal,
      deadline,
      LOGIN_COMPLETION_RETRY_DELAY_MS,
      "callback-uncertain"
    );
  }

  if (!response.ok) {
    const callbackStatus = response.status;
    const isRateLimited = callbackStatus === 429;
    const isUncertain = [502, 503, 504].includes(callbackStatus);
    const retryDelayMs =
      isRateLimited || isUncertain
        ? retryAfterMilliseconds(
            response,
            isRateLimited
              ? LOGIN_COMPLETION_RATE_LIMIT_DELAY_MS
              : LOGIN_COMPLETION_RETRY_DELAY_MS
          )
        : LOGIN_COMPLETION_RETRY_DELAY_MS;
    await discardLoginResponse(response);

    // A 400 can mean a timed-out earlier callback finished just before a fresh
    // code arrived. Recover only when the state-bound handoff proves that
    // earlier callback completed; otherwise keep the 400 permanent.
    if (callbackStatus === 400) {
      try {
        const recoveredUser = await recoverUncertainEmbeddedCallback(
          pending,
          signal,
          Math.max(1, deadline - Date.now())
        );
        if (recoveredUser) {
          return recoveredUser;
        }
      } catch (recoveryError) {
        if (signal.aborted) {
          throw signal.reason ?? recoveryError;
        }
      }
    }

    if (isRateLimited || isUncertain) {
      return recoverOrRequireFreshAuthorization(
        pending,
        signal,
        deadline,
        retryDelayMs,
        isRateLimited ? "rate-limited" : "callback-uncertain"
      );
    }

    throw new Error(`Callback failed with ${callbackStatus}`);
  }

  let callback: LoginCallbackResponse;
  try {
    callback = (await response.json()) as LoginCallbackResponse;
  } catch {
    return recoverOrRequireFreshAuthorization(
      pending,
      signal,
      deadline,
      LOGIN_COMPLETION_RETRY_DELAY_MS,
      "callback-uncertain"
    );
  }
  if (
    typeof callback.user_id !== "string" ||
    typeof callback.locale !== "string"
  ) {
    return recoverOrRequireFreshAuthorization(
      pending,
      signal,
      deadline,
      LOGIN_COMPLETION_RETRY_DELAY_MS,
      "callback-uncertain"
    );
  }
  if (resolveLocale(callback.locale) !== resolveLocale(pending.locale)) {
    throw new Error("Callback language context did not match");
  }

  // Most browsers retain the callback's same-origin session cookie directly.
  // Avoid consuming the one-time handoff unless that cookie is unavailable.
  const callbackUser = await waitForAuthenticatedUserBeforeHandoff(
    signal,
    Math.max(
      1,
      Math.min(
        LOGIN_COOKIE_CONFIRMATION_RETRY_WINDOW_MS,
        deadline - Date.now()
      )
    )
  );
  if (callbackUser) {
    if (callbackUser.user_id !== callback.user_id) {
      throw new Error("Callback session user did not match");
    }
    return callbackUser;
  }

  // If the callback response arrived without a usable cookie, claim the
  // browser-bound handoff as a recovery path.
  await waitForOriginLogin(
    pending.state,
    pending.browser_handoff_token,
    pending.expires_at,
    signal,
    pending.locale,
    0
  );

  return waitForAuthenticatedUserAfterLogin(
    signal,
    Math.max(1, deadline - Date.now())
  );
}

type LoginStartRetryReason = "rate-limited" | "temporarily-unavailable";
type EmbeddedLoginPreparationPhase = LoginStartRetryReason | "waking-up";

export async function startLoginWithRetry(
  signal: AbortSignal,
  onRetry: (reason: LoginStartRetryReason) => void,
  retryWindowMs = LOGIN_START_RETRY_WINDOW_MS,
  locale = "en"
): Promise<LoginStartResponse> {
  const deadline = Date.now() + retryWindowMs;

  while (Date.now() < deadline) {
    let response: Response;
    try {
      response = await backendRequest(
        `${BACKEND_BASE_URL}/api/identity/login/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: resolveLocale(locale) }),
          signal,
        },
        Math.max(
          1,
          Math.min(LOGIN_START_REQUEST_TIMEOUT_MS, deadline - Date.now())
        )
      );
    } catch (requestError) {
      if (signal.aborted) {
        throw signal.reason ?? requestError;
      }
      onRetry("temporarily-unavailable");
      await delay(
        Math.min(LOGIN_START_RETRY_DELAY_MS, Math.max(0, deadline - Date.now())),
        signal
      );
      continue;
    }

    if (response.ok) {
      return (await response.json()) as LoginStartResponse;
    }

    if (response.status === 429) {
      onRetry("rate-limited");
      await delay(retryAfterMilliseconds(response), signal);
      continue;
    }

    if ([502, 503, 504].includes(response.status)) {
      onRetry("temporarily-unavailable");
      await delay(LOGIN_START_RETRY_DELAY_MS, signal);
      continue;
    }

    throw new Error(`Unable to start login (${response.status})`);
  }

  throw new BackendRequestTimeoutError();
}

export async function prepareEmbeddedLogin(
  signal: AbortSignal,
  onProgress: (phase: EmbeddedLoginPreparationPhase) => void,
  retryWindowMs = EMBEDDED_LOGIN_START_RETRY_WINDOW_MS,
  locale = "en"
): Promise<LoginStartResponse> {
  // A GET readiness probe reliably wakes a spun-down Render Free backend.
  // Sending login/start as the first request can be rejected by Render's edge
  // with 429 responses before the Python service has started.
  if (signal.aborted) {
    throw signal.reason ?? new Error("Login cancelled");
  }
  onProgress("waking-up");
  await waitForBackendReady(BACKEND_WAKE_BASE_URL, signal);
  return startLoginWithRetry(signal, onProgress, retryWindowMs, locale);
}

export async function requestCalorieAppLogout(): Promise<void> {
  let logoutFailure: unknown = null;

  for (const timeoutMs of [
    LOGOUT_REQUEST_TIMEOUT_MS,
    LOGOUT_RETRY_TIMEOUT_MS,
  ]) {
    try {
      const response = await backendRequest(
        `${BACKEND_BASE_URL}/api/identity/logout`,
        { method: "POST" },
        timeoutMs
      );
      if (response.status === 401 || response.ok) {
        return;
      }
      logoutFailure = new Error("Unable to log out");
      break;
    } catch (error) {
      // The first request can time out while the free frontend wakes. Retrying
      // the same cookie-clearing endpoint is stronger than probing /me: it
      // completes logout even when the separate backend remains asleep.
      logoutFailure = error;
    }
  }

  throw logoutFailure instanceof Error
    ? logoutFailure
    : new Error("Unable to log out");
}

export function XamanLoginPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<MeResponse | null>(null);
  const [loginSurfaceMode, setLoginSurfaceMode] =
    useState<LoginSurfaceMode>("checking");
  const [displayLocale, setDisplayLocale] = useState(initialLocale);
  const loginAbortController = useRef<AbortController | null>(null);
  const parentOrigin = useRef<string | null>(null);
  const embeddedRequestId = useRef("");
  const embeddedLoginStart = useRef<LoginStartResponse | null>(null);
  const embeddedAuthorizationRefreshes = useRef(0);
  const embeddedAuthorizationInFlight = useRef(false);
  const beginLoginRef = useRef<() => void>(() => {});
  const activeLocale = useRef(displayLocale);

  const refreshCurrentUser = useCallback(async (signal?: AbortSignal): Promise<MeResponse | null> => {
    try {
      const response = await backendRequest(
        `${BACKEND_BASE_URL}/api/identity/me`,
        { signal }
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
      announceAuthState(true);
      return data;
    } catch {
      if (signal?.aborted) {
        return null;
      }
      setCurrentUser(null);
      return null;
    }
  }, []);

  const clearCalorieAppSession = useCallback(async () => {
    await requestCalorieAppLogout();
    setCurrentUser(null);
    announceAuthState(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    loginAbortController.current = controller;

    async function restoreLogin() {
      const user = await refreshCurrentUser(controller.signal);
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
          controller.signal,
          pendingLogin.locale
        );
        clearPendingLogin();

        const restoredUser = await waitForAuthenticatedUserAfterLogin(
          controller.signal
        );
        if (cancelled) {
          return;
        }
        setCurrentUser(restoredUser);
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
    const bridgeController = new AbortController();
    let origin = trustedParentOrigin();
    parentOrigin.current = origin;
    setLoginSurfaceMode(
      resolveLoginSurfaceMode(false, expectsEmbeddedBridge())
    );

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
          locale: activeLocale.current,
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
        const nextLocale = resolveLocale(
          typeof event.data.locale === "string" ? event.data.locale : activeLocale.current
        );
        activeLocale.current = nextLocale;
        setDisplayLocale(nextLocale);
        setLoginSurfaceMode(resolveLoginSurfaceMode(true, true));
        window.parent.postMessage(
          { type: "calorieapp:bridge:initialized", locale: nextLocale },
          event.origin
        );
        postHeight();
        return;
      }

      if (
        origin &&
        event.origin === origin &&
        event.source === window.parent &&
        event.data?.type === "calorieapp:login:trigger"
      ) {
        beginLoginRef.current();
        return;
      }

      if (
        origin &&
        event.origin === origin &&
        event.source === window.parent &&
        event.data?.type === "calorieapp:logout"
      ) {
        setError(null);
        setSuccessNotice(null);
        setIsLoggingOut(true);
        try {
          await clearCalorieAppSession();
          window.parent.postMessage(
            { type: "calorieapp:logout:complete", locale: activeLocale.current },
            origin
          );
        } catch (requestError) {
          const message = backendUnavailableMessage(
            requestError,
            "Could not log out of both sessions. Please try again."
          );
          setError(message);
          window.parent.postMessage(
            {
              type: "calorieapp:logout:error",
              message,
              locale: activeLocale.current,
            },
            origin
          );
        } finally {
          setIsLoggingOut(false);
        }
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

      if (
        typeof event.data.type === "string" &&
        event.data.type.startsWith("calorieapp:login:") &&
        event.data.locale !== activeLocale.current
      ) {
        setError("The WordPress sign-in language context did not match this page.");
        setLoginStatus(null);
        setIsLoading(false);
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
          const pending = embeddedLoginStart.current;
          if (
            pending &&
            event.data.message === BRIDGE_STATE_ALREADY_CONSUMED_MESSAGE
          ) {
            setError(null);
            setLoginStatus(
              "WordPress signed in. Restoring CalorieApp in this browser..."
            );

            try {
              await waitForOriginLogin(
                pending.state,
                pending.browser_handoff_token,
                pending.expires_at,
                bridgeController.signal,
                pending.locale
              );
              const restoredUser = await waitForAuthenticatedUserAfterLogin(
                bridgeController.signal
              );
              setCurrentUser(restoredUser);
              announceAuthState(true);

              embeddedLoginStart.current = null;
              clearPendingLogin();
              setLoginStatus(null);
              setIsLoading(false);
              setSuccessNotice(
                "Signed in to WordPress and CalorieApp in this browser."
              );
              window.parent.postMessage(
                {
                  type: "calorieapp:login:complete",
                  requestId: embeddedRequestId.current,
                  locale: pending.locale,
                },
                origin
              );
              return;
            } catch (requestError) {
              if (bridgeController.signal.aborted) {
                return;
              }
              setError(
                backendUnavailableMessage(
                  requestError,
                  "WordPress is signed in, but CalorieApp could not finish. Please try again."
                )
              );
              embeddedLoginStart.current = null;
              clearPendingLogin();
              setLoginStatus(null);
              setIsLoading(false);
              return;
            }
          }

          embeddedLoginStart.current = null;
          clearPendingLogin();
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
        event.data.state !== pending.state ||
        event.data.locale !== pending.locale
      ) {
        setError("The WordPress sign-in response did not match this CalorieApp request.");
        setLoginStatus(null);
        setIsLoading(false);
        return;
      }

      if (embeddedAuthorizationInFlight.current) {
        return;
      }

      embeddedAuthorizationInFlight.current = true;
      try {
        setLoginStatus("Activating CalorieApp in this browser...");
        const restoredUser = await completeEmbeddedLogin(
          pending,
          event.data.code,
          event.data.state,
          bridgeController.signal
        );

        embeddedLoginStart.current = null;
        embeddedAuthorizationRefreshes.current = 0;
        clearPendingLogin();
        setCurrentUser(restoredUser);
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
            locale: pending.locale,
          },
          origin
        );
      } catch (requestError) {
        const refreshDelayMs = embeddedAuthorizationRefreshDelayMs(
          requestError,
          embeddedAuthorizationRefreshes.current,
          pending.expires_at
        );
        if (refreshDelayMs !== null) {
          embeddedAuthorizationRefreshes.current += 1;
          setError(null);
          setLoginStatus(
            "WordPress is signed in. Refreshing the secure CalorieApp connection automatically..."
          );

          if (refreshDelayMs > 0) {
            try {
              await delay(refreshDelayMs, bridgeController.signal);
            } catch {
              return;
            }
          }
          if (
            bridgeController.signal.aborted ||
            embeddedLoginStart.current !== pending ||
            embeddedRequestId.current !== event.data.requestId
          ) {
            return;
          }

          // Re-sending the same state asks the already-authenticated WordPress
          // bridge for a fresh one-time code. It never reopens Xaman and remains
          // compatible with the preceding bridge release during rollout.
          window.parent.postMessage(
            {
              type: "calorieapp:login:state",
              requestId: embeddedRequestId.current,
              state: pending.state,
              locale: pending.locale,
              refresh: true,
            },
            origin
          );
          return;
        }

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
            locale: pending.locale,
          },
          origin
        );
      } finally {
        embeddedAuthorizationInFlight.current = false;
      }
    };

    window.addEventListener("message", handleParentMessage);
    window.parent.postMessage(
      { type: "calorieapp:bridge:ready", locale: activeLocale.current },
      "*"
    );
    return () => {
      bridgeController.abort();
      resizeObserver?.disconnect();
      window.removeEventListener("message", handleParentMessage);
    };
  }, [clearCalorieAppSession, refreshCurrentUser]);

  async function handleLogin() {
    const controller = new AbortController();
    loginAbortController.current?.abort();
    loginAbortController.current = controller;

    setError(null);
    setSuccessNotice(null);
    setIsLoading(true);

    if (parentOrigin.current) {
      const embeddedParentOrigin = parentOrigin.current;
      const requestId = createBrowserRequestId();
      embeddedRequestId.current = requestId;
      embeddedLoginStart.current = null;
      embeddedAuthorizationRefreshes.current = 0;
      embeddedAuthorizationInFlight.current = false;
      setLoginStatus(
        "Preparing Xaman and starting CalorieApp securely in the background..."
      );

      try {
        const data = await prepareEmbeddedLogin(
          controller.signal,
          (reason) => {
            const message =
              reason === "waking-up"
                ? "Xaman is ready. Starting the secure CalorieApp service. This can take about a minute. Keep this page open."
                : reason === "rate-limited"
                ? "Xaman is ready. CalorieApp is temporarily busy and will retry automatically. Keep this page open."
                : "Xaman is ready. CalorieApp is still starting and will retry automatically. Keep this page open.";
            setLoginStatus(message);
            window.parent.postMessage(
              {
                type: "calorieapp:login:progress",
                requestId,
                message,
                locale: activeLocale.current,
              },
              embeddedParentOrigin
            );
          },
          EMBEDDED_LOGIN_START_RETRY_WINDOW_MS,
          activeLocale.current
        );
        if (
          data.state.length < 32 ||
          data.browser_handoff_token.length < 32 ||
          !Number.isFinite(Date.parse(data.expires_at)) ||
          Date.parse(data.expires_at) <= Date.now() ||
          data.locale !== activeLocale.current
        ) {
          throw new Error("Missing CalorieApp login state");
        }

        storePendingLogin(data);
        embeddedLoginStart.current = data;
        window.parent.postMessage(
          {
            type: "calorieapp:login:start",
            requestId,
            state: data.state,
            locale: data.locale,
          },
          embeddedParentOrigin
        );
        // Keep one transition release compatible with the previous parent
        // bridge, which receives the prepared state as a follow-up message.
        window.parent.postMessage(
          {
            type: "calorieapp:login:state",
            requestId,
            state: data.state,
            locale: data.locale,
          },
          embeddedParentOrigin
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
            locale: activeLocale.current,
          },
          embeddedParentOrigin
        );
      }
      return;
    }

    // An embedded-looking document must never navigate itself to WordPress.
    // Until a trusted parent handshake exists, keep the control inert. The
    // standalone surface uses an explicit same-tab link rendered below.
    setIsLoading(false);
  }

  beginLoginRef.current = () => {
    if (!isLoading && parentOrigin.current) {
      void handleLogin();
    }
  };

  async function handleLogout() {
    setError(null);
    setSuccessNotice(null);
    setIsLoggingOut(true);

    if (parentOrigin.current) {
      window.parent.postMessage(
        {
          type: "calorieapp:logout:request",
          locale: activeLocale.current,
        },
        parentOrigin.current
      );
      return;
    }

    try {
      await clearCalorieAppSession();
    } catch (requestError) {
      setError(
        backendUnavailableMessage(
          requestError,
          "Unable to log out right now. Please try again."
        )
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <section
      className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${
        currentUser
          ? "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white"
          : "border-brand-secondary/20 bg-brand-primary/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold shadow-sm ${
            currentUser
              ? "bg-emerald-600 text-white"
              : "bg-brand-primary text-white"
          }`}
        >
          {currentUser ? "✓" : "X"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-secondary/70">
            {currentUser ? "Connected account" : "Optional account access"}
          </p>
          <h2 className="mt-0.5 text-base font-bold text-brand-primary">
            {currentUser ? "You’re signed in" : "Sign in with Xaman"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-brand-secondary/90">
            {currentUser
              ? loginSurfaceMode === "embedded"
                ? "Your website and CalorieApp sessions are connected in this browser."
                : "Your CalorieApp session is active in this browser."
              : "Connect securely to save, review, and manage your personal food log."}
          </p>
        </div>
        {currentUser ? (
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-bold text-emerald-700 sm:inline-flex">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
            Connected
          </span>
        ) : null}
      </div>

      {!currentUser ? (
        <div
          role="note"
          className="mt-4 rounded-2xl border border-amber-300/80 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-950"
        >
          <span className="font-semibold">On your phone:</span>{" "}
          {loginSurfaceMode === "embedded"
            ? "Sign once in Xaman, then tap Close or use Back. This page finishes both sign-ins automatically."
            : loginSurfaceMode === "standalone"
              ? "Continue on CalorieToken.net to sign in to the website and CalorieApp together."
              : "Connecting this view to the secure CalorieToken.net sign-in page."}
        </div>
      ) : null}

      {currentUser ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200/80 bg-white/90 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-brand-primary">
                {loginSurfaceMode === "embedded"
                  ? "Website + CalorieApp"
                  : "CalorieApp session"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-brand-secondary/75">
                {loginSurfaceMode === "embedded"
                  ? "One button safely ends both sessions."
                  : "Sign out on this device when you’re finished."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoggingOut
                ? "Signing out..."
                : loginSurfaceMode === "embedded"
                  ? "Sign out everywhere"
                  : "Sign out"}
            </button>
          </div>

          <details className="group border-t border-brand-secondary/10 pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary/30 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-brand-secondary/60">
                  Account tools
                </span>
                <span className="mt-0.5 block text-xs text-brand-secondary/75">
                  Export and privacy options
                </span>
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 text-xl leading-none text-brand-secondary/70 transition group-open:rotate-180"
              >
                ⌄
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              <AccountDataExportButton
                locale={displayLocale}
                onAuthenticationLost={(message) => {
                  setCurrentUser(null);
                  announceAuthState(false);
                  setError(message);
                }}
              />
              {ACCOUNT_DATA_IMPORT_UI_ENABLED ? (
                <AccountDataImportPanel
                  userId={currentUser.user_id}
                  locale={displayLocale}
                  onAuthenticationLost={(message) => {
                    setCurrentUser(null);
                    announceAuthState(false);
                    setError(message);
                  }}
                />
              ) : null}
              {ACCOUNT_ERASURE_UI_ENABLED ? (
                <AccountErasurePanel
                  userId={currentUser.user_id}
                  locale={displayLocale}
                  onAuthenticationLost={(message) => {
                    setCurrentUser(null);
                    announceAuthState(false);
                    setError(message);
                  }}
                  onErased={(message) => {
                    setCurrentUser(null);
                    announceAuthState(false);
                    setError(null);
                    setSuccessNotice(message);
                  }}
                />
              ) : null}
            </div>
          </details>
        </div>
      ) : loginSurfaceMode === "standalone" ? (
        <a
          href={WORDPRESS_APP_URL}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Continue on CalorieToken.net
        </a>
      ) : (
        <button
          type="button"
          onClick={handleLogin}
          disabled={isLoading || loginSurfaceMode === "checking"}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading
            ? "Preparing Xaman..."
            : loginSurfaceMode === "checking"
              ? "Connecting secure sign-in..."
              : "Continue in Xaman"}
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
