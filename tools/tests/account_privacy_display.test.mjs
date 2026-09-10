import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const requireFrontend = createRequire(new URL("../../frontend/package.json", import.meta.url));
const ts = requireFrontend("typescript");
const registry = JSON.parse(await readFile(new URL("../../frontend/config/account-privacy-copy.json", import.meta.url), "utf8"));
const localeRegistry = JSON.parse(await readFile(new URL("../../frontend/config/locales.json", import.meta.url), "utf8"));
const tags = localeRegistry.locales.map(item => item.tag);
const components = { export: "AccountDataExportButton", import: "AccountDataImportPanel", erasure: "AccountErasurePanel" };
const compiled = new Map();
async function compile(path) {
  if (!compiled.has(path)) {
    const source = await readFile(new URL(`../../frontend/${path}`, import.meta.url), "utf8");
    compiled.set(path, ts.transpileModule(source, { compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText);
  }
  return compiled.get(path);
}
async function load(path, imports, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(await compile(path), {
    module, exports: module.exports, TextEncoder, ...globals,
    require(specifier) {
      assert.ok(Object.hasOwn(imports, specifier), `Unexpected import: ${specifier}`);
      return imports[specifier];
    },
  });
  return module.exports;
}
const locales = await load("lib/locales.ts", { "@/config/locales.json": { default: localeRegistry } });
const copy = await load("lib/accountPrivacyCopy.ts", {
  "@/config/account-privacy-copy.json": { default: registry }, "@/lib/locales": locales,
});
const policies = {};
for (const name of ["privateExportRequest", "accountImportRequest", "accountErasureRequest"]) {
  policies[`@/lib/${name}`] = await load(`lib/${name}.ts`, {});
}
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function tick() { for (let n = 0; n < 8; n++) await Promise.resolve(); }
function response(status, payload) {
  return { status, ok: status >= 200 && status < 300, headers: { get: () => "application/json" }, json: async () => payload };
}

async function harness(section, { reply, enabled = true, initial = "en", sourceLocale = "en", realReact = false } = {}) {
  let display = { enabled, locale: initial }, tree, cursor = 0, effects = [];
  const hooks = [], requests = [], lost = [], erased = [], blobs = [], anchors = [], timers = [], revoked = [];
  const hook = init => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = init();
    return index;
  };
  const react = realReact ? requireFrontend("react") : {
    useState(initialValue) {
      const index = hook(() => typeof initialValue === "function" ? initialValue() : initialValue);
      return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
    },
    useRef(initialValue) { return hooks[hook(() => ({ current: initialValue }))]; },
    useEffect(effect, deps) {
      const index = hook(() => null);
      if (!hooks[index] || deps.some((value, i) => value !== hooks[index].deps[i])) {
        effects.push(() => { hooks[index]?.cleanup?.(); hooks[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const jsx = realReact ? requireFrontend("react/jsx-runtime") : {
    jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }),
  };
  const imports = {
    react, "react/jsx-runtime": jsx, ...policies,
    "@/lib/accountPrivacyCopy": copy,
    "@/components/DisplayLanguageProvider": { useDisplayLanguage: () => display },
    "@/lib/backendRequest": {
      BACKEND_WAKE_BASE_URL: "https://backend.example",
      waitForBackendReady: async () => {},
      backendRequest: async (url, options) => { requests.push({ url, ...options }); return typeof reply === "function" ? reply() : reply; },
      backendUnavailableMessage: (error, fallback, timeout) => error?.name === "TestStartupTimeout" ? timeout : fallback,
    },
  };
  const module = await load(`components/${components[section]}.tsx`, imports, {
    AbortController, Blob,
    URL: { createObjectURL: blob => { blobs.push(blob); return "blob:private-test"; }, revokeObjectURL: url => revoked.push(url) },
    document: { body: { appendChild() {} }, createElement: () => {
      const anchor = { clicked: 0, click() { this.clicked++; }, remove() { this.removed = true; } };
      anchors.push(anchor); return anchor;
    } },
    window: { setTimeout: (callback, delay) => timers.push({ callback, delay }) },
  });
  const props = { locale: sourceLocale, userId: "user-1", onAuthenticationLost: message => lost.push(message), onErased: message => erased.push(message) };
  const Component = module[components[section]];
  function render(locale = display.locale) {
    display = { ...display, locale };
    if (realReact) return requireFrontend("react-dom/server").renderToStaticMarkup(react.createElement(Component, props));
    cursor = 0;
    tree = Component(props);
    for (const effect of effects) effect();
    effects = [];
    return tree;
  }
  function input(type, index = 0) { return nodes(tree, node => node.type === "input" && node.props.type === type)[index]; }
  function submitButton() { return nodes(tree, node => node.type === "button" && node.props.type === "submit")[0]; }
  function prepare(acknowledged = true) {
    render();
    if (section === "erasure") {
      nodes(tree, node => node.type === "button")[0].props.onClick(); render();
    }
    if (section === "import") {
      input("file").props.onChange({ target: { files: [file], value: "chosen.json" } }); render();
      input("text", 0).props.onChange({ target: { value: "source-user" } }); render();
      input("text", 1).props.onChange({ target: { value: "user-1" } }); render();
    } else if (section === "erasure") {
      input("text").props.onChange({ target: { value: "user-1" } }); render();
    }
    if (section !== "export") input("checkbox").props.onChange({ target: { checked: acknowledged } });
    return render();
  }
  const bytes = new TextEncoder().encode('{"private":"synthetic test data"}').buffer;
  const file = { name: "private-test.json", size: bytes.byteLength, arrayBuffer: async () => bytes };
  return {
    render, prepare, input, submitButton, requests, lost, erased, props, bytes, blobs, anchors, timers, revoked,
    get tree() { return tree; },
    submit: () => section === "export"
      ? nodes(tree, node => node.type === "button")[0].props.onClick()
      : nodes(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} }),
    close: () => nodes(tree, node => node.type === "button" && node.props.type === "button")[0].props.onClick(),
    unmount: () => hooks.forEach(value => value?.cleanup?.()),
  };
}

test("privacy statuses follow all eleven display locales without translating private values", () => {
  const statusKeys = {
    export: ["session_expired", "review_required", "success", "unavailable"],
    import: ["session_expired", "validation_failed", "import_blocked", "temporarily_unavailable", "file_size_invalid", "success", "already_imported", "unavailable"],
    erasure: ["session_expired", "confirmation_failed", "temporarily_unavailable", "unavailable", "success"],
  };
  for (const from of tags) for (const to of tags) for (const section of Object.keys(components)) {
    const target = copy.getAccountPrivacyCopy(to);
    for (const key of statusKeys[section]) {
      assert.equal(copy.translateAccountPrivacyStatus(registry.locales[from][section][key], section, target), target[section][key]);
    }
    assert.equal(copy.translateAccountPrivacyStatus(registry.locales[from].service_startup_timeout, section, target), target.service_startup_timeout);
    for (const privateText of ["user-1", "<b>private food</b> {locale}", "Unknown provider error"]) {
      assert.equal(copy.translateAccountPrivacyStatus(privateText, section, target), privateText);
    }
  }
});

test("actual React privacy sections render existing eleven-language copy, RTL and default-off fallback", async () => {
  for (const section of Object.keys(components)) {
    const h = await harness(section, { realReact: true });
    for (const locale of tags) {
      const html = h.render(locale);
      assert.ok(html.includes(`lang="${locale}"`));
      assert.ok(html.includes(`dir="${["ar", "ur"].includes(locale) ? "rtl" : "ltr"}"`));
      assert.ok(html.includes(registry.locales[locale][section].title));
      if (section === "import") assert.ok(html.includes('<bdi>user-1</bdi>'));
    }
    assert.ok(h.render("unsupported").includes('lang="en"'));
    const off = await harness(section, { realReact: true, enabled: false, sourceLocale: "nl" });
    assert.ok(off.render("ar").includes('lang="nl"'));
    assert.ok(off.render("ar").includes(registry.locales.nl[section].title));
  }
});

test("language changes keep import confirmation and selected bytes without granting acknowledgement", async () => {
  const h = await harness("import");
  h.prepare(false);
  for (const locale of tags) {
    h.render(locale);
    assert.equal(h.input("text", 0).props.value, "source-user");
    assert.equal(h.input("text", 1).props.value, "user-1");
    assert.equal(h.input("checkbox").props.checked, false);
    assert.equal(h.submitButton().props.disabled, true);
    await h.submit();
  }
  assert.equal(h.requests.length, 0);
});

test("one pending import preserves exact body and headers across all languages then renders current success", async () => {
  const pending = deferred();
  const h = await harness("import", { reply: pending.promise });
  h.prepare();
  const operation = h.submit(); await tick();
  assert.equal(h.requests.length, 1);
  const sent = h.requests[0];
  const policy = policies["@/lib/accountImportRequest"];
  assert.equal(sent.url, `/api/backend/${policy.ACCOUNT_IMPORT_PATH}`);
  assert.equal(sent.method, "POST");
  assert.equal(sent.body, h.bytes);
  assert.deepEqual(JSON.parse(JSON.stringify(sent.headers)), {
    Accept: "application/json", "Content-Type": "application/json",
    [policy.ACCOUNT_IMPORT_REQUEST_HEADER]: policy.ACCOUNT_IMPORT_REQUEST_VALUE,
    [policy.ACCOUNT_IMPORT_SOURCE_HEADER]: "source-user",
    [policy.ACCOUNT_IMPORT_TARGET_HEADER]: "user-1",
    [policy.ACCOUNT_IMPORT_ACKNOWLEDGEMENT_HEADER]: policy.ACCOUNT_IMPORT_ACKNOWLEDGEMENT,
  });
  for (const locale of tags) {
    h.render(locale);
    assert.equal(h.requests.length, 1);
    assert.equal(sent.signal.aborted, false);
    assert.equal(h.input("checkbox").props.checked, true);
    assert.equal(h.input("file").props.disabled, true);
    assert.equal(text(h.submitButton()), registry.locales[locale].import.button_busy);
  }
  pending.resolve(response(200, { import_version: "calorieapp-account-data-import-transaction-v1", status: "imported", imported_food_log_rows: 1 }));
  await operation;
  for (const locale of tags) {
    h.render(locale);
    assert.equal(text(nodes(h.tree, node => node.props?.role === "status")[0]), registry.locales[locale].import.success);
    assert.equal(h.input("text").props.value, "");
    assert.equal(h.input("checkbox").props.checked, false);
  }
  assert.equal(h.requests.length, 1);
});

test("erasure review, exact identifier and acknowledgement survive display switches without a DELETE", async () => {
  const h = await harness("erasure");
  h.prepare(false);
  for (const locale of tags) {
    h.render(locale);
    assert.equal(h.input("text").props.value, "user-1");
    assert.equal(h.input("text").props.dir, "ltr");
    assert.equal(h.input("checkbox").props.checked, false);
    assert.equal(h.submitButton().props.disabled, true);
    await h.submit();
  }
  assert.equal(h.requests.length, 0);
  h.close(); h.render();
  assert.equal(nodes(h.tree, node => node.type === "form").length, 0);
});

test("one explicitly confirmed erasure keeps identity payload and original callback language while pending", async () => {
  const pending = deferred();
  const h = await harness("erasure", { reply: pending.promise, sourceLocale: "nl" });
  h.prepare();
  const operation = h.submit(); await tick();
  assert.equal(h.requests.length, 1);
  const sent = h.requests[0];
  assert.equal(sent.url, "/api/backend/api/identity/account");
  assert.equal(sent.method, "DELETE");
  assert.deepEqual(JSON.parse(sent.body), { confirm_user_id: "user-1", acknowledgement: "delete-my-calorieapp-account" });
  const policy = policies["@/lib/accountErasureRequest"];
  assert.deepEqual(JSON.parse(JSON.stringify(sent.headers)), {
    Accept: "application/json", "Content-Type": "application/json",
    [policy.ACCOUNT_ERASURE_REQUEST_HEADER]: policy.ACCOUNT_ERASURE_REQUEST_VALUE,
  });
  for (const locale of tags) {
    h.render(locale);
    assert.equal(h.requests.length, 1);
    assert.equal(sent.signal.aborted, false);
    assert.equal(h.input("text").props.disabled, true);
    assert.equal(text(h.submitButton()), registry.locales[locale].erasure.button_busy);
    h.close(); h.render();
    assert.equal(nodes(h.tree, node => node.type === "form").length, 1);
  }
  pending.resolve(response(200, { status: "erased" })); await operation;
  assert.deepEqual(h.erased, [registry.locales.nl.erasure.success]);
  assert.deepEqual(h.lost, []);
  assert.equal(h.requests.length, 1);
});

test("export download remains a single private JSON file when the display language changes", async () => {
  const pending = deferred();
  const h = await harness("export", { reply: pending.promise });
  h.prepare();
  const operation = h.submit(); await tick();
  for (const locale of tags) {
    h.render(locale);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].signal.aborted, false);
    assert.equal(text(nodes(h.tree, node => node.type === "button")[0]), registry.locales[locale].export.button_busy);
  }
  const policy = policies["@/lib/privateExportRequest"];
  assert.equal(h.requests[0].url, "/api/backend/api/identity/export");
  assert.equal(h.requests[0].cache, "no-store");
  assert.equal(h.requests[0].body, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests[0].headers)), {
    Accept: "application/json", [policy.PRIVATE_EXPORT_REQUEST_HEADER]: policy.PRIVATE_EXPORT_REQUEST_VALUE,
  });
  const payload = { export_version: "calorieapp-account-data-v2", account: { user_id: "user-1" }, food_logs: [{ product_name: "<b>Tea</b> العربية" }] };
  for (const field of ["external_identities", "authentication_sessions", "authorization_events", "login_handoffs", "inactive_account_notices", "account_import_receipts", "excluded_security_fields"]) payload[field] = [];
  pending.resolve(response(200, payload)); await operation;
  assert.equal(h.blobs.length, 1);
  assert.deepEqual(JSON.parse(await h.blobs[0].text()), payload);
  assert.equal(h.anchors[0].download, "calorieapp-account-data-v2.json");
  assert.equal(h.anchors[0].clicked, 1);
  assert.equal(h.anchors[0].removed, true);
  assert.equal(h.timers[0].delay, 1000);
  h.timers[0].callback(); assert.deepEqual(h.revoked, ["blob:private-test"]);
  for (const locale of tags) {
    h.render(locale);
    assert.equal(text(nodes(h.tree, node => node.props?.role === "status")[0]), registry.locales[locale].export.success);
  }
});

