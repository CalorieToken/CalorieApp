import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { Node, shape, locales } from "../fixtures/step3/faq-language-model.mjs";

const base = new URL("../../wordpress-plugins/calorieapp-identity-bridge/", import.meta.url);
const script = readFileSync(new URL("assets/calorieapp-site-polish.js", base), "utf8");
const catalogue = JSON.parse(readFileSync(new URL("config/trustline.json", base)));
const block = "nrsbytvlhdquaddotxqmaeiihmzfbcufpmhr";
const issuer = "rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY";
const currency = "43616C6F72696500000000000000000000000000";
const settle = () => new Promise(resolve => setImmediate(resolve));

// Full production script, synthetic DOM/clipboard and queued mutations.
// No browser layout, WordPress service, wallet payload or signature is executed.
function harness({ ready = true, publicPage = true, page = 1205,
  url = "https://calorietoken.net/index.php/trustline/", late = false,
  write, configure, protect } = {}) {
  const observers = [], events = new Map(), copies = [];
  function emit(record) {
    for (const observer of observers) {
      if (!observer.target?.contains(record.target)) continue;
      if (record.type === "attributes" && !observer.options.attributeFilter.includes(record.attributeName)) continue;
      observer.records.push(record);
    }
  }
  class Element extends Node {
    constructor(...args) {
      super(...args);
      this.dataset = {};
      this.classList.add = name => {
        if (!this.classList.contains(name)) this.setAttribute("class", ((this.getAttribute("class") || "") + " " + name).trim());
      };
      this.classList.remove = name => {
        const result = (this.getAttribute("class") || "").split(/\s+/).filter(x => x !== name).join(" ");
        if (result) this.setAttribute("class", result); else this.removeAttribute("class");
      };
    }
    get data() { return this._data; }
    set data(value) { const old = this._data; this._data = value; if (old !== undefined && old !== value) emit({ type: "characterData", target: this }); }
    get textContent() { return super.textContent; }
    set textContent(value) { for (const child of [...this.childNodes]) child.remove(); if (value) this.appendChild(new Element("#text", {}, String(value))); }
    setAttribute(name, value) { const old = this.getAttribute(name); super.setAttribute(name, value); if (old !== String(value)) emit({ type: "attributes", target: this, attributeName: name }); }
    removeAttribute(name) { const old = this.getAttribute(name); super.removeAttribute(name); if (old !== null) emit({ type: "attributes", target: this, attributeName: name }); }
    appendChild(node) { super.appendChild(node); emit({ type: "childList", target: this, addedNodes: [node], removedNodes: [] }); return node; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    insertBefore(node, reference) {
      if (!reference) return this.appendChild(node);
      node.remove(); const index = this.childNodes.indexOf(reference); assert.ok(index >= 0);
      this.childNodes.splice(index, 0, node); node.parentNode = this;
      emit({ type: "childList", target: this, addedNodes: [node], removedNodes: [] }); return node;
    }
    after(node) { this.parentNode.insertBefore(node, this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) + 1]); }
    remove() { const parent = this.parentNode; super.remove(); if (parent) emit({ type: "childList", target: parent, addedNodes: [], removedNodes: [this] }); }
    contains(node) { return node === this || this.childNodes.some(child => child.contains(node)); }
    addEventListener(type, callback) { this.events ||= new Map(); if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(callback); }
    click() { const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; for (const callback of this.events?.get("click") || []) callback(event); return event; }
  }
  for (const key of ["id", "className", "href", "type", "lang", "dir", "target"]) {
    const attribute = key === "className" ? "class" : key;
    Object.defineProperty(Element.prototype, key, { get() { return this.getAttribute(attribute) || ""; }, set(value) { this.setAttribute(attribute, value); } });
  }
  const make = (tag, attrs = {}, text) => { const node = new Element(tag, attrs); if (text !== undefined) node.appendChild(new Element("#text", {}, text)); return node; };
  const document = { nodeType: 9, readyState: "complete" }, html = make("html", { lang: "en", dir: "ltr" });
  html.parentNode = document;
  const body = html.appendChild(make("body", { class: "brz page-id-" + page })); document.body = body;
  const slot = body.appendChild(make("section"));
  function sourceBlock() {
    const root = make("div", { "data-brz-custom-id": block, lang: "en", dir: "ltr" });
    const paragraphs = [issuer, currency].map(value => {
      const p = root.appendChild(make("p")); p.appendChild(make("span", {}, value)); return p;
    });
    return { root, paragraphs };
  }
  const original = sourceBlock(); if (!late) slot.appendChild(original.root);
  const alternatives = slot.appendChild(make("nav"));
  alternatives.appendChild(make("a", { href: "https://xrpl.services/?issuer=" + issuer + "&currency=" + currency + "&limit=99994396006.88306" }, "Existing Xaman alternative"));
  alternatives.appendChild(make("a", { href: "https://www.xrptoolkit.com/" }, "Existing Toolkit alternative"));
  const controls = body.appendChild(make("aside"));
  controls.appendChild(make("div", { class: "xl-card", "data-session-locale": "en" }, "Existing account"));
  controls.appendChild(make("input", { name: "amount", value: "1.25" }));
  controls.appendChild(make("div", { "data-consent": "denied" }, "Existing consent"));
  const alternativesBefore = shape(alternatives), controlsBefore = shape(controls);
  const textBefore = original.paragraphs.map(p => p.childNodes.map(shape));
  const config = { locales, trustline: structuredClone(catalogue) }; configure?.(config);
  document.querySelectorAll = selector => html.querySelectorAll(selector);
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  document.getElementById = id => document.querySelector('[id="' + id + '"]');
  document.createElement = tag => { assert.ok(!["script", "iframe"].includes(tag)); return make(tag); };
  document.addEventListener = () => {};
  const window = { location: new URL(url), calorieappSitePolish: { trustlineReady: ready, trustlinePage: publicPage },
    calorieappDisplayLanguageConfig: config,
    addEventListener(type, callback) { if (!events.has(type)) events.set(type, []); events.get(type).push(callback); },
    dispatchEvent(event) { for (const callback of events.get(event.type) || []) callback(event); },
    fetch() { throw Error("No service call"); }, setInterval() { throw Error("No polling"); }, setTimeout() { throw Error("No timers"); } };
  const navigator = { clipboard: { writeText(value) { copies.push(value); return write ? write(value) : Promise.resolve(); } } };
  protect?.({ ...original, slot, body, make });
  const context = vm.createContext({ window, document, navigator, URL, Event,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.records = []; observers.push(this); }
      observe(target, options) { this.target = target; this.options = options; }
      disconnect() { this.target = null; this.records = []; }
    } });
  function flush() {
    for (let i = 0; i < 25; i++) {
      const pending = observers.filter(observer => observer.records.length);
      if (!pending.length) return;
      for (const observer of pending) observer.callback(observer.records.splice(0));
    }
    throw Error("Mutation observer loop");
  }
  const run = () => { vm.runInContext(script, context); flush(); }; run();
  return { ...original, window, document, navigator, config, slot, make, copies, sourceBlock, run, flush,
    buttons: () => document.querySelectorAll(".calorieapp-copy-button"),
    statuses: () => document.querySelectorAll(".calorieapp-copy-status"),
    link: () => document.getElementById("calorieapp-xaman-trustline"),
    event(type) { window.dispatchEvent(new Event(type)); flush(); },
    unchanged() {
      assert.deepEqual(shape(alternatives), alternativesBefore); assert.deepEqual(shape(controls), controlsBefore);
      assert.deepEqual(original.paragraphs.map(p => p.childNodes.map(shape)), textBefore);
      assert.equal(original.root.lang, "en"); assert.equal(original.root.dir, "ltr");
      assert.equal(html.lang, "en"); assert.equal(html.dir, "ltr");
    } };
}

