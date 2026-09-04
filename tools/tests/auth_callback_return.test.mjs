import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const RETURN_HELPER_PATH = new URL(
  "../../frontend/lib/wordpressReturn.ts",
  import.meta.url
);
const requireFromFrontend = createRequire(
  new URL("../../frontend/package.json", import.meta.url)
);

async function compiledCallbackModule(configuredWordPressUrl) {
  const typescript = requireFromFrontend("typescript");
  const source = await readFile(RETURN_HELPER_PATH, "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    Error,
    Map,
    Promise,
    URL,
    console,
    module,
    exports: module.exports,
    process: {
      env: { NEXT_PUBLIC_WORDPRESS_APP_URL: configuredWordPressUrl },
    },
    require(specifier) {
      throw new Error(`Unexpected require: ${specifier}`);
    },
  });

  vm.runInContext(compiled, context);
  return module.exports;
}

test("WordPress callback return accepts only approved HTTPS site origins", async () => {
  const callback = await compiledCallbackModule(
    "https://calorietoken.net/index.php/calorieapp/"
  );

  assert.equal(
    callback.safeWordPressReturn("https://www.calorietoken.net/calorieapp/"),
    "https://www.calorietoken.net/calorieapp/"
  );

  for (const value of [
    "http://calorietoken.net/index.php/calorieapp/",
    "https://calorietoken.net.evil.example/",
    "https://user:pass@calorietoken.net/",
    "https://calorietoken.net:8443/",
    "https://calorietoken.net/wp-login.php?redirect_to=https://evil.example",
    "https://calorietoken.net/index.php/calorieapp/#complete",
    "/index.php/calorieapp/",
    "not a URL",
  ]) {
    assert.equal(
      callback.safeWordPressReturn(value),
      "https://calorietoken.net/index.php/calorieapp/",
      value
    );
  }
});

test("an invalid configured return cannot replace the fixed safe fallback", async () => {
  const callback = await compiledCallbackModule("https://evil.example/return");

  assert.equal(
    callback.safeWordPressReturn(null),
    "https://calorietoken.net/index.php/calorieapp/"
  );
});
