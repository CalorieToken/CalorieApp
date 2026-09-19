import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worldUrl = new URL("../../frontend/config/gameverse-world.json", import.meta.url);
const copyUrl = new URL("../../frontend/config/gameverse-copy.json", import.meta.url);
const pageUrl = new URL("../../frontend/app/gameverse/page.tsx", import.meta.url);
const homeUrl = new URL("../../frontend/app/page.tsx", import.meta.url);
const componentUrl = new URL("../../frontend/components/GameverseWorld.tsx", import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("starter world combines the planned Calorie ecosystem surfaces", async () => {
  const world = await json(worldUrl);
  const kinds = new Set(world.regions.map(region => region.kind));
  for (const kind of [
    "start",
    "calorieapp",
    "helpbot",
    "caloriedb",
    "community",
    "gallery",
    "participation",
    "maze",
  ]) {
    assert.equal(kinds.has(kind), true, `missing Gameverse region kind: ${kind}`);
  }
  assert.equal(world.principles.wallet_required, false);
  assert.equal(world.principles.crypto_required, false);
  assert.equal(world.principles.zero_participation_path, true);
});

test("Gameverse is freedom-first without forcing roles or pay-to-win", async () => {
  const world = await json(worldUrl);
  assert.equal(world.principles.freedom_first_world, true);
  assert.equal(world.principles.multiple_valid_playstyles, true);
  assert.equal(world.principles.mandatory_faction, false);
  assert.equal(world.principles.mandatory_social_participation, false);
  assert.equal(world.principles.mandatory_creator_role, false);
  assert.equal(world.principles.voluntary_economy_only, true);
  assert.equal(world.principles.pay_to_win, false);
  assert.equal(world.principles.reversible_optional_roles, true);
  assert.equal(world.principles.player_expression_with_safety_boundaries, true);
  assert.equal(world.principles.privacy_and_permission_control, true);
  assert.equal(world.principles.minimum_necessary_restrictions, true);
});

test("starting character and original world are compatibility invariants", async () => {
  const world = await json(worldUrl);
  assert.equal(world.starter_character.starter_character_id, "starter-original");
  assert.equal(world.starter_character.silent_replacement_forbidden, true);
  assert.equal(world.principles.preserve_starting_world, true);
});

test("Gameverse stays one persistent live world instead of a sequel replacement model", async () => {
  const world = await json(worldUrl);
  assert.equal(world.principles.one_persistent_live_world, true);
  assert.equal(world.principles.sequel_replacement_model, false);
  assert.equal(world.principles.internal_versions_are_migrations_not_new_games, true);
  assert.equal(world.principles.preserve_player_world_continuity, true);
});

test("mountain reveal stays hidden in the starter slice", async () => {
  const world = await json(worldUrl);
  assert.equal(world.principles.mountains_hidden_until_reveal, true);
  assert.equal(world.progression.mountain_reveal_after_maze, false);
  assert.equal(world.progression.maze_unlock_after_unique_regions, 4);
});

test("participation is visible as ecosystem education but active controls remain adult only", async () => {
  const world = await json(worldUrl);
  const lodge = world.regions.find(region => region.id === "participation-lodge");
  assert.ok(lodge);
  assert.deepEqual(lodge.visible_ages, ["child", "teen", "adult"]);
  assert.deepEqual(lodge.interactive_ages, ["adult"]);
});

test("all eleven ecosystem display languages name every world region", async () => {
  const world = await json(worldUrl);
  const copy = await json(copyUrl);
  const expectedLocales = ["en", "zh-Hans", "hi", "es", "ar", "fr", "bn", "pt", "id", "ur", "nl"];
  assert.deepEqual(Object.keys(copy).sort(), [...expectedLocales].sort());

  for (const locale of expectedLocales) {
    for (const region of world.regions) {
      assert.equal(typeof copy[locale].locations[region.id], "string", `${locale} missing ${region.id}`);
      assert.ok(copy[locale].locations[region.id].trim().length > 0);
    }
  }
});

test("non-English descriptions can visibly fall back instead of silently pretending to be translated", async () => {
  const copy = await json(copyUrl);
  assert.ok(Object.keys(copy.en.descriptions).length > 0);
  assert.ok(Object.keys(copy.nl.descriptions).length > 0);
  for (const locale of ["zh-Hans", "hi", "es", "ar", "fr", "bn", "pt", "id", "ur"]) {
    assert.deepEqual(copy[locale].descriptions, {});
  }
});

test("Gameverse route and CalorieApp portal are connected", async () => {
  const [route, home, component] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(homeUrl, "utf8"),
    readFile(componentUrl, "utf8"),
  ]);
  assert.match(route, /GameverseWorld/);
  assert.match(home, /GameversePortalLink/);
  assert.match(component, /href="\/"/);
  assert.match(component, /gameverse-mountain-range/);
  assert.match(component, /calorie\.gameverse\.starter-character\.v1/);
  assert.match(component, /calorie\.gameverse\.progress\.v1/);
});
