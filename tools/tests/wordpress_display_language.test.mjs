import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { catalogue, createFaqDom, shape, all } from "../fixtures/step3/faq-language-model.mjs";
const require = createRequire(import.meta.url);
const runtime = require("../../contracts/display-language/v1/runtime.js");
const cmsRuntime = require("../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-cms-language-preview.js");
const base = new URL("../../wordpress-plugins/calorieapp-identity-bridge/", import.meta.url);
const script = readFileSync(new URL("assets/calorieapp-display-language.js", base), "utf8");
const locales = JSON.parse(readFileSync(new URL("config/locales.json", base))).locales;
const copy = JSON.parse(readFileSync(new URL("config/display-language.json", base)));
const information = JSON.parse(readFileSync(new URL("config/app-information.json", base)));
function harness({ editor = false, panelPresent = true, duplicatePanel = false, missingControl, duplicateControl, configure, protectedCard = false, cms = null, cmsConfig = cms ? catalogue : null, cmsAvailable = true, blog, richlist, navigation, trustline, tokenomics, buyGuide } = {}) {
  const listeners = new Map(), writes = [], fields = {};
  const stores = [], connections = [], observers = [];
  for (const key of ["label", "note", "description", "action", "current"]) fields[key] = { textContent: "" };
  const select = { value: "en", addEventListener(type, fn) { listeners.set("select:" + type, fn); } };
  const panel = { hidden: true, dataset: {}, isConnected: true, parentElement: null,
    querySelector(query) { return query === "select" ? select : query.includes("-label") ? fields.label : fields.note; },
    querySelectorAll(query) { const node = this.querySelector(query); return query === missingControl ? [] : query === duplicateControl ? [node, node] : [node]; },
    closest() { return this.parentElement === card ? card : null; },
  };
  const account = { sameLoginButton: {}, sessionLocale: "en", consent: { marketing: false } };
  const card = { account, closest() { return protectedCard ? {} : null; },
    appendChild(node) { node.parentElement = this; },
  };
  const info = { querySelector(query) {
    return query === "div > p" ? fields.description : query.endsWith("-link") ? fields.action : fields.current;
  }};
  const document = { readyState: "complete", body: cms?.body || {}, querySelector(query) {
    if (query === "[data-calorieapp-display-language]") return panelPresent ? panel : null;
    if (query === ".brz-ed") return editor ? {} : null;
    if (query === "[data-calorieapp-app-info]") return info;
    return cms?.document.querySelector(query) || null;
  }, querySelectorAll(query) {
    if (query === "[data-calorieapp-display-language]") return panelPresent ? (duplicatePanel ? [panel, panel] : [panel]) : [];
    return query === ".brz .xl-card" ? [card] : cms?.document.querySelectorAll(query) || [];
  } };
  const window = {
    CalorieAppBlogX: blog,
    CalorieAppRichlist: richlist,
    CalorieAppPageNavigation: navigation,
    CalorieAppTrustline: trustline,
    CalorieAppTokenomics: tokenomics,
    CalorieAppBuyGuide: buyGuide,
    CalorieAppDisplayLanguage: { ...runtime, createStore(options) {
      const store = runtime.createStore(options); stores.push(store); return store;
    } },
    CalorieAppCmsLanguagePreview: cmsAvailable ? { connect(options) {
      const api = cmsRuntime.connect(options); connections.push({ api, store: options.store }); return api;
    } } : undefined,
    calorieappDisplayLanguageConfig: { locales: structuredClone(locales), initialLocale: "en", copy, information, ...(cmsConfig ? { cmsPreview: cmsConfig } : {}) },
    location: cms?.location,
    localStorage: { getItem() { return null; }, setItem(key, value) { writes.push({key,value}); }, removeItem() {} },
    addEventListener(type, fn) { listeners.set(type, fn); },
  };
  configure?.(window.calorieappDisplayLanguageConfig);
  const context = vm.createContext({ window, document, MutationObserver: class {
    constructor(callback) { this.callback = callback; this.target = null; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.target = null; }
  } });
  const run = () => vm.runInContext(script, context);
  run();
  return { window, panel, select, info, fields, account, card, writes, run, stores, connections, observers,
    fire(type, event = {}) { listeners.get(type)?.(event); },
    choose(locale) { select.value = locale; listeners.get("select:change")?.(); } };
}
test("missing or duplicate owned controls keep preview hidden without creating a store", () => {
  const selectors = ["select", "[data-calorieapp-language-label]", "[data-calorieapp-language-note]"];
  for (const options of [{ duplicatePanel: true }, ...selectors.flatMap(selector => [{ missingControl: selector }, { duplicateControl: selector }])]) {
    const h = harness(options); assert.equal(h.panel.hidden, true); assert.equal(h.panel.dataset.ready, undefined);
    assert.equal(h.stores.length, 0); assert.equal(h.observers.length, 0); h.choose("nl"); assert.equal(h.writes.length, 0);
  }
});
test("malformed locale catalogues fail before initialization; valid direction is snapshotted", () => {
  for (const configure of [c => c.locales = [], c => c.locales.push(null), c => c.locales.push(c.locales[0]), c => c.locales = c.locales.filter(x => x.tag !== "en"), c => c.locales[0].direction = "invalid"]) {
    const h = harness({ configure }); assert.equal(h.panel.hidden, true); assert.equal(h.stores.length, 0);
    h.window.calorieappDisplayLanguageConfig.locales = structuredClone(locales); h.run(); assert.equal(h.stores.length, 1);
  }
  const h = harness(); h.window.calorieappDisplayLanguageConfig.locales.length = 0; h.choose("ar");
  assert.equal(h.panel.dir, "rtl"); assert.equal(h.info.dir, "rtl"); assert.equal(h.account.sessionLocale, "en");
});
test("panel observation disconnects on exit and resumes once after back-forward restoration", () => {
  const h = harness(); assert.equal(h.observers.length, 1); assert.ok(h.observers[0].target);
  const count = h.writes.length;
  h.fire("pagehide", { persisted: true }); assert.equal(h.observers[0].target, null);
  h.fire("pageshow", { persisted: true }); assert.ok(h.observers[0].target); assert.equal(h.observers.length, 1);
  h.choose("ar"); assert.equal(h.info.dir, "rtl"); assert.equal(h.writes.length, count + 1);
  h.fire("pagehide", { persisted: false }); assert.equal(h.observers[0].target, null);
});
test("website control changes only the translated information and preserves account references", () => {
  const h = harness(), account = h.account, login = account.sameLoginButton;
  assert.equal(h.panel.parentElement, h.card);
  for (const locale of locales) {
    h.choose(locale.tag);
    assert.equal(h.panel.lang, locale.tag);
    assert.equal(h.panel.dir, locale.direction);
    assert.equal(h.info.lang, locale.tag);
    assert.equal(h.fields.description.textContent, information[locale.tag].description);
    assert.equal(h.fields.action.textContent, information[locale.tag].action);
    assert.equal(h.fields.label.textContent, copy[locale.tag].label);
    assert.equal(h.card.account, account);
    assert.equal(h.account.sameLoginButton, login);
    assert.equal(h.account.sessionLocale, "en");
    assert.equal(h.account.consent.marketing, false);
  }
  assert.ok(h.writes.every(item => item.key === "calorieapp.display-language.v1"));
  const count = h.writes.length; h.run(); assert.equal(h.writes.length, count);
});
test("editor, absent preview markup and form-contained account controls remain untouched", () => {
  for (const options of [{editor:true}, {panelPresent:false}]) {
    const h = harness(options); assert.equal(h.panel.hidden,true); assert.equal(h.panel.parentElement,null);
    h.choose("nl"); assert.equal(h.writes.length,0);
  }
  const h = harness({protectedCard:true});
  assert.equal(h.panel.parentElement,null);
  h.choose("nl"); assert.equal(h.info.lang,"nl");
});

