import assert from "node:assert/strict";
import test from "node:test";

import {
  communityCapacityPreview,
  contributionSummary,
  createParticipationState,
  hostedFallbackSnapshot,
  transition,
} from "../../web/participation-lab/state.mjs";

test("zero participation keeps hosted core and products available", () => {
  const state = createParticipationState();
  const snapshot = hostedFallbackSnapshot(state, 0);
  assert.equal(snapshot.volunteerNodes, 0);
  assert.equal(snapshot.hostedCoreActive, true);
  assert.equal(snapshot.appAvailable, true);
  assert.equal(snapshot.gameverseAvailable, true);
  assert.equal(snapshot.contributionActive, false);
});

test("storage opt-in does not auto-start storage work", () => {
  let state = createParticipationState();
  state = transition(state, { type: "SET_STORAGE", value: true });
  assert.equal(state.storage, true);
  assert.equal(state.storageState, "off");
});

test("storage start pause resume stop lifecycle is explicit", () => {
  let state = createParticipationState({ storage: true });
  state = transition(state, { type: "START_STORAGE" });
  assert.equal(state.storageState, "running");
  state = transition(state, { type: "PAUSE_STORAGE" });
  assert.equal(state.storageState, "paused");
  state = transition(state, { type: "RESUME_STORAGE" });
  assert.equal(state.storageState, "running");
  state = transition(state, { type: "STOP_STORAGE" });
  assert.equal(state.storageState, "off");
});

test("compute opt-in does not auto-start processing", () => {
  let state = createParticipationState();
  state = transition(state, { type: "SET_COMPUTE", value: true });
  assert.equal(state.compute, true);
  assert.equal(state.processState, "off");
});

test("compute start pause resume stop lifecycle is explicit", () => {
  let state = createParticipationState({ compute: true });
  state = transition(state, { type: "START" });
  assert.equal(state.processState, "running");
  state = transition(state, { type: "PAUSE" });
  assert.equal(state.processState, "paused");
  state = transition(state, { type: "RESUME" });
  assert.equal(state.processState, "running");
  state = transition(state, { type: "STOP" });
  assert.equal(state.processState, "off");
});

test("storage and compute lifecycles remain independent", () => {
  let state = createParticipationState({ storage: true, compute: true });
  state = transition(state, { type: "START_STORAGE" });
  state = transition(state, { type: "START" });
  state = transition(state, { type: "PAUSE" });
  assert.equal(state.storageState, "running");
  assert.equal(state.processState, "paused");
  state = transition(state, { type: "PAUSE_STORAGE" });
  state = transition(state, { type: "RESUME" });
  assert.equal(state.storageState, "paused");
  assert.equal(state.processState, "running");
});

test("disabling a contribution forces only its own lifecycle off", () => {
  let state = createParticipationState({
    storage: true,
    compute: true,
    storageState: "running",
    processState: "running",
  });
  state = transition(state, { type: "SET_COMPUTE", value: false });
  assert.equal(state.storage, true);
  assert.equal(state.storageState, "running");
  assert.equal(state.compute, false);
  assert.equal(state.processState, "off");
  state = transition(state, { type: "SET_STORAGE", value: false });
  assert.equal(state.storage, false);
  assert.equal(state.storageState, "off");
});

test("exit clears participation but normal access remains", () => {
  let state = createParticipationState({
    storage: true,
    compute: true,
    rewards: true,
    storageState: "running",
    processState: "running",
  });
  state = transition(state, { type: "EXIT" });
  assert.deepEqual(state, createParticipationState());
  const snapshot = hostedFallbackSnapshot(state, 0);
  assert.equal(snapshot.appAvailable, true);
  assert.equal(snapshot.gameverseAvailable, true);
});

test("invalid limits and lifecycle transitions fail closed", () => {
  assert.throws(() => createParticipationState({ storageLimitMb: 10 }), /storage-limit-out-of-range/);
  assert.throws(() => createParticipationState({ computeLimitPercent: 100 }), /compute-limit-out-of-range/);
  assert.throws(() => transition(createParticipationState(), { type: "START_STORAGE" }), /storage-not-enabled/);
  assert.throws(() => transition(createParticipationState(), { type: "START" }), /compute-not-enabled/);
});

test("contribution summary distinguishes enabled stopped paused and running", () => {
  const off = contributionSummary(createParticipationState());
  assert.equal(off.storageLabel, "OFF");
  assert.equal(off.computeLabel, "OFF");
  assert.equal(off.rewardsLabel, "OFF");
  assert.equal(off.contributingNow, false);

  const enabled = contributionSummary(createParticipationState({ storage: true, compute: true }));
  assert.match(enabled.storageDetail, /waiting for Start/);
  assert.match(enabled.computeDetail, /waiting for Start/);

  const active = contributionSummary(createParticipationState({
    storage: true,
    compute: true,
    rewards: true,
    storageState: "running",
    processState: "paused",
    storageLimitMb: 500,
    computeLimitPercent: 30,
  }));
  assert.equal(active.storageLabel, "RUNNING");
  assert.equal(active.computeLabel, "PAUSED");
  assert.equal(active.rewardsLabel, "ON");
  assert.equal(active.contributingNow, true);
  assert.match(active.storageDetail, /500 MB/);
  assert.match(active.computeDetail, /30%/);
});

test("community capacity preview is always labelled synthetic and preserves hosted fallback", () => {
  const zero = communityCapacityPreview(0);
  assert.equal(zero.level, "Hosted only");
  assert.equal(zero.hostedCoreActive, true);
  assert.equal(zero.isSyntheticPreview, true);
  assert.equal(communityCapacityPreview(1).level, "Early community");
  assert.equal(communityCapacityPreview(100).level, "Growing network");
  const strong = communityCapacityPreview(1000);
  assert.equal(strong.level, "Strong community");
  assert.equal(strong.hostedCoreActive, true);
});

test("storage stop data handling is explicit and defaults to keeping local copies", () => {
  let state = createParticipationState({ storage: true });
  assert.equal(state.storageReleaseMode, "keep-local");
  state = transition(state, { type: "SET_STORAGE_RELEASE_MODE", value: "handoff-then-delete" });
  assert.equal(state.storageReleaseMode, "handoff-then-delete");
  state = transition(state, { type: "START_STORAGE" });
  state = transition(state, { type: "STOP_STORAGE" });
  assert.equal(state.storageState, "off");
  assert.equal(state.storageReleaseMode, "handoff-then-delete");
});

test("invalid storage release modes fail closed", () => {
  assert.throws(
    () => transition(createParticipationState(), { type: "SET_STORAGE_RELEASE_MODE", value: "silent-delete" }),
    /invalid-storage-release-mode/
  );
});
