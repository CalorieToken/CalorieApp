(function () {
  "use strict";

  function start() {
    var card = Array.from(document.querySelectorAll(".brz .xl-card")).find(function (element) {
      return !element.closest("[data-calorieapp-embed]");
    });
    var wrapper = card && card.closest(".brz-wrapper");
    if (!wrapper) return;

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
        var clearance = overlapsHorizontally && menu.width && menu.height
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
