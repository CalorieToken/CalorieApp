import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const requireFrontend = createRequire(new URL("../../frontend/package.json", import.meta.url));
const ts = requireFrontend("typescript");
const source = await readFile(new URL("../../frontend/components/XamanLoginPanel.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText;

function harness() {
  const stored = new Map();
  const storage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key),
  };
  let now = 1_000_000;
  const module = { exports: {} };
  const context = vm.createContext({
    module, exports: module.exports, URL, Number, JSON, process: { env: {} },
    Date: { now: () => now }, window: { sessionStorage: storage },
    require(name) {
      if (name === "@/lib/backendRequest") return { BACKEND_WAKE_BASE_URL: "/api/backend" };
      if (name === "@/lib/locales") return { resolveLocale: value => value || "en" };
      if (name === "react" || name === "react/jsx-runtime" || name.startsWith("@/components/")) return {};
      throw new Error(`Unexpected module ${name}`);
    },
  });
  vm.runInContext(compiled, context);
  return { api: module.exports, storage, stored, advance: ms => { now += ms; } };
}

test("startup navigation uses the public health document with a fixed resume flag", () => {
  const { api } = harness();
  assert.equal(api.backendWakeNavigationUrl("https://calorieapp-backend-rvul.onrender.com"),
    "https://calorieapp-backend-rvul.onrender.com/health?resume_login=true");
  for (const value of ["/api/backend", "http://backend.onrender.com", "https://attacker.example",
    "https://backend.onrender.com.attacker.example", "https://user:secret@backend.onrender.com",
    "https://backend.onrender.com:8443", "https://backend.onrender.com/other",
    "https://backend.onrender.com?redirect=elsewhere", "https://backend.onrender.com/#token"]) {
    assert.equal(api.backendWakeNavigationUrl(value), null, value);
  }
});

test("return intent survives navigation and is consumed once for the same website and locale", () => {
  const { api, stored, advance } = harness();
  assert.equal(api.rememberBackendWakeReturn("https://calorietoken.net", "en"), true);
  advance(60_000);
  assert.equal(api.consumeBackendWakeReturn("https://calorietoken.net", "en"), true);
  assert.equal(api.consumeBackendWakeReturn("https://calorietoken.net", "en"), false);
  assert.equal(stored.size, 0);
});

test("wrong website, changed locale, expired and future intents do not restart login", () => {
  for (const [origin, locale, elapsed] of [
    ["https://attacker.example", "en", 0], ["https://calorietoken.net", "nl", 0],
    ["https://calorietoken.net", "en", 300_000], ["https://calorietoken.net", "en", -1],
  ]) {
    const { api, stored, advance } = harness();
    api.rememberBackendWakeReturn("https://calorietoken.net", "en");
    advance(elapsed);
    assert.equal(api.consumeBackendWakeReturn(origin, locale), false);
    assert.equal(stored.size, 0);
  }
});

test("blocked or malformed browser storage cannot cause navigation or a restart loop", () => {
  const { api, storage, stored } = harness();
  storage.setItem = () => { throw new Error("storage blocked"); };
  assert.equal(api.rememberBackendWakeReturn("https://calorietoken.net", "en"), false);
  stored.set("calorieapp-backend-wake-return", "{malformed");
  assert.equal(api.consumeBackendWakeReturn("https://calorietoken.net", "en"), false);
  assert.equal(stored.size, 0);
});

