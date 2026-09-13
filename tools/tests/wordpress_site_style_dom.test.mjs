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
function fixture(html, {page = 1210, route = 'whitepaper', home = false, nativeObservers = false} = {}) {
  const {document, window: dom} = parseHTML(`<html lang="en"><head></head><body class="${home ? 'home ctstyle-footer-only' : 'ctstyle-enabled'} page-id-${page}">${html}</body></html>`);
  const observers = [], frames = [], events = new Map(), observerOverflow = [];
  class Observer {
    constructor(callback) {
      this.callback = callback; observers.push(this); this.deliveries = 0;
      if (nativeObservers) this.native = new dom.MutationObserver(records => {
        // Bound a broken feedback loop so the regression fails without hanging
        // the test runner. Production must settle well before this limit.
        if (++this.deliveries > 30) {observerOverflow.push(this);this.disconnect();return;}
        callback(records);
      });
    }
    observe(target, options) { this.target = target; this.options = options; this.active = true; this.native?.observe(target,options); }
    disconnect() { this.active = false; this.native?.disconnect(); }
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
    CalorieTokenSiteStyle: {calLogo:'https://calorietoken.net/wp-content/uploads/2021/12/C-Logotranspa-1024x936.png'},
    localStorage: {getItem: () => null, setItem() {}},
    getComputedStyle: node => ({display: node.style.display || 'block', visibility: node.style.visibility || 'visible', backgroundImage: node.style.backgroundImage || '', opacity: node.style.opacity || '1'}),
    requestAnimationFrame: fn => frames.push(fn),
    addEventListener(name, fn) { events.set(name, [...events.get(name) || [], fn]); },
    removeEventListener(name, fn) { events.set(name, (events.get(name) || []).filter(item => item !== fn)); },
    dispatchEvent(event) { for (const fn of events.get(event.type) || []) fn(event); },
  };
  const context = {window, document, URL, Event: dom.Event, MutationObserver: Observer, navigator: {}};
  return {document, window, observers, frames, observerOverflow,
    run(name) { vm.runInNewContext(source(name), context); document.dispatchEvent(new dom.Event('DOMContentLoaded')); },
    emit(name) { for (const fn of events.get(name) || []) fn(); },
    mutate(record) { for (const o of [...observers]) if (o.active && o.options.childList) o.callback([{type: 'childList', addedNodes: [], removedNodes: [], ...record}]); },
    flush() { let budget = 20; while (frames.length && budget--) frames.shift()(); assert.equal(frames.length, 0, 'Observers must settle without a refresh loop'); },
  };
}
const account = '<div class="xl-card"><div class="xl-card-header">Public account placeholder</div><div class="xl-card-body"><button id="native-login">Sign in</button></div><div class="xl-card-footer">Sign-in note</div></div>';
const footer = '<footer class="ctstyle-footer"><p class="ctstyle-legal-links"><a href="https://calorietoken.net/index.php/privacy-policy/">Privacy Policy</a></p></footer>';
const native = `<section class="brz-section ctstyle-header"><div class="brz-section__content ctstyle-header-content"><div class="brz-row"><div class="brz-columns"><div class="brz-column__items"><img src="/C-Logotranspa.png"></div></div><div class="brz-columns"><div class="brz-column__items"><div class="brz-menu-simple"><div class="brz-menu-simple__toggle"><input class="brz-input" type="checkbox" id="native-menu"><label class="brz-menu-simple__icon" for="native-menu"><span class="brz-menu-simple__icon--bars"></span></label><div><a id="whitepaper" href="https://calorietoken.net/index.php/whitepaper/">Whitepaper</a></div></div></div></div></div><div class="brz-columns"><div class="brz-column__items">${account}</div></div></div></div></section>`;

function sharedFooterFixture({hub = true, custom = false} = {}) {
  const base = 'https://calorietoken.net/index.php/';
  const urls = ['https://t.me/+7YxaKdQYWNA0NDA0','https://github.com/CalorieToken','https://x.com/CalorieToken',
    'https://www.facebook.com/CalorieToken-100422882407878','https://www.youtube.com/channel/UCV_87rxST-cQOVu4W8nFZkA',
    'https://www.linkedin.com/company/calorie-token/','https://www.instagram.com/calorietoken/'];
  const social = urls.map((url,i)=>`<a class="calorieapp-shared-social" href="${url}">Channel ${i}</a>`).join('');
  const privacy = `<a id="original-privacy" href="${base}privacy-policy/">Privacy Policy</a>`;
  const terms = `<a href="${base}terms-conditions/">Terms &amp; Conditions</a>`;
  const hubLink = hub ? `<a href="${base}community-voting-hub-info/">Community Voting Hub</a>` : '';
  const shared = `<footer class="calorieapp-shared-footer"><nav class="calorieapp-shared-socials" data-calorieapp-social-carousel>
    <button id="original-carousel" type="button">Next</button>${social}</nav><div class="calorieapp-shared-legal">
    <p>Calorie aims to be the world’s food token</p><p>Operator: ICTHendrikse · KVK 73774693</p>
    <p>© 2026 ICTHendrikse (owned content only) · CalorieToken® trade mark: Pieter Hendrikse</p>
    <p class="calorieapp-shared-legal-links">${privacy}${terms}${custom ? '<a href="/custom-policy/">Custom policy</a>' : ''}</p></div></footer>`;
  const fallback = `<template id="ctstyle-footer-template"><footer class="ctstyle-footer">${social}
    <p class="ctstyle-legal-links">${privacy.replace('id="original-privacy"','')}${terms}${hubLink}</p></footer></template>`;
  const h = fixture(shared + fallback, {page:7880,route:'calorieapp'});
  h.window.CalorieTokenSiteStyle = {};
  return h;
}

