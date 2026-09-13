import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../../frontend/lib/foodBarcode.ts', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { module, exports: module.exports, setTimeout, clearTimeout, require: () => { throw Error('Unexpected remote/dependency load'); } });
const { validFoodBarcode, startBarcodeCamera } = module.exports;
const valid = ['3017620422003', '034000470693', '0034000470693', '96385074', '10012345000017'];

test('GTIN validation preserves leading zeros and rejects URLs, malformed codes and incorrect checksums', () => {
  valid.forEach(code => assert.equal(validFoodBarcode(' ' + code + ' '), code));
  ['', '00000000', '3017620422004', '1e12', '123', '../3017620422003', 'https://example.com'].forEach(code => assert.equal(validFoodBarcode(code), null));
});

function camera() {
  let stopped = 0, paused = 0, decoded = 0, opened = 0;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  const video = { srcObject: null, readyState: 2, play: async () => {}, pause: () => paused++ };
  const dependencies = { openStream: async () => { opened++; return stream; }, createReader: async () => ({ decode: () => { decoded++; return null; } }) };
  return { stream, video, dependencies, counts: () => ({ stopped, paused, decoded, opened }) };
}

test('A found code stops tracks before publishing exactly one result', async () => {
  const c = camera(), controller = new AbortController(), results = [];
  c.dependencies.createReader = async () => ({ decode: () => valid[0] });
  await startBarcodeCamera(c.video, controller.signal, code => {
    assert.ok(c.counts().stopped > 0); assert.equal(c.video.srcObject, null); results.push(code);
  }, () => {}, c.dependencies);
  controller.abort();
  assert.deepEqual(results, [valid[0]]);
});

test('Cancellation during permission prompt releases a late stream without decoding or publishing', async () => {
  const c = camera(), controller = new AbortController(); let grant;
  c.dependencies.openStream = () => new Promise(resolve => { grant = resolve; });
  const pending = startBarcodeCamera(c.video, controller.signal, () => assert.fail('late result'), () => assert.fail('late ready'), c.dependencies);
  await new Promise(setImmediate); controller.abort(); grant(c.stream); await pending;
  assert.ok(c.counts().stopped > 0); assert.equal(c.counts().decoded, 0); assert.equal(c.video.srcObject, null);
});

test('Cancellation during decoder loading does not request a camera', async () => {
  const c = camera(), controller = new AbortController(); let loaded;
  c.dependencies.createReader = () => new Promise(resolve => { loaded = resolve; });
  const pending = startBarcodeCamera(c.video, controller.signal, () => assert.fail(), () => assert.fail(), c.dependencies);
  controller.abort(); loaded({ decode: () => valid[0] }); await pending;
  assert.equal(c.counts().opened, 0);
});

test('Stopping an old playback request never clears a newer camera stream', async () => {
  const c = camera(), controller = new AbortController(); let playing;
  c.video.play = () => new Promise(resolve => { playing = resolve; });
  const pending = startBarcodeCamera(c.video, controller.signal, () => assert.fail(), () => assert.fail(), c.dependencies);
  await new Promise(setImmediate); controller.abort();
  const newerStream = {}; c.video.srcObject = newerStream;
  playing(); await pending;
  assert.equal(c.video.srcObject, newerStream);
});

test('Denied camera and decoder failures remain recoverable and release owned resources', async () => {
  const c = camera(), controller = new AbortController();
  c.dependencies.openStream = async () => { throw Object.assign(new Error('blocked'), { name: 'NotAllowedError' }); };
  await assert.rejects(startBarcodeCamera(c.video, controller.signal, () => assert.fail(), () => {}, c.dependencies), { name: 'NotAllowedError' });
  c.dependencies.openStream = async () => c.stream;
  c.dependencies.createReader = async () => ({ decode: () => { throw new Error('decoder failed'); } });
  await assert.rejects(startBarcodeCamera(c.video, controller.signal, () => assert.fail(), () => {}, c.dependencies), /decoder failed/);
  assert.ok(c.counts().stopped > 0); assert.equal(c.video.srcObject, null);
});

test('Camera preview starts muted and inline; playback refusal is distinct from capture refusal and releases tracks', async () => {
  const c = camera(), controller = new AbortController();
  const refusal = Object.assign(new Error('Playback blocked'), {name: 'NotAllowedError'});
  c.video.play = async () => {
    assert.equal(c.video.muted, true); assert.equal(c.video.defaultMuted, true); assert.equal(c.video.playsInline, true);
    assert.equal(c.video.srcObject, c.stream);
    throw refusal;
  };
  await assert.rejects(startBarcodeCamera(c.video, controller.signal, () => assert.fail('No result'),
    () => assert.fail('No ready signal before playback'), c.dependencies), error => {
      assert.equal(error.name, 'CameraPlaybackError'); assert.equal(error.cause, refusal); return true;
    });
  assert.equal(c.counts().opened, 1); assert.equal(c.counts().decoded, 0);
  assert.ok(c.counts().stopped > 0); assert.equal(c.video.srcObject, null);
});

