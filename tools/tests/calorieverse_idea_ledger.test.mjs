import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ledgerUrl = new URL("../../contracts/gameverse/v1/calorieverse-idea-ledger.json", import.meta.url);
const masterUrl = new URL("../../docs/SHOWCASE_OPEN_WORLD_MASTERPLAN.md", import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("CalorieVerse idea ledger preserves the Showcase-to-metaverse origin arc", async () => {
  const ledger = await json(ledgerUrl);
  assert.deepEqual(ledger.origin_arc, [
    "community-facing Showcase narrative",
    "interactive Showcase page",
    "playable open-world Showcase",
    "persistent CalorieVerse metaverse",
    "open and progressively decentralized Calorie ecosystem",
  ]);
  assert.deepEqual(ledger.narrative.original_showcase_story, [
    "food","people","data","value","ecosystem"
  ]);
});

test("idea ledger retains all major locked system families", async () => {
  const ledger = await json(ledgerUrl);
  assert.equal(ledger.public_names.metaverse, "CalorieVerse");
  assert.equal(ledger.public_names.creator_surface, "CalorieStudio");
  assert.equal(ledger.world.mountains.reveal_only_at_destination, true);
  assert.equal(ledger.real_life_and_culture.global_inclusion, true);
  assert.equal(ledger.fnb_chain.modular, true);
  assert.equal(ledger.social_metaverse.first_release_lightweight, true);
  assert.equal(ledger.caloriestudio.bring_your_own_storage, true);
  assert.equal(ledger.economy.test_currency, "CALT");
  assert.equal(ledger.economy.raw_screen_time_rewarded, false);
  assert.equal(ledger.participation_and_decentralization.zero_nodes_healthy, true);
  assert.equal(ledger.funding_and_stewardship.independent_builders_allowed, true);
  assert.equal(ledger.architecture.cost_ceiling_usd_month, 99);
});

test("F&B continuity includes the complete role chain and cross-role consequences", async () => {
  const ledger = await json(ledgerUrl);
  for (const role of [
    "consumer",
    "grocery-retail",
    "restaurant",
    "cafe",
    "takeaway",
    "delivery",
    "wholesaler-distributor",
    "warehouse-cold-chain",
    "transport-logistics",
    "processor-manufacturer",
    "baker-kitchen-production-craft",
    "farmer-grower-fisher-primary-producer",
    "food-data-contributor-reviewer",
  ]) {
    assert.equal(ledger.fnb_chain.roles.includes(role), true, "missing F&B role: " + role);
  }
  assert.ok(ledger.fnb_chain.cross_role_consequences.length >= 5);
});

test("master plan points back to the idea continuity ledger", async () => {
  const master = await readFile(masterUrl, "utf8");
  assert.match(master, /CALORIEVERSE_IDEA_LEDGER\.md/);
  assert.match(master, /calorieverse-idea-ledger\.json/);
});
