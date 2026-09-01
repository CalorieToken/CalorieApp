import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const COMPONENT_PATH = new URL(
  "../../frontend/components/AccountDataExportButton.tsx",
  import.meta.url
);
const requireFromFrontend = createRequire(
  new URL("../../frontend/package.json", import.meta.url)
);

async function loadAccountDataExportModule(globals = {}) {
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
      throw new Error(`Unexpected require: ${specifier}`);
    },
    ...globals,
  });

  vm.runInContext(compiled, context);
  return module.exports;
}

test("private export validation fails closed on malformed reviewed fields", async () => {
  const { isVersionedAccountExport } = await loadAccountDataExportModule();
  const validPayload = {
    export_version: "calorieapp-account-data-v1",
    account: { user_id: "user-1" },
    food_logs: [],
    external_identities: [],
    authentication_sessions: [],
    authorization_events: [],
    login_handoffs: [],
    excluded_security_fields: [],
  };

  assert.equal(isVersionedAccountExport(validPayload), true);
  assert.equal(
    isVersionedAccountExport({ ...validPayload, account: [] }),
    false
  );

  const { authorization_events: _omitted, ...missingAuthorizationEvents } =
    validPayload;
  assert.equal(isVersionedAccountExport(missingAuthorizationEvents), false);
  assert.equal(
    isVersionedAccountExport({ ...validPayload, authorization_events: {} }),
    false
  );
});

test("private export request uses the shared bounded timeout", async () => {
  const source = await readFile(COMPONENT_PATH, "utf8");

  assert.equal(source.includes("70_000"), false);
});

test("private export keeps its object URL alive long enough to start", async () => {
  let appended = false;
  let clicked = false;
  let removed = false;
  let revokedUrl = null;
  let revocationDelayMs = null;

  class TestBlob {}
  const anchor = {
    click() {
      clicked = true;
    },
    remove() {
      removed = true;
    },
  };
  const { downloadPrivateJson } = await loadAccountDataExportModule({
    Blob: TestBlob,
    URL: {
      createObjectURL() {
        return "blob:private-export";
      },
      revokeObjectURL(value) {
        revokedUrl = value;
      },
    },
    document: {
      createElement(elementName) {
        assert.equal(elementName, "a");
        return anchor;
      },
      body: {
        appendChild(value) {
          assert.equal(value, anchor);
          appended = true;
        },
      },
    },
    window: {
      setTimeout(callback, delayMs) {
        revocationDelayMs = delayMs;
        callback();
      },
    },
  });

  downloadPrivateJson({ export_version: "calorieapp-account-data-v1" });

  assert.equal(appended, true);
  assert.equal(clicked, true);
  assert.equal(removed, true);
  assert.equal(revocationDelayMs, 1_000);
  assert.equal(revokedUrl, "blob:private-export");
});
