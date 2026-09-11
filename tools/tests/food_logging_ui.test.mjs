import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const requireFromFrontend = createRequire(new URL("../../frontend/package.json", import.meta.url));
const typescript = requireFromFrontend("typescript");
const filterCopy = JSON.parse(await readFile(new URL("../../frontend/config/food-log-filter-copy.json", import.meta.url), "utf8"));
const localeRegistry = JSON.parse(await readFile(new URL("../../frontend/config/locales.json", import.meta.url), "utf8"));
const usdaReference = JSON.parse(await readFile(new URL("../../frontend/data/usda-reference-foods.json", import.meta.url), "utf8"));
const usdaCopy = JSON.parse(await readFile(new URL("../../frontend/config/usda-reference-copy.json", import.meta.url), "utf8"));
const foodUiCopy = JSON.parse(await readFile(new URL("../../frontend/config/food-ui-copy.json", import.meta.url), "utf8"));
async function loadLibrary(name, imports, globals = {}) {
  const source = await readFile(new URL(`../../frontend/lib/${name}.ts`, import.meta.url), "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, ...globals,
    require(specifier) {
      if (Object.hasOwn(imports, specifier)) return imports[specifier];
      throw new Error(`Unexpected filter import: ${specifier}`);
    },
  });
  return module.exports;
}
const locales = await loadLibrary("locales", { "@/config/locales.json": { default: localeRegistry } });
const foodLogFilter = await loadLibrary("foodLogFilter", {
  "@/config/food-log-filter-copy.json": { default: filterCopy },
  "@/lib/locales": locales,
});
const foodUi = await loadLibrary("foodUi", {
  "@/config/food-ui-copy.json": { default: foodUiCopy },
  "@/lib/locales": locales,
});
const usdaMath = await loadLibrary("usdaReference", {});
const barcode = await loadLibrary("foodBarcode", {});
const barcodeCopy = JSON.parse(await readFile(new URL("../../frontend/config/barcode-copy.json", import.meta.url), "utf8"));
const searchAvailability = await loadLibrary("foodSearchAvailability", {});
const diary = await loadLibrary("foodDiary", {
  "@/config/diary-copy.json": {default: JSON.parse(await readFile(new URL("../../frontend/config/diary-copy.json", import.meta.url), "utf8"))},
}, {URLSearchParams});
function overview(entries) {
  return {entries, next_before: null, count: entries.length,
    ...Object.fromEntries(["calories","protein","fat","carbohydrates"].map(key => [key, entries.reduce((sum, item) => sum + item[key], 0)])),
    grades: Object.fromEntries(["A","B","C","D","E"].map(grade => [grade, entries.filter(item => item.nutri_score?.trim().toUpperCase() === grade).length]))};
}
const AUTH_EVENT = "test-auth-state-changed";
const foods = Array.from({ length: 30 }, (_, index) => ({
  product_name: index === 0 ? "Banana" : `Oats ${index}`,
  brand: `Brand ${index}`,
  barcode: String(10000 + index),
  calories: 200, protein: 10, fat: 4, carbohydrates: 32,
}));

function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}

function button(tree, label) {
  const result = nodes(tree, (node) => node.type === "button" && text(node).trim() === label);
  assert.equal(result.length, 1, `Expected one ${label} button`);
  return result[0];
}