test('The installed bridge footer keeps legal links and working cookie access without adding the public hub', () => {
  const h = sharedFooterFixture();
  const original = h.document.querySelector('footer');
  const privacy = h.document.querySelector('#original-privacy'), carousel = h.document.querySelector('#original-carousel');
  let clicks = 0; carousel.addEventListener('click',()=>clicks++);
  h.run('style.js'); h.run('refinements.js');
  assert.equal(h.document.querySelector('footer'),original);
  assert.equal(h.document.querySelector('#original-privacy'),privacy);
  const links = original.querySelector('.ctstyle-legal-links');
  assert.ok(links, 'The adopted bridge legal row participates in Site Style footer controls');
  assert.equal(links.querySelectorAll('a').length,3);
  assert.equal(links.querySelectorAll('a[href$="community-voting-hub-info/"]').length,0);
  assert.equal(links.querySelectorAll('a.ctstyle-footer-cookies').length,1);
  h.run('style.js');
  for(const locale of Object.keys(copy))h.window.CalorieTokenRefinements.refresh(locale);
  assert.equal(links.querySelectorAll('a').length,3);
  assert.equal(links.querySelectorAll('button').length,0);
  assert.equal(h.document.querySelectorAll('.calorieapp-shared-social').length,7);
  carousel.dispatchEvent(new h.window.Event('click'));
  assert.equal(clicks,1,'The bridge retains ownership of the existing carousel');
});

test('An adopted footer does not invent a hub URL when WordPress has no published hub', () => {
  const h = sharedFooterFixture({hub:false});
  h.run('style.js'); h.run('refinements.js');
  const footer = h.document.querySelector('footer');
  assert.equal(footer.querySelectorAll('.calorieapp-shared-legal-links a').length,3);
  assert.equal(footer.querySelectorAll('a.ctstyle-footer-cookies').length,1);
});

test('An unfamiliar customized bridge footer is retained without adding or hiding controls', () => {
  const h = sharedFooterFixture({custom:true});
  const footer = h.document.querySelector('footer'), before = footer.outerHTML;
  h.run('style.js'); h.run('refinements.js');
  assert.equal(h.document.querySelector('footer'),footer);
  assert.equal(footer.outerHTML,before);
});

test('Footer cookie access opens native preferences, avoids re-toggling them, and retains a script-free destination',()=>{
  const h=sharedFooterFixture({hub:false});
  h.run('style.js');h.run('refinements.js');
  const link=h.document.querySelector('.ctstyle-footer-cookies');
  assert.equal(link.getAttribute('href'),'https://calorietoken.net/cookie-policy-eu/');
  const fallback=new h.window.Event('click',{bubbles:true,cancelable:true});link.dispatchEvent(fallback);
  assert.equal(fallback.defaultPrevented,false,'Without the CMP, the real cookie policy link still works');
  const box=h.document.createElement('div');
  box.innerHTML='<div id="cmplz-manage-consent"><button class="cmplz-manage-consent">Manage consent</button></div><div class="cmplz-cookiebanner"><button class="cmplz-view-preferences">View preferences</button><input type="checkbox" checked></div>';
  h.document.body.append(box);
  const banner=box.querySelector('.cmplz-cookiebanner'),choice=box.querySelector('input');
  let shown=0,preferences=0;
  h.window.cmplz_set_banner_status=status=>{assert.equal(status,'show');shown++;banner.classList.add('cmplz-show');};
  box.querySelector('.cmplz-manage-consent').addEventListener('click',()=>h.window.cmplz_set_banner_status('show'));
  box.querySelector('.cmplz-view-preferences').addEventListener('click',()=>{preferences++;banner.classList.add('cmplz-categories-visible');});
  for(let i=0;i<2;i++){
    const event=new h.window.Event('click',{bubbles:true,cancelable:true});link.dispatchEvent(event);h.flush();
    assert.equal(event.defaultPrevented,true);assert.ok(banner.classList.contains('cmplz-show'));
  }
  assert.equal(shown,2);assert.equal(preferences,1,'An open preferences panel must not be toggled shut');
  assert.equal(box.querySelector('input'),choice);assert.ok(choice.hasAttribute('checked'),'Opening preferences leaves consent choices untouched');
  h.window.cmplz_set_banner_status=()=>{throw Error('CMP initialization pending');};
  const pending=new h.window.Event('click',{bubbles:true,cancelable:true});link.dispatchEvent(pending);
  assert.equal(pending.defaultPrevented,false,'An uninitialized CMP must not leave the footer link inert');
});

