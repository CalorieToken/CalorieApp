(function () {
  "use strict";

  function path(url) {
    return url.pathname.replace(/\/index\.php(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  }

  function isFloating(container) {
    for (var node = container; node && node !== document.body; node = node.parentElement) {
      if (window.getComputedStyle(node).position === "fixed") {
        return true;
      }
    }
    return false;
  }

  function init() {
    var config = document.querySelector("[data-calorieapp-site-integration]");
    if (!config || config.dataset.navigationReady === "1") {
      return;
    }
    var settings = config.dataset;
    var homePage;
    var appPage;
    var appLogo;
    var legacyAppPage;
    var currentPage = new URL(window.location.href);
    try {
      homePage = new URL(settings.homePage);
      appPage = new URL(settings.appPage);
      appLogo = new URL(settings.appLogo);
      legacyAppPage = new URL("index.php/integrated-exchange/", homePage);
      if ([homePage, appPage, appLogo].some(function (url) {
        return url.origin !== currentPage.origin || url.protocol !== "https:" || url.username || url.password;
      })) {
        return;
      }
    } catch (_error) {
      return;
    }
    config.dataset.navigationReady = "1";
    var onHome = settings.isHome === "1" || path(currentPage) === path(homePage);
    var onApp = !!document.querySelector("[data-calorieapp-embed]") || path(currentPage) === path(appPage);

    document.querySelectorAll(".brz-icon__container a[href]").forEach(function (link) {
      var container = link.closest(".brz-icon__container");
      if (!container || !isFloating(container)) {
        return;
      }
      var destination;
      try {
        destination = new URL(link.href);
      } catch (_error) {
        return;
      }
      if (destination.origin !== currentPage.origin || destination.hash || destination.search) {
        return;
      }
      var homeLink = path(destination) === path(homePage);
      var appLink = path(destination) === path(appPage) || path(destination) === path(legacyAppPage);
      if (!homeLink && !appLink) {
        return;
      }
      if ((homeLink && onHome) || (appLink && onApp)) {
        container.hidden = true;
        container.style.setProperty("display", "none", "important");
        return;
      }
      if (homeLink) {
        link.title = "Home";
        link.setAttribute("aria-label", "Go to Home");
        return;
      }
      var icon = link.querySelector(".brz-icon-svg");
      if (!icon) {
        return;
      }
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
      link.href = appPage.href;
      link.title = "CalorieApp";
      link.setAttribute("aria-label", "Open CalorieApp");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