async function harness(componentName = "FoodSearchPlaceholder", postResponse, logsResponse, searchResponse, warmupResponse, deleteResponse) {
  const source = await readFile(new URL(`../../frontend/components/${componentName}.tsx`, import.meta.url), "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { jsx: typescript.JsxEmit.ReactJSX, module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  const hooks = [], listeners = new Map(), requests = [], focusEvents = [];
  const confirmations = [];
  let now = Date.parse("2026-09-10T12:00:00Z"), timerId = 0, warmups = 0;
  const timers = new Map();
  class ClockDate extends Date { static now() { return now; } }
  const readiness = await loadLibrary("foodSearchReadiness", {
    "@/lib/backendRequest": {
      BACKEND_WAKE_BASE_URL: "https://backend.example",
      waitForBackendReady: async () => { warmups++; if (warmupResponse) await warmupResponse(); },
    },
  }, { AbortController, Date: ClockDate });
  let confirmAnswer = false;
  const document = { body: {}, activeElement: null, documentElement: { lang: "en" } };
  document.activeElement = document.body;
  let cursor = 0, effects = [], tree, currentRefs = new Set(), props = {}, saved = [];
  let displayLanguage = { enabled: false, locale: "en" };
  const hook = (initial) => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = initial();
    return index;
  };
  const sameDeps = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const react = {
    useState(initial) {
      const index = hook(() => typeof initial === "function" ? initial() : initial);
      return [hooks[index], (value) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
    },
    useRef(initial) { return hooks[hook(() => ({ current: initial }))]; },
    useId() { return hooks[hook(() => `test-region-${cursor}`)]; },
    useMemo(factory, deps) {
      const index = hook(() => null);
      if (!sameDeps(hooks[index]?.deps, deps)) hooks[index] = { deps, value: factory() };
      return hooks[index].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = hook(() => null);
      if (!sameDeps(hooks[index]?.deps, deps)) {
        effects.push(() => {
          hooks[index]?.cleanup?.();
          hooks[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, AbortController, console, URL, URLSearchParams, document,
    Date: ClockDate,
    setInterval(callback) { timers.set(++timerId, callback); return timerId; },
    clearInterval(id) { timers.delete(id); },
    navigator: { language: "en", languages: ["en"] },
    window: {
      location: { search: "" },
      confirm(message) { confirmations.push(message); return confirmAnswer; },
      addEventListener(name, listener) { listeners.set(name, listener); },
      removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); },
    },
    require(specifier) {
      if (specifier === "react") return react;
      if (specifier === "react/jsx-runtime") {
        const jsx = (type, props, key) => ({ type, props, key });
        return { jsx, jsxs: jsx, Fragment: "Fragment" };
      }
      if (specifier === "next/image") return { __esModule: true, default: "Image" };
      if (specifier === "@/components/authEvents") return { AUTH_STATE_CHANGED_EVENT: AUTH_EVENT };
      if (specifier === "@/lib/foodLogFilter") return foodLogFilter;
      if (specifier === "@/lib/foodDiary") return diary;
      if (specifier === "@/lib/foodUi") return foodUi;
      if (specifier === "@/lib/usdaReference") return usdaMath;
      if (specifier === "@/lib/foodBarcode") return barcode;
      if (specifier === "@/config/barcode-copy.json") return { default: barcodeCopy };
      if (specifier === "@/lib/foodSearchReadiness") return readiness;
      if (specifier === "@/lib/foodSearchAvailability") return {
        foodSearchRetryAt: (status, header) => searchAvailability.foodSearchRetryAt(status, header, now),
      };
      if (specifier === "@/components/DisplayLanguageProvider") return {
        useDisplayLanguage: () => displayLanguage,
      };
      if (specifier === "@/lib/locales") return locales;
      if (specifier === "@/data/usda-reference-foods.json") return { default: usdaReference };
      if (specifier === "@/config/usda-reference-copy.json") return { default: usdaCopy };
      if (specifier.startsWith("@/components/")) {
        const name = specifier.split("/").at(-1);
        return { [name]: name };
      }
      if (specifier === "@/lib/backendRequest") return {
        BACKEND_WAKE_BASE_URL: "https://backend.example",
        waitForBackendReady: async () => { warmups++; if (warmupResponse) await warmupResponse(); },
        backendUnavailableMessage: (_error, fallback) => fallback,
        async backendRequest(url, options) {
          requests.push({ url, options });
          if (url.includes("/search-food?")) return searchResponse
            ? await searchResponse() : { ok: true, json: async () => ({ results: foods }) };
          if (url.endsWith("/log-food")) {
            const response = postResponse ? await postResponse() : { ok: true, status: 201 };
            if (response.ok) saved.push({ ...JSON.parse(options.body), id: saved.length + 1 });
            return response;
          }
          if (options?.method === "DELETE" && /\/logs(?:\/\d+)?$/.test(url)) {
            const response = deleteResponse ? await deleteResponse() : { ok: true, status: 204 };
            if (response.ok) saved = url.endsWith('/logs') ? [] : saved.filter(item => item.id !== Number(url.split('/').at(-1)));
            return response;
          }
          if (url.includes("/logs/overview?")) {
            const response = logsResponse ? await logsResponse() : null;
            return response ? {...response, json: async () => { const value = await response.json(); return Array.isArray(value) ? overview(value) : value; }} : { ok: true, json: async () => overview(saved) };
          }
          throw new Error(`Unexpected request: ${url}`);
        },
      };
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });
  const render = (nextProps = props) => {
    props = nextProps;
    cursor = 0;
    effects = [];
    tree = module.exports[componentName](props);
    const refNodes = nodes(tree, (node) => node.props?.ref);
    const nextRefs = new Set(refNodes.map((node) => node.props.ref));
    for (const ref of currentRefs) if (!nextRefs.has(ref)) {
      if (document.activeElement === ref.current) document.activeElement = document.body;
      ref.current = null;
    }
    for (const node of refNodes) if (!node.props.ref.current) {
      node.props.ref.current = {
        focus(options) { document.activeElement = this; focusEvents.push({ type: "focus", element: node.type, options }); },
        scrollIntoView(options) { focusEvents.push({ type: "scroll", options }); },
      };
    }
    currentRefs = nextRefs;
    for (const effect of effects) effect();
    return tree;
  };
  if (componentName === "FoodSearchPlaceholder") render();
  return {
    render, requests, focusEvents, document, confirmations,
    get warmups() { return warmups; },
    advance(ms) { now += ms; for (const callback of timers.values()) callback(); return render(); },
    answerConfirmation(value) { confirmAnswer = value; },
    setDisplayLanguage(locale) { displayLanguage = { enabled: true, locale }; return render(); },
    get tree() { return tree; },
    cards() { return nodes(tree, (node) => node.type === "FoodCard"); },
    controls() { return this.cards().find((card) => card.props.children)?.props.children ?? null; },
    async flush() { await new Promise(setImmediate); return render(); },
    async search(query = "oats") {
      nodes(tree, (node) => node.type === "SearchBar")[0].props.onQueryChange(query);
      render();
      await nodes(tree, (node) => node.type === "SearchBar")[0].props.onSubmit({ preventDefault() {} });
      render();
    },
    choose(index) { this.cards()[index].props.onLog(); render(); },
    submit() { this.controls().props.onSubmit({ preventDefault() {} }); render(); },
    async period(value, date = diary.localDiaryDate()) {
      nodes(tree, node => node.type === "FoodDiaryPeriod")[0].props.onChange(value, date);
      render(); await this.flush();
    },
    login() { listeners.get(AUTH_EVENT)?.({ detail: { authenticated: true } }); render(); },
    logout() { listeners.get(AUTH_EVENT)?.({ detail: { authenticated: false } }); render(); },
  };
}

test("USDA reference keeps the dated provider records and an explicit edible 100 g basis", () => {
  assert.equal(usdaReference.source_id, "usda_fooddata_central");
  assert.equal(usdaReference.licence_id, "CC0-1.0");
  assert.equal(usdaReference.scope, "bundled-reference-only");
  assert.equal(usdaReference.verification_status, "provider-reported-not-independently-verified");
  assert.deepEqual(usdaReference.basis, { quantity: 100, unit: "g", portion: "edible" });
  assert.equal(usdaReference.selected_energy_nutrient_id, 2047);
  assert.deepEqual(usdaReference.foods.map((food) => food.fdc_id), [2258586, 2261421, 2257046]);
  for (const food of usdaReference.foods) {
    assert.equal(food.data_type, "Foundation");
    assert.match(food.source_sha256, /^[a-f0-9]{64}$/);
    assert.equal(food.retrieved_at.slice(0, 10), usdaReference.retrieved_on);
    assert.ok(Number.isFinite(Date.parse(food.publication_date)));
    assert.equal(new Set(food.nutrients.map((n) => n.id)).size, food.nutrients.length);
    for (const id of [2047, 1003, 1004, 1005]) {
      const nutrient = food.nutrients.find((n) => n.id === id);
      assert.ok(nutrient, `Missing ${id} in FDC ${food.fdc_id}`);
      assert.equal(nutrient.unit, id === 2047 ? "kcal" : "g");
      assert.equal(typeof nutrient.amount, "number");
      assert.ok(Number.isFinite(nutrient.amount) && nutrient.amount >= 0);
      assert.ok(!(nutrient.amount === 0 && nutrient.loq !== null));
    }
  }
});

test("USDA reference displays source values without combining energy methods or logging them", async () => {
  const before = JSON.stringify(usdaReference);
  const app = await harness("UsdaReferenceFoods");
  const tree = app.render();
  assert.equal(tree.type, "details");
  assert.equal(tree.props.open, undefined);
  const entries = nodes(tree, (node) => node.type === "li");
  assert.equal(entries.length, 3);
  const expectedValues = [
    ["47.99 kcal", "0.94 g", "0.35 g", "10.27 g"],
    ["389.13 kcal", "13.17 g", "6.31 g", "69.92 g"],
    ["48.33 kcal", "0.8 g", "2.75 g", "5.1 g"],
  ];
  entries.forEach((entry, index) => {
    assert.deepEqual(nodes(entry, (node) => node.type === "dd").map((node) => text(node).replace(/\s+/g, " ").trim()), expectedValues[index]);
    const source = nodes(entry, (node) => node.type === "a")[0];
    const url = new URL(source.props.href);
    assert.equal(url.origin, "https://fdc.nal.usda.gov");
    assert.equal(url.pathname, "/food-search/");
    assert.deepEqual([...url.searchParams.keys()], ["query"]);
    assert.equal(url.searchParams.get("query"), usdaReference.foods[index].description);
    assert.equal(source.props.rel, "noopener noreferrer");
    assert.ok(text(source).includes(String(usdaReference.foods[index].fdc_id)));
  });
  assert.ok(text(tree).includes(usdaCopy.en.scope));
  assert.ok(text(tree).includes(usdaCopy.en.basis));
  assert.ok(text(tree).includes(usdaCopy.en.method));
  assert.equal(nodes(tree, (node) => node.type === "time")[0].props.dateTime, usdaReference.retrieved_on);
  assert.ok(nodes(tree, (node) => node.type === "a").some((node) => node.props.href === usdaReference.licence_url));
  assert.equal(nodes(tree, (node) => ["form", "iframe", "img", "script", "FoodCard"].includes(node.type)).length, 0);
  await app.flush();
  app.login();
  app.logout();
  assert.deepEqual(app.requests, []);
  assert.equal(JSON.stringify(usdaReference), before);
});

test("USDA reference distinguishes measured zero from missing, invalid-unit and censored values", async () => {
  const energy = usdaReference.foods[0].nutrients.find((nutrient) => nutrient.id === 2047);
  const original = { ...energy };
  try {
    for (const [change, expected] of [
      [{ amount: 0, loq: null }, "0 kcal"],
      [{ amount: null }, usdaCopy.en.unavailable],
      [{ unit: "kJ" }, usdaCopy.en.unavailable],
      [{ amount: 0, loq: 0.1 }, usdaCopy.en.unavailable],
    ]) {
      Object.assign(energy, original, change);
      const app = await harness("UsdaReferenceFoods");
      const value = nodes(app.render(), (node) => node.type === "dd")[0];
      assert.equal(text(value).replace(/\s+/g, " ").trim(), expected);
    }
  } finally {
    Object.assign(energy, original);
  }
});

test("USDA reference preserves all eleven locales, RTL and the supplied English food names", async () => {
  assert.deepEqual(Object.keys(usdaCopy).sort(), localeRegistry.locales.map((locale) => locale.tag).sort());
  for (const locale of localeRegistry.locales) {
    assert.deepEqual(Object.keys(usdaCopy[locale.tag]).sort(), Object.keys(usdaCopy.en).sort());
    assert.ok(Object.values(usdaCopy[locale.tag]).every((value) => typeof value === "string" && value.trim()));
    const app = await harness("UsdaReferenceFoods");
    app.document.documentElement.lang = locale.tag;
    app.render();
    const tree = app.render();
    assert.equal(tree.props.lang, locale.tag);
    assert.equal(tree.props.dir, locale.direction);
    assert.ok(text(tree).includes(usdaCopy[locale.tag].basis));
    for (const heading of nodes(tree, (node) => node.type === "h3")) {
      assert.equal(heading.props.lang, "en");
      assert.equal(heading.props.dir, "ltr");
    }
    assert.deepEqual(app.requests, []);
  }
});

test("a portion opens inside the chosen result, with its product identity beside confirmation", async () => {
  const h = await harness();
  await h.search();
  h.choose(0);
  assert.equal(h.cards().length, 30);
  assert.equal(h.cards()[0].props.children.type, "form");
  assert.equal(h.cards().filter((card) => card.props.children).length, 1);
  assert.match(text(h.controls()), /Banana/);
  assert.match(text(h.controls()), /Brand 0/);
  assert.equal(button(h.controls(), "Add to food log").props.disabled, false);
  h.choose(15);
  assert.equal(h.cards()[0].props.children, null);
  assert.match(text(h.controls()), /Oats 15/);
  button(h.controls(), "Cancel").props.onClick();
  h.render();
  assert.equal(h.controls(), null);
  assert.equal(h.requests.filter((request) => request.url.endsWith("/log-food")).length, 0);
});

test("half a selected food posts the same scaled nutrition and confirms beside that result", async () => {
  const h = await harness();
  await h.search();
  h.choose(4);
  button(h.controls(), "Half - 50%").props.onClick();
  h.render();
  assert.match(text(h.controls()), /50.*Oats 4/);
  h.submit();
  await h.flush();
  const payload = JSON.parse(h.requests.find((request) => request.url.endsWith("/log-food")).options.body);
  assert.equal(payload.product_name, "Oats 4");
  assert.equal(payload.portion_percentage, 50);
  assert.deepEqual([payload.calories, payload.protein, payload.fat, payload.carbohydrates], [100, 5, 2, 16]);
  assert.equal(h.controls(), null);
  assert.match(h.cards()[4].props.feedback.message, /Added Oats 4 \(50%\)/);
  h.logout();
  assert.ok(h.cards().every((card) => !card.props.feedback && !card.props.children));
});

test("invalid custom portions cannot save and a new search clears the old selection", async () => {
  const h = await harness();
  await h.search();
  h.choose(0);
  button(h.controls(), "Custom").props.onClick();
  h.render();
  nodes(h.controls(), (node) => node.type === "input")[0].props.onChange({ target: { value: "0" } });
  h.render();
  assert.equal(button(h.controls(), "Add to food log").props.disabled, true);
  h.submit();
  await h.flush();
  assert.equal(h.requests.filter((request) => request.url.endsWith("/log-food")).length, 0);
  assert.equal(nodes(h.controls(), (node) => node.props?.id === "portion-validation").length, 1);
  assert.equal(nodes(h.controls(), (node) => node.type === "ErrorBanner").length, 0);
  assert.equal((text(h.controls()).match(/Enter a valid custom percentage/g) ?? []).length, 1);
  await h.search("banana");
  assert.equal(h.controls(), null);
  assert.ok(h.cards().every((card) => !card.props.feedback));
});

test("saving prevents duplicate submissions, changing products and replacing search results", async () => {
  let finish;
  const h = await harness("FoodSearchPlaceholder", () => new Promise((resolve) => { finish = resolve; }));
  await h.search();
  h.choose(1);
  h.submit();
  assert.ok(h.cards().every((card) => card.props.isDisabled));
  h.submit();
  h.choose(2);
  await h.search("different query");
  assert.match(text(h.controls()), /Oats 1/);
  assert.equal(h.requests.filter((request) => request.url.endsWith("/log-food")).length, 1);
  assert.equal(h.requests.filter((request) => request.url.includes("/search-food?")).length, 1);
  finish({ ok: true, status: 201 });
  await h.flush();
  assert.match(h.cards()[1].props.feedback.message, /Added Oats 1/);
});

test("save errors stay with the food, while an expired session gives an inline sign-in message", async () => {
  for (const status of [409, 500, 401]) {
    const h = await harness("FoodSearchPlaceholder", async () => ({ ok: false, status }));
    await h.search();
    h.choose(8);
    h.submit();
    await h.flush();
    if (status === 401) {
      assert.equal(h.controls(), null);
      assert.equal(h.cards()[8].props.feedback.isError, true);
      assert.match(h.cards()[8].props.feedback.message, /Sign in with Xaman/);
    } else {
      const errors = nodes(h.controls(), (node) => node.type === "ErrorBanner");
      assert.equal(errors.length, 1);
      assert.match(errors[0].props.message, status === 409 ? /storage limit/ : /Unable to log/);
      assert.match(text(h.controls()), /Oats 8/);
      assert.equal(button(h.controls(), "Add to food log").props.disabled, false);
    }
  }
});

test("saving preserves the sign-in prompt or log-loading error until the log state actually changes", async () => {
  for (const status of [401, 503]) {
    let finish, logLoads = 0;
    const h = await harness(
      "FoodSearchPlaceholder",
      () => new Promise((resolve) => { finish = resolve; }),
      () => ++logLoads === 1 ? { ok: false, status } : null,
    );
    h.login();
    await h.flush();
    await h.search();
    h.choose(1);
    const visibleLogState = () => ({
      signIn: /Sign in to manage your food log/.test(text(h.tree)),
      loadErrors: nodes(h.tree, (node) => node.type === "ErrorBanner")
        .map((node) => node.props.message).filter((message) => /Unable to load logged foods/.test(message)),
    });
    const before = visibleLogState();
    assert.deepEqual(before, status === 401
      ? { signIn: true, loadErrors: [] }
      : { signIn: false, loadErrors: ["Unable to load logged foods right now."] });
    h.submit();
    assert.deepEqual(visibleLogState(), before, "Saving must preserve the unrelated log section's message.");
    assert.doesNotMatch(text(h.tree), /Period overview/, "Do not briefly show an empty summary during the save.");
    assert.equal(h.requests.filter((request) => request.url.endsWith("/log-food")).length, 1);
    finish(status === 401 ? { ok: false, status: 401 } : { ok: true, status: 201 });
    await h.flush();
    if (status === 401) {
      assert.deepEqual(visibleLogState(), before);
      assert.match(h.cards()[1].props.feedback.message, /Sign in with Xaman/);
    } else {
      assert.deepEqual(visibleLogState(), { signIn: false, loadErrors: [] });
      assert.match(text(h.tree), /Period overview/);
      assert.match(h.cards()[1].props.feedback.message, /Added Oats 1/);
    }
  }
});

test("a response arriving after logout cannot restore the former selection or success message", async () => {
  let finish;
  const h = await harness("FoodSearchPlaceholder", () => new Promise((resolve) => { finish = resolve; }));
  await h.search();
  h.choose(3);
  h.submit();
  h.logout();
  finish({ ok: true, status: 201 });
  await h.flush();
  assert.equal(h.controls(), null);
  assert.ok(h.cards().every((card) => !card.props.feedback));
  assert.equal(h.requests.filter((request) => request.url.includes("/logs/overview?")).length, 0);
});

test('Late single/bulk delete replies and failures cannot replace the logged-out state or issue another private read', async () => {
  for (const bulk of [false, true]) for (const outcome of [204, 401, 500, 'network']) {
    let finish, reject;
    const h = await harness('FoodSearchPlaceholder', undefined, undefined, undefined, undefined,
      () => new Promise((resolve, fail) => { finish = resolve; reject = fail; }));
    await h.search(); h.choose(0); h.submit(); await h.flush(); h.login(); await h.flush(); await h.period("all"); h.answerConfirmation(true);
    const list = nodes(h.tree, node => node.type === 'FoodLogList')[0];
    const pending = bulk ? list.props.onDeleteAllLogs() : list.props.onDeleteLog(1);
    h.logout(); const count = h.requests.length;
    if (outcome === 'network') reject(new Error('Offline')); else finish({ok: outcome === 204, status: outcome});
    await pending; await h.flush();
    assert.equal(h.requests.length, count, 'A reply from the signed-out session must not fetch private logs again');
    assert.ok(text(h.tree).includes(foodUiCopy.en.signInTitle));
    assert.equal(nodes(h.tree, node => node.type === 'FoodLogList').length, 0);
    assert.equal(nodes(h.tree, node => node.type === 'ErrorBanner').length, 0);
  }
});

test('An old delete authorization failure does not clear a newly signed-in diary', async () => {
  let finish;
  const h = await harness('FoodSearchPlaceholder', undefined, undefined, undefined, undefined,
    () => new Promise(resolve => { finish = resolve; }));
  await h.search(); h.choose(0); h.submit(); await h.flush();
  const pending = nodes(h.tree, node => node.type === 'FoodLogList')[0].props.onDeleteLog(1);
  h.logout(); h.login(); await h.flush();
  assert.equal(nodes(h.tree, node => node.type === 'FoodLogList').length, 1);
  finish({ok: false, status: 401}); await pending; await h.flush();
  assert.equal(nodes(h.tree, node => node.type === 'FoodLogList').length, 1);
  assert.ok(!text(h.tree).includes(foodUiCopy.en.signInTitle));
});

test("expanding a card reveals its portion region once and restores keyboard focus on cancel", async () => {
  const h = await harness("FoodCard");
  const props = { item: foods[0], isLogging: false, onLog() {}, formatNumber: String };
  h.render(props);
  h.render({ ...props, children: { type: "form", props: { children: "Portion controls" } } });
  assert.deepEqual(h.focusEvents.map((event) => event.type), ["focus", "scroll"]);
  assert.equal(nodes(h.tree, (node) => node.props?.role === "region")[0].props["aria-label"], "Choose a portion for Banana");
  h.render({ ...props, children: { type: "form", props: { children: "Changed portion" } } });
  assert.equal(h.focusEvents.length, 2, "Changing a portion must not scroll the page again");
  h.render(props);
  assert.equal(h.focusEvents.at(-1).element, "button");
  h.render({ ...props, children: { type: "form", props: {} } });
  h.document.activeElement = {};
  const before = h.focusEvents.length;
  h.render(props);
  assert.equal(h.focusEvents.length, before, "Closing must not take focus from another control");
});

const diaryEntries = Object.freeze([
  Object.freeze({ ...foods[0], id: 41, product_name: "Crème fraîche", brand: "Dairy", barcode: "0012345" }),
  Object.freeze({ ...foods[1], id: 42, product_name: "Oats", brand: "Harvest" }),
]);

function diaryProps(overrides = {}) {
  return {
    logs: diaryEntries, onRefresh() {}, onSelectLog() {}, onDeleteLog() {}, onDeleteAllLogs() {},
    deletingLogId: null, isClearingAll: false, isLoading: false, formatNumber: String,
    ...overrides,
  };
}

function filterInput(h) {
  return nodes(h.tree, (node) => node.type === "input" && node.props.type === "search")[0];
}

function setDiaryFilter(h, value) {
  filterInput(h).props.onChange({ target: { value } });
  h.render();
}

test("diary search preserves records and matches names, brands and leading-zero barcodes", () => {
  for (const [query, id] of [[" CREME ", 41], ["HARVEST", 42], ["0012345", 41]]) {
    const result = foodLogFilter.filterLoggedFoods(diaryEntries, query);
    assert.equal(result.length, 1);
    assert.equal(result[0], diaryEntries.find((entry) => entry.id === id));
  }
  assert.equal(foodLogFilter.filterLoggedFoods(diaryEntries, "   "), diaryEntries);
  assert.equal(foodLogFilter.filterLoggedFoods(diaryEntries, "missing" ).length, 0);
  assert.equal(diaryEntries[0].calories, 200);
  assert.equal(diaryEntries[0].barcode, "0012345");
});

test("filtering changes only the visible list and prevents ambiguous bulk deletion", async () => {
  const calls = [];
  const h = await harness("FoodLogList");
  h.render(diaryProps({
    onSelectLog: (entry) => calls.push(entry), onDeleteLog: (id) => calls.push(id),
    onDeleteAllLogs: () => calls.push("all"), onRefresh: () => calls.push("refresh"),
  }));
  setDiaryFilter(h, "harvest");
  assert.equal(nodes(h.tree, (node) => node.type === "li").length, 1);
  assert.match(text(h.tree), /1 of 2 loaded entries/);
  assert.ok(text(h.tree).includes(diary.diaryCopy("en").listScope));
  assert.equal(button(h.tree, "Delete All").props.disabled, true);
  assert.ok(text(h.tree).includes(diary.diaryCopy("en").deleteHint));
  assert.deepEqual(calls, []);
  assert.deepEqual(h.requests, []);
  nodes(h.tree, (node) => node.props?.["aria-label"] === "View details for Oats")[0].props.onClick();
  button(h.tree, "Delete").props.onClick();
  assert.equal(calls[0], diaryEntries[1]);
  assert.equal(calls[1], 42);
  button(h.tree, "Clear filter").props.onClick();
  h.render();
  assert.equal(filterInput(h).props.value, "");
  assert.equal(nodes(h.tree, (node) => node.type === "li").length, 2);
  assert.equal(button(h.tree, "Delete All").props.disabled, false);
  assert.equal(h.document.activeElement, filterInput(h).props.ref.current);
});

test("an empty filtered result remains clearable by keyboard and reacts to refreshed logs", async () => {
  const h = await harness("FoodLogList");
  const props = diaryProps();
  h.render(props);
  setDiaryFilter(h, "missing");
  assert.match(text(h.tree), /No matching entries/);
  assert.equal(nodes(h.tree, (node) => node.type === "li").length, 0);
  assert.equal(button(h.tree, "Delete All").props.disabled, true);
  h.render({ ...props, logs: [{ ...diaryEntries[0], product_name: "Missing food" }] });
  assert.equal(nodes(h.tree, (node) => node.type === "li").length, 1);
  filterInput(h).props.onKeyDown({ key: "Escape" });
  h.render();
  assert.equal(filterInput(h).props.value, "");
  assert.equal(h.document.activeElement, filterInput(h).props.ref.current);
  h.render({ ...props, isLoading: true });
  assert.equal(button(h.tree, "Delete All").props.disabled, true);
  assert.equal(nodes(h.tree, (node) => node.props?.["aria-label"] === "Refresh logged foods")[0].props.disabled, true);
  assert.deepEqual(h.requests, []);
});

test("all eleven filter locales have complete copy, correct direction and visible localized controls", async () => {
  assert.deepEqual(Object.keys(filterCopy).sort(), localeRegistry.locales.map((locale) => locale.tag).sort());
  for (const locale of localeRegistry.locales) {
    const copy = foodLogFilter.getFoodLogFilterCopy(locale.aliases[0]);
    assert.equal(copy.locale, locale.tag);
    assert.equal(copy.direction, locale.direction);
    assert.deepEqual(Object.keys(copy.copy).sort(), Object.keys(filterCopy.en).sort());
    assert.ok(Object.values(copy.copy).every((value) => typeof value === "string" && value.trim()));
    assert.equal((copy.copy.count.match(/\{shown\}/g) ?? []).length, 1);
    assert.equal((copy.copy.count.match(/\{total\}/g) ?? []).length, 1);
    const h = await harness("FoodLogList");
    h.document.documentElement.lang = locale.aliases[0];
    h.render(diaryProps());
    h.render();
    const region = nodes(h.tree, (node) => node.props?.lang === locale.tag)[0];
    assert.equal(region.props.dir, locale.direction);
    assert.match(text(region), new RegExp(copy.copy.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(text(region), /\{shown\}|\{total\}/);
  }
  assert.equal(foodLogFilter.getFoodLogFilterCopy("unsupported").copy, filterCopy.en);
});

test("logout removes the private diary and a newly mounted list starts with an empty filter", async () => {
  const parent = await harness("FoodSearchPlaceholder", undefined, async () => ({ ok: true, json: async () => diaryEntries }));
  parent.login();
  await parent.flush();
  assert.equal(nodes(parent.tree, (node) => node.type === "FoodLogList").length, 1);
  parent.logout();
  assert.equal(nodes(parent.tree, (node) => node.type === "FoodLogList").length, 0);
  const fresh = await harness("FoodLogList");
  fresh.render(diaryProps());
  assert.equal(filterInput(fresh).props.value, "");
});

test("live display changes preserve a typed diary filter, selected rows and deletion guard", async () => {
  const h = await harness("FoodLogList");
  h.render(diaryProps());
  setDiaryFilter(h, "harvest");
  const input = filterInput(h).props.ref.current;
  for (const locale of localeRegistry.locales) {
    h.setDisplayLanguage(locale.tag);
    const region = nodes(h.tree, node => node.props?.lang === locale.tag)[0];
    assert.equal(region.props.dir, locale.direction);
    assert.ok(text(region).includes(filterCopy[locale.tag].label));
    assert.equal(filterInput(h).props.value, "harvest");
    assert.equal(filterInput(h).props.ref.current, input);
    assert.equal(nodes(h.tree, node => node.type === "li").length, 1);
    assert.equal(button(h.tree, foodUiCopy[locale.tag].deleteAll).props.disabled, true);
    assert.deepEqual(h.requests, []);
  }
});

test("the existing USDA reference responds to all display languages without fetching or changing provider records", async () => {
  const h = await harness("UsdaReferenceFoods");
  h.render();
  for (const locale of localeRegistry.locales) {
    h.setDisplayLanguage(locale.tag);
    assert.equal(h.tree.props.lang, locale.tag);
    assert.equal(h.tree.props.dir, locale.direction);
    assert.ok(text(h.tree).includes(usdaCopy[locale.tag].title));
    for (const food of usdaReference.foods) assert.ok(text(h.tree).includes(food.description));
    assert.deepEqual(h.requests, []);
  }
});

test("food translations cover the registry, preserve template fields and translate only our known status messages", () => {
  assert.deepEqual(Object.keys(foodUiCopy).sort(), localeRegistry.locales.map(item => item.tag).sort());
  for (const { tag, direction } of localeRegistry.locales) {
    const copy = foodUiCopy[tag];
    assert.equal(foodUi.getFoodUi(tag).direction, direction);
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(foodUiCopy.en).sort(), tag);
    for (const [key, value] of Object.entries(copy)) {
      assert.equal(typeof value, "string", `${tag}.${key}`);
      assert.ok(value.trim(), `${tag}.${key}`);
      assert.doesNotMatch(value, /[<>]/, `${tag}.${key}`);
      assert.deepEqual((value.match(/\{[^}]+\}/g) ?? []).sort(),
        (foodUiCopy.en[key].match(/\{[^}]+\}/g) ?? []).sort(), `${tag}.${key}`);
      if (key.startsWith("status")) assert.equal(foodUi.translateFoodStatus(foodUiCopy.en[key], copy), value);
    }
    assert.equal(foodUi.translateFoodStatus("Provider text remains literal", copy), "Provider text remains literal");
    assert.equal(foodUi.formatFoodUi(copy.viewDetails, { product: "Tea {percentage} $&" }),
      copy.viewDetails.replace("{product}", () => "Tea {percentage} $&"));
  }
  assert.equal(foodUi.getFoodUi("unsupported").locale, "en");
});

test("switching all eleven languages during search preserves its query, signal and single request", async () => {
  let finish;
  const h = await harness("FoodSearchPlaceholder", undefined, undefined,
    () => new Promise(resolve => { finish = resolve; }));
  const query = "  Crème 00123  ";
  const pending = h.search(query);
  await h.flush();
  const request = h.requests[0];
  assert.equal(new URL(request.url, "https://app.example").searchParams.get("q"), query.trim());
  for (const { tag, direction } of localeRegistry.locales) {
    h.setDisplayLanguage(tag);
    const search = nodes(h.tree, node => node.type === "SearchBar")[0];
    assert.equal(search.props.query, query);
    assert.equal(search.props.isLoading, true);
    assert.equal(h.tree.props.lang, tag);
    assert.equal(h.tree.props.dir, direction);
    assert.equal(nodes(h.tree, node => node.type === "LoadingState")[0].props.message, foodUiCopy[tag].statusSearching);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0], request);
    assert.equal(request.options.signal.aborted, false);
  }
  finish({ ok: true, json: async () => ({ results: foods }) });
  await pending;
  assert.equal(h.cards().length, foods.length);
  assert.equal(h.cards()[0].props.item.product_name, foods[0].product_name);
  assert.equal(h.requests.length, 1);
});

test("rapid resubmits do not restart backend warmup or the pending search", async () => {
  let ready, finish;
  const h = await harness("FoodSearchPlaceholder", undefined, undefined,
    () => new Promise(resolve => { finish = resolve; }),
    () => new Promise(resolve => { ready = resolve; }));
  const pending = h.search("banana");
  await h.flush();
  await h.search("banana");
  assert.equal(h.warmups, 1);
  assert.equal(h.requests.length, 0);
  assert.ok(text(h.tree).includes(foodUiCopy.en.searchStartupHint));
  ready(); await h.flush();
  await h.search("banana");
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].options.signal.aborted, false);
  finish({ ok: true, json: async () => ({ results: foods }) });
  await pending;
  assert.equal(h.cards().length, foods.length);
});

