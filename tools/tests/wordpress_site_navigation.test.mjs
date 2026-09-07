import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-site-navigation.js", import.meta.url
), "utf8");
const site = "https://calorietoken.net";
const app = site + "/index.php/calorieapp/";
const logo = site + "/wp-content/plugins/calorieapp-identity-bridge/assets/calorieapp-logo.svg";

function style() {
  const values = new Map();
  return {
    setProperty(name, value, priority = "") { values.set(name, { value, priority }); this[name] = value; },
    getPropertyValue(name) { return values.get(name)?.value || ""; },
    getPropertyPriority(name) { return values.get(name)?.priority || ""; },
    removeProperty(name) { values.delete(name); delete this[name]; },
  };
}
function harness({ pathname = "/index.php/faq/", embedded = false, isHome = "0", appLogo = logo, missing = false, delayedPosition = false } = {}) {
  const config = { dataset: { homePage: site + "/", appPage: app, appLogo, isHome } };
  const body = {};
  const floatingWrapper = { parentElement: body, position: delayedPosition ? "relative" : "fixed", hidden: false };
  const inlineWrapper = { parentElement: body, position: "relative" };
  const links = [];
  function link(href, floating = true, top = false) {
    const container = { parentElement: floating ? floatingWrapper : inlineWrapper, position: "static", hidden: false, style: style() };
    const item = {
      attributes: {}, title: "", rawHref: href,
      get href() { return new URL(this.rawHref, site + pathname).href; },
      set href(value) { this.rawHref = value; },
      closest() { return container; },
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return name === "href" ? this.rawHref : this.attributes[name] ?? null; },
      querySelector(selector) {
        if (selector === "use") return top ? { getAttribute() { return "/wp-content/plugins/brizy/public/editor-build/prod/editor/icons/glyph/square-upload.svg#nc_icon"; } } : null;
        return selector === ".brz-icon-svg" ? this.icon : null;
      },
      icon: { tagName: "svg", getAttribute() { return null; }, replaceWith(image) { item.image = image; item.icon = image; } },
    };
    const pair = { item, container };
    links.push(pair);
    return pair;
  }
  const home = link(site + "/");
  const legacy = link(site + "/index.php/integrated-exchange/");
  const currentApp = link(app);
  const top = link("#", true, true);
  const inline = link(site + "/index.php/integrated-exchange/", false);
  const inlineHome = link(site + "/", false);
  const other = link(site + "/index.php/contact/");
  const foreign = link("https://example.com/index.php/calorieapp/");
  const fragment = link(site + "/#top");
  const slots = Object.fromEntries(["home", "app", "top"].map(role => [role, { hidden: true, getAttribute() { return role; } }]));
  const topButton = { addEventListener(name, fn) { this[name] = fn; } };
  const fallback = {
    hidden: true, querySelectorAll() { return Object.values(slots); },
    querySelector() { return topButton; },
  };
  let created = 0;
  const events = new Map(), frames = [];
  let mutation;
  let lastObservation;
  const document = {
    body, readyState: "complete",
    querySelector(selector) {
      if (selector === "[data-calorieapp-site-integration]") return config;
      if (selector === "[data-calorieapp-embed]") return embedded ? {} : null;
      if (selector === "[data-calorieapp-fallback-shortcuts]") return fallback;
      return null;
    },
    querySelectorAll() { return (missing ? links.filter(x => x.late) : links).map(x => x.item); },
    createElement(tag) {
      assert.equal(tag, "img"); created++;
      return { tagName: "IMG", style: {}, attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return name === "src" ? this.src : this.attributes[name] ?? null; },
      };
    },
  };
  const window = {
    location: { href: site + pathname },
    getComputedStyle(node) { return { position: node.position, display: node.themeHidden ? "none" : node.style?.display || "block" }; },
    requestAnimationFrame(fn) { frames.push(fn); },
    addEventListener(name, fn) { events.set(name, fn); },
    matchMedia() { return { matches: true }; },
    scrollTo(value) { this.scrolled = value; },
    MutationObserver: class {
      constructor(fn) { mutation = fn; }
      disconnect() {}
      observe(target, options) { assert.equal(target, body); lastObservation = options; }
    },
  };
  const run = () => vm.runInNewContext(source, { document, URL, window });
  const flush = () => { while (frames.length) frames.shift()(); };
  run();
  return { home, legacy, currentApp, top, inline, inlineHome, other, foreign, fragment, floatingWrapper, fallback, slots, topButton, window,
    run, count: () => created, flush, event: name => { events.get(name)?.(); flush(); },
    mutate: () => { mutation?.([]); flush(); }, lastObservation: () => lastObservation,
    addLate(href) { const value = link(href); value.late = true; return value; },
  };
}

