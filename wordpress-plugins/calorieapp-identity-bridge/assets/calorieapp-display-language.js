(function () {
  "use strict";
  function boot() {
    var panel = document.querySelector("[data-calorieapp-display-language]");
    var runtime = window.CalorieAppDisplayLanguage;
    var config = window.calorieappDisplayLanguageConfig;
    if (!panel || !runtime || !config || panel.dataset.ready === "1" || document.querySelector(".brz-ed")) return;
    if (!Array.isArray(config.locales) || !config.copy || !config.copy.en || !config.information) return;
    panel.dataset.ready = "1";
    var select = panel.querySelector("select");
    var label = panel.querySelector("[data-calorieapp-language-label]");
    var note = panel.querySelector("[data-calorieapp-language-note]");
    var store = runtime.createStore({
      locales: config.locales.map(function (item) { return item.tag; }),
      fallback: "en", initialLocale: config.initialLocale,
      storage: {
        getItem: function (key) { return window.localStorage.getItem(key); },
        setItem: function (key, value) { window.localStorage.setItem(key, value); },
        removeItem: function (key) { window.localStorage.removeItem(key); }
      }
    });
    function text(node, value) {
      if (node && typeof value === "string" && node.textContent !== value) node.textContent = value;
    }
    function render(state) {
      var definition = config.locales.find(function (item) { return item.tag === state.locale; });
      var copy = config.copy[state.locale] || config.copy.en;
      select.value = state.locale;
      panel.lang = state.locale;
      panel.dir = definition.direction;
      text(label, copy.label);
      text(note, copy.preview);
      // Only the owned, already translated information component participates.
      // The optional FAQ adapter owns its two matched paragraphs separately.
      // Legal documents, account fields and authentication locale are untouched.
      var info = document.querySelector("[data-calorieapp-app-info]");
      var infoCopy = config.information[state.locale];
      if (info && infoCopy) {
        info.lang = state.locale;
        info.dir = definition.direction;
        text(info.querySelector("div > p"), infoCopy.description);
        text(info.querySelector(".calorieapp-app-info-link"), infoCopy.action);
        text(info.querySelector(".calorieapp-app-info-current"), infoCopy.on_page);
      }
      if (typeof window.CalorieAppBlogX?.setLocale === "function") window.CalorieAppBlogX.setLocale(state.locale);
      if (typeof window.CalorieAppRichlist?.setLocale === "function") window.CalorieAppRichlist.setLocale(state.locale);
      if (typeof window.CalorieAppPageNavigation?.setLocale === "function") window.CalorieAppPageNavigation.setLocale(state.locale);
      if (typeof window.CalorieAppTrustline?.setLocale === "function") window.CalorieAppTrustline.setLocale(state.locale);
      if (typeof window.CalorieAppTokenomics?.setLocale === "function") window.CalorieAppTokenomics.setLocale(state.locale);
      if (typeof window.CalorieAppBuyGuide?.setLocale === "function") window.CalorieAppBuyGuide.setLocale(state.locale);
    }
    function place() {
      var card = Array.from(document.querySelectorAll(".brz .xl-card")).find(function (node) {
        return !node.closest("[data-calorieapp-embed],form");
      });
      if (card && panel.parentElement !== card) card.appendChild(panel);
      panel.hidden = false;
    }
    select.addEventListener("change", function () {
      store.select(select.value);
      render(store.get());
    });
    store.subscribe(render);
    render(store.get());
    place();
    var cms = config.cmsPreview && typeof window.CalorieAppCmsLanguagePreview?.connect === "function"
      ? window.CalorieAppCmsLanguagePreview.connect({
        enabled: true, document: document, location: window.location,
        catalogue: config.cmsPreview, store: store
      }) : null;
    function refreshPage() {
      place();
      if (typeof window.CalorieAppBlogX?.setLocale === "function") window.CalorieAppBlogX.setLocale(store.get().locale);
      if (typeof window.CalorieAppRichlist?.setLocale === "function") window.CalorieAppRichlist.setLocale(store.get().locale);
      if (typeof window.CalorieAppPageNavigation?.setLocale === "function") window.CalorieAppPageNavigation.setLocale(store.get().locale);
      if (typeof window.CalorieAppTrustline?.setLocale === "function") window.CalorieAppTrustline.setLocale(store.get().locale);
      if (typeof window.CalorieAppTokenomics?.setLocale === "function") window.CalorieAppTokenomics.setLocale(store.get().locale);
      if (typeof window.CalorieAppBuyGuide?.setLocale === "function") window.CalorieAppBuyGuide.setLocale(store.get().locale);
      if (cms) cms.refresh();
    }
    window.addEventListener("load", refreshPage);
    window.addEventListener("pageshow", refreshPage);
    window.addEventListener("calorieapp:page-tools-ready", function () {
      if (typeof window.CalorieAppPageNavigation?.setLocale === "function") window.CalorieAppPageNavigation.setLocale(store.get().locale);
    });
    window.addEventListener("calorieapp:trustline-ready", function () {
      if (typeof window.CalorieAppTrustline?.setLocale === "function") window.CalorieAppTrustline.setLocale(store.get().locale);
    });
    window.addEventListener("calorieapp:tokenomics-ready", function () {
      if (typeof window.CalorieAppTokenomics?.setLocale === "function") window.CalorieAppTokenomics.setLocale(store.get().locale);
    });
    window.addEventListener("calorieapp:buy-guide-ready", function () {
      if (typeof window.CalorieAppBuyGuide?.setLocale === "function") window.CalorieAppBuyGuide.setLocale(store.get().locale);
    });
    if (cms) window.addEventListener("pagehide", function (event) {
      // Keep the same connection for bfcache; pageshow rechecks its source.
      if (!event.persisted) cms.disconnect();
    });
    if (typeof MutationObserver === "function") {
      var observer = new MutationObserver(function () {
        if (!panel.isConnected || !panel.closest(".xl-card")) place();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    if (typeof window.crypto?.randomUUID === "function") runtime.connectHost({
      window: window, store: store, epoch: window.crypto.randomUUID(),
      frames: function () {
        return Array.from(document.querySelectorAll("[data-calorieapp-embed]")).map(function (root) {
          var frame = root.querySelector(".calorieapp-embed-frame");
          return frame && frame.contentWindow ? { window: frame.contentWindow, origin: root.dataset.appOrigin } : null;
        }).filter(Boolean);
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
