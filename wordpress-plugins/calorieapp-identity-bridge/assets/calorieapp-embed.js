(function () {
  "use strict";

  var MESSAGE_PREFIX = "calorieapp:";
  var MAX_FRAME_HEIGHT = 4000;
  var MIN_FRAME_HEIGHT = 700;
  var STATUS_POLL_INITIAL_DELAY = 5000;
  var STATUS_POLL_MIDDLE_DELAY = 10000;
  var STATUS_POLL_LONG_DELAY = 20000;
  var STATUS_POLL_TRANSIENT_MAX_DELAY = 30000;
  var STATUS_POLL_MIDDLE_PHASE_AFTER = 30000;
  var STATUS_POLL_LONG_PHASE_AFTER = 90000;
  var STATUS_POLL_MAX_RETRY_AFTER = 60000;
  var JOINT_LOGOUT_TIMEOUT = 30000;
  var LOGIN_COMPLETE_RELOAD_DELAY = 1400;

  function retryAfterMilliseconds(response) {
    var value = response.headers && response.headers.get("retry-after");
    if (!value) {
      return null;
    }
    var seconds = Number(value.trim());
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, STATUS_POLL_MAX_RETRY_AFTER);
    }
    var retryAt = Date.parse(value);
    if (Number.isNaN(retryAt)) {
      return null;
    }
    return Math.min(
      Math.max(0, retryAt - Date.now()),
      STATUS_POLL_MAX_RETRY_AFTER
    );
  }

  function parseJsonResponse(response) {
    return response.json().catch(function () {
      return {};
    });
  }

  function unifyLegacySigninSurfaces(triggerLogin, sessionActions) {
    var identityCard = null;

    document
      .querySelectorAll('.xl-card a[href*="xl-signin"]')
      .forEach(function (signinLink) {
        if (typeof signinLink.closest !== "function") {
          return;
        }

        var card = signinLink.closest(".xl-card");
        if (!card || card.closest("[data-calorieapp-embed]")) {
          return;
        }
        if (!identityCard) {
          identityCard = card;
        }

        if (signinLink.getAttribute("data-calorieapp-unified-login") === "1") {
          return;
        }
        signinLink.setAttribute("data-calorieapp-unified-login", "1");
        signinLink.addEventListener("click", function (event) {
          event.preventDefault();
          triggerLogin();
        });
      });

    if (!identityCard) {
      document.querySelectorAll(".xl-card").forEach(function (card) {
        if (!identityCard && !card.closest("[data-calorieapp-embed]")) {
          identityCard = card;
        }
      });
    }

    if (!identityCard) {
      return;
    }
    if (identityCard.classList && typeof identityCard.classList.add === "function") {
      identityCard.classList.add("calorieapp-identity-card");
    }
    if (
      sessionActions &&
      typeof identityCard.appendChild === "function" &&
      sessionActions.parentElement !== identityCard
    ) {
      identityCard.appendChild(sessionActions);
    }
  }

  function apiRequest(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(
      function (response) {
        return parseJsonResponse(response).then(function (payload) {
          if (!response.ok && response.status !== 202) {
            var error = new Error(
              typeof payload.message === "string"
                ? payload.message
                : "The secure sign-in request failed."
            );
            error.status = response.status;
            error.code = typeof payload.code === "string" ? payload.code : "";
            error.retryAfterMs = retryAfterMilliseconds(response);
            throw error;
          }

          return { response: response, payload: payload };
        });
      },
      function (error) {
        var transportError =
          error instanceof Error
            ? error
            : new Error("The secure sign-in request could not be reached.");
        transportError.isTransportFailure = true;
        throw transportError;
      }
    );
  }

  function init(root) {
    if (root.dataset.calorieappReady === "1") {
      return;
    }
    root.dataset.calorieappReady = "1";

    var iframe = root.querySelector(".calorieapp-embed-frame");
    var modal = root.querySelector(".calorieapp-login-modal");
    var status = root.querySelector(".calorieapp-login-status");
    var qrImage = root.querySelector(".calorieapp-login-qr");
    var openLink = root.querySelector(".calorieapp-login-open");
    var retryButton = root.querySelector(".calorieapp-login-retry");
    var closeButton = root.querySelector(".calorieapp-login-close");
    var siteLogoutButton = root.querySelector(".calorieapp-site-logout");
    var siteLogoutStatus = root.querySelector(".calorieapp-site-logout-status");
    var appOrigin = root.dataset.appOrigin || "";
    var startUrl = root.dataset.startUrl || "";
    var finishUrl = root.dataset.finishUrl || "";
    var authorizeUrl = root.dataset.authorizeUrl || "";
    var configuredLocale = root.dataset.locale || "en";

    if (
      !iframe ||
      !modal ||
      !status ||
      !qrImage ||
      !openLink ||
      !retryButton ||
      !closeButton ||
      !appOrigin ||
      !startUrl ||
      !finishUrl ||
      !authorizeUrl
    ) {
      return;
    }

    var requestId = "";
    var flow = null;
    var backendState = "";
    var xamanLaunch = null;
    var xamanLaunchVisible = false;
    var xamanLaunchStarted = false;
    var flowFailed = false;
    var wordpressAuthenticated = false;
    var websocket = null;
    var startInFlight = false;
    var finishInFlight = false;
    var finishRetryTimer = null;
    var finishPollStartedAt = null;
    var finishTransientFailures = 0;
    var authorizeInFlight = false;
    var authorizeRetryTimer = null;
    var lastStartMessage = null;
    var xamanPageWasHidden = false;
    var bridgeReady = false;
    var loginTriggerPending = false;
    var logoutInFlight = false;
    var logoutTriggerPending = false;
    var logoutTimeoutTimer = null;

    function postToApp(type, detail) {
      if (!iframe.contentWindow) {
        return;
      }

      iframe.contentWindow.postMessage(
        Object.assign(
          {
            type: MESSAGE_PREFIX + type,
            requestId: requestId,
            locale: configuredLocale,
          },
          detail || {}
        ),
        appOrigin
      );
    }

    function initializeBridge() {
      if (!iframe.contentWindow) {
        return;
      }
      iframe.contentWindow.postMessage(
        { type: MESSAGE_PREFIX + "bridge:init", locale: configuredLocale },
        appOrigin
      );
    }

    function sendLogoutToApp() {
      if (!iframe.contentWindow) {
        return;
      }
      iframe.contentWindow.postMessage(
        { type: MESSAGE_PREFIX + "logout", locale: configuredLocale },
        appOrigin
      );
    }

    function setLogoutStatus(message) {
      if (!siteLogoutStatus) {
        return;
      }
      siteLogoutStatus.textContent = message;
      siteLogoutStatus.hidden = message === "";
    }

    function clearLogoutTimeout() {
      if (logoutTimeoutTimer !== null) {
        window.clearTimeout(logoutTimeoutTimer);
        logoutTimeoutTimer = null;
      }
    }

    function restoreLogoutButton(message) {
      clearLogoutTimeout();
      logoutInFlight = false;
      logoutTriggerPending = false;
      if (!siteLogoutButton) {
        return;
      }
      siteLogoutButton.disabled = false;
      siteLogoutButton.textContent =
        siteLogoutButton.dataset.idleLabel || "Log out";
      setLogoutStatus(message);
    }

    function requestJointLogout() {
      if (!siteLogoutButton || logoutInFlight) {
        return;
      }
      if (!(siteLogoutButton.dataset.logoutUrl || "")) {
        return;
      }

      logoutInFlight = true;
      loginTriggerPending = false;
      siteLogoutButton.disabled = true;
      siteLogoutButton.textContent = "Logging out...";
      setLogoutStatus("");
      clearLogoutTimeout();
      logoutTimeoutTimer = window.setTimeout(function () {
        logoutTimeoutTimer = null;
        if (!logoutInFlight) {
          return;
        }
        restoreLogoutButton(
          "CalorieApp did not respond. Please try logging out again."
        );
      }, JOINT_LOGOUT_TIMEOUT);

      if (!bridgeReady) {
        logoutTriggerPending = true;
        initializeBridge();
        return;
      }
      sendLogoutToApp();
    }

    function setStatus(message, isError) {
      status.textContent = message;
      status.classList.toggle("is-error", Boolean(isError));
      postToApp(isError ? "login:error" : "login:progress", {
        message: message,
      });
    }

    function clearSocket() {
      if (websocket) {
        websocket.onopen = null;
        websocket.onmessage = null;
        websocket.onerror = null;
        websocket.onclose = null;
        try {
          websocket.close();
        } catch (_error) {
          // The socket may already be closed.
        }
      }
      websocket = null;
    }

    function resetFlow() {
      clearSocket();
      if (finishRetryTimer !== null) {
        window.clearTimeout(finishRetryTimer);
      }
      if (authorizeRetryTimer !== null) {
        window.clearTimeout(authorizeRetryTimer);
      }
      finishRetryTimer = null;
      finishPollStartedAt = null;
      finishTransientFailures = 0;
      authorizeRetryTimer = null;
      flow = null;
      backendState = "";
      xamanLaunch = null;
      xamanLaunchVisible = false;
      xamanLaunchStarted = false;
      xamanPageWasHidden = false;
      flowFailed = false;
      wordpressAuthenticated = false;
      startInFlight = false;
      finishInFlight = false;
      authorizeInFlight = false;
      qrImage.hidden = true;
      qrImage.removeAttribute("src");
      openLink.hidden = true;
      openLink.setAttribute("href", "#");
      retryButton.hidden = true;
    }

    function fail(message) {
      flowFailed = true;
      clearSocket();
      if (finishRetryTimer !== null) {
        window.clearTimeout(finishRetryTimer);
        finishRetryTimer = null;
      }
      if (authorizeRetryTimer !== null) {
        window.clearTimeout(authorizeRetryTimer);
        authorizeRetryTimer = null;
      }
      setStatus(message, true);
      retryButton.hidden = false;
    }

    function markXamanStarted() {
      if (flowFailed) {
        return;
      }
      xamanLaunchStarted = true;
      retryButton.hidden = true;
    }

    function connectWebsocket(url) {
      clearSocket();

      try {
        websocket = new WebSocket(url);
      } catch (_error) {
        websocket = null;
        return;
      }

      websocket.onmessage = function (event) {
        var payload;
        try {
          payload = JSON.parse(event.data);
        } catch (_error) {
          return;
        }

        if (payload.opened === true) {
          markXamanStarted();
          setStatus("Xaman is open. Sign the request, then return to this page.");
        }
        if (payload.pre_signed === true) {
          markXamanStarted();
          setStatus("Signature in progress. Keep this page open.");
        }
        if (payload.expired === true) {
          fail("This Xaman request expired. Start a new sign-in request.");
        }
        if (typeof payload.signed === "boolean") {
          if (payload.signed) {
            markXamanStarted();
            setStatus("Signature received. Finishing sign-in in this browser...");
            finishWordPress();
          } else {
            fail("The Xaman sign-in request was rejected.");
          }
        }
      };
    }

    function revealXamanWhenReady() {
      if (flowFailed || !flow || !xamanLaunch || xamanLaunchVisible) {
        return;
      }

      if (!backendState) {
        setStatus(
          "Xaman is ready. Starting CalorieApp securely before opening Xaman..."
        );
        return;
      }

      qrImage.src = xamanLaunch.qrUrl;
      qrImage.hidden = false;
      openLink.href = xamanLaunch.nextUrl;
      openLink.target = "_self";
      openLink.hidden = false;
      retryButton.hidden = true;
      xamanLaunchVisible = true;
      setStatus(
        "Open Xaman on this phone, or scan the QR code from another device."
      );
      connectWebsocket(xamanLaunch.websocketUrl);
    }

    function startWordPressFlow() {
      if (flowFailed || flow || startInFlight || !backendState) {
        return;
      }

      startInFlight = true;
      setStatus("Preparing a secure Xaman sign-in request...");

      apiRequest(startUrl, {
        locale: configuredLocale,
        state: backendState,
      }).then(function (result) {
        startInFlight = false;
        var payload = result.payload;
        if (
          typeof payload.flow_id !== "string" ||
          typeof payload.flow_proof !== "string" ||
          typeof payload.next_url !== "string" ||
          typeof payload.qr_png_url !== "string" ||
          typeof payload.websocket_url !== "string" ||
          payload.locale !== configuredLocale
        ) {
          throw new Error("WordPress returned incomplete Xaman data.");
        }

        flow = {
          flowId: payload.flow_id,
          flowProof: payload.flow_proof,
          locale: payload.locale,
        };
        xamanLaunch = {
          nextUrl: payload.next_url,
          qrUrl: payload.qr_png_url,
          websocketUrl: payload.websocket_url,
        };
        revealXamanWhenReady();
      }).catch(function (error) {
        startInFlight = false;
        fail(error.message || "Xaman sign-in could not be prepared.");
      });
    }

    function startLogin(message) {
      lastStartMessage = message;
      requestId = message.requestId;
      resetFlow();
      modal.hidden = false;
      if (message.locale !== configuredLocale) {
        fail("CalorieApp returned a different language context.");
        return;
      }
      if (
        typeof message.state !== "undefined" &&
        (typeof message.state !== "string" || message.state.length < 32)
      ) {
        fail("CalorieApp returned an invalid login state.");
        return;
      }
      if (typeof message.state === "string") {
        backendState = message.state;
        startWordPressFlow();
        return;
      }
      setStatus("Starting CalorieApp securely before opening Xaman...");
    }

    function finishWordPress() {
      if (
        flowFailed ||
        !flow ||
        !xamanLaunchStarted ||
        finishInFlight ||
        finishRetryTimer !== null ||
        wordpressAuthenticated
      ) {
        return;
      }

      if (finishPollStartedAt === null) {
        finishPollStartedAt = Date.now();
      }
      finishInFlight = true;
      apiRequest(finishUrl, {
        flow_id: flow.flowId,
        flow_proof: flow.flowProof,
      }).then(function (result) {
        finishInFlight = false;
        if (result.response.status === 202 || result.payload.status === "pending") {
          finishTransientFailures = 0;
          setStatus("Waiting for the Xaman signature. Keep this page open.");
          scheduleFinishRetry(finishPollDelay());
          return;
        }

        if (result.payload.status !== "wordpress_authenticated") {
          throw new Error("WordPress sign-in did not complete.");
        }

        wordpressAuthenticated = true;
        if (finishRetryTimer !== null) {
          window.clearTimeout(finishRetryTimer);
          finishRetryTimer = null;
        }
        clearSocket();
        setStatus(
          backendState
            ? "WordPress signed in. Finishing CalorieApp sign-in..."
            : "WordPress signed in. CalorieApp is starting in the background..."
        );
        maybeAuthorizeCalorieApp();
      }).catch(function (error) {
        finishInFlight = false;
        if (
          error.isTransportFailure === true ||
          error.status === 429 ||
          error.status === 502 ||
          error.status === 503 ||
          error.status === 504
        ) {
          finishTransientFailures += 1;
          setStatus("Xaman status is temporarily unavailable. Retrying safely...");
          scheduleFinishRetry(
            Math.max(
              finishPollDelay(),
              typeof error.retryAfterMs === "number"
                ? error.retryAfterMs
                : error.status === 429
                ? 15000
                : 0
            )
          );
          return;
        }
        fail(error.message || "WordPress sign-in could not be completed.");
      });
    }

    function finishPollDelay() {
      var elapsed =
        finishPollStartedAt === null
          ? 0
          : Math.max(0, Date.now() - finishPollStartedAt);
      var baseDelay =
        elapsed >= STATUS_POLL_LONG_PHASE_AFTER
          ? STATUS_POLL_LONG_DELAY
          : elapsed >= STATUS_POLL_MIDDLE_PHASE_AFTER
          ? STATUS_POLL_MIDDLE_DELAY
          : STATUS_POLL_INITIAL_DELAY;
      var failureDelay = Math.min(
        STATUS_POLL_TRANSIENT_MAX_DELAY,
        STATUS_POLL_INITIAL_DELAY * Math.pow(2, finishTransientFailures)
      );
      return Math.max(baseDelay, failureDelay);
    }

    function scheduleFinishRetry(delay) {
      if (flowFailed || wordpressAuthenticated || !xamanLaunchStarted) {
        return;
      }
      if (finishRetryTimer !== null) {
        window.clearTimeout(finishRetryTimer);
      }
      finishRetryTimer = window.setTimeout(function () {
        finishRetryTimer = null;
        finishWordPress();
      }, delay);
    }

    function scheduleAuthorizeRetry(delay) {
      if (authorizeRetryTimer !== null) {
        window.clearTimeout(authorizeRetryTimer);
      }
      authorizeRetryTimer = window.setTimeout(function () {
        authorizeRetryTimer = null;
        maybeAuthorizeCalorieApp();
      }, delay);
    }

    function maybeAuthorizeCalorieApp() {
      if (
        !flow ||
        !wordpressAuthenticated ||
        !backendState ||
        authorizeInFlight
      ) {
        return;
      }

      authorizeInFlight = true;
      apiRequest(authorizeUrl, {
        flow_id: flow.flowId,
        flow_proof: flow.flowProof,
        state: backendState,
        locale: configuredLocale,
      }).then(function (result) {
        authorizeInFlight = false;
        if (
          result.payload.status !== "authorized" ||
          typeof result.payload.code !== "string" ||
          result.payload.state !== backendState ||
          result.payload.locale !== configuredLocale
        ) {
          throw new Error("CalorieApp authorization was incomplete.");
        }

        setStatus("WordPress signed in. Activating your CalorieApp session...");
        postToApp("login:authorization", {
          code: result.payload.code,
          state: result.payload.state,
          locale: result.payload.locale,
        });
      }).catch(function (error) {
        authorizeInFlight = false;
        if (
          error.status === 429 ||
          error.status === 502 ||
          error.status === 503 ||
          error.status === 504
        ) {
          setStatus(
            "WordPress is signed in. CalorieApp is still starting; retrying automatically..."
          );
          scheduleAuthorizeRetry(error.status === 429 ? 15000 : 5000);
          return;
        }
        fail(error.message || "CalorieApp authorization could not be completed.");
      });
    }

    openLink.addEventListener("click", function () {
      markXamanStarted();
      setStatus(
        "Opening Xaman. Sign once, then tap Close or use Back to return to this browser; sign-in will finish automatically."
      );
    });

    if (siteLogoutButton) {
      siteLogoutButton.addEventListener("click", requestJointLogout);
    }

    retryButton.addEventListener("click", function () {
      if (lastStartMessage) {
        startLogin(lastStartMessage);
      }
    });

    closeButton.addEventListener("click", function () {
      modal.hidden = true;
    });

    window.addEventListener("message", function (event) {
      if (
        event.origin !== appOrigin ||
        event.source !== iframe.contentWindow ||
        !event.data ||
        typeof event.data.type !== "string"
      ) {
        return;
      }

      var message = event.data;
      if (message.type === MESSAGE_PREFIX + "bridge:ready") {
        initializeBridge();
        return;
      }

      if (message.type === MESSAGE_PREFIX + "bridge:initialized") {
        bridgeReady = true;
        if (logoutTriggerPending) {
          logoutTriggerPending = false;
          sendLogoutToApp();
        }
        if (loginTriggerPending && iframe.contentWindow) {
          loginTriggerPending = false;
          iframe.contentWindow.postMessage(
            { type: MESSAGE_PREFIX + "login:trigger", locale: configuredLocale },
            appOrigin
          );
        }
        return;
      }

      if (
        message.type === MESSAGE_PREFIX + "logout:request" &&
        message.locale === configuredLocale
      ) {
        requestJointLogout();
        return;
      }

      if (
        message.type === MESSAGE_PREFIX + "logout:complete" &&
        logoutInFlight &&
        siteLogoutButton
      ) {
        clearLogoutTimeout();
        window.location.assign(siteLogoutButton.dataset.logoutUrl);
        return;
      }

      if (
        message.type === MESSAGE_PREFIX + "logout:error" &&
        logoutInFlight &&
        siteLogoutButton
      ) {
        restoreLogoutButton(
          typeof message.message === "string"
            ? message.message
            : "Could not log out of both sessions. Please try again."
        );
        return;
      }

      if (message.type === MESSAGE_PREFIX + "login:start") {
        if (typeof message.requestId !== "string" || message.requestId.length < 8) {
          return;
        }
        startLogin(message);
        return;
      }

      if (message.requestId !== requestId) {
        return;
      }

      if (
        message.type.indexOf(MESSAGE_PREFIX + "login:") === 0 &&
        message.locale !== configuredLocale
      ) {
        fail("CalorieApp returned a different language context.");
        return;
      }

      if (message.type === MESSAGE_PREFIX + "login:state") {
        if (
          typeof message.state !== "string" ||
          message.state.length < 32 ||
          message.locale !== configuredLocale ||
          (backendState && message.state !== backendState)
        ) {
          fail("CalorieApp returned an invalid login state.");
          return;
        }
        backendState = message.state;
        startWordPressFlow();
        revealXamanWhenReady();
        maybeAuthorizeCalorieApp();
        return;
      }

      if (message.type === MESSAGE_PREFIX + "login:progress") {
        if (!flowFailed && typeof message.message === "string") {
          setStatus(message.message);
        }
        return;
      }

      if (message.type === MESSAGE_PREFIX + "login:complete") {
        if (finishRetryTimer !== null) {
          window.clearTimeout(finishRetryTimer);
          finishRetryTimer = null;
        }
        if (authorizeRetryTimer !== null) {
          window.clearTimeout(authorizeRetryTimer);
          authorizeRetryTimer = null;
        }
        setStatus(
          "Signed in to WordPress and CalorieApp. Updating your account controls..."
        );
        window.setTimeout(function () {
          modal.hidden = true;
          window.location.reload();
        }, LOGIN_COMPLETE_RELOAD_DELAY);
        return;
      }

      if (message.type === MESSAGE_PREFIX + "login:backend-error") {
        fail(
          typeof message.message === "string"
            ? message.message
            : "CalorieApp could not finish signing in."
        );
        return;
      }

      if (message.type === MESSAGE_PREFIX + "frame:height") {
        var requestedHeight = Number(message.height);
        if (Number.isFinite(requestedHeight)) {
          iframe.style.height =
            Math.max(MIN_FRAME_HEIGHT, Math.min(MAX_FRAME_HEIGHT, requestedHeight)) +
            "px";
        }
      }
    });

    iframe.addEventListener("load", initializeBridge);
    initializeBridge();

    function checkAfterReturn() {
      if (
        flow &&
        xamanLaunchStarted &&
        xamanPageWasHidden &&
        !flowFailed &&
        !wordpressAuthenticated &&
        !document.hidden
      ) {
        finishWordPress();
      }
    }

    function trackXamanVisibility() {
      if (document.hidden && xamanLaunchStarted) {
        xamanPageWasHidden = true;
        return;
      }
      checkAfterReturn();
    }

    document.addEventListener("visibilitychange", trackXamanVisibility);
    window.addEventListener("focus", checkAfterReturn);
    window.addEventListener("pageshow", checkAfterReturn);

    return function () {
      if (!iframe.contentWindow) {
        return;
      }
      if (!bridgeReady) {
        loginTriggerPending = true;
        modal.hidden = false;
        status.textContent = "Connecting the secure CalorieApp sign-in...";
        initializeBridge();
        return;
      }
      iframe.contentWindow.postMessage(
        { type: MESSAGE_PREFIX + "login:trigger", locale: configuredLocale },
        appOrigin
      );
    };
  }

  function initAll() {
    var roots = document.querySelectorAll("[data-calorieapp-embed]");
    if (roots.length === 0) {
      return;
    }

    var loginTriggers = [];
    roots.forEach(function (root) {
      var trigger = init(root);
      if (typeof trigger === "function") {
        loginTriggers.push(trigger);
      }
    });
    if (loginTriggers.length > 0) {
      // Both visible login entries use the same bridge-owned flow, so either
      // one authenticates WordPress and CalorieApp and returns to this page.
      var sessionActions = roots[0].querySelector(
        ".calorieapp-site-session-actions"
      );
      unifyLegacySigninSurfaces(loginTriggers[0], sessionActions);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