test("Home omits Home and uses one original transparent app logo", () => {
  for (const pathname of ["/", "/?campaign=test", "/index.php/"]) {
    const h = harness({ pathname });
    assert.equal(h.home.container.hidden, true);
    assert.equal(h.floatingWrapper.hidden, false);
    assert.equal(h.legacy.item.href, app);
    assert.equal(h.legacy.item.image.src, logo);
    assert.equal(h.legacy.item.image.style.width, "1em");
    assert.equal(h.legacy.item.image.style.height, "1em");
    assert.equal(h.legacy.item.image.attributes["aria-hidden"], "true");
    assert.equal(h.currentApp.container.hidden, true, "duplicate destinations are not shown");
    assert.equal(h.slots.home.hidden, true);
    assert.equal(h.slots.app.hidden, true);
  }
  assert.equal(harness({ pathname: "/welcome/", isHome: "1" }).home.container.hidden, true);
});
test("CalorieApp omits canonical and legacy self-links while retaining Home", () => {
  for (const options of [{ pathname: "/index.php/calorieapp/" }, { pathname: "/calorieapp?locale=nl" }, { pathname: "/app-preview/", embedded: true }]) {
    const h = harness(options);
    assert.equal(h.legacy.container.hidden, true);
    assert.equal(h.currentApp.container.hidden, true);
    assert.equal(h.home.container.hidden, false);
    assert.equal(h.slots.app.hidden, true);
  }
});
test("FAQ, Tokenomics and other pages share the same destinations without rewriting content links", () => {
  for (const page of ["faq", "tokenomics-update", "whitepaper", "trustline", "richlist", "blog", "contact", "donate", "merchnfts"]) {
    const h = harness({ pathname: "/index.php/" + page + "/" });
    assert.equal(h.home.container.hidden, false);
    assert.equal(h.legacy.item.href, app);
    assert.equal(h.legacy.item.image.src, logo);
    assert.equal(h.currentApp.container.hidden, true);
    for (const link of [h.inline, h.inlineHome, h.other, h.foreign, h.fragment]) {
      assert.equal(link.container.hidden, false);
      assert.equal(link.item.image, undefined);
      assert.deepEqual(link.item.attributes, {});
    }
    const count = h.count(); h.run(); h.event("resize");
    assert.equal(h.count(), count);
  }
});
test("missing bars are completed with the appropriate shortcuts on Home, CalorieApp and FAQ", () => {
  for (const [pathname, expected] of [["/", ["app", "top"]], ["/index.php/calorieapp/", ["home", "top"]], ["/index.php/faq/", ["home", "app", "top"]]]) {
    const h = harness({ pathname, missing: true });
    assert.deepEqual(Object.keys(h.slots).filter(role => !h.slots[role].hidden), expected);
    let prevented = false;
    h.topButton.click({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(h.window.scrolled.top, 0);
    assert.equal(h.window.scrolled.behavior, "auto");
  }
});
test("late Brizy links replace fallbacks and are upgraded after styles settle", () => {
  const h = harness({ missing: true });
  const late = h.addLate(site + "/index.php/integrated-exchange/");
  h.mutate();
  assert.equal(late.item.href, app);
  assert.equal(late.item.image.src, logo);
  assert.equal(h.slots.app.hidden, true);
  const delayed = harness({ delayedPosition: true });
  assert.match(delayed.legacy.item.href, /integrated-exchange/);
  delayed.floatingWrapper.position = "fixed";
  delayed.event("load");
  assert.equal(delayed.legacy.item.href, app);
  assert.equal(delayed.slots.app.hidden, true);
});
test("responsive visibility is reevaluated without losing the theme's original visibility", () => {
  const h = harness();
  h.legacy.container.themeHidden = true;
  h.event("resize");
  assert.equal(h.currentApp.container.hidden, false, "the other breakpoint's shortcut takes over");
  assert.equal(h.slots.app.hidden, true);
  h.currentApp.container.themeHidden = true;
  h.event("pageshow");
  assert.equal(h.slots.app.hidden, false, "a missing visible control gets a fallback");
  h.legacy.container.themeHidden = false;
  h.mutate();
  assert.equal(h.slots.app.hidden, true);
  assert.deepEqual(Array.from(h.lastObservation().attributeFilter), ["class", "style"]);
});
test("foreign asset configuration cannot rewrite navigation or expose fallbacks", () => {
  const h = harness({ pathname: "/", appLogo: "https://untrusted.example/logo.svg" });
  assert.equal(h.count(), 0);
  assert.equal(h.home.container.hidden, false);
  assert.equal(h.fallback.hidden, true);
  assert.match(h.legacy.item.href, /integrated-exchange/);
});
