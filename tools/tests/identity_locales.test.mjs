import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const canonicalPath = path.join(
  root,
  "contracts",
  "identity-bridge",
  "v1",
  "locales.json",
);
const runtimePaths = [
  path.join(root, "backend", "app", "data", "locales.json"),
  path.join(root, "frontend", "config", "locales.json"),
  path.join(
    root,
    "wordpress-plugins",
    "calorieapp-identity-bridge",
    "config",
    "locales.json",
  ),
];
const expectedTags = [
  "en",
  "zh-Hans",
  "hi",
  "es",
  "ar",
  "fr",
  "bn",
  "pt",
  "id",
  "ur",
  "nl",
];


test("the canonical registry freezes the eleven agreed locales", async () => {
  const registry = JSON.parse(await readFile(canonicalPath, "utf8"));
  assert.equal(registry.source_locale, "en");
  assert.equal(registry.fallback_locale, "en");
  assert.deepEqual(
    registry.locales.map((locale) => locale.tag),
    expectedTags,
  );
  assert.deepEqual(
    registry.locales
      .filter((locale) => locale.direction === "rtl")
      .map((locale) => locale.tag),
    ["ar", "ur"],
  );
});


test("all independently deployed artifacts use the exact registry bytes", async () => {
  const canonical = await readFile(canonicalPath);
  for (const runtimePath of runtimePaths) {
    assert.deepEqual(await readFile(runtimePath), canonical, runtimePath);
  }
});
