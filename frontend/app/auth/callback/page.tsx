"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  backendRequest,
  backendUnavailableMessage,
} from "@/lib/backendRequest";

const BACKEND_BASE_URL = "/api/backend";

type CallbackResponse = {
  redirect_to: string;
};

/*
 * React Strict Mode can run effects twice during local development.
 *
 * The backend intentionally allows each login state to be consumed only once,
 * so duplicate POSTs to /api/identity/callback must be avoided.
 *
 * Cache the in-flight request by code + state so repeated effects share the
 * same request instead of consuming the state twice.
 */
const callbackRequests = new Map<string, Promise<CallbackResponse>>();

function safeLocalRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }

  try {
    const base = new URL("https://calorieapp.invalid");
    const target = new URL(value, base);

    if (target.origin !== base.origin) {
      return "/";
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

function submitCallbackOnce(
  code: string,
  state: string
): Promise<CallbackResponse> {
  const key = `${code}\u0000${state}`;

  const existingRequest = callbackRequests.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  const request = backendRequest(`${BACKEND_BASE_URL}/api/identity/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, state }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Callback failed with status ${response.status}`);
    }

    return (await response.json()) as CallbackResponse;
  });

  callbackRequests.set(key, request);

  request.catch(() => {
    // Allow a later page reload to retry if the request failed before
    // successfully completing.
    if (callbackRequests.get(key) === request) {
      callbackRequests.delete(key);
    }
  });

  return request;
}

function AuthCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Finalizing sign-in...");

  const code = useMemo(() => params.get("code") ?? "", [params]);
  const state = useMemo(() => params.get("state") ?? "", [params]);

  useEffect(() => {
    let cancelled = false;

    async function finalizeLogin() {
      if (!code || !state) {
        if (!cancelled) {
          setStatus("error");
          setMessage("Missing login callback parameters.");
        }
        return;
      }

      try {
        const payload = await submitCallbackOnce(code, state);

        if (!cancelled) {
          window.sessionStorage.setItem(
            "calorieapp-login-return",
            "default-browser"
          );
          const redirectTo = safeLocalRedirect(payload.redirect_to);
          router.replace(
            `/auth/complete?next=${encodeURIComponent(redirectTo)}`
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            backendUnavailableMessage(
              requestError,
              "Sign-in could not be completed. Return to CalorieApp and try again."
            )
          );
        }
      }
    }

    void finalizeLogin();

    return () => {
      /*
       * Do not abort the backend request here.
       *
       * React Strict Mode deliberately runs effect cleanup/setup again during
       * development. Aborting here can allow the backend to consume the
       * one-time state while the browser discards the successful response.
       */
      cancelled = true;
    };
  }, [code, state, router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-16">
      <section className="w-full rounded-2xl border border-brand-secondary/20 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-brand-primary">
          Returning to CalorieApp
        </h1>

        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
          Phone browser notice: mobile systems may return from Xaman through
          your configured default browser instead of the tab where you started.
          This page completes your CalorieApp session in the browser shown now.
        </p>

        <p
          className="mt-4 text-sm text-brand-secondary/90"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>

        {status === "loading" ? (
          <div
            className="mx-auto mt-5 h-6 w-6 animate-spin rounded-full border-2 border-brand-secondary/30 border-t-brand-primary"
            aria-hidden="true"
          />
        ) : (
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Back to CalorieApp
          </Link>
        )}
      </section>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-16">
          <section className="w-full rounded-2xl border border-brand-secondary/20 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-brand-primary">
              CalorieApp Sign-In
            </h1>

            <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
              Phone browser notice: mobile systems may return from Xaman
              through your configured default browser. CalorieApp itself does
              not open an extra tab.
            </p>

            <p
              className="mt-4 text-sm text-brand-secondary/90"
              role="status"
              aria-live="polite"
            >
              Finalizing sign-in...
            </p>

            <div
              className="mx-auto mt-5 h-6 w-6 animate-spin rounded-full border-2 border-brand-secondary/30 border-t-brand-primary"
              aria-hidden="true"
            />
          </section>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