const blogPanelMarkup = '<div class="brz-wp-shortcode" data-brz-custom-id="amfuxnhsfmkknesyuldlbdorcvqsardaetus"><a class="twitter-timeline" href="https://x.com/CalorieToken">Tweets by CalorieToken</a></div>';
function blogFixture({permitted = true, cmsFrame = false, nativeObservers = false} = {}) {
  const h = fixture(blogPanelMarkup, {page:1207,route:'blog',nativeObservers});
  h.window.CalorieTokenSiteStyleMenu = structuredClone(menu);
  const calls = [], pending = [], timers = new Map(); let sequence = 0;
  h.window.cmplz_has_service_consent = () => permitted;
  h.window.setTimeout = (fn, delay) => {const id=++sequence;timers.set(id,{fn,delay});return id;};
  h.window.clearTimeout = id => timers.delete(id);
  h.window.twttr = {widgets:{load(panel) {
    calls.push(panel); return new Promise((resolve,reject) => pending.push({resolve,reject}));
  }}};
  function frame(panel) {
    const node = h.document.createElement('iframe');
    node.src = 'https://syndication.twitter.com/srv/timeline-profile/screen-name/CalorieToken';
    // These dimensions only exercise provider-state logic, never visual layout.
    node.getBoundingClientRect = () => ({width:600,height:520});
    panel.append(node); return node;
  }
  const first = h.document.querySelector('.brz-wp-shortcode');
  if (cmsFrame) {first.replaceChildren();frame(first);}
  return {...h,calls,pending,timers,first,frame,
    consent(value) {permitted=value;h.document.dispatchEvent(new h.window.Event(value?'cmplz_status_change':'cmplz_revoke'));},
    inspect(panel) {for(const o of h.observers)if(o.active&&o.target===panel)o.callback([]);},
    replace() {
      const holder=h.document.createElement('div');holder.innerHTML=blogPanelMarkup;
      const next=holder.firstElementChild;h.document.querySelector('.brz-wp-shortcode').replaceWith(next);return next;
    },
  };
}

test('Blog fallback and cookie controls work on both public URL forms in every locale', () => {
  for (const route of ['/index.php/blog/','/blog/']) {
    const h=blogFixture({permitted:false});h.window.location=new URL('https://calorietoken.net'+route);
    h.run('menu-pages.js');
    assert.equal(h.document.querySelectorAll('.calorieapp-x-help').length,1,route);
    for (const tag of Object.keys(menu.blog.copy)) {
      h.window.CalorieAppBlogX.setLocale(tag);
      assert.equal(h.document.querySelector('.calorieapp-x-fallback').textContent,menu.blog.copy[tag].action);
      assert.equal(h.document.querySelector('.calorieapp-x-help').lang,tag);
    }
  }
});

test('X consent controls one render and removes managed output even when it arrives late', async () => {
  const h=blogFixture({permitted:false});h.run('blog-timeline.js');assert.equal(h.calls.length,0);
  h.consent(true);h.window.CalorieTokenBlogTimeline.refresh();assert.equal(h.calls.length,1);
  const rendered=h.frame(h.first);h.inspect(h.first);assert.equal(h.first.classList.contains('ctstyle-x-ready'),true);
  h.consent(false);assert.equal(rendered.isConnected,false);assert.equal(h.first.classList.contains('ctstyle-x-ready'),false);
  const late=h.frame(h.first);h.inspect(h.first);assert.equal(late.isConnected,false);
  h.pending[0].resolve();await Promise.resolve();assert.equal(h.calls.length,1);
  h.consent(true);assert.equal(h.calls.length,2);
});

test('Manual X retry is bounded, respects consent and preserves a CMS-owned frame', () => {
  const h=blogFixture();h.run('blog-timeline.js');assert.equal(h.calls.length,1);
  h.window.CalorieTokenBlogTimeline.retry();assert.equal(h.calls.length,2);
  h.window.CalorieTokenBlogTimeline.retry();assert.equal(h.calls.length,2);
  h.consent(false);h.window.CalorieTokenBlogTimeline.retry();assert.equal(h.calls.length,2);
  const cms=blogFixture({cmsFrame:true}), frame=cms.first.querySelector('iframe');
  cms.run('blog-timeline.js');cms.window.CalorieTokenBlogTimeline.retry();
  assert.equal(frame.isConnected,true);assert.equal(cms.calls.length,0);
});

