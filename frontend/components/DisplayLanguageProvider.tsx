"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createStore, connectGuest, type DisplayStore } from "@/lib/displayLanguageRuntime";
import { localeDirection, resolveLocale, supportedLocales } from "@/lib/locales";
import translations from "@/config/display-language-copy.json";

type DisplayContext = { enabled: boolean; locale: string; select(locale: string): void };
const Context = createContext<DisplayContext>({ enabled: false, locale: "en", select: () => {} });

export function DisplayLanguageProvider({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_CALORIEAPP_DISPLAY_LANGUAGE !== "0";
  const store = useRef<DisplayStore | null>(null);
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    if (!enabled) return;
    // This public display choice never changes the login's locale query/state.
    const initial = new URLSearchParams(window.location.search).get("ui_lang") ||
      new URLSearchParams(window.location.search).get("locale") ||
      document.documentElement.lang || navigator.languages?.join(",") || navigator.language;
    const current = createStore({
      locales: supportedLocales.map(item => item.tag), fallback: "en", initialLocale: resolveLocale(initial),
      storage: {
        getItem: key => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
        removeItem: key => window.localStorage.removeItem(key),
      },
    });
    store.current = current;
    setLocale(current.get().locale);
    const unsubscribe = current.subscribe(state => setLocale(state.locale));
    const disconnect = window.parent !== window && typeof window.crypto?.randomUUID === "function"
      ? connectGuest({
          window, parent: window.parent, store: current, channel: window.crypto.randomUUID(),
          origins: ["https://calorietoken.net", "https://www.calorietoken.net"],
        })
      : () => {};
    return () => { disconnect(); unsubscribe(); store.current = null; };
  }, [enabled]);

  return <Context.Provider value={{ enabled, locale, select: value => store.current?.select(value) }}>{children}</Context.Provider>;
}

export function useDisplayLanguage() { return useContext(Context); }

export function DisplayLanguagePicker() {
  const { enabled, locale, select } = useDisplayLanguage();
  if (!enabled) return null;
  const copy = translations[locale as keyof typeof translations] ?? translations.en;
  return (
    <div className="mb-5 min-w-0 border-b border-brand-secondary/20 pb-4 text-sm text-brand-secondary" lang={locale} dir={localeDirection(locale)}>
      <label className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{copy.label}</span>
        <select value={locale} onChange={event => select(event.target.value)} aria-describedby="calorieapp-language-preview-note"
          className="min-h-11 min-w-0 max-w-full rounded border border-brand-secondary bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary">
          {supportedLocales.map(item => <option key={item.tag} value={item.tag} lang={item.tag}>{item.native_name}</option>)}
        </select>
      </label>
      <p id="calorieapp-language-preview-note" className="mt-2 text-xs">{copy.preview}</p>
    </div>
  );
}