test("FAQ and existing site UI share exactly one store through all eleven choices", () => {
  const cms = createFaqDom(), h = harness({ cms });
  const session = cms.account.session, click = cms.submit.onclick, post = cms.form.onsubmit;
  assert.equal(h.stores.length, 1); assert.equal(h.connections.length, 1);
  assert.equal(h.connections[0].store, h.stores[0]);
  for (const locale of locales) {
    h.choose(locale.tag);
    assert.equal(h.info.lang, locale.tag);
    assert.equal(cms.roots[1].textContent, catalogue.translations[locale.tag].slots.answer[0]);
    assert.equal(cms.roots[1].getAttribute("dir"), locale.direction);
    assert.deepEqual(cms.roots.flatMap(all), cms.originalNodes);
    assert.deepEqual(shape(cms.controls), cms.controlsBefore);
    assert.equal(cms.amount.value, "1.25"); assert.equal(cms.quantity.value, "2");
    assert.equal(cms.account.session, session); assert.equal(session.locale, "en");
    assert.equal(cms.submit.onclick, click); assert.equal(cms.form.onsubmit, post);
    assert.equal(cms.consent.checked, false); assert.equal(cms.submissions, 0);
  }
  // The existing host protocol also applies remote choices through this store.
  h.stores[0].apply("nl", true);
  assert.equal(h.select.value, "nl"); assert.equal(cms.roots[1].getAttribute("lang"), "nl");
  h.run(); h.fire("load"); h.fire("pageshow", { persisted: true });
  assert.equal(h.stores.length, 1); assert.equal(h.connections.length, 1);
  assert.ok(h.writes.every(item => item.key === "calorieapp.display-language.v1"));
});

