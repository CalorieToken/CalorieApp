import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const runtime = require("../../contracts/display-language/v1/runtime.js");
const registry = JSON.parse(readFileSync(new URL("../../contracts/identity-bridge/v1/locales.json", import.meta.url)));
const tags = registry.locales.map(item => item.tag);
const prefix = "calorieapp:display-language:";
const key = "calorieapp.display-language.v1";
function memory(initial = {}) {
  const values = new Map(Object.entries(initial)), writes = [];
  return {
    values, writes, getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes.push({ key, value }); values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
}
function store(locale = "en", storage = memory()) {
  return runtime.createStore({ locales: tags, fallback: "en", initialLocale: locale, storage, now: () => 10000000000 });
}
function endpoint() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type, event) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event); },
    count() { return [...listeners.values()].reduce((total, group) => total + group.size, 0); }
  };
}
function pair({ delayedHost = false, hostLocale = "en", guestLocale = "en" } = {}) {
  const queue = [], sent = [], hostWindow = endpoint(), guestWindow = endpoint();
  const hostOrigin = "https://calorietoken.net", guestOrigin = "https://app.calorietoken.net";
  const hostStorage = memory(), guestStorage = memory(), hostStore = store(hostLocale, hostStorage), guestStore = store(guestLocale, guestStorage);
  const hostProxy = { postMessage(data, target) {
    sent.push({ to: "host", data, target });
    if (target === hostOrigin) queue.push(() => hostWindow.emit("message", { data, origin: guestOrigin, source: guestProxy }));
  }};
  const guestProxy = { postMessage(data, target) {
    sent.push({ to: "guest", data, target });
    if (target === guestOrigin) queue.push(() => guestWindow.emit("message", { data, origin: hostOrigin, source: hostProxy }));
  }};
  let frames = [{ window: guestProxy, origin: guestOrigin }], stopHost = () => {};
  function startHost() {
    stopHost = runtime.connectHost({ window: hostWindow, store: hostStore, frames: () => frames, epoch: "host-epoch-0000000001" });
  }
  if (!delayedHost) startHost();
  const stopGuest = runtime.connectGuest({ window: guestWindow, parent: hostProxy, store: guestStore,
    origins: [hostOrigin], channel: "guest-channel-00000001" });
  return {
    hostWindow, guestWindow, hostProxy, guestProxy, hostOrigin, guestOrigin,
    hostStore, guestStore, hostStorage, guestStorage, sent, startHost,
    removeFrame() { frames = []; },
    stop() { stopHost(); stopGuest(); },
    flush() { let count = 0; while (queue.length) { assert.ok(++count < 100, "No message loop"); queue.shift()(); } return count; }
  };
}
test("the shared runtime and copy are identical in the deployable artifact", () => {
  const root = new URL("../../", import.meta.url);
  const canonical = readFileSync(new URL("contracts/display-language/v1/runtime.js", root), "utf8");
  const frontend = new URL("frontend/lib/displayLanguageRuntime.js", root);
  const target = existsSync(frontend) ? frontend : new URL("wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-display-language-runtime.js", root);
  assert.equal(readFileSync(target, "utf8"), canonical);
  const copy = readFileSync(new URL("contracts/display-language/v1/copy.json", root), "utf8");
  const copyTarget = existsSync(frontend) ? "frontend/config/display-language-copy.json" : "wordpress-plugins/calorieapp-identity-bridge/config/display-language.json";
  assert.equal(readFileSync(new URL(copyTarget, root), "utf8"), copy);
  assert.deepEqual(Object.keys(JSON.parse(copy)), tags);
  for (const item of Object.values(JSON.parse(copy))) assert.ok(item.label.trim() && item.preview.trim());
});
test("all eleven choices work in both directions without echo loops", () => {
  const p = pair();
  p.flush();
  for (const locale of tags) {
    p.hostStore.select(locale); p.flush();
    assert.equal(p.guestStore.get().locale, locale);
    const other = tags[(tags.indexOf(locale) + 1) % tags.length];
    p.guestStore.select(other); p.flush();
    assert.equal(p.hostStore.get().locale, other);
    assert.equal(p.guestStore.get().locale, other);
    assert.equal(p.flush(), 0);
  }
  assert.ok(p.sent.every(item => item.target !== "*" && item.data.type.startsWith(prefix)));
  p.stop();
});
test("a delayed host discovers the already loaded app without polling", () => {
  const p = pair({ delayedHost: true, hostLocale: "nl", guestLocale: "fr" });
  p.flush(); p.startHost(); p.flush();
  assert.equal(p.guestStore.get().locale, "nl");
  p.guestWindow.emit("pageshow", {}); p.hostWindow.emit("pageshow", {}); p.flush();
  assert.equal(p.guestStore.get().locale, "nl");
  assert.equal(p.hostStorage.writes.length, 0);
  assert.equal(p.guestStorage.writes.length, 0);
});
test("an explicit choice while startup is pending is delivered after handshake", () => {
  const p = pair({ delayedHost: true });
  p.guestStore.select("ur"); p.flush();
  p.startHost(); p.flush();
  assert.equal(p.hostStore.get().locale, "ur");
  assert.equal(p.guestStore.get().locale, "ur");
});
test("rapid guest choices and a concurrent host change converge to the last pending explicit choice", () => {
  const p = pair(); p.flush();
  p.guestStore.select("nl"); p.guestStore.select("ar"); p.guestStore.select("fr");
  p.hostStore.select("es"); p.flush();
  assert.equal(p.hostStore.get().locale, "fr");
  assert.equal(p.guestStore.get().locale, "fr");
});
test("wrong origins, window sources, fields, tags and authentication messages cannot change display state", () => {
  const p = pair(); p.flush();
  const request = { type: prefix + "request", version: 1, channel: "guest-channel-00000001",
    epoch: "host-epoch-0000000001", sequence: 1, revision: 0, locale: "nl" };
  const event = { data: request, origin: p.guestOrigin, source: p.guestProxy };
  for (const bad of [
    { ...event, origin: "https://attacker.example" }, { ...event, source: {} },
    { ...event, data: { ...request, locale: "en-US" } },
    { ...event, data: { ...request, locale: "__proto__" } },
    { ...event, data: { ...request, token: "never-allowed" } },
    { ...event, data: { ...request, type: "calorieapp:login:complete" } },
    { ...event, data: { ...request, version: 2 } },
    { ...event, data: { ...request, sequence: Infinity } },
    { ...event, data: { ...request, channel: "wrong-channel-00001" } },
  ]) p.hostWindow.emit("message", bad);
  p.flush(); assert.equal(p.hostStore.get().locale, "en");
  const state = p.sent.find(item => item.data.type === prefix + "state").data;
  for (const bad of [
    { data: { ...state, locale: "ar" }, origin: p.hostOrigin, source: {} },
    { data: { ...state, locale: "ar" }, origin: "https://attacker.example", source: p.hostProxy },
    { data: { ...state, locale: "ar", wallet: "never-allowed" }, origin: p.hostOrigin, source: p.hostProxy },
    { data: { ...state, locale: "ar", ack: 100 }, origin: p.hostOrigin, source: p.hostProxy },
  ]) p.guestWindow.emit("message", bad);
  assert.equal(p.guestStore.get().locale, "en");
});
test("stale requests, replayed sequences and removed frames cannot undo a newer selection", () => {
  const p = pair(); p.flush();
  p.hostStore.select("nl"); p.flush();
  const data = { type: prefix + "request", version: 1, channel: "guest-channel-00000001",
    epoch: "host-epoch-0000000001", sequence: 1, revision: 0, locale: "ar" };
  p.hostWindow.emit("message", { data, origin: p.guestOrigin, source: p.guestProxy });
  assert.equal(p.hostStore.get().locale, "nl");
  p.hostWindow.emit("message", { data: { ...data, revision: 1 }, origin: p.guestOrigin, source: p.guestProxy });
  assert.equal(p.hostStore.get().locale, "nl");
  p.removeFrame();
  p.hostWindow.emit("message", { data: { ...data, revision: 1, sequence: 2 }, origin: p.guestOrigin, source: p.guestProxy });
  assert.equal(p.hostStore.get().locale, "nl");
});
test("the preference contains only locale/time, expires after 30 days and tolerates denied storage", () => {
  const storage = memory();
  const first = store("en", storage); first.select("nl");
  assert.deepEqual([...storage.values.keys()], [key]);
  assert.deepEqual(JSON.parse(storage.values.get(key)), { locale: "nl", savedAt: 10000000000 });
  assert.equal(store("en", storage).get().locale, "nl");
  const invalid = ["null", "not-json", JSON.stringify({locale:"fr",savedAt:1}),
    JSON.stringify({locale:"fr",savedAt:10000000001}), JSON.stringify({locale:"fr",savedAt:10000000000,account:1})];
  for (const value of invalid) assert.equal(store("en", memory({[key]:value})).get().locale, "en");
  const denied = { getItem(){throw Error("denied");}, setItem(){throw Error("denied");}, removeItem(){throw Error("denied");} };
  const ephemeral = store("en", denied);
  ephemeral.select("ar"); assert.equal(ephemeral.get().locale, "ar");
  assert.equal(ephemeral.select("<script>"), false);
});
test("disconnect removes every listener and stops further synchronization", () => {
  const p = pair(); p.flush();
  p.hostStore.select("nl"); p.flush();
  p.stop(); assert.equal(p.hostWindow.count(),0); assert.equal(p.guestWindow.count(),0);
  const before = p.sent.length; p.guestStore.select("ar"); p.hostStore.select("ur");
  assert.equal(p.sent.length,before);
});
