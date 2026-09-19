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

test("compute opt-in does not auto-start processing", () => {
  let state = createParticipationState();
  state = transition(state, { type: "SET_COMPUTE", value: true });
  assert.equal(state.compute, true);
  assert.equal(state.processState, "off");
});

test("start pause resume stop lifecycle is explicit", () => {
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

test("storage remains independently enabled while compute is paused", () => {
  let state = createParticipationState({ storage: true, compute: true });
  state = transition(state, { type: "START" });
  state = transition(state, { type: "PAUSE" });
  assert.equal(state.storage, true);
  assert.equal(state.compute, true);
  assert.equal(state.processState, "paused");
});

test("disabling compute forces process off without touching storage", () => {
  let state = createParticipationState({
    storage: true,
    compute: true,
    processState: "running",
  });
  state = transition(state, { type: "SET_COMPUTE", value: false });
  assert.equal(state.storage, true);
  assert.equal(state.compute, false);
  assert.equal(state.processState, "off");
});

test("exit clears participation but normal access remains", () => {
  let state = createParticipationState({
    storage: true,
    compute: true,
    rewards: true,
    processState: "running",
  });
  state = transition(state, { type: "EXIT" });
  assert.deepEqual(state, createParticipationState());
  const snapshot = hostedFallbackSnapshot(state, 0);
  assert.equal(snapshot.appAvailable, true);
  assert.equal(snapshot.gameverseAvailable, true);
});

test("invalid limits and invalid process transitions fail closed", () => {
  assert.throws(() => createParticipationState({ storageLimitMb: 10 }), /storage-limit-out-of-range/);
  assert.throws(() => createParticipationState({ computeLimitPercent: 100 }), /compute-limit-out-of-range/);
  assert.throws(() => transition(createParticipationState(), { type: "START" }), /compute-not-enabled/);
});

test("contribution summary remains descriptive and optional", () => {
  const off = contributionSummary(createParticipationState());
  assert.equal(off.storageLabel, "OFF");
  assert.equal(off.computeLabel, "OFF");
  assert.equal(off.rewardsLabel, "OFF");
  assert.equal(off.contributingNow, false);

  const active = contributionSummary(createParticipationState({
    storage: true,
    compute: true,
    rewards: true,
    processState: "running",
    storageLimitMb: 500,
    computeLimitPercent: 30,
  }));
  assert.equal(active.storageLabel, "ON");
  assert.equal(active.computeLabel, "RUNNING");
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

  const early = communityCapacityPreview(1);
  assert.equal(early.level, "Early community");

  const growing = communityCapacityPreview(100);
  assert.equal(growing.level, "Growing network");

  const strong = communityCapacityPreview(1000);
  assert.equal(strong.level, "Strong community");
  assert.equal(strong.hostedCoreActive, true);
});