test("existing failure states translate without retries and 401 keeps the authentication callback", async () => {
  const cases = [
    ["export", 409, "review_required"], ["import", 413, "file_size_invalid"],
    ["import", 422, "validation_failed"], ["import", 409, "import_blocked"],
    ["import", 503, "temporarily_unavailable"], ["erasure", 409, "confirmation_failed"],
    ["erasure", 503, "temporarily_unavailable"],
    ...Object.keys(components).map(section => [section, 500, "unavailable"]),
  ];
  for (const [section, status, key] of cases) {
    const h = await harness(section, { reply: response(status), sourceLocale: "nl" });
    h.prepare(); await h.submit();
    for (const locale of tags) {
      h.render(locale);
      assert.equal(text(nodes(h.tree, node => node.props?.role === "alert")[0]), registry.locales[locale][section][key]);
      assert.equal(h.requests.length, 1);
    }
    assert.deepEqual(h.lost, []);
  }
  for (const section of Object.keys(components)) {
    const pending = deferred();
    const h = await harness(section, { reply: pending.promise, sourceLocale: "nl" });
    h.prepare(); const operation = h.submit(); await tick(); h.render("ar");
    pending.resolve(response(401)); await operation;
    assert.deepEqual(h.lost, [registry.locales.nl[section].session_expired]);
    assert.equal(h.requests.length, 1);
  }
});

test("startup timeout and unmount cleanup retain their original request behavior", async () => {
  for (const section of Object.keys(components)) {
    const h = await harness(section, { reply: () => { throw Object.assign(new Error("synthetic"), { name: "TestStartupTimeout" }); } });
    h.prepare(); await h.submit(); h.render("ur");
    assert.equal(text(nodes(h.tree, node => node.props?.role === "alert")[0]), registry.locales.ur.service_startup_timeout);
    const pending = deferred();
    const p = await harness(section, { reply: pending.promise });
    p.prepare(); const operation = p.submit(); await tick();
    p.render("nl"); assert.equal(p.requests[0].signal.aborted, false);
    p.unmount(); assert.equal(p.requests[0].signal.aborted, true);
    pending.resolve(response(500)); await operation;
  }
});
