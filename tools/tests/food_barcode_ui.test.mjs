import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../../frontend/components/FoodBarcodeScanner.tsx', import.meta.url), 'utf8');
const copy = JSON.parse(readFileSync(new URL('../../frontend/config/barcode-copy.json', import.meta.url), 'utf8'));
const library = {exports: {}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../frontend/lib/foodBarcode.ts', import.meta.url), 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {module: library, exports: library.exports});
const nodes = (tree, type) => Array.isArray(tree) ? tree.flatMap(n => nodes(n, type)) : !tree || typeof tree !== 'object' ? [] : [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
function events() {
  const handlers = new Map();
  return {handlers, addEventListener(name, fn) {handlers.set(name, fn);}, removeEventListener(name, fn) {if (handlers.get(name) === fn) handlers.delete(name);}, emit(name, event) {handlers.get(name)?.(event);}};
}
function harness() {
  const hooks = [], sessions = [], results = [], timers = new Map();
  const window = {...events(), isSecureContext: true}, document = {...events(), hidden: false};
  const navigator = {mediaDevices: {getUserMedia() {throw Error('Only the lifecycle service may request a camera');}}};
  let cursor = 0, effects = [], tree, timerId = 0, props = {locale: 'en', disabled: false, onLookup: code => results.push(code)};
  const hook = initial => {const i = cursor++; if (!(i in hooks)) hooks[i] = initial(); return i;};
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const react = {
    useState(initial) {const i = hook(() => initial); return [hooks[i], value => {hooks[i] = typeof value === 'function' ? value(hooks[i]) : value;}];},
    useRef(initial) {return hooks[hook(() => ({current: initial}))];},
    useCallback(fn, deps) {const i = hook(() => null); if (!same(hooks[i]?.deps, deps)) hooks[i] = {deps, fn}; return hooks[i].fn;},
    useEffect(effect, deps) {const i = hook(() => null); if (!same(hooks[i]?.deps, deps)) effects.push(() => {hooks[i]?.cleanup?.(); hooks[i] = {deps, cleanup: effect()};});},
  };
  const module = {exports: {}};
  const jsx = (type, props) => ({type, props});
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {
    module, exports: module.exports, window, document, navigator, AbortController,
    setTimeout(fn, delay) {timers.set(++timerId, {fn, delay}); return timerId;}, clearTimeout(id) {timers.delete(id);},
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return {jsx, jsxs: jsx};
      if (name === '@/config/barcode-copy.json') return {default: copy};
      if (name === '@/lib/foodBarcode') return {validFoodBarcode: library.exports.validFoodBarcode,
        cameraBlockedByPolicy: library.exports.cameraBlockedByPolicy,
        startBarcodeCamera(video, signal, onCode, onReady) {return new Promise((resolve, reject) => sessions.push({video, signal, onCode, onReady, resolve, reject}));}};
      throw Error(`Unexpected import ${name}`);
    },
  });
  function render(patch = {}) {
    props = {...props, ...patch}; cursor = 0; effects = [];
    tree = module.exports.FoodBarcodeScanner(props);
    const video = nodes(tree, 'video')[0]; if (!video.props.ref.current) video.props.ref.current = {};
    for (const effect of effects) effect();
    return tree;
  }
  render();
  return {window, document, navigator, sessions, results, timers, render,
    get tree() {return tree;},
    click() {const result = nodes(tree, 'button')[0].props.onClick(); render(); return result;},
    type(value) {nodes(tree, 'input')[0].props.onChange({target: {value}}); render();},
    submit() {nodes(tree, 'form')[0].props.onSubmit({preventDefault() {}}); render();},
    unmount() {for (const h of hooks) h?.cleanup?.();},
  };
}

test('Scanner is idle on mount; manual entry validates and preserves zeros without requesting a camera', () => {
  const h = harness(); assert.equal(h.sessions.length, 0); assert.equal(h.timers.size, 0);
  h.type('https://example.test'); h.submit(); assert.equal(h.results.length, 0);
  assert.ok(text(h.tree).includes(copy.en.invalid));
  h.type('0034000470693'); h.submit(); assert.deepEqual(h.results, ['0034000470693']);
  assert.equal(h.sessions.length, 0);
});

test('Rapid scan clicks share a session; language changes and one result preserve exactly one lookup', async () => {
  const h = harness(), click = nodes(h.tree, 'button')[0].props.onClick;
  const pending = click(); void click(); h.render(); assert.equal(h.sessions.length, 1);
  for (const locale of Object.keys(copy)) {h.render({locale}); assert.ok(text(h.tree).includes(copy[locale].opening));}
  const s = h.sessions[0]; s.onReady(); h.render(); assert.ok(text(h.tree).includes(copy.ur.scanning));
  s.onCode('3017620422003'); s.onCode('3017620422003'); h.render();
  assert.deepEqual(h.results, ['3017620422003']); assert.equal(s.signal.aborted, true); assert.equal(h.timers.size, 0);
  s.resolve(); await pending;
});

