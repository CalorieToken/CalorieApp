import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const COMPONENT_PATH = new URL(
  "../../frontend/components/XamanLoginPanel.tsx",
  import.meta.url
);
const requireFromFrontend = createRequire(
  new URL("../../frontend/package.json", import.meta.url)
);

async function compiledLoginModule() {
  const typescript = requireFromFrontend("typescript");
  const source = await readFile(COMPONENT_PATH, "utf8");
  return {
    source,
    compiled: typescript.transpileModule(source, {
      compilerOptions: {
        jsx: typescript.JsxEmit.ReactJSX,
        module: typescript.ModuleKind.CommonJS,
        target: typescript.ScriptTarget.ES2022,
      },
    }).outputText,
  };
}

test("login surface fails closed until an embedded parent is trusted", async () => {
  const { compiled, source } = await compiledLoginModule();
  const module = { exports: {} };
  const context = vm.createContext({
    AbortController,
    Error,
    Math,
    Number,
    Promise,
    URL,
    URLSearchParams,
    console,
    module,
    exports: module.exports,
    process: { env: {} },
    require(specifier) {
      if (specifier === "react") {
        return {};
      }
      if (specifier === "react/jsx-runtime") {
        return { Fragment: Symbol("Fragment"), jsx() {}, jsxs() {} };
      }
      if (specifier.startsWith("@/components/")) {
        return new Proxy({}, { get: () => () => {} });
      }
      if (specifier === "@/lib/backendRequest") {
        return {
          BACKEND_WAKE_BASE_URL: "https://backend.example",
          backendRequest: async () => {},
          backendUnavailableMessage: (_error, fallback) => fallback,
          BackendRequestTimeoutError: class extends Error {},
          waitForBackendReady: async () => {},
        };
      }
      if (specifier === "@/lib/locales") {
        return { resolveLocale: (value) => value || "en" };
      }
      throw new Error(`Unexpected require: ${specifier}`);
    },
  });

  vm.runInContext(compiled, context);

  assert.equal(module.exports.resolveLoginSurfaceMode(true, true), "embedded");
  assert.equal(module.exports.resolveLoginSurfaceMode(false, true), "checking");
  assert.equal(module.exports.resolveLoginSurfaceMode(false, false), "standalone");
  assert.match(
    source,
    /resolveLoginSurfaceMode\(\s*false,\s*expectsEmbeddedBridge\(\)\s*\)/
  );
  assert.doesNotMatch(source, /resolveLoginSurfaceMode\(origin !== null/);
  assert.doesNotMatch(source, /window\.location\.assign\(WORDPRESS_APP_URL\)/);
  assert.match(source, /href=\{WORDPRESS_APP_URL\}/);
  assert.match(
    source,
    /type:\s*"calorieapp:login:start"[\s\S]*type:\s*"calorieapp:login:state"/
  );
  assert.match(source, /type:\s*"calorieapp:bridge:initialized"/);
  assert.match(source, /event\.data\?\.type === "calorieapp:logout"/);
  assert.match(source, /type:\s*"calorieapp:logout:request"/);
  assert.match(source, /Sign out everywhere/);
  assert.match(source, /requestCalorieAppLogout\(\)/);
});

test("login start retries transport errors and transient responses", async () => {
  const typescript = requireFromFrontend("typescript");
  const source = await readFile(COMPONENT_PATH, "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;

  const responses = [
    new Error("temporary transport failure"),
    {
      ok: false,
      status: 429,
      headers: { get: () => "0" },
    },
    {
      ok: false,
      status: 503,
      headers: { get: () => null },
    },
    {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        state: "state-abcdefghijklmnopqrstuvwxyz-0123456789",
        expires_at: "2099-01-01T00:00:00Z",
        wordpress_signin_url: "https://calorietoken.net/?xl-signin=1",
        browser_handoff_token: "token-abcdefghijklmnopqrstuvwxyz-0123456789",
        locale: "nl",
      }),
    },
  ];
  let requestCount = 0;
  const requestBodies = [];
  const backendRequest = async (_url, options) => {
    requestBodies.push(JSON.parse(options.body));
    const response = responses[requestCount];
    requestCount += 1;
    if (response instanceof Error) {
      throw response;
    }
    return response;
  };

  class TestBackendRequestTimeoutError extends Error {}
  const module = { exports: {} };
  const context = vm.createContext({
    AbortController,
    Error,
    Math,
    Number,
    Promise,
    URL,
    clearImmediate,
    console,
    module,
    exports: module.exports,
    process: { env: {} },
    require(specifier) {
      if (specifier === "react") {
        return {};
      }
      if (specifier === "react/jsx-runtime") {
        return { Fragment: Symbol("Fragment"), jsx() {}, jsxs() {} };
      }
      if (specifier === "@/components/AccountDataExportButton") {
        return { AccountDataExportButton() {} };
      }
      if (specifier === "@/components/AccountDataImportPanel") {
        return { AccountDataImportPanel() {} };
      }
      if (specifier === "@/components/AccountErasurePanel") {
        return { AccountErasurePanel() {} };
      }
      if (specifier === "@/components/authEvents") {
        return { announceAuthState() {} };
      }
      if (specifier === "@/lib/backendRequest") {
        return {
          BACKEND_WAKE_BASE_URL: "https://backend.example",
          backendRequest,
          backendUnavailableMessage: (_error, fallback) => fallback,
          BackendRequestTimeoutError: TestBackendRequestTimeoutError,
          waitForBackendReady: async () => {},
        };
      }
      if (specifier === "@/lib/locales") {
        return { resolveLocale: (value) => value || "en" };
      }
      throw new Error(`Unexpected require: ${specifier}`);
    },
    setImmediate,
    window: {
      clearTimeout(timer) {
        clearImmediate(timer);
      },
      setTimeout(callback) {
        return setImmediate(callback);
      },
    },
  });

  vm.runInContext(compiled, context);
  const retryReasons = [];
  const result = await module.exports.startLoginWithRetry(
    new AbortController().signal,
    (reason) => retryReasons.push(reason),
    10_000,
    "nl"
  );

  assert.equal(requestCount, 4);
  assert.deepEqual(retryReasons, [
    "temporarily-unavailable",
    "rate-limited",
    "temporarily-unavailable",
  ]);
  assert.equal(result.state, "state-abcdefghijklmnopqrstuvwxyz-0123456789");
  assert.deepEqual(requestBodies, [
    { locale: "nl" },
    { locale: "nl" },
    { locale: "nl" },
    { locale: "nl" },
  ]);
});

