import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_PATH = new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-embed.js",
  import.meta.url
);
const STYLE_PATH = new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-embed.css",
  import.meta.url
);
const PLUGIN_PATH = new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge/includes/class-calorieapp-identity-bridge-integrated-login.php",
  import.meta.url
);
const MAIN_PLUGIN_PATH = new URL(
  "../../wordpress-plugins/calorieapp-identity-bridge/includes/class-calorieapp-identity-bridge.php",
  import.meta.url
);

function element(hidden = true) {
  const listeners = {};
  const classes = new Set();
  const styleValues = new Map();
  return {
    children: [],
    hidden,
    href: "",
    parentElement: null,
    src: "",
    style: {
      getPropertyValue(name) {
        return styleValues.get(name) ?? "";
      },
      removeProperty(name) {
        const value = styleValues.get(name) ?? "";
        styleValues.delete(name);
        return value;
      },
      setProperty(name, value) {
        styleValues.set(name, value);
      },
    },
    textContent: "",
    classList: {
      add(value) {
        classes.add(value);
      },
      remove(value) {
        classes.delete(value);
      },
      contains(value) {
        return classes.has(value);
      },
      toggle(value, force) {
        if (force === true) {
          classes.add(value);
          return true;
        }
        if (force === false) {
          classes.delete(value);
          return false;
        }
        if (classes.has(value)) {
          classes.delete(value);
          return false;
        }
        classes.add(value);
        return true;
      },
    },
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    dispatch(type, event = {}) {
      listeners[type]?.(event);
    },
    removeAttribute(name) {
      this[name] = "";
    },
    getAttribute(name) {
      return this[name] ?? null;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
}

test("mobile joint-session control stays compact and viewport-bounded", async () => {
  const source = await readFile(STYLE_PATH, "utf8");
  const mobileRules = source.slice(source.indexOf("@media (max-width: 768px)"));

  assert.match(
    mobileRules,
    /\.brz \.calorieapp-identity-wrapper\s*\{[^}]*right:\s*auto\s*!important;[^}]*left:\s*50vw\s*!important;[^}]*width:\s*min\(250px, calc\(100vw - 24px\)\)\s*!important;[^}]*transform:\s*translateX\(-50%\);/s
  );
  assert.match(
    mobileRules,
    /grid-template-columns:\s*22px minmax\(0, 1fr\) auto/
  );
  assert.match(
    mobileRules,
    /\.brz \.brz-menu-simple\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*20;/s
  );
  assert.match(
    mobileRules,
    /\.brz \.calorieapp-brizy-menu-column\s*\{[^}]*margin-top:\s*24px\s*!important;/s
  );
  assert.match(
    mobileRules,
    /@supports selector\(:has\(\*\)\)\s*\{\s*\.brz \.brz-columns:has\(\.brz-menu-simple\)\s*\{[^}]*margin-top:\s*24px\s*!important;/s
  );
  assert.doesNotMatch(
    mobileRules,
    /\.calorieapp-brizy-menu-column\s*,[^\{]*:has\(/
  );
  assert.match(
    mobileRules,
    /\.calorieapp-identity-wrapper \.brz-wp-shortcode\s*\{[^}]*width:\s*100%\s*!important;[^}]*max-width:\s*100%\s*!important;/s
  );
  assert.match(
    mobileRules,
    /\.calorieapp-identity-wrapper \.brz-wp-shortcode > div\s*\{[^}]*margin-right:\s*auto\s*!important;[^}]*margin-left:\s*auto\s*!important;/s
  );
  assert.match(
    mobileRules,
    /\.calorieapp-identity-card\s*\{[^}]*min-height:\s*0\s*!important;[^}]*max-width:\s*100%\s*!important;/s
  );
  assert.match(
    mobileRules,
    /\.calorieapp-identity-card\s*\{[^}]*--calorieapp-identity-center-shift:\s*0px;[^}]*transform:\s*translateX\(var\(--calorieapp-identity-center-shift\)\)\s*!important;/s
  );
  assert.doesNotMatch(mobileRules, /calorieapp-brizy-nav-open/);
  assert.doesNotMatch(
    mobileRules,
    /\.calorieapp-identity-wrapper\s*\{[^}]*visibility:\s*hidden/s
  );
  assert.doesNotMatch(mobileRules, /grid-column:\s*1\s*\/\s*-1/);
  assert.doesNotMatch(mobileRules, /\.calorieapp-site-logout\s*\{[^}]*width:\s*100%/s);
});