test("missing assets/configuration and wrong routes keep FAQ source while the ordinary control works", () => {
  for (const options of [{cmsConfig:null}, {cmsAvailable:false}, {cmsConfig:{}}, {url:"https://calorietoken.net/index.php/contact/"}]) {
    const cms = createFaqDom(options), h = harness({ cms, ...options });
    h.choose("ar"); h.fire("load"); h.fire("pageshow");
    assert.deepEqual(shape(cms.body), cms.before);
    assert.equal(h.info.lang, "ar"); assert.equal(h.panel.hidden, false);
    assert.equal(h.stores.length, 1);
  }
  for (const options of [{editor:true}, {panelPresent:false}]) {
    const cms = createFaqDom(), h = harness({ cms, ...options });
    h.choose("nl"); h.fire("pageshow");
    assert.equal(h.connections.length, 0); assert.deepEqual(shape(cms.body), cms.before);
  }
});

test("load/pageshow discovers late FAQ content without creating another connection or preference write", () => {
  for (const event of ["load", "pageshow"]) {
    let detached;
    const cms = createFaqDom({ mutate: h => { detached = h.wrappers[0]; detached.remove(); } });
    const h = harness({ cms }); h.choose("ar");
    assert.equal(h.connections[0].api.get().status, "source-pending");
    const writes = h.writes.length; cms.body.appendChild(detached); h.fire(event, { persisted: true });
    assert.equal(cms.roots[1].getAttribute("lang"), "ar");
    assert.equal(h.writes.length, writes); assert.equal(h.connections.length, 1);
  }
});

test("bfcache retains the FAQ subscription; final unload restores owned source and disconnects it", () => {
  const cms = createFaqDom(), h = harness({ cms }); h.choose("nl");
  h.fire("pagehide", { persisted: true }); h.fire("pageshow", { persisted: true }); h.choose("ur");
  assert.equal(cms.roots[1].getAttribute("lang"), "ur");
  h.fire("pagehide", { persisted: false });
  assert.deepEqual(shape(cms.body), cms.before);
  assert.equal(h.connections[0].api.get().status, "disconnected");
  h.choose("fr"); h.fire("pageshow");
  assert.deepEqual(shape(cms.body), cms.before);
  assert.equal(h.info.lang, "fr");
});

test("source conflicts remain stopped across load/pageshow while the existing selector stays usable", () => {
  const cms = createFaqDom(), h = harness({ cms }); h.choose("nl");
  cms.roots[1].childNodes[0].childNodes[0].data = "Preserve this editor change";
  const changed = shape(cms.roots[1]);
  h.fire("load"); h.fire("pageshow"); h.choose("ar");
  assert.deepEqual(shape(cms.roots[1]), changed);
  assert.deepEqual(shape(cms.roots[0]), catalogue.slots[0].source);
  assert.equal(h.connections[0].api.get().status, "source-changed");
  assert.equal(h.info.lang, "ar"); assert.equal(h.connections.length, 1);
});

test("blog helper receives existing store choices, including when its script becomes ready later", () => {
  const selected = [], h = harness({blog:{setLocale:locale => selected.push(locale)}});
  for (const locale of locales) { h.choose(locale.tag); assert.equal(selected.at(-1), locale.tag); }
  const later = harness(); later.choose("ur");
  const writes = later.writes.length;
  later.window.CalorieAppBlogX = {setLocale:locale => selected.push(locale)};
  later.fire("load"); assert.equal(selected.at(-1), "ur");
  later.fire("pageshow"); assert.equal(selected.at(-1), "ur");
  assert.equal(later.writes.length, writes); assert.equal(later.stores.length, 1);
});