test("embedded login wakes the backend before creating login state", async () => {
  const typescript = requireFromFrontend("typescript");
  const source = await readFile(COMPONENT_PATH, "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;

  const events = [];
  const loginResponse = {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      state: "state-abcdefghijklmnopqrstuvwxyz-0123456789",
      expires_at: "2099-01-01T00:00:00Z",
      wordpress_signin_url: "https://calorietoken.net/?xl-signin=1",
      browser_handoff_token: "token-abcdefghijklmnopqrstuvwxyz-0123456789",
      locale: "en",
    }),
  };

  class TestBackendRequestTimeoutError extends Error {}
  const module = { exports: {} };
  const context = vm.createContext({
    AbortController,
    Error,
    Math,
    Number,
    Promise,
    URL,
    clearImmediate,
    console,
    module,
    exports: module.exports,
    process: { env: {} },
    require(specifier) {
      if (specifier === "react") {
        return {};
      }
      if (specifier === "react/jsx-runtime") {
        return { Fragment: Symbol("Fragment"), jsx() {}, jsxs() {} };
      }
      if (specifier === "@/components/AccountDataExportButton") {
        return { AccountDataExportButton() {} };
      }
      if (specifier === "@/components/AccountDataImportPanel") {
        return { AccountDataImportPanel() {} };
      }
      if (specifier === "@/components/AccountErasurePanel") {
        return { AccountErasurePanel() {} };
      }
      if (specifier === "@/components/authEvents") {
        return { announceAuthState() {} };
      }
      if (specifier === "@/lib/backendRequest") {
        return {
          BACKEND_WAKE_BASE_URL: "https://backend.example",
          backendRequest: async () => {
            events.push("login-start");
            return loginResponse;
          },
          backendUnavailableMessage: (_error, fallback) => fallback,
          BackendRequestTimeoutError: TestBackendRequestTimeoutError,
          waitForBackendReady: async (backendUrl) => {
            events.push(`backend-ready:${backendUrl}`);
          },
        };
      }
      if (specifier === "@/lib/locales") {
        return { resolveLocale: (value) => value || "en" };
      }
      throw new Error(`Unexpected require: ${specifier}`);
    },
    setImmediate,
    window: {
      clearTimeout(timer) {
        clearImmediate(timer);
      },
      setTimeout(callback) {
        return setImmediate(callback);
      },
    },
  });

  vm.runInContext(compiled, context);
  const phases = [];
  const result = await module.exports.prepareEmbeddedLogin(
    new AbortController().signal,
    (phase) => phases.push(phase),
    10_000
  );

  assert.deepEqual(events, [
    "backend-ready:https://backend.example",
    "login-start",
  ]);
  assert.deepEqual(phases, ["waking-up"]);
  assert.equal(result.state, "state-abcdefghijklmnopqrstuvwxyz-0123456789");
});