test("rate-limit pause respects Retry-After across languages and enables one manual retry after expiry", async () => {
  let calls = 0;
  const h = await harness("FoodSearchPlaceholder", undefined, undefined, async () => ++calls === 1
    ? { ok: false, status: 429, headers: new Headers({ "Retry-After": "90" }) }
    : { ok: true, json: async () => ({ results: foods }) });
  await h.search("banana");
  assert.equal(nodes(h.tree, n => n.type === "SearchBar")[0].props.retrySeconds, 90);
  for (const { tag } of localeRegistry.locales) {
    h.setDisplayLanguage(tag);
    assert.ok(text(h.tree).includes(foodUiCopy[tag].searchCooldownNotice));
    await h.search("banana");
    assert.equal(h.requests.length, 1);
  }
  h.advance(89_000); await h.search("banana");
  assert.equal(h.requests.length, 1);
  h.advance(1_000);
  assert.equal(nodes(h.tree, n => n.type === "SearchBar")[0].props.retrySeconds, 0);
  assert.equal(h.requests.length, 1, "timer expiry sends no request");
  await h.search("banana");
  assert.equal(h.requests.length, 2);
  assert.equal(h.cards().length, foods.length);
});

test("warmup failure retains query and pauses resubmits without hitting the food provider", async () => {
  const h = await harness("FoodSearchPlaceholder", undefined, undefined, undefined,
    async () => { throw new Error("not ready"); });
  await h.search("oats");
  assert.equal(nodes(h.tree, n => n.type === "SearchBar")[0].props.query, "oats");
  assert.equal(nodes(h.tree, n => n.type === "SearchBar")[0].props.retrySeconds, 30);
  await h.search("oats");
  assert.equal(h.warmups, 1);
  assert.equal(h.requests.length, 0);
});

