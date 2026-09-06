import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-site-layout.js", import.meta.url), "utf8");

// A deterministic DOM geometry model exercises correction/lifecycle behavior.
// It does not substitute for rendering the CSS in a browser or in live Brizy.
function harness({ width = 360, height = 96, present = true } = {}) {
  const classes = () => {
    const values = new Set();
    return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
  };
  const style = () => {
    const values = new Map();
    return { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key), getPropertyValue: key => values.get(key) || "" };
  };
  const state = { width, height, scroll: 0 };
  const wrapper = { style: style(), classList: classes() };
  const card = {
    classList: classes(),
    closest: selector => selector === ".brz-wrapper" ? wrapper : null,
    getBoundingClientRect() {
      const left = 7 + (parseFloat(wrapper.style.getPropertyValue("--calorieapp-identity-center-shift")) || 0);
      const top = 12 - state.scroll;
      return { left, right: left + 280, top, bottom: top + state.height, width: 280, height: state.height };
    },
  };
  function column(baseTop) {
    const item = {
      style: style(), classList: classes(), contains: () => false,
      getBoundingClientRect() {
        const override = parseFloat(item.style.getPropertyValue("--calorieapp-menu-margin"));
        const extra = item.classList.contains("calorieapp-brizy-menu-column") ? override - 20 : 0;
        const top = baseTop + extra - state.scroll;
        return { left: 0, right: state.width, top, bottom: top + 60, width: state.width, height: 60 };
      },
    };
    return item;
  }
  const navigation = column(100), footer = column(1200);
  const document = {
    readyState: "complete", documentElement: { get clientWidth() { return state.width; } },
    querySelectorAll: selector => selector === ".brz .xl-card" ? (present ? [card] : []) : [navigation, navigation, footer].map(item => ({ closest: () => item })),
  };
  const listeners = new Map(), raf = [], observed = [];
  let resize;
  const window = {
    matchMedia: () => ({ get matches() { return state.width <= 768; } }),
    getComputedStyle: () => ({ marginTop: "20px" }),
    addEventListener: (name, callback) => listeners.set(name, callback),
    requestAnimationFrame: callback => raf.push(callback),
    ResizeObserver: true,
  };
  vm.runInNewContext(source, {
    window, document,
    ResizeObserver: class { constructor(callback) { resize = callback; } observe(element) { observed.push(element); } },
    fetch() { throw new Error("The layout must not send requests"); },
  });
  function flush() { while (raf.length) raf.shift()(); }
  function event(name) { listeners.get(name)?.(); flush(); }
  return { state, card, wrapper, navigation, footer, observed, event, resize: () => { resize(); flush(); } };
}

test("card growth and shrinkage preserve clearance without accumulating margins", () => {
  const h = harness();
  const gap = () => h.navigation.getBoundingClientRect().top - h.card.getBoundingClientRect().bottom;
  assert.equal(gap(), 12);
  assert.equal(h.card.getBoundingClientRect().left, 40);
  assert.equal(h.footer.classList.contains("calorieapp-brizy-menu-column"), false);
  assert.equal(h.observed.length, 3, "observe the card and deduplicated columns");
  h.state.height = 164; h.resize(); assert.equal(gap(), 12);
  for (let i = 0; i < 10; i++) h.event("resize");
  assert.equal(gap(), 12);
  h.state.height = 96; h.resize(); assert.equal(gap(), 12);
  h.state.height = 60; h.resize();
  assert.equal(h.navigation.classList.contains("calorieapp-brizy-menu-column"), false);
});

test("restored scroll and responsive round trips keep the correction stable", () => {
  const h = harness({ height: 164 });
  const margin = h.navigation.style.getPropertyValue("--calorieapp-menu-margin");
  h.state.scroll = 400; h.event("pageshow");
  assert.equal(h.navigation.style.getPropertyValue("--calorieapp-menu-margin"), margin);
  h.state.width = 1440; h.event("resize");
  assert.equal(h.wrapper.style.getPropertyValue("--calorieapp-identity-center-shift"), "");
  assert.equal(h.navigation.classList.contains("calorieapp-brizy-menu-column"), false);
  h.state.width = 412; h.event("resize");
  assert.equal(h.card.getBoundingClientRect().left, 66);
  assert.equal(h.navigation.style.getPropertyValue("--calorieapp-menu-margin"), margin);
});

test("desktop and pages without the legacy card require no spacing changes", () => {
  const desktop = harness({ width: 1440 });
  assert.equal(desktop.navigation.classList.contains("calorieapp-brizy-menu-column"), false);
  assert.equal(desktop.wrapper.style.getPropertyValue("--calorieapp-identity-center-shift"), "");
  assert.equal(harness({ present: false }).observed.length, 0);
});
