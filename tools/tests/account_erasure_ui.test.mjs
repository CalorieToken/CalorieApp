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
const ACCOUNT_PRIVACY_COPY_PATH = new URL(
  "../../frontend/config/account-privacy-copy.json",
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

async function loadComponentModule(overrides = {}) {
  const requestPolicy = await loadRequestPolicyModule();
  const accountPrivacyCopy = JSON.parse(
    await readFile(ACCOUNT_PRIVACY_COPY_PATH, "utf8")
  );
  const compiled = await transpile(COMPONENT_PATH, true);
  const module = { exports: {} };
  const jsxRuntime = overrides.jsxRuntime ?? {
    Fragment: Symbol("Fragment"),
    jsx() {},
    jsxs() {},
  };
  const context = vm.createContext({
    AbortController,
    console,
    exports: module.exports,
    module,
    require(specifier) {
      if (specifier === "react") {
        return overrides.react ?? {};
      }
      if (specifier === "react/jsx-runtime") {
        return jsxRuntime;
      }
      if (specifier === "@/lib/backendRequest") {
        return {
          BACKEND_WAKE_BASE_URL: "https://backend.example",
          backendRequest() {},
          backendUnavailableMessage(_error, fallback) {
            return fallback;
          },
          waitForBackendReady() {},
          ...overrides.backend,
        };
      }
      if (specifier === "@/lib/accountErasureRequest") {
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
  });
  vm.runInContext(compiled, context);
  return module.exports;
}

function createHookHarness() {
  const state = [];
  const refs = [];
  let stateCursor = 0;
  let refCursor = 0;

  const react = {
    useEffect() {},
    useRef(initialValue) {
      const index = refCursor++;
      if (!(index in refs)) {
        refs[index] = { current: initialValue };
      }
      return refs[index];
    },
    useState(initialValue) {
      const index = stateCursor++;
      if (!(index in state)) {
        state[index] =
          typeof initialValue === "function" ? initialValue() : initialValue;
      }
      return [
        state[index],
        (nextValue) => {
          state[index] =
            typeof nextValue === "function"
              ? nextValue(state[index])
              : nextValue;
        },
      ];
    },
  };
  const jsxRuntime = {
    Fragment: Symbol("Fragment"),
    jsx(type, props) {
      return { type, props: props ?? {} };
    },
    jsxs(type, props) {
      return { type, props: props ?? {} };
    },
  };

  return {
    jsxRuntime,
    react,
    render(Component, props) {
      stateCursor = 0;
      refCursor = 0;
      return Component(props);
    },
  };
}

function findElement(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) {
        return match;
      }
    }
    return null;
  }
  if (!node || typeof node !== "object") {
    return null;
  }
  if (predicate(node)) {
    return node;
  }
  return findElement(node.props?.children, predicate);
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

test("expired authentication always releases the erasure loading state", async () => {
  const harness = createHookHarness();
  const authenticationLosses = [];
  const { AccountErasurePanel } = await loadComponentModule({
    react: harness.react,
    jsxRuntime: harness.jsxRuntime,
    backend: {
      async backendRequest() {
        return { status: 401 };
      },
      async waitForBackendReady() {},
    },
  });
  const props = {
    userId: "user-1",
    onAuthenticationLost(message) {
      authenticationLosses.push(message);
    },
    onErased() {
      assert.fail("401 must not report account erasure");
    },
  };

  let tree = harness.render(AccountErasurePanel, props);
  findElement(
    tree,
    (node) =>
      node.type === "button" &&
      node.props.children === "Review account deletion"
  ).props.onClick();

  tree = harness.render(AccountErasurePanel, props);
  findElement(
    tree,
    (node) => node.type === "input" && node.props.type === "text"
  ).props.onChange({ target: { value: "user-1" } });
  findElement(
    tree,
    (node) => node.type === "input" && node.props.type === "checkbox"
  ).props.onChange({ target: { checked: true } });

  tree = harness.render(AccountErasurePanel, props);
  await findElement(tree, (node) => node.type === "form").props.onSubmit({
    preventDefault() {},
  });

  assert.equal(authenticationLosses.length, 1);
  tree = harness.render(AccountErasurePanel, props);
  const submitButton = findElement(
    tree,
    (node) => node.type === "button" && node.props.type === "submit"
  );
  assert.equal(submitButton.props.disabled, false);
  assert.equal(
    submitButton.props.children,
    "Delete CalorieApp account permanently"
  );
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
    false
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

test("account tools stay available but collapsed below the primary app", async () => {
  const panel = await readFile(PANEL_PATH, "utf8");

  assert.match(panel, /<details className="group border-t/);
  assert.match(panel, /<summary className=/);
  assert.match(panel, /Account tools/);
  assert.match(panel, /Export and privacy options/);
  assert.match(panel, /<AccountDataExportButton/);
  assert.match(panel, /<AccountDataImportPanel/);
  assert.match(panel, /<AccountErasurePanel/);
  assert.doesNotMatch(panel, /<details\s+open/);
});