test("current CAL identifiers, native alternatives and strict readiness produce one accessible helper", async () => {
  for (const ready of [false, undefined, "true", 1]) {
    const h = harness({ ready: ready === undefined ? null : ready }); assert.equal(h.link(), null); assert.equal(h.buttons().length, 2);
  }
  const h = harness(); assert.equal(h.link().getAttribute("href"), "?xl-trustline"); assert.equal(h.link().click().defaultPrevented, false);
  const buttons = h.buttons(); buttons.forEach(button => button.click()); await settle(); h.flush();
  assert.deepEqual(h.copies, [issuer, currency]);
  assert.deepEqual(h.statuses().map(node => node.textContent), ["Copied issuer.", "Copied currency code."]);
  buttons.forEach(button => assert.equal(h.document.getElementById(button.getAttribute("aria-describedby")).getAttribute("role"), "status"));
  h.event("load"); h.event("pageshow"); h.run(); assert.deepEqual(h.buttons(), buttons);
  assert.equal(h.document.querySelectorAll(".calorieapp-xaman-trustline").length, 1); h.unchanged();
});

test("eleven helper locales follow pending copies without another write or changing source direction", async () => {
  assert.equal(catalogue.release_approved, false); assert.deepEqual(Object.keys(catalogue.translations), locales.map(item => item.tag));
  for (const locale of locales) {
    let resolve; const h = harness({ write: () => new Promise(done => { resolve = done; }) }), button = h.buttons()[0];
    button.click(); button.click(); assert.equal(h.copies.length, 1); assert.equal(button.disabled, true);
    assert.equal(button.getAttribute("aria-busy"), "true");
    h.window.CalorieAppTrustline.setLocale(locale.tag); h.flush();
    assert.equal(button.textContent, catalogue.translations[locale.tag].copyIssuer);
    assert.equal(button.parentElement.lang, locale.tag); assert.equal(button.parentElement.dir, locale.direction);
    resolve(); await settle(); h.flush(); assert.equal(button.disabled, false);
    assert.equal(h.statuses()[0].textContent, catalogue.translations[locale.tag].copiedIssuer);
    assert.equal(h.link().getAttribute("aria-label"), catalogue.translations[locale.tag].signLabel);
    assert.equal(h.link().getAttribute("href"), "?xl-trustline"); assert.equal(h.copies.length, 1); h.unchanged();
  }
});

