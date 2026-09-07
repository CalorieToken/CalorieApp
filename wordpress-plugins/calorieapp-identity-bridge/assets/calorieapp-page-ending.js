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

  function enhanceXpMarketPriceWidgets() {
    if (typeof document.querySelectorAll !== "function") {
      return;
    }

    var config = window.calorieappPageEnding || {};
    var endpoint = config.xpMarketWidgetUrl || "";
    var tokenUrl =
      config.xpMarketTokenUrl ||
      "https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY";
    var widgets = document.querySelectorAll(
      "[data-calorieapp-shared-page-ending] [data-calorieapp-xpmarket-widget]"
    );
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

  function initialize() {
    enhanceXpMarketPriceWidgets();
    enhanceSharedFooterCarousels();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
