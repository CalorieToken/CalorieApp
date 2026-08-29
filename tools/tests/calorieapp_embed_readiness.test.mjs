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
    removeAttribute(name) {
      this[name] = "";
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
}

test("Xaman remains hidden until the CalorieApp state is ready", async () => {
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
  const window = {
    addEventListener(type, listener) {
      windowListeners[type] = listener;
    },
    clearTimeout,
    setTimeout,
  };
  let websocketCount = 0;
  class FakeWebSocket {
    constructor() {
      websocketCount += 1;
    }
    close() {}
  }
  const fetch = async () => ({
    ok: true,
    status: 201,
    json: async () => ({
      flow_id: "flow-id",
      flow_proof: "flow-proof",
      next_url: "https://xumm.app/sign/payload",
      qr_png_url: "https://xumm.app/sign/payload.png",
      websocket_url: "wss://xumm.app/sign/payload",
    }),
  });

  vm.runInNewContext(source, {
    Boolean,
    Error,
    JSON,
    Number,
    Object,
    Promise,
    WebSocket: FakeWebSocket,
    document,
    fetch,
    window,
  });

  const requestId = "request-12345678";
  windowListeners.message({
    data: { type: "calorieapp:login:start", requestId },
    origin: appOrigin,
    source: iframeWindow,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(openLink.hidden, true);
  assert.equal(qrImage.hidden, true);
  assert.equal(websocketCount, 0);
  assert.match(status.textContent, /Starting CalorieApp securely/);

  windowListeners.message({
    data: {
      type: "calorieapp:login:state",
      requestId,
      state: "state-abcdefghijklmnopqrstuvwxyz-0123456789",
    },
    origin: appOrigin,
    source: iframeWindow,
  });

  assert.equal(openLink.hidden, false);
  assert.equal(qrImage.hidden, false);
  assert.equal(openLink.href, "https://xumm.app/sign/payload");
  assert.equal(websocketCount, 1);
});
