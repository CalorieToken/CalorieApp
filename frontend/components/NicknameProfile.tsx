"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { backendRequest } from "@/lib/backendRequest";
import { localeDirection } from "@/lib/locales";
import translations from "@/config/account-profile-copy.json";

export function validNickname(value: string): string | null {
  const normalized = value.normalize("NFC").trim();
  const characters = Array.from(normalized);
  if (characters.length < 2 || characters.length > 32 || /[\u0000-\u001F\u007F-\u009F<>\u202A-\u202E\u2066-\u2069]/u.test(value)) return null;
  return normalized;
}

type Props = {
  userId: string;
  nickname: string | null;
  onSaved: (nickname: string | null, userId: string) => void;
  onAuthenticationLost: () => void;
};

export function NicknameProfile({ userId, nickname, onSaved, onAuthenticationLost }: Props) {
  const display = useDisplayLanguage();
  const locale = display.enabled && display.locale in translations ? display.locale : "en";
  const copy = translations[locale as keyof typeof translations];
  const [draft, setDraft] = useState(nickname ?? "");
  const [status, setStatus] = useState<"saved" | "removed" | null>(null);
  const [error, setError] = useState<"invalid" | "save" | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => { setDraft(nickname ?? ""); }, [nickname]);
  useEffect(() => () => { pending.current?.abort(); }, [userId]);

  async function persist(next: string | null) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError(null); setStatus(null);
    try {
      const response = await backendRequest("/api/backend/api/identity/profile", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", "X-CalorieApp-Request": "account-profile" },
        body: JSON.stringify({ user_id: userId, nickname: next }),
      });
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 409) { onAuthenticationLost(); return; }
      if (!response.ok) throw new Error("Profile save failed");
      const saved: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!saved || typeof saved !== "object" || !("user_id" in saved) || saved.user_id !== userId || !("nickname" in saved) || saved.nickname !== next) throw new Error("Unexpected profile response");
      onSaved(next, userId);
      setDraft(next ?? ""); setStatus(next === null ? "removed" : "saved");
    } catch {
      if (!controller.signal.aborted) setError("save");
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validNickname(draft);
    if (!next) { setError("invalid"); setStatus(null); return; }
    void persist(next);
  }

  return <section lang={locale} dir={localeDirection(locale)} aria-labelledby="nickname-profile-title" className="rounded-2xl border border-brand-secondary/20 bg-white p-4">
    <h3 id="nickname-profile-title" className="text-base font-bold text-brand-primary">{copy.profile}</h3>
    <p className="mt-2 text-xs leading-relaxed text-brand-secondary">{copy.description}</p>
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={save}>
      <label className="min-w-0 flex-1 basis-full text-sm font-bold text-brand-primary">{copy.nicknameLabel}
        <input type="text" value={draft} maxLength={64} autoComplete="nickname" spellCheck={false} disabled={busy}
          onChange={event => { setDraft(event.target.value); setError(null); setStatus(null); }} placeholder={copy.nicknamePlaceholder}
          className="mt-1 min-h-11 w-full rounded-lg border border-brand-secondary/30 bg-white px-3 py-2 text-base text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary" />
      </label>
      <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? copy.saving : copy.saveNickname}</button>
      {nickname ? <button type="button" disabled={busy} onClick={() => void persist(null)} className="min-h-11 rounded-full border-2 border-brand-secondary bg-white px-4 py-2 text-sm font-bold text-brand-secondary disabled:opacity-60">{copy.removeNickname}</button> : null}
    </form>
    {error ? <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error === "invalid" ? copy.nicknameInvalid : copy.saveError}</p> : null}
    {status ? <p role="status" className="mt-2 text-xs font-semibold text-green-800">{status === "saved" ? copy.saved : copy.removed}</p> : null}
  </section>;
}
