(function () {
  'use strict';
  var config = window.CalorieAppAccountProfile;
  if (!config || window.__calorieProfileWidget) return;
  window.__calorieProfileWidget = true;
  var endpoint, accountUrl;
  try {
    endpoint = new URL(config.endpoint, location.href);
    accountUrl = new URL(config.accountUrl, location.href);
    if (endpoint.origin !== location.origin || accountUrl.origin !== location.origin) return;
    endpoint.searchParams.set('action', 'calorieapp_profile');
  } catch (_) { return; }
  var nickname = null, generation = 0, pending = null, lastRefresh = 0;
  function render() {
    document.querySelectorAll('.xl-card').forEach(function (card) {
      var name = card.querySelector('[data-calorieapp-nickname]');
      if (!nickname || card.classList.contains('xl-no-wallet')) {
        if (name) name.remove();
        return;
      }
      if (!name) {
        name = document.createElement('a');
        name.setAttribute('data-calorieapp-nickname', '');
        name.className = 'calorieapp-profile-name';
        name.dir = 'auto';
        name.href = accountUrl.href;
        var body = card.querySelector('.xl-card-body') || card;
        body.insertBefore(name, body.firstChild);
      }
      if (name.textContent !== nickname) name.textContent = nickname;
    });
  }
  function clear() {
    generation += 1;
    if (pending) pending.abort();
    pending = null; nickname = null; render();
  }
  async function refresh(force) {
    if (!force && Date.now() - lastRefresh < 30000) return;
    clear();
    lastRefresh = Date.now();
    var revision = generation, controller = new AbortController();
    pending = controller;
    var deadline = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch(endpoint.href, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { 'X-CalorieApp-Request': 'account-profile-widget' } });
      if (!response.ok) return;
      var data = await response.json();
      if (revision !== generation || controller.signal.aborted) return;
      var value = data.nickname;
      if (typeof value === 'string' && Array.from(value).length >= 2 && Array.from(value).length <= 32 && !/[\u0000-\u001f\u007f-\u009f<>\u202a-\u202e\u2066-\u2069]/u.test(value)) nickname = value;
      render();
    } catch (_) { /* The existing widget stays usable when profiles are unavailable. */ }
    finally { clearTimeout(deadline); if (pending === controller) pending = null; }
  }
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('.xl-card a[href],.xl-card button') : null;
    if (target && (/xl-logout|action=logout/.test(target.getAttribute('href') || '') || target.matches('[data-calorieapp-logout],.calorieapp-site-logout'))) clear();
  }, true);
  window.addEventListener('message', function (event) {
    if (!event.data || !['calorieapp:profile:changed', 'calorieapp:session:state'].includes(event.data.type) || event.data.version !== 1) return;
    var trusted = Array.from(document.querySelectorAll('[data-calorieapp-embed] iframe')).some(function (frame) {
      try { var url = new URL(frame.src); return url.origin === 'https://app.calorietoken.net' && event.origin === url.origin && event.source === frame.contentWindow; } catch (_) { return false; }
    });
    if (!trusted) return;
    if (event.data.type === 'calorieapp:session:state' && event.data.status !== 'authenticated') clear();
    else refresh(true);
  });
  var observer = new MutationObserver(function (records) {
    if (records.some(function (record) { return !record.target.closest || !record.target.closest('[data-calorieapp-nickname]'); })) render();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('pagehide', function () { clear(); observer.disconnect(); });
  window.addEventListener('pageshow', function (event) { if (event.persisted) { observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); refresh(true); } });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') clear(); else refresh(true); });
  refresh(true);
}());
