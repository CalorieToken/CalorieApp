import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const defaultRoot = fileURLToPath(new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge",
  import.meta.url,
));
const root = process.env.CALORIEAPP_BRIDGE_ROOT || defaultRoot;
const source = (relative) => readFile(path.join(root, relative), "utf8");

test("Trustline enhancement reuses the installed Xaman TrustSet route", async () => {
  const javascript = await source("assets/calorieapp-site-polish.js");

  assert.match(javascript, /if \(id !== 1205\) return/);
  assert.match(javascript, /trustline\.href = "\?xl-trustline"/);
  assert.match(javascript, /Set CAL trustline in Xaman/);
  assert.doesNotMatch(javascript, /api_secret|xummlogin_api_secret/i);
});

test("Richlist enhancement is limited to an authenticated row marker", async () => {
  const javascript = await source("assets/calorieapp-site-layout.js");
  const stylesheet = await source("assets/calorieapp-site-layout.css");

  assert.match(javascript, /table\.querySelector\("tr\.xl-is-user"\)/);
  assert.match(javascript, /data-calorieapp-own-rank/);
  assert.match(javascript, /scrollIntoView/);
  assert.match(stylesheet, /table\.xl-richlist tr\.xl-is-user/);
  assert.doesNotMatch(javascript, /xrpl-r-address|localStorage|sessionStorage/);
});

test("Sitewide market card deduplicates and stays next to the existing footer", async () => {
  const javascript = await source("assets/calorieapp-page-ending.js");
  const php = await source("includes/class-calorieapp-identity-bridge-page-ending.php");

  assert.match(php, /data-calorieapp-sitewide-market/);
  assert.match(php, /!is_singular\(\)/);
  assert.match(javascript, /hasExistingMarket/);
  assert.match(javascript, /Operator: ICTHendrikse/);
  assert.match(javascript, /insertBefore\(injected, footerSection\)/);
});

test("Consent styling preserves Complianz controls", async () => {
  const stylesheet = await source("assets/calorieapp-site-polish.css");

  assert.match(stylesheet, /#cmplz-cookiebanner-container \.cmplz-cookiebanner/);
  assert.match(stylesheet, /\.cmplz-accept/);
  assert.match(stylesheet, /\.cmplz-deny/);
  assert.match(stylesheet, /\.cmplz-save-preferences/);
  assert.doesNotMatch(stylesheet, /display\s*:\s*none[^;]*;[^}]*cmplz/i);
});

test("How to buy covers both directions and removes unreliable destinations", async () => {
  const javascript = await source("assets/calorieapp-site-polish.js");

  assert.match(javascript, /if \(id !== 4205\) return/);
  assert.match(javascript, /Buy or sell CAL in four clear steps/);
  assert.match(javascript, /CAL[^\n]+XRP/);
  assert.match(javascript, /CAL[^\n]+RLUSD/);
  assert.match(javascript, /xapp:xumm\.buysellxrp/);
  assert.match(javascript, /Mainnet transaction submission stays unavailable/);
  assert.doesNotMatch(javascript, /https:\/\/sologenic\.org/);
  assert.doesNotMatch(javascript, /xapp:xumm\.dex/);
});
