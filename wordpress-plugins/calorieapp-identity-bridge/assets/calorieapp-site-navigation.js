(function () {
  "use strict";

  function path(url) {
    return url.pathname.replace(/\/index\.php(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  }
  function floatingRoot(container) {
    for (var node = container; node && node !== document.body; node = node.parentElement) {
      if (window.getComputedStyle(node).position === "fixed") return node;
    }
    return null;
  }
  function pageHeight() {
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  }

  function init() {
    var config = document.querySelector("[data-calorieapp-site-integration]");
    var shortcuts = document.querySelector("[data-calorieapp-fallback-shortcuts]");
    // Do not suppress an old control unless the replacement exists.
    if (!config || !shortcuts || config.dataset.navigationReady === "1") return;
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
    var observer = null;
    var scheduled = false;
    var hiddenByNavigation = new Map();
    function hide(node) {
      if (!hiddenByNavigation.has(node)) {
        hiddenByNavigation.set(node, {
          hidden: node.hidden,
          display: node.style.getPropertyValue("display"),
          priority: node.style.getPropertyPriority("display")
        });
      }
      node.hidden = true;
      node.style.setProperty("display", "none", "important");
    }
    function reconcile() {
      scheduled = false;
      if (observer) observer.disconnect();
      hiddenByNavigation.forEach(function (saved, node) {
        node.hidden = saved.hidden;
        if (saved.display) node.style.setProperty("display", saved.display, saved.priority);
        else node.style.removeProperty("display");
      });
      hiddenByNavigation.clear();
      var currentPage = new URL(window.location.href);
      var onHome = config.dataset.isHome === "1" || path(currentPage) === path(homePage);
      var onApp = !!document.querySelector("[data-calorieapp-embed]") || path(currentPage) === path(appPage);
      var longPage = pageHeight() > Math.max(window.innerHeight, 1) * 2;
      var replaced = new Set();
      var roots = new Set();
      document.querySelectorAll(".brz-icon__container a[href]").forEach(function (link) {
        var container = link.closest(".brz-icon__container");
        var root = container && floatingRoot(container);
        if (!root) return;
        var destination;
        try { destination = new URL(link.href, window.location.href); }
        catch (_error) { return; }
        if (destination.origin !== origin || destination.username || destination.password) return;
        var glyph = link.querySelector("use");
        var glyphHref = glyph && (glyph.getAttribute("href") || glyph.getAttribute("xlink:href") || "");
        var anchor = destination.hash || link.getAttribute("href") === "#";
        var scrollControl = anchor && path(destination) === path(currentPage) &&
          /square-(upload|download)\.svg#nc_icon$/.test(glyphHref || "");
        var pageControl = !anchor && !destination.search &&
          [path(homePage), path(appPage), path(legacyAppPage)].indexOf(path(destination)) !== -1;
        if (!scrollControl && !pageControl) return;
        hide(container);
        replaced.add(link);
        roots.add(root);
      });
      // Empty fixed wrappers otherwise retain invisible hit areas and old slots.
      roots.forEach(function (root) {
        var controls = Array.from(root.querySelectorAll("a, button, input, select, textarea, iframe"));
        if (controls.length && controls.every(function (control) { return replaced.has(control); })) hide(root);
      });
      shortcuts.querySelectorAll("[data-calorieapp-shortcut]").forEach(function (slot) {
        var role = slot.getAttribute("data-calorieapp-shortcut");
        slot.hidden = (role === "home" && onHome) || (role === "app" && onApp) || (role === "bottom" && !longPage);
      });
      shortcuts.hidden = false;
      if (observer) observer.observe(document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "href"]
      });
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(reconcile);
    }
    shortcuts.querySelectorAll("[data-calorieapp-scroll]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        window.scrollTo({
          top: button.getAttribute("data-calorieapp-scroll") === "bottom" ? pageHeight() : 0,
          behavior: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
      });
    });
    if (window.MutationObserver) observer = new window.MutationObserver(schedule);
    reconcile();
    if (window.ResizeObserver) {
      var resizeObserver = new window.ResizeObserver(schedule);
      resizeObserver.observe(document.body);
    }
    window.addEventListener("load", schedule);
    window.addEventListener("pageshow", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("popstate", schedule);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
