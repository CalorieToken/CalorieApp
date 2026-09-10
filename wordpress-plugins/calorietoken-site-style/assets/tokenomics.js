(function () {
  "use strict";

  function allowed() {
    return document.body && document.body.classList.contains('ctstyle-enabled')
      && !document.body.matches('.home,.page-id-1090,.page-id-8001,.brz-ed')
      && !document.querySelector('.brz-ed,#brz-ed-iframe')
      && !/\/wp-admin\//.test(window.location.pathname)
      && !Array.from(new URL(window.location.href).searchParams.keys()).some(function (key) {
        return /^(?:preview|customize_changeset_uuid|brizy-edit|brizy-edit-iframe|brz-edit|brz-edit-iframe)$/.test(key);
      });
  }
  if (!allowed()) return;

  if (window.CalorieAppTokenomics) return;
  var config = window.CalorieTokenSiteStyleMenu?.tokenomics;
  if (config?.publicPage !== true) return;
  var wallet = "rEfiRssDCQd466z2bi63vi64u2rYiMrnhL";
  var locale = new URL(window.location.href).searchParams.get("ui_lang") || document.documentElement.lang || "en", view = null;
  var keys = ["statusTitle", "status", "giveaways", "walletTitle", "description", "liquidity", "action", "detailsLabel"];
  var protectedNodes = "form,input,select,textarea,[contenteditable],.xl-card,[data-calorieapp-embed],[data-calorieapp-account]";
  function unique(scope, selector) {
    var nodes = scope.querySelectorAll(selector);
    return nodes.length === 1 ? nodes[0] : null;
  }
  function anchors() {
    var url = new URL(window.location.href);
    if (!["https://calorietoken.net", "https://www.calorietoken.net"].includes(url.origin)
      || !["/index.php/tokenomics-update/", "/tokenomics-update/"].includes(url.pathname)
      || Array.from(url.searchParams.keys()).some(function (key) { return key !== "ui_lang"; })
      || !document.body?.classList.contains("page-id-1209")
      || document.querySelector(".brz-ed,#brz-ed-iframe")) return null;
    var root = unique(document, '[data-brz-custom-id="rmpolgctfmggclsdfezbyrgrptsoksmyibth"]');
    if (!root || root.closest(protectedNodes) || root.querySelector(protectedNodes)) return null;
    var graphic = unique(root, '[data-brz-custom-id="dqvixegjsqsgfpehzvyzdhvvjusglgsaioai"]');
    var row = unique(root, '[data-brz-custom-id="qzyfxcwgwvmqaychwaxfgllbvrxwptqijdnb"]');
    if (!graphic || !row || !unique(graphic, 'img[title="Tokenomics update 2024 10"]')) return null;
    var chart = graphic.parentElement, container = row.parentElement;
    return chart?.parentElement === container && container?.classList.contains("brz-container")
      ? { root: root, chart: chart, row: row, container: container } : null;
  }
  function node(tag, text, attributes) {
    var element = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (key) { element.setAttribute(key, attributes[key]); });
    if (text !== undefined) element.appendChild(document.createTextNode(text));
    return element;
  }
  function discard() {
    if (view) { view.statusPanel.remove(); view.walletPanel.remove(); view = null; }
  }
  function copyFor(tag) {
    var definition = Array.isArray(config.locales) && config.locales.find(function (item) { return item.tag === tag; });
    var copy = definition && config.copy?.[tag];
    if (!copy || !keys.every(function (key) { return typeof copy[key] === "string" && copy[key].trim(); })) return null;
    return { copy: copy, tag: tag, dir: definition.direction === "rtl" ? "rtl" : "ltr" };
  }
  function refresh() {
    var target = anchors(), selected = copyFor(locale) || copyFor("en");
    if (!target || !selected) { discard(); return; }
    if (view && (view.chart !== target.chart || view.row !== target.row
      || view.statusPanel.parentElement !== target.container || view.walletPanel.parentElement !== target.container)) discard();
    target.chart.classList.add('ctstyle-tokenomics-chart');
    target.chart.querySelector('img[title="Tokenomics update 2024 10"]').classList.add('ctstyle-tokenomics-chart-image');
    if (!view) {
      // Only the two owned siblings are added. Existing artwork and wallet links
      // stay intact; nothing is submitted, fetched, stored or signed.
      if (document.getElementById("calorieapp-tokenomics-status") || document.getElementById("calorieapp-consolidation-wallet")) return;
      var status = node("aside", undefined, { id: "calorieapp-tokenomics-status", class: "calorieapp-tokenomics-note", "aria-labelledby": "calorieapp-tokenomics-status-title" });
      var panel = node("section", undefined, { id: "calorieapp-consolidation-wallet", class: "calorieapp-tokenomics-note", "aria-labelledby": "calorieapp-consolidation-wallet-title" });
      var fields = {};
      keys.forEach(function (key) {
        fields[key] = node(key === "action" ? "a" : key === "detailsLabel" ? "summary" : /Title$/.test(key) ? "h2" : "p", "");
      });
      fields.statusTitle.setAttribute("id", "calorieapp-tokenomics-status-title");
      fields.walletTitle.setAttribute("id", "calorieapp-consolidation-wallet-title");
      fields.action.setAttribute("href", "https://xpmarket.com/wallet/" + wallet);
      fields.action.setAttribute("target", "_blank");
      fields.action.setAttribute("rel", "noopener noreferrer");
      fields.action.setAttribute("class", "calorieapp-tokenomics-explorer");
      status.appendChild(fields.statusTitle); status.appendChild(fields.status); status.appendChild(fields.giveaways);
      var details = node("details", undefined, { class: "ctstyle-wallet-details" });
      details.appendChild(fields.detailsLabel); details.appendChild(fields.description);
      details.appendChild(node("code", wallet, { dir: "ltr", class: "calorieapp-tokenomics-address" }));
      details.appendChild(fields.liquidity);
      panel.appendChild(fields.walletTitle); panel.appendChild(fields.action); panel.appendChild(details);
      target.chart.after(status); target.row.after(panel);
      view = { chart: target.chart, row: target.row, statusPanel: status, walletPanel: panel, fields: fields };
    }
    keys.forEach(function (key) { view.fields[key].childNodes[0].data = selected.copy[key]; });
    [view.statusPanel, view.walletPanel].forEach(function (panel) {
      panel.setAttribute("lang", selected.tag); panel.setAttribute("dir", selected.dir);
    });
  }
  window.CalorieAppTokenomics = { refresh: refresh, setLocale: function (tag) { locale = tag; refresh(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
  window.addEventListener("load", refresh, { once: true });
  window.addEventListener("pageshow", refresh);
  window.dispatchEvent(new Event("calorieapp:tokenomics-ready"));
})();
