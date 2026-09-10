import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const registry = JSON.parse(readFileSync(new URL("../../frontend/config/locales.json", import.meta.url)));
function loadModule(path, imports, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    ...globals, module, exports: module.exports,
    require(specifier) {
      if (["react", "react/jsx-runtime", "next/image"].includes(specifier)) return require(specifier);
      if (Object.hasOwn(imports, specifier)) return imports[specifier];
      throw new Error("Unexpected component dependency: " + specifier);
    },
  });
  return module.exports;
}
const locales = loadModule("../../frontend/lib/locales.ts", {
  "@/config/locales.json": { default: registry },
});
function load(enabled) {
  return loadModule("../../frontend/components/DisplayLanguageProvider.tsx", {
    "@/lib/displayLanguageRuntime": require("../contracts/display-language/v1/runtime.js"),
    "@/lib/locales": locales,
    "@/config/display-language-copy.json": {
      default: JSON.parse(readFileSync(new URL("../../frontend/config/display-language-copy.json", import.meta.url))),
    },
  }, { process: { env: { NEXT_PUBLIC_CALORIEAPP_DISPLAY_LANGUAGE: enabled } } });
}
test("the explicit off switch leaves server-rendered children intact and adds no control", () => {
  for (const value of ["0"]) {
    const { DisplayLanguageProvider: Provider, DisplayLanguagePicker: Picker } = load(value);
    assert.equal(renderToStaticMarkup(React.createElement(Provider, null,
      React.createElement(Picker), React.createElement("p", null, "Existing app"))), "<p>Existing app</p>");
  }
});
test("the default feature renders a labeled native selector with eleven choices and an honest translation notice", () => {
  const { DisplayLanguageProvider: Provider, DisplayLanguagePicker: Picker } = load(undefined);
  const html = renderToStaticMarkup(React.createElement(Provider, null, React.createElement(Picker)));
  assert.equal((html.match(/<option /g) ?? []).length, 11);
  assert.match(html, /<label/);
  assert.match(html, /aria-describedby="calorieapp-language-preview-note"/);
  assert.match(html, /Some content is still in English/);
  for (const locale of registry.locales) assert.ok(html.includes(locale.native_name));
});

const introductionCopy = JSON.parse(readFileSync(new URL("../../frontend/config/app-introduction-copy.json", import.meta.url)));
function introduction(display) {
  return loadModule("../../frontend/components/AppIntroduction.tsx", {
    "@/components/DisplayLanguageProvider": { useDisplayLanguage: () => display },
    "@/lib/locales": locales,
    "@/config/app-introduction-copy.json": { default: introductionCopy },
  });
}
function renderedText(text) {
  return renderToStaticMarkup(React.createElement("span", null, text)).slice(6, -7);
}

test("all eleven introduction translations retain each source/licence token exactly once", () => {
  assert.deepEqual(Object.keys(introductionCopy).sort(), registry.locales.map(item => item.tag).sort());
  for (const [locale, copy] of Object.entries(introductionCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(introductionCopy.en).sort(), locale);
    for (const [key, value] of Object.entries(copy)) {
      assert.equal(typeof value, "string", `${locale}.${key}`);
      assert.ok(value.trim(), `${locale}.${key}`);
      assert.doesNotMatch(value, /[<>]/, `${locale}.${key} must be plain text`);
      const expected = key === "offAttribution" ? ["{odbl}", "{off}"]
        : key === "usdaAttribution" ? ["{cc0}", "{usda}"] : [];
      assert.deepEqual((value.match(/\{[^}]*\}/g) ?? []).sort(), expected, `${locale}.${key}`);
      assert.doesNotMatch(value.replace(/\{[^}]*\}/g, ""), /[{}]/, `${locale}.${key}`);
    }
  }
});

test("the actual introduction/footer render every selected language with intact links and RTL metadata", () => {
  const display = { enabled: true, locale: "en" };
  const { AppIntroduction, AppSourceFooter } = introduction(display);
  const expectedLinks = [
    "https://world.openfoodfacts.org",
    "https://opendatacommons.org/licenses/odbl/1-0/",
    "https://fdc.nal.usda.gov/",
    "https://creativecommons.org/publicdomain/zero/1.0/",
    "https://connect.openfoodfacts.org/join-the-contributor-skill-pool-open-food-facts",
  ];
  for (const { tag, direction } of registry.locales) {
    display.locale = tag;
    const copy = introductionCopy[tag];
    const header = renderToStaticMarkup(React.createElement(AppIntroduction));
    const footer = renderToStaticMarkup(React.createElement(AppSourceFooter));
    assert.ok(header.includes(`lang="${tag}" dir="${direction}"`), tag);
    assert.ok(footer.includes(`lang="${tag}" dir="${direction}"`), tag);
    assert.ok(header.includes(renderedText(copy.eyebrow)), tag);
    assert.ok(header.includes(renderedText(copy.intro)), tag);
    assert.ok(header.includes(`alt="${renderedText(copy.logoAlt)}"`), tag);
    assert.ok(footer.includes(`aria-label="${renderedText(copy.footerLabel)}"`), tag);
    for (const key of ["scope", "communityThanks", "contribute"]) {
      assert.ok(footer.includes(renderedText(copy[key])), `${tag}.${key}`);
    }
    const anchors = [...footer.matchAll(/<a\b([^>]+)>(.*?)<\/a>/gs)];
    assert.equal(anchors.length, expectedLinks.length, tag);
    assert.deepEqual(anchors.map(([, attributes]) => attributes.match(/href="([^"]+)"/)[1]), expectedLinks, tag);
    for (const [, attributes] of anchors) {
      assert.match(attributes, /target="_blank"/);
      assert.match(attributes, /rel="noopener noreferrer"/);
    }
    for (const brand of ["CalorieApp", "Open Food Facts", "ODbL", "USDA FoodData Central", "CC0 1.0"]) {
      assert.ok(footer.includes(`<bdi dir="ltr">${brand}</bdi>`), `${tag}.${brand}`);
    }
    assert.doesNotMatch(footer, /\{(?:off|odbl|usda|cc0)\}/, tag);
  }
});

test("disabled or unsupported display language preserves an English introduction and footer", () => {
  const display = { enabled: false, locale: "en" };
  const { AppIntroduction, AppSourceFooter } = introduction(display);
  const render = () => renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(AppIntroduction), React.createElement(AppSourceFooter)));
  const english = render();
  display.locale = "ar";
  assert.equal(render(), english);
  display.enabled = true;
  display.locale = "unsupported";
  assert.equal(render(), english);
});

