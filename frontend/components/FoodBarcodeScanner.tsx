"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import translations from "@/config/barcode-copy.json";
import { BarcodeCameraControls, cameraBlockedByPolicy, readFoodBarcodePhoto, startBarcodeCamera, validFoodBarcode } from "@/lib/foodBarcode";

type Status = "opening" | "scanning" | "denied" | "policyBlocked" | "unavailable" | "invalid" | "found" | "paused" | "cameraError" | "photoReading" | "photoNotFound" | "photoError";

export function FoodBarcodeScanner({ locale, disabled, onLookup }: {
  locale: string; disabled: boolean; onLookup: (code: string) => void;
}) {
  const copy = translations[locale as keyof typeof translations] ?? translations.en;
  const [barcode, setBarcode] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [active, setActive] = useState(false);
  const [controls, setControls] = useState<BarcodeCameraControls>({});
  const [zoom, setZoom] = useState(1);
  const [torch, setTorch] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [controlError, setControlError] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const camera = useRef<AbortController | null>(null);
  const photo = useRef<AbortController | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = useCallback((next: Status = "paused") => {
    camera.current?.abort(); camera.current = null;
    photo.current?.abort(); photo.current = null;
    if (deadline.current !== null) clearTimeout(deadline.current);
    deadline.current = null;
    setActive(false); setStatus(next); setControls({}); setAdjusting(false); setControlError(false);
  }, []);

  useEffect(() => {
    const hide = () => { if (camera.current || photo.current) stop(); };
    const visibility = () => { if (document.hidden) hide(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("keydown", escape);
    return () => {
      camera.current?.abort(); camera.current = null;
      photo.current?.abort(); photo.current = null;
      if (deadline.current !== null) clearTimeout(deadline.current);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("keydown", escape);
    };
  }, [stop]);
  useEffect(() => { if (disabled && (camera.current || photo.current)) stop(); }, [disabled, stop]);

  async function scan() {
    if (disabled || camera.current || !video.current) return;
    if (photo.current) stop();
    if (cameraBlockedByPolicy(document)) { setStatus("policyBlocked"); return; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setStatus("unavailable"); return; }
    const controller = new AbortController(); camera.current = controller;
    setActive(true); setStatus("opening");
    deadline.current = setTimeout(() => { if (camera.current === controller) stop(); }, 60_000);
    try {
      await startBarcodeCamera(video.current, controller.signal, code => {
        if (camera.current !== controller) return;
        setBarcode(code); stop("found"); onLookup(code);
      }, (available = {}) => {
        if (camera.current !== controller) return;
        setControls(available); setZoom(available.zoom?.value ?? 1); setTorch(available.torch?.value ?? false);
        setStatus("scanning");
      });
    } catch (error) {
      if (camera.current !== controller) return;
      const name = error && typeof error === "object" && "name" in error ? error.name : "";
      stop(cameraBlockedByPolicy(document) ? "policyBlocked"
        : name === "NotAllowedError" || name === "SecurityError" ? "denied" : "cameraError");
    }
  }

  async function adjust(kind: "zoom" | "torch", value: number | boolean) {
    const controller = camera.current;
    if (!controller || adjusting) return;
    setAdjusting(true); setControlError(false);
    const actual = kind === "zoom" ? await controls.zoom?.set(Number(value)) : await controls.torch?.set(Boolean(value));
    if (camera.current !== controller) return;
    if (typeof actual === "number") setZoom(actual);
    else if (typeof actual === "boolean") setTorch(actual);
    else setControlError(true);
    setAdjusting(false);
  }

  async function refocus() {
    const controller = camera.current;
    if (!controller || adjusting || !controls.refocus) return;
    setAdjusting(true); setControlError(false);
    const applied = await controls.refocus();
    if (camera.current !== controller) return;
    setControlError(!applied); setAdjusting(false);
  }

  async function scanPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || disabled) return;
    stop();
    const controller = new AbortController(); photo.current = controller;
    setStatus("photoReading");
    try {
      const code = await readFoodBarcodePhoto(file, controller.signal);
      if (photo.current !== controller) return;
      photo.current = null;
      if (code) { setBarcode(code); setStatus("found"); onLookup(code); }
      else setStatus("photoNotFound");
    } catch {
      if (photo.current !== controller) return;
      photo.current = null; setStatus("photoError");
    }
  }

  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || active || photo.current) return;
    const code = validFoodBarcode(barcode);
    if (!code) { setStatus("invalid"); return; }
    stop("found"); setBarcode(code); onLookup(code);
  }

  const zoomOptions = controls.zoom ? Array.from(new Set([controls.zoom.min, zoom, 1, 1.5, 2, 3, 4, controls.zoom.max]
    .filter(value => value >= controls.zoom!.min && value <= controls.zoom!.max))).sort((a, b) => a - b) : [];
  const readingPhoto = status === "photoReading";

  return (
    <details className="mt-4 min-w-0 rounded-xl border border-brand-secondary/20 bg-brand-bg"
      onToggle={event => { if (!event.currentTarget.open && (camera.current || photo.current)) stop(); }}>
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-secondary focus-visible:ring-2 focus-visible:ring-brand-primary">{copy.title}</summary>
      <div className="space-y-3 px-4 pb-4 text-sm text-brand-secondary">
        <p>{copy.intro}</p>
        <button type="button" onClick={active ? () => stop() : scan} disabled={disabled && !active}
          className="min-h-11 rounded-full bg-brand-primary px-5 py-2 font-semibold text-white disabled:opacity-60">
          {active ? copy.stop : copy.scan}
        </button>
        <div hidden={!active} className="relative overflow-hidden rounded-xl bg-black">
          <video ref={video} muted playsInline aria-label={copy.title} className="aspect-[4/3] w-full object-cover sm:aspect-video" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[10%] inset-y-[28%] rounded-lg border-2 border-white shadow-[0_0_0_100px_#0005]" />
        </div>
        {active && (controls.zoom || controls.torch || controls.refocus) ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {controls.zoom ? <label className="flex min-h-11 items-center gap-2">
            <span>{copy.zoom}</span>
            <select value={zoom}
              disabled={adjusting} onChange={event => { void adjust("zoom", Number(event.target.value)); }}
              className="min-h-11 rounded-lg border border-brand-secondary/30 bg-white px-3 text-base">
              {zoomOptions.map(value => <option key={value} value={value}>{value}×</option>)}
            </select>
          </label> : null}
          {controls.torch ? <button type="button" aria-pressed={torch} disabled={adjusting}
            onClick={() => { void adjust("torch", !torch); }}
            className="min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 font-semibold disabled:opacity-60">{copy.light}</button> : null}
          {controls.refocus ? <button type="button" disabled={adjusting} onClick={() => { void refocus(); }}
            className="min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 font-semibold disabled:opacity-60">{copy.refocus}</button> : null}
        </div> : null}
        {active && controls.zoom ? <p className="text-xs leading-relaxed">{copy.zoomHelp}</p> : null}
        {active && controlError ? <p role="status" className="text-xs leading-relaxed">{copy.controlError}</p> : null}
        {status ? <p id="food-barcode-status" role="status" aria-live="polite">{copy[status]}</p> : null}
        {status === "denied" ? <p className="text-xs leading-relaxed">{copy.permissionHelp}</p> : null}
        <div className="space-y-1">
          <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-brand-secondary px-4 py-2 font-semibold focus-within:ring-2 focus-within:ring-brand-primary ${disabled || readingPhoto ? "opacity-60" : ""}`}>
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled || readingPhoto}
              onClick={() => stop()} onChange={event => { void scanPhoto(event); }} />
            {copy.photo}
          </label>
          <p className="text-xs leading-relaxed">{copy.photoHelp}</p>
        </div>
        <form onSubmit={lookup} className="space-y-2">
          <label htmlFor="food-barcode" className="block font-semibold">{copy.manual}</label>
          <div className="flex flex-wrap gap-2">
            <input id="food-barcode" type="text" inputMode="numeric" autoComplete="off" maxLength={14} dir="ltr"
              value={barcode} disabled={active || readingPhoto} onChange={event => { setBarcode(event.target.value); if (status === "invalid") setStatus(null); }}
              aria-invalid={status === "invalid"} aria-describedby={status ? "food-barcode-status" : undefined}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-brand-secondary/30 bg-white px-3 text-base focus-visible:ring-2 focus-visible:ring-brand-primary" />
            <button type="submit" disabled={disabled || active || readingPhoto}
              className="min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 font-semibold disabled:opacity-60">{copy.lookup}</button>
          </div>
        </form>
        <p className="text-xs leading-relaxed">{copy.privacy}</p>
      </div>
    </details>
  );
}
