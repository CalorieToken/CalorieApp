import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-site-session.js",
  import.meta.url
), "utf8");
const site = "https://calorietoken.net";
const app = "https://app.calorietoken.net";
const page = `${site}/index.php/calorieapp/`;
const startup = "https://calorieapp-backend-rvul.onrender.com/health?resume_login=true";
const key = "calorieapp-site-login-return";
const now = 1788700000000;

function element() {
  const listeners = new Map();
  return {
    dataset: {}, children: [], hidden: false, textContent: "", disabled: false,
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    dispatch(type, event = {}) { for (const callback of listeners.get(type) || []) callback(event); },
    appendChild(child) { this.children.push(child); child.parent = this; },
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); },
    setAttribute(name, value) { this[name] = value; },
    closest() { return null; },
  };
}

function harness({ embedded = false, signedIn = false, storage = new Map(), storageBlocked = false, startupUrl = startup } = {}) {
  const config = element();
  config.dataset = { appPage: page, frameSrc: `${app}/?embedded=1&locale=en`, appOrigin: app, locale: "en", startupUrl };
  const link = element();
  const card = element();
  const body = element();
  const button = element();
  button.dataset = { logoutUrl: `${site}/wp-login.php?action=logout&_wpnonce=test`, idleLabel: "Sign out both" };
  const status = element();
  status.hidden = true;
  const actions = element();
  actions.querySelector = selector => selector === ".calorieapp-site-logout" ? button : status;
  const framePosts = [];
  const frames = [];
  function frame() {
    const item = element();
    item.contentWindow = { postMessage(message, origin) { framePosts.push({ frame: item, message, origin }); } };
    return item;
  }
  const appFrame = frame();
  const root = { dataset: { appOrigin: app, locale: "en" }, querySelector: () => appFrame };
  const document = {
    body, readyState: "complete",
    querySelector(selector) {
      if (selector === "[data-calorieapp-site-integration]") return config;
      if (selector === "[data-calorieapp-embed]") return embedded ? root : null;
      if (selector === "[data-calorieapp-sitewide-session-actions]") return signedIn ? actions : null;
      if (selector === ".xl-card") return card;
      return null;
    },
    querySelectorAll: () => [link],
    createElement(tag) { assert.equal(tag, "iframe"); const created = frame(); frames.push(created); return created; },
  };
  const listeners = new Map();
  const timers = new Map();
  let nextTimer = 0;
  const navigations = [];
  const window = {
    location: { origin: site, pathname: embedded ? "/index.php/calorieapp/" : "/index.php/about/", assign: value => navigations.push(value) },
    sessionStorage: {
      getItem(k) { if (storageBlocked) throw Error("blocked"); return storage.get(k) ?? null; },
      setItem(k, v) { if (storageBlocked) throw Error("blocked"); storage.set(k, v); },
      removeItem(k) { if (storageBlocked) throw Error("blocked"); storage.delete(k); },
    },
    addEventListener(type, callback) { const items = listeners.get(type) || []; items.push(callback); listeners.set(type, items); },
    setTimeout(callback, delay) { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
  };
  function send(type, overrides = {}) {
    const target = frames.at(-1) || appFrame;
    const event = { origin: app, source: target.contentWindow, data: { type: `calorieapp:${type}`, locale: "en" }, ...overrides };
    for (const callback of listeners.get("message") || []) callback(event);
  }
  vm.runInNewContext(source, {
    document, window, URL,
    Date: { now: () => now },
    fetch() { throw Error("idle pages and navigation must not fetch the backend"); },
  });
  return { link, button, status, actions, card, body, framePosts, frames, appFrame, storage, send, timers, navigations };
}

test("website widget uses same-tab native startup and resumes once in the trusted embed", () => {
  const first = harness();
  assert.equal(first.link.href, page);
  assert.equal(first.link.target, "_self");
  assert.equal(first.frames.length, 0);
  assert.equal(first.framePosts.length, 0);
  let prevented = false;
  first.link.dispatch("click", { button: 0, preventDefault() { prevented = true; } });
  assert.equal(prevented, false, "retain the browser's native navigation");
  assert.equal(first.link.href, startup);
  const intent = JSON.parse(first.storage.get(key));
  assert.equal(intent.siteOrigin, site);
  assert.equal(intent.appOrigin, app);
  assert.equal(intent.locale, "en");

  const returned = harness({ embedded: true, storage: first.storage });
  assert.equal(returned.storage.has(key), false, "consume the intent before any resumption");
  assert.equal(returned.framePosts.at(-1).message.type, "calorieapp:bridge:init");
  returned.send("bridge:initialized", { origin: "https://untrusted.example" });
  returned.send("bridge:initialized", { source: {} });
  returned.send("bridge:initialized", { data: { type: "calorieapp:bridge:initialized", locale: "nl" } });
  assert.equal(returned.framePosts.length, 1);
  returned.send("bridge:initialized");
  returned.send("bridge:initialized");
  assert.equal(returned.framePosts.filter(p => p.message.type === "calorieapp:login:trigger").length, 1);
  assert.equal(returned.framePosts.at(-1).origin, app);
  assert.equal(harness({ embedded: true, storage: first.storage }).framePosts.length, 0);
});

test("the header on the CalorieApp page also takes the native startup route", () => {
  const h = harness({ embedded: true });
  h.link.dispatch("click", { button: 0 });
  assert.equal(h.link.href, startup);
  assert.equal(h.framePosts.length, 0, "do not start the older background-only login");
});

test("invalid, expired, future, foreign and mismatched intents cannot resume", () => {
  const valid = { startedAt: now, siteOrigin: site, appOrigin: app, pathname: "/index.php/calorieapp/", locale: "en" };
  const variants = [
    "malformed-json", "null", "42",
    ...[
      { ...valid, startedAt: now - 300001 }, { ...valid, startedAt: now + 1 },
      { ...valid, startedAt: "today" }, { ...valid, siteOrigin: "https://untrusted.example" },
      { ...valid, appOrigin: "https://untrusted.example" },
      { ...valid, locale: "nl" }, { ...valid, pathname: "/elsewhere/" },
    ].map(JSON.stringify),
  ];
  for (const value of variants) {
    const h = harness({ embedded: true, storage: new Map([[key, value]]) });
    h.send("bridge:initialized");
    assert.equal(h.framePosts.length, 0);
    assert.equal(h.storage.has(key), false);
  }
});

test("blocked storage, modified clicks and unrecognized startup URLs keep the canonical page link", () => {
  for (const options of [{ storageBlocked: true }, { startupUrl: "https://untrusted.example/" }]) {
    const h = harness(options);
    h.link.dispatch("click", { button: 0 });
    assert.equal(h.link.href, page);
    assert.equal(h.storage.size, 0);
  }
  for (const event of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    const h = harness();
    h.link.dispatch("click", event);
    assert.equal(h.link.href, page);
    assert.equal(h.storage.size, 0);
  }
});

test("site-wide logout is lazy and ends WordPress only after trusted CalorieApp completion", () => {
  const h = harness({ signedIn: true });
  assert.equal(h.card.children[0], h.actions);
  assert.equal(h.frames.length, 0);
  h.button.dispatch("click");
  h.button.dispatch("click");
  assert.equal(h.frames.length, 1);
  assert.equal(h.frames[0].hidden, true);
  assert.equal(h.button.disabled, true);
  h.send("logout:complete");
  assert.deepEqual(h.navigations, [], "unsolicited completion cannot log WordPress out");
  h.send("bridge:ready");
  assert.equal(h.framePosts.at(-1).message.type, "calorieapp:bridge:init");
  h.send("bridge:initialized");
  h.send("bridge:initialized");
  assert.equal(h.framePosts.filter(p => p.message.type === "calorieapp:logout").length, 1);
  h.send("logout:complete", { origin: "https://untrusted.example" });
  h.send("logout:complete", { source: {} });
  h.send("logout:complete", { data: { type: "calorieapp:logout:complete", locale: "nl" } });
  assert.deepEqual(h.navigations, []);
  h.send("logout:complete");
  h.send("logout:complete");
  assert.deepEqual(h.navigations, [h.button.dataset.logoutUrl]);
  assert.equal(h.body.children.length, 0);
  assert.equal(h.timers.size, 0);
});

test("site-wide logout timeout and error allow a fresh attempt without accepting old messages", () => {
  const h = harness({ signedIn: true });
  h.button.dispatch("click");
  const firstWindow = h.frames[0].contentWindow;
  const timer = [...h.timers.values()][0];
  assert.equal(timer.delay, 30000);
  timer.callback();
  assert.equal(h.body.children.length, 0);
  assert.equal(h.button.disabled, false);
  assert.equal(h.status.hidden, false);
  assert.match(h.status.textContent, /did not respond/);
  h.button.dispatch("click");
  assert.equal(h.frames.length, 2);
  h.send("bridge:initialized", { source: firstWindow });
  assert.equal(h.framePosts.length, 0);
  h.send("bridge:initialized");
  h.send("logout:error");
  assert.equal(h.button.disabled, false);
  assert.equal(h.body.children.length, 0);
  assert.match(h.status.textContent, /Could not log out/);
  assert.deepEqual(h.navigations, []);
});
