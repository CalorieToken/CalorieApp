import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../../wordpress-plugins/calorieapp-identity-bridge/', import.meta.url);
const source = readFileSync(new URL('assets/calorieapp-page-ending.js', root), 'utf8');
const operator = 'Operator: ICTHendrikse · KVK 73774693';
const copyright = '© 2026 ICTHendrikse (owned content only) · CalorieToken® trade mark: Pieter Hendrikse';
const privacy = 'https://calorietoken.net/index.php/privacy-policy/';
const terms = 'https://calorietoken.net/index.php/terms-conditions/';

// Small DOM tree fixture, independent of footer policy. It models structural
// selection/movement only; real layout is checked with the browser fixture.
class Element {
  constructor(tag = 'div', attrs = {}, text = '') {
    this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.text = text;
    this.children = []; this.parentNode = null; this.nodeType = 1; this.hidden = false;
    this.classList = { contains: name => (this.attrs.class || '').split(/\s+/).includes(name),
      add: name => { if (!this.classList.contains(name)) this.attrs.class = ((this.attrs.class || '') + ' ' + name).trim(); } };
  }
  get parentElement() { return this.parentNode; }
  get nextElementSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null; }
  get textContent() { return this.text + this.children.map(c => c.textContent).join(''); }
  set textContent(value) { this.text = value; this.children = []; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key] ?? null; }
  hasAttribute(key) { return key in this.attrs; }
  removeAttribute(key) { delete this.attrs[key]; }
  appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
  insertBefore(child, reference) {
    child.remove(); const index = this.children.indexOf(reference);
    assert.notEqual(index, -1); this.children.splice(index, 0, child); child.parentNode = this;
  }
  remove() {
    if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
  contains(node) { return node === this || this.children.some(c => c.contains(node)); }
  matches(selector) {
    return selector.split(',').some(part => {
      const pieces = part.trim().split(/\s+/), last = pieces.pop();
      const simple = (node, token) => {
        if (!node) return false;
        if (token.startsWith('.')) return node.classList.contains(token.slice(1));
        const attr = token.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
        return attr ? node.hasAttribute(attr[1]) && (!attr[2] || node.getAttribute(attr[1]) === attr[2]) : node.tagName.toLowerCase() === token;
      };
      if (!simple(this, last)) return false;
      let parent = this.parentNode;
      for (const ancestor of pieces.reverse()) {
        while (parent && !simple(parent, ancestor)) parent = parent.parentNode;
        if (!parent) return false;
        parent = parent.parentNode;
      }
      return true;
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  cloneNode(deep) {
    const copy = new Element(this.tagName, this.attrs, this.text); copy.hidden = this.hidden;
    if (deep) this.children.forEach(child => copy.appendChild(child.cloneNode(true)));
    return copy;
  }
}

function harness({ legacy = true, edit = '', extraTag = '', extraHref = '', editor = false, market = false, mixed = false, marketInForm = false } = {}) {
  const body = new Element('body', { class: editor ? 'brz brz-ed' : 'brz' });
  const content = body.appendChild(new Element('section', { class: 'brz-section' }));
  const team = content.appendChild(new Element('article', {}, 'Existing team information'));
  const account = content.appendChild(new Element('div', { class: 'xl-card' }, 'Existing account'));
  const host = content.appendChild(new Element('div', { class: 'brz-wp-shortcode' }));
  const oldMarket = market ? host.appendChild(new Element('div', { 'data-calorieapp-xpmarket-widget': '1' })) : null;
  if (mixed) host.appendChild(account);
  if (marketInForm) content.appendChild(new Element('form')).appendChild(host);
  const original = legacy ? body.appendChild(new Element('section', { class: 'brz-section' })) : null;
  if (original) {
    original.appendChild(new Element('p', {}, operator));
    original.appendChild(new Element('p', {}, copyright));
    original.appendChild(new Element('p', {}, 'Privacy Policy'));
    original.appendChild(new Element('p', {}, 'Terms & Conditions'));
    original.appendChild(new Element('a', { href: 'https://x.com/CalorieToken' }));
    if (edit) original.appendChild(new Element('p', {}, edit));
    if (extraTag) original.appendChild(new Element(extraTag));
    if (extraHref) original.appendChild(new Element('a', { href: extraHref }));
  }
  const ending = body.appendChild(new Element('div', { 'data-calorieapp-shared-page-ending': '' }));
  const info = ending.appendChild(new Element('aside', { 'data-calorieapp-app-info': '' }, 'CalorieApp information'));
  const marketArea = ending.appendChild(new Element('aside', { 'data-calorieapp-sitewide-market': '' }));
  marketArea.appendChild(new Element('div', { 'data-calorieapp-xpmarket-widget': '1' }));
  const footer = ending.appendChild(new Element('footer', { class: 'calorieapp-shared-footer' })); footer.hidden = true;
  footer.appendChild(new Element('a', { href: privacy }, 'Privacy Policy'));
  footer.appendChild(new Element('a', { href: terms }, 'Terms & Conditions'));
  footer.appendChild(new Element('a', { href: 'https://x.com/CalorieToken' }, 'X'));
  const document = { body, readyState: 'complete', querySelector: s => body.querySelector(s), querySelectorAll: s => body.querySelectorAll(s) };
  const handlers = {}, calls = [];
  let observe;
  const window = { calorieappPageEnding: {}, addEventListener: (name, fn) => { handlers[name] = fn; },
    MutationObserver: class { constructor(fn) { observe = fn; } observe() {} },
    requestAnimationFrame: fn => fn(),
    fetch: (...args) => { calls.push(args); throw new Error('No remote request in page furniture'); } };
  vm.runInNewContext(source, { document, window, URL, Intl });
  return { body, content, team, account, host, oldMarket, original, ending, info, marketArea, footer, calls,
    event(name) { handlers[name]?.(); }, mutation(record) { observe([record]); } };
}

test('reviewed usecase/legal footer becomes one shared footer with working legal links', () => {
  const h = harness();
  assert.equal(h.original.hidden, true);
  assert.equal(h.footer.hidden, false);
  assert.equal(h.ending.nextElementSibling, h.original);
  assert.deepEqual(h.footer.querySelectorAll('a').slice(0, 2).map(a => a.getAttribute('href')), [privacy, terms]);
  assert.equal(h.team.textContent, 'Existing team information');
  assert.equal(h.account.parentNode, h.content);
  assert.equal(h.calls.length, 0);
});

test('new CMS copy, destinations, forms and other interactive content keep their original footer', () => {
  for (const options of [{ edit: 'New approved footer wording' }, { extraHref: 'https://example.test/new-link' },
    ...['form', 'input', 'iframe', 'img', 'button', 'select', 'textarea'].map(extraTag => ({ extraTag }))]) {
    const h = harness(options);
    assert.equal(h.original.hidden, false, JSON.stringify(options));
    assert.equal(h.footer.hidden, true, 'Do not add a competing footer to an unrecognized one.');
  }
});

test('an existing dedicated market card moves out of the team section without moving team or account content', () => {
  const h = harness({ market: true });
  assert.equal(h.oldMarket.parentNode, h.marketArea);
  assert.equal(h.host.hidden, true);
  assert.equal(h.team.parentNode, h.content);
  assert.equal(h.account.parentNode, h.content);
  assert.equal(h.content.hidden, false);
  assert.equal(h.marketArea.querySelectorAll('[data-calorieapp-xpmarket-widget]').length, 1);
  for (const event of ['load', 'pageshow', 'load']) h.event(event);
  assert.equal(h.body.querySelectorAll('[data-calorieapp-shared-page-ending]').length, 1);
  assert.equal(h.marketArea.querySelectorAll('[data-calorieapp-xpmarket-widget]').length, 1);
  assert.equal(h.oldMarket.parentNode, h.marketArea);
  assert.equal(h.calls.length, 0);
});

test('a mixed market/account shortcode keeps its content and does not gain a duplicate market card', () => {
  const h = harness({ market: true, mixed: true });
  assert.equal(h.oldMarket.parentNode, h.host);
  assert.equal(h.account.parentNode, h.host);
  assert.equal(h.host.hidden, false);
  assert.equal(h.marketArea.hidden, true);
});

test('a market inside a donation form is not relocated or replaced', () => {
  const h = harness({ market: true, marketInForm: true });
  assert.equal(h.oldMarket.parentNode, h.host);
  assert.equal(h.host.parentNode.tagName, 'FORM');
  assert.equal(h.host.hidden, false);
  assert.equal(h.marketArea.hidden, true);
  assert.equal(h.calls.length, 0);
});

test('pages without a legacy footer receive the shared fallback; editor content is untouched', () => {
  const plain = harness({ legacy: false });
  assert.equal(plain.footer.hidden, false);
  const editor = harness({ editor: true, market: true });
  assert.equal(editor.ending.hidden, true);
  assert.equal(editor.original.hidden, false);
  assert.equal(editor.oldMarket.parentNode, editor.host);
});

test('a later CMS correction restores a previously matched footer instead of concealing new content', () => {
  const h = harness();
  const form = h.original.appendChild(new Element('form', {}, 'New contact form'));
  h.mutation({ target: h.original, addedNodes: [form] });
  assert.equal(h.original.hidden, false);
  assert.equal(h.original.hasAttribute('data-calorieapp-legacy-footer'), false);
  assert.equal(h.footer.hidden, true);
  assert.equal(form.parentNode, h.original);
});

test('informational copy covers the existing eleven locales without advertising unreleased sources or payments', () => {
  const copy = JSON.parse(readFileSync(new URL('config/app-information.json', root), 'utf8'));
  const locales = JSON.parse(readFileSync(new URL('config/locales.json', root), 'utf8')).locales.map(locale => locale.tag);
  assert.deepEqual(Object.keys(copy), locales);
  for (const row of Object.values(copy)) {
    assert.deepEqual(Object.keys(row), ['description', 'action', 'on_page']);
    for (const value of Object.values(row)) {
      assert.equal(typeof value, 'string'); assert.ok(value.trim());
      assert.doesNotMatch(value, /<|https?:|USDA|DEX|Testnet|faucet|AMM/);
    }
  }
});
