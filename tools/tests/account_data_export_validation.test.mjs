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

async function loadValidator() {
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
  });

  vm.runInContext(compiled, context);
  return module.exports.isVersionedAccountExport;
}

test("private export validation fails closed on malformed reviewed fields", async () => {
  const isVersionedAccountExport = await loadValidator();
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
