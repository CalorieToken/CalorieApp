(function () {
  "use strict";

  function start() {
    var card = Array.from(document.querySelectorAll(".brz .xl-card")).find(function (element) {
      return !element.closest("[data-calorieapp-embed]");
    });
    var wrapper = card && card.closest(".brz-wrapper");
    if (!wrapper) return false;

    var columns = Array.from(document.querySelectorAll(".brz .brz-menu-simple"))
      .map(function (menu) { return menu.closest(".brz-columns"); })
      .filter(function (column, index, all) {
        return column && !column.contains(card) && all.indexOf(column) === index;
      });
    var mobile = window.matchMedia("(max-width: 768px)");
    var pending = false;
    card.classList.add("calorieapp-identity-card");
    wrapper.classList.add("calorieapp-identity-wrapper");

    function layout() {
      pending = false;
      // Re-measure the theme's own spacing at every breakpoint. Never add a
      // correction to an earlier correction, including after a restored scroll.
      columns.forEach(function (column) {
        column.classList.remove("calorieapp-brizy-menu-column");
        column.style.removeProperty("--calorieapp-menu-margin");
      });
      if (!mobile.matches) {
        wrapper.style.removeProperty("--calorieapp-identity-center-shift");
        return;
      }

      var viewport = document.documentElement.clientWidth;
      var bounds = card.getBoundingClientRect();
      if (!viewport || !bounds.width || !bounds.height) return;
      var shift = parseFloat(wrapper.style.getPropertyValue("--calorieapp-identity-center-shift")) || 0;
      var correction = viewport / 2 - (bounds.left + bounds.width / 2);
      if (Math.abs(correction) > 0.5) {
        wrapper.style.setProperty("--calorieapp-identity-center-shift", (shift + correction).toFixed(2) + "px");
        bounds = card.getBoundingClientRect();
      }

      // Both the card and the navigation move with the header on mobile. The
      // comparison is scroll-independent and also includes a late logout row.
      var adjustments = columns.map(function (column) {
        var menu = column.getBoundingClientRect();
        var margin = parseFloat(window.getComputedStyle(column).marginTop) || 0;
        var overlapsHorizontally = menu.left < bounds.right && menu.right > bounds.left;
        // Moving an earlier menu can move the following card by the same amount,
        // adding blank space without improving clearance. Only move navigation
        // whose top is at or below the card's top.
        var startsBelowCard = menu.top >= bounds.top;
        var clearance = overlapsHorizontally && startsBelowCard && menu.width && menu.height
          ? Math.max(0, bounds.bottom + 12 - menu.top) : 0;
        return { column: column, margin: margin + clearance, clearance: clearance };
      });
      adjustments.forEach(function (adjustment) {
        if (adjustment.clearance <= 0.5) return;
        adjustment.column.style.setProperty("--calorieapp-menu-margin", adjustment.margin.toFixed(2) + "px");
        adjustment.column.classList.add("calorieapp-brizy-menu-column");
      });
    }

    function schedule() {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(layout);
    }

    layout();
    window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    window.addEventListener("pageshow", schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    if (window.ResizeObserver) {
      var observer = new ResizeObserver(schedule);
      observer.observe(card);
      columns.forEach(function (column) { observer.observe(column); });
    }
    return true;
  }

  function startRichlists() {
    if (window.CalorieAppRichlist || !document.body || !document.body.classList || !document.body.classList.contains("page-id-3243")) return;
    var location = window.location;
    if (!location || ["https://calorietoken.net", "https://www.calorietoken.net"].indexOf(location.origin) < 0
        || location.pathname !== "/index.php/richlist/"
        || /(?:^|[?&])(?:preview|brizy-edit|brizy-edit-iframe)(?:=|&|$)/.test(location.search || "")
        || document.querySelector(".brz-ed,#brz-ed-iframe")) return;
    var views = [], sequence = 0, locale = "en", observer = null;
    var fallback = {
      region: "CalorieToken holders. Scroll sideways to see the complete table.",
      action: "My position", jump: "Go to my Richlist position"
    };
    function copy() {
      var config = window.calorieappDisplayLanguageConfig;
      var definition = config && Array.isArray(config.locales) && config.locales.find(function (item) { return item.tag === locale; });
      var candidate = definition && config.richlist && config.richlist.translations && config.richlist.translations[locale];
      var valid = candidate && Object.keys(fallback).every(function (key) { return typeof candidate[key] === "string" && candidate[key].trim(); });
      return { text: valid ? candidate : fallback, locale: valid ? locale : "en", dir: valid && (locale === "ar" || locale === "ur") ? "rtl" : "ltr" };
    }
    function eligible(node) {
      return node.isConnected && !node.closest("form,[contenteditable],.xl-card,[data-calorieapp-embed],[hidden],[inert],[aria-hidden=\"true\"]");
    }
    function restore(view) {
      if (!view.row) return;
      Object.keys(view.previous).forEach(function (key) {
        if (view.row.getAttribute(key) !== (key === "tabindex" ? "-1" : "true")) return;
        if (view.previous[key] === null) view.row.removeAttribute(key);
        else view.row.setAttribute(key, view.previous[key]);
      });
      view.row = null;
    }
    function makeView(table) {
      var region = table.closest(".calorieapp-richlist-scroll");
      if (!region) {
        region = document.createElement("div");
        region.className = "calorieapp-richlist-scroll";
        region.tabIndex = 0;
        region.setAttribute("role", "region");
        table.parentNode.insertBefore(region, table);
        region.appendChild(table);
      }
      var actions = document.createElement("div");
      actions.className = "calorieapp-richlist-actions";
      var label = document.createElement("span");
      do { sequence += 1; label.id = "calorieapp-richlist-label-" + sequence; }
      while (document.getElementById(label.id));
      label.hidden = true;
      var regionText = document.createTextNode(""); label.appendChild(regionText);
      region.removeAttribute("aria-label");
      region.setAttribute("aria-labelledby", label.id);
      actions.appendChild(label);
      var jump = document.createElement("button");
      jump.type = "button";
      jump.className = "calorieapp-own-rank-jump";
      jump.setAttribute("data-calorieapp-own-rank", "");
      jump.hidden = true;
      var actionText = document.createTextNode(""); jump.appendChild(actionText);
      var rankNode = document.createElement("bdi");
      var rankText = document.createTextNode(""); rankNode.appendChild(rankText); jump.appendChild(rankNode);
      actions.appendChild(jump);
      region.parentNode.insertBefore(actions, region);
      var view = { table: table, region: region, actions: actions, jump: jump, regionText: regionText, actionText: actionText, rankText: rankText, row: null };
      jump.addEventListener("click", function () {
        // Recheck before activation, even before a queued observer delivery.
        refresh();
        if (!view.row || jump.hidden) return;
        view.row.focus({ preventScroll: true });
        view.row.scrollIntoView({
          behavior: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "center", inline: "nearest"
        });
      });
      return view;
    }
    function refresh() {
      var tables = Array.from(document.querySelectorAll("table.xl-richlist")).filter(eligible);
      views = views.filter(function (view) {
        if (tables.indexOf(view.table) >= 0 && view.region.contains(view.table) && view.actions.isConnected) return true;
        restore(view); view.actions.remove(); view.region.removeAttribute("aria-labelledby");
        return false;
      });
      tables.forEach(function (table) {
        if (!views.some(function (view) { return view.table === table; })) views.push(makeView(table));
      });
      var marked = tables.flatMap(function (table) { return Array.from(table.querySelectorAll("tr.xl-is-user")).filter(eligible); });
      var current = marked.length === 1 ? marked[0] : null;
      var translation = copy();
      views.forEach(function (view) {
        var row = current && view.table.contains(current) ? current : null;
        if (view.row !== row) {
          restore(view);
          if (row) {
            view.row = row;
            view.previous = { "aria-current": row.getAttribute("aria-current") };
            row.setAttribute("aria-current", "true");
            if (row.getAttribute("tabindex") === null) {
              view.previous.tabindex = null; row.setAttribute("tabindex", "-1");
            }
          }
        }
        var cell = row && row.querySelector("th,td");
        var rank = cell ? String(cell.textContent || "").trim() : "";
        // Read only a displayed rank, never infer ownership from another field.
        if (!/^#?[0-9][0-9., ]{0,16}$/.test(rank)) rank = "";
        view.actions.lang = translation.locale; view.actions.dir = translation.dir;
        if (view.regionText.data !== translation.text.region) view.regionText.data = translation.text.region;
        var action = translation.text.action + (rank ? " " : "");
        if (view.actionText.data !== action) view.actionText.data = action;
        if (view.rankText.data !== rank) view.rankText.data = rank;
        view.jump.setAttribute("aria-label", translation.text.jump + (rank ? " \u2068" + rank + "\u2069" : ""));
        view.jump.hidden = !row;
      });
    }
    function containsTable(node) {
      return node.nodeType === 1 && (node.matches("table.xl-richlist") || node.querySelector("table.xl-richlist"));
    }
    function relevant(record) {
      var node = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (node && node.closest("table.xl-richlist")) return true;
      if (record.type === "attributes") return node && containsTable(node);
      return Array.from(record.addedNodes || []).concat(Array.from(record.removedNodes || [])).some(containsTable);
    }
    function observe() {
      if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden", "inert", "aria-hidden"] });
    }
    window.CalorieAppRichlist = { setLocale: function (value) { locale = value; refresh(); } };
    refresh();
    if (window.MutationObserver) {
      observer = new MutationObserver(function (records) { if (records.some(relevant)) refresh(); });
      observe();
    }
    window.addEventListener("load", refresh);
    window.addEventListener("pageshow", function () { refresh(); observe(); });
    window.addEventListener("pagehide", function () { if (observer) observer.disconnect(); });
  }

  function boot() {
    startRichlists();
    if (start() || !window.MutationObserver) return;
    // Brizy can insert a shortcode after DOMContentLoaded. Initialize once
    // when the card appears, then stop watching the rest of a long Richlist.
    var waiting = new MutationObserver(function () {
      if (start()) waiting.disconnect();
    });
    waiting.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