test("actual food controls render the eleven languages and escape literal product and query text", () => {
  const copy = JSON.parse(readFileSync(new URL("../../frontend/config/food-ui-copy.json", import.meta.url)));
  const foodUi = loadModule("../../frontend/lib/foodUi.ts", {
    "@/config/food-ui-copy.json": { default: copy }, "@/lib/locales": locales,
  });
  const display = { enabled: true, locale: "en" };
  const imports = {
    "@/lib/foodUi": foodUi,
    "@/components/DisplayLanguageProvider": { useDisplayLanguage: () => display },
  };
  imports["@/components/NutriScoreBar"] = loadModule("../../frontend/components/NutriScoreBar.tsx", imports);
  const { SearchBar } = loadModule("../../frontend/components/SearchBar.tsx", imports);
  const { FoodCard } = loadModule("../../frontend/components/FoodCard.tsx", imports);
  const { LoadingState } = loadModule("../../frontend/components/LoadingState.tsx", imports);
  const product = "<b>Tea</b> {percentage} $&";
  for (const { tag, direction } of registry.locales) {
    display.locale = tag;
    const search = renderToStaticMarkup(React.createElement(SearchBar, {
      query: "<milk>", isLoading: false, onQueryChange() {}, onSubmit() {},
    }));
    assert.ok(search.includes(`aria-label="${renderedText(copy[tag].searchInputLabel)}"`), tag);
    assert.ok(search.includes(`placeholder="${renderedText(copy[tag].searchPlaceholder)}"`), tag);
    assert.ok(search.includes(renderedText(copy[tag].search)), tag);
    assert.ok(search.includes('value="&lt;milk&gt;"'), tag);
    assert.ok(search.includes('dir="auto"'), tag);
    const card = renderToStaticMarkup(React.createElement(FoodCard, {
      item: { product_name: product, barcode: "00123", calories: 20, protein: 1, fat: 0, carbohydrates: 4 },
      isLogging: false, onLog() {}, formatNumber: String,
    }));
    assert.ok(card.includes(renderedText(foodUi.formatFoodUi(copy[tag].logProduct, { product }))), tag);
    assert.ok(card.includes(renderedText(copy[tag].noImage)), tag);
    assert.ok(card.includes(renderedText(copy[tag].logFood)), tag);
    assert.ok(card.includes('<bdi dir="ltr">00123</bdi>'), tag);
    assert.doesNotMatch(card, /<b>Tea<\/b>/, tag);
    const loading = renderToStaticMarkup(React.createElement(LoadingState, { variant: "logs" }));
    assert.ok(loading.includes(renderedText(copy[tag].loadingLogs)), tag);
    for (const html of [search, card, loading]) {
      assert.ok(html.includes(`lang="${tag}"`), tag);
      assert.ok(html.includes(`dir="${direction}"`), tag);
    }
  }
  display.enabled = false;
  display.locale = "ar";
  assert.ok(renderToStaticMarkup(React.createElement(LoadingState, { variant: "search" })).includes(copy.en.loadingSearch));
});

test("the actual Nutri-Score bar renders five colors and a recorded grade regardless of login controls", () => {
  const copy = JSON.parse(readFileSync(new URL("../../frontend/config/food-ui-copy.json", import.meta.url)));
  const foodUi = loadModule("../../frontend/lib/foodUi.ts", {
    "@/config/food-ui-copy.json": { default: copy }, "@/lib/locales": locales,
  });
  const imports = { "@/lib/foodUi": foodUi,
    "@/components/DisplayLanguageProvider": { useDisplayLanguage: () => ({ enabled: true, locale: "nl" }) } };
  const score = loadModule("../../frontend/components/NutriScoreBar.tsx", imports);
  imports["@/components/NutriScoreBar"] = score;
  const { FoodCard } = loadModule("../../frontend/components/FoodCard.tsx", imports);
  for (const grade of ["A", "B", "C", "D", "E", " a "]) {
    for (const isDisabled of [true, false]) {
      const html = renderToStaticMarkup(React.createElement(FoodCard, {
        item: { product_name: "Tea", calories: 20, protein: 1, fat: 0, carbohydrates: 4, nutri_score: grade },
        isLogging: false, isDisabled, onLog() {}, formatNumber: String,
      }));
      assert.ok(html.includes(`aria-label="Nutri-Score: ${grade.trim().toUpperCase()}"`));
      assert.equal((html.match(/background-color:/g) || []).length, 5);
    }
  }
  for (const grade of [undefined, null, "", "unknown"]) {
    assert.equal(renderToStaticMarkup(React.createElement(score.NutriScoreBar, { grade })), "");
  }
});
