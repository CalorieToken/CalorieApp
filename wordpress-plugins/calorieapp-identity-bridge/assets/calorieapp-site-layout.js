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

  function enhanceRichlists() {
    document.querySelectorAll("table.xl-richlist").forEach(function (table) {
      var region = table.closest(".calorieapp-richlist-scroll");
      if (!region) {
        region = document.createElement("div");
        region.className = "calorieapp-richlist-scroll";
        region.tabIndex = 0;
        region.setAttribute("role", "region");
        region.setAttribute("aria-label", "CalorieToken holders — scroll sideways for the full table");
        table.parentNode.insertBefore(region, table);
        region.appendChild(table);
      }

      if (typeof table.querySelector !== "function") return;
      var ownRow = table.querySelector("tr.xl-is-user");
      if (!ownRow || document.querySelector("[data-calorieapp-own-rank]")) return;
      ownRow.setAttribute("aria-current", "true");
      ownRow.tabIndex = -1;
      var rankCell = ownRow.querySelector("th,td");
      var rank = rankCell ? String(rankCell.textContent || "").trim() : "";
      var jump = document.createElement("button");
      jump.type = "button";
      jump.className = "calorieapp-own-rank-jump";
      jump.setAttribute("data-calorieapp-own-rank", "");
      jump.textContent = rank ? "My position " + rank : "My position";
      jump.setAttribute("aria-label", rank ? "Jump to my Richlist position " + rank : "Jump to my Richlist position");
      jump.addEventListener("click", function () {
        ownRow.scrollIntoView({
          behavior: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "center",
          inline: "nearest"
        });
        window.setTimeout(function () { ownRow.focus({ preventScroll: true }); }, 350);
      });
      document.body.appendChild(jump);
    });
  }

  function boot() {
    enhanceRichlists();
    window.addEventListener("load", enhanceRichlists);
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