test("embedded login does not report progress after cancellation", async () => {
  const typescript = requireFromFrontend("typescript");
  const source = await readFile(COMPONENT_PATH, "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;

  const events = [];
  class TestBackendRequestTimeoutError extends Error {}
  const module = { exports: {} };
  const context = vm.createContext({
    AbortController,
    Error,
    Math,
    Number,
    Promise,
    URL,
    clearImmediate,
    console,
    module,
    exports: module.exports,
    process: { env: {} },
    require(specifier) {
      if (specifier === "react") {
        return {};
      }
      if (specifier === "react/jsx-runtime") {
        return { Fragment: Symbol("Fragment"), jsx() {}, jsxs() {} };
      }
      if (specifier === "@/components/AccountDataExportButton") {
        return { AccountDataExportButton() {} };
      }
      if (specifier === "@/components/AccountDataImportPanel") {
        return { AccountDataImportPanel() {} };
      }
      if (specifier === "@/components/AccountErasurePanel") {
        return { AccountErasurePanel() {} };
      }
      if (specifier === "@/components/authEvents") {
        return { announceAuthState() {} };
      }
      if (specifier === "@/lib/backendRequest") {
        return {
          BACKEND_WAKE_BASE_URL: "https://backend.example",
          backendRequest: async () => {
            events.push("login-start");
          },
          backendUnavailableMessage: (_error, fallback) => fallback,
          BackendRequestTimeoutError: TestBackendRequestTimeoutError,
          waitForBackendReady: async () => {
            events.push("backend-ready");
          },
        };
      }
      if (specifier === "@/lib/locales") {
        return { resolveLocale: (value) => value || "en" };
      }
      throw new Error(`Unexpected require: ${specifier}`);
    },
    setImmediate,
    window: {
      clearTimeout(timer) {
        clearImmediate(timer);
      },
      setTimeout(callback) {
        return setImmediate(callback);
      },
    },
  });

  vm.runInContext(compiled, context);
  const controller = new AbortController();
  const abortReason = new Error("cancelled before login");
  controller.abort(abortReason);

  await assert.rejects(
    module.exports.prepareEmbeddedLogin(
      controller.signal,
      (phase) => events.push(phase),
      10_000
    ),
    abortReason
  );
  assert.deepEqual(events, []);
});

test("login status polling slows down by age, failures, and Retry-After", async () => {
  const typescript = requireFromFrontend("typescript");
  const source = await readFile(COMPONENT_PATH, "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;

  let now = 0;
  const scheduledDelays = [];
  const responses = [
    new Error("synthetic transport failure"),
    {
      ok: false,
      status: 503,
      headers: { get: () => "25" },
    },
    {
      ok: false,
      status: 429,
      headers: { get: () => "25" },
    },
    {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ status: "pending", locale: "en" }),
    },
    {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ status: "authenticated", locale: "en" }),
    },
  ];
  let requestCount = 0;
  const backendRequest = async () => {
    const response = responses[requestCount];
    requestCount += 1;
    if (response instanceof Error) {
      throw response;
    }
    return response;
  };

  class TestBackendRequestTimeoutError extends Error {}
  const module = { exports: {} };
  const context = vm.createContext({
    AbortController,
    Date: {
      now: () => now,
      parse: Date.parse,
    },
    Error,
    Math,
    Number,
    Promise,
    URL,
    clearImmediate,
    console,
    module,
    exports: module.exports,
    process: { env: {} },
    require(specifier) {
      if (specifier === "react") {
        return {};
      }
      if (specifier === "react/jsx-runtime") {
        return { Fragment: Symbol("Fragment"), jsx() {}, jsxs() {} };
      }
      if (specifier === "@/components/AccountDataExportButton") {
        return { AccountDataExportButton() {} };
      }
      if (specifier === "@/components/AccountDataImportPanel") {
        return { AccountDataImportPanel() {} };
      }
      if (specifier === "@/components/AccountErasurePanel") {
        return { AccountErasurePanel() {} };
      }
      if (specifier === "@/components/authEvents") {
        return { announceAuthState() {} };
      }
      if (specifier === "@/lib/backendRequest") {
        return {
          BACKEND_WAKE_BASE_URL: "https://backend.example",
          backendRequest,
          backendUnavailableMessage: (_error, fallback) => fallback,
          BackendRequestTimeoutError: TestBackendRequestTimeoutError,
          waitForBackendReady: async () => {},
        };
      }
      if (specifier === "@/lib/locales") {
        return { resolveLocale: (value) => value || "en" };
      }
      throw new Error(`Unexpected require: ${specifier}`);
    },
    setImmediate,
    window: {
      clearTimeout(timer) {
        clearImmediate(timer);
      },
      setTimeout(callback, delay) {
        scheduledDelays.push(delay);
        return setImmediate(() => {
          now += delay;
          callback();
        });
      },
    },
  });

  vm.runInContext(compiled, context);
  assert.equal(module.exports.loginStatusPollDelayMs(0), 5000);
  assert.equal(module.exports.loginStatusPollDelayMs(30000), 10000);
  assert.equal(module.exports.loginStatusPollDelayMs(90000), 20000);
  assert.equal(module.exports.loginStatusPollDelayMs(0, 1), 10000);
  assert.equal(module.exports.loginStatusPollDelayMs(0, 2), 20000);
  assert.equal(module.exports.loginStatusPollDelayMs(0, 3), 30000);

  await module.exports.waitForOriginLogin(
    "state-abcdefghijklmnopqrstuvwxyz-0123456789",
    "token-abcdefghijklmnopqrstuvwxyz-0123456789",
    "2099-01-01T00:00:00Z",
    new AbortController().signal,
    "en"
  );

  assert.equal(requestCount, 5);
  assert.deepEqual(scheduledDelays, [5000, 10000, 25000, 30000, 10000]);
});
