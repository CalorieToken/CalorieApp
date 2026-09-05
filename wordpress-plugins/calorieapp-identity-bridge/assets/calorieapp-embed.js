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
  // The frontend clears its first-party session cookie without waiting for a
  // sleeping backend, while retaining a bounded window for bridge delivery.
  var JOINT_LOGOUT_TIMEOUT = 100000;
  var LOGIN_COMPLETE_RELOAD_DELAY = 1400;
  var MOBILE_LAYOUT_QUERY = "(max-width: 768px)";
  var CALORIEAPP_PAGE_PATH = "/index.php/calorieapp/";
  var LEGACY_EXCHANGE_PATHS = [
    "/index.php/integrated-exchange",
    "/index.php/integrated-exchange/",
    "/integrated-exchange",
    "/integrated-exchange/",
  ];
  var legacyIdentityCenterFrame = null;
  var xpMarketWidgetRequest = null;

  function escapeHtmlAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function calorieAppLogoMarkup() {
    var config = window.calorieappIdentityBridgeChrome || {};
    var logoUrl = typeof config.logoUrl === "string" ? config.logoUrl.trim() : "";
    if (!logoUrl) {
      return "";
    }

    var parsedLogoUrl;
    try {
      parsedLogoUrl = new URL(logoUrl, window.location.origin);
    } catch (_error) {
      return "";
    }
    if (
      parsedLogoUrl.protocol !== "https:" &&
      parsedLogoUrl.protocol !== "http:"
    ) {
      return "";
    }

    return (
      '<img class="calorieapp-page-tool-logo" src="' +
      escapeHtmlAttribute(parsedLogoUrl.href) +
      '" alt="" width="48" height="48" aria-hidden="true" decoding="async">'
    );
  }

  function formatCompactNumber(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) {
      return "—";
    }
    try {
      return new Intl.NumberFormat(undefined, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(number);
    } catch (_error) {
      return String(Math.round(number));
    }
  }

  function formatSmallPrice(value, prefix, suffix) {
    var number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      return "—";
    }
    var formatted;
    if (number === 0) {
      formatted = "0";
    } else if (number < 0.01) {
      formatted = number.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
    } else {
      formatted = number.toLocaleString(undefined, {
        maximumFractionDigits: 6,
      });
    }
    return (prefix || "") + formatted + (suffix || "");
  }

  function normalizeXpMarketBrizyLayout(widget) {
    if (!widget || typeof widget.closest !== "function") {
      return;
    }

    var shortcodeHost = widget.closest(".brz-wp-shortcode");
    if (!shortcodeHost || !shortcodeHost.classList) {
      return;
    }
    shortcodeHost.classList.add("calorieapp-xpmarket-host");

    if (typeof shortcodeHost.closest !== "function") {
      return;
    }
    var brizyWrapper = shortcodeHost.closest(".brz-wrapper");
    if (brizyWrapper && brizyWrapper.classList) {
      brizyWrapper.classList.add("calorieapp-xpmarket-brizy-wrapper");
    }
  }

  function renderXpMarketWidget(widget, payload) {
    var data = payload && payload.data;
    if (!data || !widget) {
      throw new Error("XPMarket widget payload is incomplete");
    }

    var setText = function (selector, value) {
      var target = widget.querySelector(selector);
      if (target) {
        target.textContent = value;
      }
    };
    var logo = widget.querySelector(".calorieapp-xpmarket-logo");
    if (logo && typeof data.logo === "string") {
      logo.setAttribute("src", data.logo);
    }
    setText(".calorieapp-xpmarket-title", data.title || "Calorie Token");
    setText(
      ".calorieapp-xpmarket-price",
      formatSmallPrice(data.price_usd, "$")
    );
    setText(
      ".calorieapp-xpmarket-xrp",
      formatSmallPrice(data.price_xrp, "", " XRP")
    );
    setText(
      ".calorieapp-xpmarket-market-cap",
      "$" + formatCompactNumber(data.market_cap_usd)
    );
    setText(".calorieapp-xpmarket-rank", "#" + String(data.rank));
    setText(
      ".calorieapp-xpmarket-holders",
      formatCompactNumber(data.holders)
    );
    setText(".calorieapp-xpmarket-state", "Live data");
    widget.setAttribute("data-state", "ready");
  }

  function enhanceXpMarketPriceWidgets() {
    if (typeof document.querySelectorAll !== "function") {
      return;
    }

    var config = window.calorieappIdentityBridgeChrome || {};
    var endpoint = config.xpMarketWidgetUrl || "";
    var tokenUrl =
      config.xpMarketTokenUrl ||
      "https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY";
    var widgets = document.querySelectorAll(
      ".livecoinwatch-widget-1, [data-calorieapp-xpmarket-widget]"
    );
    if (!widgets.length) {
      return;
    }

    document
      .querySelectorAll('script[src*="livecoinwatch.com/static/lcw-widget"]')
      .forEach(function (script) {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });

    widgets.forEach(function (widget) {
      normalizeXpMarketBrizyLayout(widget);
      if (widget.getAttribute("data-calorieapp-xpmarket-widget") === "1") {
        return;
      }
      widget.setAttribute("data-calorieapp-xpmarket-widget", "1");
      widget.setAttribute("data-state", "loading");
      widget.removeAttribute("style");
      if (widget.classList) {
        widget.classList.remove("livecoinwatch-widget-1");
        widget.classList.add("calorieapp-xpmarket-widget");
      }
      widget.innerHTML =
        '<a class="calorieapp-xpmarket-link" rel="noopener noreferrer">' +
        '<span class="calorieapp-xpmarket-heading">' +
        '<img class="calorieapp-xpmarket-logo" alt="" width="48" height="48">' +
        '<span><strong class="calorieapp-xpmarket-title">Calorie Token</strong>' +
        '<small>CAL · XPMarket</small></span>' +
        '<span class="calorieapp-xpmarket-state" aria-live="polite">Loading…</span>' +
        "</span>" +
        '<span class="calorieapp-xpmarket-prices">' +
        '<strong class="calorieapp-xpmarket-price">—</strong>' +
        '<small class="calorieapp-xpmarket-xrp">—</small>' +
        "</span>" +
        '<span class="calorieapp-xpmarket-stats">' +
        '<span><small>Market cap</small><strong class="calorieapp-xpmarket-market-cap">—</strong></span>' +
        '<span><small>Rank</small><strong class="calorieapp-xpmarket-rank">—</strong></span>' +
        '<span><small>Holders</small><strong class="calorieapp-xpmarket-holders">—</strong></span>' +
        "</span>" +
        '<span class="calorieapp-xpmarket-cta">View CAL on XPMarket <span aria-hidden="true">→</span></span>' +
        "</a>";

      var link = widget.querySelector(".calorieapp-xpmarket-link");
      if (link) {
        link.setAttribute("href", tokenUrl);
        link.setAttribute("aria-label", "View live Calorie Token data on XPMarket");
      }
    });

    if (!endpoint || typeof window.fetch !== "function") {
      widgets.forEach(function (widget) {
        var status = widget.querySelector(".calorieapp-xpmarket-state");
        if (status) {
          status.textContent = "Open XPMarket";
        }
        widget.setAttribute("data-state", "fallback");
      });
      return;
    }

    if (!xpMarketWidgetRequest) {
      xpMarketWidgetRequest = window
        .fetch(endpoint, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("XPMarket widget request failed");
          }
          return response.json();
        });
    }

    xpMarketWidgetRequest
      .then(function (payload) {
        widgets.forEach(function (widget) {
          renderXpMarketWidget(widget, payload);
        });
      })
      .catch(function () {
        widgets.forEach(function (widget) {
          var status = widget.querySelector(".calorieapp-xpmarket-state");
          if (status) {
            status.textContent = "Open XPMarket";
          }
          widget.setAttribute("data-state", "fallback");
        });
      });
  }

  function enhanceSharedFooterCarousels() {
    document
      .querySelectorAll("[data-calorieapp-social-carousel]")
      .forEach(function (carousel) {
        if (carousel.getAttribute("data-carousel-ready") === "1") {
          return;
        }
        var track = carousel.querySelector(".calorieapp-shared-social-track");
        if (!track) {
          return;
        }
        carousel.setAttribute("data-carousel-ready", "1");
        carousel
          .querySelectorAll("[data-calorieapp-carousel-direction]")
          .forEach(function (button) {
            button.addEventListener("click", function () {
              var direction = Number(
                button.getAttribute("data-calorieapp-carousel-direction")
              );
              var item = track.querySelector("a");
              var step = item ? item.getBoundingClientRect().width : track.clientWidth;
              track.scrollBy({
                left: (direction < 0 ? -1 : 1) * step,
                behavior: "smooth",
              });
            });
          });
      });
  }

  function enhanceSharedPageShortcuts() {
    if (
      !window.location ||
      !window.location.origin ||
      typeof document.querySelectorAll !== "function"
    ) {
      return;
    }

    var calorieAppUrl;
    try {
      calorieAppUrl = new URL(CALORIEAPP_PAGE_PATH, window.location.origin).href;
    } catch (_error) {
      return;
    }
    var logoMarkup = calorieAppLogoMarkup();

    document.querySelectorAll("a[href]").forEach(function (link) {
      if (
        !link ||
        typeof link.getAttribute !== "function" ||
        typeof link.querySelector !== "function"
      ) {
        return;
      }

      var href = link.getAttribute("href") || "";
      if (href.indexOf("integrated-exchange") === -1) {
        return;
      }
      var target;
      try {
        target = new URL(href, window.location.href || window.location.origin);
      } catch (_error) {
        return;
      }
      if (
        target.origin !== window.location.origin ||
        LEGACY_EXCHANGE_PATHS.indexOf(target.pathname) === -1
      ) {
        return;
      }

      // Only replace Brizy's compact shortcut. Text links remain untouched so
      // a later content review can handle them with their surrounding copy.
      var icon = link.querySelector(".brz-icon");
      if (!icon || !logoMarkup) {
        return;
      }

      link.setAttribute("href", calorieAppUrl);
      link.setAttribute("aria-label", "CalorieApp");
      link.setAttribute("title", "CalorieApp");
      if (link.classList && typeof link.classList.add === "function") {
        link.classList.add("calorieapp-page-tool-link");
      }
      icon.innerHTML = logoMarkup;
      if (icon.classList && typeof icon.classList.add === "function") {
        icon.classList.add("calorieapp-page-tool-logo-frame");
      }
    });

    document.querySelectorAll(".calorieapp-page-top").forEach(function (link) {
      if (
        !link ||
        typeof link.addEventListener !== "function" ||
        (typeof link.getAttribute === "function" &&
          link.getAttribute("data-calorieapp-top-ready") === "1")
      ) {
        return;
      }
      link.setAttribute("data-calorieapp-top-ready", "1");
      link.addEventListener("click", function (event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (typeof window.scrollTo === "function") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });
  }

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

  function mobileViewportWidth() {
    var documentWidth = Number(
      document.documentElement && document.documentElement.clientWidth
    );
    if (Number.isFinite(documentWidth) && documentWidth > 0) {
      return documentWidth;
    }
    var windowWidth = Number(window.innerWidth);
    return Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 0;
  }

  function isMobileLayout() {
    if (typeof window.matchMedia === "function") {
      return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
    }
    var viewportWidth = mobileViewportWidth();
    return viewportWidth > 0 && viewportWidth <= 768;
  }

  function centerLegacyIdentityCard(identityCard) {
    if (
      !identityCard ||
      !identityCard.style ||
      typeof identityCard.style.setProperty !== "function" ||
      typeof identityCard.getBoundingClientRect !== "function"
    ) {
      return;
    }

    if (!isMobileLayout()) {
      if (typeof identityCard.style.removeProperty === "function") {
        identityCard.style.removeProperty("--calorieapp-identity-center-shift");
      }
      return;
    }

    var viewportWidth = mobileViewportWidth();
    var cardBounds = identityCard.getBoundingClientRect();
    if (
      viewportWidth <= 0 ||
      !cardBounds ||
      !Number.isFinite(cardBounds.left) ||
      !Number.isFinite(cardBounds.width) ||
      cardBounds.width <= 0
    ) {
      return;
    }

    var currentShift = Number.parseFloat(
      typeof identityCard.style.getPropertyValue === "function"
        ? identityCard.style.getPropertyValue(
            "--calorieapp-identity-center-shift"
          )
        : ""
    );
    if (!Number.isFinite(currentShift)) {
      currentShift = 0;
    }

    var correction =
      viewportWidth / 2 - (cardBounds.left + cardBounds.width / 2);
    if (!Number.isFinite(correction) || Math.abs(correction) < 0.5) {
      return;
    }

    var nextShift = Math.round((currentShift + correction) * 100) / 100;
    identityCard.style.setProperty(
      "--calorieapp-identity-center-shift",
      nextShift + "px"
    );
  }

  function scheduleLegacyIdentityCardCentering(identityCard) {
    if (!identityCard) {
      return;
    }

    var run = function () {
      legacyIdentityCenterFrame = null;
      centerLegacyIdentityCard(identityCard);
    };
    if (typeof window.requestAnimationFrame !== "function") {
      run();
      return;
    }
    if (
      legacyIdentityCenterFrame !== null &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(legacyIdentityCenterFrame);
    }
    legacyIdentityCenterFrame = window.requestAnimationFrame(run);
  }

  function keepLegacyIdentityCardCentered(identityCard) {
    if (!identityCard) {
      return;
    }
    scheduleLegacyIdentityCardCentering(identityCard);
    if (typeof window.addEventListener === "function") {
      window.addEventListener("load", function () {
        scheduleLegacyIdentityCardCentering(identityCard);
      });
      window.addEventListener("resize", function () {
        scheduleLegacyIdentityCardCentering(identityCard);
      });
    }
  }

  function initSitewideLogout(sessionActions) {
    if (
      !sessionActions ||
      sessionActions.dataset.calorieappLogoutReady === "1"
    ) {
      return;
    }

    var logoutButton = sessionActions.querySelector(
      ".calorieapp-site-logout"
    );
    var logoutStatus = sessionActions.querySelector(
      ".calorieapp-site-logout-status"
    );
    var appOrigin = sessionActions.dataset.appOrigin || "";
    var frameSrc = sessionActions.dataset.frameSrc || "";
    if (!logoutButton || !logoutStatus || !appOrigin || !frameSrc) {
      return;
    }

    try {
      if (new URL(frameSrc).origin !== appOrigin) {
        return;
      }
    } catch (_error) {
      return;
    }

    sessionActions.dataset.calorieappLogoutReady = "1";
    var logoutFrame = null;
    var logoutTimeout = null;
    var logoutInFlight = false;
    var logoutSent = false;

    function setLogoutStatus(message) {
      logoutStatus.textContent = message;
      logoutStatus.hidden = message === "";
    }

    function removeLogoutFrame() {
      if (logoutFrame && typeof logoutFrame.remove === "function") {
        logoutFrame.remove();
      }
      logoutFrame = null;
    }

    function clearLogoutTimeout() {
      if (logoutTimeout !== null) {
        window.clearTimeout(logoutTimeout);
        logoutTimeout = null;
      }
    }

    function restoreLogoutButton(message) {
      clearLogoutTimeout();
      removeLogoutFrame();
      logoutInFlight = false;
      logoutSent = false;
      logoutButton.disabled = false;
      logoutButton.textContent =
        logoutButton.dataset.idleLabel || "Sign out both";
      setLogoutStatus(message);
    }

    function postToLogoutFrame(type) {
      if (!logoutFrame || !logoutFrame.contentWindow) {
        return;
      }
      logoutFrame.contentWindow.postMessage(
        {
          type: MESSAGE_PREFIX + type,
          locale: sessionActions.dataset.locale || "en",
        },
        appOrigin
      );
    }

    function handleLogoutMessage(event) {
      if (
        !logoutFrame ||
        event.origin !== appOrigin ||
        event.source !== logoutFrame.contentWindow ||
        !event.data ||
        typeof event.data.type !== "string"
      ) {
        return;
      }

      if (event.data.type === MESSAGE_PREFIX + "bridge:ready") {
        postToLogoutFrame("bridge:init");
        return;
      }
      if (
        event.data.type === MESSAGE_PREFIX + "bridge:initialized" &&
        !logoutSent
      ) {
        logoutSent = true;
        postToLogoutFrame("logout");
        return;
      }
      if (event.data.type === MESSAGE_PREFIX + "logout:complete") {
        clearLogoutTimeout();
        removeLogoutFrame();
        window.location.assign(logoutButton.dataset.logoutUrl);
        return;
      }
      if (event.data.type === MESSAGE_PREFIX + "logout:error") {
        restoreLogoutButton(
          typeof event.data.message === "string"
            ? event.data.message
            : "Could not log out of both sessions. Please try again."
        );
      }
    }

    window.addEventListener("message", handleLogoutMessage);
    logoutButton.addEventListener("click", function () {
      if (logoutInFlight || !(logoutButton.dataset.logoutUrl || "")) {
        return;
      }

      logoutInFlight = true;
      logoutSent = false;
      logoutButton.disabled = true;
      logoutButton.textContent = "Logging out...";
      setLogoutStatus("");

      logoutFrame = document.createElement("iframe");
      logoutFrame.className = "calorieapp-sitewide-logout-frame";
      logoutFrame.title = "CalorieApp sign-out bridge";
      logoutFrame.src = frameSrc;
      logoutFrame.setAttribute("aria-hidden", "true");
      logoutFrame.setAttribute("tabindex", "-1");
      document.body.appendChild(logoutFrame);

      logoutTimeout = window.setTimeout(function () {
        restoreLogoutButton(
          "CalorieApp did not respond. Please try logging out again."
        );
      }, JOINT_LOGOUT_TIMEOUT);
    });
  }

  function attachSitewideSessionActions(identityCard) {
    if (!identityCard || typeof document.querySelector !== "function") {
      return;
    }
    var sessionActions = document.querySelector(
      "[data-calorieapp-sitewide-session-actions]"
    );
    if (!sessionActions) {
      return;
    }
    identityCard.appendChild(sessionActions);
    sessionActions.hidden = false;
    initSitewideLogout(sessionActions);
  }

  function markLegacyMobileMenuColumn() {
    var menuSurfaces = document.querySelectorAll(".brz-menu-simple");
    menuSurfaces.forEach(function (menuSurface) {
      if (typeof menuSurface.closest !== "function") {
        return;
      }
      var menuColumn = menuSurface.closest(".brz-columns");
      if (
        menuColumn &&
        menuColumn.classList &&
        typeof menuColumn.classList.add === "function"
      ) {
        menuColumn.classList.add("calorieapp-brizy-menu-column");
      }
    });
  }

  function markLegacyPageLayout() {
    var identityCard = null;
    document.querySelectorAll(".xl-card").forEach(function (card) {
      if (!identityCard && !card.closest("[data-calorieapp-embed]")) {
        identityCard = card;
      }
    });
    if (!identityCard) {
      return null;
    }

    if (identityCard.classList && typeof identityCard.classList.add === "function") {
      identityCard.classList.add("calorieapp-identity-card");
    }
    if (typeof identityCard.closest === "function") {
      var identityWrapper = identityCard.closest(".brz-wrapper");
      if (
        identityWrapper &&
        identityWrapper.classList &&
        typeof identityWrapper.classList.add === "function"
      ) {
        identityWrapper.classList.add("calorieapp-identity-wrapper");
      }
    }
    markLegacyMobileMenuColumn();
    return identityCard;
  }

  function unifyLegacySigninSurfaces(triggerLogin, sessionActions, identityCard) {
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
      return;
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
    enhanceSharedPageShortcuts();
    enhanceXpMarketPriceWidgets();
    enhanceSharedFooterCarousels();
    var identityCard = markLegacyPageLayout();
    keepLegacyIdentityCardCentered(identityCard);
    var roots = document.querySelectorAll("[data-calorieapp-embed]");
    if (roots.length === 0) {
      attachSitewideSessionActions(identityCard);
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
      unifyLegacySigninSurfaces(loginTriggers[0], sessionActions, identityCard);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
