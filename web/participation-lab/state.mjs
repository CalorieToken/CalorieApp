export const PROCESS_STATES = Object.freeze(["off", "running", "paused"]);

export function createParticipationState(overrides = {}) {
  const state = {
    storage: false,
    compute: false,
    rewards: false,
    storageLimitMb: 250,
    computeLimitPercent: 25,
    processState: "off",
    ...overrides,
  };
  return validateParticipationState(state);
}

export function validateParticipationState(state) {
  if (!PROCESS_STATES.includes(state.processState)) {
    throw new Error("invalid-process-state");
  }
  if (state.storageLimitMb < 50 || state.storageLimitMb > 2000) {
    throw new Error("storage-limit-out-of-range");
  }
  if (state.computeLimitPercent < 5 || state.computeLimitPercent > 75) {
    throw new Error("compute-limit-out-of-range");
  }
  if ((state.processState === "running" || state.processState === "paused") && !state.compute) {
    throw new Error("compute-must-be-enabled-before-process");
  }
  return Object.freeze({ ...state });
}

export function transition(state, action) {
  const current = createParticipationState(state);
  switch (action.type) {
    case "SET_STORAGE":
      return createParticipationState({ ...current, storage: Boolean(action.value) });
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
      current.storage || current.processState === "running",
  });
}

export function contributionSummary(state) {
  const current = createParticipationState(state);
  return Object.freeze({
    storageLabel: current.storage ? "ON" : "OFF",
    storageDetail: current.storage
      ? `Up to ${current.storageLimitMb >= 1000 ? (current.storageLimitMb / 1000).toFixed(1) + " GB" : current.storageLimitMb + " MB"}`
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
      current.storage || current.processState === "running",
  });
}
