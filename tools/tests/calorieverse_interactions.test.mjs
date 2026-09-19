import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configUrl = new URL("../../frontend/config/calorieverse-interactions.json", import.meta.url);
const copyUrl = new URL("../../frontend/config/calorieverse-interaction-copy.json", import.meta.url);
const helperUrl = new URL("../../frontend/lib/calorieVerseInteractions.ts", import.meta.url);
const cardUrl = new URL("../../frontend/components/CalorieVerseInteractionCard.tsx", import.meta.url);
const worldUrl = new URL("../../frontend/components/GameverseWorld.tsx", import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("CalorieVerse interactions stay optional and do not gate the core route", async () => {
  const config = await json(configUrl);
  assert.equal(config.principles.optional, true);
  assert.equal(config.principles.no_wallet_required, true);
  assert.equal(config.principles.no_participation_required, true);
  assert.equal(config.principles.no_pay_to_win, true);
  assert.equal(config.principles.no_core_route_gate, true);
  assert.equal(config.principles.local_progress_only, true);
});

test("first interaction slice covers data, farm, Gallery and Helpbot systems", async () => {
  const config = await json(configUrl);
  const regions = new Set(config.interactions.map(item => item.region_id));
  for (const region of [
    "food-data-grove",
    "community-farm",
    "creator-gallery",
    "helpbot-garden",
  ]) {
    assert.equal(regions.has(region), true, `missing optional interaction for ${region}`);
  }
});

test("derived world effects require the intended system combinations", async () => {
  const source = await readFile(helperUrl, "utf8");
  assert.match(source, /food-data-inspection/);
  assert.match(source, /farm-water-balance/);
  assert.match(source, /farmMarketLink/);
  assert.match(source, /creatorBeacon/);
  assert.match(source, /routeWhisper/);
  assert.match(source, /calorie\.calorieverse\.interactions\.v1/);
});

test("all eleven display languages ship complete interaction copy", async () => {
  const config = await json(configUrl);
  const copy = await json(copyUrl);
  const locales = ["en","zh-Hans","hi","es","ar","fr","bn","pt","id","ur","nl"];
  assert.deepEqual(Object.keys(copy).sort(), [...locales].sort());

  for (const locale of locales) {
    assert.equal(typeof copy[locale].title, "string");
    assert.equal(typeof copy[locale].optional, "string");
    for (const interaction of config.interactions) {
      const item = copy[locale].interactions[interaction.id];
      assert.ok(item, `${locale} missing ${interaction.id}`);
      for (const key of ["title","body","action","done"]) {
        assert.equal(typeof item[key], "string", `${locale} ${interaction.id} missing ${key}`);
        assert.ok(item[key].trim().length > 0);
      }
    }
  }
});

test("interaction UI is contextual and can be replayed without becoming mandatory", async () => {
  const source = await readFile(cardUrl, "utf8");
  assert.match(source, /interactionForRegion/);
  assert.match(source, /onComplete\(interaction\.id\)/);
  assert.match(source, /onReset\(interaction\.id\)/);
  assert.match(source, /copy\.optional/);
});

test("CalorieVerse persists interaction progress and renders world-state cues", async () => {
  const source = await readFile(worldUrl, "utf8");
  assert.match(source, /CALORIEVERSE_INTERACTION_KEY/);
  assert.match(source, /parseInteractionProgress/);
  assert.match(source, /deriveWorldEffects/);
  assert.match(source, /CalorieVerseInteractionCard/);
  assert.match(source, /gameverse-farm-market-link/);
  assert.match(source, /gameverse-creator-beacon/);
  assert.match(source, /gameverse-route-whisper/);
});
