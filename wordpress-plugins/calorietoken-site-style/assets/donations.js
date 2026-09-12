/* Cumulative donation total and separate wallet balance. No visitor tracking. */
(function () {
  'use strict';
  var cfg = window.CalorieTokenDonations;
  var root = document.getElementById('ctstyle-donation-balance');
  if (!cfg || !root || !document.body.matches('.ctstyle-enabled.page-id-6897') ||
      document.querySelector('.brz-ed,#brz-ed-iframe,[contenteditable="true"]') ||
      /\/wp-admin\//.test(window.location.pathname) || window.CalorieTokenDonationBalance) return;
  var endpoint;
  try { endpoint = new URL(cfg.endpoint, window.location.href); } catch (_) { return; }
  if (endpoint.origin !== window.location.origin) return;
  var locale = 'en', latest = null, failed = false, busy = false, timer = null, controller = null;
  var stopped = false, lastRequest = 0, interval = 60000;
  var amount = root.querySelector('[data-donation-amount]'), status = root.querySelector('[data-donation-status]');
  var updated = root.querySelector('[data-donation-time]'), ledger = root.querySelector('[data-donation-ledger]');
  function chooseLocale(value) {
    var tag = String(value || '').replace(/_/g, '-');
    return cfg.copy[tag] ? tag : (cfg.copy[tag.split('-')[0]] ? tag.split('-')[0] : 'en');
  }
  function formatDrops(drops) {
    // Split before formatting so large balances never lose a drop to floating
    // point rounding. Localize integer and fractional digits separately.
    var padded = drops.padStart(7, '0');
    var whole = padded.slice(0, -6), fraction = padded.slice(-6).replace(/0+$/, '');
    fraction = fraction.padEnd(2, '0');
    var nf = new Intl.NumberFormat(locale, {maximumFractionDigits: 0});
    var decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find(function (p) { return p.type === 'decimal'; }).value;
    return nf.format(BigInt(whole)) + decimal + fraction.split('').map(function (d) { return nf.format(Number(d)); }).join('');
  }
  function render() {
    var copy = cfg.copy[locale];
    root.lang = locale; root.dir = ['ar', 'ur'].includes(locale) ? 'rtl' : 'ltr';
    root.querySelectorAll('[data-donation-copy]').forEach(function (el) {
      var text = copy[el.dataset.donationCopy];
      if (el.textContent !== text) {
        el.textContent = text;
        if (el.tagName === 'H2' && window.CalorieTokenPresentationUI) window.CalorieTokenPresentationUI.paintHeading(el);
      }
    });
    amount.textContent = latest ? formatDrops(latest.totalDrops) : '—';
    var stale = latest && (failed || latest.donationsStatus !== 'current' || Date.now() / 1000 - latest.donationsCheckedAt >= 900);
    var state = latest ? (stale ? 'stale' : 'current') : (failed ? 'unavailable' : 'loading');
    root.dataset.state = state;
    status.textContent = copy[state];
    if (latest) {
      var date = new Date((latest.donationsCheckedAt || latest.baselineAt) * 1000);
      updated.dateTime = date.toISOString();
      updated.textContent = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'medium'}).format(date);
      ledger.textContent = latest.ledgerIndex ? new Intl.NumberFormat(locale, {useGrouping: false}).format(latest.ledgerIndex) : '—';
      [['opening',latest.startingDrops],['added',latest.newDonationDrops],['wallet-amount',latest.balanceDrops]].forEach(function (item) {
        var el = root.querySelector('[data-donation-' + item[0] + ']');
        if (el) el.textContent = item[1] === null ? '—' : formatDrops(item[1]);
      });
      var walletTime = root.querySelector('[data-donation-wallet-time]');
      var baselineTime = root.querySelector('[data-donation-baseline-time]');
      if (baselineTime) baselineTime.textContent = new Intl.DateTimeFormat(locale, {dateStyle:'medium',timeStyle:'long',timeZone:'UTC'}).format(new Date(latest.baselineAt * 1000));
      if (walletTime) {
        walletTime.textContent = latest.checkedAt ? new Intl.DateTimeFormat(locale, {dateStyle:'medium',timeStyle:'medium'}).format(new Date(latest.checkedAt * 1000)) : '—';
        if (latest.checkedAt) walletTime.dateTime = new Date(latest.checkedAt * 1000).toISOString();
        else walletTime.removeAttribute('datetime');
      }
    } else { updated.removeAttribute('datetime'); updated.textContent = '—'; ledger.textContent = '—'; }
  }
  function valid(data) {
    if (!data || data.wallet !== cfg.wallet || data.network !== 'mainnet' || data.cumulative !== true ||
        data.startingDrops !== '401268984' || data.baselineLedger !== 106938803 || data.baselineAt !== 1789231051 ||
        !['current','stale'].includes(data.donationsStatus) || !Number.isSafeInteger(data.donationsCheckedAt) ||
        data.donationsCheckedAt < 0 || data.donationsCheckedAt > Date.now()/1000 + 30 ||
        ![data.totalDrops,data.newDonationDrops].every(function(n){return typeof n === 'string' && /^(0|[1-9][0-9]{0,29})$/.test(n);}) ||
        BigInt(data.totalDrops) !== BigInt(data.startingDrops) + BigInt(data.newDonationDrops) ||
        (latest && BigInt(data.totalDrops) < BigInt(latest.totalDrops))) return false;
    // The permanent total remains usable when the independent wallet lookup fails.
    return (data.balanceDrops === null && data.validated === false && data.checkedAt === null && data.ledgerIndex === null) ||
      (data.validated === true && ['current','stale'].includes(data.status) && typeof data.balanceDrops === 'string' &&
      /^(0|[1-9][0-9]{0,17})$/.test(data.balanceDrops) && BigInt(data.balanceDrops) <= 100000000000000000n &&
      Number.isSafeInteger(data.ledgerIndex) && data.ledgerIndex >= data.baselineLedger && Number.isSafeInteger(data.checkedAt) &&
      data.checkedAt > 0 && data.checkedAt <= Math.floor(Date.now() / 1000) + 30 && Date.now() / 1000 - data.checkedAt < 86400);
  }
  function schedule() {
    window.clearTimeout(timer); timer = null;
    if (!stopped && !document.hidden) timer = window.setTimeout(refresh, interval);
  }
  async function refresh() {
    if (stopped || document.hidden || busy) return;
    if (Date.now() - lastRequest < interval) { render(); schedule(); return; }
    lastRequest = Date.now(); busy = true; root.setAttribute('aria-busy', 'true');
    controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await window.fetch(endpoint.href, {credentials: 'omit', headers: {Accept: 'application/json'}, signal: controller.signal});
      var data = await response.json();
      if (!response.ok || !valid(data)) throw new Error('Balance unavailable');
      latest = data; failed = false;
    } catch (_) { failed = true; }
    finally {
      window.clearTimeout(timeout); busy = false; controller = null;
      root.removeAttribute('aria-busy');
      if (latest && latest.checkedAt && Date.now() / 1000 - latest.checkedAt >= 86400) {
        latest.balanceDrops = null; latest.checkedAt = null; latest.ledgerIndex = null; latest.validated = false;
      }
      render(); schedule();
    }
  }
  function setLocale(value) { locale = chooseLocale(value); render(); }
  window.CalorieTokenDonationBalance = {setLocale: setLocale};
  setLocale(window.CalorieTokenContentLanguageUI?.getLocale() || new URL(window.location.href).searchParams.get('ui_lang') || document.documentElement.lang);
  document.addEventListener('calorietoken:display-language', function (event) { setLocale(event.detail && event.detail.locale); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { window.clearTimeout(timer); timer = null; }
    else refresh();
  });
  window.addEventListener('pagehide', function () { stopped = true; window.clearTimeout(timer); if (controller) controller.abort(); });
  window.addEventListener('pageshow', function () { stopped = false; refresh(); });
  refresh();
})();
