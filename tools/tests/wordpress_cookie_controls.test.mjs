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
  return {contains: value => values.has(value), add: value => values.add(value), remove: value => values.delete(value), toggle(value, enabled) {
    if (enabled) values.add(value); else values.delete(value);
  }};
};

function discoveryFixture() {
  const observers = [], banners = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = new Map(); this.calls = 0; observers.push(this); }
    observe(target, options) { this.targets.set(target, options); this.active = true; }
    disconnect() { this.active = false; this.targets.clear(); }
  }
  const body = {classList: tokens(), matches: s => s === '.ctstyle-enabled,.ctstyle-footer-only'};
  const document = {
    ...handlers(), body, readyState: 'loading', documentElement: {lang: 'en'},
    querySelector: () => null,
    querySelectorAll: selector => ['.cmplz-cookiebanner', '#cmplz-cookiebanner-container,.cmplz-cookiebanner'].includes(selector) ? banners : [],
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
    record = {target: body, addedNodes: [], removedNodes: [], ...record};
    for (const observer of observers) if (observer.active && Array.from(observer.targets).some(([target, options]) =>
      (target === record.target || target === body && options.subtree) &&
      (record.type === 'attributes' ? options.attributes : options.childList))) {
      observer.calls++;
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
  assert.equal(h.observers.filter(o => o.active).length, 3);
  h.window.emit('pageshow');
  assert.equal(h.observers.filter(o => o.active).length, 3);
  h.banners[0].hidden = true; h.document.emit('cmplz_status_change');
  assert.equal(h.open(), false);
});

