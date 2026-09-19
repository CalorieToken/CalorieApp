import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configUrl = new URL("../../frontend/config/calorieverse-fnb-chain.json", import.meta.url);
const copyUrl = new URL("../../frontend/config/calorieverse-fnb-copy.json", import.meta.url);
const helperUrl = new URL("../../frontend/lib/calorieVerseFnbChain.ts", import.meta.url);
const componentUrl = new URL("../../frontend/components/CalorieVerseFnbChain.tsx", import.meta.url);
const worldUrl = new URL("../../frontend/components/GameverseWorld.tsx", import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url,"utf8"));
}

test("F&B Chain World preserves the complete modular role family", async () => {
  const config = await json(configUrl);
  const roles = new Set(config.roles.map(role => role.id));
  for (const role of [
    "consumer","grocery-retail","restaurant","cafe","takeaway","delivery",
    "wholesaler-distributor","warehouse-cold-chain","transport-logistics",
    "processor-manufacturer","baker-kitchen-craft","primary-producer",
    "food-data-reviewer",
  ]) {
    assert.equal(roles.has(role),true,"missing F&B role: "+role);
  }
  assert.equal(config.principles.modular,true);
  assert.equal(config.principles.start_from_any_role,true);
  assert.equal(config.principles.no_wallet_required,true);
  assert.equal(config.principles.no_participation_required,true);
  assert.equal(config.principles.no_pay_to_win,true);
});

test("F&B branches cover the original food-chain families and all age modes", async () => {
  const config = await json(configUrl);
  const branches = new Map(config.branches.map(branch => [branch.id,branch]));
  for (const id of [
    "fruit-vegetables","grain-bakery","dairy","drinks","hospitality","retail-delivery",
  ]) {
    assert.ok(branches.has(id),"missing branch: "+id);
    assert.deepEqual(branches.get(id).ages,["child","teen","adult"]);
  }
  assert.equal(branches.get("dairy").optional_animal_route,true);
  assert.equal(config.principles.animal_routes_optional_and_non_graphic,true);
  assert.equal(config.principles.dietary_or_cultural_identity_never_inferred,true);
});

test("role graph contains cross-role upstream downstream and consequence links", async () => {
  const config = await json(configUrl);
  const byId = new Map(config.roles.map(role => [role.id,role]));
  assert.ok(byId.get("primary-producer").downstream.includes("processor-manufacturer"));
  assert.ok(byId.get("warehouse-cold-chain").consequence_ids.includes("cold-chain"));
  assert.ok(byId.get("transport-logistics").downstream.includes("grocery-retail"));
  assert.ok(byId.get("consumer").downstream.includes("food-data-reviewer"));
  assert.ok(byId.get("food-data-reviewer").downstream.includes("consumer"));
  assert.ok(config.consequences.length >= 10);
});

test("all eleven locales name every F&B branch and role", async () => {
  const [config,copy] = await Promise.all([json(configUrl),json(copyUrl)]);
  const locales=["en","zh-Hans","hi","es","ar","fr","bn","pt","id","ur","nl"];
  assert.deepEqual(Object.keys(copy).sort(),[...locales].sort());
  for (const locale of locales) {
    for (const branch of config.branches) {
      assert.equal(typeof copy[locale].branchNames[branch.id],"string",locale+" missing branch "+branch.id);
      assert.ok(copy[locale].branchNames[branch.id].trim().length > 0);
    }
    for (const role of config.roles) {
      assert.equal(typeof copy[locale].roleNames[role.id],"string",locale+" missing role "+role.id);
      assert.ok(copy[locale].roleNames[role.id].trim().length > 0);
    }
  }
});

test("F&B helper keeps local progress and supports starting from any role", async () => {
  const source=await readFile(helperUrl,"utf8");
  assert.match(source,/calorie\.calorieverse\.fnb\.v1/);
  assert.match(source,/chooseFnbRole/);
  assert.match(source,/chooseFnbBranch/);
  assert.match(source,/visited_role_ids/);
  assert.match(source,/parseFnbProgress/);
});

test("F&B role UI is embedded in both farm and food-data regions", async () => {
  const [component,world]=await Promise.all([
    readFile(componentUrl,"utf8"),
    readFile(worldUrl,"utf8"),
  ]);
  assert.match(component,/allFnbRoles/);
  assert.match(component,/branchesForAge/);
  assert.match(component,/window\.localStorage/);
  assert.match(world,/CalorieVerseFnbChain/);
  assert.match(world,/selected\.kind === "community"/);
  assert.match(world,/selected\.kind === "caloriedb"/);
});
