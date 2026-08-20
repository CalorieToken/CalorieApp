"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

type CallbackResponse = {
  redirect_to: string;
};

function AuthCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Finalizing sign-in...");

  const code = useMemo(() => params.get("code") ?? "", [params]);
  const state = useMemo(() => params.get("state") ?? "", [params]);

  useEffect(() => {
    async function finalizeLogin() {
      if (!BACKEND_BASE_URL) {
        setStatus("error");
        setMessage("Backend URL is not configured.");
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Missing login callback parameters.");
        return;
      }

      try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/identity/callback`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          throw new Error("Callback failed");
        }

        const payload = (await response.json()) as CallbackResponse;
        const redirectTo =
          payload.redirect_to &&
          payload.redirect_to.startsWith("/") &&
          !payload.redirect_to.startsWith("//")
            ? payload.redirect_to
            : "/";

        router.replace(redirectTo);
      } catch {
        setStatus("error");
        setMessage("Sign-in failed. Please try logging in again.");
      }
    }

    finalizeLogin();
  }, [code, state, router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-16">
      <section className="w-full rounded-2xl border border-brand-secondary/20 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-brand-primary">CalorieApp Sign-In</h1>
        <p className="mt-3 text-sm text-brand-secondary/90">{message}</p>

        {status === "loading" ? (
          <div className="mx-auto mt-5 h-6 w-6 animate-spin rounded-full border-2 border-brand-secondary/30 border-t-brand-primary" />
        ) : (
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Back to Home
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
            <h1 className="text-xl font-semibold text-brand-primary">CalorieApp Sign-In</h1>
            <p className="mt-3 text-sm text-brand-secondary/90">Finalizing sign-in...</p>
            <div className="mx-auto mt-5 h-6 w-6 animate-spin rounded-full border-2 border-brand-secondary/30 border-t-brand-primary" />
          </section>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
