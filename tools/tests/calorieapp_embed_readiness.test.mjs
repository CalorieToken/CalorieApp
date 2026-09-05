import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_PATH = new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-embed.js",
  import.meta.url
);
const STYLE_PATH = new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-embed.css",
  import.meta.url
);

function element(hidden = true) {
  const listeners = {};
  const classes = new Set();
  return {
    children: [],
    hidden,
    href: "",
    parentElement: null,
    src: "",
    style: {},
    textContent: "",
    classList: {
      add(value) {
        classes.add(value);
      },
      contains(value) {
        return classes.has(value);
      },
      toggle() {},
    },
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    dispatch(type, event = {}) {
      listeners[type]?.(event);
    },
    removeAttribute(name) {
      this[name] = "";
    },
    getAttribute(name) {
      return this[name] ?? null;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
}

test("mobile joint-session control stays compact and viewport-bounded", async () => {
  const source = await readFile(STYLE_PATH, "utf8");
  const mobileRules = source.slice(source.indexOf("@media (max-width: 768px)"));

  assert.match(mobileRules, /width:\s*min\(280px, calc\(100vw - 20px\)\)/);
  assert.match(
    mobileRules,
    /grid-template-columns:\s*26px minmax\(0, 1fr\) auto/
  );
  assert.match(
    mobileRules,
    /\.brz \.brz-menu-simple\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*20;/s
  );
  assert.match(
    mobileRules,
    /\.calorieapp-identity-card\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1;/s
  );
  assert.doesNotMatch(mobileRules, /grid-column:\s*1\s*\/\s*-1/);
  assert.doesNotMatch(mobileRules, /\.calorieapp-site-logout\s*\{[^}]*width:\s*100%/s);
});

test("Xaman waits for readiness and refreshes the joint account state", async () => {
  const source = await readFile(SCRIPT_PATH, "utf8");
  const appOrigin = "https://calorieapp-frontend.onrender.com";
  const windowListeners = {};
  const documentListeners = {};
  const iframePosts = [];
  const iframeWindow = { postMessage(message) { iframePosts.push(message); } };
  const iframe = element(false);
  iframe.contentWindow = iframeWindow;
  const legacySigninCard = element(false);
  legacySigninCard.closest = () => null;
  const legacySigninLink = element(false);
  legacySigninLink.closest = (selector) =>
    selector === ".xl-card" ? legacySigninCard : null;
  const modal = element(true);
  const status = element(false);
  const qrImage = element(true);
  const openLink = element(true);
  const retryButton = element(true);
  const closeButton = element(false);
  const siteSessionActions = element(false);
  const siteLogoutButton = element(false);
  siteLogoutButton.dataset = {
    logoutUrl:
      "https://calorietoken.net/wp-login.php?action=logout&redirect_to=calorieapp",
    idleLabel: "Sign out both",
  };
  siteLogoutButton.textContent = siteLogoutButton.dataset.idleLabel;
  const siteLogoutStatus = element(true);
  const selectors = new Map([
    [".calorieapp-embed-frame", iframe],
    [".calorieapp-login-modal", modal],
    [".calorieapp-login-status", status],
    [".calorieapp-login-qr", qrImage],
    [".calorieapp-login-open", openLink],
    [".calorieapp-login-retry", retryButton],
    [".calorieapp-login-close", closeButton],
    [".calorieapp-site-session-actions", siteSessionActions],
    [".calorieapp-site-logout", siteLogoutButton],
    [".calorieapp-site-logout-status", siteLogoutStatus],
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
    addEventListener(type, listener) {
      documentListeners[type] = listener;
    },
    querySelectorAll(selector) {
      if (selector === '[data-calorieapp-embed]') {
        return [root];
      }
      if (selector === '.xl-card a[href*="xl-signin"]') {
        return [legacySigninLink];
      }
      if (selector === ".xl-card") {
        return [legacySigninCard];
      }
      return [];
    },
  };
  let now = 0;
  let timerId = 0;
  let assignedLocation = "";
  let reloadCount = 0;
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
    location: {
      origin: "https://calorietoken.net",
      pathname: "/index.php/calorieapp/",
      assign(value) {
        assignedLocation = value;
      },
      reload() {
        reloadCount += 1;
      },
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

  assert.equal(legacySigninCard.hidden, false);
  assert.equal(siteSessionActions.parentElement, legacySigninCard);
  assert.equal(
    legacySigninCard.classList.contains("calorieapp-identity-card"),
    true
  );
  assert.equal(
    legacySigninLink["data-calorieapp-unified-login"],
    "1"
  );
  let preventedLegacyNavigation = false;
  legacySigninLink.dispatch("click", {
    preventDefault() {
      preventedLegacyNavigation = true;
    },
  });
  assert.equal(preventedLegacyNavigation, true);
  assert.equal(modal.hidden, false);
  assert.equal(
    iframePosts.filter((message) => message.type === "calorieapp:login:trigger")
      .length,
    0
  );

  windowListeners.message({
    data: { type: "calorieapp:bridge:ready", locale: "nl" },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.notEqual(iframePosts.at(-1).type, "calorieapp:login:trigger");
  windowListeners.message({
    data: { type: "calorieapp:bridge:initialized", locale: "nl" },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.equal(iframePosts.at(-1).type, "calorieapp:login:trigger");
  assert.equal(iframePosts.at(-1).locale, "nl");

  const requestId = "request-12345678";
  windowListeners.message({
    data: {
      type: "calorieapp:login:start",
      requestId,
      locale: "nl",
    },
    origin: appOrigin,
    source: iframeWindow,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(fetchCalls, []);
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
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(modal.hidden, false);
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
  assert.deepEqual(fetchCalls, ["/start"]);

  // Desktop/QR flows do not hide this page. A signed WebSocket event must start
  // WordPress completion without waiting for a visibility lifecycle event.
  lastSocket.onmessage({ data: JSON.stringify({ signed: true }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetchCalls, ["/start", "/finish"]);
  assert.match(status.textContent, /Waiting for the Xaman signature/);

  document.hidden = true;
  documentListeners.visibilitychange();
  document.hidden = false;
  documentListeners.visibilitychange();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetchCalls, ["/start", "/finish"]);
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
  await runNextTimer();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCalls.filter((url) => url === "/finish").length, 8);
  assert.equal(fetchCalls.at(-1), "/authorize");
  assert.deepEqual(fetchBodies[0], {
    locale: "nl",
    state: "state-abcdefghijklmnopqrstuvwxyz-0123456789",
  });
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
  assert.equal(reloadCount, 1);

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

  windowListeners.message({
    data: { type: "calorieapp:logout:request", locale: "nl" },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.equal(siteLogoutButton.disabled, true);
  assert.equal(siteLogoutButton.textContent, "Logging out...");
  assert.equal(iframePosts.at(-1).type, "calorieapp:logout");

  const logoutTimeoutEntry = [...timers.entries()].find(
    ([, { delay }]) => delay === 100000
  );
  assert.ok(logoutTimeoutEntry, "joint logout has a bounded response timeout");
  timers.delete(logoutTimeoutEntry[0]);
  logoutTimeoutEntry[1].callback();
  assert.equal(siteLogoutButton.disabled, false);
  assert.equal(
    siteLogoutButton.textContent,
    siteLogoutButton.dataset.idleLabel
  );
  assert.equal(siteLogoutStatus.hidden, false);
  assert.match(siteLogoutStatus.textContent, /did not respond/);

  siteLogoutButton.dispatch("click");
  assert.equal(siteLogoutButton.disabled, true);
  assert.equal(iframePosts.at(-1).type, "calorieapp:logout");

  windowListeners.message({
    data: { type: "calorieapp:logout:complete", locale: "nl" },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.equal(assignedLocation, siteLogoutButton.dataset.logoutUrl);
  assert.equal(
    [...timers.values()].filter(({ delay }) => delay === 30000).length,
    0
  );
  assert.equal(
    [...timers.values()].filter(({ delay }) => delay === 100000).length,
    0
  );
});
