"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import translations from "@/config/barcode-copy.json";
import { startBarcodeCamera, validFoodBarcode } from "@/lib/foodBarcode";

type Status = "opening" | "scanning" | "denied" | "unavailable" | "invalid" | "found" | "paused" | "cameraError";

export function FoodBarcodeScanner({ locale, disabled, onLookup }: {
  locale: string; disabled: boolean; onLookup: (code: string) => void;
}) {
  const copy = translations[locale as keyof typeof translations] ?? translations.en;
  const [barcode, setBarcode] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [active, setActive] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const camera = useRef<AbortController | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = useCallback((next: Status = "paused") => {
    camera.current?.abort(); camera.current = null;
    if (deadline.current !== null) clearTimeout(deadline.current);
    deadline.current = null;
    setActive(false); setStatus(next);
  }, []);

  useEffect(() => {
    const hide = () => { if (camera.current) stop(); };
    const visibility = () => { if (document.hidden) hide(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("keydown", escape);
    return () => {
      camera.current?.abort(); camera.current = null;
      if (deadline.current !== null) clearTimeout(deadline.current);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("keydown", escape);
    };
  }, [stop]);
  useEffect(() => { if (disabled && camera.current) stop(); }, [disabled, stop]);

  async function scan() {
    if (disabled || camera.current || !video.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setStatus("unavailable"); return; }
    const controller = new AbortController(); camera.current = controller;
    setActive(true); setStatus("opening");
    deadline.current = setTimeout(() => { if (camera.current === controller) stop(); }, 60_000);
    try {
      await startBarcodeCamera(video.current, controller.signal, code => {
        if (camera.current !== controller) return;
        setBarcode(code); stop("found"); onLookup(code);
      }, () => { if (camera.current === controller) setStatus("scanning"); });
    } catch (error) {
      if (camera.current !== controller) return;
      const name = error && typeof error === "object" && "name" in error ? error.name : "";
      stop(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "cameraError");
    }
  }

  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || active) return;
    const code = validFoodBarcode(barcode);
    if (!code) { setStatus("invalid"); return; }
    stop("found"); setBarcode(code); onLookup(code);
  }

  return (
    <details className="mt-4 min-w-0 rounded-xl border border-brand-secondary/20 bg-brand-bg"
      onToggle={event => { if (!event.currentTarget.open && camera.current) stop(); }}>
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-secondary focus-visible:ring-2 focus-visible:ring-brand-primary">{copy.title}</summary>
      <div className="space-y-3 px-4 pb-4 text-sm text-brand-secondary">
        <p>{copy.intro}</p>
        <button type="button" onClick={active ? () => stop() : scan} disabled={disabled && !active}
          className="min-h-11 rounded-full bg-brand-primary px-5 py-2 font-semibold text-white disabled:opacity-60">
          {active ? copy.stop : copy.scan}
        </button>
        <div hidden={!active} className="relative overflow-hidden rounded-xl bg-black">
          <video ref={video} muted playsInline aria-label={copy.title} className="aspect-video w-full object-cover" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[10%] inset-y-[28%] rounded-lg border-2 border-white shadow-[0_0_0_100px_#0005]" />
        </div>
        {status ? <p id="food-barcode-status" role="status" aria-live="polite">{copy[status]}</p> : null}
        <form onSubmit={lookup} className="space-y-2">
          <label htmlFor="food-barcode" className="block font-semibold">{copy.manual}</label>
          <div className="flex flex-wrap gap-2">
            <input id="food-barcode" type="text" inputMode="numeric" autoComplete="off" maxLength={14} dir="ltr"
              value={barcode} disabled={active} onChange={event => { setBarcode(event.target.value); if (status === "invalid") setStatus(null); }}
              aria-invalid={status === "invalid"} aria-describedby={status ? "food-barcode-status" : undefined}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-brand-secondary/30 bg-white px-3 text-base focus-visible:ring-2 focus-visible:ring-brand-primary" />
            <button type="submit" disabled={disabled || active}
              className="min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 font-semibold disabled:opacity-60">{copy.lookup}</button>
          </div>
        </form>
        <p className="text-xs leading-relaxed">{copy.privacy}</p>
      </div>
    </details>
  );
}
