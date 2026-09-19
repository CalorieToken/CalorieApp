"use client";

import Link from "next/link";

import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { gameverseCopy } from "@/lib/gameverseWorld";

export function GameversePortalLink() {
  const display = useDisplayLanguage();
  const { copy } = gameverseCopy(display.enabled ? display.locale : "en");
  return (
    <Link
      href="/gameverse"
      className="mb-5 flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-brand-secondary/20 bg-gradient-to-r from-brand-primary/5 via-white to-brand-secondary/5 px-4 py-3 text-sm font-bold text-brand-secondary shadow-sm transition hover:border-brand-primary/40 hover:shadow"
    >
      <span>
        <span className="block text-[10px] font-extrabold uppercase tracking-[.12em] text-brand-primary">{copy.world}</span>
        <span className="block">{copy.subtitle}</span>
      </span>
      <span aria-hidden="true" className="text-xl text-brand-primary">→</span>
    </Link>
  );
}
