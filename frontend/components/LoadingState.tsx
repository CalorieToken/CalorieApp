"use client";

import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { getFoodUi } from "@/lib/foodUi";

type LoadingStateProps = {
  variant: "search" | "logs";
  message?: string;
};

export function LoadingState({ variant, message }: LoadingStateProps) {
  const display = useDisplayLanguage();
  const { copy, locale, direction } = getFoodUi(display.enabled ? display.locale : "en");
  if (variant === "logs") {
    return (
      <div className="mt-4 space-y-2" aria-live="polite" aria-busy="true" lang={locale} dir={direction}>
        <span className="sr-only">{copy.loadingLogs}</span>
        <div className="h-14 rounded-lg bg-brand-secondary/10 animate-pulse" />
        <div className="h-14 rounded-lg bg-brand-secondary/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mt-5" aria-live="polite" aria-busy="true" lang={locale} dir={direction}>
      <p className="mb-3 rounded-lg bg-brand-primary/5 px-3 py-2 text-xs leading-relaxed text-brand-secondary">
        {message ?? copy.loadingSearch}
      </p>
      <ul className="space-y-3">
        <li className="rounded-xl border border-brand-secondary/15 bg-white p-5 shadow-sm">
          <div className="h-5 w-2/3 rounded bg-brand-secondary/10 animate-pulse" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
            <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
            <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
            <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
          </div>
          <div className="mt-4 h-8 w-28 rounded-full bg-brand-primary/20 animate-pulse" />
        </li>
        <li className="rounded-xl border border-brand-secondary/15 bg-white p-5 shadow-sm">
          <div className="h-5 w-1/2 rounded bg-brand-secondary/10 animate-pulse" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
            <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
            <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
            <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
          </div>
          <div className="mt-4 h-8 w-28 rounded-full bg-brand-primary/20 animate-pulse" />
        </li>
      </ul>
    </div>
  );
}