test('A replaced Blog panel receives one fresh timeline and retires the old observer', () => {
  const h=blogFixture();h.run('blog-timeline.js');h.frame(h.first);h.inspect(h.first);
  const replacement=h.replace();h.window.CalorieTokenBlogTimeline.refresh();
  assert.equal(h.calls.length,2);assert.equal(h.calls[0],h.first);assert.equal(h.calls[1],replacement);
  assert.equal(h.observers.filter(o=>o.active&&o.target===h.first).length,0);
  assert.equal(h.observers.filter(o=>o.active&&o.target===replacement).length,1);
  h.window.CalorieTokenBlogTimeline.refresh();assert.equal(h.calls.length,2);
});

test('Old X completions cannot stop a newer panel or its consent cleanup', async () => {
  const h=blogFixture();h.run('blog-timeline.js');
  const replacement=h.replace();h.window.CalorieTokenBlogTimeline.refresh();
  h.pending[0].reject(new Error('Old provider request failed'));await Promise.resolve();
  assert.equal(h.observers.filter(o=>o.active&&o.target===replacement).length,1);
  const rendered=h.frame(replacement);h.inspect(replacement);
  assert.equal(replacement.classList.contains('ctstyle-x-ready'),true);
  h.consent(false);assert.equal(rendered.isConnected,false);
});

test('CMS-owned X frames survive panel changes while readiness follows the new panel', () => {
  const h=blogFixture({cmsFrame:true}), original=h.first.querySelector('iframe');h.run('blog-timeline.js');
  const replacement=h.replace();replacement.replaceChildren();const current=h.frame(replacement);
  h.window.CalorieTokenBlogTimeline.refresh();
  assert.equal(h.calls.length,0);assert.equal(original.parentElement,h.first);
  assert.equal(h.observers.filter(o=>o.active&&o.target===replacement).length,1);
  current.hidden=true;h.inspect(replacement);assert.equal(replacement.classList.contains('ctstyle-x-ready'),false);
  h.consent(false);assert.equal(current.isConnected,true,'The CMP retains ownership of pre-existing frames');
});

test('A replaced X anchor can be enabled again after the shared SDK loaded once', () => {
  const h=blogFixture(), provider=h.window.twttr;delete h.window.twttr;
  h.run('blog-timeline.js');
  const scripts=h.document.querySelectorAll('script[data-ctstyle-x-script]');assert.equal(scripts.length,1);
  h.window.twttr=provider;scripts[0].dispatchEvent(new h.window.Event('load'));assert.equal(h.calls.length,1);
  const replacement=h.replace();h.window.CalorieTokenBlogTimeline.refresh();assert.equal(h.calls.length,2);
  h.consent(false);h.consent(true);assert.equal(h.calls.length,3);
  assert.equal(h.calls[2],replacement);assert.equal(h.document.querySelectorAll('script[data-ctstyle-x-script]').length,1);
});

test('Rejected X rendering retains consent cleanup and invalid panels retire active work', async () => {
  const h=blogFixture();h.run('blog-timeline.js');
  h.pending[0].reject(new Error('Provider render failed'));await Promise.resolve();
  assert.equal(h.first.classList.contains('ctstyle-x-loading'),false);
  assert.equal(h.observers.filter(o=>o.active&&o.target===h.first).length,1);
  h.consent(false);const late=h.frame(h.first);h.inspect(h.first);assert.equal(late.isConnected,false);
  h.consent(true);h.first.remove();h.window.CalorieTokenBlogTimeline.refresh();
  assert.equal(h.observers.filter(o=>o.active).length,0);
  assert.equal([...h.timers.values()].filter(t=>t.delay===12000).length,0);
  h.pending[1].resolve();await Promise.resolve();assert.equal(h.calls.length,2);
});

test('X readiness and translated cookie controls settle without a DOM observer feedback loop', async () => {
  const h=blogFixture({cmsFrame:true,nativeObservers:true});
  try {
    h.run('menu-pages.js');h.run('blog-timeline.js');
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(h.observerOverflow.length,0,'Visible X state must not repeatedly rewrite the same hidden attributes');
    assert.equal(h.first.classList.contains('ctstyle-x-ready'),true);
    assert.equal(h.first.querySelector('.calorieapp-x-description').hidden,true);
    const deliveries=h.observers.reduce((sum,o)=>sum+o.deliveries,0);
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(h.observers.reduce((sum,o)=>sum+o.deliveries,0),deliveries,'The real DOM mutation queue settles');
    h.consent(false);await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(h.first.classList.contains('ctstyle-x-ready'),false);
    assert.equal(h.first.querySelector('.calorieapp-x-description').hidden,false);
    assert.equal(h.observerOverflow.length,0);
  } finally {h.observers.forEach(o=>o.disconnect());}
});

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

