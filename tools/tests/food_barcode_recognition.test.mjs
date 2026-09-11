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
  decode(video) { return this.decodeBitmap(bitmap({...video, width: video.videoWidth, height: video.videoHeight})); }
  decodeFromCanvas(canvas) { return this.decodeBitmap(bitmap(canvas)); }
}
function load(Native, Reader = RasterReader) {
  const captures = [], canvases = [], module = {exports: {}};
  const document = {createElement(name) {
    assert.equal(name, 'canvas');
    const canvas = {getContext() {return {drawImage(video, sx, sy, sw, sh) {
      captures.push({sx, sy, sw, sh});
      canvas.pixels = new Uint8ClampedArray(canvas.width * canvas.height);
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        canvas.pixels[y * canvas.width + x] = video.pixels[Math.floor(sy + y * sh / canvas.height) * video.videoWidth + Math.floor(sx + x * sw / canvas.width)];
      }
    }};}};
    canvases.push(canvas); return canvas;
  }};
  vm.runInNewContext(source, {module, exports: module.exports, document, window: {BarcodeDetector: Native}, setTimeout, clearTimeout,
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
