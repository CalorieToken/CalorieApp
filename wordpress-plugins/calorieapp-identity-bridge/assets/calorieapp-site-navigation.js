(function () {
  "use strict";

  function path(url) {
    return url.pathname.replace(/\/index\.php(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  }

  function isFloating(container) {
    for (var node = container; node && node !== document.body; node = node.parentElement) {
      if (window.getComputedStyle(node).position === "fixed") return true;
    }
    return false;
  }

  function isVisible(container) {
    if (container.getClientRects && !container.getClientRects().length) return false;
    for (var node = container; node && node !== document.body; node = node.parentElement) {
      var style = window.getComputedStyle(node);
      if (node.hidden || style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  }

  function init() {
    var config = document.querySelector("[data-calorieapp-site-integration]");
    if (!config || config.dataset.navigationReady === "1") return;
    var homePage, appPage, appLogo, legacyAppPage;
    var origin = new URL(window.location.href).origin;
    try {
      homePage = new URL(config.dataset.homePage);
      appPage = new URL(config.dataset.appPage);
      appLogo = new URL(config.dataset.appLogo);
      legacyAppPage = new URL("index.php/integrated-exchange/", homePage);
      if ([homePage, appPage, appLogo].some(function (url) {
        return url.origin !== origin || url.protocol !== "https:" || url.username || url.password;
      })) return;
    } catch (_error) { return; }

    config.dataset.navigationReady = "1";
    var hiddenByNavigation = new Map();
    var observer = null;
    var scheduled = false;
    var fallback = document.querySelector("[data-calorieapp-fallback-shortcuts]");

    function hide(container) {
      if (!hiddenByNavigation.has(container)) {
        hiddenByNavigation.set(container, {
          hidden: container.hidden,
          display: container.style.getPropertyValue("display"),
          priority: container.style.getPropertyPriority("display")
        });
      }
      container.hidden = true;
      container.style.setProperty("display", "none", "important");
    }

    function restore() {
      hiddenByNavigation.forEach(function (saved, container) {
        container.hidden = saved.hidden;
        if (saved.display) container.style.setProperty("display", saved.display, saved.priority);
        else container.style.removeProperty("display");
      });
      hiddenByNavigation.clear();
    }

    function reconcile() {
      scheduled = false;
      // Avoid observing our own image replacements and visibility corrections.
      if (observer) observer.disconnect();
      restore();
      var currentPage = new URL(window.location.href);
      var onHome = config.dataset.isHome === "1" || path(currentPage) === path(homePage);
      var onApp = !!document.querySelector("[data-calorieapp-embed]") || path(currentPage) === path(appPage);
      var found = { home: false, app: false, top: false };

      document.querySelectorAll(".brz-icon__container a[href]").forEach(function (link) {
        var container = link.closest(".brz-icon__container");
        if (!container || !isFloating(container)) return;
        var destination;
        try { destination = new URL(link.href, window.location.href); }
        catch (_error) { return; }
        if (destination.origin !== origin || destination.username || destination.password || destination.search) return;

        var glyph = link.querySelector("use");
        var glyphHref = glyph && (glyph.getAttribute("href") || glyph.getAttribute("xlink:href") || "");
        if ((destination.hash || link.getAttribute("href") === "#") &&
            (glyphHref && /square-upload\.svg#nc_icon$/.test(glyphHref))) {
          if (isVisible(container)) found.top = true;
          return;
        }
        if (destination.hash || link.getAttribute("href") === "#") return;

        var role = path(destination) === path(homePage) ? "home" :
          (path(destination) === path(appPage) || path(destination) === path(legacyAppPage) ? "app" : "");
        if (!role) return;
        if ((role === "home" && onHome) || (role === "app" && onApp)) { hide(container); return; }

        if (role === "home") {
          link.title = "Home";
          link.setAttribute("aria-label", "Go to Home");
        } else {
          var icon = link.querySelector(".brz-icon-svg");
          if (!icon) return;
          if (icon.tagName !== "IMG" || icon.getAttribute("src") !== appLogo.href) {
            var image = document.createElement("img");
            image.src = appLogo.href;
            image.alt = "";
            image.setAttribute("aria-hidden", "true");
            image.className = "brz-icon-svg";
            image.style.width = "1em";
            image.style.height = "1em";
            image.style.objectFit = "contain";
            image.style.background = "transparent";
            image.style.display = "block";
            icon.replaceWith(image);
          }
          link.href = appPage.href;
          link.title = "CalorieApp";
          link.setAttribute("aria-label", "Open CalorieApp");
        }
        if (isVisible(container)) {
          if (found[role]) hide(container);
          else found[role] = true;
        }
      });

      if (fallback) {
        var visible = false;
        fallback.querySelectorAll("[data-calorieapp-shortcut]").forEach(function (slot) {
          var role = slot.getAttribute("data-calorieapp-shortcut");
          var show = !found[role] && !(role === "home" && onHome) && !(role === "app" && onApp);
          slot.hidden = !show;
          visible = visible || show;
        });
        fallback.hidden = !visible;
      }
      if (observer) observer.observe(document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"]
      });
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(reconcile);
    }

    if (fallback) {
      var top = fallback.querySelector("[data-calorieapp-scroll-top]");
      if (top) top.addEventListener("click", function (event) {
        event.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
      });
    }
    if (window.MutationObserver) observer = new window.MutationObserver(schedule);
    reconcile();
    window.addEventListener("load", schedule);
    window.addEventListener("pageshow", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("popstate", schedule);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
