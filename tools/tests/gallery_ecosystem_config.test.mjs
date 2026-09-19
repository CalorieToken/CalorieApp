import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogUrl = new URL("../../frontend/config/gallery-assets.json", import.meta.url);
const copyUrl = new URL("../../frontend/config/gallery-copy.json", import.meta.url);
const worldUrl = new URL("../../frontend/config/gameverse-world.json", import.meta.url);
const componentUrl = new URL("../../frontend/components/GameverseCreatorGallery.tsx", import.meta.url);
const gameverseUrl = new URL("../../frontend/components/GameverseWorld.tsx", import.meta.url);
const routeUrl = new URL("../../frontend/app/gallery/page.tsx", import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("Gallery ecosystem is world-connected and non-pay-to-win", async () => {
  const [catalog, world] = await Promise.all([json(catalogUrl), json(worldUrl)]);
  assert.equal(catalog.principles.pay_to_win, false);
  assert.equal(catalog.principles.wallet_required_to_browse, false);
  assert.equal(catalog.principles.wallet_required_to_create_local_draft, false);
  assert.equal(catalog.principles.real_marketplace_enabled, false);
  assert.equal(catalog.principles.creator_owns_storage, true);
  assert.equal(catalog.principles.world_and_gallery_share_asset_identity, true);

  const galleryRegion = world.regions.find(region => region.id === "creator-gallery");
  assert.ok(galleryRegion);
  assert.equal(galleryRegion.destination, "/gallery");
});

test("Gallery catalog covers planned modular creator families without real settlement", async () => {
  const catalog = await json(catalogUrl);
  for (const type of [
    "recipe",
    "menu",
    "food-photo",
    "3d-model",
    "avatar-item",
    "digital-livestock-character",
    "educational-media",
    "provenance-story-media",
  ]) {
    assert.equal(catalog.asset_types.includes(type), true, `missing gallery type: ${type}`);
  }
  assert.ok(catalog.assets.length >= 8);
  assert.equal(catalog.assets.some(asset => asset.transfer_mode === "game-native"), true);
  assert.equal(catalog.assets.some(asset => asset.transfer_mode === "simulated-license"), true);
});

test("child Gallery assets never require simulated licensing", async () => {
  const catalog = await json(catalogUrl);
  const childAssets = catalog.assets.filter(asset => asset.ages.includes("child"));
  assert.ok(childAssets.length > 0);
  assert.equal(childAssets.every(asset => asset.transfer_mode === "game-native"), true);
});

test("all eleven display languages have Gallery shell copy", async () => {
  const copy = await json(copyUrl);
  const locales = ["en", "zh-Hans", "hi", "es", "ar", "fr", "bn", "pt", "id", "ur", "nl"];
  assert.deepEqual(Object.keys(copy).sort(), [...locales].sort());
  for (const locale of locales) {
    for (const key of ["title","intro","browse","workshop","localDraftNote","marketplaceOff","storageNote"]) {
      assert.equal(typeof copy[locale][key], "string", `${locale} missing ${key}`);
      assert.ok(copy[locale][key].trim().length > 0);
    }
  }
});

test("Gallery UI keeps creation local and explicitly avoids upload mint sale actions", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /calorie\.gallery\.local-drafts\.v1/);
  assert.match(source, /window\.localStorage/);
  assert.match(source, /createLocalGalleryDraft/);
  assert.doesNotMatch(source, /mintNFT|submitOffer|walletSign|uploadToProvider/);
});

test("Gameverse embeds the Gallery and direct Gallery route returns to the world", async () => {
  const [worldSource, routeSource] = await Promise.all([
    readFile(gameverseUrl, "utf8"),
    readFile(routeUrl, "utf8"),
  ]);
  assert.match(worldSource, /GameverseCreatorGallery/);
  assert.match(worldSource, /selected\?\.kind === "gallery"/);
  assert.match(routeSource, /GameverseCreatorGallery/);
  assert.match(routeSource, /href="\/gameverse"/);
});
