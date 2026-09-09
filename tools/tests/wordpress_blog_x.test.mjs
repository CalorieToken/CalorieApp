import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createFaqDom, Node, shape, fromShape, locales } from '../fixtures/step3/faq-language-model.mjs';

const base = new URL('../../wordpress-plugins/calorieapp-identity-bridge/', import.meta.url);
const source = readFileSync(new URL('assets/calorieapp-site-polish.js', base), 'utf8');
const catalogue = JSON.parse(readFileSync(new URL('config/blog-x.json', base)));
const panelId = 'amfuxnhsfmkknesyuldlbdorcvqsardaetus';

// Bounded DOM behavior, not a browser/X/Complianz integration test. Public
// shortcode ID and profile/placeholder metadata were observed on the blog.
// Account, form and CMP states below are synthetic and do not contact a service.
function harness({ page = 1207, path = '/index.php/blog/', search = '', timeline = 'anchor', legacy = true, cmp = true, initialLocale = 'en', mutate, configure } = {}) {
  const h = createFaqDom();
  h.body.setAttribute('class', 'brz page-id-' + page);
  Object.defineProperty(h.body, 'className', { get() { return this.getAttribute('class'); } });
  const make = (tag, attrs = {}, text) => {
    const node = new Node(tag, attrs);
    node.classList.add = value => node.setAttribute('class', ((node.getAttribute('class') || '') + ' ' + value).trim());
    if (text !== undefined) node.appendChild(new Node('#text', {}, text));
    return node;
  };
  const panel = make('div', { class: 'brz-wp-shortcode', 'data-brz-custom-id': panelId }); h.body.appendChild(panel);
  const heading = make('div', { class:'brz-rich-text' }); h.body.appendChild(heading);
  heading.appendChild(make('strong', {style:'color: rgb(80, 91, 169)'}, 'X.com/T'));
  heading.appendChild(make('strong', {}, 'witter Posts'));
  const slot = make('div'); panel.appendChild(slot);
  let embed = null;
  if (timeline === 'anchor') {
    embed = make('a', { class:'cmplz-placeholder-element twitter-timeline', 'data-service':'twitter', 'data-category':'marketing', href:'https://twitter.com/CalorieToken?ref_src=twsrc%5Etfw' }, 'Tweets by CalorieToken'); slot.appendChild(embed);
  } else if (timeline === 'iframe') {
    embed = make('iframe', { class:'twitter-timeline', src:'https://syndication.twitter.com/srv/timeline-profile/screen-name/CalorieToken' }); slot.appendChild(embed);
  } else if (timeline === 'placeholder') {
    embed = make('div', { class:'cmplz-blocked-content-container', 'data-service':'twitter', 'data-category':'marketing' }); slot.appendChild(embed);
    embed.appendChild(make('button', { type:'button', class:'cmplz-blocked-content-notice' }, 'Native CMP choice'));
  }
  const old = legacy ? make('a', { class:'calorieapp-x-fallback', href:'https://x.com/CalorieToken', rel:'noopener noreferrer' }, 'View CalorieToken on X') : null;
  if (old) panel.appendChild(old);
  const events = new Map(), windowEvents = new Map(), consent = { marketing:false, twitter:false };
  const config = { publicPage:true, locales, initialLocale, copy:structuredClone(catalogue.translations) }; configure?.(config);
  const document = h.document; document.readyState = 'complete';
  document.createElement = tag => { assert.ok(!['script','iframe'].includes(tag), 'No provider loader'); return make(tag); };
  document.createTextNode = text => new Node('#text', {}, text);
  document.getElementById = id => document.querySelector('[id="' + id + '"]');
  document.addEventListener = (type, callback) => { if (!events.has(type)) events.set(type, []); events.get(type).push(callback); };
  const query = document.querySelector;
  document.querySelector = selector => selector === '#cmplz-cookiebanner-container .cmplz-cookiebanner' ? (cmp ? h.consent : null) : query(selector);
  const window = {
    location:{ origin:'https://calorietoken.net', pathname:path, search, href:'https://calorietoken.net'+path+search },
    calorieappSitePolish:{ trustlineReady:false, blog:config },
    cmplz_has_service_consent: cmp ? () => consent.twitter : undefined,
    addEventListener(type, callback) { if (!windowEvents.has(type)) windowEvents.set(type, []); windowEvents.get(type).push(callback); },
    fetch() { throw new Error('No provider request'); },
    setTimeout() { throw new Error('No timer'); }, setInterval() { throw new Error('No polling'); },
  };
  Object.assign(h, { make, panel, slot, embed, old, heading, consentState:consent, window, document }); mutate?.(h);
  h.headingBefore = shape(heading);
  h.panelBefore = shape(panel); h.slotBefore = shape(slot); h.controlsBefore = shape(h.controls);
  const context = vm.createContext({window,document,URL});
  h.run = () => vm.runInContext(source, context);
  h.run();
  h.event = (type) => [...(events.get(type) || []), ...(windowEvents.get(type) || [])].forEach(callback => callback({detail:{category:'marketing',value:'allow'}}));
  h.help = () => panel.querySelector('.calorieapp-x-help');
  return h;
}