test("Richlist and navigation share local/embedded choices without a second store or account changes", () => {
  const ranks = [], navigation = [], h = harness({richlist:{setLocale:x=>ranks.push(x)},navigation:{setLocale:x=>navigation.push(x)}});
  for (const locale of locales) { h.choose(locale.tag); assert.equal(ranks.at(-1),locale.tag); assert.equal(navigation.at(-1),locale.tag); }
  h.stores[0].apply("ar",true); assert.equal(ranks.at(-1),"ar"); assert.equal(navigation.at(-1),"ar");
  assert.equal(h.stores.length,1); assert.equal(h.account.sessionLocale,"en"); assert.equal(h.account.consent.marketing,false);
});
test("late helper readiness adopts the stored choice without accepting event data or writing another preference", () => {
  const ranks = [], navigation = [], h = harness(); h.choose("ur"); const writes = h.writes.length;
  h.window.CalorieAppRichlist = {setLocale:x=>ranks.push(x)};
  h.window.CalorieAppPageNavigation = {setLocale:x=>navigation.push(x)};
  h.fire("calorieapp:page-tools-ready",{detail:{locale:"nl",authenticated:true}});
  assert.equal(navigation.at(-1),"ur");
  h.fire("load"); h.fire("pageshow"); assert.equal(ranks.at(-1),"ur"); assert.equal(navigation.at(-1),"ur");
  assert.equal(h.writes.length,writes); assert.equal(h.stores.length,1); assert.equal(h.account.sessionLocale,"en");
});


test("Trustline helper uses the one display store and ignores untrusted readiness event data", () => {
  const selected = [], h = harness({trustline:{setLocale:locale => selected.push(locale)}});
  for (const locale of locales) { h.choose(locale.tag); assert.equal(selected.at(-1), locale.tag); }
  h.stores[0].apply("ar", true); assert.equal(selected.at(-1), "ar");
  const late = harness(); late.choose("ur"); const writes = late.writes.length;
  late.window.CalorieAppTrustline = {setLocale:locale => selected.push(locale)};
  late.fire("calorieapp:trustline-ready", {detail:{locale:"nl",authenticated:true}});
  assert.equal(selected.at(-1), "ur"); late.fire("load"); late.fire("pageshow");
  assert.equal(selected.at(-1), "ur"); assert.equal(late.writes.length, writes);
  assert.equal(late.stores.length, 1); assert.equal(late.account.sessionLocale, "en");
  assert.equal(late.account.consent.marketing, false);
});


test("Tokenomics uses the same preference store, including late readiness", () => {
  const selected = [], h = harness({tokenomics:{setLocale:locale => selected.push(locale)}});
  for (const locale of locales) { h.choose(locale.tag); assert.equal(selected.at(-1), locale.tag); }
  const late = harness(); late.choose("ar"); const writes = late.writes.length;
  late.window.CalorieAppTokenomics = {setLocale:locale => selected.push(locale)};
  late.fire("calorieapp:tokenomics-ready", {detail:{locale:"nl",authenticated:true}});
  assert.equal(selected.at(-1), "ar"); late.fire("pageshow"); assert.equal(selected.at(-1), "ar");
  assert.equal(late.writes.length, writes); assert.equal(late.stores.length, 1);
  assert.equal(late.account.sessionLocale, "en"); assert.equal(late.account.consent.marketing, false);
});


test("How to Buy uses the one display store, including late guide readiness", () => {
  const selected = [], h = harness({buyGuide:{setLocale:locale => selected.push(locale)}});
  for (const locale of locales) { h.choose(locale.tag); assert.equal(selected.at(-1), locale.tag); }
  const late = harness(); late.choose("ur"); const writes = late.writes.length;
  late.window.CalorieAppBuyGuide = {setLocale:locale => selected.push(locale)};
  late.fire("calorieapp:buy-guide-ready", {detail:{locale:"nl",authenticated:true}});
  assert.equal(selected.at(-1), "ur"); late.fire("pageshow"); assert.equal(selected.at(-1), "ur");
  assert.equal(late.writes.length, writes); assert.equal(late.stores.length, 1);
  assert.equal(late.account.sessionLocale, "en"); assert.equal(late.account.consent.marketing, false);
});
