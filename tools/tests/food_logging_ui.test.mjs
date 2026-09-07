import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const requireFromFrontend = createRequire(new URL("../../frontend/package.json", import.meta.url));
const typescript = requireFromFrontend("typescript");
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

async function harness(componentName = "FoodSearchPlaceholder", postResponse) {
  const source = await readFile(new URL(`../../frontend/components/${componentName}.tsx`, import.meta.url), "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { jsx: typescript.JsxEmit.ReactJSX, module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  const hooks = [], listeners = new Map(), requests = [], focusEvents = [];
  const document = { body: {}, activeElement: null };
  document.activeElement = document.body;
  let cursor = 0, effects = [], tree, currentRefs = new Set(), props = {}, saved = [];
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
    module, exports: module.exports, AbortController, console, URL, document,
    window: {
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
      if (specifier.startsWith("@/components/")) {
        const name = specifier.split("/").at(-1);
        return { [name]: name };
      }
      if (specifier === "@/lib/backendRequest") return {
        BACKEND_WAKE_BASE_URL: "https://backend.example",
        waitForBackendReady: async () => {},
        backendUnavailableMessage: (_error, fallback) => fallback,
        async backendRequest(url, options) {
          requests.push({ url, options });
          if (url.includes("/search-food?")) return { ok: true, json: async () => ({ results: foods }) };
          if (url.endsWith("/log-food")) {
            const response = postResponse ? await postResponse() : { ok: true, status: 201 };
            if (response.ok) saved.push({ ...JSON.parse(options.body), id: saved.length + 1 });
            return response;
          }
          if (url.endsWith("/logs")) return { ok: true, json: async () => saved };
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
    render, requests, focusEvents, document,
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
    logout() { listeners.get(AUTH_EVENT)?.({ detail: { authenticated: false } }); render(); },
  };
}

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
  assert.equal(h.requests.filter((request) => request.url.endsWith("/logs")).length, 0);
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
