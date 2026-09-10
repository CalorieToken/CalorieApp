import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const assets = new URL('../../wordpress-plugins/calorietoken-site-style/assets/', import.meta.url);
const source = name => readFileSync(new URL(name, assets), 'utf8');
const handlers = () => {
  const events = new Map();
  return {
    addEventListener(name, fn) { events.set(name, [...(events.get(name) || []), fn]); },
    emit(name, event = {}) { for (const fn of events.get(name) || []) fn(event); },
  };
};
const tokens = (...initial) => {
  const values = new Set(initial);
  return {contains: value => values.has(value), toggle(value, enabled) {
    if (enabled) values.add(value); else values.delete(value);
  }};
};

function discoveryFixture() {
  const observers = [], banners = [];
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; this.active = true; }
    disconnect() { this.active = false; }
  }
  const body = {classList: tokens(), matches: s => s === '.ctstyle-enabled,.ctstyle-footer-only'};
  const document = {
    ...handlers(), body, readyState: 'loading', documentElement: {lang: 'en'},
    querySelector: () => null,
    querySelectorAll: selector => selector === '.cmplz-cookiebanner' ? banners : [],
    // Existing host widgets bypass unrelated creation in this page fixture.
    getElementById: () => ({}),
  };
  const window = {
    ...handlers(), location: new URL('https://calorietoken.net/index.php/groceries/'),
    CalorieTokenDiscovery: {page: 1119, copy: {en: {}}},
    localStorage: {getItem: () => null},
    getComputedStyle: node => node.style,
  };
  vm.runInNewContext(source('discovery.js'), {window, document, URL, MutationObserver: Observer});
  document.emit('DOMContentLoaded');
  function mutate(record) {
    record = {addedNodes: [], removedNodes: [], ...record};
    for (const observer of observers) if (observer.active &&
      (record.type === 'attributes' ? observer.options.attributes : observer.options.childList)) {
      observer.callback([record]);
    }
  }
  function banner() {
    return {nodeType: 1, hidden: false, classList: tokens('cmplz-cookiebanner'),
      style: {display: 'block', visibility: 'visible', opacity: '1'},
      matches: selector => selector.includes('.cmplz-cookiebanner'), querySelector: () => null,
      closest: () => null};
  }
  return {window, document, body, observers, banners, mutate, banner,
    open: () => body.classList.contains('ctstyle-cookie-banner-open')};
}

test('Late cookie banners hide controls and dismissal, hiding or removal restores them', () => {
  const h = discoveryFixture();
  assert.equal(h.open(), false);
  const banner = h.banner(); h.banners.push(banner);
  h.mutate({type: 'childList', addedNodes: [banner]});
  assert.equal(h.open(), true);
  banner.hidden = true; h.mutate({type: 'attributes', target: banner});
  assert.equal(h.open(), false);
  banner.hidden = false; h.mutate({type: 'attributes', target: banner});
  assert.equal(h.open(), true);
  banner.style.display = 'none'; h.mutate({type: 'attributes', target: banner});
  assert.equal(h.open(), false);
  banner.style.display = 'block'; h.mutate({type: 'attributes', target: banner});
  banner.classList.toggle('cmplz-dismissed', true); h.mutate({type: 'attributes', target: banner});
  assert.equal(h.open(), false);
  banner.classList.toggle('cmplz-dismissed', false); h.document.emit('cmplz_cookie_warning_loaded');
  assert.equal(h.open(), true);
  h.banners.pop(); h.mutate({type: 'childList', removedNodes: [banner]});
  assert.equal(h.open(), false);
  const css = source('discovery.css');
  assert.match(css, /body\.ctstyle-enabled\.ctstyle-cookie-banner-open \.calorieapp-page-tools/);
  assert.match(css, /body\.ctstyle-footer-only\.ctstyle-cookie-banner-open \.calorieapp-page-tools\s*\{visibility:hidden;/);
  assert.doesNotMatch(css, /:has\([^)]*cmplz/);
});

test('Cookie visibility resumes after back/forward restoration without accumulating observers', () => {
  const h = discoveryFixture();
  assert.equal(h.observers.filter(o => o.active).length, 2);
  h.window.emit('pagehide');
  assert.equal(h.observers.filter(o => o.active).length, 0);
  h.banners.push(h.banner());
  h.window.emit('pageshow');
  assert.equal(h.open(), true);
  assert.equal(h.observers.filter(o => o.active).length, 2);
  h.window.emit('pageshow');
  assert.equal(h.observers.filter(o => o.active).length, 2);
  h.banners[0].hidden = true; h.document.emit('cmplz_status_change');
  assert.equal(h.open(), false);
});

test('X consent stays on Blog for both native and managed anchors without intercepting ordinary links', () => {
  for (const managed of [false, true]) {
    class Element { constructor(closest) { this.closest = closest; } }
    const document = {...handlers(), readyState: 'loading', querySelector: () => null,
      body: {matches: selector => selector === '.ctstyle-enabled.page-id-1207'}};
    const window = {...handlers(), Element, location: new URL('https://calorietoken.net/index.php/blog/'),
      setTimeout: () => 0};
    vm.runInNewContext(source('blog-timeline.js'), {window, document, URL});
    const link = new Element(() => ({})); link.tagName = 'A';
    link.getAttribute = () => 'https://x.com/CalorieToken';
    const button = new Element(selector => selector.split(',').includes(managed ? 'a[data-ctstyle-x-anchor]' : 'a.twitter-timeline') ? link : null);
    const target = new Element(() => button);
    let prevented = false;
    const event = {target, preventDefault: () => { prevented = true; },
      stopPropagation: () => assert.fail('The native consent handler must receive the click')};
    document.emit('click', event); assert.equal(prevented, true);
    prevented = false; event.target = new Element(() => null);
    document.emit('click', event); assert.equal(prevented, false);
    event.target = target; link.getAttribute = () => 'https://x.com/another-profile';
    document.emit('click', event); assert.equal(prevented, false);
  }
});
