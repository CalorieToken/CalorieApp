import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-page-ending.js', import.meta.url), 'utf8');
const tokenUrl = 'https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY';
function element() {
  return {
    attrs: {}, textContent: '', hidden: false, children: new Map(), listeners: {},
    classList: { add() {} },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name] ?? null; },
    querySelector(selector) { return this.children.get(selector) ?? null; },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    set innerHTML(html) {
      this.markup = html;
      for (const match of html.matchAll(/<[a-z]+\b[^>]*class="([^"]+)"[^>]*>/g)) {
        const child = element();
        child.hidden = /\bhidden\b/.test(match[0]);
        for (const name of match[1].split(' ')) this.children.set('.' + name, child);
      }
    },
  };
}
const good = () => ({ success: true, data: {
  code: 'Calorie', issuer: 'rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY',
  title: 'Calorie Token', logo: 'https://xpcdn.xpmarket.com/storage/logo/calorie.webp',
  price_usd: 0.00000007, price_xrp: 0.00000005, market_cap_usd: 4000, rank: 300, holders: 14000,
} });
async function settle() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
function run({ response = { ok: true, json: async () => good() }, fetchError, stalled = false, reduced = false, empty = false, endpoint = true } = {}) {
  const widget = element();
  const track = element();
  track.clientWidth = 400;
  track.children.set('a', { getBoundingClientRect: () => ({ width: 200 }) });
  track.moves = [];
  track.scrollBy = (options) => track.moves.push(options);
  const carousel = element();
  carousel.children.set('.calorieapp-shared-social-track', track);
  const buttons = [-1, 1].map((direction) => {
    const button = element(); button.setAttribute('data-calorieapp-carousel-direction', direction); return button;
  });
  carousel.querySelectorAll = () => buttons;
  const requests = [];
  const timers = new Map();
  let ready;
  const document = {
    readyState: 'loading',
    addEventListener(name, fn) { if (name === 'DOMContentLoaded') ready = fn; },
    querySelectorAll(selector) {
      if (empty) return [];
      return selector.includes('xpmarket-widget') ? [widget] : [carousel];
    },
  };
  const window = {
    calorieappPageEnding: endpoint ? { xpMarketWidgetUrl: 'https://calorietoken.net/wp-json/calorieapp/v1/xpmarket-widget', xpMarketTokenUrl: tokenUrl } : {},
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (fetchError) throw fetchError;
      if (stalled) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));
      return response;
    },
    AbortController,
    setTimeout(fn) { timers.set(1, fn); return 1; },
    clearTimeout(id) { timers.delete(id); },
    matchMedia() { return { matches: reduced }; },
  };
  vm.runInNewContext(source, { window, document, URL, Intl });
  ready();
  return { widget, buttons, track, requests, timers, ready };
}

test('public CAL data is shown beside an always-available XPMarket destination', async () => {
  const h = run(); await settle();
  assert.equal(h.widget.getAttribute('data-state'), 'ready');
  assert.equal(h.widget.querySelector('.calorieapp-xpmarket-price').textContent, '$0.00000007');
  assert.equal(h.widget.querySelector('.calorieapp-xpmarket-link').getAttribute('href'), tokenUrl);
  assert.equal(h.widget.querySelector('.calorieapp-xpmarket-state').textContent, 'XPMarket data');
  assert.equal(h.requests[0].options.credentials, 'omit');
  assert.equal(h.timers.size, 0);
  h.ready(); await settle();
  assert.equal(h.requests.length, 1, 'Repeat initialization reuses the request.');
});
test('failed and incomplete feeds keep the fallback link without inventing prices', async () => {
  for (const options of [
    { response: { ok: false } }, { fetchError: new Error('offline') },
    { response: { ok: true, json: async () => ({ success: false }) } }, { endpoint: false },
  ]) {
    const h = run(options); await settle();
    assert.equal(h.widget.getAttribute('data-state'), 'fallback');
    assert.equal(h.widget.querySelector('.calorieapp-xpmarket-state').textContent, 'Open XPMarket');
    assert.equal(h.widget.querySelector('.calorieapp-xpmarket-link').getAttribute('href'), tokenUrl);
    assert.equal(h.widget.querySelector('.calorieapp-xpmarket-price').textContent, '');
  }
});
test('unexpected token data is rejected before filling the card', async () => {
  const data = good(); data.data.issuer = 'different-token';
  const h = run({ response: { ok: true, json: async () => data } }); await settle();
  assert.equal(h.widget.getAttribute('data-state'), 'fallback');
});
test('a stalled market request is abortable and does not leave a permanent loading state', async () => {
  const h = run({ stalled: true });
  h.timers.get(1)();
  assert.equal(h.requests[0].options.signal.aborted, true);
  await settle();
  assert.equal(h.widget.getAttribute('data-state'), 'fallback');
});
test('social arrows move one item and respect reduced motion', () => {
  const h = run({ reduced: true });
  h.buttons[0].listeners.click(); h.buttons[1].listeners.click();
  assert.equal(h.track.moves[0].left, -200);
  assert.equal(h.track.moves[1].left, 200);
  assert.equal(h.track.moves[1].behavior, 'auto');
});
test('pages without the CalorieApp ending do not request market data', () => {
  const h = run({ empty: true });
  assert.equal(h.requests.length, 0);
});