test("mobile identity card corrects Brizy's residual rendered offset", async () => {
  const scriptSource = await readFile(SCRIPT_PATH, "utf8");
  const identityWrapper = element(false);
  const identityCard = element(false);
  identityCard.closest = (selector) =>
    selector === ".brz-wrapper" ? identityWrapper : null;
  identityCard.getBoundingClientRect = () => {
    const shift = Number.parseFloat(
      identityCard.style.getPropertyValue(
        "--calorieapp-identity-center-shift"
      )
    ) || 0;
    return { left: 53 + shift, width: 250 };
  };
  const document = {
    documentElement: { clientWidth: 390 },
    readyState: "complete",
    querySelectorAll(selector) {
      if (selector === ".xl-card") {
        return [identityCard];
      }
      return [];
    },
  };
  const windowListeners = {};
  const window = {
    addEventListener(type, listener) {
      windowListeners[type] = listener;
    },
    matchMedia() {
      return { matches: true };
    },
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
  };

  vm.runInNewContext(scriptSource, { document, window });

  assert.equal(
    identityCard.style.getPropertyValue(
      "--calorieapp-identity-center-shift"
    ),
    "17px"
  );
  windowListeners.resize();
  assert.equal(
    identityCard.style.getPropertyValue(
      "--calorieapp-identity-center-shift"
    ),
    "17px"
  );
});

test("site-wide widget clears CalorieApp before WordPress logout", async () => {
  const scriptSource = await readFile(SCRIPT_PATH, "utf8");
  const identityWrapper = element(false);
  const identityCard = element(false);
  identityCard.closest = (selector) =>
    selector === ".brz-wrapper" ? identityWrapper : null;

  const logoutButton = element(false);
  logoutButton.dataset = {
    idleLabel: "Sign out both",
    logoutUrl: "https://calorietoken.net/wp-login.php?action=logout&_wpnonce=test",
  };
  const logoutStatus = element(true);
  const sessionActions = element(true);
  sessionActions.dataset = {
    appOrigin: "https://app.calorietoken.net",
    frameSrc: "https://app.calorietoken.net/?embedded=1&locale=en",
    locale: "en",
  };
  sessionActions.querySelector = (selector) => {
    if (selector === ".calorieapp-site-logout") {
      return logoutButton;
    }
    if (selector === ".calorieapp-site-logout-status") {
      return logoutStatus;
    }
    return null;
  };

  const iframePosts = [];
  const iframeWindow = {
    postMessage(message, origin) {
      iframePosts.push({ message, origin });
    },
  };
  const logoutFrame = element(false);
  logoutFrame.contentWindow = iframeWindow;
  logoutFrame.remove = () => {
    logoutFrame.parentElement = null;
  };
  const body = element(false);
  const document = {
    body,
    readyState: "complete",
    createElement(tagName) {
      assert.equal(tagName, "iframe");
      return logoutFrame;
    },
    querySelector(selector) {
      return selector === "[data-calorieapp-sitewide-session-actions]"
        ? sessionActions
        : null;
    },
    querySelectorAll(selector) {
      if (selector === ".xl-card") {
        return [identityCard];
      }
      return [];
    },
  };
  const windowListeners = {};
  let assignedLocation = "";
  const window = {
    addEventListener(type, listener) {
      windowListeners[type] = listener;
    },
    clearTimeout() {},
    location: {
      assign(value) {
        assignedLocation = value;
      },
    },
    setTimeout() {
      return 1;
    },
  };

  vm.runInNewContext(scriptSource, { document, URL, window });

  assert.equal(sessionActions.parentElement, identityCard);
  assert.equal(sessionActions.hidden, false);
  logoutButton.dispatch("click");
  assert.equal(body.children.at(-1), logoutFrame);
  assert.equal(logoutButton.disabled, true);
  assert.equal(logoutButton.textContent, "Logging out...");
  assert.equal(iframePosts.length, 0);

  windowListeners.message({
    data: { type: "calorieapp:bridge:ready", locale: "en" },
    origin: "https://app.calorietoken.net",
    source: iframeWindow,
  });
  assert.equal(iframePosts.at(-1).message.type, "calorieapp:bridge:init");
  windowListeners.message({
    data: { type: "calorieapp:bridge:initialized", locale: "en" },
    origin: "https://app.calorietoken.net",
    source: iframeWindow,
  });
  assert.equal(iframePosts.at(-1).message.type, "calorieapp:logout");
  windowListeners.message({
    data: { type: "calorieapp:logout:complete", locale: "en" },
    origin: "https://app.calorietoken.net",
    source: iframeWindow,
  });
  assert.equal(assignedLocation, logoutButton.dataset.logoutUrl);
});

