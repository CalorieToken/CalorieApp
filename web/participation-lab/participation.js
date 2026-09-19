const $=id=>document.getElementById(id);let processState="off";
function paint(){const active=processState==="running"||processState==="paused";$("statusText").textContent=processState.toUpperCase();$("statusDot").style.background=processState==="running"?"#6de3b7":processState==="paused"?"#f2c46d":"#657488";$("startBtn").disabled=processState!=="off";$("pauseBtn").disabled=processState!=="running";$("resumeBtn").disabled=processState!=="paused";$("stopBtn").disabled=!active}
$("storageLimit").oninput=e=>$("storageValue").textContent=e.target.value>=1000?(e.target.value/1000).toFixed(1)+" GB":e.target.value+" MB";
$("computeLimit").oninput=e=>$("computeValue").textContent=e.target.value+"%";
$("startBtn").onclick=()=>{if(!$("computeToggle").checked){$("message").textContent="Turn on compute contribution first — it never starts automatically.";return}processState="running";$("message").textContent="Compute participation started within your selected limit.";paint()};
$("pauseBtn").onclick=()=>{processState="paused";$("message").textContent="Compute paused. Storage keeps its own separate setting.";paint()};
$("resumeBtn").onclick=()=>{processState="running";$("message").textContent="Compute participation resumed.";paint()};
$("stopBtn").onclick=()=>{processState="off";$("message").textContent="Compute stopped. You can start again whenever you choose.";paint()};
$("computeToggle").onchange=e=>{if(!e.target.checked){processState="off";$("message").textContent="Compute contribution is off.";paint()}};
$("exitBtn").onclick=()=>{$("storageToggle").checked=$("computeToggle").checked=$("rewardToggle").checked=false;processState="off";$("message").textContent="Participation exited. CalorieApp and Gameverse access remains unchanged.";paint()};
paint();