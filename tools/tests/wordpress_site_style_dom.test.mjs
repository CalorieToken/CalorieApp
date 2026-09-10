import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

// A real DOM implementation exercises selectors, preserved nodes and interacting
// scripts. It does not measure pixels or claim a browser/device visual pass.
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const {parseHTML} = require('linkedom');
const assets = new URL('../../wordpress-plugins/calorietoken-site-style/assets/', import.meta.url);
const source = name => readFileSync(new URL(name, assets), 'utf8');
const copy = JSON.parse(source('discovery-data.json'));
const menu = JSON.parse(source('menu-data.json'));
function fixture(html, {page = 1210, route = 'whitepaper', home = false} = {}) {
  const {document, window: dom} = parseHTML(`<html lang="en"><head></head><body class="${home ? 'home ctstyle-footer-only' : 'ctstyle-enabled'} page-id-${page}">${html}</body></html>`);
  const observers = [], frames = [], events = new Map();
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; this.active = true; }
    disconnect() { this.active = false; }
  }
  // linkedom intentionally omits layout and writable select.value behavior.
  // Supply only the native control property; no CSS/layout results are invented.
  Object.defineProperty(dom.HTMLSelectElement.prototype, 'value', {configurable: true,
    get() { return this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? ''; },
    set(value) { this.querySelectorAll('option').forEach(option => option.toggleAttribute('selected', option.value === value)); },
  });
  const window = {
    Event: dom.Event, CustomEvent: dom.CustomEvent, Element: dom.Element, MutationObserver: Observer,
    location: new URL(`https://calorietoken.net/${home ? '' : 'index.php/' + route + '/'}`),
    CalorieTokenDiscovery: {page, copy, appURL: 'https://calorietoken.net/index.php/calorieapp/', appLogo: '/logo.svg'},
    CalorieTokenSiteStyleMenu: menu,
    localStorage: {getItem: () => null, setItem() {}},
    getComputedStyle: node => ({display: node.style.display || 'block', visibility: node.style.visibility || 'visible', backgroundImage: node.style.backgroundImage || '', opacity: node.style.opacity || '1'}),
    requestAnimationFrame: fn => frames.push(fn),
    addEventListener(name, fn) { events.set(name, [...events.get(name) || [], fn]); },
    dispatchEvent(event) { for (const fn of events.get(event.type) || []) fn(event); },
  };
  const context = {window, document, URL, MutationObserver: Observer};
  return {document, window, observers, frames,
    run(name) { vm.runInNewContext(source(name), context); document.dispatchEvent(new dom.Event('DOMContentLoaded')); },
    emit(name) { for (const fn of events.get(name) || []) fn(); },
    mutate(record) { for (const o of [...observers]) if (o.active && o.options.childList) o.callback([{type: 'childList', addedNodes: [], removedNodes: [], ...record}]); },
    flush() { let budget = 20; while (frames.length && budget--) frames.shift()(); assert.equal(frames.length, 0, 'Observers must settle without a refresh loop'); },
  };
}
const account = '<div class="xl-card"><div class="xl-card-header">Public account placeholder</div><div class="xl-card-body"><button id="native-login">Sign in</button></div><div class="xl-card-footer">Sign-in note</div></div>';
const footer = '<footer class="ctstyle-footer"><p class="ctstyle-legal-links"><a href="https://calorietoken.net/index.php/privacy-policy/">Privacy Policy</a></p></footer>';
const native = `<section class="brz-section ctstyle-header"><div class="brz-section__content ctstyle-header-content"><div class="brz-row"><div class="brz-columns"><div class="brz-column__items"><img src="/C-Logotranspa.png"></div></div><div class="brz-columns"><div class="brz-column__items"><div class="brz-menu-simple"><div class="brz-menu-simple__toggle"><input class="brz-input" type="checkbox" id="native-menu"><label class="brz-menu-simple__icon" for="native-menu"><span class="brz-menu-simple__icon--bars"></span></label><div><a id="whitepaper" href="https://calorietoken.net/index.php/whitepaper/">Whitepaper</a></div></div></div></div></div><div class="brz-columns"><div class="brz-column__items">${account}</div></div></div></div></section>`;