test("site-wide header layout loads without starting the CalorieApp bridge", async () => {
  const scriptSource = await readFile(SCRIPT_PATH, "utf8");
  const pluginSource = await readFile(PLUGIN_PATH, "utf8");
  const registerAssetsSource = pluginSource.slice(
    pluginSource.indexOf("public function register_assets"),
    pluginSource.indexOf("public function render_shortcode")
  );
  const identityWrapper = element(false);
  const identityCard = element(false);
  identityCard.closest = (selector) => {
    if (selector === ".brz-wrapper") {
      return identityWrapper;
    }
    return null;
  };
  const menuColumn = element(false);
  const menuSurface = element(false);
  menuSurface.closest = (selector) =>
    selector === ".brz-columns" ? menuColumn : null;
  const document = {
    readyState: "complete",
    querySelectorAll(selector) {
      if (selector === ".xl-card") {
        return [identityCard];
      }
      if (selector === ".brz-menu-simple") {
        return [menuSurface];
      }
      return [];
    },
  };

  vm.runInNewContext(scriptSource, { document, window: {} });

  assert.equal(
    identityCard.classList.contains("calorieapp-identity-card"),
    true
  );
  assert.equal(
    identityWrapper.classList.contains("calorieapp-identity-wrapper"),
    true
  );
  assert.equal(
    menuColumn.classList.contains("calorieapp-brizy-menu-column"),
    true
  );
  assert.match(
    registerAssetsSource,
    /wp_enqueue_style\('calorieapp-identity-bridge-embed'\);[\s\S]*wp_enqueue_script\('calorieapp-identity-bridge-embed'\);/
  );
});

test("legacy Brizy exchange shortcut becomes the CalorieApp logo link", async () => {
  const scriptSource = await readFile(SCRIPT_PATH, "utf8");
  const icon = element(false);
  icon.innerHTML = '<svg class="old-exchange-icon"></svg>';
  const iconLink = element(false);
  iconLink.href =
    "https://calorietoken.net/index.php/integrated-exchange/";
  iconLink.querySelector = (selector) =>
    selector === ".brz-icon" ? icon : null;
  const textLink = element(false);
  textLink.href =
    "https://calorietoken.net/index.php/integrated-exchange/";
  textLink.querySelector = () => null;
  const slashlessIcon = element(false);
  const slashlessIconLink = element(false);
  slashlessIconLink.href =
    "https://calorietoken.net/index.php/integrated-exchange";
  slashlessIconLink.querySelector = (selector) =>
    selector === ".brz-icon" ? slashlessIcon : null;
  const unrelatedLink = element(false);
  unrelatedLink.href = "https://calorietoken.net/index.php/whitepaper/";
  unrelatedLink.querySelector = () => null;
  const parsedUrls = [];
  function TrackingURL(value, base) {
    parsedUrls.push(String(value));
    return new URL(value, base);
  }
  const document = {
    readyState: "complete",
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "a[href]") {
        return [iconLink, textLink, slashlessIconLink, unrelatedLink];
      }
      return [];
    },
  };
  const window = {
    location: {
      href: "https://calorietoken.net/index.php/whitepaper/",
      origin: "https://calorietoken.net",
    },
  };

  vm.runInNewContext(scriptSource, { document, URL: TrackingURL, window });

  assert.equal(
    iconLink.href,
    "https://calorietoken.net/index.php/calorieapp/"
  );
  assert.equal(iconLink["aria-label"], "CalorieApp");
  assert.equal(iconLink.title, "CalorieApp");
  assert.equal(
    iconLink.classList.contains("calorieapp-page-tool-link"),
    true
  );
  assert.match(icon.innerHTML, /<img class="calorieapp-page-tool-logo"/);
  assert.match(
    icon.innerHTML,
    /src="https:\/\/app\.calorietoken\.net\/logo\.png"/
  );
  assert.match(icon.innerHTML, /width="48" height="48"/);
  assert.doesNotMatch(icon.innerHTML, /<svg/);
  assert.equal(
    textLink.href,
    "https://calorietoken.net/index.php/integrated-exchange/"
  );
  assert.equal(
    slashlessIconLink.href,
    "https://calorietoken.net/index.php/calorieapp/"
  );
  assert.match(slashlessIcon.innerHTML, /<img class="calorieapp-page-tool-logo"/);
  assert.equal(parsedUrls.includes(unrelatedLink.href), false);
});

