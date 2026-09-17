(function () {
  "use strict";

  // Presentation only. The existing bridge owns requests, proof validation,
  // Xaman links, retry, session clearing and the final WordPress redirect.
  var copies = (window.CalorieAppAccountProfile || {}).loginCopy;
  if (!copies || !copies.en) return;

  function init(root) {
    var panel = root.querySelector(".calorieapp-login-modal");
    var frame = root.querySelector(".calorieapp-embed-frame");
    var status = root.querySelector(".calorieapp-login-status");
    var title = panel && panel.querySelector("h2");
    var qr = root.querySelector(".calorieapp-login-qr");
    var open = root.querySelector(".calorieapp-login-open");
    var retry = root.querySelector(".calorieapp-login-retry");
    var close = root.querySelector(".calorieapp-login-close");
    if (!panel || !frame || !status || !title || !qr || !open || !retry || !close || panel.dataset.inlineLogin === "1") return;
    var origin;
    try {
      origin = new URL(frame.src, window.location.href).origin;
      if (["https://app.calorietoken.net", "https://calorieapp-frontend.onrender.com"].indexOf(origin) < 0 || origin !== root.dataset.appOrigin) return;
    } catch (_) { return; }

    panel.dataset.inlineLogin = "1";
    panel.classList.add("calorieapp-login-inline");
    panel.setAttribute("role", "region");
    panel.removeAttribute("aria-modal");
    title.tabIndex = -1;
    // Retain the controller's original nodes and handlers inside its root.
    var stage = frame.closest("[data-calorieapp-frame-stage]") || frame;
    stage.before(panel);
    var progress = document.createElement("p");
    progress.className = "calorieapp-login-summary";
    progress.setAttribute("role", "status");
    progress.setAttribute("aria-live", "polite");
    status.before(progress);
    status.setAttribute("aria-hidden", "true");
    status.setAttribute("aria-live", "off");
    status.removeAttribute("role");
    var qrDetails = document.createElement("details");
    qrDetails.className = "calorieapp-login-qr-details";
    var qrLabel = document.createElement("summary");
    qrDetails.appendChild(qrLabel);
    qr.before(qrDetails);
    qrDetails.appendChild(qr);
    var wasVisible = false;
    var returnFocus = null;
    var requestId = null;
    var finished = false;
    // Match the bridge's captured protocol locale, independent of later
    // display-language changes on the page.
    var protocolLocale = root.dataset.locale || "en";

    function setText(node, value) {
      if (node.textContent !== value) node.textContent = value;
    }
    function render() {
      if (finished && !panel.hidden) panel.hidden = true;
      var picker = document.querySelector("#ctstyle-language-select,#ctstyle-account-language");
      var locale = picker && picker.value || document.documentElement.lang || root.dataset.locale || "en";
      locale = /^zh(?:-|$)/i.test(locale) ? "zh-Hans" : locale.split("-")[0];
      var copy = copies[locale] || copies.en;
      panel.lang = copies[locale] ? locale : "en";
      panel.dir = ["ar", "ur"].indexOf(locale) >= 0 ? "rtl" : "ltr";
      setText(title, copy.title);
      setText(close, copy.hide);
      close.setAttribute("aria-label", copy.hide);
      setText(open, copy.open);
      setText(retry, copy.retry);
      setText(qrLabel, copy.qr);
      var hasError = status.classList.contains("is-error");
      setText(progress, panel.hidden ? "" : hasError ? status.textContent : qr.hidden ? copy.preparing : copy.waiting);
      progress.classList.toggle("is-error", hasError);
      qrDetails.hidden = qr.hidden || hasError;
      // An expired/rejected request has one useful action: the bridge's retry.
      if (hasError) open.hidden = true;

      if (!panel.hidden && !wasVisible) {
        returnFocus = document.activeElement;
        // The existing focus controller owns the fullscreen iframe. Leave it
        // through its own control so the in-page sign-in panel stays visible.
        var focusToggle = document.getElementById("ct-calorieapp-focus-toggle");
        if (document.body.classList.contains("ct-calorieapp-focus") && focusToggle) focusToggle.click();
        title.focus({ preventScroll: true });
        panel.scrollIntoView({ block: "start", behavior: "auto" });
      } else if (panel.hidden && wasVisible) {
        qrDetails.open = false;
        if (panel.contains(document.activeElement)) {
          var target = returnFocus && returnFocus.isConnected ? returnFocus : frame;
          target.focus({ preventScroll: true });
        }
        returnFocus = null;
      }
      wasVisible = !panel.hidden;
    }
    // Only watch bridge-owned state. Our localized copy cannot trigger itself.
    var observer = new MutationObserver(render);
    observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
    observer.observe(status, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    observer.observe(qr, { attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("calorietoken:display-language", render);
    document.addEventListener("change", function (event) {
      if (event.target && event.target.matches("#ctstyle-language-select,#ctstyle-account-language")) render();
    });
    window.addEventListener("message", function (event) {
      if (event.origin !== origin || event.source !== frame.contentWindow || !event.data || event.data.locale !== protocolLocale) return;
      var message = event.data;
      if (message.type === "calorieapp:login:start") {
        if (typeof message.requestId !== "string" || message.requestId.length < 8 ||
            (typeof message.state !== "undefined" && (typeof message.state !== "string" || message.state.length < 32))) return;
        // A replay of the completed request must not redisplay its old controls.
        if (finished && message.requestId === requestId) return;
        requestId = message.requestId;
        finished = false;
        return;
      }
      if (message.type === "calorieapp:login:complete") {
        if (!requestId || message.requestId !== requestId) return;
      } else if (message.type === "calorieapp:logout:request" || message.type === "calorieapp:logout:complete") {
        requestId = null;
      } else return;

      finished = true;
      panel.hidden = true;
      qr.hidden = true;
      open.hidden = true;
      retry.hidden = true;
      // Clear our visible status synchronously, before the legacy bridge's
      // delayed account-controls reload. Late progress cannot reopen the panel.
      render();
    });
    render();
  }
  function ready() { document.querySelectorAll("[data-calorieapp-embed]").forEach(init); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
})();