test('Native headers keep menu/login nodes and handlers through eleven language changes', () => {
  for (const home of [false, true]) {
    const h = fixture(native + footer, {home, page: home ? 1090 : 1210});
    const input = h.document.querySelector('#native-menu'), login = h.document.querySelector('#native-login');
    let changes = 0, clicks = 0, focuses = 0;
    input.checked = false; input.focus = () => focuses++;
    input.addEventListener('change', () => changes++); login.addEventListener('click', () => clicks++);
    h.run('discovery.js'); h.run('refinements.js');
    for (const tag of [...Object.keys(copy), 'en']) h.window.CalorieTokenDiscoveryUI.setLocale(tag, false);
    assert.equal(h.document.querySelectorAll('.ctstyle-header-grid').length, 1);
    assert.equal(h.document.querySelectorAll('.ctstyle-footer-tail').length, 1);
    assert.equal(h.document.querySelectorAll('#ctstyle-account-language').length, 1);
    assert.equal(h.document.querySelector('#native-menu'), input);
    assert.equal(h.document.querySelector('#native-login'), login);
    login.click(); assert.equal(clicks, 1);
    input.checked = true; input.dispatchEvent(new h.window.Event('change', {bubbles: true}));
    const escape = new h.window.Event('keydown', {bubbles: true, cancelable: true}); escape.key = 'Escape';
    input.dispatchEvent(escape);
    assert.equal(input.checked, false); assert.equal(input.getAttribute('aria-expanded'), 'false');
    assert.equal(changes, 2); assert.equal(focuses, 1);
  }
});

test('The combined account controls recover after a native footer refresh without cloning login', () => {
  const h = fixture(native + footer); h.run('discovery.js');
  const card = h.document.querySelector('.xl-card'), widget = h.document.querySelector('#ctstyle-account-app');
  const login = h.document.querySelector('#native-login'), target = h.document.querySelector('.xl-card-footer');
  target.replaceChildren(h.document.createTextNode('Updated sign-in note'));
  h.mutate({target, addedNodes: [...target.childNodes], removedNodes: [widget]}); h.flush();
  assert.ok(card.contains(widget), 'The existing app/language controls should reattach after footer replacement');
  assert.equal(h.document.querySelector('#native-login'), login);
  assert.equal(h.document.querySelectorAll('#ctstyle-account-app').length, 1);
});

test('Translated public text can be replaced by a new known CMS message and translated again', () => {
  const h = fixture('<main class="entry-content"><p id="message">Welcome</p></main><div class="xl-card"><p>Welcome</p></div>');
  h.window.CalorieTokenContentLanguage = {locales: ['en', 'nl'], entries: [
    {source: 'Welcome', translations: {nl: 'Welkom'}}, {source: 'No Donations Yet', translations: {nl: 'Nog geen donaties'}},
  ]};
  h.run('content-language.js'); h.window.CalorieTokenContentLanguageUI.refresh('nl');
  const node = h.document.querySelector('#message'); assert.equal(node.textContent, 'Welkom');
  const removed = [...node.childNodes]; node.replaceChildren(h.document.createTextNode('No Donations Yet'));
  h.mutate({target: node, addedNodes: [...node.childNodes], removedNodes: removed}); h.flush();
  assert.equal(node.textContent, 'Nog geen donaties');
  h.window.CalorieTokenContentLanguageUI.refresh('en'); assert.equal(node.textContent, 'No Donations Yet');
  assert.equal(h.document.querySelector('.xl-card p').textContent, 'Welcome');
});

