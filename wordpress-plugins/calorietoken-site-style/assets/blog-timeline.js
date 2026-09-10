/* CalorieToken Site Style — official profile timeline; existing consent remains authoritative. */
(function () {
  'use strict';
  if (window.CalorieTokenBlogTimeline) return;
  var source = 'https://platform.twitter.com/widgets.js', panel = null, anchor = null;
  var attempted = false, managed = false, scriptRequested = false, watcher = null, timer = null;
  var originalFrames = new Set(), ownedFrames = new Set(), anchorStyle = null;
  var protectedRoot = 'form,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],.cmplz-blocked-content-container,[hidden],[inert]';
  function allowed() {
    if (!document.body || !document.body.matches('.ctstyle-enabled.page-id-1207') ||
        document.body.matches('.home,.brz-ed') || document.querySelector('.brz-ed,#brz-ed-iframe')) return false;
    var url = new URL(window.location.href);
    return ['https://calorietoken.net', 'https://www.calorietoken.net'].includes(url.origin) &&
      ['/index.php/blog/', '/blog/'].includes(url.pathname) &&
      !Array.from(url.searchParams.keys()).some(function (key) { return key !== 'ui_lang'; });
  }
  function consent() {
    try { return typeof window.cmplz_has_service_consent === 'function' && window.cmplz_has_service_consent('twitter') === true; }
    catch (_) { return false; }
  }
  function profile(link) {
    try {
      var url = new URL(link.getAttribute('href'));
      return link.tagName === 'A' && url.protocol === 'https:' && !url.username && !url.password &&
        /^(www\.)?(twitter\.com|x\.com)$/.test(url.hostname) && /^\/CalorieToken\/?$/i.test(url.pathname);
    } catch (_) { return false; }
  }
  function providerFrame(frame) {
    try {
      var url = new URL(frame.getAttribute('src'));
      return url.protocol === 'https:' && url.hostname === 'syndication.twitter.com' && /^\/srv\/timeline-profile\//.test(url.pathname) ||
        url.protocol === 'https:' && url.hostname === 'platform.twitter.com' && /^\/embed\//.test(url.pathname);
    } catch (_) { return false; }
  }
  function stopWatching() {
    if (watcher) { watcher.disconnect(); watcher = null; }
    if (timer) { window.clearTimeout(timer); timer = null; }
    if (panel) panel.classList.remove('ctstyle-x-loading');
  }
  function collectFrames() {
    if (!panel || !panel.isConnected) return;
    panel.querySelectorAll('iframe').forEach(function (frame) {
      if (!originalFrames.has(frame) && providerFrame(frame)) ownedFrames.add(frame);
    });
  }
  function frames() {return panel ? Array.from(panel.querySelectorAll('iframe')).filter(providerFrame) : [];}
  function status() {
    if (!panel) return;
    var ready=frames().some(function (frame) {var style=window.getComputedStyle(frame);return !frame.hidden && style.display!=='none' && style.visibility!=='hidden';});
    panel.classList.toggle('ctstyle-x-ready',ready);
    document.dispatchEvent(new window.Event('calorietoken:x-state'));
  }
  function watch() {
    if (!watcher) {watcher=new MutationObserver(inspect);watcher.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['src','style']});}
  }
  function revoke() {
    if (!managed) return;
    collectFrames();
    ownedFrames.forEach(function (frame) { frame.remove(); }); ownedFrames.clear();
    if (anchor && anchor.isConnected && anchor.style.display === 'none') {
      if (anchorStyle === null) anchor.removeAttribute('style'); else anchor.setAttribute('style', anchorStyle);
    }
    if (anchor && scriptRequested) anchor.classList.remove('twitter-timeline');
    attempted = false;
    if (panel) panel.classList.remove('ctstyle-x-loading');
    // Watch only this small panel, including late results of an already-started request.
  }
  function inspect() {
    if (managed) collectFrames();
    if (!consent()) { revoke(); status(); return; }
    if (ownedFrames.size && panel) panel.classList.remove('ctstyle-x-loading');
    status();
  }
  function render() {
    if (!allowed() || !consent() || !panel || !panel.isConnected || panel.closest(protectedRoot) || attempted ||
        !window.twttr || !window.twttr.widgets || typeof window.twttr.widgets.load !== 'function') return;
    if (frames().length) {status();return;} // The CMS already rendered this timeline.
    attempted = true; managed = true; anchor.classList.add('twitter-timeline'); anchorStyle = anchor.getAttribute('style');
    originalFrames = new Set(panel.querySelectorAll('iframe'));
    panel.classList.add('ctstyle-x-loading');
    stopWatching(); panel.classList.add('ctstyle-x-loading');
    watch();
    timer = window.setTimeout(function () { inspect(); panel.classList.remove('ctstyle-x-loading'); timer = null; }, 12000);
    try {
      var result = window.twttr.widgets.load(panel);
      if (result && typeof result.then === 'function') result.then(inspect, stopWatching);
    } catch (_) { stopWatching(); }
  }
  function refresh() {
    if (!allowed()) return;
    var matches = document.querySelectorAll('[data-brz-custom-id="amfuxnhsfmkknesyuldlbdorcvqsardaetus"].brz-wp-shortcode');
    if (matches.length !== 1 || matches[0].closest(protectedRoot) ||
        matches[0].querySelector('form,input,textarea,select,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed]')) return;
    panel = matches[0];
    if (frames().length && !managed) {panel.classList.add('ctstyle-x-timeline');watch();status();return;}
    var anchors = Array.from(panel.querySelectorAll('a.twitter-timeline,a[data-ctstyle-x-anchor]'));
    if (anchors.length !== 1 || !profile(anchors[0])) return;
    anchor = anchors[0];
    panel.classList.add('ctstyle-x-timeline');watch();status();
    if (anchor.childNodes.length === 1 && anchor.childNodes[0].nodeType === 3 && /^Tweets by\s+@?CalorieToken$/i.test(anchor.textContent.trim())) {
      anchor.textContent = 'Posts by CalorieToken';
    }
    anchor.setAttribute('data-height', '520'); anchor.removeAttribute('data-width'); anchor.setAttribute('data-dnt', 'true');
    anchor.removeAttribute('data-tweet-limit');
    if (anchor.hasAttribute('data-chrome')) anchor.setAttribute('data-chrome', anchor.getAttribute('data-chrome').split(/\s+/).filter(function (part) { return part !== 'noscrollbar'; }).join(' '));
    panel.classList.add('ctstyle-x-timeline');
    if (!consent()) { if (attempted) revoke(); return; }
    if (window.twttr && window.twttr.widgets) { render(); return; }
    var active = Array.from(document.querySelectorAll('script[src]')).find(function (script) {
      return script.getAttribute('src') === source && (!script.type || /^(application|text)\/javascript$/.test(script.type));
    });
    if (active) { if (!active.dataset.ctstyleTimelineListener) { active.dataset.ctstyleTimelineListener = '1'; active.addEventListener('load', render, {once: true}); } return; }
    // If Complianz has an inert script, its own loader owns activation.
    if (document.querySelector('script[type="text/plain"][data-service="twitter"]') || scriptRequested) return;
    scriptRequested = true; managed = true;
    // Prevent the library's automatic scan; render() restores the hook only after a fresh consent check.
    anchor.setAttribute('data-ctstyle-x-anchor', ''); anchor.classList.remove('twitter-timeline');
    var script = document.createElement('script'); script.src = source; script.async = true;
    script.setAttribute('data-ctstyle-x-script', ''); script.addEventListener('load', render, {once: true});
    document.head.appendChild(script);
  }
  window.CalorieTokenBlogTimeline = {refresh: refresh};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, {once: true}); else refresh();
  window.addEventListener('load', refresh, {once: true});
  ['cmplz_cookie_warning_loaded', 'cmplz_status_change', 'cmplz_status_change_service','cmplz_service_status_change','cmplz_enable_service','cmplz_enable_category'].forEach(function (name) {
    document.addEventListener(name, function () { refresh(); window.setTimeout(refresh, 0); });
  });
  document.addEventListener('cmplz_revoke', function () {revoke();status();});
  window.addEventListener('pagehide', stopWatching);
  window.addEventListener('pageshow', refresh);
})();
