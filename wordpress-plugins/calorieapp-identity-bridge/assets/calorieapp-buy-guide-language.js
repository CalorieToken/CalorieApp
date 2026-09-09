(function () {
  "use strict";
  if (window.CalorieAppBuyGuide) return;
  var config = window.calorieappSitePolish?.buyGuide;
  if (config?.publicPage !== true) return;
  var locale = config.initialLocale || "en";
  var keys = ["eyebrow", "title", "intro", "assetLabel", "issuerLabel", "currencyLabel", "walletTitle", "walletText", "walletAction", "fundTitle", "fundText", "fundAction", "reserveText", "reserveAction", "trustTitle", "trustText", "trustAction", "tradeTitle", "tradeText", "tradeAction", "sellText", "marketTitle", "marketText", "pairType", "moduleTitle", "moduleText", "riskTitle", "riskText", "appText"];
  var protectedNodes = "form,input,select,textarea,[contenteditable],.xl-card,[data-calorieapp-embed],[data-calorieapp-account]";
  function copyFor(tag) {
    var definition = config.locales?.find(function (item) { return item.tag === tag; });
    var copy = definition && config.copy?.[tag];
    if (!copy || !keys.every(function (key) { return typeof copy[key] === "string" && copy[key].trim(); })) return null;
    return { tag: tag, dir: definition.direction === "rtl" ? "rtl" : "ltr", copy: copy };
  }
  function refresh() {
    var url = new URL(window.location.href);
    if (!["https://calorietoken.net", "https://www.calorietoken.net"].includes(url.origin)
      || !["/index.php/how-to-buy-calorie/", "/how-to-buy-calorie/"].includes(url.pathname)
      || Array.from(url.searchParams.keys()).some(function (key) { return key !== "ui_lang"; })
      || !document.body?.classList.contains("page-id-4205") || document.querySelector(".brz-ed,#brz-ed-iframe")) return;
    var roots = document.querySelectorAll(".cal-buy-guide");
    var root = roots.length === 1 && roots[0];
    if (!root || root.dataset.calorieappBuyGuide !== "1" || root.closest(protectedNodes)
      || root.querySelector(protectedNodes)) return;
    var selected = copyFor(locale) || copyFor("en");
    var fields = Array.from(root.querySelectorAll("[data-cal-buy-copy]"));
    if (!selected || fields.length !== keys.length + 1 || !keys.every(function (key) {
      return fields.filter(function (node) { return node.getAttribute("data-cal-buy-copy") === key; }).length === (key === "pairType" ? 2 : 1);
    })) return;
    // Unknown CMS text or injected controls/links are not retranslated. The
    // initial guide replacement still requires the exact reviewed old markup.
    if (!fields.every(function (node) {
      var key = node.getAttribute("data-cal-buy-copy");
      return node.childNodes.length === 1 && node.childNodes[0].nodeType === 3
        && Object.values(config.copy).some(function (copy) { return copy?.[key] === node.childNodes[0].data; });
    })) return;
    var identity = root.querySelector(".cal-buy-identity");
    var values = identity && Array.from(identity.querySelectorAll("code"));
    var expected = ["Calorie (CAL)", "rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY", "43616C6F72696500000000000000000000000000"];
    if (!values || values.length !== expected.length || !values.every(function (node, i) { return node.textContent === expected[i]; })) return;
    var links = Array.from(root.querySelectorAll("a"));
    var destinations = ["https://xaman.app/", "https://xumm.app/detect/xapp:xumm.buysellxrp",
      "https://xrpl.org/docs/concepts/accounts/reserves", url.origin + "/index.php/trustline/",
      "https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY"];
    if (links.length !== destinations.length || !links.every(function (link, i) { return link.getAttribute("href") === destinations[i]; })) return;
    fields.forEach(function (node) { node.childNodes[0].data = selected.copy[node.getAttribute("data-cal-buy-copy")]; });
    root.setAttribute("lang", selected.tag); root.setAttribute("dir", selected.dir);
    root.setAttribute("aria-label", selected.copy.title);
  }
  window.CalorieAppBuyGuide = { refresh: refresh, setLocale: function (tag) { locale = tag; refresh(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
  window.addEventListener("load", refresh, { once: true });
  window.addEventListener("pageshow", refresh);
  window.dispatchEvent(new Event("calorieapp:buy-guide-ready"));
})();
