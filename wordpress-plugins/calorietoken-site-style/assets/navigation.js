(function () {
  "use strict";


  function allowed() {
    return document.body && document.body.matches('.ctstyle-enabled,.ctstyle-footer-only')
      && !document.body.matches('.page-id-8001,.brz-ed')
      && (!document.body.matches('.home,.page-id-1090') || document.body.classList.contains('ctstyle-footer-only'))
      && !document.querySelector('.brz-ed,#brz-ed-iframe')
      && !/\/wp-admin\//.test(window.location.pathname)
      && !Array.from(new URL(window.location.href).searchParams.keys()).some(function (key) {
        return /^(?:preview|customize_changeset_uuid|brizy-edit|brizy-edit-iframe|brz-edit|brz-edit-iframe)$/.test(key);
      });
  }
  if (!allowed()) return;

  function extendNativeNavigation() {
    if (!allowed() || !window.CalorieAppPageNavigation) return;
    var stacks=document.querySelectorAll('[data-calorieapp-fallback-shortcuts]');
    if (stacks.length!==1 || stacks[0].closest('form,[contenteditable],[data-calorieapp-embed]')) return;
    var stack=stacks[0], slots=Array.from(stack.querySelectorAll('[data-calorieapp-shortcut]'));
    if (slots.length!==4 || new Set(slots.map(function (slot) {return slot.dataset.calorieappShortcut;})).size!==4) return;
    var origin=window.location.origin;
    if (!['https://calorietoken.net','https://www.calorietoken.net'].includes(origin)) return;
    if (!slots.every(function (slot) {
      var role=slot.dataset.calorieappShortcut, a=slot.querySelector('a.calorieapp-page-tool');if (!a) return false;
      var url;try {url=new URL(a.href,window.location.href);}catch (_) {return false;}
      if (role==='home') return url.href===origin+'/';
      if (role==='app') return url.href===origin+'/index.php/calorieapp/';
      return ['top','bottom'].includes(role) && a.getAttribute('href')==='#' && a.dataset.calorieappScroll===role;
    })) return;
    var slot=stack.querySelector('[data-ctstyle-exchange-shortcut]');
    if (!slot) {
      slot=document.createElement('div');slot.className='calorieapp-page-tool-position calorieapp-page-tool-position-exchange';
      // Separate ownership: the installed bridge continues to see its original four slots.
      slot.setAttribute('data-ctstyle-exchange-shortcut','');
      var a=document.createElement('a');a.className='calorieapp-page-tool';a.href=origin+'/index.php/how-to-buy-calorie/';
      a.innerHTML='<svg class="calorieapp-page-tool-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      slot.append(a);stack.append(slot);
    }
    slot.hidden=path(new URL(window.location.href))==='/how-to-buy-calorie';
    var a=slot.querySelector('a'), locale=(window.CalorieTokenDiscoveryUI && window.CalorieTokenDiscoveryUI.getLocale()) || document.documentElement.lang || 'en';
    var copy=window.CalorieTokenSiteStyleMenu?.navigation?.translations?.[locale];
    a.setAttribute('aria-label',copy?.exchange || 'CAL & Crypto');a.title=copy?.exchange || 'CAL & Crypto';
  }
  document.addEventListener('calorietoken:display-language',extendNativeNavigation);
  window.addEventListener('calorieapp:page-tools-ready',extendNativeNavigation);
  window.addEventListener('pageshow',extendNativeNavigation);
  if (window.CalorieAppPageNavigation) {extendNativeNavigation();return;}
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
    if (!allowed()) return;
    if (window.CalorieAppPageNavigation) {extendNativeNavigation();return;}
    var template = document.getElementById('ctstyle-tools-template');
    if (!document.querySelector('[data-calorieapp-fallback-shortcuts]') && template) document.body.appendChild(template.content.cloneNode(true));
    var config = document.querySelector("[data-ctstyle-site-integration]");
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
    var scrollBound = new WeakSet();
    var displayLocale = new URL(window.location.href).searchParams.get("ui_lang") || document.documentElement.lang || "en";
    var exchangePage = new URL('/index.php/how-to-buy-calorie/',origin);
    var fallback = { region: "Page shortcuts", home: "Go to Home", app: "Open CalorieApp", top: "Back to top", bottom: "Go to bottom", exchange: "CAL & Crypto" };
    function bindings() {
      if (document.querySelector("[data-ctstyle-site-integration]") !== config
          || document.querySelector("[data-calorieapp-fallback-shortcuts]") !== shortcuts
          || shortcuts.closest("form,[contenteditable],[data-calorieapp-embed]")) return null;
      var slots = Array.from(shortcuts.querySelectorAll("[data-calorieapp-shortcut]"));
      if (slots.length !== 4 && slots.length !== 5) return null;
      var found = {}, valid = slots.every(function (slot) {
        var role = slot.getAttribute("data-calorieapp-shortcut");
        var link = slot.querySelector("a.calorieapp-page-tool");
        if (["home", "app", "top", "bottom", "exchange"].indexOf(role) < 0 || found[role] || !link) return false;
        var destination;
        try { destination = new URL(link.href, window.location.href); } catch (_error) { return false; }
        var correct = role === "home" ? destination.href === homePage.href
          : role === "app" ? destination.href === appPage.href
          : role === "exchange" ? destination.href === exchangePage.href
          : link.getAttribute("href") === "#" && link.getAttribute("data-calorieapp-scroll") === role;
        if (!correct) return false;
        found[role] = link;
        return true;
      });
      if (!valid || !['home','app','top','bottom'].every(function (role) { return found[role]; })) return null;
      if (!found.exchange) {
        // Upgrade only a complete, validated existing stack; no legacy exchange URL.
        var slot = document.createElement('div'), link = document.createElement('a');
        slot.className = 'calorieapp-page-tool-position calorieapp-page-tool-position-exchange';
        slot.setAttribute('data-calorieapp-shortcut','exchange');
        link.className = 'calorieapp-page-tool'; link.href = exchangePage.href;
        var icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
        icon.setAttribute('viewBox','0 0 24 24'); icon.setAttribute('aria-hidden','true'); icon.setAttribute('focusable','false');
        icon.setAttribute('class','calorieapp-page-tool-icon');
        var drawing = document.createElementNS('http://www.w3.org/2000/svg','path');
        drawing.setAttribute('d','M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4');
        drawing.setAttribute('fill','none'); drawing.setAttribute('stroke','currentColor'); drawing.setAttribute('stroke-width','2'); drawing.setAttribute('stroke-linecap','round'); drawing.setAttribute('stroke-linejoin','round');
        icon.append(drawing); link.append(icon); slot.append(link); shortcuts.append(slot); found.exchange = link;
      }
      return found;
    }
    function renderLanguage(links) {
      var settings = window.CalorieTokenSiteStyleMenu;
      var definition = settings && Array.isArray(settings.locales) && settings.locales.find(function (item) { return item.tag === displayLocale; });
      var candidate = definition && settings.navigation && settings.navigation.translations && settings.navigation.translations[displayLocale];
      var valid = candidate && Object.keys(fallback).every(function (key) { return typeof candidate[key] === "string" && candidate[key].trim(); });
      var copy = valid ? candidate : fallback;
      shortcuts.lang = valid ? displayLocale : "en";
      shortcuts.dir = valid && (displayLocale === "ar" || displayLocale === "ur") ? "rtl" : "ltr";
      shortcuts.setAttribute("aria-label", copy.region);
      Object.keys(links).forEach(function (role) {
        links[role].setAttribute("aria-label", copy[role]);
        links[role].setAttribute("title", copy[role]);
      });
    }
    function observe() {
      if (observer) observer.observe(document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "href", "data-calorieapp-scroll", "data-calorieapp-shortcut"]
      });
    }
    function bindScroll(links) {
      ["top", "bottom"].forEach(function (role) {
        var button = links[role];
        if (scrollBound.has(button)) return;
        scrollBound.add(button);
        button.addEventListener("click", function (event) {
          var current = bindings();
          if (!current || current[role] !== button) return;
          event.preventDefault();
          window.scrollTo({
            top: role === "bottom" ? pageHeight() : 0,
            behavior: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
          });
        });
      });
    }
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
      var replacement = document.querySelector("[data-calorieapp-fallback-shortcuts]");
      if (replacement) shortcuts = replacement;
      // A removed, incomplete or edited replacement cannot suppress the native
      // controls. Keep watching so a restored owned stack can become ready.
      var links = bindings();
      if (!links) { observe(); return; }
      var currentPage = new URL(window.location.href);
      var onHome = config.dataset.isHome === "1" || path(currentPage) === path(homePage);
      var onApp = !!document.querySelector("[data-calorieapp-embed]") || path(currentPage) === path(appPage);
      var longPage = pageHeight() > Math.max(window.innerHeight, 1) * 2;
      var replaced = new Set();
      var roots = new Set();
      document.querySelectorAll(".brz-icon__container a[href]").forEach(function (link) {
        if (link.closest('form,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],.cmplz-cookiebanner,.cmplz-blocked-content-container')) return;
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
        if (controls.length && controls.every(function (control) { return replaced.has(control); })) {
          var remaining = root.cloneNode(true);
          remaining.querySelectorAll('.brz-icon__container,script,style').forEach(function (node) {node.remove();});
          if (!remaining.textContent.trim() && !remaining.querySelector('img,svg,video,audio,canvas,[contenteditable]')) hide(root);
        }
      });
      shortcuts.querySelectorAll("[data-calorieapp-shortcut]").forEach(function (slot) {
        var role = slot.getAttribute("data-calorieapp-shortcut");
        slot.hidden = (role === "home" && onHome) || (role === "app" && onApp) || (role === "exchange" && path(currentPage) === path(exchangePage)) || (role === "bottom" && !longPage);
      });
      shortcuts.hidden = false;
      bindScroll(links);
      renderLanguage(links);
      observe();
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(reconcile);
    }
    if (window.MutationObserver) observer = new window.MutationObserver(schedule);
    window.CalorieAppPageNavigation = { setLocale: function (locale) {
      displayLocale = locale;
      var links = bindings();
      if (links) renderLanguage(links);
    } };
    reconcile();
    // Carries no state or identity data; the existing display controller reads
    // its own store if this component was initialized after its load callback.
    if (typeof window.dispatchEvent === "function" && typeof window.Event === "function") window.dispatchEvent(new window.Event("calorieapp:page-tools-ready"));
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
  window.addEventListener("load", init, { once: true });
})();
