import {
  createParticipationState,
  hostedFallbackSnapshot,
  transition,
} from "./state.mjs";

const $ = id => document.getElementById(id);
let state = createParticipationState();

function message(text) {
  $("message").textContent = text;
}

function render() {
  const active = state.processState === "running" || state.processState === "paused";
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

  $("startBtn").disabled = state.processState !== "off";
  $("pauseBtn").disabled = state.processState !== "running";
  $("resumeBtn").disabled = state.processState !== "paused";
  $("stopBtn").disabled = !active;

  const fallback = hostedFallbackSnapshot(state, 0);
  $("communityCount").textContent = fallback.volunteerNodes + " volunteer nodes";
}

function act(action, successMessage) {
  try {
    state = transition(state, action);
    if (successMessage) message(successMessage);
    render();
  } catch (error) {
    if (error.message === "compute-not-enabled") {
      message("Turn on compute contribution first — it never starts automatically.");
    } else {
      message("That action is not available in the current state.");
    }
  }
}

$("storageToggle").onchange = e => act({ type: "SET_STORAGE", value: e.target.checked },
  e.target.checked ? "Storage contribution enabled within your selected limit." : "Storage contribution is off.");

$("computeToggle").onchange = e => act({ type: "SET_COMPUTE", value: e.target.checked },
  e.target.checked ? "Compute is available, but still stopped until you press Start." : "Compute contribution is off.");

$("rewardToggle").onchange = e => act({ type: "SET_REWARDS", value: e.target.checked },
  e.target.checked ? "Simulated calT rewards enabled." : "Simulated rewards disabled.");

$("storageLimit").oninput = e => act({ type: "SET_STORAGE_LIMIT", value: e.target.value });
$("computeLimit").oninput = e => act({ type: "SET_COMPUTE_LIMIT", value: e.target.value });

$("startBtn").onclick = () => act({ type: "START" }, "Compute participation started within your selected limit.");
$("pauseBtn").onclick = () => act({ type: "PAUSE" }, "Compute paused. Storage keeps its own separate setting.");
$("resumeBtn").onclick = () => act({ type: "RESUME" }, "Compute participation resumed.");
$("stopBtn").onclick = () => act({ type: "STOP" }, "Compute stopped. You can start again whenever you choose.");
$("exitBtn").onclick = () => act({ type: "EXIT" }, "Participation exited. CalorieApp and Gameverse access remains unchanged.");

render();