test("CalorieApp page uses the same fixed Brizy shortcut stack", async () => {
  const [styleSource, pluginSource] = await Promise.all([
    readFile(STYLE_PATH, "utf8"),
    readFile(PLUGIN_PATH, "utf8"),
  ]);

  assert.equal(
    (
      pluginSource.match(
        /class="calorieapp-page-tool-position calorieapp-page-tool-position-/g
      ) || []
    ).length,
    3
  );
  assert.match(pluginSource, /home-minimal\.svg#nc_icon/);
  assert.match(pluginSource, /square-upload\.svg#nc_icon/);
  assert.match(
    pluginSource,
    /\$calorieapp_logo_url\s*=\s*'https:\/\/app\.calorietoken\.net\/logo\.png';/
  );
  assert.match(
    pluginSource,
    /<img class="calorieapp-page-tool-logo" src="<\?php echo esc_url\(\$calorieapp_logo_url\); \?>"/
  );
  assert.match(
    pluginSource,
    /\$brizy_glyph_base_url\s*=\s*content_url\(\s*'\/plugins\/brizy\/public\/editor-build\/prod\/editor\/icons\/glyph\/'\s*\);/
  );
  assert.match(
    pluginSource,
    /href="<\?php echo esc_url\(\$brizy_glyph_base_url \. 'home-minimal\.svg#nc_icon'\); \?>"/
  );
  assert.match(
    pluginSource,
    /href="<\?php echo esc_url\(\$brizy_glyph_base_url \. 'square-upload\.svg#nc_icon'\); \?>"/
  );

  assert.match(
    styleSource,
    /\.calorieapp-page-tools\s*\{[^}]*display:\s*block;/s
  );
  assert.doesNotMatch(
    styleSource,
    /\.calorieapp-page-tools\s*\{[^}]*display:\s*contents;/s
  );

  assert.match(
    styleSource,
    /\.calorieapp-page-tool-position\s*\{[^}]*position:\s*fixed;[^}]*width:\s*30%;[^}]*right:\s*81px;[^}]*pointer-events:\s*none;/s
  );
  assert.match(
    styleSource,
    /\.calorieapp-page-tool\s*\{[^}]*pointer-events:\s*auto;/s
  );
  assert.match(
    styleSource,
    /\.calorieapp-page-tool:focus-visible\s*\{[^}]*outline:\s*3px solid rgba\(7,\s*148,\s*71,\s*0\.24\);[^}]*outline-offset:\s*2px;/s
  );
  assert.match(
    styleSource,
    /\.calorieapp-page-tool-position-home\s*\{[^}]*bottom:\s*12px;/s
  );
  assert.match(
    styleSource,
    /\.calorieapp-page-tool-position-app\s*\{[^}]*bottom:\s*66px;/s
  );
  assert.match(
    styleSource,
    /\.calorieapp-page-tool-position-top\s*\{[^}]*bottom:\s*120px;/s
  );

  const mobileRules = styleSource.slice(styleSource.indexOf("@media (max-width: 767px)"));
  assert.match(
    mobileRules,
    /\.calorieapp-page-tool-position\s*\{[^}]*right:\s*-35px;/s
  );
  assert.match(
    mobileRules,
    /\.calorieapp-page-tool-position-home\s*\{[^}]*bottom:\s*-8px;/s
  );
  assert.match(
    mobileRules,
    /\.calorieapp-page-tool-position-app\s*\{[^}]*bottom:\s*25px;/s
  );
  assert.match(
    mobileRules,
    /\.calorieapp-page-tool-position-top\s*\{[^}]*bottom:\s*60px;/s
  );
});