test('A CMS edit to unrecognized public copy is preserved during later language changes', () => {
  const h = fixture('<main class="entry-content"><p id="message"><strong>Welcome</strong></p></main>');
  h.window.CalorieTokenContentLanguage = {locales: ['en', 'nl'], entries: [{source: 'Welcome', translations: {nl: 'Welkom'}}]};
  h.run('content-language.js'); h.window.CalorieTokenContentLanguageUI.refresh('nl');
  const node = h.document.querySelector('#message'); node.textContent = 'New custom content';
  h.window.CalorieTokenContentLanguageUI.refresh('en'); h.window.CalorieTokenContentLanguageUI.refresh('nl');
  assert.equal(node.textContent, 'New custom content');
});

test('Trustline alternatives preserve native links/copy controls and do not duplicate on refresh', () => {
  const h = fixture('<div id="ctstyle-direct-trustline"><a href="/index.php/trustline/?xl-trustline">Open Xaman</a></div><div class="ctstyle-trustline-options"><div data-brz-custom-id="tudwxqvkogbjptwlykgwzlzdixbhxidyqhku"><button>Copy issuer</button></div><div data-brz-custom-id="inpxenkjojstawbfbmiwkgigeabgzzcmectb"><a href="https://www.xrptoolkit.com/">Toolkit</a></div></div>', {page: 1205, route: 'trustline'});
  const controls = [...h.document.querySelectorAll('a,button')]; const links = controls.map(n => n.getAttribute('href'));
  h.run('refinements.js'); for (const tag of Object.keys(copy)) h.window.CalorieTokenRefinements.refresh(tag);
  assert.equal(h.document.querySelectorAll('.ctstyle-manual-trustline').length, 2);
  assert.equal(h.document.querySelectorAll('#ctstyle-trustline-methods').length, 1);
  controls.forEach((node, index) => {assert.ok(node.isConnected); assert.equal(node.getAttribute('href'), links[index]);});
});

test('The full CAL guide/discovery/translation sequence retains exact routes and all eleven languages', () => {
  const ts = require('typescript');
  const parsed = ts.createSourceFile('menu-pages.js', source('menu-pages.js'), ts.ScriptTarget.Latest, true);
  let legacy;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'legacyBuyGuideMarkup') legacy = vm.runInNewContext(node.initializer.getText(parsed));
    ts.forEachChild(node, visit);
  }
  visit(parsed); assert.equal(typeof legacy, 'string');
  const h = fixture(`<div class="cal-buy-guide">${legacy}</div>`, {page: 4205, route: 'how-to-buy-calorie'});
  h.run('menu-pages.js'); h.run('ready-languages.js'); h.run('discovery.js'); h.run('refinements.js');
  const guide = h.document.querySelector('.cal-buy-guide');
  assert.equal(guide.getAttribute('data-ctstyle-buy-routes'), '1');
  const controls = [...guide.querySelectorAll('a')], destinations = controls.map(a => a.getAttribute('href'));
  assert.equal(destinations.length, 7);
  for (const locale of [...Object.keys(copy), 'en']) {
    h.window.CalorieTokenDiscoveryUI.setLocale(locale, false);
    assert.equal(guide.lang, locale);
    for (const field of guide.querySelectorAll('[data-cal-buy-copy]')) assert.equal(field.textContent, menu.buyGuide.copy[locale][field.getAttribute('data-cal-buy-copy')]);
    controls.forEach((node, index) => {assert.ok(node.isConnected); assert.equal(node.getAttribute('href'), destinations[index]);});
    assert.equal(h.document.querySelectorAll('.ctstyle-crypto-journey li').length, 3);
    assert.equal(h.document.querySelectorAll('#ctstyle-own-dex').length, 1);
    assert.equal(h.document.querySelectorAll('#ctstyle-external-exchange').length, 1);
    assert.equal(h.document.querySelectorAll('iframe').length, 0, 'An unopened external exchange must not load a provider');
  }
});
