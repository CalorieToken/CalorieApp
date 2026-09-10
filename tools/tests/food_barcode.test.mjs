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
