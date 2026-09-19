import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helperUrl = new URL("../../frontend/lib/galleryEcosystem.ts", import.meta.url);
const galleryUrl = new URL("../../frontend/components/GameverseCreatorGallery.tsx", import.meta.url);
const worldUrl = new URL("../../frontend/components/GameverseWorld.tsx", import.meta.url);

test("local creator drafts carry an age-world boundary", async () => {
  const helper = await readFile(helperUrl, "utf8");
  assert.match(helper, /age_band: AgeBand/);
  assert.match(helper, /ageBand: AgeBand/);
  assert.match(helper, /draft\.age_band !== "child"/);
  assert.match(helper, /GALLERY_DRAFTS_KEY/);
});

test("Gallery workshop writes only local drafts and filters them to the active age experience", async () => {
  const source = await readFile(galleryUrl, "utf8");
  assert.match(source, /createLocalGalleryDraft\(\{ title: draftTitle, type: draftType, ageBand \}\)/);
  assert.match(source, /draft\.age_band === ageBand/);
  assert.match(source, /window\.localStorage\.setItem\(GALLERY_DRAFTS_KEY/);
});

test("Gameverse reads local Gallery drafts and renders them as world objects", async () => {
  const source = await readFile(worldUrl, "utf8");
  assert.match(source, /parseLocalGalleryDrafts\(window\.localStorage\.getItem\(GALLERY_DRAFTS_KEY\)\)/);
  assert.match(source, /draft\.age_band === ageBand/);
  assert.match(source, /gameverse-gallery-object/);
  assert.match(source, /title=\{draft\.title\}/);
});
