import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';
import { catalogue, locales, fixture, Node, fromShape, shape, all, createFaqDom } from '../fixtures/step3/faq-language-model.mjs';

const require = createRequire(import.meta.url);
const preview = require('../../contracts/display-language/v1/cms-preview.js');
const runtime = require('../../contracts/display-language/v1/runtime.js');
function harness({ enabled = true, configure, ...options } = {}) {
  const h = createFaqDom(options);
  h.config = structuredClone(catalogue); configure?.(h.config);
  h.store = runtime.createStore({ locales: locales.map(item => item.tag), fallback: 'en', initialLocale: 'en' });
  h.choose = locale => h.store.select(locale);
  h.preview = preview.connect({ enabled, document: h.document, location: h.location, catalogue: h.config, store: h.store });
  return h;
}

test('catalogue pins two observed paragraphs and all eleven translations to one unpublished copy version', () => {
  const root = fromShape(fixture[0]);
  assert.equal(catalogue.wordpress_id, 6855);
  assert.equal(catalogue.release_approved, false);
  assert.equal(catalogue.source_copy_review, 'prepared-unreviewed');
  for (const slot of catalogue.slots) {
    const node = root.querySelector(`p[data-uniq-id="${slot.element_id}"]`);
    assert.deepEqual(shape(node), slot.source);
    assert.equal(createHash('sha256').update(JSON.stringify(slot.source)).digest('hex'), slot.source_sha256);
  }
  assert.deepEqual(Object.keys(catalogue.translations).sort(), locales.map(item => item.tag).sort());
  for (const locale of locales) {
    const copy = catalogue.translations[locale.tag];
    assert.equal(copy.copy_version, catalogue.copy_version);
    assert.equal(copy.review_status, 'prepared-unreviewed');
    assert.equal(copy.direction, locale.direction);
    assert.equal(copy.slots.question.length, 12);
    assert.equal(copy.slots.answer.length, 1);
    assert.ok(copy.slots.question.join('').includes('CalorieToken'));
    assert.ok(copy.slots.answer[0].includes('CalorieApp'));
    assert.ok(copy.slots.answer[0].includes('XRP Ledger'));
  }
  assert.match(catalogue.translations.en.slots.answer[0], /currently offers food lookup and a personal food log/);
  assert.match(catalogue.translations.en.slots.answer[0], /planned extensions/);
});

test('all eleven store choices preserve original element/text identities, styling and native control state', () => {
  const h = harness();
  const click = h.submit.onclick, post = h.form.onsubmit, session = h.account.session;
  for (const locale of locales) {
    h.choose(locale.tag);
    assert.deepEqual(h.preview.get(), { status: 'preview', locale: locale.tag });
    assert.deepEqual(h.roots.flatMap(all), h.originalNodes);
    h.roots.forEach((root, index) => {
      const slot = catalogue.slots[index];
      assert.equal(root.textContent, catalogue.translations[locale.tag].slots[slot.key].join(''));
      assert.equal(root.getAttribute('lang'), locale.tag); assert.equal(root.getAttribute('dir'), locale.direction);
      for (const [key, value] of slot.source.attributes) assert.equal(root.getAttribute(key), value);
      root.childNodes.forEach((child, childIndex) => assert.deepEqual(shape(child).attributes, slot.source.children[childIndex].attributes));
    });
    assert.deepEqual(shape(h.controls), h.controlsBefore);
    assert.equal(h.amount.value, '1.25'); assert.equal(h.quantity.value, '2');
    assert.equal(h.submit.onclick, click); assert.equal(h.form.onsubmit, post);
    assert.equal(h.account.session, session); assert.equal(session.locale, 'en');
    assert.equal(h.consent.checked, false); assert.equal(h.submissions, 0);
    assert.equal(h.location.href, catalogue.source_url); assert.equal(h.page.getAttribute('lang'), 'en-US');
  }
  h.preview.disconnect();
  assert.deepEqual(shape(h.body), h.before);
  h.choose('ar'); assert.deepEqual(shape(h.body), h.before);
  h.preview.disconnect(); assert.deepEqual(shape(h.body), h.before);
});

test('disabled preview, other routes, unknown query context and editor make no changes', () => {
  const cases = [
    { enabled: false }, { url: 'https://example.com/index.php/faq/' },
    { url: 'https://calorietoken.net/index.php/terms-conditions/' },
    { url: 'https://calorietoken.net/index.php/faq/?preview=true' },
    { url: 'https://calorietoken.net/index.php/faq/?locale=nl' },
    { mutate: h => h.body.setAttribute('class', 'brz page-id-1121') },
    { mutate: h => h.body.setAttribute('class', 'brz brz-ed page-id-6855') },
  ];
  for (const options of cases) {
    const h = harness(options); h.choose('nl'); h.preview.refresh();
    assert.deepEqual(shape(h.body), h.before); assert.equal(h.submissions, 0);
    assert.notEqual(h.preview.get().status, 'preview');
  }
  assert.equal(harness({ url: 'https://www.calorietoken.net/index.php/faq/?ui_lang=nl' }).preview.get().status, 'preview');
});