test('Optional zoom and light controls survive a rejected setting and ignore late updates after stop', async () => {
  const h = harness(); void h.click(); const s = h.sessions[0]; let release;
  s.onReady({zoom: {min: 1, max: 4, step: .1, value: 1, set: () => new Promise(resolve => {release = resolve;})},
    torch: {value: false, set: async () => null}});
  h.render();
  const zoom = () => nodes(h.tree, 'select')[0];
  const light = () => nodes(h.tree, 'button').find(n => n.props['aria-pressed'] !== undefined);
  assert.equal(nodes(zoom(), 'option')[0].props.value, 1); assert.equal(nodes(zoom(), 'option').at(-1).props.value, 4);
  light().props.onClick(); await new Promise(setImmediate); h.render();
  assert.ok(text(h.tree).includes(copy.en.controlError)); assert.equal(s.signal.aborted, false);
  zoom().props.onChange({target: {value: '2'}}); h.render();
  assert.equal(zoom().props.disabled, true);
  void h.click(); release(2); await new Promise(setImmediate); h.render();
  assert.equal(zoom(), undefined); assert.equal(light(), undefined);
  s.resolve();
});

test('Stop, Escape, closing the panel, leaving/hiding, parent activity and timeout all cancel scanning', () => {
  for (const reason of ['stop', 'escape', 'close', 'leave', 'hide', 'disabled', 'timeout', 'unmount']) {
    const h = harness(); void h.click(); const s = h.sessions[0];
    if (reason === 'stop') void h.click();
    if (reason === 'escape') h.window.emit('keydown', {key: 'Escape'});
    if (reason === 'close') h.tree.props.onToggle({currentTarget: {open: false}});
    if (reason === 'leave') h.window.emit('pagehide');
    if (reason === 'hide') {h.document.hidden = true; h.document.emit('visibilitychange');}
    if (reason === 'disabled') h.render({disabled: true});
    if (reason === 'timeout') {const timer = [...h.timers.values()][0]; assert.equal(timer.delay, 60_000); timer.fn();}
    if (reason === 'unmount') {h.unmount(); assert.equal(h.window.handlers.size, 0); assert.equal(h.document.handlers.size, 0);}
    assert.equal(s.signal.aborted, true, reason); assert.equal(h.timers.size, 0, reason);
    s.onCode('3017620422003'); assert.equal(h.results.length, 0, 'Cancelled results must be ignored'); s.resolve();
  }
});

test('A late error from a stopped session cannot stop a newer session', async () => {
  const h = harness(); const old = h.click(); void h.click(); const newer = h.click();
  assert.equal(h.sessions.length, 2);
  h.sessions[0].reject(Object.assign(new Error('Late refusal'), {name: 'NotAllowedError'})); await old; h.render();
  assert.equal(h.sessions[1].signal.aborted, false); assert.ok(text(h.tree).includes(copy.en.opening));
  void h.click(); h.sessions[1].resolve(); await newer;
});

test('Camera refusal and unavailable contexts retain a working manual fallback; disabled lookup sends nothing', async () => {
  const h = harness(); const pending = h.click();
  h.sessions[0].reject(Object.assign(new Error('Denied'), {name: 'NotAllowedError'})); await pending; h.render();
  assert.ok(text(h.tree).includes(copy.en.denied)); h.type('034000470693'); h.submit(); assert.equal(h.results.length, 1);
  h.window.isSecureContext = false; await h.click(); h.render(); assert.ok(text(h.tree).includes(copy.en.unavailable));
  h.render({disabled: true}); h.submit(); await h.click(); assert.equal(h.sessions.length, 1); assert.equal(h.results.length, 1);
});

test('A failed preview after capture is granted does not tell the visitor camera permission was refused', async () => {
  const h = harness(), pending = h.click();
  h.sessions[0].reject(Object.assign(new Error('Preview did not play'), {name: 'CameraPlaybackError'}));
  await pending;
  for (const locale of Object.keys(copy)) {
    h.render({locale});
    assert.ok(text(h.tree).includes(copy[locale].cameraError));
    assert.ok(!text(h.tree).includes(copy[locale].denied));
    assert.ok(!text(h.tree).includes(copy[locale].permissionHelp));
  }
  assert.equal(h.timers.size, 0);
  h.type('034000470693'); h.submit(); assert.deepEqual(h.results, ['034000470693']);
});


test('A page policy block is distinguished from visitor refusal without opening a camera or requiring sign-in', async () => {
  for (const property of ['permissionsPolicy', 'featurePolicy']) {
    const h = harness();
    h.document[property] = {allowsFeature(name) {assert.equal(name, 'camera'); return false;}};
    await h.click(); h.render();
    assert.equal(h.sessions.length, 0); assert.equal(h.timers.size, 0);
    for (const locale of Object.keys(copy)) {
      h.render({locale});
      assert.ok(text(h.tree).includes(copy[locale].policyBlocked));
      assert.ok(!text(h.tree).includes(copy[locale].permissionHelp));
    }
    h.type('0034000470693'); h.submit();
    assert.deepEqual(h.results, ['0034000470693']);
  }
});

test('Visitor refusal provides localized recovery guidance; unavailable policy introspection is not treated as refusal', async () => {
  const h = harness();
  h.document.featurePolicy = {allowsFeature() {throw Error('Introspection unsupported');}};
  const pending = h.click();
  assert.equal(h.sessions.length, 1);
  h.sessions[0].reject(Object.assign(new Error('Blocked'), {name: 'NotAllowedError'}));
  await pending;
  for (const locale of Object.keys(copy)) {
    h.render({locale});
    assert.ok(text(h.tree).includes(copy[locale].denied));
    assert.ok(text(h.tree).includes(copy[locale].permissionHelp));
  }
  h.document.permissionsPolicy = {allowsFeature() {return true;}};
  const retry = h.click(); assert.equal(h.sessions.length, 2);
  h.sessions[1].resolve(); await retry; h.unmount();
});
