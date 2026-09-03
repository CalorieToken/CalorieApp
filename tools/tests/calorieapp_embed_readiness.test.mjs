import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_PATH = new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-embed.js",
  import.meta.url
);

function element(hidden = true) {
  const listeners = {};
  return {
    hidden,
    href: "",
    src: "",
    style: {},
    textContent: "",
    classList: { toggle() {} },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    dispatch(type, event = {}) {
      listeners[type]?.(event);
    },
    removeAttribute(name) {
      this[name] = "";
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
}

test("Xaman waits for CalorieApp readiness and completion closes the dialog", async () => {
  const source = await readFile(SCRIPT_PATH, "utf8");
  const appOrigin = "https://calorieapp-frontend.onrender.com";
  const windowListeners = {};
  const iframeWindow = { postMessage() {} };
  const iframe = element(false);
  iframe.contentWindow = iframeWindow;
  const modal = element(true);
  const status = element(false);
  const qrImage = element(true);
  const openLink = element(true);
  const retryButton = element(true);
  const closeButton = element(false);
  const selectors = new Map([
    [".calorieapp-embed-frame", iframe],
    [".calorieapp-login-modal", modal],
    [".calorieapp-login-status", status],
    [".calorieapp-login-qr", qrImage],
    [".calorieapp-login-open", openLink],
    [".calorieapp-login-retry", retryButton],
    [".calorieapp-login-close", closeButton],
  ]);
  const root = {
    dataset: {
      appOrigin,
      startUrl: "/start",
      finishUrl: "/finish",
      authorizeUrl: "/authorize",
      locale: "nl",
    },
    querySelector(selector) {
      return selectors.get(selector) ?? null;
    },
  };
  const document = {
    hidden: false,
    readyState: "complete",
    addEventListener() {},
    querySelectorAll() {
      return [root];
    },
  };
  let now = 0;
  let timerId = 0;
  const timers = new Map();
  const scheduledDelays = [];
  const window = {
    addEventListener(type, listener) {
      windowListeners[type] = listener;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setTimeout(callback, delay) {
      timerId += 1;
      timers.set(timerId, { callback, delay });
      scheduledDelays.push(delay);
      return timerId;
    },
  };
  let websocketCount = 0;
  class FakeWebSocket {
    constructor() {
      websocketCount += 1;
      lastSocket = this;
    }
    close() {}
  }
  let lastSocket = null;
  const fetchCalls = [];
  const fetchBodies = [];
  let finishCount = 0;
  let finishCanComplete = false;
  const fetch = async (url, options = {}) => {
    fetchCalls.push(url);
    fetchBodies.push(JSON.parse(options.body));
    if (url === "/start") {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          flow_id: "flow-id",
          flow_proof: "flow-proof",
          next_url: "https://xumm.app/sign/payload",
          qr_png_url: "https://xumm.app/sign/payload.png",
          websocket_url: "wss://xumm.app/sign/payload",
          locale: "nl",
        }),
      };
    }
    if (url === "/finish") {
      finishCount += 1;
      if (finishCount === 2) {
        throw new Error("synthetic transport failure");
      }
      return {
        ok: true,
        status: finishCanComplete ? 200 : 202,
        json: async () => ({
          status: finishCanComplete ? "wordpress_authenticated" : "pending",
        }),
      };
    }
    if (url === "/authorize") {
      const body = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "authorized",
          code: "authorization-code",
          state: body.state,
          locale: "nl",
        }),
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  vm.runInNewContext(source, {
    Boolean,
    Error,
    JSON,
    Number,
    Object,
    Promise,
    Date: {
      now: () => now,
      parse: Date.parse,
    },
    WebSocket: FakeWebSocket,
    document,
    fetch,
    window,
  });

  const requestId = "request-12345678";
  windowListeners.message({
    data: { type: "calorieapp:login:start", requestId, locale: "nl" },
    origin: appOrigin,
    source: iframeWindow,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(modal.hidden, false);
  assert.equal(openLink.hidden, true);
  assert.equal(qrImage.hidden, true);
  assert.equal(websocketCount, 0);
  assert.match(status.textContent, /Starting CalorieApp securely/);
  windowListeners.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetchCalls, ["/start"]);

  windowListeners.message({
    data: {
      type: "calorieapp:login:state",
      requestId,
      state: "state-abcdefghijklmnopqrstuvwxyz-0123456789",
      locale: "nl",
    },
    origin: appOrigin,
    source: iframeWindow,
  });

  assert.equal(openLink.hidden, false);
  assert.equal(qrImage.hidden, false);
  assert.equal(openLink.href, "https://xumm.app/sign/payload");
  assert.equal(websocketCount, 1);

  windowListeners.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetchCalls, ["/start"]);

  openLink.dispatch("click");
  windowListeners.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetchCalls, ["/start", "/finish"]);
  assert.match(status.textContent, /Waiting for the Xaman signature/);
  windowListeners.focus();
  windowListeners.pageshow();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finishCount, 1);

  async function runNextTimer() {
    const next = timers.entries().next().value;
    assert.ok(next, "expected a scheduled status retry");
    const [id, timer] = next;
    timers.delete(id);
    now += timer.delay;
    timer.callback();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  }

  for (let index = 0; index < 6; index += 1) {
    await runNextTimer();
  }
  assert.deepEqual(scheduledDelays.slice(0, 7), [
    5000,
    10000,
    5000,
    5000,
    5000,
    10000,
    10000,
  ]);
  assert.equal(finishCount, 7);

  finishCanComplete = true;
  lastSocket.onmessage({ data: JSON.stringify({ signed: true }) });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCalls.filter((url) => url === "/finish").length, 8);
  assert.equal(fetchCalls.at(-1), "/authorize");
  assert.deepEqual(fetchBodies[0], { locale: "nl" });
  assert.deepEqual(fetchBodies.at(-1), {
    flow_id: "flow-id",
    flow_proof: "flow-proof",
    state: "state-abcdefghijklmnopqrstuvwxyz-0123456789",
    locale: "nl",
  });

  windowListeners.message({
    data: {
      type: "calorieapp:login:complete",
      requestId,
      locale: "nl",
    },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.equal(modal.hidden, false);
  assert.match(status.textContent, /Signed in to WordPress and CalorieApp/);

  const closeDialog = [...timers.values()].find(({ delay }) => delay === 1400);
  assert.ok(closeDialog, "successful joint sign-in schedules the dialog close");
  closeDialog.callback();
  assert.equal(modal.hidden, true);

  windowListeners.message({
    data: {
      type: "calorieapp:login:backend-error",
      requestId,
      message: "CalorieApp startup failed",
      locale: "nl",
    },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.equal(retryButton.hidden, false);
  assert.equal(status.textContent, "CalorieApp startup failed");

  windowListeners.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCalls.filter((url) => url === "/finish").length, 8);
  assert.equal(fetchCalls.at(-1), "/authorize");
  assert.equal(status.textContent, "CalorieApp startup failed");
});
