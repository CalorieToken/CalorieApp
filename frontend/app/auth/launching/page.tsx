"use client";

import { useEffect, useState } from "react";

const XAMAN_LAUNCH_MESSAGE_TYPE = "calorieapp-xaman-navigate";
const XAMAN_LAUNCH_ERROR_TYPE = "calorieapp-xaman-error";

type XamanLaunchMessage = {
  type?: unknown;
  attemptId?: unknown;
  url?: unknown;
};

function isAllowedXamanSigninUrl(value: string): boolean {
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

export default function XamanLaunchingPage() {
  const [message, setMessage] = useState(
    "Waiting for CalorieApp to prepare the secure Xaman request. During heavy traffic this can take up to two minutes; do not refresh either tab."
  );

  useEffect(() => {
    const attemptId = new URLSearchParams(window.location.search).get(
      "attempt"
    );

    const handleMessage = (event: MessageEvent<XamanLaunchMessage>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.opener ||
        !event.data ||
        event.data.attemptId !== attemptId
      ) {
        return;
      }

      if (event.data.type === XAMAN_LAUNCH_ERROR_TYPE) {
        setMessage(
          "CalorieApp could not start Xaman. Return to the original tab and try again after a short wait."
        );
        return;
      }

      if (
        event.data.type !== XAMAN_LAUNCH_MESSAGE_TYPE ||
        typeof event.data.url !== "string" ||
        !isAllowedXamanSigninUrl(event.data.url)
      ) {
        return;
      }

      setMessage("Opening Xaman now...");
      window.opener = null;
      window.location.replace(event.data.url);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-16">
      <section className="w-full rounded-2xl border border-brand-secondary/20 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-brand-primary">
          Preparing Xaman sign-in
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-secondary/90">
          On phones, expect the Xaman return page to open in your configured
          default browser, possibly in a new tab. Keep your original CalorieApp
          tab open; it will finish signing in automatically too.
        </p>
        <p
          className="mt-4 text-xs leading-relaxed text-brand-secondary/75"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
        <div
          className="mx-auto mt-5 h-6 w-6 animate-spin rounded-full border-2 border-brand-secondary/30 border-t-brand-primary"
          aria-hidden="true"
        />
      </section>
    </main>
  );
}
