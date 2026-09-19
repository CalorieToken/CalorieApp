"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createStore, connectGuest, type DisplayStore } from "@/lib/displayLanguageRuntime";
import { localeDirection, resolveLocale, supportedLocales } from "@/lib/locales";
import translations from "@/config/display-language-copy.json";

type DisplayContext = { enabled: boolean; locale: string; parentManaged: boolean; select(locale: string): void };
const Context = createContext<DisplayContext>({ enabled: false, locale: "en", parentManaged: false, select: () => {} });

const PREFERENCE_KEY = "calorieapp.display-language.v1";
const PREFERENCE_LIFETIME = 30 * 24 * 60 * 60 * 1000;

function supportedLocale(value?: string | null): string | null {
  if (!value) return null;
  for (const part of value.split(",")) {
    const raw = part.split(";", 1)[0]?.trim().replace(/_/g, "-").toLowerCase();
    if (!raw || raw === "*") continue;
    const exact = supportedLocales.find(item =>
      item.tag.toLowerCase() === raw || item.aliases.some(alias => alias.toLowerCase() === raw));
    if (exact) return exact.tag;
    const primary = raw.split("-", 1)[0];
    const base = supportedLocales.find(item => !item.tag.includes("-") && item.tag.toLowerCase() === primary);
    if (base) return base.tag;
  }
  return null;
}

function explicitQueryLocale(): string | null {
  const query = new URLSearchParams(window.location.search);
  const value = query.get("ui_lang") || query.get("locale");
  return supportedLocale(value);
}

function savedLocale(): string | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(PREFERENCE_KEY) ?? "null") as { locale?: unknown; savedAt?: unknown } | null;
    if (!value || typeof value.locale !== "string" || typeof value.savedAt !== "number") return null;
    if (value.savedAt > Date.now() || Date.now() - value.savedAt >= PREFERENCE_LIFETIME) return null;
    return supportedLocales.some(item => item.tag === value.locale) ? value.locale : null;
  } catch { return null; }
}

function inferredLocale(): string {
  const browser = navigator.languages?.join(",") || navigator.language;
  const browserLocale = supportedLocale(browser);
  if (browserLocale) return browserLocale;
  const siteLocale = supportedLocale(document.documentElement.lang);
  if (siteLocale) return siteLocale;
  // CalorieToken.net is Dutch-first. English remains available explicitly.
  return "nl";
}

export function DisplayLanguageProvider({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_CALORIEAPP_DISPLAY_LANGUAGE !== "0";
  const store = useRef<DisplayStore | null>(null);
  const [locale, setLocale] = useState("en");
  const [parentManaged, setParentManaged] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);
  useEffect(() => {
    if (!enabled) {
      document.documentElement.removeAttribute("data-calorieapp-language-pending");
      return;
    }
    setParentManaged(false);
    setLanguageReady(false);
    const explicit = explicitQueryLocale();
    // This public display choice never changes the login's locale query/state.
    // URL choice wins, then a saved explicit choice, browser preference, site
    // language and finally the Dutch-first site default.
    const initial = explicit || savedLocale() || inferredLocale();
    const current = createStore({
      locales: supportedLocales.map(item => item.tag), fallback: "nl", initialLocale: resolveLocale(initial),
      storage: {
        getItem: key => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
        removeItem: key => window.localStorage.removeItem(key),
      },
    });
    if (explicit) current.apply(explicit, true);
    store.current = current;
    setLocale(current.get().locale);
    const unsubscribe = current.subscribe(state => setLocale(state.locale));
    const embedded = window.parent !== window && typeof window.crypto?.randomUUID === "function";
    let parentTimer: number | undefined;
    const disconnect = embedded
      ? connectGuest({
          window, parent: window.parent, channel: window.crypto.randomUUID(),
          store: {
            ...current,
            apply(value, explicit) {
              // connectGuest invokes apply only after validating the parent,
              // origin and protocol state, even when the locale is unchanged.
              setParentManaged(true);
              setLanguageReady(true);
              return current.apply(value, explicit);
            },
          },
          origins: ["https://calorietoken.net", "https://www.calorietoken.net"],
        })
      : () => {};
    if (embedded) parentTimer = window.setTimeout(() => setLanguageReady(true), 700);
    else setLanguageReady(true);
    return () => {
      if (parentTimer !== undefined) window.clearTimeout(parentTimer);
      disconnect(); unsubscribe(); store.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const priorLanguage = root.getAttribute("lang");
    const priorDirection = root.getAttribute("dir");
    root.lang = locale;
    root.dir = localeDirection(locale);
    if (languageReady) root.removeAttribute("data-calorieapp-language-pending");
    return () => {
      if (priorLanguage === null) root.removeAttribute("lang"); else root.setAttribute("lang", priorLanguage);
      if (priorDirection === null) root.removeAttribute("dir"); else root.setAttribute("dir", priorDirection);
    };
  }, [enabled, languageReady, locale]);

  return <Context.Provider value={{ enabled, locale, parentManaged, select: value => store.current?.select(value) }}>{children}</Context.Provider>;
}

export function useDisplayLanguage() { return useContext(Context); }

export function DisplayLanguagePicker() {
  const { enabled, locale, parentManaged, select } = useDisplayLanguage();
  if (!enabled || parentManaged) return null;
  const copy = translations[locale as keyof typeof translations] ?? translations.en;
  return (
    <details className="group mb-4 min-w-0 rounded-xl border border-brand-secondary/20 bg-white text-sm text-brand-secondary" lang={locale} dir={localeDirection(locale)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary [&::-webkit-details-marker]:hidden">
        <span>{copy.label}: {supportedLocales.find(item => item.tag === locale)?.native_name ?? locale}</span>
        <span aria-hidden="true" className="transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-brand-secondary/15 px-3 pb-3 pt-2">
        <label className="sr-only" htmlFor="calorieapp-language-select">{copy.label}</label>
        <select id="calorieapp-language-select" value={locale} onChange={event => select(event.target.value)} aria-describedby="calorieapp-language-preview-note"
          className="min-h-11 w-full min-w-0 rounded-lg border border-brand-secondary bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary">
          {supportedLocales.map(item => <option key={item.tag} value={item.tag} lang={item.tag}>{item.native_name}</option>)}
        </select>
        <p id="calorieapp-language-preview-note" className="mt-2 text-xs">{copy.preview}</p>
      </div>
    </details>
  );
}
