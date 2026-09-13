/** Preserve leading zeros; accept checked GTIN-8/12/13/14 food identifiers only. */
export function validFoodBarcode(value: string): string | null {
  const code = value.trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code) || /^0+$/.test(code)) return null;
  let total = 0;
  for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) {
    total += Number(code[i]) * weight;
  }
  return (10 - total % 10) % 10 === Number(code.at(-1)) ? code : null;
}

/** Read the browser's policy without requesting or changing any permission. */
export function cameraBlockedByPolicy(page: Document): boolean {
  type Policy = { allowsFeature: (feature: string) => boolean };
  const policyPage = page as Document & { permissionsPolicy?: Policy; featurePolicy?: Policy };
  try {
    const policy = policyPage.permissionsPolicy ?? policyPage.featurePolicy;
    return policy?.allowsFeature("camera") === false;
  } catch {
    // Unsupported introspection is inconclusive; let the normal camera request decide.
    return false;
  }
}

type BarcodeFrame = HTMLVideoElement | HTMLCanvasElement;
type Reader = { decode: (frame: BarcodeFrame) => string | null; dispose?: () => void };
type NativeReader = { detect: (frame: BarcodeFrame) => Promise<{ rawValue: string; format: string }[]> };
type NativeReaderConstructor = {
  new(options: { formats: string[] }): NativeReader;
  getSupportedFormats: () => Promise<string[]>;
};

/** Use the phone's detector when available, with a bundled, independent fallback. */
export async function createFoodBarcodeReader(): Promise<Reader> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType, NotFoundException, ChecksumException, FormatException }] = await Promise.all([
    import("@zxing/browser"), import("@zxing/library"),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.ITF]);
  const wideReader = new BrowserMultiFormatReader(hints);
  const focusedReader = new BrowserMultiFormatReader(new Map([...hints, [DecodeHintType.TRY_HARDER, true]]));
  let native: NativeReader | null = null, busy = false, closed = false, detected: string | null = null;
  let canvas: HTMLCanvasElement | undefined, rotated: HTMLCanvasElement | undefined, frames = 0;
  const angles = [12, -12, 90];
  const formats = ["ean_13", "ean_8", "upc_a", "itf"];
  const Native = typeof window === "undefined" ? undefined
    : (window as Window & { BarcodeDetector?: NativeReaderConstructor }).BarcodeDetector;
  // Capability discovery must never delay opening the camera or the fallback.
  if (Native) void Promise.resolve().then(() => Native.getSupportedFormats()).then(supported => {
    const available = formats.filter(format => supported.includes(format));
    if (!closed && available.length) native = new Native({ formats: available });
  }).catch(() => { /* Optional browser API; ZXing remains available. */ });

  function attempt(decode: () => string): string | null {
    try { return validFoodBarcode(decode()); }
    catch (error) {
      if (error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException) return null;
      throw error;
    }
  }
  return {
    decode(video) {
      if (closed) return null;
      if (detected) return detected;
      if (native && !busy) {
        busy = true;
        // At most one native request. A slow or broken detector cannot block ZXing.
        const detector = native;
        void Promise.resolve().then(() => closed ? [] : detector.detect(video)).then(results => {
          if (!closed) detected = results.filter(result => formats.includes(result.format))
            .map(result => validFoodBarcode(result.rawValue)).find(code => code !== null) ?? null;
        }).catch(() => { native = null; }).finally(() => { busy = false; });
      }
      const width = "videoWidth" in video ? video.videoWidth : video.width;
      const height = "videoHeight" in video ? video.videoHeight : video.height;
      if (!width || !height) return null;
      canvas ??= document.createElement("canvas");
      // Map the visible object-cover preview to source pixels, including portrait video.
      // Keep a margin around the guide so barcode quiet zones are not cut off.
      const scale = Math.max((video.clientWidth || width) / width, (video.clientHeight || height) / height);
      const visibleWidth = (video.clientWidth || width) / scale;
      const visibleHeight = (video.clientHeight || height) / scale;
      const sw = visibleWidth * 0.9, sh = visibleHeight * 0.6;
      const sx = (width - sw) / 2, sy = (height - sh) / 2;
      canvas.width = Math.max(1, Math.round(sw)); canvas.height = Math.max(1, Math.round(sh));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Camera frame could not be read.");
      context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const code = attempt(() => focusedReader.decodeFromCanvas(canvas!).getText());
      if (code || ++frames % 4 !== 0) return code;
      // Retain the full-frame search, then occasionally straighten a tilted or
      // vertical label. TRY_HARDER alone cannot rotate browser canvas pixels.
      const wide = attempt(() => ("videoWidth" in video ? wideReader.decode(video)
        : focusedReader.decodeFromCanvas(video)).getText());
      if (wide) return wide;
      const angle = angles[(frames / 4 - 1) % angles.length] * Math.PI / 180;
      rotated ??= document.createElement("canvas");
      rotated.width = Math.ceil(Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle)));
      rotated.height = Math.ceil(Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle)));
      const rotation = rotated.getContext("2d", { willReadFrequently: true });
      if (!rotation) return null;
      rotation.fillStyle = "white"; rotation.fillRect(0, 0, rotated.width, rotated.height);
      rotation.translate(rotated.width / 2, rotated.height / 2); rotation.rotate(angle);
      rotation.drawImage(video, -width / 2, -height / 2, width, height);
      return attempt(() => focusedReader.decodeFromCanvas(rotated!).getText());
    },
    dispose() {
      closed = true; native = null; detected = null;
      for (const buffer of [canvas, rotated]) if (buffer) { buffer.width = 0; buffer.height = 0; }
      canvas = rotated = undefined;
    },
  };
}