const trustlineContext = '<aside class="calorieapp-context-note" id="calorieapp-trustline-context"><strong>Before you continue</strong><p>A CAL trustline belongs to your XRPL wallet. Check the issuer and currency code in the request before signing. Food search and nutrition information in CalorieApp do not require a CAL trustline.</p><a href="https://www.xrptoolkit.com/">Open XRP Toolkit</a></aside>';
function trustlineFixture(note = trustlineContext) {
  return fixture('<div data-brz-custom-id="nrsbytvlhdquaddotxqmaeiihmzfbcufpmhr"><p>rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY</p><p>43616C6F72696500000000000000000000000000</p>' + note + '</div>', {page:1205,route:'trustline'});
}

test('The live legacy Trustline note is reused once through language changes and restored on cleanup', () => {
  const h = trustlineFixture(), note = h.document.querySelector('aside'), link = note.querySelector('a');
  const original = note.outerHTML; let clicks = 0; link.addEventListener('click', () => clicks++);
  h.run('menu-pages.js');
  assert.equal(h.document.querySelectorAll('#calorieapp-trustline-context').length, 1);
  assert.equal(h.document.querySelectorAll('aside.calorieapp-context-note').length, 1);
  for (const tag of Object.keys(menu.trustline.translations)) {
    h.window.CalorieAppTrustline.setLocale(tag);
    assert.equal(note.querySelector('p').textContent, menu.trustline.translations[tag].context);
    assert.equal(note.querySelector('a'), link);
  }
  link.click(); assert.equal(clicks, 1);
  note.parentElement.querySelector('p').textContent = 'Custom issuer text';
  h.window.CalorieAppTrustline.refresh();
  assert.equal(note.outerHTML, original, 'Retire only managed changes, preserving the original CMS node');
});

test('Custom Trustline notes and edits stay intact without duplicate identifiers', () => {
  const h = trustlineFixture(trustlineContext.replace('Before you continue', 'Custom instruction'));
  const custom = h.document.querySelector('aside'), original = custom.outerHTML;
  h.run('menu-pages.js');
  h.window.CalorieAppTrustline.setLocale('nl');
  assert.equal(custom.outerHTML, original);
  const ids = [...h.document.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length);
  const h2 = trustlineFixture(), originalNote = h2.document.querySelector('aside');
  h2.run('menu-pages.js'); h2.window.CalorieAppTrustline.setLocale('nl');
  originalNote.querySelector('p').textContent = 'New custom CMS wording';
  h2.window.CalorieAppTrustline.refresh();
  assert.equal(originalNote.querySelector('p').textContent, 'New custom CMS wording');
  const h3=trustlineFixture(), note3=h3.document.querySelector('aside');
  h3.run('menu-pages.js');
  note3.querySelector('p').innerHTML='<em>Custom editorial emphasis</em>';
  h3.window.CalorieAppTrustline.setLocale('nl');
  assert.equal(note3.querySelector('p').innerHTML,'<em>Custom editorial emphasis</em>');
});

function bottomFixture() {
  const h = fixture('<nav data-calorieapp-fallback-shortcuts><a class="calorieapp-page-tool" data-calorieapp-scroll="bottom" href="#">Bottom</a></nav>', {page:1090,home:true});
  h.window.CalorieAppPageNavigation = {};
  let next = 0; const timers = new Map(), scrolls = [];
  h.window.setTimeout = (fn, delay) => {const id=++next;timers.set(id,{fn,delay});return id;};
  h.window.clearTimeout = id => timers.delete(id);
  h.window.scrollTo = options => scrolls.push(options);
  h.window.matchMedia = () => ({matches:false});
  h.document.documentElement.scrollHeight = 2000; h.document.body.scrollHeight = 2000;
  h.run('navigation.js');
  return {...h,timers,scrolls,click:()=>h.document.querySelector('a').click(),
    grow(value){h.document.documentElement.scrollHeight=value;h.document.body.scrollHeight=value;},
    advance(delay){for(const[id,t]of [...timers])if(t.delay<=delay){timers.delete(id);t.fn();}},
  };
}

test('Explicit bottom navigation follows late page growth for a bounded time only', () => {
  const h=bottomFixture();h.click();h.advance(300);assert.equal(h.scrolls.length,0);
  h.grow(2600);h.advance(800);assert.deepEqual(h.scrolls.map(s=>s.top),[2600]);
  h.advance(2000);assert.equal(h.timers.size,0);
  h.grow(3200);h.emit('pageshow');assert.equal(h.scrolls.length,1);
});

test('Manual interaction or leaving the page cancels late bottom adjustments', () => {
  for(const event of ['wheel','touchstart','pointerdown','keydown','pagehide']) {
    const h=bottomFixture();h.click();h.grow(2600);h.emit(event);h.advance(2000);
    assert.equal(h.scrolls.length,0,event);assert.equal(h.timers.size,0,event);
  }
  const h=bottomFixture();h.click();h.click();h.grow(2600);h.advance(2000);
  assert.equal(h.scrolls.length,1,'Repeated clicks leave one active request');
});

