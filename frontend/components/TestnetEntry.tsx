"use client";

import { useEffect, useState } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { localeDirection } from "@/lib/locales";
import translations from "@/config/testnet-entry-copy.json";

const origins = ["https://calorietoken.net", "https://www.calorietoken.net"];
const prefix = "calorieapp:testnet-guide:";

export function TestnetEntry() {
  const display = useDisplayLanguage();
  const locale = display.enabled && display.locale in translations ? display.locale : "en";
  const copy = translations[locale as keyof typeof translations];
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => {
    if (window.parent === window) return;
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (event.source === window.parent && origins.includes(event.origin) && data &&
          typeof data === "object" && !Array.isArray(data) && Object.keys(data).length === 2 &&
          data.type === prefix + "available" && data.version === 1) setHost(event.origin);
    };
    window.addEventListener("message", receive);
    origins.forEach(origin => window.parent.postMessage({ type: prefix + "ready", version: 1 }, origin));
    return () => window.removeEventListener("message", receive);
  }, []);

  return (
    <details className="mt-4 rounded-xl border border-brand-secondary/20 bg-brand-bg p-4" lang={locale} dir={localeDirection(locale)}>
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-secondary">{copy.title}</summary>
      <p className="mt-2 text-sm leading-relaxed text-brand-primary">{copy.description}</p>
      <a href="https://calorietoken.net/index.php/calorieapp/#ctstyle-testnet" target="_top"
        onClick={event => {
          if (!host || window.parent === window) return;
          event.preventDefault();
          window.parent.postMessage({ type: prefix + "open", version: 1 }, host);
        }}
        className="mt-3 inline-flex min-h-12 items-center rounded-lg border-2 border-brand-secondary bg-brand-accent px-4 py-3 text-sm font-bold text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
        {copy.start}
      </a>
      <p className="mt-3 text-xs leading-relaxed text-brand-secondary">{copy.scope}</p>
    </details>
  );
}
