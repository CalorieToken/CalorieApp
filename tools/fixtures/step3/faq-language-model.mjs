import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const catalogue = JSON.parse(readFileSync(new URL('../../../contracts/display-language/v1/cms-faq-preview.json', import.meta.url)));
const locales = JSON.parse(readFileSync(new URL('../../../contracts/identity-bridge/v1/locales.json', import.meta.url))).locales;
const html = readFileSync(new URL('./faq-mission-source.html', import.meta.url), 'utf8');

// Parse the observed HTML independently with the standard-library HTML parser.
// The node model below tests identities/text/attributes, not browser layout or
// native WooCommerce submission. No dependency or browser substitute is added.
const fixture = JSON.parse(execFileSync('python3', ['-c', `
from html.parser import HTMLParser
import json,sys
class Parser(HTMLParser):
 def __init__(self): super().__init__(convert_charrefs=True); self.root=[]; self.stack=[]
 def handle_starttag(self,tag,attrs):
  node={'tag':tag,'attributes':sorted([[k,v or ''] for k,v in attrs]),'children':[]}
  (self.stack[-1]['children'] if self.stack else self.root).append(node)
  self.stack.append(node)
 def handle_endtag(self,tag):
  assert self.stack[-1]['tag']==tag
  self.stack.pop()
 def handle_data(self,data):
  if self.stack:self.stack[-1]['children'].append(data)
p=Parser();p.feed(sys.stdin.read());print(json.dumps(p.root))
`], { input: html, encoding: 'utf8' }));

class Node {
  constructor(tag, attributes = {}, data = '') {
    this.nodeType = tag === '#text' ? 3 : 1;
    this.tagName = tag.toUpperCase(); this.attrs = { ...attributes }; this.data = data;
    this.childNodes = []; this.parentNode = null;
    this.classList = { contains: value => (this.attrs.class || '').split(/\s+/).includes(value) };
  }
  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get attributes() { return Object.entries(this.attrs).map(([name, value]) => ({ name, value })); }
  get isConnected() { return this.parentNode?.nodeType === 9 || this.parentNode?.isConnected || false; }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map(node => node.textContent).join(''); }
  // The adapter must use existing Text.data, never replacement markup/subtrees.
  set textContent(_) { throw new Error('Subtree replacement is not allowed'); }
  set innerHTML(_) { throw new Error('HTML injection is not allowed'); }
  set outerHTML(_) { throw new Error('Element replacement is not allowed'); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  appendChild(node) { node.remove(); node.parentNode = this; this.childNodes.push(node); return node; }
  remove() {
    if (this.parentNode) this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1);
    this.parentNode = null;
  }
  matches(selector) {
    if (this.nodeType !== 1) return false;
    return selector.split(',').some(value => {
      value = value.trim();
      if (value.startsWith('.')) return this.classList.contains(value.slice(1));
      if (value.startsWith('#')) return this.getAttribute('id') === value.slice(1);
      const attribute = value.match(/^([a-z]+)?\[([^=\]]+)(?:="([^"]*)")?\]$/);
      if (attribute) return (!attribute[1] || this.tagName.toLowerCase() === attribute[1])
        && this.getAttribute(attribute[2]) !== null
        && (attribute[3] === undefined || this.getAttribute(attribute[2]) === attribute[3]);
      return this.tagName.toLowerCase() === value;
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) {
    return this.childNodes.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
function fromShape(shape) {
  if (typeof shape === 'string') return new Node('#text', {}, shape);
  const node = new Node(shape.tag, Object.fromEntries(shape.attributes));
  for (const child of shape.children) node.appendChild(fromShape(child));
  return node;
}
function shape(node) {
  return node.nodeType === 3 ? node.data : {
    tag: node.tagName.toLowerCase(), attributes: Object.entries(node.attrs).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
    children: node.childNodes.map(shape),
  };
}
function all(node) { return [node, ...node.childNodes.flatMap(all)]; }
function createFaqDom({ url = catalogue.source_url, mutate } = {}) {
  const document = { nodeType: 9, childNodes: [] };
  const page = new Node('html', { lang: 'en-US', dir: 'ltr' });
  page.parentNode = document; document.childNodes.push(page);
  const body = page.appendChild(new Node('body', { class: 'brz page-id-6855' }));
  document.body = body; document.querySelectorAll = query => page.querySelectorAll(query);
  document.querySelector = query => page.querySelector(query);
  for (const item of fixture) body.appendChild(fromShape(item));
  const roots = catalogue.slots.map(slot => document.querySelector(`p[data-uniq-id="${slot.element_id}"]`));
  const wrappers = all(body).filter(node => node.tagName === 'DIV');
  const controls = body.appendChild(new Node('aside'));
  const link = controls.appendChild(new Node('a', { href: '/index.php/trustline/', target: '_self' }));
  link.appendChild(new Node('#text', {}, 'Original link'));
  const form = controls.appendChild(new Node('form', { method: 'post', action: '/index.php/product/donation/' }));
  const amount = form.appendChild(new Node('input', { name: 'wcj_open_price', value: '0.01' })); amount.value = '1.25';
  const quantity = form.appendChild(new Node('input', { name: 'quantity', value: '1' })); quantity.value = '2';
  form.appendChild(new Node('input', { name: 'add-to-cart', value: '1761' }));
  const submit = form.appendChild(new Node('button', { type: 'submit' }));
  let submissions = 0; submit.onclick = () => { submissions++; }; form.onsubmit = () => { submissions++; };
  const account = controls.appendChild(new Node('div', { class: 'xl-card', 'data-locale': 'en' }));
  account.session = { id: 'synthetic-session', locale: 'en' };
  account.logout = () => { throw new Error('Translation must not log out'); };
  const consent = controls.appendChild(new Node('div', { class: 'cmplz-cookiebanner' }));
  consent.checked = false;
  const legal = controls.appendChild(new Node('p', { lang: 'en', 'data-legal-version': 'unchanged' }));
  legal.appendChild(new Node('#text', {}, 'Existing legal notice'));
  const location = { href: url };
  const h = { document, page, body, roots, wrappers, controls, link, form, amount, quantity, submit, account, consent, legal, location,
    get submissions() { return submissions; } };
  mutate?.(h);
  h.before = shape(body); h.controlsBefore = shape(controls);
  h.originalNodes = roots.flatMap(all);
  return h;
}

export { catalogue, locales, fixture, Node, fromShape, shape, all, createFaqDom };