function nativeShortcuts() {
  return '<nav class="calorieapp-page-tools" data-calorieapp-fallback-shortcuts>' + ['home','app','bottom','top'].map(role =>
    `<div class="calorieapp-page-tool-position" data-calorieapp-shortcut="${role}"><a class="calorieapp-page-tool" href="${role==='home'?'https://calorietoken.net/':role==='app'?'https://calorietoken.net/index.php/calorieapp/':'#'}" ${['top','bottom'].includes(role)?`data-calorieapp-scroll="${role}"`:''}>${role}</a></div>`
  ).join('') + '</nav>';
}

test('CAL shortcut recognizes the installed bridge DOM without relying on its controller name', () => {
  for (const home of [false,true]) {
    const h=fixture(nativeShortcuts(),{home});
    const originals=[...h.document.querySelectorAll('[data-calorieapp-shortcut]')];
    let clicks=0; originals[2].querySelector('a').addEventListener('click',()=>clicks++);
    h.run('navigation.js'); h.emit('load'); h.emit('pageshow');
    h.document.dispatchEvent(new h.window.CustomEvent('calorietoken:display-language',{detail:{locale:'nl'}}));
    const added=h.document.querySelector('[data-ctstyle-exchange-shortcut]');
    assert.ok(added); assert.equal(added.hidden,false);
    assert.equal(h.document.querySelectorAll('[data-ctstyle-exchange-shortcut]').length,1);
    assert.equal(h.document.querySelectorAll('[data-calorieapp-shortcut]').length,4);
    assert.equal(added.querySelector('a').href,'https://calorietoken.net/index.php/how-to-buy-calorie/');
    assert.equal(added.querySelector('a').getAttribute('aria-label'),'CAL & Crypto');
    assert.equal(added.querySelector('img').src,h.window.CalorieTokenSiteStyle.calLogo);
    assert.equal(added.querySelector('img').getAttribute('aria-hidden'),'true');
    assert.equal(h.window.CalorieAppPageNavigation,undefined,'No replacement bridge controller');
    originals.forEach(n=>assert.ok(n.isConnected));
    // Native button event handlers are still installed on the same nodes.
    originals[2].querySelector('a').dispatchEvent(new h.window.Event('click'));
    assert.equal(clicks,1);
  }
});

test('CAL shortcut handles delayed native initialization and hides on its own page', () => {
  const h=fixture('',{page:4205,route:'how-to-buy-calorie'});
  h.window.CalorieAppPageNavigation={}; h.run('navigation.js');
  h.document.body.insertAdjacentHTML('beforeend',nativeShortcuts());h.emit('load');
  const added=h.document.querySelector('[data-ctstyle-exchange-shortcut]');
  assert.ok(added);assert.equal(added.hidden,true);
  h.emit('pageshow');assert.equal(h.document.querySelectorAll('[data-ctstyle-exchange-shortcut]').length,1);
});

test('CAL shortcut leaves incomplete, edited, duplicate and embedded native stacks alone', () => {
  const broken=[nativeShortcuts().replace('data-calorieapp-shortcut="top"','data-calorieapp-shortcut="unknown"'),
    nativeShortcuts().replace('https://calorietoken.net/index.php/calorieapp/','https://example.com/'),
    nativeShortcuts()+nativeShortcuts(),'<form>'+nativeShortcuts()+'</form>',
    '<div data-calorieapp-embed>'+nativeShortcuts()+'</div>'];
  for(const html of broken){const h=fixture(html);const before=h.document.body.innerHTML;h.run('navigation.js');h.emit('load');
    assert.equal(h.document.querySelectorAll('[data-ctstyle-exchange-shortcut]').length,0);
    assert.equal(h.document.body.innerHTML,before);}
});

