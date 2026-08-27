"use client";

import { useCallback, useEffect, useState } from "react";
import { announceAuthState } from "@/components/authEvents";
import {
  backendRequest,
  backendUnavailableMessage,
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
};

const BACKEND_BASE_URL = "/api/backend";

export function XamanLoginPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<MeResponse | null>(null);

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
      setCurrentUser(dat);
    } catch {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    refreshCurrentUser();
  }, [refreshCurrentUser]);

  async function handleLogin() {
    setError(null);
    setIsLoading(true);
    setLoginStatus(
      "Connecting securely. After inactivity, startup can take up to 90 seconds."
    );

    try {
      await waitForBackendReady(BACKEND_BASE_URL);
      setLoginStatus("Service ready. Opening Xaman...");

      const response = await backendRequest(`${BACKEND_BASE_URL}/api/identity/login/start`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to start login");
      }

      const data = (await response.json()) as LoginStartResponse;
      if (!data.wordpress_signin_url) {
        throw new Error("Missing signin URL");
      }

      window.location.assign(data.wordpress_signin_url);
    } catch (requestError) {
      setError(
        backendUnavailableMessage(
          requestError,
          "Unable to start Xaman login right now. Please try again."
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
      <p className="mt-2 text-xs leading-relaxed text-brand-secondary/75">
        On your phone, the Xaman app opens outside this browser. After approval,
        you return here automatically.
      </p>

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
    </section>
  );
}