test("clipboard absent, synchronous throw and rejection give manual guidance without success claims", async () => {
  for (const mode of ["missing", "throw", "reject"]) {
    const h = harness({ write: () => { if (mode === "throw") throw Error("Denied"); return Promise.reject(Error("Denied")); } });
    if (mode === "missing") delete h.navigator.clipboard;
    h.window.CalorieAppTrustline.setLocale("nl"); h.buttons().forEach(button => button.click()); await settle(); h.flush();
    assert.deepEqual(h.statuses().map(node => node.textContent), [catalogue.translations.nl.manualIssuer, catalogue.translations.nl.manualCurrency]);
    assert.ok(h.buttons().every(button => !button.disabled && button.getAttribute("aria-busy") === null)); h.unchanged();
  }
});

test("edits, duplicate identifiers and removed roots are checked at activation before mutation delivery", () => {
  for (const change of [
    h => { h.paragraphs[0].childNodes[0].childNodes[0].data = "Different issuer"; },
    h => h.root.appendChild(h.make("p", {}, issuer)), h => h.root.remove(),
    h => h.root.setAttribute("hidden", ""), h => h.root.setAttribute("data-brz-custom-id", "edited"),
  ]) {
    const h = harness(), button = h.buttons()[0], link = h.link(); change(h);
    button.click(); assert.equal(h.copies.length, 0); assert.equal(link.click().defaultPrevented, true);
    h.flush(); assert.equal(h.buttons().length, 0); assert.equal(h.link(), null);
  }
});

