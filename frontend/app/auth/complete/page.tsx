"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

function safeLocalRedirect(value: string | null): string {
  if (
    !value ||
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

function LoginCompleteContent() {
  const params = useSearchParams();
  const next = useMemo(
    () => safeLocalRedirect(params.get("next")),
    [params]
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-16">
      <section className="w-full rounded-2xl border border-brand-secondary/20 bg-white p-8 text-center shadow-sm">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-800"
          aria-hidden="true"
        >
          ✓
        </div>
        <h1 className="mt-4 text-xl font-semibold text-brand-primary">
          Sign-in completed
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-secondary/90">
          Your original CalorieApp tab is signing in automatically. You can
          close this tab and return there, even if Xaman opened this page in
          your phone&apos;s default browser.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-brand-secondary/70">
          You are also signed in in this browser, so continuing here is safe.
        </p>
        <Link
          href={next}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Continue in this browser
        </Link>
      </section>
    </main>
  );
}

export default function LoginCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-16">
          <p className="text-sm text-brand-secondary/80">
            Completing sign-in...
          </p>
        </main>
      }
    >
      <LoginCompleteContent />
    </Suspense>
  );
}
