import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const REQUEST_HELPER_PATH = new URL(
  "../../frontend/lib/backendRequest.ts",
  import.meta.url
);
const requireFromFrontend = createRequire(
  new URL("../../frontend/package.json", import.meta.url)
);

async function loadBackendRequest(fetch) {
  const typescript = requireFromFrontend("typescript");
  const source = await readFile(REQUEST_HELPER_PATH, "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    AbortController,
    Date,
    Error,
    Math,
    Number,
    Promise,
    URL,
    clearTimeout,
    console,
    fetch,
    module,
    exports: module.exports,
    process: {
      env: { NEXT_PUBLIC_BACKEND_WAKE_URL: "https://backend.example" },
    },
    setTimeout,
  });

  vm.runInContext(compiled, context);
  return module.exports;
}

test("readiness races the public origin with the filter-safe same-origin route", async () => {
  const calls = [];
  const backendRequest = await loadBackendRequest(async (url) => {
    calls.push(url);
    if (url !== "/api/calorieapp/health") {
      throw new Error("synthetic blocked cross-origin request");
    }

    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ status: "ok" }),
    };
  });

  await backendRequest.waitForBackendReady(
    backendRequest.BACKEND_WAKE_BASE_URL,
    undefined,
    1_000
  );

  assert.equal(calls.length, 2);
  assert.deepEqual(
    new Set(calls),
    new Set([
      "https://backend.example/health",
      "/api/calorieapp/health",
    ])
  );
});
