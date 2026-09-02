import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const COPY_PATH = new URL(
  "../../frontend/config/account-privacy-copy.json",
  import.meta.url
);
const LOCALES_PATH = new URL(
  "../../frontend/config/locales.json",
  import.meta.url
);
const COPY_MODULE_PATH = new URL(
  "../../frontend/lib/accountPrivacyCopy.ts",
  import.meta.url
);
const EXPORT_COMPONENT_PATH = new URL(
  "../../frontend/components/AccountDataExportButton.tsx",
  import.meta.url
);
const ERASURE_COMPONENT_PATH = new URL(
  "../../frontend/components/AccountErasurePanel.tsx",
  import.meta.url
);
const LOGIN_PANEL_PATH = new URL(
  "../../frontend/components/XamanLoginPanel.tsx",
  import.meta.url
);
const PRIVACY_ALIGNMENT_PATH = new URL(
  "../../contracts/data-safety/v1/privacy-notice-alignment.json",
  import.meta.url
);
const requireFromFrontend = createRequire(
  new URL("../../frontend/package.json", import.meta.url)
);

const exportKeys = [
  "section_label",
  "title",
  "description",
  "button_idle",
  "button_busy",
  "session_expired",
  "review_required",
  "success",
  "unavailable",
];
const erasureKeys = [
  "section_label",
  "title",
  "description",
  "review_button",
  "confirmation_intro",
  "account_identifier",
  "acknowledgement",
  "button_busy",
  "button_confirm",
  "button_cancel",
  "session_expired",
  "confirmation_failed",
  "temporarily_unavailable",
  "unavailable",
  "success",
];

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadCopyModule({ missingLocale } = {}) {
  const typescript = requireFromFrontend("typescript");
  const [source, copyRegistry, localeRegistry] = await Promise.all([
    readFile(COPY_MODULE_PATH, "utf8"),
    loadJson(COPY_PATH),
    loadJson(LOCALES_PATH),
  ]);
  if (missingLocale) {
    delete copyRegistry.locales[missingLocale];
  }
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const supported = new Map();
  for (const locale of localeRegistry.locales) {
    supported.set(locale.tag.toLowerCase(), locale.tag);
    for (const alias of locale.aliases) {
      supported.set(alias.toLowerCase(), locale.tag);
    }
  }
  const resolveLocale = (value) =>
    supported.get((typeof value === "string" ? value : "en").toLowerCase()) ??
    "en";
  const module = { exports: {} };
  vm.runInContext(
    compiled,
    vm.createContext({
      exports: module.exports,
      module,
      require(specifier) {
        if (specifier === "@/config/account-privacy-copy.json") {
          return { default: copyRegistry };
        }
        if (specifier === "@/lib/locales") {
          return {
            resolveLocale,
            localeDirection(value) {
              return ["ar", "ur"].includes(resolveLocale(value)) ? "rtl" : "ltr";
            },
          };
        }
        throw new Error(`Unexpected require: ${specifier}`);
      },
    })
  );
  return module.exports;
}

test("private account controls have complete copy for all eleven locales", async () => {
  const [copyRegistry, localeRegistry] = await Promise.all([
    loadJson(COPY_PATH),
    loadJson(LOCALES_PATH),
  ]);
  const requiredLocales = localeRegistry.locales.map((locale) => locale.tag);

  assert.equal(copyRegistry.contract_id, "calorieapp.account-privacy-ui-copy");
  assert.equal(copyRegistry.contract_version, "1.1.0");
  assert.equal(copyRegistry.source_locale, "en");
  assert.deepEqual(Object.keys(copyRegistry.locales), requiredLocales);

  for (const locale of requiredLocales) {
    const translation = copyRegistry.locales[locale];
    assert.deepEqual(
      Object.keys(translation),
      ["service_startup_timeout", "export", "erasure"],
      locale
    );
    assert.deepEqual(Object.keys(translation.export), exportKeys, locale);
    assert.deepEqual(Object.keys(translation.erasure), erasureKeys, locale);
    for (const value of [
      translation.service_startup_timeout,
      ...Object.values(translation.export),
      ...Object.values(translation.erasure),
    ]) {
      assert.equal(typeof value, "string", locale);
      assert.notEqual(value.trim(), "", locale);
    }
    if (locale !== "en") {
      assert.notEqual(translation.export.title, copyRegistry.locales.en.export.title);
      assert.notEqual(translation.erasure.title, copyRegistry.locales.en.erasure.title);
      assert.notEqual(
        translation.service_startup_timeout,
        copyRegistry.locales.en.service_startup_timeout
      );
    }
    assert.notEqual(
      translation.service_startup_timeout,
      translation.export.unavailable,
      locale
    );
    assert.notEqual(
      translation.service_startup_timeout,
      translation.erasure.unavailable,
      locale
    );
  }
});

test("English account copy retains every canonical factual consequence", async () => {
  const [copyRegistry, privacyAlignment] = await Promise.all([
    loadJson(COPY_PATH),
    loadJson(PRIVACY_ALIGNMENT_PATH),
  ]);
  const english = copyRegistry.locales.en;

  for (const fact of privacyAlignment.current_english_product_copy.private_export
    .required_plain_language_facts) {
    assert.equal(english.export.description.includes(fact), true, fact);
  }
  const erasureText = [
    english.erasure.description,
    english.erasure.confirmation_intro,
  ].join(" ");
  for (const fact of privacyAlignment.current_english_product_copy.account_erasure
    .required_plain_language_facts) {
    assert.equal(erasureText.includes(fact), true, fact);
  }
});

test("copy lookup resolves aliases, direction and safe English fallback", async () => {
  const { getAccountPrivacyCopy } = await loadCopyModule();

  assert.equal(getAccountPrivacyCopy("nl-NL").locale, "nl");
  assert.equal(getAccountPrivacyCopy("nl-NL").direction, "ltr");
  assert.equal(getAccountPrivacyCopy("ar-EG").locale, "ar");
  assert.equal(getAccountPrivacyCopy("ar-EG").direction, "rtl");
  assert.equal(getAccountPrivacyCopy("unsupported").locale, "en");
});

test("missing right-to-left copy falls back to English locale and direction", async () => {
  const { getAccountPrivacyCopy } = await loadCopyModule({
    missingLocale: "ar",
  });
  const fallback = getAccountPrivacyCopy("ar-EG");

  assert.equal(fallback.locale, "en");
  assert.equal(fallback.direction, "ltr");
});

test("account controls receive locale context and expose language direction", async () => {
  const [exportComponent, erasureComponent, loginPanel] = await Promise.all([
    readFile(EXPORT_COMPONENT_PATH, "utf8"),
    readFile(ERASURE_COMPONENT_PATH, "utf8"),
    readFile(LOGIN_PANEL_PATH, "utf8"),
  ]);

  for (const component of [exportComponent, erasureComponent]) {
    assert.equal(component.includes("getAccountPrivacyCopy(locale)"), true);
    assert.equal(component.includes("lang={localized.locale}"), true);
    assert.equal(component.includes("dir={localized.direction}"), true);
    assert.equal(
      component.includes("localized.service_startup_timeout"),
      true
    );
  }
  assert.equal(loginPanel.includes("locale={displayLocale}"), true);
  assert.equal(loginPanel.includes("setDisplayLocale(nextLocale)"), true);
});
