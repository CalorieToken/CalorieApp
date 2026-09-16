import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const React = require('react');
const {createRoot} = require('react-dom/client');
const {parseHTML} = require('linkedom');
const ts = require('typescript');

function MockFoodSearch({activeView, onOpenAccount}) {
  const [count, setCount] = React.useState(0);
  return React.createElement(React.Fragment, null,
    React.createElement('section', {id: 'calorie-panel-packaged', role: 'tabpanel', hidden: activeView !== 'packaged'},
      React.createElement('button', {id: 'preserved-control', onClick: () => setCount(value => value + 1)}, String(count)),
      React.createElement('button', {id: 'open-account', onClick: onOpenAccount}, 'Open account')),
    React.createElement('section', {id: 'calorie-panel-basic', role: 'tabpanel', hidden: activeView !== 'basic'}, 'Basic'),
    React.createElement('section', {id: 'calorie-panel-diary', role: 'tabpanel', hidden: activeView !== 'diary'}, 'Diary'));
}

function load(window, document) {
  const source = readFileSync(new URL('../../frontend/components/CalorieAppWorkspace.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  const module = {exports: {}};
  const imports = {
    '@/components/FoodSearchPlaceholder': {FoodSearchPlaceholder: MockFoodSearch},
    '@/components/TestnetEntry': {TestnetEntry: () => React.createElement('p', null, 'Testnet')},
    '@/components/XamanLoginPanel': {XamanLoginPanel: () => React.createElement('p', null, 'Account panel')},
    '@/components/DisplayLanguageProvider': {useDisplayLanguage: () => ({enabled: true, locale: 'nl'})},
    '@/lib/authUi': {getAuthUi: () => ({copy: {accountTools: 'Account'}, locale: 'nl', direction: 'ltr'})},
    '@/lib/foodDiary': {diaryCopy: () => ({title: 'Eetdagboek'})},
    '@/lib/foodExperience': {foodExperience: () => ({copy: {sourceTitle: 'Basisvoeding', navigation: 'Ga naar'}})},
    '@/lib/foodUi': {getFoodUi: () => ({copy: {searchTitle: 'Product zoeken'}, locale: 'nl', direction: 'ltr'})},
  };
  vm.runInNewContext(code, {module, exports: module.exports, window, document, require(name) {
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected workspace dependency: ${name}`);
  }});
  return module.exports.CalorieAppWorkspace;
}

async function click(window, node) {
  await React.act(async () => node.dispatchEvent(new window.Event('click', {bubbles: true})));
}

test('task tabs show one panel, support arrows and retain mounted form state', async () => {
  const {window, document} = parseHTML('<html><body><div id="root"></div></body></html>');
  const previous = new Map(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.window = window; globalThis.document = document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.requestAnimationFrame = callback => { callback(); return 1; };
  const Workspace = load(window, document);
  const root = createRoot(document.getElementById('root'));
  try {
    await React.act(async () => root.render(React.createElement(Workspace)));
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    assert.equal(tabs.length, 4);
    assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
    assert.deepEqual([...document.querySelectorAll('[role="tabpanel"]')].filter(node => !node.hidden).map(node => node.id), ['calorie-panel-account']);

    await click(window, tabs[1]);
    assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
    await click(window, document.getElementById('preserved-control'));
    assert.equal(document.getElementById('preserved-control').textContent, '1');

    const key = new window.Event('keydown', {bubbles: true});
    Object.defineProperty(key, 'key', {value: 'ArrowRight'});
    await React.act(async () => tabs[1].dispatchEvent(key));
    assert.equal(tabs[2].getAttribute('aria-selected'), 'true');
    assert.deepEqual([...document.querySelectorAll('[role="tabpanel"]')].filter(node => !node.hidden).map(node => node.id), ['calorie-panel-basic']);

    await click(window, tabs[1]);
    assert.equal(document.getElementById('preserved-control').textContent, '1', 'hidden task state must stay mounted');
    await click(window, document.getElementById('open-account'));
    assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  } finally {
    await React.act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
