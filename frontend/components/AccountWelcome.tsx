"use client";

import type { ReactNode } from "react";
import translations from "@/config/account-welcome-copy.json";

export function AccountWelcome({ locale, onBrowse, onSetup, children }: {
  locale: string;
  onBrowse: () => void;
  onSetup: () => void;
  children: ReactNode;
}) {
  const copy = translations[locale as keyof typeof translations] ?? translations.en;
  return <div className="mt-5 space-y-3" data-account-welcome>
    <h3 className="text-lg font-bold text-brand-primary">{copy.title}</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={onBrowse} className="min-h-12 rounded-2xl border border-brand-primary/30 bg-white p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary">
        <span className="block font-bold text-brand-primary">{copy.browse} <span aria-hidden="true">→</span></span>
        <span className="mt-2 block text-sm leading-relaxed text-brand-secondary">{copy.browseHelp}</span>
      </button>
      <button type="button" onClick={onSetup} className="min-h-12 rounded-2xl border border-brand-primary/30 bg-brand-primary/5 p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary">
        <span className="block font-bold text-brand-primary">{copy.start} <span aria-hidden="true">→</span></span>
        <span className="mt-2 block text-sm leading-relaxed text-brand-secondary">{copy.startHelp}</span>
      </button>
    </div>
    <div className="rounded-2xl border border-brand-secondary/20 bg-white p-4">
      <h4 className="font-bold text-brand-primary">{copy.existing}</h4>
      <p className="mt-1 text-sm leading-relaxed text-brand-secondary">{copy.existingHelp}</p>
      {children}
    </div>
  </div>;
}
