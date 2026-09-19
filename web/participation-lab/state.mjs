export const PROCESS_STATES = Object.freeze(["off", "running", "paused"]);
export const STORAGE_STATES = PROCESS_STATES;
export const STORAGE_RELEASE_MODES = Object.freeze([
  "keep-local",
  "handoff-then-delete",
  "delete-now",
]);

export function createParticipationState(overrides = {}) {
  const state = {
    storage: false,
    compute: false,
    rewards: false,
    storageLimitMb: 250,
    computeLimitPercent: 25,
    storageReleaseMode: "keep-local",
    storageState: "off",
    processState: "off",
    ...overrides,
  };
  return validateParticipationState(state);
}

export function validateParticipationState(state) {
  if (!STORAGE_STATES.includes(state.storageState)) {
    throw new Error("invalid-storage-state");
  }
  if (!STORAGE_RELEASE_MODES.includes(state.storageReleaseMode)) {
    throw new Error("invalid-storage-release-mode");
  }
  if (!PROCESS_STATES.includes(state.processState)) {
    throw new Error("invalid-process-state");
  }
  if (state.storageLimitMb < 50 || state.storageLimitMb > 2000) {
    throw new Error("storage-limit-out-of-range");
  }
  if (state.computeLimitPercent < 5 || state.computeLimitPercent > 75) {
    throw new Error("compute-limit-out-of-range");
  }
  if ((state.storageState === "running" || state.storageState === "paused") && !state.storage) {
    throw new Error("storage-must-be-enabled-before-process");
  }
  if ((state.processState === "running" || state.processState === "paused") && !state.compute) {
    throw new Error("compute-must-be-enabled-before-process");
  }
  return Object.freeze({ ...state });
}

export function transition(state, action) {
  const current = createParticipationState(state);
  switch (action.type) {
    case "SET_STORAGE": {
      const enabled = Boolean(action.value);
      return createParticipationState({
        ...current,
        storage: enabled,
        storageState: enabled ? current.storageState : "off",
      });
    }
    case "SET_COMPUTE": {
      const enabled = Boolean(action.value);
      return createParticipationState({
        ...current,
        compute: enabled,
        processState: enabled ? current.processState : "off",
      });
    }
    case "SET_REWARDS":
      return createParticipationState({ ...current, rewards: Boolean(action.value) });
    case "SET_STORAGE_LIMIT":
      return createParticipationState({ ...current, storageLimitMb: Number(action.value) });
    case "SET_COMPUTE_LIMIT":
      return createParticipationState({ ...current, computeLimitPercent: Number(action.value) });
    case "SET_STORAGE_RELEASE_MODE":
      return createParticipationState({ ...current, storageReleaseMode: String(action.value) });
    case "START_STORAGE":
      if (!current.storage) throw new Error("storage-not-enabled");
      if (current.storageState !== "off") throw new Error("storage-not-off");
      return createParticipationState({ ...current, storageState: "running" });
    case "PAUSE_STORAGE":
      if (current.storageState !== "running") throw new Error("storage-not-running");
      return createParticipationState({ ...current, storageState: "paused" });
    case "RESUME_STORAGE":
      if (current.storageState !== "paused") throw new Error("storage-not-paused");
      return createParticipationState({ ...current, storageState: "running" });
    case "STOP_STORAGE":
      if (current.storageState === "off") throw new Error("storage-already-off");
      return createParticipationState({ ...current, storageState: "off" });
    case "START":
      if (!current.compute) throw new Error("compute-not-enabled");
      if (current.processState !== "off") throw new Error("process-not-off");
      return createParticipationState({ ...current, processState: "running" });
    case "PAUSE":
      if (current.processState !== "running") throw new Error("process-not-running");
      return createParticipationState({ ...current, processState: "paused" });
    case "RESUME":
      if (current.processState !== "paused") throw new Error("process-not-paused");
      return createParticipationState({ ...current, processState: "running" });
    case "STOP":
      if (current.processState === "off") throw new Error("process-already-off");
      return createParticipationState({ ...current, processState: "off" });
    case "EXIT":
      return createParticipationState();
    default:
      throw new Error("unknown-action");
  }
}

export function hostedFallbackSnapshot(state, volunteerNodes = 0) {
  const current = createParticipationState(state);
  return Object.freeze({
    volunteerNodes: Math.max(0, Number(volunteerNodes) || 0),
    hostedCoreActive: true,
    appAvailable: true,
    gameverseAvailable: true,
    contributionActive:
      current.storageState === "running" || current.processState === "running",
  });
}

export function contributionSummary(state) {
  const current = createParticipationState(state);
  const storageSize =
    current.storageLimitMb >= 1000
      ? (current.storageLimitMb / 1000).toFixed(1) + " GB"
      : current.storageLimitMb + " MB";
  return Object.freeze({
    storageLabel:
      current.storageState === "running" ? "RUNNING" :
      current.storageState === "paused" ? "PAUSED" : "OFF",
    storageReleaseMode: current.storageReleaseMode,
    storageDetail:
      current.storage
        ? current.storageState === "off"
          ? `Enabled · waiting for Start · max ${storageSize}`
          : `Up to ${storageSize}`
        : "No storage shared",
    computeLabel:
      current.processState === "running" ? "RUNNING" :
      current.processState === "paused" ? "PAUSED" : "OFF",
    computeDetail:
      current.compute
        ? current.processState === "off"
          ? `Enabled · waiting for Start · max ${current.computeLimitPercent}%`
          : `Max ${current.computeLimitPercent}%`
        : "No processing shared",
    rewardsLabel: current.rewards ? "ON" : "OFF",
    rewardsDetail: current.rewards
      ? "Simulated calT accounting only"
      : "No reward participation",
    contributingNow:
      current.storageState === "running" || current.processState === "running",
  });
}

export function communityCapacityPreview(volunteerNodes = 0) {
  const nodes = Math.max(0, Number(volunteerNodes) || 0);
  let level = "Hosted only";
  let description = "No volunteer capacity yet. The hosted core handles normal service.";
  if (nodes >= 1000) {
    level = "Strong community";
    description = "Large voluntary capacity is available while the hosted fallback remains active.";
  } else if (nodes >= 100) {
    level = "Growing network";
    description = "Community capacity is becoming meaningful and can absorb more eligible work.";
  } else if (nodes >= 1) {
    level = "Early community";
    description = "A small amount of voluntary capacity is available alongside the hosted core.";
  }
  return Object.freeze({
    nodes,
    level,
    description,
    hostedCoreActive: true,
    isSyntheticPreview: true,
  });
}