test("search pause handles HTTP dates, missing headers and invalid values without retrying early", () => {
  const now = Date.parse("2026-09-10T12:00:00Z");
  for (const [status, header, wait] of [
    [429, null, 60_000], [429, "0", 60_000], [429, "300", 300_000],
    [503, "Thu, 10 Sep 2026 12:03:00 GMT", 180_000], [504, null, 30_000],
    [429, "garbage", 60_000], [429, "-1", 60_000], [429, "1e999", 60_000],
  ]) assert.equal(searchAvailability.foodSearchRetryAt(status, header, now), now + wait);
  assert.equal(searchAvailability.foodSearchRetryAt(400, null, now), 0);
});

test("search button shows a translated countdown without reporting a request as in progress", async () => {
  const h = await harness("SearchBar");
  for (const { tag } of localeRegistry.locales) {
    h.setDisplayLanguage(tag);
    const tree = h.render({ query: "oats", isLoading: false, retrySeconds: 60, onQueryChange() {}, onSubmit() {} });
    const search = nodes(tree, n => n.type === "button")[0];
    assert.equal(search.props.disabled, true);
    assert.equal(search.props["aria-busy"], false);
    assert.equal(text(search), foodUi.formatFoodUi(foodUiCopy[tag].searchWait, { seconds: new Intl.NumberFormat(tag).format(60) }));
  }
});

