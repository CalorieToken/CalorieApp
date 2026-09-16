"use client";

import { FormEvent, useEffect, useState } from "react";
import { AUTH_STATE_CHANGED_EVENT, type AuthStateChangedDetail } from "@/components/authEvents";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { localeDirection } from "@/lib/locales";
import translations from "@/config/testnet-entry-copy.json";

export const NICKNAME_STORAGE_KEY = "calorieapp.nickname.v1";

export function validNickname(value: string): string | null {
  const normalized = value.normalize("NFC").trim();
  const characters = Array.from(normalized);
  if (characters.length < 2 || characters.length > 32 || /[\u0000-\u001F\u007F<>]/u.test(normalized)) return null;
  return normalized;
}

function readNickname(): string {
  try { return validNickname(window.sessionStorage.getItem(NICKNAME_STORAGE_KEY) ?? "") ?? ""; }
  catch { return ""; }
}

export function NicknameProfile() {
  const display = useDisplayLanguage();
  const locale = display.enabled && display.locale in translations ? display.locale : "en";
  const copy = translations[locale as keyof typeof translations];
  const [nickname, setNickname] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = readNickname();
    setNickname(saved);
    setDraft(saved);
    function handleAuth(event: Event) {
      const auth = event as CustomEvent<AuthStateChangedDetail>;
      if (auth.detail?.authenticated !== false) return;
      try { window.sessionStorage.removeItem(NICKNAME_STORAGE_KEY); } catch { /* Session storage can be blocked. */ }
      setNickname("");
      setDraft("");
      setStatus(null);
      setError(null);
    }
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuth);
    return () => window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuth);
  }, []);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validNickname(draft);
    if (!next) { setError(copy.nicknameInvalid); setStatus(null); return; }
    try { window.sessionStorage.setItem(NICKNAME_STORAGE_KEY, next); }
    catch { setError(copy.nicknameStorageBlocked); setStatus(null); return; }
    setNickname(next);
    setDraft(next);
    setError(null);
    setStatus(copy.nicknameSaved);
  }

  function remove() {
    try { window.sessionStorage.removeItem(NICKNAME_STORAGE_KEY); } catch { /* The in-memory value is still cleared. */ }
    setNickname("");
    setDraft("");
    setError(null);
    setStatus(copy.nicknameRemoved);
  }

  return (
    <details className="group mt-3 rounded-2xl border border-brand-secondary/20 bg-brand-bg"
      lang={locale} dir={localeDirection(locale)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary [&::-webkit-details-marker]:hidden">
        <h2 id="nickname-profile-title" className="text-sm font-bold text-brand-primary">{copy.profileTitle}{nickname ? ` · ${nickname}` : ""}</h2>
        <span aria-hidden="true" className="text-brand-secondary transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-brand-secondary/15 p-4" aria-labelledby="nickname-profile-title">
      <p className="text-xs leading-relaxed text-brand-secondary">{copy.profileDescription}</p>
      {nickname ? <p className="mt-3 text-sm font-bold text-brand-primary">{copy.hello.replace("{nickname}", nickname)}</p> : null}
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={save}>
        <label className="min-w-0 flex-1 basis-48 text-xs font-bold text-brand-primary">{copy.nicknameLabel}
          <input type="text" value={draft} maxLength={64} autoComplete="off" spellCheck={false}
            onChange={event => { setDraft(event.target.value); setError(null); setStatus(null); }}
            placeholder={copy.nicknamePlaceholder}
            className="mt-1 min-h-11 w-full rounded-lg border border-brand-secondary/30 bg-white px-3 py-2 text-base text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary" />
        </label>
        <button type="submit" className="min-h-11 rounded-full bg-brand-primary px-4 py-2 text-sm font-bold text-white">{copy.saveNickname}</button>
        {nickname ? <button type="button" onClick={remove}
          className="min-h-11 rounded-full border-2 border-brand-secondary bg-white px-4 py-2 text-sm font-bold text-brand-secondary">{copy.removeNickname}</button> : null}
      </form>
      {error ? <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}
      {status ? <p role="status" className="mt-2 text-xs font-semibold text-green-800">{status}</p> : null}
      </div>
    </details>
  );
}
