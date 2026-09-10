/* CalorieToken Site Style — GPL-2.0-or-later.
 * Selected presentation work from the saved Step 3 candidate. */
(function () {
  'use strict';

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

  var config = window.CalorieTokenSiteStyleMenu;
  if (!config || window.CalorieTokenMenuPages) return;
  var home = window.location.origin;
  var protectedSelector = 'form,input,button,select,textarea,iframe,video,audio,canvas,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],.cmplz-cookiebanner,.cmplz-blocked-content-container,[hidden],[inert],[aria-hidden="true"]';
  var contentUpdates = config.contentUpdates, usecases = config.usecases, articleNotes = config.articleNotes;
  var blogView = null, blogLocale = null;
  var blogFallback = config.blog.copy.en;
  function selectedLocale() {
    var requested = new URL(window.location.href).searchParams.get('ui_lang') || document.documentElement.lang || 'en';
    var exact = config.locales.find(function (item) { return item.tag.toLowerCase() === requested.toLowerCase(); });
    var base = config.locales.find(function (item) { return item.tag === requested.split('-')[0]; });
    return (exact || base || {tag:'en'}).tag;
  }
  function unique(selector) { var matches = document.querySelectorAll(selector); return matches.length === 1 ? matches[0] : null; }

  function pageId() {
    var match = document.body.className.match(/(?:^|\s)(?:page-id-|postid-)(\d+)(?:\s|$)/);
    return match ? Number(match[1]) : 0;
  }
  function plain(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
  function localRoute(slug) { return home + "/index.php/" + slug + "/"; }
  function replaceMatchingText(element, before, after) {
    if (!element || element.closest(protectedSelector) || plain(element.textContent) !== plain(before)) return false;
    // Retain the existing link, emphasis and typography when a leaf contains
    // the complete text. Never replace a container with a form or image.
    if (element.querySelector("img,svg,iframe,form,input,button,select,textarea,[contenteditable],a")) return false;
    var leaves = Array.from(element.querySelectorAll("a,u,strong,span"));
    var target = leaves.reverse().find(function (leaf) { return plain(leaf.textContent) === plain(before); }) || element;
    target.textContent = after;
    return true;
  }
  function applyCopy(id) {
    contentUpdates.filter(function (item) { return item.page === id; }).forEach(function (item) {
      var root = unique('[data-brz-custom-id="' + item.element + '"]');
      var paragraph = root && root.querySelector('[data-uniq-id="' + item.paragraph + '"]');
      replaceMatchingText(paragraph, item.before, item.after);
    });
  }
  function contextNote(key, title, text, linkText, href) {
    var aside = document.createElement("aside");
    aside.className = "calorieapp-context-note";
    aside.id = key;
    var heading = document.createElement("strong");
    heading.textContent = title;
    var paragraph = document.createElement("p");
    paragraph.textContent = text;
    var link = document.createElement("a");
    link.href = href;
    link.textContent = linkText;
    aside.append(heading, paragraph, link);
    return aside;
  }
  var legacyBuyGuideMarkup = [
    "<h2>Before you start</h2><p>Calorie (CAL) is a token on the XRP Ledger. Use a supported wallet and check the token’s issuer, not just its name or logo.</p><p><strong>Currency:</strong> Calorie (CAL)<br><strong>Issuer:</strong> <span style=\"overflow-wrap:anywhere\">rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY</span><br><strong>Currency code:</strong> <span style=\"overflow-wrap:anywhere\">43616C6F72696500000000000000000000000000</span></p>",
    "<h2>Choose a trading interface</h2><p><strong><a href=\"https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY\" target=\"_blank\" rel=\"noopener noreferrer\">XPMarket</a></strong><br>Open the CAL token page, then choose an available trade or swap.</p><p><strong><a href=\"https://sologenic.org/\" target=\"_blank\" rel=\"noopener noreferrer\">Sologenic</a></strong><br>Open the DEX and select Calorie/XRP. Verify the issuer above.</p><p><strong><a href=\"https://xumm.app/detect/xapp:xumm.dex?base=43616C6F72696500000000000000000000000000+rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY&amp;quote=xrp\" target=\"_blank\" rel=\"noopener noreferrer\">Xaman DEX</a></strong><br>Open the DEX xApp in Xaman and verify the selected Calorie/XRP pair.</p><p><strong><a href=\"https://www.xrptoolkit.com/\" target=\"_blank\" rel=\"noopener noreferrer\">XRP Toolkit</a></strong><br>Connect a supported wallet and open Trade. Select Calorie by its issuer.</p><p>These are external services. Available pairs, liquidity, fees and regional access may change. No centralized exchange listing is confirmed on this page.</p>",
    "<h2>How to buy CAL on the XRP Ledger</h2><ol><li>Set up a supported XRPL wallet using its official website or app. Keep your recovery phrase private.</li><li>Add enough XRP for the intended trade and the wallet’s displayed reserve and network fees.</li><li>Open one of the interfaces above. Select Calorie/CAL and verify the complete issuer address shown here.</li><li>If your wallet requests a CAL trust line, review it before approving. Then enter the amount and inspect the quoted price, liquidity, fees and slippage.</li><li>Approve only the transaction you intend in your wallet. Wait for the ledger result and check your resulting balance.</li></ol><p>Reserve requirements can change; follow your wallet’s current values and the <a href=\"https://xrpl.org/docs/tutorials/best-practices/account-management/calculate-reserves\" target=\"_blank\" rel=\"noopener noreferrer\">official XRPL reserve documentation</a>. Never enter a recovery phrase on a trading website.</p>",
    "<p>Trading can result in loss. This page provides practical links and instructions, not an investment recommendation. CAL trading is separate from CalorieApp’s food search and personal food log.</p>",
  ].join("");
  function normalizedMarkup(markup) {
    var template = document.createElement("template");
    template.innerHTML = String(markup || "");
    return template.innerHTML.replace(/>\s+</g, "><").trim();
  }

  function blogPanel() {
    if (window.CalorieTokenSiteStyleMenu?.blog?.publicPage !== true
      || pageId() !== 1207 || window.location.pathname !== "/index.php/blog/"
      || ["https://calorietoken.net", "https://www.calorietoken.net"].indexOf(home) === -1
      || document.querySelector(".brz-ed,#brz-ed-iframe")
      || /(?:^|[?&])(?:preview|brizy-edit|brizy-edit-iframe)(?:=|&|$)/.test(window.location.search || "")) return null;
    var matches = document.querySelectorAll('[data-brz-custom-id="amfuxnhsfmkknesyuldlbdorcvqsardaetus"]');
    var panel = matches.length === 1 ? matches[0] : null;
    var protectedControls = "form,input,select,textarea,[contenteditable],.xl-card,[data-calorieapp-embed],[data-calorieapp-account]";
    if (panel && !Array.from(panel.querySelectorAll(".twitter-timeline")).every(function (node) {
      if (node.tagName !== "A") return true;
      try {
        var url = new URL(node.getAttribute("href"));
        return url.protocol === "https:" && !url.username && !url.password
          && /^(?:www\.)?(?:twitter\.com|x\.com)$/.test(url.hostname)
          && /^\/CalorieToken\/?$/i.test(url.pathname);
      } catch (_) { return false; }
    })) return null;
    return panel && panel.classList.contains("brz-wp-shortcode")
      && !panel.closest("form,[contenteditable],.xl-card,[data-calorieapp-embed],[data-calorieapp-account],.cmplz-blocked-content-container")
      && !panel.querySelector(protectedControls) ? panel : null;
  }
  function renderBlogHelp(locale) {
    var panel = blogPanel();
    if (!blogView || panel !== blogView.panel || blogView.help.parentElement !== panel
      || !Object.keys(blogFallback).every(function (key) { return blogView[key].parentElement === blogView.help; })
      || blogView.action.getAttribute("href") !== "https://x.com/CalorieToken") return;
    var config = window.CalorieTokenSiteStyleMenu && window.CalorieTokenSiteStyleMenu.blog;
    var definition = config && Array.isArray(config.locales)
      && config.locales.find(function (item) { return item.tag === locale; });
    var copy = definition && config.copy && config.copy[locale];
    if (!copy || !Object.keys(blogFallback).every(function (key) {
      return typeof copy[key] === "string" && copy[key].trim();
    })) { copy = blogFallback; locale = "en"; }
    // These three text nodes belong to the helper, outside the CMP/X subtree.
    Object.keys(blogFallback).forEach(function (key) {
      var node = blogView[key];
      if (node.childNodes.length === 1 && node.childNodes[0].nodeType === 3) node.childNodes[0].data = copy[key];
    });
    blogView.help.setAttribute("lang", locale);
    blogView.help.setAttribute("dir", ["ar", "ur"].indexOf(locale) !== -1 ? "rtl" : "ltr");
    // Complianz's delegated native button opens settings. We do not grant or
    // revoke consent or reload the page. A separate Blog module initializes the widget only with service consent.
    var ready = panel.classList.contains('ctstyle-x-ready');
    blogView.description.hidden = ready;
    blogView.settings.hidden = ready || typeof window.cmplz_has_service_consent !== "function"
      || !document.querySelector("#cmplz-cookiebanner-container .cmplz-cookiebanner");
  }
  function refineBlogHelp() {
    var panel = blogPanel();
    if (!panel) return;
    if (!blogView || blogView.panel !== panel || !blogView.help.isConnected) {
      if (panel.querySelector(".calorieapp-x-help")) return;
      var previous = panel.querySelectorAll(".calorieapp-x-fallback");
      if (previous.length > 1) return;
      var link = previous[0];
      if (link && (link.parentElement !== panel || link.tagName !== "A"
        || link.getAttribute("href") !== "https://x.com/CalorieToken"
        || link.childNodes.length !== 1 || link.childNodes[0].nodeType !== 3
        || link.childNodes[0].data !== "View CalorieToken on X")) return;
      function label(tag, className, text) {
        var node = document.createElement(tag);
        node.setAttribute("class", className);
        node.appendChild(document.createTextNode(text));
        return node;
      }
      var help = document.createElement("aside"); help.setAttribute("class", "calorieapp-x-help");
      var description = label("p", "calorieapp-x-description", blogFallback.description);
      link = link || label("a", "calorieapp-x-fallback", blogFallback.action);
      link.setAttribute("href", "https://x.com/CalorieToken");
      link.setAttribute("rel", "noopener noreferrer");
      var settings = label("button", "calorieapp-x-settings cmplz-manage-consent", blogFallback.settings);
      settings.setAttribute("type", "button"); settings.hidden = true;
      help.appendChild(description); help.appendChild(link); help.appendChild(settings);
      panel.appendChild(help); panel.classList.add("calorieapp-social-panel");
      blogView = { panel: panel, help: help, description: description, action: link, settings: settings };
    }
    var config = window.CalorieTokenSiteStyleMenu && window.CalorieTokenSiteStyleMenu.blog;
    renderBlogHelp(blogLocale || (config && config.initialLocale) || "en");
  }
  function refineHowToBuy(id) {
    if (id !== 4205 || window.CalorieTokenSiteStyleMenu?.buyGuide?.publicPage !== true) return;
    var url = new URL(window.location.href);
    if (!["https://calorietoken.net", "https://www.calorietoken.net"].includes(url.origin)
      || !["/index.php/how-to-buy-calorie/", "/how-to-buy-calorie/"].includes(url.pathname)
      || Array.from(url.searchParams.keys()).some(function (key) { return key !== "ui_lang"; })) return;
    var guides = document.querySelectorAll(".cal-buy-guide");
    var guide = guides.length === 1 ? guides[0] : null;
    if (!guide || guide.dataset.calorieappBuyGuide === "1"
      || guide.closest(protectedSelector)) return;
    if (normalizedMarkup(guide.innerHTML) !== normalizedMarkup(legacyBuyGuideMarkup)) return;
    guide.dataset.calorieappBuyGuide = "1";
    guide.innerHTML = [
      "<header class=\"cal-buy-hero\"><p class=\"cal-buy-eyebrow\" data-cal-buy-copy=\"eyebrow\">XRPL buying and selling guide</p><h2 data-cal-buy-copy=\"title\">Buy or sell CAL in four clear steps</h2><p data-cal-buy-copy=\"intro\">CAL trades on the XRP Ledger DEX. Verify the complete issuer and currency code, not just the name or logo.</p><dl class=\"cal-buy-identity\"><div><dt data-cal-buy-copy=\"assetLabel\">Asset</dt><dd><code dir=\"ltr\">Calorie (CAL)</code></dd></div><div><dt data-cal-buy-copy=\"issuerLabel\">Issuer</dt><dd><code dir=\"ltr\">rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY</code></dd></div><div><dt data-cal-buy-copy=\"currencyLabel\">Currency code</dt><dd><code dir=\"ltr\">43616C6F72696500000000000000000000000000</code></dd></div></dl></header>",
      "<ol class=\"cal-buy-steps\"><li><span aria-hidden=\"true\">1</span><div><h3 data-cal-buy-copy=\"walletTitle\">Set up an XRPL wallet</h3><p data-cal-buy-copy=\"walletText\">Install Xaman from its official source. Keep recovery information offline; never enter it on this website or a trading page.</p><a data-cal-buy-copy=\"walletAction\" href=\"https://xaman.app/\" rel=\"noopener noreferrer\">Visit Xaman</a></div></li>",
      "<li><span aria-hidden=\"true\">2</span><div><h3 data-cal-buy-copy=\"fundTitle\">Fund your wallet with XRP</h3><p data-cal-buy-copy=\"fundText\">Xaman lists independent providers by country and currency. Check eligibility, identity checks, rates and fees; availability varies by region. Already hold BTC, ETH or another supported coin? AllChainBridge / SWFT is another possible route to XRP across networks. See section 3 below. Select the source coin and network, choose XRP on XRP Ledger as the destination, and check the available wallets, route, fees and any destination tag with SWFT. CAL is temporarily unavailable there.</p><a data-cal-buy-copy=\"fundAction\" href=\"https://xumm.app/detect/xapp:xumm.buysellxrp\" rel=\"noopener noreferrer\">Find options in Xaman</a><p data-cal-buy-copy=\"reserveText\">Keep enough XRP for the reserve and network fees shown by your wallet. Reserve requirements can change.</p><a data-cal-buy-copy=\"reserveAction\" href=\"https://xrpl.org/docs/concepts/accounts/reserves\" rel=\"noopener noreferrer\">XRPL reserve information</a></div></li>",
      "<li><span aria-hidden=\"true\">3</span><div><h3 data-cal-buy-copy=\"trustTitle\">Add the exact CAL trustline</h3><p data-cal-buy-copy=\"trustText\">To receive CAL, review its issuer and currency code before approving the trustline in Xaman.</p><a data-cal-buy-copy=\"trustAction\" href=\"__TRUSTLINE__\" rel=\"noopener noreferrer\">Open CAL trustline guide</a></div></li>",
      "<li><span aria-hidden=\"true\">4</span><div><h3 data-cal-buy-copy=\"tradeTitle\">Choose buy or sell</h3><p data-cal-buy-copy=\"tradeText\">On XPMarket, check what you pay and receive, the issuers, route, fees, liquidity and price impact. Review the final request in your wallet.</p><a data-cal-buy-copy=\"tradeAction\" href=\"https://xpmarket.com/dex/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP\" rel=\"noopener noreferrer\">Open CAL on XPMarket</a><p data-cal-buy-copy=\"sellText\">To sell, select CAL as the asset you pay and check the asset you receive. A received token may need its own trustline. Converting proceeds to money in a bank account is a separate provider service.</p></div></li>",
      "</ol><section class=\"cal-buy-own-dex\"><h3 data-cal-buy-copy=\"alternativesTitle\">Other trading interfaces</h3><p data-cal-buy-copy=\"alternativesText\">Use the interface you already know and verify the same issuer and currency code.</p><p><a data-cal-buy-copy=\"dexAlternative\" href=\"https://xpmarket.com/dex/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP\" rel=\"noopener noreferrer\">Open CAL/XRP order book</a> \u00b7 <a data-cal-buy-copy=\"swapAlternative\" href=\"https://xpmarket.com/swap/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP/market\" rel=\"noopener noreferrer\">Swap CAL/XRP</a></p></section>",
      "<aside class=\"cal-buy-own-dex\"><h3 data-cal-buy-copy=\"moduleTitle\">Trading through external services</h3><p data-cal-buy-copy=\"moduleText\">This website provides guidance and external links. Trading takes place with the selected external service and your wallet.</p></aside>",
      "<aside class=\"cal-buy-risk\"><strong data-cal-buy-copy=\"riskTitle\">Before you trade</strong><p data-cal-buy-copy=\"riskText\">Trading can cause loss. Project-related wallets may provide liquidity and have a financial interest. Quotes, liquidity and execution are not guaranteed. This guide is not investment advice.</p><p data-cal-buy-copy=\"appText\">CalorieApp food search and food logging do not require buying CAL.</p></aside>"
    ].join("").replace("__TRUSTLINE__", localRoute("trustline"));
    guide.setAttribute("aria-label", "Buy or sell CAL in four clear steps");
    guide.setAttribute("lang", "en");
    guide.setAttribute("dir", "ltr");
  }
  function refineTrustline(id) {
    if (id !== 1205) return;
    if (window.CalorieAppTrustline) { if (typeof window.CalorieAppTrustline.refresh === "function") window.CalorieAppTrustline.refresh(); return; }
    var selector = '[data-brz-custom-id="nrsbytvlhdquaddotxqmaeiihmzfbcufpmhr"]';
    var protectedSelector = 'form,input,textarea,select,[contenteditable],.xl-card,[data-calorieapp-embed],[hidden],[inert],[aria-hidden="true"]';
    var values = [
      ["rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY", "Issuer"],
      ["43616C6F72696500000000000000000000000000", "Currency"]
    ];
    var english = {
      copyIssuer: "Copy issuer", copyCurrency: "Copy currency code",
      copiedIssuer: "Copied issuer.", copiedCurrency: "Copied currency code.",
      manualIssuer: "Select the issuer above to copy it.", manualCurrency: "Select the currency code above to copy it.",
      signAction: "Set CAL trustline in Xaman",
      signLabel: "Create a CAL trustline request and review it in Xaman",
      before: "Before you continue",
      context: "A CAL trustline belongs to your XRPL wallet. Check the issuer and currency code in the request before signing. Food search and nutrition information in CalorieApp do not require a CAL trustline.",
      toolkit: "Open XRP Toolkit"
    };
    var view = null, locale = selectedLocale(), observer = null, watching = true;
    function publicPage() {
      if (![true,'1'].includes(window.CalorieTokenSiteStyleMenu?.trustlinePage) || pageId() !== 1205
          || document.querySelector(".brz-ed")) return false;
      try {
        var url = new URL(window.location.href);
        return ["https://calorietoken.net", "https://www.calorietoken.net"].includes(url.origin)
          && !url.username && !url.password
          && ["/index.php/trustline/", "/trustline/"].includes(url.pathname)
          && Array.from(url.searchParams.keys()).every(function (key) { return key === "ui_lang"; });
      } catch (_) { return false; }
    }
    function source() {
      if (!publicPage()) return null;
      var roots = document.querySelectorAll(selector);
      if (roots.length !== 1) return null;
      var root = roots[0];
      if (!root.isConnected || root.closest(protectedSelector)
          || root.querySelector('form,input,textarea,select,[contenteditable]')) return null;
      var paragraphs = values.map(function (item) {
        var matches = Array.from(root.querySelectorAll("p")).filter(function (p) { return plain(p.textContent) === item[0]; });
        return matches.length === 1 && !matches[0].closest(protectedSelector) ? matches[0] : null;
      });
      return paragraphs.every(Boolean) ? { root: root, paragraphs: paragraphs } : null;
    }
    function current(candidate) {
      var live = source();
      return candidate === view && live && live.root === candidate.root
        && candidate.rows.every(function (row, index) {
          return live.paragraphs[index] === row.paragraph
            && row.group.parentElement === row.paragraph.parentElement;
        }) && candidate.note.parentElement === candidate.root;
    }
    function copyForLocale() {
      var config = window.CalorieTokenSiteStyleMenu;
      var definition = Array.isArray(config?.locales)
        ? config.locales.find(function (item) { return item && item.tag === locale; }) : null;
      var copy = definition && config.trustline?.translations?.[locale];
      if (!copy || !Object.keys(english).every(function (key) { return typeof copy[key] === "string" && copy[key].trim(); })) {
        return { tag: "en", direction: "ltr", copy: english };
      }
      return { tag: definition.tag, direction: definition.direction === "rtl" ? "rtl" : "ltr", copy: copy };
    }
    function text(node, value) { if (node.textContent !== value) node.textContent = value; }
    function localize(node, selected) { node.lang = selected.tag; node.dir = selected.direction; }
    function render() {
      if (!view) return;
      var selected = copyForLocale(), copy = selected.copy;
      view.rows.forEach(function (row) {
        localize(row.group, selected);
        text(row.button, copy["copy" + row.kind]);
        text(row.status, row.feedback ? copy[row.feedback + row.kind] : "");
      });
      localize(view.note, selected);
      text(view.note.querySelector("strong"), copy.before);
      text(view.note.querySelector("p"), copy.context);
      text(view.note.querySelector("a"), copy.toolkit);
      if (view.link) {
        localize(view.link, selected);
        text(view.link, copy.signAction);
        view.link.setAttribute("aria-label", copy.signLabel);
      }
    }
    function cleanup() {
      if (!view) return;
      view.rows.forEach(function (row) {
        row.group.remove();
        if (row.addedClass) row.paragraph.classList.remove("calorieapp-copy-value");
      });
      view.note.remove();
      if (view.link) view.link.remove();
      if (view.addedClass) view.root.classList.remove("calorieapp-trustline-details");
      view = null;
    }
    function build(live) {
      var candidate = { root: live.root, rows: [], link: null,
        addedClass: !live.root.classList.contains("calorieapp-trustline-details") };
      live.root.classList.add("calorieapp-trustline-details");
      live.paragraphs.forEach(function (paragraph, index) {
        var group = document.createElement("div");
        group.className = "calorieapp-copy-controls";
        group.setAttribute("data-calorieapp-trustline-ui", "");
        var button = document.createElement("button"), status = document.createElement("span");
        button.className = "calorieapp-copy-button";
        button.type = "button";
        status.id = "calorieapp-copy-status-" + values[index][1].toLowerCase();
        status.className = "calorieapp-copy-status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-atomic", "true");
        button.setAttribute("aria-describedby", status.id);
        group.appendChild(button); group.appendChild(status); paragraph.after(group);
        var row = { paragraph: paragraph, group: group, button: button, status: status,
          kind: values[index][1], feedback: "", busy: false,
          addedClass: !paragraph.classList.contains("calorieapp-copy-value") };
        paragraph.classList.add("calorieapp-copy-value");
        candidate.rows.push(row);
        button.addEventListener("click", function () {
          if (!current(candidate)) { refresh(); return; }
          if (row.busy) return;
          row.feedback = ""; row.busy = true; button.disabled = true;
          button.setAttribute("aria-busy", "true"); render();
          function finish(feedback) {
            if (!current(candidate)) { refresh(); return; }
            row.busy = false; button.disabled = false; button.removeAttribute("aria-busy");
            row.feedback = feedback; render();
          }
          try {
            if (typeof navigator.clipboard?.writeText !== "function") { finish("manual"); return; }
            Promise.resolve(navigator.clipboard.writeText(values[index][0])).then(
              function () { finish("copied"); }, function () { finish("manual"); }
            );
          } catch (_) { finish("manual"); }
        });
      });
      candidate.note = contextNote("calorieapp-trustline-context", english.before, english.context, english.toolkit, "https://www.xrptoolkit.com/");
      candidate.note.setAttribute("data-calorieapp-trustline-ui", "");
      live.root.appendChild(candidate.note);
      view = candidate;
    }
    function refresh() {
      if (observer) observer.disconnect();
      var live = source();
      if (view && !current(view)) cleanup();
      if (!view && live) build(live);
      if (view) {
        render();
      }
      if (observer && watching) observer.observe(document.body, { subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ["class", "data-brz-custom-id", "contenteditable", "hidden", "inert", "aria-hidden"] });
    }
    if (!publicPage()) return;
    window.CalorieAppTrustline = { refresh: refresh, setLocale: function (value) { locale = value; refresh(); } };
    if (typeof MutationObserver === "function") observer = new MutationObserver(function (records) {
      if (records.some(function (record) {
        var target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target?.closest("[data-calorieapp-trustline-ui]")) return false;
        if (target?.closest(selector) || (view && target && (view.root.contains(target)
            || record.type === "attributes" && target.contains(view.root)))) return true;
        return Array.from(record.addedNodes || []).concat(Array.from(record.removedNodes || [])).some(function (node) {
          return node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector));
        });
      })) refresh();
    });
    window.addEventListener("pagehide", function () { watching = false; if (observer) observer.disconnect(); });
    window.addEventListener("pageshow", function () { watching = true; refresh(); });
    refresh();
    window.dispatchEvent(new Event("calorieapp:trustline-ready"));
  }
  function startRichlists() {
    if (window.CalorieAppRichlist || !document.body || !document.body.classList || !document.body.classList.contains("page-id-3243")) return;
    var location = window.location;
    if (!location || ["https://calorietoken.net", "https://www.calorietoken.net"].indexOf(location.origin) < 0
        || !["/index.php/richlist/", "/richlist/"].includes(location.pathname)
        || /(?:^|[?&])(?:preview|brizy-edit|brizy-edit-iframe)(?:=|&|$)/.test(location.search || "")
        || document.querySelector(".brz-ed,#brz-ed-iframe")) return;
    var views = [], sequence = 0, locale = selectedLocale(), observer = null;
    var fallback = {
      region: "CalorieToken holders. Scroll sideways to see the complete table.",
      action: "My position", jump: "Go to my Richlist position"
    };
    function copy() {
      var config = window.CalorieTokenSiteStyleMenu;
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

  function refineDonations(id) {
    var steps = [
      [6897, "Donation", "donate"],
      [6914, "Amount", "product/donation"],
      [6926, "Cart", "cart"],
      [6937, "Checkout", "checkout"]
    ];
    var index = steps.findIndex(function (step) { return step[0] === id; });
    if (index === -1) return;
    document.body.classList.add('ctstyle-donation-page');
    if (document.getElementById("calorieapp-donation-steps")) return;
    var content = document.querySelector(".brz-woo-add-to-cart,.woocommerce-cart-form,form.checkout");
    if (!content && id === 6897) content = unique('[data-brz-custom-id="vrhwjlwmuyzhctxiwehppdchpfudmyfvenev"]');
    if (!content || content.closest('[contenteditable],.xl-card,[data-calorieapp-embed],[hidden],[inert]')) return;
    var nav = document.createElement("nav");
    nav.id = "calorieapp-donation-steps";
    nav.className = "calorieapp-donation-steps";
    nav.setAttribute("data-ctstyle-donation-steps", "");
    nav.setAttribute("aria-label", "Donation steps");
    var list = document.createElement("ol");
    steps.forEach(function (step, n) {
      var li = document.createElement("li");
      // Future steps are text: no shortcut can skip entering/reviewing amount.
      var label = document.createElement(n < index ? "a" : "span");
      label.setAttribute("data-ctstyle-donation-step", String(n));
      label.textContent = (n + 1) + ". " + step[1];
      if (n < index) label.href = localRoute(step[2]);
      if (n === index) label.setAttribute("aria-current", "step");
      li.appendChild(label);
      list.appendChild(li);
    });
    nav.appendChild(list);
    var anchor = content.closest(".brz-wrapper") || content;
    if (anchor.closest("form")) anchor = anchor.closest("form");
    anchor.parentNode.insertBefore(nav, anchor);
  }

  function replaceParagraph(before, after) {
    var matches = Array.from(document.querySelectorAll('.brz-rich-text p')).filter(function (p) {
      return !p.closest(protectedSelector) && plain(p.textContent) === plain(before);
    });
    if (matches.length === 1 && replaceMatchingText(matches[0], before, after)) matches[0].lang = 'en';
  }
  function refineFaqAndMerch(id) {
    if (id === 6855) config.faqUpdates.forEach(function (item) {replaceParagraph(item.before, item.after);});
    if (id === 7224) config.merchUpdates.forEach(function (item) {replaceParagraph(item.before, item.after);});
  }
  function refineWhitepaper(id) {
    if (id !== 1202) return;
    var old = home + '/wp-content/uploads/2026/02/CalorieToken-Whitepaper-V3.1.docx.pdf';
    var current = 'https://github.com/CalorieToken/Publications/blob/main/whitepaper/CalorieToken-Whitepaper.pdf';
    document.querySelectorAll('.brz-image a[href],.brz-rich-text a[href]').forEach(function (link) {
      if (link.closest(protectedSelector) || link.getAttribute('href') !== old) return;
      var raw = link.getAttribute('data-href'), metadata;
      if (raw) {
        try {metadata=JSON.parse(decodeURIComponent(raw));} catch (_) {return;}
        if (metadata.type !== 'external' || metadata.external !== old) return;
      }
      if (metadata) {metadata.external=current;link.setAttribute('data-href',encodeURIComponent(JSON.stringify(metadata)));}
      link.setAttribute('href',current);
      link.setAttribute('aria-label','Read CalorieToken Whitepaper v4.1');
      if (link.getAttribute('target') === '_blank') link.setAttribute('rel',plain((link.getAttribute('rel') || '')+' noopener noreferrer'));
    });
  }
  function refineRoadmap(id) {
    if (id !== 5580) return;
    var oldPath='/wp-content/uploads/2023/03/Roadmap-Calorie-Token-23-24.docx.pdf';
    var current='https://github.com/CalorieToken/Publications/blob/main/roadmap/README.md';
    document.querySelectorAll('.brz-image a[href]').forEach(function (link) {
      if (link.closest(protectedSelector)) return;
      var old=link.getAttribute('href'), parsed;
      try {parsed=new URL(old,home);} catch (_) {return;}
      if (!['https://calorietoken.net','https://www.calorietoken.net'].includes(parsed.origin)
        || parsed.pathname!==oldPath || parsed.search || parsed.hash) return;
      var raw=link.getAttribute('data-href'), metadata;
      if (raw) {
        try {metadata=JSON.parse(decodeURIComponent(raw));} catch (_) {return;}
        if (metadata.type!=='external' || metadata.external!==old) return;
      }
      if (metadata) {metadata.external=current;link.setAttribute('data-href',encodeURIComponent(JSON.stringify(metadata)));}
      link.setAttribute('href',current);link.setAttribute('aria-label','Read the detailed roadmap on GitHub');
    });
    // Keep the historical reading copy explicitly attached to its existing caption.
    document.querySelectorAll('.brz-rich-text p').forEach(function (paragraph) {
      if (paragraph.closest(protectedSelector) || paragraph.querySelector('a,button,input,iframe,img')) return;
      var label='Historical roadmap 2023–2024 (PDF)';
      function wrap(node) {
        Array.from(node.childNodes).forEach(function (child) {
          if (child.nodeType===3 && child.data.includes(label)) {
            var index=child.data.indexOf(label), link=document.createElement('a');
            link.href=home+oldPath;link.textContent=label;
            child.before(document.createTextNode(child.data.slice(0,index)),link,document.createTextNode(child.data.slice(index+label.length)));child.remove();
          } else if (child.nodeType===1 && !child.matches('script,style,a')) wrap(child);
        });
      }
      if (plain(paragraph.textContent).startsWith(label)) wrap(paragraph);
    });
    var excluded='form,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],.cmplz-cookiebanner';
    document.querySelectorAll('.cmplz-blocked-content-notice').forEach(function (notice) {
      if (notice.closest(excluded)) return;
      var buttons=notice.querySelectorAll('[data-service="youtube"][data-category="marketing"]');
      if (buttons.length!==1 || !buttons[0].matches('button,a')) return;
      var button=buttons[0];notice.classList.add('ctstyle-youtube-notice');
      function updateText(node) {
        Array.from(node.childNodes).forEach(function (child) {
          if (child.nodeType===3 && /^Click I agree to enable Youtube\.?$/i.test(plain(child.data).replace(/['’‘"]/g,''))) {
            child.data='Roadmap video · YouTube';
          } else if (child.nodeType===1 && child!==button && !child.matches('script,style,input,iframe')) updateText(child);
        });
      }
      updateText(notice);
      if (button.childNodes.length===1 && button.firstChild.nodeType===3 && /^(I agree|Load YouTube video)$/i.test(plain(button.textContent))) {
        button.firstChild.data='Watch YouTube video';
      }
    });
  }
  document.addEventListener('calorietoken:x-state',function () {renderBlogHelp(blogLocale || selectedLocale());});
  function addContext(id) {
    var note = usecases.find(function (item) {return item.page === id;});
    if (note && !document.getElementById(note.key)) {
      var root=unique('[data-brz-custom-id="'+note.element+'"]');
      if (root && !root.closest(protectedSelector) && !root.querySelector(protectedSelector) && !/Future use concept/.test(root.textContent)) {
        root.prepend(contextNote(note.key,'Future use concept',note.text,'Open CalorieApp',localRoute('calorieapp')));
      }
    }
    if (!document.body.classList.contains('single-post')) return;
    note=articleNotes.find(function (item) {return item.page === id;});
    if (!note || document.getElementById(note.key)) return;
    var copies=Array.from(document.querySelectorAll('.brz-rich-text')).filter(function (rich) {
      return !rich.closest(protectedSelector) && !rich.querySelector(protectedSelector) && plain(rich.textContent).indexOf(note.prefix) === 0;
    });
    if (copies.length === 1) copies[0].prepend(contextNote(note.key,'About this article — September 2026',note.text,note.label,note.href));
  }
  function appInformation() {
    if (window.CalorieTokenAppInfo) window.CalorieTokenAppInfo.refresh();
  }
  function refineMobileSections(id) {
    var protectedLayout = 'form,input,select,textarea,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],iframe,video,audio,canvas,.cmplz-blocked-content-container';
    function markRow(row, kind) {
      if (!row || row.closest(protectedLayout) || row.querySelector(protectedLayout)) return;
      var columns = Array.from(row.children).filter(function (node) { return node.classList.contains('brz-columns'); });
      if (columns.length < 2 || columns.length > 3) return;
      row.classList.add('ctstyle-mobile-cards');
      columns.forEach(function (column) {
        column.classList.add('ctstyle-mobile-card');
        if (kind === 'usecase') column.classList.add('ctstyle-usecase-card');
      });
    }
    var note = usecases.find(function (item) { return item.page === id; });
    if (note) {
      var root = unique('[data-brz-custom-id="' + note.element + '"]');
      if (root && !root.closest(protectedLayout) && !root.querySelector(protectedLayout)) {
        root.classList.add('ctstyle-usecase-content');
        if (root.matches('.brz-row')) markRow(root, 'usecase');
        root.querySelectorAll('.brz-row').forEach(function (row) { markRow(row, 'usecase'); });
      }
    }
    // Widen the actual enclosing card row, rather than just the narrow text inside it.
    if (id === 1205) {
      var details = unique('[data-brz-custom-id="nrsbytvlhdquaddotxqmaeiihmzfbcufpmhr"]');
      if (details && !details.closest(protectedLayout) && !details.querySelector(protectedLayout)) {
        details.classList.add('ctstyle-trustline-content');
        markRow(details.closest('.brz-row'), 'trustline');
      }
    }
    // The reviewed buying guide can also inherit a fixed-width Brizy column.
    if (id === 4205) {
      var guide = unique('.cal-buy-guide[data-calorieapp-buy-guide="1"]');
      if (guide) markRow(guide.closest('.brz-row'), 'buy-guide');
    }
  }


  function refresh() {
    if (!allowed()) return;
    var id = pageId();
    applyCopy(id); refineHowToBuy(id); refineTrustline(id); startRichlists();
    if (id === 1207) refineBlogHelp();
    refineDonations(id); refineFaqAndMerch(id); refineWhitepaper(id); refineRoadmap(id); addContext(id); appInformation(); refineMobileSections(id);
  }
  window.CalorieTokenMenuPages = {refresh: refresh};
  if (pageId() === 5580) {
    ['cmplz_cookie_warning_loaded','cmplz_status_change','cmplz_status_change_service','cmplz_revoke'].forEach(function (name) {
      document.addEventListener(name, function () { if (allowed()) refineRoadmap(5580); });
    });
  }
  if (pageId() === 1207 && !window.CalorieAppBlogX) {
    window.CalorieAppBlogX = {setLocale: function (tag) {blogLocale=tag; renderBlogHelp(tag);}};
    ['cmplz_cookie_warning_loaded','cmplz_status_change','cmplz_status_change_service','cmplz_revoke'].forEach(function (name) {
      document.addEventListener(name, function () { if (allowed()) refineBlogHelp(); });
    });
  }
  blogLocale = selectedLocale();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, {once:true});
  else refresh();
  window.addEventListener('load', refresh, {once:true});
  window.addEventListener('pageshow', refresh);
})();
