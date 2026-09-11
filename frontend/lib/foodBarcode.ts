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

type Reader = { decode: (video: HTMLVideoElement) => string | null; dispose?: () => void };
type NativeReader = { detect: (video: HTMLVideoElement) => Promise<{ rawValue: string; format: string }[]> };
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
  let canvas: HTMLCanvasElement | undefined, frames = 0;
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
      const width = video.videoWidth, height = video.videoHeight;
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
      // Periodically retain a wider search for a code just outside the guide.
      return code ?? (++frames % 4 === 0 ? attempt(() => wideReader.decode(video).getText()) : null);
    },
    dispose() { closed = true; native = null; detected = null; if (canvas) { canvas.width = 0; canvas.height = 0; } canvas = undefined; },
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
  onReady: () => void, dependencies: CameraDependencies = cameraDependencies,
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
    void focusBarcodeCamera(stream);
    video.muted = true; video.defaultMuted = true; video.playsInline = true;
    video.srcObject = stream;
    try { await video.play(); }
    catch (cause) {
      // Playback can also throw NotAllowedError after capture was granted.
      // Do not present that as a refusal of camera access.
      throw Object.assign(new Error("The camera preview could not play."), { name: "CameraPlaybackError", cause });
    }
    if (stopped) { stop(); return; }
    onReady();
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
