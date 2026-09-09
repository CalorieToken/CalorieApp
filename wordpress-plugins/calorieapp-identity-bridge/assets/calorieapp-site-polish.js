(function () {
  "use strict";

  // X's official monochrome logo, from its public brand toolkit.
  var xPath = "M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z";
  var home = window.location.origin;
  var hero = home + "/wp-content/uploads/2024/01/achtergrondbannersitea1.png";
  var blogView = null, blogLocale = null;
  var blogFallback = {
    description: "Posts are supplied by X and may not load here. Open the profile directly or review your cookie choices.",
    action: "Open @CalorieToken on X", settings: "Cookie settings"
  };
  // Reviewed public copy from the step-3 inventory. Applied only to matching
  // page IDs and unchanged original text; Brizy source is never rewritten.
  var contentUpdates = [
  {
    "page": 1090,
    "element": "wygumlqgiqrezhxnioktfbgvtguwcsybfflf",
    "paragraph": "eugew",
    "before": "Calorie Token is an XRP Ledger FinTech business focused on the worldwide food and beverage industry (F&B).",
    "after": "CalorieToken explores how digital tools and the XRP Ledger can support the food and beverage sector."
  },
  {
    "page": 1090,
    "element": "juxhjswuxuolrxacbxalugomoyswtfmergct",
    "paragraph": "ejsgn",
    "before": "Calorie is created by a team of engineers and entrepreneurs who believe in the future of crypto and tokenization.",
    "after": "CalorieApp is the project's current web app for finding food products, understanding nutrition and keeping a personal food log."
  },
  {
    "page": 1090,
    "element": "wlagoxngucccobsjnyxfhradewqcyffnztyq",
    "paragraph": "bfgkq",
    "before": "Calorie Token targets the worldwide F&B industry and aims to become the most used payment method within this industry.",
    "after": "Our wider vision includes practical food data tools and possible future payment applications for consumers and businesses."
  },
  {
    "page": 1090,
    "element": "svtnkbqhfcwfhjndkflkcxdserrqjenkprhx",
    "paragraph": "hftko",
    "before": "$CAL runs on the XRP Ledger (XRPL) and is well known for its superior speed, low cost, scalability and sustainability.",
    "after": "$CAL is the Calorie token issued on the XRP Ledger. It is part of the wider CalorieToken project and its food and beverage vision."
  },
  {
    "page": 6897,
    "element": "vrhwjlwmuyzhctxiwehppdchpfudmyfvenev",
    "paragraph": "yAa81",
    "before": "Catalyze the future of finance with your contribution. Your donation fuels the development of the CalorieApp, unlocking new possibilities and enhancing the Calorie ecosystem. Join us in shaping a revolutionary financial experience – donate today.",
    "after": "Voluntary contributions support work on CalorieApp and the wider CalorieToken project, including improvements to the food and nutrition experience."
  },
  {
    "page": 6926,
    "element": "qyhfzzcmfmqhtwpwgmcbfzlduqykzvyvbtdq",
    "paragraph": "sytvs",
    "before": "Donations",
    "after": "Cart"
  },
  {
    "page": 1205,
    "element": "znktoxmqwoepzseukfugifuucdujbqzchmor",
    "paragraph": "ucgdw",
    "before": "Set your trustline on Xumm:",
    "after": "Set your trustline with Xaman:"
  },
  {
    "page": 1213,
    "element": "aerjwzqjbkfkyvztwjairnowbewwguyontna",
    "paragraph": "viurb",
    "before": "Twitter",
    "after": "X"
  },
  {
    "page": 1213,
    "element": "pwwjpwwzusazehemuxkltpyhfnahcbjbdqbm",
    "paragraph": "ssvhe",
    "before": "Linkedin",
    "after": "LinkedIn"
  },
  {
    "page": 1213,
    "element": "fvpovwkleajvcexfhwyvetuktrzmdjhdijev",
    "paragraph": "cimmn",
    "before": "Youtube",
    "after": "YouTube"
  },
  {
    "page": 1213,
    "element": "zGipNitpHNJY",
    "paragraph": "oBMuJ",
    "before": "New team members are coming",
    "after": "Team updates"
  }
];
  var usecases = [
  {
    "page": 1119,
    "element": "adjzneiqkagtfdgjljxbaoqcsjclanpaxjwg",
    "key": "calorieapp-usecase-context-1119",
    "text": "This illustration explores a possible future use of Calorie in food delivery. Ordering and merchant payment services would require further development and participating businesses. Today, CalorieApp provides food search, nutrition information and a personal food log."
  },
  {
    "page": 1121,
    "element": "pphvdqmaimxhjnifkigsfdcyguqulfrrhixk",
    "key": "calorieapp-usecase-context-1121",
    "text": "This illustration explores possible future uses of Calorie in cafes and bars. Payment applications and a Calorie debit card are concepts, rather than services offered by the current CalorieApp. Today, CalorieApp provides food search, nutrition information and a personal food log."
  },
  {
    "page": 1123,
    "element": "csfqgofnazlhmpgmwplmyhcbhznuakdreimu",
    "key": "calorieapp-usecase-context-1123",
    "text": "This illustration explores a possible future use of Calorie for takeaway orders. Ordering and payment services would require further development and participating businesses. Today, CalorieApp provides food search, nutrition information and a personal food log."
  },
  {
    "page": 1125,
    "element": "rnkchjwqjfoqimzlqcpdwbdfzbbyilnoksct",
    "key": "calorieapp-usecase-context-1125",
    "text": "This illustration explores possible future uses of Calorie in restaurants, including supplier payments and sharing bills. These functions belong to the longer-term vision. Today, CalorieApp provides food search, nutrition information and a personal food log."
  },
  {
    "page": 1127,
    "element": "pqtstqgpfoxaayuvdzwipgwonqiicrcnvgmc",
    "key": "calorieapp-usecase-context-1127",
    "text": "This illustration explores possible future uses of Calorie in grocery shopping and loyalty programmes. Store payments, rewards and debit cards remain concepts that need further development and participating businesses. Today, CalorieApp provides food search, nutrition information and a personal food log."
  },
  {
    "page": 1129,
    "element": "jamhytnywvwftxmjyfkchyazpxnpdcyshpbn",
    "key": "calorieapp-usecase-context-1129",
    "text": "This illustration explores possible future uses of Calorie between farmers, wholesalers and hospitality businesses. Supplier payments and business integrations belong to the longer-term vision. Today, CalorieApp provides food search, nutrition information and a personal food log."
  }
];
  var articleNotes = [
  {
    "page": 7608,
    "key": "calorie-editorial-context-7608-20260907",
    "prefix": "Title: Embracing the Future: The Potential of CalorieToken as a DAO",
    "text": "This article records a discussion from August 2024 about a possible DAO structure. A full transfer of the project to a DAO remains a future direction, not an announced completed transition. The legal and organisational references below belong to the article’s original period. For the current product scope, see the project FAQ.",
    "label": "Project FAQ",
    "href": "https://calorietoken.net/index.php/faq/"
  },
  {
    "page": 7545,
    "key": "calorie-editorial-context-7545-20260907",
    "prefix": "Tackling Frontrunning on the XRPL: Our Journey to a Practical Solution",
    "text": "This article records a proposed approach to unfunded XRPL offers. The XRP Ledger can remove unfunded offers when it encounters them during transaction processing; an OfferCancel transaction cancels an offer owned by its sending account. An external monitoring service does not automatically gain permission to cancel other accounts’ offers. The proposal below should not be read as evidence of a deployed CalorieApp service.",
    "label": "XRPL offer lifecycle",
    "href": "https://xrpl.org/docs/concepts/tokens/decentralized-exchange/offers"
  },
  {
    "page": 7564,
    "key": "calorie-editorial-context-7564-20260907",
    "prefix": "CalorieToken: An Update on Our Journey and Future Plans",
    "text": "This is a historical project update from 2024. Today, CalorieApp provides food search, nutrition information and a personal food log using Open Food Facts. The FoodRepo, BigchainDB and IPFS descriptions below record earlier development plans; they are not a description of the current web app’s deployed architecture. Team circumstances and listing aspirations should also be read in their original context.",
    "label": "Open CalorieApp",
    "href": "https://calorietoken.net/index.php/calorieapp/"
  },
  {
    "page": 7569,
    "key": "calorie-editorial-context-7569-20260907",
    "prefix": "Exciting News: First Release of the CalorieApp Test APK on Android!",
    "text": "This article concerns the earlier CalorieAppTestnet Android prototype. The APK link below is retained as development history and is not the current web app or a Play Store release. For the current food search, nutrition information and personal food log, open CalorieApp in your browser.",
    "label": "Open CalorieApp",
    "href": "https://calorietoken.net/index.php/calorieapp/"
  },
  {
    "page": 7578,
    "key": "calorie-editorial-context-7578-20260907",
    "prefix": "Unlock Seamless Trading with Our Integrated Exchange",
    "text": "This article describes the former embedded exchange experience. That integration is outside the current CalorieApp web version, which focuses on food search, nutrition information and a personal food log. The wallet counts, supported assets and trading instructions below are historical descriptions, not a current service list. For today’s product scope, see the project FAQ.",
    "label": "Project FAQ",
    "href": "https://calorietoken.net/index.php/faq/"
  },
  {
    "page": 7573,
    "key": "calorie-editorial-context-7573-20260907",
    "prefix": "Exciting News: Our Donations Page is LIVE!",
    "text": "This article announced the donation page in 2023. Voluntary contributions support work on CalorieApp and the wider project. The merchandise and NFT launch language below belongs to that historical announcement and does not confirm current availability. Read the current donation page and its terms before contributing.",
    "label": "Donation information",
    "href": "https://calorietoken.net/index.php/donate/"
  },
  {
    "page": 7583,
    "key": "calorie-editorial-context-7583-20260907",
    "prefix": "CalorieToken Hackathon: Building the Future of Health and Blockchain",
    "text": "This article records the 2023 CalorieToken hackathon and early development experiments. It is not an open invitation to a current competition, and the APK links refer to the earlier testnet prototype. New events will have their own announcements. The current browser app is available from the CalorieApp page.",
    "label": "Open CalorieApp",
    "href": "https://calorietoken.net/index.php/calorieapp/"
  },
  {
    "page": 7575,
    "key": "calorie-editorial-context-7575-20260907",
    "prefix": "Enhancing Trust in the XRPL Ecosystem: The Importance of Verified Doma",
    "text": "This article records the project’s work on domain and account information. Domain verification establishes a specific link between a domain and an account or validator; it is not an endorsement of every claim, service or token associated with that domain. A TOML entry claiming an account must be checked against that account’s on-ledger Domain field.",
    "label": "XRPL TOML and account verification",
    "href": "https://xrpl.org/docs/references/xrp-ledger-toml"
  },
  {
    "page": 7587,
    "key": "calorie-editorial-context-7587-20260907",
    "prefix": "The Importance of Test Currency and Testing in Blockchain Development",
    "text": "This article explains the role of test assets in the project’s early experiments. CalorieTest and Lipisa belong to that development context. Their mention does not mean that the current CalorieApp browser experience includes a test wallet, token faucet or payment service. Its current focus is food search, nutrition information and a personal food log.",
    "label": "Open CalorieApp",
    "href": "https://calorietoken.net/index.php/calorieapp/"
  },
  {
    "page": 7591,
    "key": "calorie-editorial-context-7591-20260907",
    "prefix": "Discover the Future of Food with Calorie Token: A Comprehensive Overvi",
    "text": "This is the project’s original 2023 overview. The allocation percentages describe the initial plan, not current wallet balances. The payment, NFT, inventory, private-key and BigchainDB/IPFS sections describe that early vision. Today, CalorieApp provides food search, nutrition information and a personal food log using Open Food Facts. The project FAQ explains the current scope.",
    "label": "Project FAQ",
    "href": "https://calorietoken.net/index.php/faq/"
  }
];
  var usecaseSlugs = ["delivery", "cafes", "takeaway", "restaurants", "groceries", "wholesalers"];

  // Frozen anonymous page source observed on 2026-09-08. These legacy links
  // identify reviewed old markup; they are not replacement destinations.
  // A later CMS edit, translation, form or changed link wins over this patch.
  var legacyBuyGuideMarkup = [
    "<h2>Before you start</h2><p>Calorie (CAL) is a token on the XRP Ledger. Use a supported wallet and check the token’s issuer, not just its name or logo.</p><p><strong>Currency:</strong> Calorie (CAL)<br><strong>Issuer:</strong> <span style=\"overflow-wrap:anywhere\">rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY</span><br><strong>Currency code:</strong> <span style=\"overflow-wrap:anywhere\">43616C6F72696500000000000000000000000000</span></p>",
    "<h2>Choose a trading interface</h2><p><strong><a href=\"https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY\" target=\"_blank\" rel=\"noopener noreferrer\">XPMarket</a></strong><br>Open the CAL token page, then choose an available trade or swap.</p><p><strong><a href=\"https://sologenic.org/\" target=\"_blank\" rel=\"noopener noreferrer\">Sologenic</a></strong><br>Open the DEX and select Calorie/XRP. Verify the issuer above.</p><p><strong><a href=\"https://xumm.app/detect/xapp:xumm.dex?base=43616C6F72696500000000000000000000000000+rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY&amp;quote=xrp\" target=\"_blank\" rel=\"noopener noreferrer\">Xaman DEX</a></strong><br>Open the DEX xApp in Xaman and verify the selected Calorie/XRP pair.</p><p><strong><a href=\"https://www.xrptoolkit.com/\" target=\"_blank\" rel=\"noopener noreferrer\">XRP Toolkit</a></strong><br>Connect a supported wallet and open Trade. Select Calorie by its issuer.</p><p>These are external services. Available pairs, liquidity, fees and regional access may change. No centralized exchange listing is confirmed on this page.</p>",
    "<h2>How to buy CAL on the XRP Ledger</h2><ol><li>Set up a supported XRPL wallet using its official website or app. Keep your recovery phrase private.</li><li>Add enough XRP for the intended trade and the wallet’s displayed reserve and network fees.</li><li>Open one of the interfaces above. Select Calorie/CAL and verify the complete issuer address shown here.</li><li>If your wallet requests a CAL trust line, review it before approving. Then enter the amount and inspect the quoted price, liquidity, fees and slippage.</li><li>Approve only the transaction you intend in your wallet. Wait for the ledger result and check your resulting balance.</li></ol><p>Reserve requirements can change; follow your wallet’s current values and the <a href=\"https://xrpl.org/docs/tutorials/best-practices/account-management/calculate-reserves\" target=\"_blank\" rel=\"noopener noreferrer\">official XRPL reserve documentation</a>. Never enter a recovery phrase on a trading website.</p>",
    "<p>Trading can result in loss. This page provides practical links and instructions, not an investment recommendation. CAL trading is separate from CalorieApp’s food search and personal food log.</p>",
  ].join("");
  function normalizedMarkup(markup) {
    return String(markup || "").replace(/>\s+</g, "><").trim();
  }

  function pageId() {
    var match = document.body.className.match(/(?:^|\s)(?:page-id-|postid-)(\d+)(?:\s|$)/);
    return match ? Number(match[1]) : 0;
  }
  function plain(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
  function localRoute(slug) { return home + "/index.php/" + slug + "/"; }
  function svgMark(path) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 1200 1227");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
    shape.setAttribute("d", path);
    shape.setAttribute("fill", "currentColor");
    svg.appendChild(shape);
    return svg;
  }
  function replaceMatchingText(element, before, after) {
    if (!element || plain(element.textContent) !== plain(before)) return false;
    // Retain the existing link, emphasis and typography when a leaf contains
    // the complete text. Never replace a container with a form or image.
    if (element.querySelector("img,svg,iframe,input,button,select,textarea")) return false;
    var leaves = Array.from(element.querySelectorAll("a,u,strong,span"));
    var target = leaves.reverse().find(function (leaf) { return plain(leaf.textContent) === plain(before); }) || element;
    target.textContent = after;
    return true;
  }
  function applyCopy(id) {
    contentUpdates.filter(function (item) { return item.page === id; }).forEach(function (item) {
      var root = document.querySelector('[data-brz-custom-id="' + item.element + '"]');
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
  function refineReading(id) {
    document.querySelectorAll("section .brz-rich-text").forEach(function (rich) {
      var section = rich.closest("section");
      if (section.querySelector(".brz-menu-simple,.xl-card") || rich.querySelector("h1,.metaslider,.brz-timeline,iframe,form") ||
          plain(rich.textContent).indexOf("Operator: ICTHendrikse") === 0) return;
      if (plain(rich.textContent).length < 220) return;
      rich.classList.add("calorieapp-reading-copy");
      rich.querySelectorAll("p").forEach(function (paragraph) {
        if (!plain(paragraph.textContent) && !paragraph.querySelector("img,svg,iframe,video,input")) paragraph.classList.add("calorieapp-empty-paragraph");
      });
    });
    if (!document.body.classList.contains("single-post")) return;
    var copies = Array.from(document.querySelectorAll(".calorieapp-reading-copy"));
    copies.sort(function (a, b) { return b.textContent.length - a.textContent.length; });
    var article = copies[0];
    if (!article) return;
    article.classList.add("calorieapp-article-copy");
    var section = article.closest("section");
    var title = section && section.querySelector("h1");
    var titleRoot = title && title.closest(".brz-rich-text");
    if (titleRoot) titleRoot.classList.add("calorieapp-article-title");
    var note = articleNotes.find(function (item) { return item.page === id; });
    if (!note || document.getElementById(note.key) || /About this article — September 2026/.test(article.textContent)) return;
    if (plain(article.textContent).indexOf(note.prefix) !== 0) return;
    article.prepend(contextNote(note.key, "About this article — September 2026", note.text, note.label, note.href));
  }
  function refineUsecases(id) {
    document.querySelectorAll(".brz-image a[href]").forEach(function (link) {
      var url;
      try { url = new URL(link.href); } catch (_error) { return; }
      if (url.origin !== home || url.search || url.hash) return;
      var slug = url.pathname.replace(/^\/index\.php\//, "/").replace(/^\/|\/$/g, "");
      if (usecaseSlugs.indexOf(slug) === -1) return;
      link.classList.add("calorieapp-usecase-link");
      link.setAttribute("aria-label", "Explore " + slug + " use concept");
      link.closest(".brz-image").classList.add("calorieapp-usecase-image");
    });
    var note = usecases.find(function (item) { return item.page === id; });
    if (!note) return;
    document.querySelectorAll("section .brz-image").forEach(function (picture) { picture.classList.add("calorieapp-usecase-image"); });
    var root = document.querySelector('[data-brz-custom-id="' + note.element + '"]');
    if (!root || document.getElementById(note.key) || /Future use concept/.test(root.textContent)) return;
    root.prepend(contextNote(note.key, "Future use concept", note.text, "Open CalorieApp", localRoute("calorieapp")));
  }
  function blogPanel() {
    if (window.calorieappSitePolish?.blog?.publicPage !== true
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
    var config = window.calorieappSitePolish && window.calorieappSitePolish.blog;
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
    // revoke consent, rescan widgets, reload the page, or load a provider script.
    blogView.settings.hidden = typeof window.cmplz_has_service_consent !== "function"
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
    var config = window.calorieappSitePolish && window.calorieappSitePolish.blog;
    renderBlogHelp(blogLocale || (config && config.initialLocale) || "en");
  }
  function refineBlog(id) {
    if (id !== 1207) return;
    // Keep the original coloured heading and native CMP/X embed intact.
    refineBlogHelp();
    var gallery = document.getElementById("metaslider-id-819");
    if (!gallery) return;
    gallery.classList.add("calorieapp-art-gallery");
    gallery.setAttribute("aria-label", "Historical CalorieToken community art");
    if (!gallery.querySelector(".calorieapp-art-caption")) {
      var caption = document.createElement("p");
      caption.className = "calorieapp-art-caption";
      caption.textContent = "Community art · From our history";
      gallery.prepend(caption);
    }
    gallery.querySelectorAll(".nivo-directionNav a,.nivo-controlNav a").forEach(function (control) {
      if (control.dataset.calorieappKeyboard === "1") return;
      control.setAttribute("role", "button");
      control.setAttribute("tabindex", "0");
      if (!control.hasAttribute("aria-label")) control.setAttribute("aria-label", "Show artwork " + plain(control.textContent));
      control.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        control.click();
      });
      control.dataset.calorieappKeyboard = "1";
    });
  }
  function refineContact(id) {
    if (id !== 1213) return;
    // The image had an older invite while the text and footer use this one.
    document.querySelectorAll('section a[href="https://t.me/joinchat/8jIusxwzMVI0NGVk"]').forEach(function (link) {
      link.href = "https://t.me/+7YxaKdQYWNA0NDA0";
    });
    var social = [
      ["https://x.com/CalorieToken", "X", "#111"],
      ["https://www.linkedin.com/company/calorie-token/", "LinkedIn", "#0a66c2"],
      ["https://www.facebook.com/CalorieToken-100422882407878", "Facebook", "#0866ff"],
      ["https://t.me/+7YxaKdQYWNA0NDA0", "Telegram", "#168ac0"],
      ["https://www.youtube.com/channel/UCV_87rxST-cQOVu4W8nFZkA", "YouTube", "#e62117"],
      ["https://www.instagram.com/calorietoken/", "Instagram", "#833ab4"]
    ];
    social.forEach(function (item) {
      document.querySelectorAll('.brz-image a[href="' + item[0] + '"]').forEach(function (link) {
        var column = link.closest(".brz-columns");
        if (column) column.classList.add("calorieapp-contact-card");
        link.classList.add("calorieapp-social-image-link");
        link.setAttribute("aria-label", "CalorieToken on " + item[1]);
        link.setAttribute("title", item[1]);
        var picture = link.querySelector("picture");
        if (!picture) return;
        var mark;
        if (item[1] === "X") mark = svgMark(xPath);
        else {
          // Reuse this site's existing footer symbol, never an invented logo.
          var original = Array.from(document.querySelectorAll('a[href="' + item[0] + '"] svg use'))[0];
          if (!original) return;
          mark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          mark.setAttribute("aria-hidden", "true");
          mark.setAttribute("focusable", "false");
          mark.appendChild(original.cloneNode(true));
        }
        mark.style.color = item[2];
        picture.replaceWith(mark);
      });
    });
  }
  function refineTrustline(id) {
    if (id !== 1205) return;
    if (window.CalorieAppTrustline) { window.CalorieAppTrustline.refresh(); return; }
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
    var view = null, locale = "en", observer = null, watching = true;
    function publicPage() {
      if (window.calorieappSitePolish?.trustlinePage !== true || pageId() !== 1205
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
      var config = window.calorieappDisplayLanguageConfig;
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
      var oldLogo = document.querySelector('[data-brz-custom-id="xgtkrgoagaprsyfxmfdmrqmaqfjkwgmokcdq"] picture');
      if (oldLogo) {
        var label = document.createElement("span"); label.className = "calorieapp-xaman-label";
        label.textContent = "Xaman"; oldLogo.replaceWith(label);
      }
      view = candidate;
    }
    function validLink(candidate) {
      return candidate.link && candidate.link.parentElement === candidate.root
        && candidate.link.getAttribute("href") === "?xl-trustline"
        && !candidate.link.getAttribute("target");
    }
    function refresh() {
      if (observer) observer.disconnect();
      var live = source();
      if (view && !current(view)) cleanup();
      if (!view && live) build(live);
      if (view) {
        var ready = window.calorieappSitePolish?.trustlineReady === true;
        if (view.link && (!ready || !validLink(view))) { view.link.remove(); view.link = null; }
        if (ready && !view.link) {
          var candidate = view, link = document.createElement("a");
          link.id = "calorieapp-xaman-trustline"; link.className = "calorieapp-xaman-trustline";
          link.setAttribute("data-calorieapp-trustline-ui", "");
          link.href = "?xl-trustline";
          link.addEventListener("click", function (event) {
            if (!current(candidate) || candidate.link !== link || !validLink(candidate)
                || window.calorieappSitePolish?.trustlineReady !== true) {
              event.preventDefault(); refresh();
            }
          });
          view.link = link; view.root.insertBefore(link, view.note);
        }
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
  function refineHowToBuy(id) {
    if (id !== 4205 || window.calorieappSitePolish?.buyGuide?.publicPage !== true) return;
    var url = new URL(window.location.href);
    if (!["https://calorietoken.net", "https://www.calorietoken.net"].includes(url.origin)
      || !["/index.php/how-to-buy-calorie/", "/how-to-buy-calorie/"].includes(url.pathname)
      || Array.from(url.searchParams.keys()).some(function (key) { return key !== "ui_lang"; })) return;
    var guides = document.querySelectorAll(".cal-buy-guide");
    var guide = guides.length === 1 ? guides[0] : null;
    if (!guide || guide.dataset.calorieappBuyGuide === "1"
      || guide.closest("form,[contenteditable],.xl-card,[data-calorieapp-embed],[data-calorieapp-account]")) return;
    if (normalizedMarkup(guide.innerHTML) !== normalizedMarkup(legacyBuyGuideMarkup)) return;
    guide.dataset.calorieappBuyGuide = "1";
    guide.innerHTML = [
      "<header class=\"cal-buy-hero\"><p class=\"cal-buy-eyebrow\" data-cal-buy-copy=\"eyebrow\">XRPL buying and selling guide</p><h2 data-cal-buy-copy=\"title\">Buy or sell CAL in four clear steps</h2><p data-cal-buy-copy=\"intro\">CAL trades on the XRP Ledger DEX. Verify the complete issuer and currency code, not just the name or logo.</p><dl class=\"cal-buy-identity\"><div><dt data-cal-buy-copy=\"assetLabel\">Asset</dt><dd><code dir=\"ltr\">Calorie (CAL)</code></dd></div><div><dt data-cal-buy-copy=\"issuerLabel\">Issuer</dt><dd><code dir=\"ltr\">rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY</code></dd></div><div><dt data-cal-buy-copy=\"currencyLabel\">Currency code</dt><dd><code dir=\"ltr\">43616C6F72696500000000000000000000000000</code></dd></div></dl></header>",
      "<ol class=\"cal-buy-steps\"><li><span aria-hidden=\"true\">1</span><div><h3 data-cal-buy-copy=\"walletTitle\">Set up an XRPL wallet</h3><p data-cal-buy-copy=\"walletText\">Install Xaman from its official source. Keep recovery information offline; never enter it on this website or a trading page.</p><a data-cal-buy-copy=\"walletAction\" href=\"https://xaman.app/\" rel=\"noopener noreferrer\">Visit Xaman</a></div></li>",
      "<li><span aria-hidden=\"true\">2</span><div><h3 data-cal-buy-copy=\"fundTitle\">Fund your wallet with XRP</h3><p data-cal-buy-copy=\"fundText\">Xaman lists independent providers by country and currency. Check eligibility, identity checks, rates and fees; availability varies by region.</p><a data-cal-buy-copy=\"fundAction\" href=\"https://xumm.app/detect/xapp:xumm.buysellxrp\" rel=\"noopener noreferrer\">Find options in Xaman</a><p data-cal-buy-copy=\"reserveText\">Keep enough XRP for the reserve and network fees shown by your wallet. Reserve requirements can change.</p><a data-cal-buy-copy=\"reserveAction\" href=\"https://xrpl.org/docs/concepts/accounts/reserves\" rel=\"noopener noreferrer\">XRPL reserve information</a></div></li>",
      "<li><span aria-hidden=\"true\">3</span><div><h3 data-cal-buy-copy=\"trustTitle\">Add the exact CAL trustline</h3><p data-cal-buy-copy=\"trustText\">To receive CAL, review its issuer and currency code before approving the trustline in Xaman.</p><a data-cal-buy-copy=\"trustAction\" href=\"__TRUSTLINE__\" rel=\"noopener noreferrer\">Open CAL trustline guide</a></div></li>",
      "<li><span aria-hidden=\"true\">4</span><div><h3 data-cal-buy-copy=\"tradeTitle\">Choose buy or sell</h3><p data-cal-buy-copy=\"tradeText\">On XPMarket, check what you pay and receive, the issuers, route, fees, liquidity and price impact. Review the final request in your wallet.</p><a data-cal-buy-copy=\"tradeAction\" href=\"https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY\" rel=\"noopener noreferrer\">Open CAL on XPMarket</a><p data-cal-buy-copy=\"sellText\">To sell, pay CAL and receive XRP or RLUSD. Receiving RLUSD can require its own verified trustline. Withdrawing proceeds to a bank account is a separate provider service.</p></div></li>",
      "</ol><section class=\"cal-buy-markets\"><div><h3 data-cal-buy-copy=\"marketTitle\">CAL markets</h3><p data-cal-buy-copy=\"marketText\">CAL/XRP and CAL/RLUSD have recorded AMM markets. Check the current market before trading in either direction.</p></div><div class=\"cal-buy-pair-grid\"><article><strong dir=\"ltr\">CAL / XRP</strong><small data-cal-buy-copy=\"pairType\">XRPL AMM pair</small></article><article><strong dir=\"ltr\">CAL / RLUSD</strong><small data-cal-buy-copy=\"pairType\">XRPL AMM pair</small></article></div></section>",
      "<aside class=\"cal-buy-own-dex\"><h3 data-cal-buy-copy=\"moduleTitle\">Trading through external services</h3><p data-cal-buy-copy=\"moduleText\">This website provides guidance and external links. Trading takes place with the selected external service and your wallet.</p></aside>",
      "<aside class=\"cal-buy-risk\"><strong data-cal-buy-copy=\"riskTitle\">Before you trade</strong><p data-cal-buy-copy=\"riskText\">Trading can cause loss. Project-related wallets may provide liquidity and have a financial interest. Quotes, liquidity and execution are not guaranteed. This guide is not investment advice.</p><p data-cal-buy-copy=\"appText\">CalorieApp food search and food logging do not require buying CAL.</p></aside>"
    ].join("").replace("__TRUSTLINE__", localRoute("trustline"));
    guide.setAttribute("aria-label", "Buy or sell CAL in four clear steps");
    guide.setAttribute("lang", "en");
    guide.setAttribute("dir", "ltr");
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
    document.body.classList.add("calorieapp-donation-page");
    var field = document.getElementById("wcj_open_price");
    if (field && !document.getElementById("calorieapp-donation-help")) {
      var form = field.closest("form");
      if (form) {
        var help = document.createElement("p");
        help.className = "calorieapp-donation-help";
        help.id = "calorieapp-donation-help";
        help.textContent = "Choose your donation amount in XRP. You can review the amount and quantity in your cart before continuing to payment.";
        form.prepend(help);
        field.setAttribute("aria-describedby", plain((field.getAttribute("aria-describedby") || "") + " " + help.id));
        if (!field.hasAttribute("inputmode")) field.setAttribute("inputmode", "decimal");
      }
    }
    if (document.getElementById("calorieapp-donation-steps")) return;
    var content = document.querySelector(".brz-woo-add-to-cart,.woocommerce-cart-form,form.checkout");
    if (!content) return;
    var nav = document.createElement("nav");
    nav.id = "calorieapp-donation-steps";
    nav.className = "calorieapp-donation-steps";
    nav.setAttribute("aria-label", "Donation steps");
    var list = document.createElement("ol");
    steps.forEach(function (step, n) {
      var li = document.createElement("li");
      // Future steps are text: no shortcut can skip entering/reviewing amount.
      var label = document.createElement(n < index ? "a" : "span");
      label.textContent = (n + 1) + ". " + step[1];
      if (n < index) label.href = localRoute(step[2]);
      if (n === index) label.setAttribute("aria-current", "step");
      li.appendChild(label);
      list.appendChild(li);
    });
    nav.appendChild(list);
    var anchor = content.closest(".brz-wrapper") || content;
    anchor.parentNode.insertBefore(nav, anchor);
  }

  function polish() {
    // Only the main navigation's existing header background is normalized.
    // Product pictures, historical artwork and payment controls are untouched.
    document.querySelectorAll(".brz-menu-simple").forEach(function (menu) {
      var section = menu.closest("section");
      var background = section && section.querySelector(".brz-section__content > .brz-bg > .brz-bg-image");
      if (!background || background.dataset.calorieappHeaderPolished === "1") return;
      var original = window.getComputedStyle(background).backgroundImage;
      if (!/\/Caloriefoto2\.jpg(?:["')?]|$)/i.test(original)) return;
      background.style.setProperty("background-image", 'url("' + hero + '")', "important");
      background.style.setProperty("background-size", "cover", "important");
      background.style.setProperty("background-position", "center", "important");
      background.dataset.calorieappHeaderPolished = "1";
    });

    document.querySelectorAll('a[href]').forEach(function (link) {
      var url;
      try { url = new URL(link.href, window.location.href); } catch (_error) { return; }
      if (url.protocol !== "https:" || url.username || url.password ||
          !/^(?:www\.)?(?:twitter\.com|x\.com)$/.test(url.hostname) ||
          !/^\/CalorieToken\/?$/i.test(url.pathname) || url.search || url.hash) return;
      // Never rewrite historical tweet permalinks or unrelated accounts.
      link.href = "https://x.com/CalorieToken";
      var glyph = link.querySelector("svg");
      var use = glyph && glyph.querySelector("use");
      var href = use && (use.getAttribute("href") || use.getAttribute("xlink:href") || "");
      if (glyph && /\/twitter\.svg#fa_icon$/.test(href || "")) {
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", xPath);
        path.setAttribute("fill", "currentColor");
        glyph.replaceChildren(path);
        glyph.setAttribute("viewBox", "0 0 1200 1227");
        glyph.setAttribute("aria-hidden", "true");
        glyph.setAttribute("focusable", "false");
        link.setAttribute("aria-label", "CalorieToken on X");
        link.setAttribute("title", "CalorieToken on X");
      }
    });
    var id = pageId();
    applyCopy(id);
    refineReading(id);
    refineUsecases(id);
    refineBlog(id);
    refineContact(id);
    refineTrustline(id);
    refineHowToBuy(id);
    refineDonations(id);
  }

  function boot() {
    if (!document.body || /\/wp-admin\//.test(window.location.pathname) ||
        document.body.classList.contains("brz-ed") || document.querySelector("#brz-ed-iframe")) return;
    polish();
    if (pageId() === 1207 && !window.CalorieAppBlogX) {
      window.CalorieAppBlogX = { setLocale: function (locale) { blogLocale = locale; renderBlogHelp(locale); } };
      document.addEventListener("cmplz_cookie_warning_loaded", refineBlogHelp);
      document.addEventListener("cmplz_status_change", refineBlogHelp);
      document.addEventListener("cmplz_status_change_service", refineBlogHelp);
      document.addEventListener("cmplz_revoke", refineBlogHelp);
    }
    window.addEventListener("load", polish, { once: true });
    window.addEventListener("pageshow", polish);
    // Brizy's carousel clones already-corrected icons after initialization.
    // No whole-document mutation observer or ongoing polling is needed.
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
