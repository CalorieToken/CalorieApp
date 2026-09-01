import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const COMPONENT_PATH = new URL(
  "../../frontend/components/AccountErasurePanel.tsx",
  import.meta.url
);
const REQUEST_POLICY_PATH = new URL(
  "../../frontend/lib/accountErasureRequest.ts",
  import.meta.url
);
const PANEL_PATH = new URL(
  "../../frontend/components/XamanLoginPanel.tsx",
  import.meta.url
);
const ENV_EXAMPLE_PATH = new URL(
  "../../frontend/.env.example",
  import.meta.url
);
const requireFromFrontend = createRequire(
  new URL("../../frontend/package.json", import.meta.url)
);

async function transpile(path, jsx = false) {
  const typescript = requireFromFrontend("typescript");
  const source = await readFile(path, "utf8");
  return typescript.transpileModule(source, {
    compilerOptions: {
      jsx: jsx ? typescript.JsxEmit.ReactJSX : undefined,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
}

async function loadRequestPolicyModule() {
  const compiled = await transpile(REQUEST_POLICY_PATH);
  const module = { exports: {} };
  vm.runInContext(
    compiled,
    vm.createContext({ exports: module.exports, module })
  );
  return module.exports;
}

async function loadComponentModule() {
  const requestPolicy = await loadRequestPolicyModule();
  const compiled = await transpile(COMPONENT_PATH, true);
  const module = { exports: {} };
  const context = vm.createContext({
    console,
    exports: module.exports,
    module,
    require(specifier) {
      if (specifier === "react") {
        return {};
      }
      if (specifier === "react/jsx-runtime") {
        return { Fragment: Symbol("Fragment"), jsx() {}, jsxs() {} };
      }
      if (specifier === "@/lib/backendRequest") {
        return {
          BACKEND_WAKE_BASE_URL: "https://backend.example",
          backendRequest() {},
          backendUnavailableMessage(_error, fallback) {
            return fallback;
          },
          waitForBackendReady() {},
        };
      }
      if (specifier === "@/lib/accountErasureRequest") {
        return requestPolicy;
      }
      throw new Error(`Unexpected require: ${specifier}`);
    },
  });
  vm.runInContext(compiled, context);
  return module.exports;
}

function requestWithHeaders(values = {}) {
  return {
    headers: {
      get(name) {
        return values[name.toLowerCase()] ?? null;
      },
    },
  };
}

test("account erasure confirmation requires the exact account and acknowledgement", async () => {
  const { isAccountErasureConfirmationReady } = await loadComponentModule();

  assert.equal(
    isAccountErasureConfirmationReady("user-1", "user-1", true),
    true
  );
  assert.equal(
    isAccountErasureConfirmationReady("user-1", "user-1", false),
    false
  );
  assert.equal(
    isAccountErasureConfirmationReady("user-1", " user-1", true),
    false
  );
  assert.equal(
    isAccountErasureConfirmationReady("user-1", "user-2", true),
    false
  );
});

test("account erasure response validation fails closed", async () => {
  const { isAccountErasureResponse } = await loadComponentModule();

  assert.equal(isAccountErasureResponse({ status: "erased" }), true);
  assert.equal(isAccountErasureResponse({ status: "pending" }), false);
  assert.equal(isAccountErasureResponse([]), false);
  assert.equal(isAccountErasureResponse(null), false);
});

test("account erasure proxy requires same-origin intent", async () => {
  const { isTrustedAccountErasureRequest } = await loadRequestPolicyModule();
  const path = "api/identity/account";
  const intent = { "x-calorieapp-request": "account-erasure" };

  assert.equal(isTrustedAccountErasureRequest("health", requestWithHeaders()), true);
  assert.equal(
    isTrustedAccountErasureRequest(
      path,
      requestWithHeaders({ "sec-fetch-site": "same-origin", ...intent })
    ),
    true
  );
  assert.equal(
    isTrustedAccountErasureRequest(path, requestWithHeaders(intent)),
    true
  );
  for (const fetchSite of ["cross-site", "same-site", "none"]) {
    assert.equal(
      isTrustedAccountErasureRequest(
        path,
        requestWithHeaders({ "sec-fetch-site": fetchSite, ...intent })
      ),
      false
    );
  }
  assert.equal(
    isTrustedAccountErasureRequest(
      path,
      requestWithHeaders({ "sec-fetch-site": "same-origin" })
    ),
    false
  );
});

test("account erasure UI is doubly disabled and sends no confirmation elsewhere", async () => {
  const [component, panel, envExample] = await Promise.all([
    readFile(COMPONENT_PATH, "utf8"),
    readFile(PANEL_PATH, "utf8"),
    readFile(ENV_EXAMPLE_PATH, "utf8"),
  ]);

  assert.equal(component.includes('method: "DELETE"'), true);
  assert.equal(component.includes('cache: "no-store"'), true);
  assert.equal(component.includes("ACCOUNT_ERASURE_REQUEST_HEADER"), true);
  assert.equal(component.includes("delete-my-calorieapp-account"), true);
  assert.equal(component.includes("localStorage"), false);
  assert.equal(component.includes("sessionStorage"), false);
  assert.equal(component.includes("window.confirm"), false);
  assert.equal(
    panel.includes(
      'process.env.NEXT_PUBLIC_ACCOUNT_ERASURE_UI_ENABLED === "true"'
    ),
    true
  );
  assert.equal(envExample.includes("NEXT_PUBLIC_ACCOUNT_ERASURE_UI_ENABLED=false"), true);
});