test('CAL shortcut uses the same logo in the standalone fallback without duplicating native slots', () => {
  const config='<span data-ctstyle-site-integration data-home-page="https://calorietoken.net/" data-app-page="https://calorietoken.net/index.php/calorieapp/" data-app-logo="https://calorietoken.net/app.svg"></span>';
  const h=fixture(config+nativeShortcuts());
  h.window.innerHeight=800;h.document.documentElement.scrollHeight=h.document.body.scrollHeight=2000;
  h.run('navigation.js');h.emit('load');h.flush();
  const added=h.document.querySelector('[data-calorieapp-shortcut="exchange"]');
  assert.ok(added);assert.equal(added.querySelector('img').src,h.window.CalorieTokenSiteStyle.calLogo);
  assert.equal(h.document.querySelectorAll('[data-calorieapp-shortcut]').length,5);
  assert.equal(h.document.querySelectorAll('[data-ctstyle-exchange-shortcut]').length,0);
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
  h.window.CalorieTokenPresentation={copy:JSON.parse(readFileSync(new URL('presentation-data.json',assets),'utf8')),links:[]};
  h.run('presentation.js');
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
    const routes=[...h.document.querySelectorAll('.ctstyle-discovery-tabs a')];
    assert.deepEqual(routes.map(a=>a.getAttribute('href')),['#ctstyle-own-dex','#'+guide.id,'#ctstyle-external-exchange']);
    routes.forEach((a,index)=>{
      const key=['routeTrade','routeLearn','routeOther'][index];
      assert.equal(a.querySelector('strong').textContent,copy[locale][key]);
      assert.equal(a.querySelector('.ctstyle-crypto-route-description').textContent,copy[locale][key+'Text']);
      assert.ok(h.document.querySelector(a.getAttribute('href')));
    });
    assert.ok(h.document.querySelector('.ctstyle-crypto-intro').textContent.includes(copy[locale].appWithoutCAL));
    const toggles=[...h.document.querySelectorAll('.ctstyle-crypto-route-toggle')];
    assert.equal(toggles.length,3);
    toggles.forEach((toggle,index)=>{
      const key=['routeTrade','routeLearn','routeOther'][index];
      assert.equal(toggle.querySelector('strong').textContent,copy[locale][key]);
      assert.equal(toggle.querySelector('.ctstyle-crypto-route-description').textContent,copy[locale][key+'Text']);
      assert.ok(h.document.getElementById(toggle.getAttribute('aria-controls')));
    });
  }
  const toggle=h.document.querySelector('#ctstyle-external-exchange .ctstyle-crypto-route-toggle');
  const frame=h.document.createElement('iframe');frame.setAttribute('src','https://example.test/provider-fixture');
  h.document.querySelector('#ctstyle-swft-frame').append(frame);
  toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');
  toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'false');
  assert.equal(h.document.querySelector('iframe'),frame,'Collapsing must retain an existing provider frame');
  assert.equal(frame.getAttribute('src'),'https://example.test/provider-fixture');
  const learn=h.document.querySelector('.ctstyle-discovery-tabs a[href="#'+guide.id+'"]');
  learn.click();assert.equal(guide.closest('.ctstyle-crypto-route-panel').querySelector('button').getAttribute('aria-expanded'),'true');
  h.window.location.hash='#ctstyle-buy-trustline';h.emit('hashchange');
  assert.equal(h.document.querySelector('#ctstyle-own-dex .ctstyle-crypto-route-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(guide.querySelectorAll('button').length,0,'Keep controls outside the protected guide translator');
});


test('Home token copy and legal footer translate in every offered language and restore native formatting',()=>{
 const catalogue=JSON.parse(source('content-data.json'));
 const token=catalogue.entries.find(e=>e.source.startsWith('$CAL is the Calorie token issued'));
 const operator=catalogue.entries.find(e=>e.source==='Operator: ICTHendrikse · KVK 73774693');
 const copyright=catalogue.entries.find(e=>e.source.startsWith('© {year} ICTHendrikse'));
 assert.ok(token);assert.ok(operator);assert.ok(copyright);
 const originalCopyright=copyright.source.replace('{year}','2027');
 const h=fixture('<div class="brz-rich-text"><p id="token"><strong>'+token.source+'</strong></p></div><footer><div class="ctstyle-legal"><p id="operator">'+operator.source+'</p><p id="copyright">'+originalCopyright+'</p></div></footer>',{home:true,page:1090});
 const strong=h.document.querySelector('#token strong');
 h.window.CalorieTokenContentLanguage={locales:['en',...Object.keys(token.translations)],entries:catalogue.entries};
 h.run('content-language.js');
 for(const tag of Object.keys(token.translations)){
  h.window.CalorieTokenContentLanguageUI.refresh(tag);
  assert.equal(h.document.querySelector('#token').textContent,token.translations[tag]);
  assert.equal(h.document.querySelector('#operator').textContent,operator.translations[tag]);
  assert.equal(h.document.querySelector('#copyright').textContent,copyright.translations[tag].replace('{year}','2027'));
 }
 h.window.CalorieTokenContentLanguageUI.refresh('en');
 assert.equal(h.document.querySelector('#token strong'),strong);
 assert.equal(h.document.querySelector('#copyright').textContent,originalCopyright);
});