/** Focus is optional: unsupported/rejected camera tuning must not break a preview. */
export async function focusBarcodeCamera(stream: MediaStream): Promise<void> {
  try {
    const track = stream.getVideoTracks?.()[0];
    const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { focusMode?: string[] }) | undefined;
    if (capabilities?.focusMode?.includes("continuous")) {
      await track!.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
    }
  } catch { /* Keep the working camera and its existing focus mode. */ }
}

export type BarcodeCameraControls = {
  zoom?: { min: number; max: number; step: number; value: number; set: (value: number) => Promise<number | null> };
  torch?: { value: boolean; set: (value: boolean) => Promise<boolean | null> };
  refocus?: () => Promise<boolean>;
};

/** Expose only controls already available on the granted track; never ask for extra access. */
export function barcodeCameraControls(stream: MediaStream, isActive: () => boolean): BarcodeCameraControls {
  const controls: BarcodeCameraControls = {};
  try {
    const track = stream.getVideoTracks?.()[0];
    if (!track?.getCapabilities || !track.getSettings || !track.applyConstraints) return controls;
    type Settings = MediaTrackSettings & { zoom?: number; torch?: boolean; focusMode?: string };
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
      zoom?: { min?: number; max?: number; step?: number }; torch?: boolean; focusMode?: string[];
    };
    const settings = track.getSettings() as Settings;
    let changing = false;
    const usable = () => isActive() && track.readyState !== "ended";
    async function apply(value: { zoom: number } | { torch: boolean } | { focusMode: string }): Promise<Settings | null> {
      if (changing || !usable()) return null;
      changing = true;
      try {
        await track.applyConstraints({ advanced: [value as MediaTrackConstraintSet] });
        return usable() ? track.getSettings() as Settings : null;
      } catch { return null; }
      finally { changing = false; }
    }
    const range = capabilities.zoom;
    if (range && Number.isFinite(range.min) && Number.isFinite(range.max) && Number.isFinite(settings.zoom)) {
      const min = range.min!, max = Math.min(range.max!, Math.max(4, settings.zoom!));
      const step = Number.isFinite(range.step) && range.step! > 0 ? range.step! : 0.1;
      if (min < max) controls.zoom = { min, max, step, value: settings.zoom!, async set(value) {
        if (!Number.isFinite(value)) return null;
        const zoom = Math.max(min, Math.min(max, min + Math.round((value - min) / step) * step));
        const actual = (await apply({ zoom }))?.zoom;
        return Number.isFinite(actual) ? actual! : null;
      } };
    }
    if (capabilities.torch === true && typeof settings.torch === "boolean") {
      controls.torch = { value: settings.torch, async set(torch) {
        const actual = (await apply({ torch }))?.torch;
        return typeof actual === "boolean" ? actual : null;
      } };
    }
    // A single sweep is a real autofocus request; reapplying an unchanged
    // continuous setting does not reliably retrigger focus on a phone.
    if (capabilities.focusMode?.includes("single-shot")) {
      controls.refocus = async () => (await apply({ focusMode: "single-shot" }))?.focusMode === "single-shot";
    }
  } catch { /* Capability access is optional; scanning remains available. */ }
  return controls;
}