test('one usable helper remains when the timeline, anchor or provider is absent or replaced by CMP', () => {
  for (const timeline of ['anchor','iframe','placeholder','absent']) {
    const h = harness({timeline});
    assert.ok(h.help());
    assert.equal(h.help().querySelector('.calorieapp-x-fallback'), h.old, 'Reuse the known fallback node');
    assert.equal(h.old.getAttribute('href'), 'https://x.com/CalorieToken');
    assert.deepEqual(shape(h.slot), h.slotBefore, 'Do not alter CMP/X content');
    h.event('load'); h.event('pageshow'); h.event('cmplz_revoke');
    const api = h.window.CalorieAppBlogX; h.run(); assert.equal(h.window.CalorieAppBlogX, api);
    assert.equal(h.panel.querySelectorAll('.calorieapp-x-help').length, 1);
    assert.equal(h.panel.querySelectorAll('.calorieapp-x-fallback').length, 1);
    assert.deepEqual(shape(h.slot), h.slotBefore);
  }
  assert.ok(harness({timeline:'absent',legacy:false}).help().querySelector('.calorieapp-x-fallback'));
});

test('all eleven helper locales retain destination, source widgets, private controls and consent', () => {
  assert.equal(catalogue.release_approved, false); assert.equal(catalogue.review_status, 'prepared-unreviewed');
  assert.deepEqual(Object.keys(catalogue.translations), locales.map(item => item.tag));
  const h = harness(); const submit = h.submit.onclick, session = h.account.session;
  for (const locale of locales) {
    h.window.CalorieAppBlogX.setLocale(locale.tag);
    assert.equal(h.help().getAttribute('lang'), locale.tag); assert.equal(h.help().getAttribute('dir'), locale.direction);
    assert.equal(h.help().querySelector('.calorieapp-x-description').textContent, catalogue.translations[locale.tag].description);
    assert.equal(h.old.textContent, catalogue.translations[locale.tag].action);
    assert.equal(h.old.getAttribute('href'), 'https://x.com/CalorieToken');
    assert.deepEqual(shape(h.slot), h.slotBefore); assert.deepEqual(shape(h.controls), h.controlsBefore);
    assert.deepEqual(shape(h.heading), h.headingBefore);
    assert.equal(h.amount.value, '1.25'); assert.equal(h.quantity.value, '2');
    assert.equal(h.submit.onclick, submit); assert.equal(h.account.session, session);
    assert.deepEqual(h.consentState, { marketing:false, twitter:false }); assert.equal(h.submissions, 0);
  }
});

test('native cookie settings is a non-submitting button; missing CMP leaves the direct link usable', () => {
  const h = harness(); const button = h.help().querySelector('.calorieapp-x-settings');
  assert.equal(button.getAttribute('type'), 'button'); assert.ok(button.classList.contains('cmplz-manage-consent'));
  assert.equal(button.hidden, false);
  for (const allowed of [true,false,true,false]) {
    h.consentState.twitter = allowed;
    h.event('cmplz_status_change_service'); h.event('cmplz_status_change'); h.event('cmplz_revoke');
    assert.equal(h.consentState.twitter, allowed); assert.equal(h.consentState.marketing, false);
    assert.deepEqual(shape(h.slot), h.slotBefore); assert.equal(button.hidden, false);
  }
  const missing = harness({cmp:false}); assert.equal(missing.help().querySelector('.calorieapp-x-settings').hidden, true);
  assert.ok(missing.help().querySelector('.calorieapp-x-fallback'));
  missing.window.cmplz_has_service_consent = () => false;
  missing.document.querySelector = ((original) => selector => selector === '#cmplz-cookiebanner-container .cmplz-cookiebanner' ? missing.consent : original(selector))(missing.document.querySelector);
  missing.event('cmplz_cookie_warning_loaded');
  assert.equal(missing.help().querySelector('.calorieapp-x-settings').hidden, false);
});

test('other pages, editor/preview, duplicate slots and private/form ancestors remain unchanged', () => {
  const cases = [{page:1090}, {path:'/index.php/faq/'}, {search:'?preview=true'}, {search:'?brizy-edit'},
    {configure:config => { config.publicPage = false; }}, {configure:config => { config.publicPage = 'true'; }},
    {mutate:h => h.body.setAttribute('class','brz brz-ed page-id-1207')},
    {mutate:h => h.body.appendChild(fromShape(shape(h.panel)))},
    {mutate:h => h.form.appendChild(h.panel)},
    {mutate:h => h.account.appendChild(h.panel)},
    {mutate:h => h.panel.setAttribute('contenteditable','true')},
    {mutate:h => h.panel.appendChild(h.make('input',{name:'private-value'}))},
    {mutate:h => h.old.childNodes[0].data = 'Custom source link label'},
    {mutate:h => h.old.setAttribute('href','https://example.org/custom')},
    {mutate:h => h.embed.setAttribute('href','https://x.com/AnotherAccount')},
    {mutate:h => h.embed.setAttribute('href','https://twitter.com.evil.example/CalorieToken')},
  ];
  for (const options of cases) {
    const h = harness(options); h.event('load'); h.event('cmplz_revoke');
    assert.equal(h.help(), null); assert.deepEqual(shape(h.panel), h.panelBefore);
  }
});

test('invalid/incomplete copy falls back as one English unit and literal text never becomes HTML', () => {
  const h = harness({initialLocale:'nl',configure:config => { delete config.copy.nl.settings; }});
  assert.equal(h.help().getAttribute('lang'),'en'); assert.equal(h.old.textContent,catalogue.translations.en.action);
  h.window.CalorieAppBlogX.setLocale('unknown'); assert.equal(h.help().getAttribute('lang'),'en');
  const literal = harness({initialLocale:'nl',configure:config => { config.copy.nl.description='<img src=x onerror=alert(1)>'; }});
  assert.equal(literal.help().querySelector('img'),null); assert.equal(literal.help().querySelector('.calorieapp-x-description').textContent,'<img src=x onerror=alert(1)>');
});