test("the actual login control resumes once after return and only after a trusted parent handshake", async () => {
  const stored = new Map();
  const requests = [];
  const origin = "https://calorietoken.net";
  function mount() {
    const hooks = [];
    const effects = [];
    const listeners = new Map();
    const sent = [];
    let cursor = 0;
    let mounted = false;
    const parent = { postMessage: message => sent.push(message) };
    const window = {
      parent,
      location: { search: "?embedded=1&locale=en", origin: "https://app.calorietoken.net" },
      crypto: { randomUUID: () => "request-1" },
      sessionStorage: {
        getItem: key => stored.get(key) ?? null,
        setItem: (key, value) => stored.set(key, value),
        removeItem: key => stored.delete(key),
      },
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: name => listeners.delete(name),
    };
    const react = {
      useState(initial) {
        const index = cursor++;
        if (!mounted) hooks[index] = typeof initial === "function" ? initial() : initial;
        return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!mounted) hooks[index] = { current: initial };
        return hooks[index];
      },
      useCallback(callback) {
        const index = cursor++;
        if (!mounted) hooks[index] = callback;
        return hooks[index];
      },
      useEffect(callback) { if (!mounted) effects.push(callback); },
    };
    const jsx = (type, props) => ({ type, props });
    const module = { exports: {} };
    vm.runInContext(compiled, vm.createContext({
      module, exports: module.exports, window, URL, URLSearchParams, AbortController,
      Date, Number, Math, JSON, setTimeout, clearTimeout,
      navigator: { language: "en" },
      document: { referrer: `${origin}/index.php/calorieapp/`, body: { scrollHeight: 100 }, documentElement: { scrollHeight: 100 } },
      process: { env: { NODE_ENV: "production" } },
      require(name) {
        if (name === "react") return react;
        if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
        if (name === "@/lib/locales") return { resolveLocale: value => value || "en" };
        if (name.startsWith("@/components/")) return new Proxy({}, { get: () => () => {} });
        if (name === "@/lib/backendRequest") return {
          BACKEND_WAKE_BASE_URL: "https://calorieapp-backend-rvul.onrender.com",
          waitForBackendReady: async () => {},
          backendUnavailableMessage: (_error, fallback) => fallback,
          BackendRequestTimeoutError: class extends Error {},
          backendRequest: async url => {
            requests.push(url);
            if (url.endsWith("/me")) return { ok: false, status: 401 };
            assert.ok(url.endsWith("/login/start"), url);
            return { ok: true, status: 200, json: async () => ({
              state: "s".repeat(40), browser_handoff_token: "h".repeat(40),
              expires_at: new Date(Date.now() + 300_000).toISOString(), locale: "en",
              wordpress_signin_url: `${origin}/?calorieapp_authorize=1`,
            }) };
          },
        };
        throw new Error(`Unexpected module ${name}`);
      },
    }));
    const render = () => { cursor = 0; return module.exports.XamanLoginPanel(); };
    render();
    mounted = true;
    const cleanups = effects.map(effect => effect());
    return {
      render, parent, sent,
      message: event => listeners.get("message")(event),
      close: () => cleanups.forEach(cleanup => cleanup?.()),
    };
  }
  function findLink(node) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "a" && node.props.target === "_top") return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = findLink(child);
      if (found) return found;
    }
    return null;
  }
  const first = mount();
  await first.message({ source: first.parent, origin, data: { type: "calorieapp:bridge:init", locale: "en" } });
  const link = findLink(first.render());
  assert.ok(link);
  assert.equal(link.props.href, "https://calorieapp-backend-rvul.onrender.com/health?resume_login=true");
  link.props.onClick({ preventDefault() { assert.fail("native navigation should remain enabled"); } });
  assert.equal(requests.filter(url => url.endsWith("/login/start")).length, 0);
  first.close();

  const returned = mount();
  await returned.message({ source: returned.parent, origin: "https://attacker.example", data: { type: "calorieapp:bridge:init", locale: "en" } });
  await returned.message({ source: {}, origin, data: { type: "calorieapp:bridge:init", locale: "en" } });
  assert.ok(stored.has("calorieapp-backend-wake-return"));
  const trusted = { source: returned.parent, origin, data: { type: "calorieapp:bridge:init", locale: "en" } };
  await returned.message(trusted);
  await returned.message(trusted);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.filter(url => url.endsWith("/login/start")).length, 1);
  assert.equal(stored.has("calorieapp-backend-wake-return"), false);
  assert.equal(returned.sent.filter(message => message.type === "calorieapp:login:start").length, 1);
  returned.close();
});
