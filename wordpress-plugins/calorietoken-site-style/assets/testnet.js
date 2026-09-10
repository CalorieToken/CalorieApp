/* CalorieToken — explicit, Testnet-only onboarding; GPL-2.0-or-later. */
(function () {
  'use strict';
  var cfg = window.CalorieTokenDiscovery;
  if (!cfg || !cfg.testCopy || Number(cfg.page) !== 7880 || window.CalorieTokenTestnet) return;
  var faucet = 'https://faucet.altnet.rippletest.net/accounts';
  var ledger = 'wss://s.altnet.rippletest.net:51233/';
  var panel = null, fields = [], ui = {}, locale = 'en', status = 'ready', step = 0;
  var account = null, busy = false, controller = null, cancelLedger = null, generation = 0, departed = false;
  function allowed() {
    return !departed && document.body.matches('.ctstyle-enabled.page-id-7880') &&
      !document.body.matches('.brz-ed') && !document.querySelector('.brz-ed,#brz-ed-iframe') &&
      ['https://calorietoken.net','https://www.calorietoken.net'].includes(window.location.origin) &&
      ['/index.php/calorieapp/','/calorieapp/'].includes(window.location.pathname) &&
      Array.from(new URL(window.location.href).searchParams.keys()).every(function (key) { return key === 'ui_lang'; });
  }
  function el(tag, key, cls) {
    var node = document.createElement(tag); if (cls) node.className = cls;
    if (key) { fields.push({node:node,key:key}); node.textContent = cfg.testCopy[locale][key]; }
    return node;
  }
  function button(key) { var node = el('button',key,'ctstyle-discovery-action'); node.type = 'button'; return node; }
  function render() {
    if (!panel) return;
    fields.forEach(function (entry) { entry.node.textContent = cfg.testCopy[locale][entry.key]; });
    ui.status.textContent = cfg.testCopy[locale][status];
    ui.status.hidden = status === 'ready';
    ui.create.disabled = busy || !!account || status === 'unsupported';
    ui.create.hidden = !!account;
    ui.check.disabled = busy; ui.check.hidden = !account || status === 'funded';
    ui.result.hidden = !account; panel.setAttribute('aria-busy',busy ? 'true' : 'false');
    ui.copySeed.disabled = !account; ui.show.disabled = !account;
    ui.progress.textContent = (step + 1) + ' / 4';
    ui.start.hidden = !!account;
    ui.steps.forEach(function (node,index) { node.hidden = step !== index + 1; });
    ui.previous.hidden = step <= 1;
    ui.next.hidden = step < 1 || step >= 3;
  }
  function go(next) {
    if (!allowed() || !account || next < 1 || next > 3) return;
    step = next;
    // Hide recovery data whenever leaving its step; it remains only in memory.
    ui.secret.textContent = ''; ui.secret.hidden = true; ui.show.setAttribute('aria-expanded','false');
    render(); ui.steps[step - 1].querySelector('h3').focus({preventScroll:true});
  }
  function verify(address) {
    return new Promise(function (resolve, reject) {
      var socket, done = false, timer;
      function finish(ok) {
        if (done) return; done = true; window.clearTimeout(timer); cancelLedger = null;
        if (socket) { socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null; try { socket.close(); } catch (_) {} }
        if (ok) resolve(); else reject(new Error('verification-unavailable'));
      }
      cancelLedger = function () { finish(false); };
      timer = window.setTimeout(function () { finish(false); },15000);
      try {
        socket = new window.WebSocket(ledger);
        socket.onopen = function () {
          socket.send(JSON.stringify({id:1,command:'account_info',account:address,ledger_index:'validated',strict:true}));
        };
        socket.onmessage = function (event) {
          var data; try { data = JSON.parse(event.data); } catch (_) { finish(false); return; }
          if (data.id !== 1) return;
          var result = data.result, info = result && result.account_data;
          finish(data.status === 'success' && result.validated === true && info && info.Account === address &&
            typeof info.Balance === 'string' && /^[0-9]{1,18}$/.test(info.Balance) && Number(info.Balance) > 0);
        };
        socket.onerror = socket.onclose = function () { finish(false); };
      } catch (_) { finish(false); }
    });
  }
  async function check() {
    if (!allowed() || busy || !account) return;
    var current = generation, address = account.address;
    busy = true; status = 'checking'; render();
    try { await verify(address); if (current === generation && allowed()) status = 'funded'; }
    catch (_) { if (current === generation && allowed()) status = 'pending'; }
    finally { if (current === generation && allowed()) { busy = false; render(); } }
  }
  async function create() {
    if (!allowed() || busy || account || !panel.isConnected) return;
    if (typeof window.fetch !== 'function' || typeof window.AbortController !== 'function' || typeof window.WebSocket !== 'function') {
      status = 'unsupported'; render(); return;
    }
    var current = generation, timeout, response, request = new window.AbortController();
    busy = true; status = 'creating'; render(); controller = request;
    try {
      timeout = window.setTimeout(function () { request.abort(); },25000);
      // No destination supplied: the official faucet creates a fresh TESTNET wallet.
      // Its secret is returned to this browser, never to WordPress or the CalorieApp.
      response = await window.fetch(faucet,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
        redirect:'error',referrerPolicy:'no-referrer',signal:request.signal,
        headers:{'Content-Type':'application/json'},body:JSON.stringify({userAgent:'CalorieToken-Testnet',usageContext:'CalorieApp test account'})});
      if (current !== generation || !allowed()) return;
      if (!response.ok) { status = response.status === 429 ? 'limited' : 'failed'; return; }
      if (!(response.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) { status = 'failed'; return; }
      var data = await response.json(), wallet = data && data.account;
      if (current !== generation || !allowed()) return;
      var address = wallet && (wallet.classicAddress || wallet.address), secret = wallet && wallet.secret;
      // Schema checks only; the official Testnet ledger independently verifies funding below.
      if (typeof address !== 'string' || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address) ||
          typeof secret !== 'string' || !/^s[1-9A-HJ-NP-Za-km-z]{20,34}$/.test(secret)) { status = 'failed'; return; }
      if (current !== generation || !allowed()) return;
      account = {address:address,secret:secret};
      step = 1;
      ui.address.textContent = address; status = 'created';
    } catch (_) { if (current === generation && allowed()) status = 'failed'; }
    finally {
      window.clearTimeout(timeout); if (controller === request) controller = null;
      if (current === generation && allowed()) { busy = false; render(); }
    }
    if (current === generation && account && allowed()) await check();
  }
  async function copy(kind) {
    if (!allowed() || !account) return;
    var current = generation, value = kind === 'secret' ? account.secret : account.address;
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(value);
      if (current === generation && allowed()) ui.copyStatus.textContent = cfg.testCopy[locale].copied;
    } catch (_) {
      if (current !== generation || !allowed()) return;
      if (kind === 'secret') { ui.secret.textContent = account.secret; ui.secret.hidden = false; ui.show.setAttribute('aria-expanded','true'); }
      ui.copyStatus.textContent = cfg.testCopy[locale].manualCopy;
    }
  }
  function mount() {
    if (!allowed() || panel) return;
    var roots = document.querySelectorAll('#ctstyle-testnet[data-ctstyle-testnet="1"]');
    if (roots.length !== 1 || roots[0].closest('form,[data-calorieapp-embed],[contenteditable],[hidden],[inert]')) return;
    var root = roots[0], help = root.querySelector('.ctstyle-test-steps'); if (!help) return;
    panel = el('div',null,'ctstyle-testnet-create'); panel.id = 'ctstyle-testnet-create';
    ui.progress = el('p',null,'ctstyle-testnet-progress'); ui.progress.setAttribute('aria-live','polite');
    ui.start = el('div',null,'ctstyle-testnet-welcome'); ui.start.append(el('h3','stepCreate'),el('p','ready'));
    ui.create = button('create'); ui.create.id = 'ctstyle-testnet-create-button'; ui.create.addEventListener('click',create);
    ui.status = el('p',null,'ctstyle-discovery-status'); ui.status.setAttribute('role','status'); ui.status.setAttribute('aria-live','polite');
    ui.result = el('div',null,'ctstyle-testnet-result'); ui.result.hidden = true;
    ui.address = el('code'); ui.address.dir = 'ltr'; ui.address.id = 'ctstyle-testnet-address';
    ui.secret = el('code'); ui.secret.dir = 'ltr'; ui.secret.hidden = true; ui.secret.id = 'ctstyle-testnet-secret';
    // No user secret input, hidden input, automatic storage, logging, or account data in links/messages.
    ui.show = button('show'); ui.show.setAttribute('aria-controls',ui.secret.id); ui.show.setAttribute('aria-expanded','false');
    ui.show.addEventListener('click',function () {
      if (!allowed() || !account) return;
      ui.secret.hidden = !ui.secret.hidden; ui.secret.textContent = ui.secret.hidden ? '' : account.secret;
      ui.show.setAttribute('aria-expanded',ui.secret.hidden ? 'false' : 'true');
    });
    ui.copySeed = button('copySeed'); ui.copySeed.addEventListener('click',function () { copy('secret'); });
    var copyAddress = button('copyAddress'); copyAddress.addEventListener('click',function () { copy('address'); });
    ui.copyStatus = el('p'); ui.copyStatus.setAttribute('role','status');
    ui.check = button('check'); ui.check.addEventListener('click',check);
    ui.steps = ['stepNetwork','stepImport','stepReturn'].map(function (key,index) {
      var part = el('div',null,'ctstyle-testnet-step'); part.id = 'ctstyle-testnet-step-' + (index + 2);
      var heading = el('h3',key); heading.tabIndex = -1; part.append(heading); return part;
    });
    var networkHelp = el('a','networkHelp','ctstyle-discovery-action');
    networkHelp.href = 'https://help.xaman.app/app/learning-more-about-xaman/how-to-access-testnet-on-xrp-ledger';
    networkHelp.target = '_blank'; networkHelp.rel = 'noopener noreferrer';
    ui.steps[0].append(el('p','import1'),networkHelp);
    var importHelp = el('a','importHelp','ctstyle-discovery-action');
    importHelp.href = 'https://help.xaman.app/app/getting-started-with-xaman/importing-your-account/...with-a-family-seed';
    importHelp.target = '_blank'; importHelp.rel = 'noopener noreferrer';
    var back = button('back'); back.addEventListener('click',function () {
      var app = document.querySelector('[data-calorieapp-embed]');
      if (app && typeof app.scrollIntoView === 'function') app.scrollIntoView({block:'start',behavior:'auto'});
      else window.scrollTo({top:0,behavior:'auto'});
    });
    ui.steps[1].append(el('p','import2'),ui.copySeed,ui.show,ui.secret,ui.copyStatus,el('p','testOnly','ctstyle-discovery-small'),importHelp);
    ui.steps[2].append(el('p','import3'),el('p','account'),ui.address,copyAddress,back,el('p','pilotScope','ctstyle-discovery-small'));
    ui.previous = button('previous'); ui.previous.addEventListener('click',function () { go(step-1); });
    ui.next = button('next'); ui.next.addEventListener('click',function () { go(step+1); });
    var navigation = el('div',null,'ctstyle-testnet-navigation'); navigation.append(ui.previous,ui.next);
    ui.result.append(ui.check); ui.steps.forEach(function (part) { ui.result.append(part); }); ui.result.append(navigation);
    var privacy = el('details',null,'ctstyle-testnet-help'); privacy.append(el('summary','aboutAccount'),el('p','privacy'));
    panel.append(ui.progress,ui.start,ui.create,ui.status,ui.result,privacy);
    var official = el('a','official','ctstyle-discovery-action'); official.href = 'https://xrpl.org/resources/dev-tools/xrp-faucets';
    official.target = '_blank'; official.rel = 'noopener noreferrer'; panel.append(official);
    help.before(panel); render();
  }
  function refresh(tag) {
    if (!allowed()) return;
    if (cfg.testCopy[tag]) locale = tag;
    else if (!panel) {
      var root = document.getElementById('ctstyle-testnet'), initial = (root && root.lang) || document.documentElement.lang;
      if (cfg.testCopy[initial]) locale = initial;
    }
    mount(); render();
  }
  function clear() {
    departed = true; generation += 1;
    if (controller) controller.abort(); if (cancelLedger) cancelLedger();
    account = null; busy = false; status = 'ready'; step = 0;
    if (panel) { ui.address.textContent = ''; ui.secret.textContent = ''; ui.secret.hidden = true; ui.show.setAttribute('aria-expanded','false'); ui.copyStatus.textContent = ''; render(); }
  }
  window.CalorieTokenTestnet = {refresh:refresh};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',function () { refresh(); },{once:true}); else refresh();
  window.addEventListener('load',function () { refresh(); },{once:true});
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',function () { departed = false; refresh(); });
})();