test('edited source text, formatting, duplicate IDs and protected ancestors reject the entire pair', () => {
  const changes = [
    h => { h.roots[1].childNodes[0].childNodes[0].data = 'Changed CMS wording'; },
    h => h.roots[0].childNodes[0].setAttribute('style', 'color: red'),
    h => h.roots[0].appendChild(new Node('a', { href: '/private' })),
    h => h.roots[0].parentElement.appendChild(fromShape(catalogue.slots[0].source)),
    h => h.form.appendChild(h.wrappers[0]),
    h => h.account.appendChild(h.wrappers[0]),
    h => h.consent.appendChild(h.wrappers[0]),
    h => h.wrappers[0].setAttribute('contenteditable', 'false'),
  ];
  for (const mutate of changes) {
    const h = harness({ mutate }); h.choose('nl');
    assert.equal(h.preview.get().status, 'source-pending');
    assert.deepEqual(shape(h.body), h.before);
  }
});

test('missing, stale, incomplete or misdirected translation restores source without partial application', () => {
  for (const corrupt of [
    config => { delete config.translations.nl; },
    config => { config.translations.nl.copy_version = 'older-copy'; },
    config => { config.translations.nl.slots.answer = []; },
    config => { config.translations.nl.slots = null; },
    config => { config.translations.nl.direction = 'rtl'; },
    config => { config.translations.nl.slots.question[2] = {}; },
  ]) {
    const h = harness({ configure: corrupt });
    assert.equal(h.preview.get().status, 'preview'); h.choose('nl');
    assert.equal(h.preview.get().status, 'translation-pending');
    assert.deepEqual(shape(h.body), h.before);
    h.choose('ar'); assert.equal(h.preview.get().locale, 'ar');
  }
});

test('an external edit after translation is preserved, and untouched companion text restores to source', () => {
  const h = harness(); h.choose('nl');
  h.roots[1].childNodes[0].childNodes[0].data = 'New CMS edit: keep this';
  const edited = shape(h.roots[1]);
  h.choose('ar');
  assert.equal(h.preview.get().status, 'source-changed');
  assert.deepEqual(shape(h.roots[1]), edited);
  assert.deepEqual(shape(h.roots[0]), catalogue.slots[0].source);
  h.choose('fr'); h.preview.refresh(); h.preview.disconnect();
  assert.deepEqual(shape(h.roots[1]), edited);
});

test('replaced, duplicated or form-moved nodes stop the adapter without editing the replacement', () => {
  for (const mode of ['replace', 'duplicate', 'form']) {
    const h = harness(); h.choose('nl');
    const parent = h.roots[0].parentElement;
    let replacement;
    if (mode === 'form') replacement = h.form.appendChild(h.wrappers[0]);
    else {
      replacement = parent.appendChild(fromShape(shape(h.roots[0])));
      if (mode === 'replace') h.roots[0].remove();
    }
    const before = shape(replacement);
    h.choose('ar'); assert.equal(h.preview.get().status, 'source-changed');
    assert.deepEqual(shape(replacement), before);
  }
});

test('translation characters are written literally to retained text nodes, never interpreted as HTML', () => {
  const literal = '<img src=x onerror=alert(1)> {locale} & CalorieApp';
  const h = harness({ configure: config => { config.translations.nl.slots.answer = [literal]; } });
  h.choose('nl'); assert.equal(h.roots[1].textContent, literal);
  assert.equal(h.roots[1].querySelectorAll('img').length, 0);
  assert.deepEqual(h.roots.flatMap(all), h.originalNodes);
});

test('late known content can be explicitly refreshed, with no polling or source replacement', () => {
  let detached;
  const h = harness({ mutate: h => { detached = h.wrappers[0]; detached.remove(); } });
  assert.equal(h.preview.get().status, 'source-pending');
  h.choose('ar'); h.body.appendChild(detached); h.preview.refresh();
  assert.deepEqual(h.preview.get(), { status: 'preview', locale: 'ar' });
  h.location.href = 'https://calorietoken.net/index.php/checkout/'; h.preview.refresh();
  assert.equal(h.preview.get().status, 'outside-scope');
  h.roots.forEach((node, index) => assert.deepEqual(shape(node), catalogue.slots[index].source));
});

test('invalid catalogue is inert and cannot be enabled by mutating options after connection', () => {
  for (const configure of [
    config => { config.mode = 'production'; }, config => { config.slots[0].element_id = undefined; },
    config => { config.slots[1].element_id = config.slots[0].element_id; },
    config => { config.slots[0].source.tag = 'form'; }, config => { config.copy_version = ''; },
  ]) {
    const h = harness({ configure }); assert.equal(h.preview.get().status, 'invalid-catalogue');
    h.choose('nl'); h.preview.refresh(); assert.deepEqual(shape(h.body), h.before);
  }
  const h = harness({ enabled: false });
  const options = { enabled: false, document: h.document, location: h.location, catalogue: null, store: h.store };
  const inert = preview.connect(options); options.enabled = true;
  assert.equal(inert.refresh().status, 'disabled'); assert.deepEqual(shape(h.body), h.before);
});
