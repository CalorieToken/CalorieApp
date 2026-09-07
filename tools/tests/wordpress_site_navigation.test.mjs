import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-site-navigation.js",
  import.meta.url
), "utf8");
const site = "https://calorietoken.net";
const app = `${site}/index.php/calorieapp/`;
const logo = `${site}/wp-content/plugins/calorieapp-identity-bridge/assets/calorieapp-logo.svg`;

function harness({ pathname = "/index.php/faq/", embedded = false, isHome = "0", appLogo = logo } = {}) {
  const config = { dataset: { homePage: `${site}/`, appPage: app, appLogo, isHome } };
  const body = {};
  const floatingWrapper = { parentElement: body, position: "fixed", hidden: false };
  const inlineWrapper = { parentElement: body, position: "relative" };
  function link(href, floating = true) {
    const container = {
      parentElement: floating ? floatingWrapper : inlineWrapper,
      position: "static", hidden: false,
      style: { setProperty(name, value) { this[name] = value; } },
    };
    const item = {
      href, attributes: {},
      closest() { return container; },
      setAttribute(name, value) { this.attributes[name] = value; },
      querySelector() { return this.icon; },
      icon: { replaceWith(image) { item.image = image; item.icon = image; } },
    };
    return { item, container };
  }
  const home = link(`${site}/`);
  const legacy = link(`${site}/index.php/integrated-exchange/`);
  const currentApp = link(app);
  const inline = link(`${site}/index.php/integrated-exchange/`, false);
  const inlineHome = link(`${site}/`, false);
  const other = link(`${site}/index.php/contact/`);
  const foreign = link("https://example.com/index.php/calorieapp/");
  const fragment = link(`${site}/#top`);
  const links = [home, legacy, currentApp, inline, inlineHome, other, foreign, fragment];
  let created = 0;
  const document = {
    body, readyState: "complete",
    querySelector(selector) {
      if (selector === "[data-calorieapp-site-integration]") return config;
      if (selector === "[data-calorieapp-embed]") return embedded ? {} : null;
      return null;
    },
    querySelectorAll(selector) {
      assert.equal(selector, ".brz-icon__container a[href]");
      return links.map(link => link.item);
    },
    createElement(tag) {
      assert.equal(tag, "img");
      created++;
      return { style: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
    },
  };
  const context = { document, URL, window: {
    location: { href: site + pathname },
    getComputedStyle(node) { return { position: node.position }; },
  } };
  const run = () => vm.runInNewContext(source, context);
  run();
  return { home, legacy, currentApp, inline, inlineHome, other, foreign, fragment, floatingWrapper, run, count: () => created };
}

test("Home hides its own floating shortcut and retains the original transparent app mark", () => {
  for (const pathname of ["/", "/?campaign=test", "/index.php/"]) {
    const h = harness({ pathname });
    assert.equal(h.home.container.hidden, true);
    assert.equal(h.home.container.style.display, "none");
    assert.equal(h.floatingWrapper.hidden, false, "a shared wrapper must not hide its other shortcuts");
    assert.equal(h.legacy.item.href, app);
    assert.equal(h.legacy.item.image.src, logo);
    assert.equal(h.legacy.item.image.style.width, "1em");
    assert.equal(h.legacy.item.image.style.height, "1em");
    assert.equal(h.legacy.item.image.attributes["aria-hidden"], "true");
    assert.equal(h.legacy.item.attributes["aria-label"], "Open CalorieApp");
  }
  assert.equal(harness({ pathname: "/welcome/", isHome: "1" }).home.container.hidden, true);
});

test("CalorieApp hides both its canonical and former exchange shortcuts, retaining Home", () => {
  for (const options of [
    { pathname: "/index.php/calorieapp/" },
    { pathname: "/calorieapp?locale=nl" },
    { pathname: "/app-preview/", embedded: true },
  ]) {
    const h = harness(options);
    assert.equal(h.legacy.container.hidden, true);
    assert.equal(h.currentApp.container.hidden, true);
    assert.equal(h.home.container.hidden, false);
    assert.equal(h.home.item.attributes["aria-label"], "Go to Home");
  }
});

test("FAQ retains both shortcuts; inline content, other icons and fragment links remain intact", () => {
  const h = harness();
  assert.equal(h.home.container.hidden, false);
  assert.equal(h.currentApp.container.hidden, false);
  assert.equal(h.currentApp.item.image.src, logo);
  assert.match(h.inline.item.href, /integrated-exchange/);
  for (const link of [h.inline, h.inlineHome, h.other, h.foreign, h.fragment]) {
    assert.equal(link.container.hidden, false);
    assert.equal(link.item.image, undefined);
    assert.deepEqual(link.item.attributes, {});
  }
  const count = h.count();
  h.run();
  assert.equal(h.count(), count, "reinitialization must not duplicate assets");
});

test("foreign asset configuration cannot rewrite website navigation", () => {
  const h = harness({ pathname: "/", appLogo: "https://untrusted.example/logo.svg" });
  assert.equal(h.count(), 0);
  assert.equal(h.home.container.hidden, false);
  assert.match(h.legacy.item.href, /integrated-exchange/);
});