test('Invalid detections keep scanning locally and abort clears the loop', async () => {
  const c = camera(), controller = new AbortController(); let attempted = 0;
  c.dependencies.createReader = async () => ({ decode: () => { attempted++; return 'https://example.com'; } });
  const pending = startBarcodeCamera(c.video, controller.signal, () => assert.fail('QR or malformed code must not be looked up'), () => {}, c.dependencies);
  await new Promise(setImmediate); assert.equal(attempted, 1);
  controller.abort(); await pending;
  assert.ok(c.counts().stopped > 0);
});

test('All scanner copy covers the eleven existing languages', () => {
  const copy = JSON.parse(readFileSync(new URL('../../frontend/config/barcode-copy.json', import.meta.url), 'utf8'));
  const locales = JSON.parse(readFileSync(new URL('../../frontend/config/locales.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(copy).sort(), locales.locales.map(x => x.tag).sort());
  Object.values(copy).forEach(values => {
    assert.deepEqual(Object.keys(values), Object.keys(copy.en));
    assert.ok(Object.values(values).every(value => typeof value === 'string' && value.trim()));
  });
});

test('The actual bundled decoder reads EAN-8, EAN-13, UPC-A and ITF-14 raster fixtures', async () => {
  const zxing = require('@zxing/library');
  const {BrowserMultiFormatReader} = require('@zxing/browser');
  // Only the DOM canvas capture is substituted. Format selection, luminance
  // binarization, real ZXing decoding, validation and session cleanup run as shipped.
  class RasterReader extends BrowserMultiFormatReader {
    decode(video) { return this.decodeBitmap(video.bitmap); }
    decodeFromCanvas(canvas) { return this.decodeBitmap(canvas.bitmap); }
  }
  const rasterModule = {exports: {}};
  let nextStream;
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {
    module: rasterModule, exports: rasterModule.exports, setTimeout, clearTimeout,
    document: {createElement() {
      const canvas = {getContext: () => ({drawImage(video) {canvas.bitmap = video.bitmap;}})};
      return canvas;
    }},
    navigator: {mediaDevices: {getUserMedia: async () => nextStream}},
    require(name) { return name === '@zxing/browser' ? {BrowserMultiFormatReader: RasterReader} : require(name); },
  });
  const left = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const parity = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
  const invert = bits => bits.replace(/[01]/g, bit => bit === '1' ? '0' : '1');
  function ean(code) {
    if (code.length === 12) code = '0' + code;
    const half = code.length === 8 ? 4 : 6, lhs = code.length === 8 ? code.slice(0, 4) : code.slice(1, 7);
    return '101' + [...lhs].map((digit, i) => code.length === 8 || parity[code[0]][i] === 'L' ? left[digit] : invert([...left[digit]].reverse().join(''))).join('')
      + '01010' + [...code.slice(-half)].map(digit => invert(left[digit])).join('') + '101';
  }
  function itf(code) {
    const patterns = ['11331','31113','13113','33111','11313','31311','13311','11133','31131','13131'];
    let bars = '1010';
    for (let i = 0; i < code.length; i += 2) for (let j = 0; j < 5; j++) bars += '1'.repeat(Number(patterns[code[i]][j])) + '0'.repeat(Number(patterns[code[i + 1]][j]));
    return bars + '11101';
  }
  for (const code of [valid[0], valid[1], valid[3], valid[4]]) {
    const bars = '0'.repeat(20) + (code.length === 14 ? itf(code) : ean(code)) + '0'.repeat(20);
    const width = bars.length * 3, height = 100, pixels = new Uint8ClampedArray(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels[y * width + x] = bars[Math.floor(x / 3)] === '1' ? 0 : 255;
    const c = camera(); nextStream = c.stream;
    c.video.videoWidth = width; c.video.videoHeight = height;
    c.video.bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(new zxing.RGBLuminanceSource(pixels, width, height)));
    const controller = new AbortController(), found = [];
    const timeout = setTimeout(() => controller.abort(), 2_000);
    try { await rasterModule.exports.startBarcodeCamera(c.video, controller.signal, value => found.push(value), () => {}); }
    finally { clearTimeout(timeout); controller.abort(); }
    assert.deepEqual(found, [code]); assert.ok(c.counts().stopped > 0); assert.equal(c.video.srcObject, null);
  }
});