test('All six usecase descriptions follow the language event with page-scoped copy and preserve their links',()=>{
 const catalogue=JSON.parse(source('content-data.json'));
 const label=catalogue.entries.find(row=>row.source==='Future use concept');
 const action=catalogue.entries.find(row=>row.source==='Open CalorieApp');
 for(const note of menu.usecases){
  const h=fixture('<section data-brz-custom-id="'+note.element+'"><img id="usecase-art" src="/original-usecase.png" alt="Original illustration"></section>',{page:note.page,route:'delivery'});
  h.window.CalorieTokenContentLanguage={locales:Object.keys(copy),entries:catalogue.entries.filter(row=>row.pages.includes('*')||row.pages.includes(note.page))};
  h.run('menu-pages.js');h.run('content-language.js');
  const panel=h.document.getElementById(note.key),link=panel.querySelector('a'),art=h.document.querySelector('#usecase-art');
  const href=link.getAttribute('href'),row=catalogue.entries.find(entry=>entry.source===note.text);
  assert.ok(row,'The generated description must be in the catalogue for page '+note.page);
  for(const locale of [...Object.keys(copy),'en']){
   h.document.dispatchEvent(new h.window.CustomEvent('calorietoken:display-language',{detail:{locale}}));
   h.window.CalorieTokenMenuPages.refresh();
   assert.equal(panel.querySelector('p').textContent,locale==='en'?note.text:row.translations[locale]);
   assert.equal(panel.querySelector('strong').textContent,locale==='en'?label.source:label.translations[locale]);
   assert.equal(link.textContent,locale==='en'?action.source:action.translations[locale]);
   if(locale!=='en')assert.equal(panel.querySelector('p').getAttribute('dir'),['ar','ur'].includes(locale)?'rtl':'ltr');
   assert.equal(panel.querySelector('a'),link);assert.equal(link.getAttribute('href'),href);
   assert.equal(h.document.querySelector('#usecase-art'),art);
   assert.equal(h.document.querySelectorAll('#'+note.key).length,1);
  }
 }
});

test('Hidden legacy mastheads do not suppress the shared header or clone native account controls',()=>{
  const headerTemplate='<template id="ctstyle-header-template"><header class="ctstyle-header ctstyle-header-fallback"><nav><a href="/">Home</a></nav><div class="ctstyle-header-account" hidden></div></header></template>';
  const h=fixture('<header id="masthead" class="site-header" style="display:none"></header><main><div class="entry-content"><div class="calorie-legacy-page"><section><h1>Our buying guide has moved</h1><p>Existing notice.</p></section></div></div></main>'+headerTemplate+'<div id="ctstyle-native-account-source" hidden>'+account+'</div>',{page:4606,route:'integrated-exchange'});
  const card=h.document.querySelector('.xl-card');
  const button=h.document.querySelector('#native-login');
  let clicks=0;button.addEventListener('click',()=>clicks++);
  h.run('style.js');
  assert.equal(h.document.querySelectorAll('.ctstyle-header-fallback').length,1);
  assert.equal(h.document.querySelector('.ctstyle-header-account .xl-card'),card);
  assert.equal(h.document.querySelectorAll('.xl-card').length,1);
  assert.equal(h.document.querySelector('#ctstyle-native-account-source').hidden,false);
  button.click();assert.equal(clicks,1);
  h.emit('load');h.flush();
  assert.equal(h.document.querySelectorAll('.ctstyle-header-fallback').length,1);
  assert.equal(h.document.querySelector('.calorie-legacy-page h1').textContent,'Our buying guide has moved');
});

test('Tokenomics refresh and language changes retain one decorated title and the original artwork',()=>{
 const h=fixture('<section data-brz-custom-id="rmpolgctfmggclsdfezbyrgrptsoksmyibth"><div class="brz-container"><div class="chart"><div data-brz-custom-id="dqvixegjsqsgfpehzvyzdhvvjusglgsaioai"><img title="Tokenomics update 2024 10" src="/chart.png"></div></div><div data-brz-custom-id="qzyfxcwgwvmqaychwaxfgllbvrxwptqijdnb"><a href="/original-wallet">Existing wallet</a></div></div></section>',{page:1209,route:'tokenomics-update'});
 const graphic=h.document.querySelector('img'),original=h.document.querySelector('a');
 h.window.CalorieTokenPresentation={copy:JSON.parse(readFileSync(new URL('presentation-data.json',assets),'utf8')),links:[]};
 h.run('tokenomics.js');h.run('presentation.js');
 for(const locale of [...Object.keys(menu.tokenomics.copy),'en','en','nl','en']){
  h.window.CalorieAppTokenomics.setLocale(locale);h.window.CalorieTokenPresentationUI.refresh(locale);h.window.CalorieAppTokenomics.refresh();
  assert.equal(h.document.querySelector('#calorieapp-tokenomics-status-title').textContent,menu.tokenomics.copy[locale].statusTitle);
  assert.equal(h.document.querySelector('#calorieapp-consolidation-wallet-title').textContent,menu.tokenomics.copy[locale].walletTitle);
 }
 assert.equal(h.document.querySelectorAll('.calorieapp-tokenomics-note').length,2);
 assert.equal(h.document.querySelector('img'),graphic);assert.ok(original.isConnected);
});
