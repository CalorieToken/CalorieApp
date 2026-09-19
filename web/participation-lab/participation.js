import {
  communityCapacityPreview,
  contributionSummary,
  createParticipationState,
  hostedFallbackSnapshot,
  transition,
} from "./state.mjs";

const $ = id => document.getElementById(id);
let state = createParticipationState();
let syntheticCommunityNodes = 0;
const activity = ["Participation is off. Hosted core remains active."];

function message(text) {
  $("message").textContent = text;
}

function renderActivity() {
  const list = $("activityList");
  list.replaceChildren(...activity.map(text => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
}

function record(text) {
  activity.unshift(text);
  activity.splice(5);
  renderActivity();
}

function render() {
  const computeActive = state.processState === "running" || state.processState === "paused";
  const storageActive = state.storageState === "running" || state.storageState === "paused";

  $("statusText").textContent = state.processState.toUpperCase();
  $("statusDot").style.background =
    state.processState === "running" ? "#6de3b7" :
    state.processState === "paused" ? "#f2c46d" : "#657488";

  $("storageToggle").checked = state.storage;
  $("computeToggle").checked = state.compute;
  $("rewardToggle").checked = state.rewards;
  $("storageLimit").value = state.storageLimitMb;
  $("computeLimit").value = state.computeLimitPercent;
  $("storageValue").textContent =
    state.storageLimitMb >= 1000 ? (state.storageLimitMb / 1000).toFixed(1) + " GB" : state.storageLimitMb + " MB";
  $("computeValue").textContent = state.computeLimitPercent + "%";

  $("storageStartBtn").disabled = !state.storage || state.storageState !== "off";
  $("storagePauseBtn").disabled = state.storageState !== "running";
  $("storageResumeBtn").disabled = state.storageState !== "paused";
  $("storageStopBtn").disabled = !storageActive;

  $("startBtn").disabled = !state.compute || state.processState !== "off";
  $("pauseBtn").disabled = state.processState !== "running";
  $("resumeBtn").disabled = state.processState !== "paused";
  $("stopBtn").disabled = !computeActive;

  const fallback = hostedFallbackSnapshot(state, syntheticCommunityNodes);
  $("communityCount").textContent = fallback.volunteerNodes + " volunteer nodes";
  const community = communityCapacityPreview(syntheticCommunityNodes);
  $("communityLevel").textContent = community.level;
  $("communityDescription").textContent = community.description;

  const stage =
    syntheticCommunityNodes >= 1000 ? "strong" :
    syntheticCommunityNodes >= 100 ? "growing" :
    syntheticCommunityNodes >= 1 ? "early" : "hosted";
  const stageWidth = { hosted: 0, early: 22, growing: 62, strong: 100 }[stage];
  $("growthFill").style.width = stageWidth + "%";
  $("growthMeter").setAttribute("aria-valuenow", String(stageWidth));
  document.querySelectorAll("#growthSteps span[data-stage]").forEach(item => {
    const order = { hosted: 0, early: 1, growing: 2, strong: 3 };
    item.classList.toggle("active", item.dataset.stage === stage);
    item.classList.toggle("past", order[item.dataset.stage] < order[stage]);
  });

  const summary = contributionSummary(state);
  $("storageSummary").textContent = summary.storageLabel;
  $("storageDetail").textContent = summary.storageDetail;
  $("computeSummary").textContent = summary.computeLabel;
  $("computeDetail").textContent = summary.computeDetail;
  $("rewardSummary").textContent = summary.rewardsLabel;
  $("rewardDetail").textContent = summary.rewardsDetail;
}

function act(action, successMessage, shouldRecord = true) {
  try {
    state = transition(state, action);
    if (successMessage) {
      message(successMessage);
      if (shouldRecord) record(successMessage);
    }
    render();
  } catch (error) {
    if (error.message === "compute-not-enabled") {
      message("Turn on compute contribution first — it never starts automatically.");
    } else if (error.message === "storage-not-enabled") {
      message("Turn on storage contribution first — it never starts automatically.");
    } else {
      message("That action is not available in the current state.");
    }
  }
}

$("communityPreview").onchange = e => {
  syntheticCommunityNodes = Number(e.target.value);
  const community = communityCapacityPreview(syntheticCommunityNodes);
  record("Synthetic preview changed to " + community.nodes + " volunteer nodes · " + community.level + ".");
  render();
};

$("storageToggle").onchange = e => act(
  { type: "SET_STORAGE", value: e.target.checked },
  e.target.checked
    ? "Storage is enabled, but still stopped until you press Start."
    : "Storage contribution is off."
);
$("computeToggle").onchange = e => act(
  { type: "SET_COMPUTE", value: e.target.checked },
  e.target.checked
    ? "Compute is enabled, but still stopped until you press Start."
    : "Compute contribution is off."
);
$("rewardToggle").onchange = e => act(
  { type: "SET_REWARDS", value: e.target.checked },
  e.target.checked ? "Simulated calT rewards enabled." : "Simulated rewards disabled."
);

$("storageLimit").oninput = e => act({ type: "SET_STORAGE_LIMIT", value: e.target.value }, null, false);
$("storageLimit").onchange = e => record("Storage limit changed to " + e.target.value + " MB.");
$("storageReleaseMode").onchange = e => {
  const labels = {
    "keep-local": "Keep existing local copies",
    "handoff-then-delete": "Safe handoff, then delete local copies",
    "delete-now": "Delete my local copies now",
  };
  act(
    { type: "SET_STORAGE_RELEASE_MODE", value: e.target.value },
    "Storage stop choice: " + labels[e.target.value] + "."
  );
};
$("computeLimit").oninput = e => act({ type: "SET_COMPUTE_LIMIT", value: e.target.value }, null, false);
$("computeLimit").onchange = e => record("Compute limit changed to " + e.target.value + "%.");

$("storageStartBtn").onclick = () => act({ type: "START_STORAGE" }, "Storage participation started within your selected limit.");
$("storagePauseBtn").onclick = () => act({ type: "PAUSE_STORAGE" }, "Storage paused. Compute keeps its own separate setting.");
$("storageResumeBtn").onclick = () => act({ type: "RESUME_STORAGE" }, "Storage participation resumed.");
$("storageStopBtn").onclick = () => {
  const detail = {
    "keep-local": "Existing local copies are kept.",
    "handoff-then-delete": "Safe handoff is requested before local cleanup.",
    "delete-now": "Local cleanup is requested immediately by your explicit choice.",
  }[state.storageReleaseMode];
  act({ type: "STOP_STORAGE" }, "Storage work stopped. " + detail);
};

$("startBtn").onclick = () => act({ type: "START" }, "Compute participation started within your selected limit.");
$("pauseBtn").onclick = () => act({ type: "PAUSE" }, "Compute paused. Storage keeps its own separate setting.");
$("resumeBtn").onclick = () => act({ type: "RESUME" }, "Compute participation resumed.");
$("stopBtn").onclick = () => act({ type: "STOP" }, "Compute stopped. You can start again whenever you choose.");
$("exitBtn").onclick = () => act({ type: "EXIT" }, "Participation exited. CalorieApp and Gameverse access remains unchanged.");

renderActivity();
render();