test("lost readiness and edited or moved signing anchors cannot navigate to stale destinations", () => {
  for (const change of [h => { h.window.calorieappSitePolish.trustlineReady = false; },
    h => { h.link().href = "https://example.invalid/foreign"; }, h => { h.link().target = "_blank"; }, h => h.slot.appendChild(h.link())]) {
    const h = harness(), old = h.link(); change(h); assert.equal(old.click().defaultPrevented, true); h.flush();
    if (h.link()) assert.equal(h.link().getAttribute("href"), "?xl-trustline");
    assert.equal(h.copies.length, 0); h.unchanged();
  }
});

test("late and replaced blocks ignore obsolete async results and resume after back/forward", async () => {
  let resolve; const h = harness({ late: true, write: () => new Promise(done => { resolve = done; }) });
  h.window.CalorieAppTrustline.setLocale("ur"); assert.equal(h.buttons().length, 0);
  h.slot.appendChild(h.root); h.flush(); assert.equal(h.buttons()[0].parentElement.lang, "ur");
  h.buttons()[0].click(); const oldStatus = h.statuses()[0];
  h.root.remove(); const replacement = h.sourceBlock(); h.slot.appendChild(replacement.root); h.flush();
  const replacementButton = h.buttons()[0]; resolve(); await settle(); h.flush();
  assert.equal(oldStatus.textContent, ""); assert.equal(h.statuses()[0].textContent, "");
  assert.equal(h.buttons()[0], replacementButton); assert.equal(h.copies.length, 1);
  h.event("pagehide"); replacement.root.remove(); h.event("pageshow"); assert.equal(h.buttons().length, 0);
  h.slot.appendChild(replacement.root); h.flush(); assert.equal(h.buttons().length, 2); h.unchanged();
});

test("other routes, editor/private contexts, forms and ambiguous blocks retain their original content", () => {
  const options = [{page: 1090}, {publicPage: false}, {publicPage: "true"}, {publicPage: 1},
    ...["http://calorietoken.net/trustline/", "https://example.invalid/trustline/", "https://calorietoken.net/index.php/contact/", "https://user@calorietoken.net/trustline/", "https://calorietoken.net/trustline/?preview=true", "https://calorietoken.net/trustline/?ui_lang[]=nl"].map(url => ({url})),
    {protect: ({body}) => body.classList.add("brz-ed")},
    ...["form", "div"].map(tag => ({protect: ({root, slot, make}) => { const parent = slot.appendChild(make(tag, tag === "div" ? {class: "xl-card"} : {})); parent.appendChild(root); }})),
    ...["hidden", "inert", "contenteditable"].map(attribute => ({protect: ({root}) => root.setAttribute(attribute, "")})),
    {protect: ({root, make}) => root.appendChild(make("form"))},
    {protect: ({slot, make}) => slot.appendChild(make("div", {"data-brz-custom-id": block}))}];
  for (const option of options) { const h = harness(option); h.event("load"); h.event("pageshow"); assert.equal(h.buttons().length, 0); assert.equal(h.link(), null); assert.equal(h.copies.length, 0); h.unchanged(); }
});

test("incomplete or unknown locale falls back as a whole and translations are literal text", () => {
  const h = harness({configure: config => { delete config.trustline.translations.nl.signLabel; config.trustline.translations.fr.copyIssuer = "<img src=x>"; }});
  for (const locale of ["nl", "unsupported"]) { h.window.CalorieAppTrustline.setLocale(locale); assert.equal(h.buttons()[0].textContent, "Copy issuer"); assert.equal(h.link().lang, "en"); }
  h.window.CalorieAppTrustline.setLocale("fr"); assert.equal(h.buttons()[0].textContent, "<img src=x>"); assert.equal(h.buttons()[0].querySelector("img"), null);
  h.config.locales = {}; h.window.CalorieAppTrustline.setLocale("fr"); assert.equal(h.buttons()[0].textContent, "Copy issuer");
  h.unchanged();
});
