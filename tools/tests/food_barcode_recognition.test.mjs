import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const ts = require('typescript'), z = require('@zxing/library');
const {BrowserMultiFormatReader} = require('@zxing/browser');
const source = ts.transpileModule(readFileSync(new URL('../../frontend/lib/foodBarcode.ts', import.meta.url), 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
const code = '3017620422003';
const settle = () => new Promise(setImmediate);

// The canvas capture is a pixel-copy double; the bundled luminance, binarizer
// and barcode readers are real. No browser, camera or provider is contacted.
function bitmap(image) {
  return new z.BinaryBitmap(new z.HybridBinarizer(new z.RGBLuminanceSource(image.pixels, image.width, image.height)));
}
class RasterReader extends BrowserMultiFormatReader {
  decode(video) { return this.decodeBitmap(bitmap({...video, width: video.videoWidth ?? video.width, height: video.videoHeight ?? video.height})); }
  decodeFromCanvas(canvas) { return this.decodeBitmap(bitmap(canvas)); }
}
function load(Native, Reader = RasterReader, createImageBitmap) {
  const captures = [], canvases = [], module = {exports: {}};
  const document = {createElement(name) {
    assert.equal(name, 'canvas');
    const canvas = {getContext() {
      let tx = 0, ty = 0, angle = 0;
      canvas.pixels = new Uint8ClampedArray(canvas.width * canvas.height).fill(255);
      return {
        fillRect() {canvas.pixels.fill(255);}, translate(x, y) {tx = x; ty = y;}, rotate(a) {angle = a;},
        drawImage(video, ...args) {
          const width = video.videoWidth ?? video.width, height = video.videoHeight ?? video.height;
          const [sx, sy, sw, sh, dx, dy, dw, dh] = args.length === 8 ? args : [0, 0, width, height, ...args];
          captures.push({sx, sy, sw, sh});
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            const u = (x + .5 - tx) * Math.cos(angle) + (y + .5 - ty) * Math.sin(angle);
            const v = -(x + .5 - tx) * Math.sin(angle) + (y + .5 - ty) * Math.cos(angle);
            if (u < dx || v < dy || u >= dx + dw || v >= dy + dh) continue;
            canvas.pixels[y * canvas.width + x] = video.pixels[Math.floor(sy + (v - dy) * sh / dh) * width + Math.floor(sx + (u - dx) * sw / dw)];
          }
        },
      };
    }};
    canvases.push(canvas); return canvas;
  }};
  vm.runInNewContext(source, {module, exports: module.exports, document, window: {BarcodeDetector: Native}, setTimeout, clearTimeout, createImageBitmap,
    require(name) {return name === '@zxing/browser' ? {BrowserMultiFormatReader: Reader} : require(name);}});
  return {...module.exports, captures, canvases};
}
function frame(width = 1280, height = 720) {
  return {videoWidth: width, videoHeight: height, clientWidth: 400, clientHeight: 225,
    pixels: new Uint8ClampedArray(width * height).fill(255)};
}
function barcode(video, x, y, height = 8) {
  const left = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const invert = bits => bits.replace(/[01]/g, bit => bit === '1' ? '0' : '1');
  const parity = 'LLGGGL'; // EAN-13 leading digit 3.
  const bars = '101' + [...code.slice(1, 7)].map((d, i) => parity[i] === 'L' ? left[d] : invert([...left[d]].reverse().join(''))).join('')
    + '01010' + [...code.slice(7)].map(d => invert(left[d])).join('') + '101';
  for (let row = y; row < y + height; row++) for (let col = 0; col < bars.length * 2; col++) {
    video.pixels[row * video.videoWidth + x + col] = bars[Math.floor(col / 2)] === '1' ? 0 : 255;
  }
  return video;
}

test('A small barcode between the old scan rows is found by the focused decoder', async () => {
  const video = barcode(frame(), 540, 365);
  const old = new RasterReader(new Map([[z.DecodeHintType.POSSIBLE_FORMATS, [z.BarcodeFormat.EAN_13]]]));
  assert.throws(() => old.decode(video), z.NotFoundException);
  const h = load(), reader = await h.createFoodBarcodeReader();
  assert.equal(reader.decode(video), code);
  reader.dispose();
  assert.equal(reader.decode(video), null);
  assert.equal(h.canvases[0].width, 0);
});

test('The scan region follows the visible guide in a portrait camera stream', async () => {
  const h = load(), reader = await h.createFoodBarcodeReader();
  assert.equal(reader.decode(barcode(frame(720, 1280), 260, 645)), code);
  assert.deepEqual(h.captures[0], {sx: 36, sy: 518.5, sw: 648, sh: 243});
  reader.dispose();
});

test('Tilted and vertical labels are read from real pixels after the straight scan misses them', async () => {
  for (const degrees of [-12, 12, 90]) {
    const original = barcode(frame(640, 480), 220, 235, 10), video = frame(640, 480), angle = degrees * Math.PI / 180;
    for (let y = 0; y < 480; y++) for (let x = 0; x < 640; x++) {
      const sx = Math.floor((x - 320) * Math.cos(angle) + (y - 240) * Math.sin(angle) + 320);
      const sy = Math.floor(-(x - 320) * Math.sin(angle) + (y - 240) * Math.cos(angle) + 240);
      if (sx >= 0 && sx < 640 && sy >= 0 && sy < 480) video.pixels[y * 640 + x] = original.pixels[sy * 640 + sx];
    }
    const straight = new RasterReader(new Map([[z.DecodeHintType.POSSIBLE_FORMATS, [z.BarcodeFormat.EAN_13]], [z.DecodeHintType.TRY_HARDER, true]]));
    assert.throws(() => straight.decode(video), z.NotFoundException, `Straight scan: ${degrees}`);
    const h = load(), reader = await h.createFoodBarcodeReader(); let found = null;
    for (let i = 0; i < 12 && !found; i++) found = reader.decode(video);
    assert.equal(found, code, `Rotated scan: ${degrees}`);
    reader.dispose(); assert.ok(h.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
  }
});

test('Zoom and light use only granted capabilities and report actual settings', async () => {
  const {barcodeCameraControls} = load(); let active = true, calls = 0, settings = {zoom: 1, torch: false};
  const track = {readyState: 'live', getCapabilities: () => ({zoom: {min: 1, max: 8, step: .5}, torch: true}),
    getSettings: () => settings, async applyConstraints({advanced: [change]}) {calls++; settings = {...settings, ...change};}};
  const controls = barcodeCameraControls({getVideoTracks: () => [track]}, () => active);
  assert.equal(controls.zoom.max, 4);
  assert.equal(await controls.zoom.set(2.2), 2); assert.equal(await controls.zoom.set(99), 4);
  assert.equal(await controls.torch.set(true), true);
  assert.equal(await controls.zoom.set(NaN), null); assert.equal(calls, 3);
  active = false;
  assert.equal(await controls.zoom.set(1), null); assert.equal(await controls.torch.set(false), null); assert.equal(calls, 3);
  assert.deepEqual(Object.keys(barcodeCameraControls({getVideoTracks: () => []}, () => true)), []);
  assert.deepEqual(Object.keys(barcodeCameraControls({getVideoTracks: () => [{...track, getCapabilities: () => ({zoom: {}})}]}, () => true)), []);
});

test('Rejected, overlapping and late camera adjustments do not interrupt scanning or revive a stopped session', async () => {
  const {barcodeCameraControls} = load(); let active = true, release, calls = 0;
  const track = {readyState: 'live', getCapabilities: () => ({zoom: {min: 1, max: 3}, torch: true}),
    getSettings: () => ({zoom: 1, torch: false}), applyConstraints() {calls++; return new Promise(resolve => {release = resolve;});}};
  const controls = barcodeCameraControls({getVideoTracks: () => [track]}, () => active);
  const pending = controls.zoom.set(2);
  assert.equal(await controls.torch.set(true), null); assert.equal(calls, 1);
  active = false; release(); assert.equal(await pending, null);
  active = true; track.applyConstraints = async () => {throw Error('Unsupported setting');};
  assert.equal(await controls.zoom.set(2), null);
  track.applyConstraints = async () => {};
  assert.equal(await controls.zoom.set(2), 1, 'Ignored advanced constraints must not display the requested zoom as applied');
});

class EmptyReader { decode() {throw new z.NotFoundException();} decodeFromCanvas() {throw new z.NotFoundException();} }
test('An unsupported native API leaves the bundled decoder available', async () => {
  for (const Native of [undefined, class {static getSupportedFormats() {return Promise.reject(new Error('unsupported'));}},
    class {static async getSupportedFormats() {return ['qr_code'];} constructor() {assert.fail('Do not enable QR');}}]) {
    const h = load(Native), reader = await h.createFoodBarcodeReader(); await settle();
    assert.equal(reader.decode(barcode(frame(), 540, 365)), code); reader.dispose();
  }
});

test('A slow native detection never blocks fallback or creates overlapping requests', async () => {
  let resolve, calls = 0;
  class Native {
    static async getSupportedFormats() {return ['ean_13', 'qr_code'];}
    constructor(options) {assert.deepEqual([...options.formats], ['ean_13']);}
    detect() {calls++; return new Promise(r => {resolve = r;});}
  }
  const h = load(Native), reader = await h.createFoodBarcodeReader(); await settle();
  const video = barcode(frame(), 540, 365);
  assert.equal(reader.decode(video), code); await settle();
  assert.equal(reader.decode(video), code); await settle(); assert.equal(calls, 1);
  reader.dispose(); resolve([{format: 'ean_13', rawValue: code}]); await settle();
  assert.equal(reader.decode(video), null);
});

test('Native detections must be supported food formats with valid checksums', async () => {
  let results = [{format: 'qr_code', rawValue: code}, {format: 'ean_13', rawValue: '3017620422004'}];
  class Native {static async getSupportedFormats() {return ['ean_13'];} async detect() {return results;}}
  const h = load(Native, EmptyReader), reader = await h.createFoodBarcodeReader(), video = frame(320, 180);
  await settle(); assert.equal(reader.decode(video), null); await settle(); assert.equal(reader.decode(video), null); await settle();
  results = [{format: 'ean_13', rawValue: '0034000470693'}];
  assert.equal(reader.decode(video), null); await settle();
  assert.equal(reader.decode(video), '0034000470693'); reader.dispose();
});

test('Native detection rejection falls back without stopping the working camera', async () => {
  let calls = 0;
  class Native {static async getSupportedFormats() {return ['ean_13'];} async detect() {calls++; throw new Error('device API failed');}}
  const h = load(Native), reader = await h.createFoodBarcodeReader(), video = barcode(frame(), 540, 365);
  await settle(); assert.equal(reader.decode(video), code); await settle();
  assert.equal(reader.decode(video), code); await settle(); assert.equal(calls, 1); reader.dispose();
});

test('Stopping during native capability discovery prevents a late detector from starting', async () => {
  let resolve;
  class Native {static getSupportedFormats() {return new Promise(r => {resolve = r;});} constructor() {assert.fail('Cancelled');}}
  const h = load(Native), reader = await h.createFoodBarcodeReader(); await settle();
  reader.dispose(); resolve(['ean_13']); await settle(); assert.equal(reader.decode(frame()), null);
});

test('Continuous focus is requested only if supported; a rejection is harmless', async () => {
  const {focusBarcodeCamera} = load(); let attempts = 0;
  await focusBarcodeCamera({getVideoTracks: () => []});
  await focusBarcodeCamera({getVideoTracks: () => [{getCapabilities: () => ({focusMode: ['manual']}), applyConstraints() {assert.fail();}}]});
  const track = {getCapabilities: () => ({focusMode: ['continuous']}), async applyConstraints(options) {
    attempts++; assert.equal(options.advanced[0].focusMode, 'continuous'); throw Error('Camera does not accept tuning');
  }};
  await focusBarcodeCamera({getVideoTracks: () => [track]}); assert.equal(attempts, 1);
});

test('Camera preparation uses real zoom settings before autofocus; ignored zoom and cancellation stay safe', async () => {
  const {prepareBarcodeCamera} = load(); let active = true, changes = [], settings = {zoom: 1};
  const track = {readyState: 'live', getCapabilities: () => ({zoom: {min: 1, max: 4, step: .1}, focusMode: ['continuous']}),
    getSettings: () => settings, async applyConstraints({advanced: [change]}) {changes.push(change); settings = {...settings, ...change};}};
  const stream = {getVideoTracks: () => [track]};
  assert.equal((await prepareBarcodeCamera(stream, () => active)).zoom.value, 2);
  assert.deepEqual(changes.map(x => Object.keys(x)[0]), ['zoom', 'focusMode']);
  settings = {zoom: 1}; changes = [];
  track.applyConstraints = async () => {};
  assert.equal((await prepareBarcodeCamera(stream, () => active)).zoom.value, 1);
  track.applyConstraints = async () => {active = false;};
  await prepareBarcodeCamera(stream, () => active);
  assert.deepEqual(changes, []);
});

test('Refocus is offered only for a supported autofocus sweep and never revives a stopped camera', async () => {
  const {barcodeCameraControls} = load(); let active = true, mode = 'continuous', calls = 0;
  const track = {readyState: 'live', getCapabilities: () => ({focusMode: ['continuous', 'single-shot']}),
    getSettings: () => ({focusMode: mode}), async applyConstraints({advanced: [change]}) {calls++; mode = change.focusMode;}};
  const controls = barcodeCameraControls({getVideoTracks: () => [track]}, () => active);
  assert.equal(await controls.refocus(), true); assert.equal(mode, 'single-shot');
  active = false; assert.equal(await controls.refocus(), false); assert.equal(calls, 1);
  track.getCapabilities = () => ({focusMode: ['continuous']});
  assert.equal(barcodeCameraControls({getVideoTracks: () => [track]}, () => true).refocus, undefined);
});

test('A full-resolution photo is read locally with the real decoder and its pixel buffers are released', async () => {
  let closed = 0;
  const raw = barcode(frame(1280, 960), 530, 830, 70);
  const h = load(undefined, RasterReader, async (file, options) => {
    assert.equal(file.type, 'image/jpeg'); assert.equal(options.imageOrientation, 'from-image');
    return {width: 1280, height: 960, pixels: raw.pixels, close() {closed++;}};
  });
  const found = await h.readFoodBarcodePhoto({type: 'image/jpeg', size: 1000}, new AbortController().signal);
  assert.equal(found, code); assert.equal(closed, 1);
  assert.ok(h.canvases.every(c => c.width === 0 && c.height === 0));
});

test('Photo size limits and late cancellation cannot publish a result or retain a bitmap', async () => {
  let opened = 0, closed = 0, release;
  const h = load(undefined, RasterReader, () => {opened++; return new Promise(resolve => {release = resolve;});});
  for (const file of [{type: 'text/plain', size: 10}, {type: 'image/jpeg', size: 26 * 1024 * 1024}, {type: 'image/png', size: 0}]) {
    await assert.rejects(h.readFoodBarcodePhoto(file, new AbortController().signal), /25 MB/);
  }
  assert.equal(opened, 0);
  const controller = new AbortController();
  const pending = h.readFoodBarcodePhoto({type: 'image/jpeg', size: 10}, controller.signal);
  controller.abort(); release({width: 4000, height: 3000, close() {closed++;}});
  assert.equal(await pending, null); assert.equal(closed, 1); assert.equal(h.canvases.length, 0);
});
