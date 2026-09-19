import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const browserContractUrl = new URL("../../contracts/participation/v1/browser-runtime.json", import.meta.url);
const networkContractUrl = new URL("../../contracts/participation/v1/network.json", import.meta.url);
const worldUrl = new URL("../../frontend/config/gameverse-world.json", import.meta.url);
const galleryConfigUrl = new URL("../../frontend/config/gallery-assets.json", import.meta.url);
const preferenceUrl = new URL("../../frontend/lib/participationPreference.ts", import.meta.url);
const cardUrl = new URL("../../frontend/components/ParticipationChoiceCard.tsx", import.meta.url);
const gameverseUrl = new URL("../../frontend/components/GameverseWorld.tsx", import.meta.url);
const galleryPageUrl = new URL("../../frontend/app/gallery/page.tsx", import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("one shared link is the entry model for participants and non-participants", async () => {
  const [browser, network, world] = await Promise.all([
    json(browserContractUrl),
    json(networkContractUrl),
    json(worldUrl),
  ]);

  assert.equal(browser.entry.install_required, false);
  assert.equal(browser.entry.shared_entry_for_participants_and_nonparticipants, true);
  assert.equal(browser.entry.separate_node_or_validator_url_required, false);
  assert.equal(browser.entry.default_mode, "non-participant");
  assert.equal(network.official_product_boundary.single_shared_gameverse_entry_for_all_users, true);
  assert.equal(network.official_product_boundary.separate_node_download_flow_required, false);
  assert.equal(world.principles.single_link_for_everyone, true);
  assert.equal(world.principles.participant_and_nonparticipant_share_same_world_entry, true);
});

test("browser participation offers temporary or remembered scopes without raw OS access", async () => {
  const browser = await json(browserContractUrl);
  assert.deepEqual(browser.consent_scopes.storage_access, [
    "session-temporary",
    "persistent-until-revoked",
  ]);
  assert.deepEqual(browser.consent_scopes.compute_access, [
    "session-only",
    "remember-preference-until-revoked",
  ]);
  assert.equal(browser.consent_scopes.storage_and_compute_independent, true);
  assert.match(browser.runtime.processor_access_semantics, /Web Worker\/WASM/);
  assert.match(browser.runtime.storage_access_semantics, /browser-managed site storage/);
});

test("Gallery and Gameverse render the same shared optional participation chooser", async () => {
  const [gameverse, galleryPage, card, preference] = await Promise.all([
    readFile(gameverseUrl, "utf8"),
    readFile(galleryPageUrl, "utf8"),
    readFile(cardUrl, "utf8"),
    readFile(preferenceUrl, "utf8"),
  ]);
  assert.match(gameverse, /ParticipationChoiceCard ageBand=\{ageBand\} compact/);
  assert.match(galleryPage, /ParticipationChoiceCard ageBand=\{ageBand\}/);
  assert.match(card, /PARTICIPATION_CHOICE_KEY/);
  assert.match(preference, /calorie\.participation\.choice\.v1/);
  assert.match(preference, /mode: "nonparticipant"/);
});

test("resource sharing remains adult-gated and defaults to no participation", async () => {
  const [preference, card] = await Promise.all([
    readFile(preferenceUrl, "utf8"),
    readFile(cardUrl, "utf8"),
  ]);
  assert.match(preference, /if \(ageBand !== "adult"\)/);
  assert.match(preference, /return \{\.\.\.defaultParticipationChoice\}/);
  assert.match(card, /mode === "participant" && ageBand !== "adult"/);
  assert.match(card, /No resources|copy\.none/);
});

test("Gallery contract inherits the same zero-install optional participation model", async () => {
  const gallery = await json(galleryConfigUrl);
  assert.equal(gallery.principles.participation_optional, true);
  assert.equal(gallery.principles.shared_participation_preference_with_gameverse, true);
  assert.equal(gallery.principles.install_required_for_participation, false);
  assert.equal(gallery.principles.default_mode, "nonparticipant");
});