/** Start farther from a small label so the rear lens has room to focus. */
export async function prepareBarcodeCamera(stream: MediaStream, isActive: () => boolean): Promise<BarcodeCameraControls> {
  const controls = barcodeCameraControls(stream, isActive);
  if (isActive() && controls.zoom && controls.zoom.value < 2 && controls.zoom.min <= 2 && controls.zoom.max >= 2) {
    const actual = await controls.zoom.set(2);
    if (actual !== null) controls.zoom.value = actual;
  }
  if (isActive()) await focusBarcodeCamera(stream);
  return controls;
}

/** Decode a user-selected camera photo locally, with bounded working canvases. */
export async function readFoodBarcodePhoto(file: Blob, signal: AbortSignal): Promise<string | null> {
  if (signal.aborted) return null;
  if (!file.size || file.size > 25 * 1024 * 1024 || (file.type && !file.type.startsWith("image/"))) {
    throw new Error("Choose an image up to 25 MB.");
  }
  let bitmap: ImageBitmap | undefined, canvas: HTMLCanvasElement | undefined, reader: Reader | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (signal.aborted) return null;
    if (!bitmap.width || !bitmap.height) throw new Error("Empty image.");
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Photo could not be read.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close(); bitmap = undefined;
    reader = await createFoodBarcodeReader();
    // All existing full-frame/rotation passes also run on the still image.
    // Yield between attempts so cancellation and the native detector can finish.
    for (let pass = 0; pass < 13 && !signal.aborted; pass++) {
      const code = reader.decode(canvas);
      if (code) return signal.aborted ? null : validFoodBarcode(code);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    return null;
  } finally {
    bitmap?.close(); reader?.dispose?.();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

type CameraDependencies = {
  openStream: () => Promise<MediaStream>;
  createReader: () => Promise<Reader>;
};
const cameraDependencies: CameraDependencies = {
  openStream: () => navigator.mediaDevices.getUserMedia({
    audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  }),
  createReader: createFoodBarcodeReader,
};

/** Own and release this session's tracks, including a permission grant after cancellation. */
export async function startBarcodeCamera(
  video: HTMLVideoElement, signal: AbortSignal, onCode: (code: string) => void,
  onReady: (controls: BarcodeCameraControls) => void, dependencies: CameraDependencies = cameraDependencies,
): Promise<void> {
  let stream: MediaStream | undefined, reader: Reader | undefined, stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined, finish: (() => void) | undefined;
  function stop() {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    reader?.dispose?.();
    stream?.getTracks().forEach(track => track.stop());
    if (stream && video.srcObject === stream) { video.pause(); video.srcObject = null; }
    signal.removeEventListener("abort", stop);
    finish?.();
  }
  if (signal.aborted) return;
  signal.addEventListener("abort", stop, { once: true });
  try {
    reader = await dependencies.createReader();
    if (stopped) { reader.dispose?.(); return; }
    stream = await dependencies.openStream();
    if (stopped) { stop(); return; }
    video.muted = true; video.defaultMuted = true; video.playsInline = true;
    video.srcObject = stream;
    try { await video.play(); }
    catch (cause) {
      // Playback can also throw NotAllowedError after capture was granted.
      // Do not present that as a refusal of camera access.
      throw Object.assign(new Error("The camera preview could not play."), { name: "CameraPlaybackError", cause });
    }
    if (stopped) { stop(); return; }
    const controls = await prepareBarcodeCamera(stream, () => !stopped && !signal.aborted);
    if (stopped) { stop(); return; }
    onReady(controls);
    await new Promise<void>((resolve, reject) => {
      finish = resolve;
      const tick = () => {
        if (stopped) { resolve(); return; }
        try {
          const raw = video.readyState >= 2 ? reader!.decode(video) : null;
          const code = raw === null ? null : validFoodBarcode(raw);
          if (code) { stop(); onCode(code); return; }
          timer = setTimeout(tick, 250);
        } catch (error) { reject(error); stop(); }
      };
      tick();
    });
  } catch (error) {
    stop();
    if (!signal.aborted) throw error;
  }
}
