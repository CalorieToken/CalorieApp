import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const COMPONENT_PATH = new URL(
  "../../frontend/components/AccountDataImportPanel.tsx",
  import.meta.url
);
const REQUEST_POLICY_PATH = new URL(
  "../../frontend/lib/accountImportRequest.ts",
  import.meta.url
);
const ACCOUNT_PRIVACY_COPY_PATH = new URL(
  "../../frontend/config/account-privacy-copy.json",
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
  vm.runInContext(compiled, vm.createContext({ exports: module.exports, module }));
  return module.exports;
}

async function loadComponentModule() {
  const requestPolicy = await loadRequestPolicyModule();
  const accountPrivacyCopy = JSON.parse(
    await readFile(ACCOUNT_PRIVACY_COPY_PATH, "utf8")
  );
  const compiled = await transpile(COMPONENT_PATH, true);
  const module = { exports: {} };
  vm.runInContext(
    compiled,
    vm.createContext({
      AbortController,
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
        if (specifier === "@/lib/accountImportRequest") {
          return requestPolicy;
        }
        if (specifier === "@/lib/accountPrivacyCopy") {
          return {
            getAccountPrivacyCopy() {
              return {
                locale: "en",
                direction: "ltr",
                ...accountPrivacyCopy.locales.en,
              };
            },
          };
        }
        throw new Error(`Unexpected require: ${specifier}`);
      },
    })
  );
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

test("private import confirmation requires file, source, exact target and acknowledgement", async () => {
  const {
    ACCOUNT_IMPORT_MAX_BYTES,
    isAccountDataImportConfirmationReady,
  } = await loadComponentModule();
  const file = { size: ACCOUNT_IMPORT_MAX_BYTES };

  assert.equal(
    isAccountDataImportConfirmationReady("target", "source", "target", true, file),
    true
  );
  assert.equal(
    isAccountDataImportConfirmationReady("target", "", "target", true, file),
    false
  );
  assert.equal(
    isAccountDataImportConfirmationReady("target", "source", " target", true, file),
    false
  );
  assert.equal(
    isAccountDataImportConfirmationReady("target", "source", "target", false, file),
    false
  );
  assert.equal(
    isAccountDataImportConfirmationReady(
      "target",
      "source",
      "target",
      true,
      { size: ACCOUNT_IMPORT_MAX_BYTES + 1 }
    ),
    false
  );
});

test("private import response validation is strict and bounded", async () => {
  const { isAccountDataImportResponse } = await loadComponentModule();
  const valid = {
    import_version: "calorieapp-account-data-import-transaction-v1",
    status: "imported",
    imported_food_log_rows: 1,
  };

  assert.equal(isAccountDataImportResponse(valid), true);
  assert.equal(
    isAccountDataImportResponse({ ...valid, status: "pending" }),
    false
  );
  assert.equal(
    isAccountDataImportResponse({ ...valid, imported_food_log_rows: 10_001 }),
    false
  );
  assert.equal(isAccountDataImportResponse(null), false);
});

test("private import proxy requires exact same-origin intent", async () => {
  const { isTrustedAccountImportRequest } = await loadRequestPolicyModule();
  const path = "api/identity/import";
  const intent = { "x-calorieapp-request": "account-import" };

  assert.equal(isTrustedAccountImportRequest("health", requestWithHeaders()), true);
  assert.equal(
    isTrustedAccountImportRequest(
      path,
      requestWithHeaders({ "sec-fetch-site": "same-origin", ...intent })
    ),
    true
  );
  assert.equal(
    isTrustedAccountImportRequest(path, requestWithHeaders(intent)),
    false
  );
  for (const fetchSite of ["cross-site", "same-site", "none"]) {
    assert.equal(
      isTrustedAccountImportRequest(
        path,
        requestWithHeaders({ "sec-fetch-site": fetchSite, ...intent })
      ),
      false
    );
  }
  assert.equal(
    isTrustedAccountImportRequest(
      path,
      requestWithHeaders({ "sec-fetch-site": "same-origin" })
    ),
    false
  );
});

test("private import UI keeps the file transient and uses exact raw bytes", async () => {
  const source = await readFile(COMPONENT_PATH, "utf8");

  assert.equal(source.includes("selectedFile.arrayBuffer()"), true);
  assert.equal(source.includes("body: payload"), true);
  assert.equal(source.includes("ACCOUNT_IMPORT_SOURCE_HEADER"), true);
  assert.equal(source.includes("ACCOUNT_IMPORT_TARGET_HEADER"), true);
  assert.equal(source.includes("ACCOUNT_IMPORT_ACKNOWLEDGEMENT_HEADER"), true);
  assert.equal(source.includes("localStorage"), false);
  assert.equal(source.includes("sessionStorage"), false);
  assert.equal(source.includes("FileReader"), false);
  assert.equal(source.includes("dangerouslySetInnerHTML"), false);
});