test("XPMarket card normalizes its legacy Brizy host without reserved height", async () => {
  const [scriptSource, styleSource] = await Promise.all([
    readFile(SCRIPT_PATH, "utf8"),
    readFile(STYLE_PATH, "utf8"),
  ]);
  const brizyWrapper = element(false);
  const shortcodeHost = element(false);
  shortcodeHost.closest = (selector) =>
    selector === ".brz-wrapper" ? brizyWrapper : null;
  const widget = element(false);
  widget.closest = (selector) =>
    selector === ".brz-wp-shortcode" ? shortcodeHost : null;
  widget.querySelector = () => null;
  const document = {
    readyState: "complete",
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (
        selector ===
        ".livecoinwatch-widget-1, [data-calorieapp-xpmarket-widget]"
      ) {
        return [widget];
      }
      return [];
    },
  };
  const window = { calorieappIdentityBridgeChrome: {} };

  vm.runInNewContext(scriptSource, { document, window });

  assert.equal(
    shortcodeHost.classList.contains("calorieapp-xpmarket-host"),
    true
  );
  assert.equal(
    brizyWrapper.classList.contains("calorieapp-xpmarket-brizy-wrapper"),
    true
  );
  assert.match(
    styleSource,
    /\.calorieapp-xpmarket-brizy-wrapper\s*\{[^}]*width:\s*100%\s*!important;[^}]*min-height:\s*0\s*!important;[^}]*height:\s*auto\s*!important;[^}]*margin:\s*0\s*!important;/s
  );
  assert.match(
    styleSource,
    /\.calorieapp-xpmarket-host\s*,[^{]*\.calorieapp-xpmarket-host\s*>\s*div\s*\{[^}]*min-height:\s*0\s*!important;[^}]*height:\s*auto\s*!important;/s
  );
  assert.doesNotMatch(
    styleSource,
    /\.calorieapp-xpmarket-widget\s*\{[^}]*min-height:\s*200px;/s
  );
  assert.doesNotMatch(
    styleSource,
    /\.calorieapp-xpmarket-link\s*\{[^}]*min-height:\s*190px;/s
  );
});

test("phase A layout contract holds at 360, 412, and 1440 px", async () => {
  const styleSource = await readFile(STYLE_PATH, "utf8");
  const block = (source, selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(new RegExp(escaped + "\\s*\\{([^}]*)\\}"));
    assert.ok(match, `Missing CSS block for ${selector}`);
    return match[1];
  };
  const number = (source, property, unit = "px") => {
    const match = source.match(
      new RegExp(property + ":\\s*(-?[0-9.]+)" + unit.replace("%", "\\%"))
    );
    assert.ok(match, `Missing ${property} in ${source}`);
    return Number(match[1]);
  };
  const closeTo = (actual, expected, label) => {
    assert.ok(
      Math.abs(actual - expected) < 0.01,
      `${label}: expected ${expected}, received ${actual}`
    );
  };

  const position = block(styleSource, ".calorieapp-page-tool-position");
  const mobileSource = styleSource.slice(
    styleSource.indexOf("@media (max-width: 767px)")
  );
  const mobilePosition = block(
    mobileSource,
    ".calorieapp-page-tool-position"
  );
  const icon = block(styleSource, ".calorieapp-brizy-tool-icon");
  const wrapperPercent = number(position, "width", "%");
  const desktopRight = number(position, "right");
  const mobileRight = number(mobilePosition, "right");
  const iconWidth = number(icon, "width");
  const marketDimensions = styleSource.match(
    /\.calorieapp-xpmarket-widget\s*\{[^}]*width:\s*min\(([0-9.]+)px,\s*calc\(100%\s*-\s*([0-9.]+)px\)\)/s
  );
  assert.ok(marketDimensions);
  const marketMaximum = Number(marketDimensions[1]);
  const marketGutter = Number(marketDimensions[2]);
  const expected = {
    360: { shortcutLeft: 317, marketLeft: 20, marketWidth: 320 },
    412: { shortcutLeft: 361.2, marketLeft: 20, marketWidth: 372 },
    1440: { shortcutLeft: 1119, marketLeft: 530, marketWidth: 380 },
  };

  for (const viewportWidth of [360, 412, 1440]) {
    const mobile = viewportWidth <= 767;
    const right = mobile ? mobileRight : desktopRight;
    const shortcutLeft =
      viewportWidth -
      right -
      (viewportWidth * wrapperPercent) / 100 / 2 -
      iconWidth / 2;
    const brizyHostWidth =
      viewportWidth >= 1200 ? 1140 : viewportWidth - 30;
    const marketWidth = Math.min(
      marketMaximum,
      brizyHostWidth - marketGutter
    );
    const marketLeft = (viewportWidth - marketWidth) / 2;

    closeTo(
      shortcutLeft,
      expected[viewportWidth].shortcutLeft,
      `${viewportWidth}px shortcut position`
    );
    closeTo(
      marketWidth,
      expected[viewportWidth].marketWidth,
      `${viewportWidth}px market width`
    );
    closeTo(
      marketLeft,
      expected[viewportWidth].marketLeft,
      `${viewportWidth}px market centring`
    );
    assert.ok(marketLeft >= 0);
    assert.ok(marketLeft + marketWidth <= viewportWidth);
  }
});

