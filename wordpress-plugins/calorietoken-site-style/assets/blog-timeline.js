/* CalorieToken Site Style — official profile timeline; existing consent remains authoritative. */
(function () {
  'use strict';
  if (window.CalorieTokenBlogTimeline) return;
  var source = 'https://platform.twitter.com/widgets.js', panel = null, anchor = null;
  var attempted = false, managed = false, scriptRequested = false, watcher = null, timer = null;
  var generation = 0, retryAt = 0;
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
  function finishLoading() {
    if (timer) { window.clearTimeout(timer); timer = null; }
    if (panel && panel.classList.contains('ctstyle-x-loading')) {
      panel.classList.remove('ctstyle-x-loading');
      document.dispatchEvent(new window.Event('calorietoken:x-state'));
    }
  }
  function stopWatching() {
    if (watcher) { watcher.disconnect(); watcher = null; }
    finishLoading();
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
    var ready=consent() && frames().some(function (frame) {
      var style=window.getComputedStyle(frame),box=frame.getBoundingClientRect();
      return !frame.hidden && !frame.closest('.cmplz-blocked-content-container,[hidden],[inert]') &&
        style.display!=='none' && style.visibility!=='hidden' && box.width>0 && box.height>0;
    });
    // The helper updates hidden attributes inside this observed panel. Emit
    // only a changed state so those updates cannot feed back into themselves.
    if (panel.classList.contains('ctstyle-x-ready') === ready) return;
    panel.classList.toggle('ctstyle-x-ready',ready);
    document.dispatchEvent(new window.Event('calorietoken:x-state'));
  }
  function watch() {
    if (!watcher) {watcher=new MutationObserver(inspect);watcher.observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['src','style','width','height','hidden']});}
  }
  function revoke() {
    if (!managed) return;
    generation++;
    collectFrames();
    ownedFrames.forEach(function (frame) { frame.remove(); }); ownedFrames.clear();
    if (anchor && anchor.isConnected && anchor.style.display === 'none') {
      if (anchorStyle === null) anchor.removeAttribute('style'); else anchor.setAttribute('style', anchorStyle);
    }
    if (anchor && scriptRequested) anchor.classList.remove('twitter-timeline');
    attempted = false;
    finishLoading();
    // Watch only this small panel, including late results of an already-started request.
  }
  function usePanel(next) {
    if (next === panel) return;
    generation++;
    stopWatching();
    // Retire only output created by this controller. Existing CMS/CMP frames
    // retain their original owner, including in a detached former panel.
    revoke();
    if (panel) panel.classList.remove('ctstyle-x-ready');
    panel = next; anchor = null; attempted = false; managed = false;
    originalFrames = new Set(); ownedFrames = new Set(); anchorStyle = null;
  }
  function inspect() {
    if (managed) collectFrames();
    if (!consent()) { revoke(); status(); return; }
    if (ownedFrames.size && panel) finishLoading();
    status();
  }
  function render() {
    if (!allowed() || !consent() || !panel || !panel.isConnected || panel.closest(protectedRoot) || attempted ||
        !window.twttr || !window.twttr.widgets || typeof window.twttr.widgets.load !== 'function') return;
    if (frames().length) {status();return;} // The CMS already rendered this timeline.
    attempted = true; managed = true;
    // A CMS replacement may arrive after our one shared SDK request. Keep its
    // anchor discoverable when consent withdrawal removes the provider hook.
    anchor.setAttribute('data-ctstyle-x-anchor', '');
    anchor.classList.add('twitter-timeline'); anchorStyle = anchor.getAttribute('style');
    originalFrames = new Set(panel.querySelectorAll('iframe'));
    panel.classList.add('ctstyle-x-loading');
    stopWatching(); panel.classList.add('ctstyle-x-loading');
    watch();
    var requestGeneration = ++generation, requestPanel = panel;
    function current() { return requestGeneration === generation && requestPanel === panel; }
    timer = window.setTimeout(function () { if (current()) { inspect(); finishLoading(); } }, 12000);
    try {
      var result = window.twttr.widgets.load(panel);
      if (result && typeof result.then === 'function') result.then(
        function () { if (current()) inspect(); },
        function () { if (current()) finishLoading(); }
      );
    } catch (_) { if (current()) finishLoading(); }
    // A failed render must not disable consent cleanup for late provider output.
  }
  function refresh() {
    if (!allowed()) { usePanel(null); return; }
    var matches = document.querySelectorAll('[data-brz-custom-id="amfuxnhsfmkknesyuldlbdorcvqsardaetus"].brz-wp-shortcode');
    var next = matches.length === 1 && !matches[0].closest(protectedRoot) &&
        !matches[0].querySelector('form,input,textarea,select,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed]') ? matches[0] : null;
    usePanel(next);
    if (!panel) return;
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
    script.addEventListener('error',function(){script.setAttribute('data-ctstyle-x-failed','');finishLoading();},{once:true});
    document.head.appendChild(script);
  }
  function retry() {
    if(!allowed()||!consent()||!panel||!panel.isConnected||Date.now()<retryAt)return;
    retryAt=Date.now()+15000;
    // Only an explicit user retry; no timer or observer retries a provider call.
    // A pre-existing CMS frame remains owned by the CMS/CMP.
    if(frames().some(function(frame){return originalFrames.has(frame);}))return;
    revoke();attempted=false;
    var failed=document.querySelector('script[data-ctstyle-x-script][data-ctstyle-x-failed]');
    if(failed){failed.remove();scriptRequested=false;}
    refresh();
  }
  window.CalorieTokenBlogTimeline = {refresh: refresh,retry:retry};
  // Complianz inserts its button inside the profile anchor. Keep the native
  // consent handler, but prevent that click from also navigating away to X.
  document.addEventListener('click', function (event) {
    if (!allowed() || !(event.target instanceof window.Element)) return;
    var button = event.target.closest('button.cmplz-accept-service[data-service="twitter"]');
    var link = button && button.closest('a.twitter-timeline,a[data-ctstyle-x-anchor]');
    if (link && profile(link) && link.closest('[data-brz-custom-id="amfuxnhsfmkknesyuldlbdorcvqsardaetus"]')) {
      event.preventDefault();
      window.setTimeout(refresh, 0);
    }
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, {once: true}); else refresh();
  window.addEventListener('load', refresh, {once: true});
  ['cmplz_cookie_warning_loaded', 'cmplz_status_change', 'cmplz_status_change_service','cmplz_service_status_change','cmplz_enable_service','cmplz_enable_category'].forEach(function (name) {
    document.addEventListener(name, function () { refresh(); window.setTimeout(refresh, 0); });
  });
  document.addEventListener('cmplz_revoke', function () {revoke();status();});
  window.addEventListener('pagehide', stopWatching);
  window.addEventListener('pageshow', refresh);
})();