test('Cookie attribute observation ignores Brizy changes and follows banner replacement', () => {
  const h = discoveryFixture(), first = h.banner(); h.banners.push(first);
  h.mutate({type: 'childList', addedNodes: [first]});
  const before = h.observers.reduce((sum, o) => sum + o.calls, 0);
  const unrelated = {matches: () => false};
  for (let i = 0; i < 20; i++) h.mutate({type: 'attributes', target: unrelated});
  assert.equal(h.observers.reduce((sum, o) => sum + o.calls, 0), before);
  const replacement = h.banner(); replacement.hidden = true;
  h.banners.splice(0, 1, replacement);
  h.mutate({type: 'childList', addedNodes: [replacement], removedNodes: [first]});
  assert.equal(h.open(), false);
  assert.ok(h.observers.every(o => !o.targets.has(first)));
  replacement.hidden = false; h.mutate({type: 'attributes', target: replacement});
  assert.equal(h.open(), true);
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

test('Hiding the Complianz container restores controls even when its banner has visible styles', () => {
  const h = discoveryFixture(), banner = h.banner(), container = h.banner();
  banner.closest = () => container;
  h.banners.push(banner, container);
  h.mutate({type: 'childList', addedNodes: [container]});
  assert.equal(h.open(), true);
  for (const property of ['hidden', 'display', 'visibility', 'opacity']) {
    if (property === 'hidden') container.hidden = true;
    else container.style[property] = {display: 'none', visibility: 'hidden', opacity: '0'}[property];
    h.mutate({type: 'attributes', target: container});
    assert.equal(h.open(), false, property);
    container.hidden = false;
    container.style = {display: 'block', visibility: 'visible', opacity: '1'};
    h.mutate({type: 'attributes', target: container});
    assert.equal(h.open(), true, property);
  }
});

test('An X frame is ready only with consent and visible nonzero dimensions, including browser restoration', () => {
  let permitted = true, blocked = false;
  const observers = [], box = {width: 0, height: 0};
  const frame = {hidden: false, style: {display: 'block', visibility: 'visible'},
    getAttribute: () => 'https://syndication.twitter.com/srv/timeline-profile/screen-name/CalorieToken',
    getBoundingClientRect: () => box, closest: () => blocked ? {} : null};
  const panel = {isConnected: true, classList: tokens(), closest: () => null, querySelector: () => null,
    querySelectorAll: selector => selector === 'iframe' ? [frame] : []};
  const document = {...handlers(), readyState: 'loading', querySelector: () => null,
    body: {matches: selector => selector === '.ctstyle-enabled.page-id-1207'},
    querySelectorAll: () => [panel], dispatchEvent: () => {},
    createElement: () => assert.fail('The existing CMS iframe must not trigger another provider request')};
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  const window = {...handlers(), location: new URL('https://calorietoken.net/index.php/blog/'),
    cmplz_has_service_consent: () => permitted, getComputedStyle: node => node.style,
    Event: class {}, setTimeout: () => 0, clearTimeout: () => {}};
  vm.runInNewContext(source('blog-timeline.js'), {window, document, URL, MutationObserver: Observer});
  document.emit('DOMContentLoaded');
  const ready = () => panel.classList.contains('ctstyle-x-ready');
  const inspect = () => observers.filter(o => o.active).forEach(o => o.callback());
  assert.equal(ready(), false);
  box.width = 600; inspect(); assert.equal(ready(), false);
  box.height = 520; inspect(); assert.equal(ready(), true);
  blocked = true; inspect(); assert.equal(ready(), false);
  blocked = false; frame.hidden = true; inspect(); assert.equal(ready(), false);
  frame.hidden = false; frame.style.visibility = 'hidden'; inspect(); assert.equal(ready(), false);
  frame.style.visibility = 'visible'; inspect(); assert.equal(ready(), true);
  permitted = false; document.emit('cmplz_revoke'); assert.equal(ready(), false);
  permitted = true; document.emit('cmplz_status_change'); assert.equal(ready(), true);
  window.emit('pagehide'); assert.equal(observers.filter(o => o.active).length, 0);
  window.emit('pageshow'); window.emit('pageshow');
  assert.equal(observers.filter(o => o.active).length, 1);
  assert.equal(ready(), true);
});

test('Public translation observation skips private account changes and preserves the selected locale for late content', () => {
  const observers = [], frames = [];
  const document = {...handlers(), readyState: 'loading',
    body: {matches: selector => selector === '.ctstyle-enabled,.ctstyle-footer-only'},
    querySelector: () => null, querySelectorAll: () => []};
  const window = {...handlers(), location: new URL('https://calorietoken.net/index.php/donate/'),
    CalorieTokenContentLanguage: {locales: ['en','nl'], entries: [{source:'No Donations Yet',translations:{nl:'Nog geen donaties'}}]},
    requestAnimationFrame: fn => frames.push(fn),
    MutationObserver: class { constructor(fn) { this.fn=fn; observers.push(this); } observe() {} disconnect() {} }};
  vm.runInNewContext(source('content-language.js'), {window, document, URL});
  document.emit('DOMContentLoaded');
  window.CalorieTokenContentLanguageUI.refresh('nl');
  const privateParent = {isConnected:true,closest:()=>({})};
  observers[0].fn([{type:'characterData',target:{nodeType:3,parentElement:privateParent,data:'No Donations Yet'}}]);
  assert.equal(frames.length,0);
  const publicParent = {isConnected:true,closest:()=>null};
  observers[0].fn([{type:'characterData',target:{nodeType:3,parentElement:publicParent,data:'No Donations Yet'}}]);
  assert.equal(frames.length,1);frames.shift()();
  assert.equal(window.CalorieTokenContentLanguageUI.getLocale(),'nl');
  observers[0].fn([{type:'characterData',target:{nodeType:3,parentElement:publicParent,data:'1234'}}]);
  assert.equal(frames.length,0,'Unrelated numeric updates do not rescan the page');
});

test('Native menu accessibility preserves the existing checkbox and restores focus without duplicate handlers', () => {
  const copy = {en:{menuLabel:'Main navigation'},nl:{menuLabel:'Hoofdnavigatie'}};
  const attributes = new Map(), inputEvents = handlers(), menuEvents = handlers();
  let focuses=0, changes=0;
  const input = {...inputEvents, id:'native-menu',checked:false,
    setAttribute:(name,value)=>attributes.set(name,value),focus:()=>focuses++,
    dispatchEvent:event=>inputEvents.emit(event.type,event),
    nextElementSibling:{matches:selector=>selector==='.brz-menu-simple__icon',getAttribute:()=> 'native-menu'}};
  input.addEventListener('change',()=>changes++);
  const menu = {...menuEvents,querySelector:()=>input,closest:()=>null};
  const header = {querySelector:selector=>selector==='.brz-menu-simple'?menu:null,classList:tokens()};
  const document = {...handlers(),readyState:'loading',body:{matches:s=>s==='.ctstyle-enabled,.ctstyle-footer-only'},
    querySelector:()=>null,querySelectorAll:s=>s==='.ctstyle-header,.ctstyle-native-header'?[header]:[],getElementById:()=>null};
  const window = {...handlers(),location:new URL('https://calorietoken.net/index.php/whitepaper/'),
    CalorieTokenDiscovery:{page:1210,copy},Event:class {constructor(type){this.type=type;}}};
  vm.runInNewContext(source('refinements.js'),{window,document,URL});document.emit('DOMContentLoaded');
  window.CalorieTokenRefinements.refresh('nl');window.CalorieTokenRefinements.refresh('nl');
  assert.equal(attributes.get('aria-label'),'Hoofdnavigatie');assert.equal(attributes.get('aria-expanded'),'false');
  input.checked=true;input.emit('change');assert.equal(attributes.get('aria-expanded'),'true');
  let prevented=false;menu.emit('keydown',{key:'Escape',preventDefault:()=>prevented=true});
  assert.equal(input.checked,false);assert.equal(attributes.get('aria-expanded'),'false');
  assert.equal(prevented,true);assert.equal(changes,2);assert.equal(focuses,1);
  menu.emit('keydown',{key:'Escape',preventDefault:()=>assert.fail('Already closed menu must not intercept Escape')});
});
