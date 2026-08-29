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
      }),
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
      if (specifier === "@/components/authEvents") {
        return { announceAuthState() {} };
      }
      if (specifier === "@/lib/backendRequest") {
        return {
          backendRequest,
          backendUnavailableMessage: (_error, fallback) => fallback,
          BackendRequestTimeoutError: TestBackendRequestTimeoutError,
          waitForBackendReady: async () => {},
        };
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
    10_000
  );

  assert.equal(requestCount, 4);
  assert.deepEqual(retryReasons, [
    "temporarily-unavailable",
    "rate-limited",
    "temporarily-unavailable",
  ]);
  assert.equal(result.state, "state-abcdefghijklmnopqrstuvwxyz-0123456789");
});
