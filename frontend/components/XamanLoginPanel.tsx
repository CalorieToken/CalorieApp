"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { announceAuthState } from "@/components/authEvents";

type MeResponse = {
  user_id: string;
  created_at: string;
};

type LoginStartResponse = {
  state: string;
  expires_at: string;
  wordpress_signin_url: string;
};

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export function XamanLoginPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<MeResponse | null>(null);

  const backendConfigured = useMemo(() => BACKEND_BASE_URL.length > 0, []);

  const refreshCurrentUser = useCallback(async () => {
    if (!BACKEND_BASE_URL) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/identity/me`, {
        credentials: "include",
      });
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
  }, [refreshCurrentUser]);

  async function handleLogin() {
    if (!BACKEND_BASE_URL) {
      setError("Backend URL is not configured. Set NEXT_PUBLIC_BACKEND_URL.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/identity/login/start`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Unable to start login");
      }

      const data = (await response.json()) as LoginStartResponse;
      if (!data.wordpress_signin_url) {
        throw new Error("Missing signin URL");
      }

      window.location.assign(data.wordpress_signin_url);
    } catch {
      setError("Unable to start Xaman login right now. Please try again.");
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    if (!BACKEND_BASE_URL) {
      setError("Backend URL is not configured. Set NEXT_PUBLIC_BACKEND_URL.");
      return;
    }

    setError(null);
    setIsLoggingOut(true);

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/identity/logout`, {
        method: "POST",
        credentials: "include",
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
    } catch {
      setError("Unable to logout right now. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <section className="rounded-2xl border border-brand-secondary/20 bg-brand-primary/5 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-brand-primary">Xaman Sign-In</h2>
      <p className="mt-1 text-sm text-brand-secondary/90">
        Authenticate through WordPress + XUMM Login and return to CalorieApp.
      </p>

      {!backendConfigured && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          NEXT_PUBLIC_BACKEND_URL is not configured.
        </p>
      )}

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
          disabled={isLoading || !backendConfigured}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Redirecting..." : "Login with Xaman"}
        </button>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
