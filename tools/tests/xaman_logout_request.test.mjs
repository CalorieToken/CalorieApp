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

async function loadModule(
  backendRequest,
  waitForBackendReady = async () => {}
) {
  const typescript = requireFromFrontend("typescript");
  const source = await readFile(COMPONENT_PATH, "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
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
          backendRequest,
          backendUnavailableMessage: (_error, fallback) => fallback,
          BackendRequestTimeoutError: class extends Error {},
          waitForBackendReady,
        };
      }
      if (specifier === "@/lib/locales") {
        return { resolveLocale: (value) => value || "en" };
      }
      throw new Error(`Unexpected require: ${specifier}`);
    },
  });

  vm.runInContext(compiled, context);
  return module.exports;
}

test("joint logout uses the same-origin proxy without a readiness wait", async () => {
  const events = [];
  const login = await loadModule(
    async (url) => {
      events.push(`request:${url}`);
      return { status: 204, ok: true };
    },
    async () => {
      throw new Error("logout must not wait for backend readiness");
    }
  );

  await login.requestCalorieAppLogout();

  assert.deepEqual(events, ["request:/api/backend/api/identity/logout"]);
});

test("joint logout accepts an absent app session and rejects backend failure", async () => {
  const responses = [
    { status: 401, ok: false },
    { status: 204, ok: true },
    { status: 500, ok: false },
    { status: 200, ok: true },
  ];
  const calls = [];
  const login = await loadModule(async (url, options, timeoutMs) => {
    calls.push({ url, options, timeoutMs });
    return responses.shift();
  });

  await login.requestCalorieAppLogout();
  await login.requestCalorieAppLogout();
  await assert.rejects(login.requestCalorieAppLogout(), /Unable to log out/);

  assert.equal(calls.length, 4);
  assert.equal(calls[0].url, "/api/backend/api/identity/logout");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[3].url, "/api/backend/api/identity/me");
  assert.equal(calls[3].options.cache, "no-store");
  assert.equal(calls[3].timeoutMs, 5000);
});
