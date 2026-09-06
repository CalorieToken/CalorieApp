(function () {
  "use strict";

  var PREFIX = "calorieapp:";
  var INTENT_KEY = "calorieapp-site-login-return";
  var INTENT_TTL = 5 * 60 * 1000;
  var STARTUP_URL = "https://calorieapp-backend-rvul.onrender.com/health?resume_login=true";

  function init() {
    var config = document.querySelector("[data-calorieapp-site-integration]");
    if (!config || config.dataset.sessionControlsReady === "1") {
      return;
    }
    var settings = config.dataset;
    var appPage;
    var frameUrl;
    try {
      appPage = new URL(settings.appPage);
      frameUrl = new URL(settings.frameSrc);
      if (
        appPage.origin !== window.location.origin ||
        appPage.protocol !== "https:" ||
        frameUrl.origin !== settings.appOrigin ||
        frameUrl.protocol !== "https:" ||
        frameUrl.username || frameUrl.password
      ) {
        return;
      }
    } catch (_error) {
      return;
    }
    config.dataset.sessionControlsReady = "1";

    var root = document.querySelector("[data-calorieapp-embed]");
    var appFrame = root && root.querySelector(".calorieapp-embed-frame");
    var locale = root ? root.dataset.locale : settings.locale;
    var appOrigin = root ? root.dataset.appOrigin : settings.appOrigin;

    // A regular same-tab navigation wakes the already accepted backend. The
    // marker is only UI intent; the existing Xaman proof is still required.
    document.querySelectorAll('.xl-card a[href*="xl-signin"]').forEach(function (link) {
      if (link.closest("[data-calorieapp-embed]")) {
        return;
      }
      link.href = appPage.href;
      link.target = "_self";
      link.referrerPolicy = "no-referrer";
      link.addEventListener("click", function (event) {
        link.href = appPage.href;
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) {
          return;
        }
        try {
          if (settings.startupUrl !== STARTUP_URL) {
            return;
          }
          window.sessionStorage.setItem(INTENT_KEY, JSON.stringify({
            startedAt: Date.now(),
            siteOrigin: window.location.origin,
            appOrigin: appOrigin,
            pathname: appPage.pathname,
            locale: locale,
          }));
          link.href = STARTUP_URL;
        } catch (_error) {
          // Storage-disabled browsers keep the ordinary CalorieApp page link.
        }
      });
    });

    if (appFrame && appFrame.contentWindow && window.location.pathname === appPage.pathname) {
      var intent = null;
      try {
        var stored = window.sessionStorage.getItem(INTENT_KEY);
        window.sessionStorage.removeItem(INTENT_KEY);
        intent = stored ? JSON.parse(stored) : null;
      } catch (_error) {
        intent = null;
      }
      if (
        intent && Number.isFinite(intent.startedAt) &&
        Date.now() >= intent.startedAt && Date.now() - intent.startedAt <= INTENT_TTL &&
        intent.siteOrigin === window.location.origin &&
        intent.appOrigin === appOrigin && intent.pathname === appPage.pathname &&
        intent.locale === locale
      ) {
        var resumed = false;
        window.addEventListener("message", function (event) {
          if (
            resumed || event.origin !== appOrigin || event.source !== appFrame.contentWindow ||
            !event.data || event.data.type !== PREFIX + "bridge:initialized" ||
            event.data.locale !== locale
          ) {
            return;
          }
          resumed = true;
          appFrame.contentWindow.postMessage({ type: PREFIX + "login:trigger", locale: locale }, appOrigin);
        });
        appFrame.contentWindow.postMessage({ type: PREFIX + "bridge:init", locale: locale }, appOrigin);
      }
    }

    var actions = document.querySelector("[data-calorieapp-sitewide-session-actions]");
    if (!actions) {
      return;
    }
    var button = actions.querySelector(".calorieapp-site-logout");
    var status = actions.querySelector(".calorieapp-site-logout-status");
    if (!button || !status) {
      return;
    }
    var logoutUrl;
    try {
      logoutUrl = new URL(button.dataset.logoutUrl);
      if (logoutUrl.origin !== window.location.origin || logoutUrl.protocol !== "https:") {
        return;
      }
    } catch (_error) {
      return;
    }
    var card = document.querySelector(".xl-card");
    if (card) {
      card.appendChild(actions);
    }

    var logoutFrame = null;
    var timeout = null;
    var logoutSent = false;
    function clearFrame() {
      window.clearTimeout(timeout);
      timeout = null;
      if (logoutFrame) {
        logoutFrame.remove();
      }
      logoutFrame = null;
      logoutSent = false;
    }
    function fail(message) {
      clearFrame();
      button.disabled = false;
      button.textContent = button.dataset.idleLabel;
      status.textContent = message;
      status.hidden = false;
    }
    function post(type) {
      logoutFrame.contentWindow.postMessage({ type: PREFIX + type, locale: settings.locale }, settings.appOrigin);
    }
    window.addEventListener("message", function (event) {
      if (
        !logoutFrame || event.origin !== settings.appOrigin ||
        event.source !== logoutFrame.contentWindow || !event.data ||
        event.data.locale !== settings.locale
      ) {
        return;
      }
      if (event.data.type === PREFIX + "bridge:ready") {
        post("bridge:init");
      } else if (event.data.type === PREFIX + "bridge:initialized" && !logoutSent) {
        logoutSent = true;
        post("logout");
      } else if (event.data.type === PREFIX + "logout:complete" && logoutSent) {
        clearFrame();
        window.location.assign(logoutUrl.href);
      } else if (event.data.type === PREFIX + "logout:error" && logoutSent) {
        fail("Could not log out of both sessions. Please try again.");
      }
    });
    button.addEventListener("click", function () {
      if (logoutFrame) {
        return;
      }
      button.disabled = true;
      button.textContent = "Logging out...";
      status.hidden = true;
      logoutFrame = document.createElement("iframe");
      logoutFrame.src = frameUrl.href;
      logoutFrame.title = "CalorieApp sign-out bridge";
      logoutFrame.hidden = true;
      logoutFrame.setAttribute("tabindex", "-1");
      document.body.appendChild(logoutFrame);
      timeout = window.setTimeout(function () {
        fail("CalorieApp did not respond. Please try logging out again.");
      }, 30000);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