test("language changes preserve custom portion input, pending save payload and success in the current language", async () => {
  let finish;
  const h = await harness("FoodSearchPlaceholder", () => new Promise(resolve => { finish = resolve; }));
  await h.search();
  h.choose(0);
  button(h.controls(), "Custom").props.onClick();
  h.render();
  nodes(h.controls(), node => node.type === "input")[0].props.onChange({ target: { value: "12.5" } });
  h.render();
  const cardKey = h.cards()[0].key;
  for (const { tag } of localeRegistry.locales) {
    h.setDisplayLanguage(tag);
    assert.equal(h.cards()[0].key, cardKey);
    assert.equal(h.cards()[0].props.item.product_name, "Banana");
    // Preserve the existing decimal rounding before applying locale notation.
    assert.equal(h.cards()[0].props.formatNumber(0.15), new Intl.NumberFormat(tag,
      { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(0.1));
    assert.equal(nodes(h.controls(), node => node.type === "input")[0].props.value, "12.5");
    assert.ok(text(h.controls()).includes(foodUiCopy[tag].portionTitle));
    assert.equal(button(h.controls(), foodUiCopy[tag].addToLog).props.disabled, false);
    assert.equal(h.requests.length, 1);
  }
  h.submit();
  const post = h.requests.find(request => request.options?.method === "POST");
  const body = post.options.body;
  const payload = JSON.parse(body);
  assert.equal(payload.product_name, "Banana");
  assert.equal(payload.portion_percentage, 12.5);
  assert.deepEqual([payload.calories, payload.protein, payload.fat, payload.carbohydrates], [25, 1.25, 0.5, 4]);
  assert.equal(Object.hasOwn(payload, "locale"), false);
  assert.equal(Object.hasOwn(payload, "added"), false);
  for (const { tag } of localeRegistry.locales) {
    h.setDisplayLanguage(tag);
    assert.equal(button(h.controls(), foodUiCopy[tag].adding).props.disabled, true);
    assert.equal(nodes(h.controls(), node => node.type === "input")[0].props.value, "12.5");
    h.submit();
    assert.equal(h.requests.filter(request => request.options?.method === "POST").length, 1);
    assert.equal(post.options.body, body);
  }
  finish({ ok: true, status: 201 });
  await h.flush();
  assert.equal(h.controls(), null);
  assert.equal(h.cards()[0].props.feedback.message,
    foodUi.formatFoodUi(foodUiCopy.nl.addedFeedback, { product: "Banana", percentage: "12,5" }));
  const requestsAfterSave = h.requests.length;
  h.setDisplayLanguage("ar");
  assert.equal(h.cards()[0].props.feedback.message, foodUi.formatFoodUi(foodUiCopy.ar.addedFeedback,
    { product: "Banana", percentage: new Intl.NumberFormat("ar").format(12.5) }));
  assert.equal(h.requests.length, requestsAfterSave);
});

test("existing save errors change display language without retrying or losing the selected product", async () => {
  for (const status of [409, 500, 401]) {
    const h = await harness("FoodSearchPlaceholder", async () => ({ ok: false, status }));
    await h.search(); h.choose(8); h.submit(); await h.flush();
    const requests = h.requests.length;
    for (const tag of ["nl", "ar"]) {
      h.setDisplayLanguage(tag);
      if (status === 401) {
        assert.equal(h.controls(), null);
        assert.equal(h.cards()[8].props.feedback.message, foodUiCopy[tag].statusSaveSignIn);
        assert.ok(text(h.tree).includes(foodUiCopy[tag].signInTitle));
      } else {
        assert.match(text(h.controls()), /Oats 8/);
        assert.equal(nodes(h.controls(), node => node.type === "ErrorBanner")[0].props.message,
          foodUiCopy[tag][status === 409 ? "statusStorageFull" : "statusLogFailed"]);
      }
      assert.equal(h.requests.length, requests);
    }
  }
});

test("bulk deletion keeps its explicit confirmation and uses the current display language", async () => {
  const h = await harness();
  await h.search(); h.choose(0); h.submit(); await h.flush();
  h.login(); await h.flush(); await h.period("all");
  h.setDisplayLanguage("nl");
  const list = () => nodes(h.tree, node => node.type === "FoodLogList")[0];
  await list().props.onDeleteAllLogs();
  h.render();
  assert.equal(h.confirmations[0], foodUiCopy.nl.deleteAllConfirm);
  assert.equal(h.requests.filter(request => request.options?.method === "DELETE").length, 0);
  assert.equal(list().props.logs.length, 1);
  h.setDisplayLanguage("ar");
  h.answerConfirmation(true);
  await list().props.onDeleteAllLogs();
  h.render();
  assert.equal(h.confirmations[1], foodUiCopy.ar.deleteAllConfirm);
  const deletions = h.requests.filter(request => request.options?.method === "DELETE");
  assert.equal(deletions.length, 1);
  assert.equal(deletions[0].url, "/api/backend/logs");
  assert.equal(list(), undefined);
  assert.ok(nodes(h.tree, node => node.type === "EmptyState").some(node => node.props.title === foodUiCopy.ar.emptyLogsTitle));
});

test("product overview places one average marker above the detailed counts without changing food records", async () => {
  const entries = ["A", "a", "B", "E", null, "", "unknown"].map((grade, index) =>
    Object.freeze({ ...foods[index], id: index + 1, nutri_score: grade, portion_percentage: index + 1 }));
  Object.freeze(entries);
  const before = JSON.stringify(entries);
  const result = JSON.parse(JSON.stringify(foodUi.countRecordedGrades(entries)));
  assert.deepEqual(result, {
    grades: [{ grade: "A", count: 2 }, { grade: "B", count: 1 }, { grade: "C", count: 0 }, { grade: "D", count: 0 }, { grade: "E", count: 1 }],
    known: 4, total: 7, missing: 3,
  });
  const h = await harness("FoodSearchPlaceholder", undefined, () => ({ ok: true, json: async () => entries }));
  h.login(); await h.flush();
  for (const { tag } of localeRegistry.locales) {
    h.setDisplayLanguage(tag);
    const distribution = nodes(h.tree, node => node.type === "dl" && node.props["aria-label"] === foodUiCopy[tag].scoreDetails)[0];
    assert.ok(distribution, tag);
    assert.equal(distribution.props.dir, "ltr");
    const colors = nodes(distribution, node => node.props.style?.backgroundColor).map(node => node.props.style.backgroundColor);
    assert.equal(new Set(colors).size, 5, `${tag}: five Nutri-Score colors remain visible after login`);
    assert.deepEqual(nodes(distribution, node => node.type === "dt").map(node => text(node)), ["A", "B", "C", "D", "E"]);
    assert.deepEqual(nodes(distribution, node => node.type === "dd").map(node => text(node)),
      [2, 1, 0, 0, 1].map(count => new Intl.NumberFormat(tag).format(count)));
    assert.ok(text(h.tree).includes(foodUiCopy[tag].scoreDescription));
    const marker = nodes(h.tree, node => node.props["data-grade-pointer"] === "true");
    assert.equal(marker.length, 1);
    assert.equal(marker[0].props.style.left, "31.25%");
    const label = foodUi.formatFoodUi(foodUiCopy[tag].scoreBetween, {lower: "B", upper: "C"});
    const scale = nodes(h.tree, node => node.props.role === "img" && node.props["aria-label"] === label)[0];
    assert.ok(scale, `${tag}: the position is also available as text`);
    assert.equal(scale.props.dir, "ltr", "The green-to-red scale remains in the same order in RTL languages");
    const details = nodes(h.tree, node => node.type === "details" && text(node).includes(foodUiCopy[tag].scoreDescription))[0];
    assert.ok(details); assert.ok(!details.props.open, "Counts and explanation remain available without crowding the overview");
    assert.equal(h.requests.length, 1);
  }
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(JSON.parse(JSON.stringify(foodUi.countRecordedGrades([]))), {
    grades: ["A", "B", "C", "D", "E"].map(grade => ({ grade, count: 0 })), known: 0, total: 0, missing: 0,
  });
});


test("Nutri-Score colors accept recorded A–E grades and never invent missing scores", () => {
  const colors = ["A", "B", "C", "D", "E"].map(grade => foodUi.recordedGradeStyle(grade).backgroundColor);
  assert.equal(new Set(colors).size, 5);
  assert.equal(foodUi.recordedGradeStyle(" a "), foodUi.recordedGradeStyle("A"));
  for (const grade of [undefined, null, "", "unknown", "F", "A/B"]) {
    assert.equal(foodUi.recordedGradeStyle(grade), undefined);
  }
});

test('USDA grams scale original precision, accept decimal comma and never change provider records', async () => {
  const before = JSON.stringify(usdaReference), h = await harness('UsdaReferenceFoods');
  let tree = h.render();
  const weight = () => nodes(tree, n => n.type === 'input' && n.props.id === 'usda-reference-weight')[0];
  weight().props.onChange({ target: { value: '12,5' } }); tree = h.render();
  assert.ok(text(tree).includes('12.5 g'));
  assert.equal(text(nodes(tree, n => n.type === 'dd')[0]).replace(/\s+/g, ' ').trim(), '6 kcal');
  weight().props.onChange({ target: { value: '0.1' } }); tree = h.render();
  assert.equal(text(nodes(tree, n => n.type === 'dd')[2]).replace(/\s+/g, ' ').trim(), '<0.01 g');
  weight().props.onChange({ target: { value: '' } }); tree = h.render();
  assert.equal(weight().props['aria-invalid'], true);
  assert.ok(nodes(tree, n => n.type === 'dd').every(n => text(n) === usdaCopy.en.unavailable));
  button(tree, usdaCopy.en.resetWeight).props.onClick(); tree = h.render();
  assert.equal(weight().props.value, '100'); assert.equal(JSON.stringify(usdaReference), before);
  assert.deepEqual(h.requests, []);
});

test('USDA weight validation rejects coercions, invalid ranges and unknown nutrition', () => {
  for (const input of ['', 'NaN', 'Infinity', '1e3', '-1', '0', '0.01', '5001', '100g', '1,000.5']) assert.equal(usdaMath.parseReferenceGrams(input), null, input);
  assert.equal(usdaMath.parseReferenceGrams('5000'), 5000);
  assert.equal(usdaMath.parseReferenceGrams('0,1'), .1);
  assert.equal(usdaMath.referenceNutrientAmount({ amount: 0, unit: 'g', loq: null }, 'g', 250), 0);
  assert.equal(usdaMath.referenceNutrientAmount({ amount: 0, unit: 'g', loq: .2 }, 'g', 250), null);
  assert.equal(usdaMath.referenceNutrientAmount({ amount: 10, unit: 'kJ', loq: null }, 'kcal', 250), null);
});

test('Barcode lookup uses the existing search guard and shows only the matching product, without logging', async () => {
  const item = { ...foods[0], barcode: '0034000470693' };
  const h = await harness('FoodSearchPlaceholder', undefined, undefined, async () => ({ ok: true, json: async () => ({ results: [item, { ...foods[1], barcode: '3017620422003' }] }) }));
  const scanner = () => nodes(h.tree, n => n.type === 'FoodBarcodeScanner')[0];
  scanner().props.onLookup('034000470693'); scanner().props.onLookup('034000470693');
  await h.flush();
  assert.equal(h.requests.filter(r => r.url.includes('search-food')).length, 1);
  assert.ok(h.requests.some(r => r.url.endsWith('q=034000470693&mode=barcode')));
  assert.equal(h.cards().length, 1); assert.equal(h.cards()[0].props.item.barcode, '0034000470693');
  assert.equal(h.requests.some(r => r.url.endsWith('/log-food')), false);
});

test('Barcode absence has useful translated fallback text and name search restores ordinary empty state', async () => {
  const h = await harness('FoodSearchPlaceholder', undefined, undefined, async () => ({ ok: true, json: async () => ({ results: [] }) }));
  nodes(h.tree, n => n.type === 'FoodBarcodeScanner')[0].props.onLookup('034000470693'); await h.flush();
  for (const locale of ['en', 'nl', 'ar']) {
    h.setDisplayLanguage(locale);
    assert.ok(nodes(h.tree, n => n.type === 'EmptyState').some(n => n.props.description === barcodeCopy[locale].notFound));
  }
  await h.search('oats');
  assert.ok(nodes(h.tree, n => n.type === 'EmptyState').some(n => n.props.description === foodUiCopy.ar.noResultsDescription));
});


test("the overview marker follows added and removed grades, excludes missing scores and stays absent without known scores", async () => {
  const summarize = grades => foodUi.recordedGradePosition(foodUi.countRecordedGrades(grades.map(nutri_score => ({nutri_score}))));
  assert.equal(summarize(["A"]).percent, 0);
  assert.equal(summarize(["E"]).percent, 100);
  assert.equal(summarize(["A", "E"]).percent, 50);
  assert.ok(Math.abs(summarize(["A", "E", "E"]).percent - 200 / 3) < 1e-10);
  assert.equal(summarize(["A", "E", "", null, "unknown"]).percent, 50);
  assert.equal(summarize([" a ", "b"]).percent, 12.5);
  assert.equal(summarize([]), null);
  assert.equal(summarize([null, "unknown"]), null);
  const h = await harness("FoodSearchPlaceholder", undefined, () => ({ok:true, json:async () => [{...foods[0],id:1,nutri_score:null}]}));
  h.login(); await h.flush();
  assert.equal(nodes(h.tree, node => node.props["data-grade-pointer"] === "true").length, 0);
  assert.ok(text(h.tree).includes(foodUiCopy.en.scoreEmpty));
  assert.equal(h.requests.length, 1);
});

test('diary totals cover the whole period, navigation clears the old period, and bulk delete is blocked in a date view', async () => {
  let finish;
  let calls = 0;
  const h = await harness('FoodSearchPlaceholder', undefined, async () => {
    calls++;
    if(calls === 2) return new Promise(resolve => { finish = resolve; });
    return {ok: true, json: async () => ({...overview([foods[0]]), count: 105, calories: 1050, next_before: 1})};
  });
  h.login(); await h.flush();
  assert.ok(text(h.tree).includes('1,050'));
  let list = nodes(h.tree, n => n.type === 'FoodLogList')[0];
  assert.equal(list.props.total,105); assert.equal(list.props.hasMore,true); assert.equal(list.props.periodFiltered,true);
  h.answerConfirmation(true); await list.props.onDeleteAllLogs();
  assert.equal(h.confirmations.length,0); assert.equal(h.requests.filter(r=>r.options?.method==='DELETE').length,0);
  await h.period('month','2026-09-11');
  assert.equal(nodes(h.tree,n=>n.type==='FoodLogList').length,0,'Old day rows disappear immediately');
  assert.ok(h.requests[1].url.includes('start='));
  h.logout(); finish({ok:true,json:async()=>overview(foods)}); await h.flush();
  assert.equal(nodes(h.tree,n=>n.type==='FoodLogList').length,0,'Late monthly response cannot restore private rows');
  assert.equal(nodes(h.tree,n=>n.type==='FoodDiaryPeriod').length,0);
});

test('failed barcode lookup preserves earlier results and retries the exact barcode once after the countdown', async () => {
  let calls=0;
  const h=await harness('FoodSearchPlaceholder',undefined,undefined,async()=> ++calls === 2
    ? {ok:false,status:504,headers:new Headers()} : {ok:true,json:async()=>({results:foods})});
  await h.search('oats');
  nodes(h.tree,n=>n.type==='FoodBarcodeScanner')[0].props.onLookup('8711000031544');
  await h.flush();
  assert.equal(calls,2); assert.equal(h.cards().length,foods.length);
  assert.ok(text(h.tree).includes('Results for “oats”'));
  assert.equal(nodes(h.tree,n=>n.type==='ErrorBanner')[0].props.message,diary.diaryCopy('en').slow);
  h.advance(30000);
  await button(h.tree,diary.diaryCopy('en').retry).props.onClick(); await h.flush();
  const retried=new URL(h.requests.at(-1).url,'https://app.example');
  assert.equal(retried.searchParams.get('mode'),'barcode'); assert.equal(retried.searchParams.get('q'),'8711000031544');
  assert.equal(calls,3);
});
