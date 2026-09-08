(function () {
  "use strict";
  var xpMarketWidgetRequest = null;

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

  function renderXpMarketWidget(widget, payload) {
    var data = payload && payload.data;
    if (!payload || !payload.success || !data || !widget ||
        data.code !== "Calorie" ||
        data.issuer !== "rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY" ||
        !["price_usd", "price_xrp", "market_cap_usd", "rank", "holders"].every(function (key) {
          return typeof data[key] === "number" && Number.isFinite(data[key]) && data[key] >= 0;
        })) {
      throw new Error("XPMarket widget payload is incomplete");
    }

    var setText = function (selector, value) {
      var target = widget.querySelector(selector);
      if (target) {
        target.textContent = value;
      }
    };
    var logo = widget.querySelector(".calorieapp-xpmarket-logo");
    if (logo && typeof data.logo === "string" && data.logo.indexOf("https://xpcdn.xpmarket.com/") === 0) {
      logo.setAttribute("src", data.logo);
      logo.hidden = false;
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
    setText(".calorieapp-xpmarket-state", "XPMarket data");
    widget.setAttribute("data-state", "ready");
  }

  function marketOnly(node) {
    var copy = node.cloneNode(true);
    copy.querySelectorAll('script, style, .brz-bg, .livecoinwatch-widget-1, [data-calorieapp-xpmarket-widget]').forEach(function (item) { item.remove(); });
    return !copy.textContent.trim() && !copy.querySelector('a, img, svg, iframe, video, audio, canvas, input, button, select, textarea, .xl-card, [data-calorieapp-embed]');
  }

  function normalizeMarketHost(widget) {
    var host = widget.closest('.brz-wp-shortcode');
    // A combined shortcode containing an account card must keep its own sizing.
    if (!host || !marketOnly(host)) return;
    host.classList.add('calorieapp-xpmarket-host');
    if (widget.parentElement !== host && marketOnly(widget.parentElement)) {
      widget.parentElement.classList.add('calorieapp-xpmarket-inner');
    }
    // Old mobile widths and negative margins also live ABOVE the shortcode.
    // Stop before any ancestor shared with account controls or page content.
    for (var node = host; node && node !== document.body; node = node.parentElement) {
      if (node.matches('.brz-container, .brz-section, section') || !marketOnly(node)) break;
      if (node.matches('.brz-wp-shortcode, .brz-wrapper, .brz-column__items, .brz-columns, .brz-row, .brz-row__container')) {
        node.classList.add('calorieapp-xpmarket-layout');
      }
    }
  }

  function positionSitewideMarket() {
    if (typeof document.querySelector !== "function") return;
    var injected = document.querySelector("[data-calorieapp-sitewide-market]");
    if (!injected) return;
    var hasExistingMarket = Array.from(document.querySelectorAll(
      ".livecoinwatch-widget-1, [data-calorieapp-xpmarket-widget]"
    )).some(function (widget) { return !injected.contains(widget); });
    if (hasExistingMarket) {
      injected.remove();
      return;
    }

    var legalLine = Array.from(document.querySelectorAll(".brz p, .brz footer, .brz [role=contentinfo]"))
      .find(function (node) { return String(node.textContent || "").replace(/\s+/g, " ").trim().indexOf("Operator: ICTHendrikse") === 0; });
    var footerSection = legalLine && (legalLine.closest("section") || legalLine.closest("footer") || legalLine.closest("[role=contentinfo]"));
    if (footerSection && footerSection.parentNode && injected.nextElementSibling !== footerSection) {
      footerSection.parentNode.insertBefore(injected, footerSection);
    }
  }

  function enhanceXpMarketPriceWidgets() {
    if (typeof document.querySelectorAll !== "function") {
      return;
    }

    positionSitewideMarket();
    var config = window.calorieappPageEnding || {};
    var endpoint = config.xpMarketWidgetUrl || "";
    var tokenUrl =
      config.xpMarketTokenUrl ||
      "https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY";
    var widgets = Array.from(document.querySelectorAll(
      ".livecoinwatch-widget-1, [data-calorieapp-xpmarket-widget]"
    )).map(function (widget) {
      if (widget.classList.contains("livecoinwatch-widget-1")) {
        // Replace the node so an already-running legacy script cannot refill it.
        var replacement = document.createElement("div");
        if (widget.id) replacement.id = widget.id;
        replacement.setAttribute("data-calorieapp-xpmarket-widget", "");
        widget.replaceWith(replacement);
        widget = replacement;
      }
      normalizeMarketHost(widget);
      return widget;
    }).filter(function (widget) {
      return widget.getAttribute("data-calorieapp-xpmarket-widget") !== "1";
    });
    if (!widgets.length) {
      return;
    }

    widgets.forEach(function (widget) {
      if (widget.getAttribute("data-calorieapp-xpmarket-widget") === "1") {
        return;
      }
      widget.setAttribute("data-calorieapp-xpmarket-widget", "1");
      widget.setAttribute("data-state", "loading");
      if (widget.classList) {
        widget.classList.add("calorieapp-xpmarket-widget");
      }
      widget.innerHTML =
        '<a class="calorieapp-xpmarket-link" rel="noopener noreferrer">' +
        '<span class="calorieapp-xpmarket-heading">' +
        '<img class="calorieapp-xpmarket-logo" alt="" width="48" height="48" loading="lazy" referrerpolicy="no-referrer" hidden>' +
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
      var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
      var timer = controller ? window.setTimeout(function () { controller.abort(); }, 12000) : null;
      xpMarketWidgetRequest = window
        .fetch(endpoint, {
          credentials: "omit",
          signal: controller ? controller.signal : undefined,
          headers: { Accept: "application/json" },
        })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("XPMarket widget request failed");
          }
          return response.json();
        }).finally(function () {
          if (timer !== null) window.clearTimeout(timer);
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
                behavior: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
              });
            });
          });
      });
  }

  function initializeEmbedLoading() {
    document.querySelectorAll('[data-calorieapp-embed]').forEach(function (root) {
      var stage = root.querySelector('[data-calorieapp-frame-stage]');
      var frame = root.querySelector('.calorieapp-embed-frame');
      var mask = root.querySelector('[data-calorieapp-embed-loading]');
      if (!stage || !frame || !mask || mask.getAttribute('data-loading-ready') === '1') return;
      var appOrigin;
      try {
        appOrigin = new URL(root.getAttribute('data-app-origin'));
        if (appOrigin.protocol !== 'https:' || new URL(frame.getAttribute('src')).origin !== appOrigin.origin) return;
      } catch (_error) { return; }
      mask.setAttribute('data-loading-ready', '1');
      var message = mask.querySelector('[data-calorieapp-loading-message]');
      var actions = mask.querySelector('[data-calorieapp-loading-actions]');
      var retry = mask.querySelector('[data-calorieapp-loading-retry]');
      var reveal = mask.querySelector('[data-calorieapp-loading-reveal]');
      var timer = null;
      var complete = false;
      var initialMessage = message.textContent;

      function show() {
        complete = false;
        mask.hidden = false;
        stage.setAttribute('data-calorieapp-frame-loading', '1');
        stage.setAttribute('aria-busy', 'true');
        message.textContent = initialMessage;
        actions.hidden = true;
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          timer = null;
          if (complete) return;
          message.textContent = mask.getAttribute('data-slow-message');
          actions.hidden = false;
        }, 45000);
      }
      function finish() {
        complete = true;
        if (timer !== null) window.clearTimeout(timer);
        timer = null;
        mask.hidden = true;
        stage.removeAttribute('data-calorieapp-frame-loading');
        stage.setAttribute('aria-busy', 'false');
      }
      window.addEventListener('message', function (event) {
        if (event.source !== frame.contentWindow || event.origin !== appOrigin.origin || !event.data ||
            event.data.type !== 'calorieapp:bridge:initialized' || event.data.locale !== root.getAttribute('data-locale')) return;
        finish();
      });
      retry.addEventListener('click', function () {
        if (complete) return;
        show();
        frame.setAttribute('src', frame.getAttribute('src'));
      });
      reveal.addEventListener('click', finish);
      // An iframe load can be the hosting provider's wake-up screen. Only the
      // existing origin/source/locale-bound app handshake dismisses this mask.
      show();
    });
  }

  function initialize() {
    initializeEmbedLoading();
    enhanceXpMarketPriceWidgets();
    enhanceSharedFooterCarousels();
    window.addEventListener("load", enhanceXpMarketPriceWidgets);
    window.addEventListener("pageshow", enhanceXpMarketPriceWidgets);
    if (window.MutationObserver) {
      var scheduled = false;
      var selector = ".livecoinwatch-widget-1, [data-calorieapp-xpmarket-widget]";
      var observer = new window.MutationObserver(function (records) {
        var addedWidget = records.some(function (record) {
          return Array.from(record.addedNodes).some(function (node) {
            return node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector));
          });
        });
        if (!addedWidget || scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(function () {
          scheduled = false;
          enhanceXpMarketPriceWidgets();
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