test("site chrome replaces legacy market cards with XPMarket data", async () => {
  const [scriptSource, styleSource, pluginSource] = await Promise.all([
    readFile(SCRIPT_PATH, "utf8"),
    readFile(
      new URL(
        "../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-embed.css",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(MAIN_PLUGIN_PATH, "utf8"),
  ]);

  assert.match(scriptSource, /\.livecoinwatch-widget-1/);
  assert.match(scriptSource, /calorieapp-xpmarket-widget/);
  assert.match(scriptSource, /xpMarketWidgetUrl/);
  assert.match(scriptSource, /View CAL on XPMarket/);
  assert.match(styleSource, /\.calorieapp-xpmarket-widget\s*\{/);
  assert.match(
    styleSource,
    /\.calorieapp-page-tool-logo\s*\{[\s\S]*width:\s*1em;/
  );
  assert.doesNotMatch(styleSource, /\.calorieapp-page-tool-link \.brz-icon/);
  assert.match(
    pluginSource,
    /class MarketWidget/
  );
});

test("shared footer uses the current WordPress year and translatable copy", async () => {
  const source = await readFile(PLUGIN_PATH, "utf8");

  assert.match(source, /\$copyright_year\s*=\s*wp_date\('Y'\);/);
  assert.doesNotMatch(source, /© 2026/);
  assert.match(
    source,
    /esc_html__\('Operator: ICTHendrikse · KVK 73774693'/
  );
});

test("Xaman waits for readiness and refreshes the joint account state", async () => {
  const source = await readFile(SCRIPT_PATH, "utf8");
  const appOrigin = "https://calorieapp-frontend.onrender.com";
  const windowListeners = {};
  const documentListeners = {};
  const iframePosts = [];
  const iframeWindow = { postMessage(message) { iframePosts.push(message); } };
  const iframe = element(false);
  iframe.contentWindow = iframeWindow;
  const documentElement = element(false);
  const legacyMenuColumn = element(false);
  const legacyMenuSurface = element(false);
  legacyMenuSurface.closest = (selector) =>
    selector === ".brz-columns" ? legacyMenuColumn : null;
  const legacySigninWrapper = element(false);
  const legacySigninCard = element(false);
  legacySigninCard.closest = (selector) =>
    selector === ".brz-wrapper" ? legacySigninWrapper : null;
  const legacySigninLink = element(false);
  legacySigninLink.closest = (selector) =>
    selector === ".xl-card" ? legacySigninCard : null;
  const modal = element(true);
  const status = element(false);
  const qrImage = element(true);
  const openLink = element(true);
  const retryButton = element(true);
  const closeButton = element(false);
  const siteSessionActions = element(false);
  const siteLogoutButton = element(false);
  siteLogoutButton.dataset = {
    logoutUrl:
      "https://calorietoken.net/wp-login.php?action=logout&redirect_to=calorieapp",
    idleLabel: "Sign out both",
  };
  siteLogoutButton.textContent = siteLogoutButton.dataset.idleLabel;
  const siteLogoutStatus = element(true);
  const selectors = new Map([
    [".calorieapp-embed-frame", iframe],
    [".calorieapp-login-modal", modal],
    [".calorieapp-login-status", status],
    [".calorieapp-login-qr", qrImage],
    [".calorieapp-login-open", openLink],
    [".calorieapp-login-retry", retryButton],
    [".calorieapp-login-close", closeButton],
    [".calorieapp-site-session-actions", siteSessionActions],
    [".calorieapp-site-logout", siteLogoutButton],
    [".calorieapp-site-logout-status", siteLogoutStatus],
  ]);
  const root = {
    dataset: {
      appOrigin,
      startUrl: "/start",
      finishUrl: "/finish",
      authorizeUrl: "/authorize",
      locale: "nl",
    },
    querySelector(selector) {
      return selectors.get(selector) ?? null;
    },
  };
  const document = {
    documentElement,
    hidden: false,
    readyState: "complete",
    addEventListener(type, listener) {
      documentListeners[type] = listener;
    },
    querySelectorAll(selector) {
      if (selector === '[data-calorieapp-embed]') {
        return [root];
      }
      if (selector === '.xl-card a[href*="xl-signin"]') {
        return [legacySigninLink];
      }
      if (selector === ".xl-card") {
        return [legacySigninCard];
      }
      if (selector === ".brz-menu-simple") {
        return [legacyMenuSurface];
      }
      return [];
    },
  };
  let now = 0;
  let timerId = 0;
  let assignedLocation = "";
  let reloadCount = 0;
  const timers = new Map();
  const scheduledDelays = [];
  const window = {
    addEventListener(type, listener) {
      windowListeners[type] = listener;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setTimeout(callback, delay) {
      timerId += 1;
      timers.set(timerId, { callback, delay });
      scheduledDelays.push(delay);
      return timerId;
    },
    location: {
      origin: "https://calorietoken.net",
      pathname: "/index.php/calorieapp/",
      assign(value) {
        assignedLocation = value;
      },
      reload() {
        reloadCount += 1;
      },
    },
  };
  let websocketCount = 0;
  class FakeWebSocket {
    constructor() {
      websocketCount += 1;
      lastSocket = this;
    }
    close() {}
  }
  let lastSocket = null;
  const fetchCalls = [];
  const fetchBodies = [];
  let finishCount = 0;
  let finishCanComplete = false;
  const fetch = async (url, options = {}) => {
    fetchCalls.push(url);
    fetchBodies.push(JSON.parse(options.body));
    if (url === "/start") {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          flow_id: "flow-id",
          flow_proof: "flow-proof",
          next_url: "https://xumm.app/sign/payload",
          qr_png_url: "https://xumm.app/sign/payload.png",
          websocket_url: "wss://xumm.app/sign/payload",
          locale: "nl",
        }),
      };
    }
    if (url === "/finish") {
      finishCount += 1;
      if (finishCount === 2) {
        throw new Error("synthetic transport failure");
      }
      return {
        ok: true,
        status: finishCanComplete ? 200 : 202,
        json: async () => ({
          status: finishCanComplete ? "wordpress_authenticated" : "pending",
        }),
      };
    }
    if (url === "/authorize") {
      const body = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "authorized",
          code: "authorization-code",
          state: body.state,
          locale: "nl",
        }),
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  vm.runInNewContext(source, {
    Boolean,
    Error,
    JSON,
    Number,
    Object,
    Promise,
    Date: {
      now: () => now,
      parse: Date.parse,
    },
    WebSocket: FakeWebSocket,
    document,
    fetch,
    window,
  });

  assert.equal(legacySigninCard.hidden, false);
  assert.equal(siteSessionActions.parentElement, legacySigninCard);
  assert.equal(
    legacySigninCard.classList.contains("calorieapp-identity-card"),
    true
  );
  assert.equal(
    legacySigninWrapper.classList.contains("calorieapp-identity-wrapper"),
    true
  );
  assert.equal(
    legacyMenuColumn.classList.contains("calorieapp-brizy-menu-column"),
    true
  );
  assert.equal(
    legacySigninLink["data-calorieapp-unified-login"],
    "1"
  );
  let preventedLegacyNavigation = false;
  legacySigninLink.dispatch("click", {
    preventDefault() {
      preventedLegacyNavigation = true;
    },
  });
  assert.equal(preventedLegacyNavigation, true);
  assert.equal(modal.hidden, false);
  assert.equal(
    iframePosts.filter((message) => message.type === "calorieapp:login:trigger")
      .length,
    0
  );

  windowListeners.message({
    data: { type: "calorieapp:bridge:ready", locale: "nl" },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.notEqual(iframePosts.at(-1).type, "calorieapp:login:trigger");
  windowListeners.message({
    data: { type: "calorieapp:bridge:initialized", locale: "nl" },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.equal(iframePosts.at(-1).type, "calorieapp:login:trigger");
  assert.equal(iframePosts.at(-1).locale, "nl");

  const requestId = "request-12345678";
  windowListeners.message({
    data: {
      type: "calorieapp:login:start",
      requestId,
      locale: "nl",
    },
    origin: appOrigin,
    source: iframeWindow,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(fetchCalls, []);
  windowListeners.message({
    data: {
      type: "calorieapp:login:state",
      requestId,
      state: "state-abcdefghijklmnopqrstuvwxyz-0123456789",
      locale: "nl",
    },
    origin: appOrigin,
    source: iframeWindow,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(modal.hidden, false);
  assert.equal(openLink.hidden, false);
  assert.equal(qrImage.hidden, false);
  assert.equal(openLink.href, "https://xumm.app/sign/payload");
  assert.equal(websocketCount, 1);

  windowListeners.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetchCalls, ["/start"]);

  openLink.dispatch("click");
  windowListeners.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetchCalls, ["/start"]);

  // Desktop/QR flows do not hide this page. A signed WebSocket event must start
  // WordPress completion without waiting for a visibility lifecycle event.
  lastSocket.onmessage({ data: JSON.stringify({ signed: true }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetchCalls, ["/start", "/finish"]);
  assert.match(status.textContent, /Waiting for the Xaman signature/);

  document.hidden = true;
  documentListeners.visibilitychange();
  document.hidden = false;
  documentListeners.visibilitychange();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetchCalls, ["/start", "/finish"]);
  windowListeners.focus();
  windowListeners.pageshow();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finishCount, 1);

  async function runNextTimer() {
    const next = timers.entries().next().value;
    assert.ok(next, "expected a scheduled status retry");
    const [id, timer] = next;
    timers.delete(id);
    now += timer.delay;
    timer.callback();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  }

  for (let index = 0; index < 6; index += 1) {
    await runNextTimer();
  }
  assert.deepEqual(scheduledDelays.slice(0, 7), [
    5000,
    10000,
    5000,
    5000,
    5000,
    10000,
    10000,
  ]);
  assert.equal(finishCount, 7);

  finishCanComplete = true;
  lastSocket.onmessage({ data: JSON.stringify({ signed: true }) });
  await new Promise((resolve) => setImmediate(resolve));
  await runNextTimer();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCalls.filter((url) => url === "/finish").length, 8);
  assert.equal(fetchCalls.at(-1), "/authorize");
  assert.deepEqual(fetchBodies[0], {
    locale: "nl",
    state: "state-abcdefghijklmnopqrstuvwxyz-0123456789",
  });
  assert.deepEqual(fetchBodies.at(-1), {
    flow_id: "flow-id",
    flow_proof: "flow-proof",
    state: "state-abcdefghijklmnopqrstuvwxyz-0123456789",
    locale: "nl",
  });

  windowListeners.message({
    data: {
      type: "calorieapp:login:complete",
      requestId,
      locale: "nl",
    },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.equal(modal.hidden, false);
  assert.match(status.textContent, /Signed in to WordPress and CalorieApp/);

  const closeDialog = [...timers.values()].find(({ delay }) => delay === 1400);
  assert.ok(closeDialog, "successful joint sign-in schedules the dialog close");
  closeDialog.callback();
  assert.equal(modal.hidden, true);
  assert.equal(reloadCount, 1);

  windowListeners.message({
    data: {
      type: "calorieapp:login:backend-error",
      requestId,
      message: "CalorieApp startup failed",
      locale: "nl",
    },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.equal(retryButton.hidden, false);
  assert.equal(status.textContent, "CalorieApp startup failed");

  windowListeners.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCalls.filter((url) => url === "/finish").length, 8);
  assert.equal(fetchCalls.at(-1), "/authorize");
  assert.equal(status.textContent, "CalorieApp startup failed");

  windowListeners.message({
    data: { type: "calorieapp:logout:request", locale: "nl" },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.equal(siteLogoutButton.disabled, true);
  assert.equal(siteLogoutButton.textContent, "Logging out...");
  assert.equal(iframePosts.at(-1).type, "calorieapp:logout");

  const logoutTimeoutEntry = [...timers.entries()].find(
    ([, { delay }]) => delay === 100000
  );
  assert.ok(logoutTimeoutEntry, "joint logout has a bounded response timeout");
  timers.delete(logoutTimeoutEntry[0]);
  logoutTimeoutEntry[1].callback();
  assert.equal(siteLogoutButton.disabled, false);
  assert.equal(
    siteLogoutButton.textContent,
    siteLogoutButton.dataset.idleLabel
  );
  assert.equal(siteLogoutStatus.hidden, false);
  assert.match(siteLogoutStatus.textContent, /did not respond/);

  siteLogoutButton.dispatch("click");
  assert.equal(siteLogoutButton.disabled, true);
  assert.equal(iframePosts.at(-1).type, "calorieapp:logout");

  windowListeners.message({
    data: { type: "calorieapp:logout:complete", locale: "nl" },
    origin: appOrigin,
    source: iframeWindow,
  });
  assert.equal(assignedLocation, siteLogoutButton.dataset.logoutUrl);
  assert.equal(
    [...timers.values()].filter(({ delay }) => delay === 30000).length,
    0
  );
  assert.equal(
    [...timers.values()].filter(({ delay }) => delay === 100000).length,
    0
  );
});
