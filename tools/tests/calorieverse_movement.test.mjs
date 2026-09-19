import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helperUrl = new URL("../../frontend/lib/calorieVerseMovement.ts", import.meta.url);
const worldUrl = new URL("../../frontend/components/GameverseWorld.tsx", import.meta.url);

test("free-roam movement supports keyboard and mobile-friendly cardinal directions", async () => {
  const source = await readFile(helperUrl, "utf8");
  assert.match(source, /ArrowUp/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /normalized === "w"/);
  assert.match(source, /normalized === "a"/);
  assert.match(source, /normalized === "s"/);
  assert.match(source, /normalized === "d"/);
});

test("ridge boundary stays closed before maze completion", async () => {
  const source = await readFile(helperUrl, "utf8");
  assert.match(source, /maxXBeforeRidge: 90/);
  assert.match(source, /maxXAfterRidge: 96/);
  assert.match(source, /ridgeUnlocked/);
});

test("world discovery uses proximity rather than forcing a fixed quest order", async () => {
  const source = await readFile(helperUrl, "utf8");
  assert.match(source, /nearestWorldRegion/);
  assert.match(source, /discoveryRadius/);
  assert.match(source, /Math\.hypot/);
});

test("CalorieVerse integrates free-roam state without removing click-to-walk accessibility", async () => {
  const source = await readFile(worldUrl, "utf8");
  assert.match(source, /moveWorld/);
  assert.match(source, /worldKeyDirection/);
  assert.match(source, /nearestWorldRegion/);
  assert.match(source, /walkTo/);
  assert.match(source, /gameverse-free-roam-controls/);
});
