import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const identityUrl = new URL("../../frontend/components/CalorieVerseIdentityPresence.tsx", import.meta.url);
const worldUrl = new URL("../../frontend/components/GameverseWorld.tsx", import.meta.url);

test("CalorieVerse nickname follows authenticated adult identity without wallet exposure", async () => {
  const source = await readFile(identityUrl,"utf8");
  assert.match(source,/\/api\/backend\/api\/identity\/me/);
  assert.match(source,/ageBand !== "adult"/);
  assert.match(source,/safeNickname/);
  assert.doesNotMatch(source,/wallet|account_address|classic_address/i);
});

test("stable starter identity remains visible when nickname is present", async () => {
  const source = await readFile(identityUrl,"utf8");
  assert.match(source,/nickname \? \(/);
  assert.match(source,/data-calorieverse-starter-id/);
  assert.match(source,/starterId/);
});

test("Gameverse identity card uses the shared CalorieVerse nickname presence component", async () => {
  const source = await readFile(worldUrl,"utf8");
  assert.match(source,/CalorieVerseIdentityPresence/);
  assert.match(source,/ageBand=\{ageBand\}/);
  assert.match(source,/starterId=\{starterId\}/);
});
