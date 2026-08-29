(function () {
  "use strict";

  var MESSAGE_PREFIX = "calorieapp:";
  var MAX_FRAME_HEIGHT = 4000;
  var MIN_FRAME_HEIGHT = 700;

  function parseJsonResponse(response) {
    return response.json().catch(function () {
      return {};
    });
  }

  function apiRequest(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (response) {
      return parseJsonResponse(response).then(function (payload) {
        if (!response.ok && response.status !== 202) {
          var error = new Error(
            typeof payload.message === "string"
              ? payload.message
              : "The secure sign-in request failed."
          );
          error.status = response.status;
          error.code = typeof payload.code === "string" ? payload.code : "";
          throw error;
        }

        return { response: response, payload: payload };
      });
    });
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
    var appOrigin = root.dataset.appOrigin || "";
    var startUrl = root.dataset.startUrl || "";
    var finishUrl = root.dataset.finishUrl || "";
    var authorizeUrl = root.dataset.authorizeUrl || "";

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
    var wordpressAuthenticated = false;
    var websocket = null;
    var finishInFlight = false;
    var authorizeInFlight = false;
    var authorizeRetryTimer = null;
    var lastStartMessage = null;

    function postToApp(type, detail) {
      if (!iframe.contentWindow) {
        return;
      }

      iframe.contentWindow.postMessage(
        Object.assign(
          {
            type: MESSAGE_PREFIX + type,
            requestId: requestId,
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
        { type: MESSAGE_PREFIX + "bridge:init" },
        appOrigin
      );
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
      if (authorizeRetryTimer !== null) {
        window.clearTimeout(authorizeRetryTimer);
      }
      authorizeRetryTimer = null;
      flow = null;
      backendState = "";
      xamanLaunch = null;
      xamanLaunchVisible = false;
      wordpressAuthenticated = false;
      finishInFlight = false;
      authorizeInFlight = false;
      qrImage.hidden = true;
      qrImage.removeAttribute("src");
      openLink.hidden = true;
      openLink.setAttribute("href", "#");
      retryButton.hidden = true;
    }

    function fail(message) {
      setStatus(message, true);
      retryButton.hidden = false;
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
          setStatus("Xaman is open. Sign the request, then return to this page.");
        }
        if (payload.pre_signed === true) {
          setStatus("Signature in progress. Keep this page open.");
        }
        if (payload.expired === true) {
          fail("This Xaman request expired. Start a new sign-in request.");
        }
        if (typeof payload.signed === "boolean") {
          if (payload.signed) {
            setStatus("Signature received. Signing in WordPress...");
            finishWordPress();
          } else {
            fail("The Xaman sign-in request was rejected.");
          }
        }
      };
    }

    function revealXamanWhenReady() {
      if (!flow || !xamanLaunch || xamanLaunchVisible) {
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

    function startLogin(message) {
      lastStartMessage = message;
      requestId = message.requestId;
      resetFlow();
      modal.hidden = false;
      setStatus("Preparing a secure Xaman sign-in request...");

      apiRequest(startUrl, {}).then(function (result) {
        var payload = result.payload;
        if (
          typeof payload.flow_id !== "string" ||
          typeof payload.flow_proof !== "string" ||
          typeof payload.next_url !== "string" ||
          typeof payload.qr_png_url !== "string" ||
          typeof payload.websocket_url !== "string"
        ) {
          throw new Error("WordPress returned incomplete Xaman data.");
        }

        flow = {
          flowId: payload.flow_id,
          flowProof: payload.flow_proof,
        };
        xamanLaunch = {
          nextUrl: payload.next_url,
          qrUrl: payload.qr_png_url,
          websocketUrl: payload.websocket_url,
        };
        revealXamanWhenReady();
      }).catch(function (error) {
        fail(error.message || "Xaman sign-in could not be prepared.");
      });
    }

    function finishWordPress() {
      if (!flow || finishInFlight || wordpressAuthenticated) {
        return;
      }

      finishInFlight = true;
      apiRequest(finishUrl, {
        flow_id: flow.flowId,
        flow_proof: flow.flowProof,
      }).then(function (result) {
        finishInFlight = false;
        if (result.response.status === 202 || result.payload.status === "pending") {
          setStatus("Waiting for the Xaman signature. Keep this page open.");
          return;
        }

        if (result.payload.status !== "wordpress_authenticated") {
          throw new Error("WordPress sign-in did not complete.");
        }

        wordpressAuthenticated = true;
        clearSocket();
        setStatus(
          backendState
            ? "WordPress signed in. Finishing CalorieApp sign-in..."
            : "WordPress signed in. CalorieApp is starting in the background..."
        );
        maybeAuthorizeCalorieApp();
      }).catch(function (error) {
        finishInFlight = false;
        if (error.status === 429 || error.status === 502 || error.status === 503) {
          setStatus("Xaman status is temporarily unavailable. Retrying safely...");
          window.setTimeout(finishWordPress, error.status === 429 ? 15000 : 5000);
          return;
        }
        fail(error.message || "WordPress sign-in could not be completed.");
      });
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
      }).then(function (result) {
        authorizeInFlight = false;
        if (
          result.payload.status !== "authorized" ||
          typeof result.payload.code !== "string" ||
          result.payload.state !== backendState
        ) {
          throw new Error("CalorieApp authorization was incomplete.");
        }

        setStatus("WordPress signed in. Activating your CalorieApp session...");
        postToApp("login:authorization", {
          code: result.payload.code,
          state: result.payload.state,
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
      setStatus(
        "Opening Xaman. After signing, use Close or Back to return to this same page."
      );
    });

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

      if (message.type === MESSAGE_PREFIX + "login:state") {
        if (typeof message.state !== "string" || message.state.length < 32) {
          fail("CalorieApp returned an invalid login state.");
          return;
        }
        backendState = message.state;
        if (!flow || !xamanLaunch) {
          setStatus("CalorieApp is ready. Preparing the secure Xaman request...");
        }
        revealXamanWhenReady();
        maybeAuthorizeCalorieApp();
        return;
      }

      if (message.type === MESSAGE_PREFIX + "login:complete") {
        setStatus("Signed in to WordPress and CalorieApp in this browser.");
        window.setTimeout(function () {
          modal.hidden = true;
        }, 1400);
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
      if (flow && !wordpressAuthenticated && !document.hidden) {
        finishWordPress();
      }
    }

    document.addEventListener("visibilitychange", checkAfterReturn);
    window.addEventListener("focus", checkAfterReturn);
    window.addEventListener("pageshow", checkAfterReturn);
  }

  function initAll() {
    document.querySelectorAll("[data-calorieapp-embed]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
