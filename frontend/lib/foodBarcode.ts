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

type Reader = { decode: (video: HTMLVideoElement) => string | null };
type CameraDependencies = {
  openStream: () => Promise<MediaStream>;
  createReader: () => Promise<Reader>;
};
const cameraDependencies: CameraDependencies = {
  openStream: () => navigator.mediaDevices.getUserMedia({
    audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
  }),
  async createReader() {
    // Bundled by Next; no CDN, remote decoding or camera image upload.
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType, NotFoundException, ChecksumException, FormatException }] = await Promise.all([
      import("@zxing/browser"), import("@zxing/library"),
    ]);
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.ITF]);
    const reader = new BrowserMultiFormatReader(hints);
    return { decode(video) {
      try { return reader.decode(video).getText(); }
      catch (error) {
        if (error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException) return null;
        throw error;
      }
    } };
  },
};

/** Own and release this session's tracks, including a permission grant after cancellation. */
export async function startBarcodeCamera(
  video: HTMLVideoElement, signal: AbortSignal, onCode: (code: string) => void,
  onReady: () => void, dependencies: CameraDependencies = cameraDependencies,
): Promise<void> {
  let stream: MediaStream | undefined, stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined, finish: (() => void) | undefined;
  function stop() {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    stream?.getTracks().forEach(track => track.stop());
    if (stream && video.srcObject === stream) { video.pause(); video.srcObject = null; }
    signal.removeEventListener("abort", stop);
    finish?.();
  }
  if (signal.aborted) return;
  signal.addEventListener("abort", stop, { once: true });
  try {
    const reader = await dependencies.createReader();
    if (stopped) return;
    stream = await dependencies.openStream();
    if (stopped) { stop(); return; }
    video.srcObject = stream;
    await video.play();
    if (stopped) { stop(); return; }
    onReady();
    await new Promise<void>((resolve, reject) => {
      finish = resolve;
      const tick = () => {
        if (stopped) { resolve(); return; }
        try {
          const raw = video.readyState >= 2 ? reader.decode(video) : null;
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
