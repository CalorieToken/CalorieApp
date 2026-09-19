import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../../web/participation-lab/index.html", import.meta.url);
const cssPath = new URL("../../web/participation-lab/participation.css", import.meta.url);

test("participation prototype keeps essential controls keyboard and screen-reader discoverable", async () => {
  const html = await readFile(htmlPath, "utf8");

  for (const id of ["storageToggle", "computeToggle", "rewardToggle"]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*aria-label="[^"]+"`));
  }

  assert.match(html, /<label for="storageLimit">/);
  assert.match(html, /<label for="computeLimit">/);
  assert.match(html, /<label for="storageReleaseMode">/);
  assert.match(html, /id="message"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="activityList"[^>]*aria-live="polite"/);
  assert.match(html, /id="growthMeter"[^>]*role="progressbar"/);

  for (const id of [
    "storageStartBtn", "storagePauseBtn", "storageResumeBtn", "storageStopBtn",
    "startBtn", "pauseBtn", "resumeBtn", "stopBtn", "exitBtn",
  ]) {
    assert.match(html, new RegExp(`<button type="button" id="${id}"`));
  }
});

test("switches remain focusable and mobile controls retain touch targets", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.doesNotMatch(css, /\.switch input\s*\{[^}]*display\s*:\s*none/i);
  assert.match(css, /\.switch input:focus-visible\+span/);
  assert.match(css, /button\{min-height:44px\}/);
  assert.match(css, /prefers-reduced-motion/);
});
