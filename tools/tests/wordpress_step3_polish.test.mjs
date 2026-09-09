import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const defaultRoot = fileURLToPath(new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge",
  import.meta.url,
));
const root = process.env.CALORIEAPP_BRIDGE_ROOT || defaultRoot;
const source = (relative) => readFile(path.join(root, relative), "utf8");
const javascript = await source("assets/calorieapp-site-polish.js");
const legacyFixture = await readFile(new URL("../fixtures/step3/how-to-buy-legacy.html", import.meta.url), "utf8");
const legacyMarkup = legacyFixture.replace(/^<article[^>]*>/, "").replace(/<\/article>\s*$/, "");

// Executes the complete production script against bounded DOM fixtures. This
// models behavior, not browser rendering, network providers or Xaman signing.
function harness({ page = 4205, markup = legacyMarkup, trustlineReady = false, editor = false, publicPage = true } = {}) {
  const elements = [];
  function element(tag = "div") {
    const node = {
      tag, children: [], attributes: {}, dataset: {}, listeners: {}, className: "", textContent: "", parentNode: null,
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name] ?? null; },
      hasAttribute(name) { return name in this.attributes; },
      appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
      append(...children) { children.forEach(child => this.appendChild(child)); },
      addEventListener(name, callback) { this.listeners[name] = callback; },
      after(...children) { children.forEach(child => this.parentNode.appendChild(child)); },
      querySelectorAll(selector) { return selector === "p" ? this.children.filter(child => child.tag === "p") : []; },
      querySelector() { return null; },
      closest() { return null; },
    };
    node.classList = {
      add(name) { if (!this.contains(name)) node.className = (node.className + " " + name).trim(); },
      contains(name) { return node.className.split(/\s+/).includes(name); },
    };
    elements.push(node);
    return node;
  }
  const body = element("body"); body.className = "brz page-id-" + page + (editor ? " brz-ed" : "");
  const guide = element("article"); body.appendChild(guide);
  let html = markup, writes = 0;
  Object.defineProperty(guide, "innerHTML", {
    get: () => html,
    set(value) { html = value; writes++; },
  });
  const details = element(); body.appendChild(details);
  ["rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY", "43616C6F72696500000000000000000000000000"].forEach(value => {
    const paragraph = element("p"); paragraph.textContent = value; details.appendChild(paragraph);
  });
  const events = new Map(), copies = [], requests = [];
  const document = {
    body, readyState: "complete", createElement: element,
    getElementById(id) { return elements.find(node => node.id === id && node.parentNode) || null; },
    querySelectorAll(selector) { return selector === ".cal-buy-guide" ? [guide] : []; },
    querySelector(selector) {
      if (selector === ".cal-buy-guide") return guide;
      if (selector === '[data-brz-custom-id="nrsbytvlhdquaddotxqmaeiihmzfbcufpmhr"]') return details;
      return null;
    },
  };
  const window = {
    location: { origin: "https://calorietoken.net", pathname: "/index.php/how-to-buy-calorie/", href: "https://calorietoken.net/index.php/how-to-buy-calorie/" },
    calorieappSitePolish: { trustlineReady, buyGuide: { publicPage } },
    addEventListener(name, callback) { events.set(name, callback); },
    fetch(...args) { requests.push(args); throw new Error("No request during presentation"); },
  };
  vm.runInNewContext(javascript, { document, window, URL, navigator: {
    clipboard: { async writeText(value) { copies.push(value); } },
  } });
  return { guide, details, elements, document, copies, requests, get writes() { return writes; }, event(name) { events.get(name)?.(); } };
}

test("Known How to Buy source becomes a two-direction guide once", () => {
  const h = harness();
  assert.equal(h.writes, 1);
  assert.match(h.guide.innerHTML, /Buy or sell CAL in four clear steps/);
  assert.match(h.guide.innerHTML, /CAL[^\n]+XRP/);
  assert.match(h.guide.innerHTML, /CAL[^\n]+RLUSD/);
  assert.match(h.guide.innerHTML, /Trading takes place with the selected external service/);
  assert.doesNotMatch(h.guide.innerHTML, /https:\/\/sologenic\.org|xapp:xumm\.dex/);
  h.event("load"); h.event("pageshow");
  assert.equal(h.writes, 1);
  assert.equal(h.requests.length, 0);
});

test("Changed CMS text, links, attributes and inserted controls are never overwritten", () => {
  for (const markup of [
    legacyMarkup.replace("Before you start", "New approved introduction"),
    legacyMarkup.replace("https://sologenic.org/", "https://example.test/new-destination"),
    legacyMarkup.replace("overflow-wrap:anywhere", "overflow-wrap:normal"),
    legacyMarkup + '<form><input name="important"></form>',
    "<h2>Manually maintained guide</h2>", "",
  ]) {
    const h = harness({ markup });
    h.event("load"); h.event("pageshow");
    assert.equal(h.writes, 0);
    assert.equal(h.guide.innerHTML, markup);
    assert.equal(h.guide.dataset.calorieappBuyGuide, undefined);
  }
});

test("Snapshot matching tolerates only inter-tag whitespace", () => {
  const h = harness({ markup: legacyMarkup.replace(/></g, ">\n  <") });
  assert.equal(h.writes, 1);
});

test("Other pages and the Brizy editor keep their content", () => {
  assert.equal(harness({ page: 1090 }).writes, 0);
  assert.equal(harness({ editor: true }).writes, 0);
  assert.equal(harness({ publicPage: false }).writes, 0);
  assert.equal(harness({ publicPage: "true" }).writes, 0);
});

test("Richlist enhancement is limited to an authenticated row marker", async () => {
  const javascript = await source("assets/calorieapp-site-layout.js");
  const stylesheet = await source("assets/calorieapp-site-layout.css");

  assert.match(javascript, /table\.querySelectorAll\("tr\.xl-is-user"\)/);
  assert.match(javascript, /data-calorieapp-own-rank/);
  assert.match(javascript, /scrollIntoView/);
  assert.match(stylesheet, /table\.xl-richlist tr\.xl-is-user/);
  assert.doesNotMatch(javascript, /xrpl-r-address|localStorage|sessionStorage/);
});

test("Consent styling preserves Complianz controls", async () => {
  const stylesheet = await source("assets/calorieapp-site-polish.css");

  assert.match(stylesheet, /#cmplz-cookiebanner-container \.cmplz-cookiebanner/);
  assert.match(stylesheet, /\.cmplz-accept/);
  assert.match(stylesheet, /\.cmplz-deny/);
  assert.match(stylesheet, /\.cmplz-save-preferences/);
  assert.doesNotMatch(stylesheet, /display\s*:\s*none[^;]*;[^}]*cmplz/i);
});
