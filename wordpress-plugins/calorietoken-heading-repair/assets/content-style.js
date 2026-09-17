/* Presentation only. Keep original nodes, text, links, handlers and artwork. */
(function () {
  'use strict';
  if (window.CalorieTokenContentStyle) return;
  var headers = '.ctstyle-site-header,.ctstyle-header,.showcase-page-header,header.site-header,#masthead';
  var titles = '.ctstyle-title,.ctstyle-title-section,.ctstyle-shared-banner,.showcase-title-banner,.calorieapp-article-title,.entry-header';
  var footers = 'footer,[role="contentinfo"],.ctstyle-footer,.ctstyle-retired-footer,.calorieapp-shared-footer';
  var protectedSelector = [headers, titles, footers,
    'template,script,style,svg,picture,.brz-image,figure.wp-block-image',
    '.brz-carousel,.brz-slider,.brz-marquee,.brz-animated-headline,marquee',
    '.page-id-1090 .brz-animated',
    '.metaslider,.ml-slider,.n2-section-smartslider,.nivoSlider,.swiper,.slick-slider',
    '[data-calorieapp-social-carousel],.calorieapp-art-gallery,.calorieapp-usecase-image',
    '.xl-card,[data-calorieapp-account],[data-calorieapp-embed],.calorieapp-embed',
    '.calorieapp-page-tools,#ctstyle-app-launcher,.ctstyle-help-widget',
    '#cmplz-cookiebanner-container,#cmplz-manage-consent,.cmplz-cookiebanner',
    '[role="dialog"],[contenteditable],.brz-ed,#brz-ed-iframe,.screen-reader-text'
  ].join(',');
  var cards = [
    '.ctstyle-shared-panel,.ctstyle-discovery-card,.ctstyle-document-copy',
    '.cal-road-intro,.calorieapp-tokenomics-note,.calorie-legacy-page section',
    '.ctstyle-crypto-intro,.showcase-intro,.showcase-next,.showcase-card',
    '.calorieapp-app-info,.calorieapp-context-note,.calorieapp-social-panel',
    '.ctstyle-faq-hub,.ctstyle-faq-item,.ctstyle-manual-trustline,.ctstyle-community-status',
    '.ctstyle-roadmap-preview,.calorieapp-article-copy,.cal-buy-hero,.cal-buy-own-dex',
    '.cal-buy-risk,.cal-buy-markets,.cal-buy-steps>li,.ctstyle-donation-balance',
    '.cart-collaterals .cart_totals,.woocommerce-cart-form,.woocommerce-checkout',
    '.ctstyle-roadmap-timeline>.brz-timeline__tab,.brz-accordion__item',
    '.calorieapp-contact-card,.ctstyle-trustline-option>.brz-row>.brz-columns>.brz-column__items',
    '.calorieapp-xpmarket-widget'
  ].join(',');
  var prose = '.brz-rich-text,.calorieapp-reading-copy,.ctstyle-document-copy,.calorieapp-article-copy,.entry-content,.calorie-legacy-page,.woocommerce,.fluentform';
  var text = 'p,li,dt,dd,blockquote,figcaption,label,summary,small,.brz-wp-post-excerpt';
  var actions = 'button,input[type="submit"],input[type="button"],.brz-btn,.button,.wp-element-button,.ctstyle-discovery-action,.calorieapp-app-info-link,.showcase-action';
  var lanes = '.ctstyle-app-ending,.calorieapp-page-market,.ctstyle-discovery,.ctstyle-exchange-layout,.ctstyle-usecase-content';
  var owned = new Map(), pending = false;

  function allowed() {
    return document.body && document.body.matches('.ctstyle-enabled,.ctstyle-footer-only,.ctstyle-presentation-preview') &&
      ['https://calorietoken.net','https://www.calorietoken.net'].includes(location.origin) &&
      !/\/wp-admin(?:\/|$)/.test(location.pathname) &&
      !document.querySelector('.brz-ed,#brz-ed-iframe,[data-ct-content-style="off"]');
  }
  function apply() {
    pending = false;
    var next = new Map();
    function mark(node, name) {
      if (!next.has(node)) next.set(node, new Set());
      next.get(node).add(name);
    }
    if (allowed()) {
      var exclusions = Array.from(document.querySelectorAll(headers + ',' + footers));
      document.querySelectorAll('.brz-menu-simple').forEach(function (menu) {
        var host = menu.closest('.brz-section,header');
        if (host) exclusions.push(host);
      });
      // Recognize the original footer before the existing Site Style controller
      // adopts it. Never style its text or its carousel in the initial paint.
      document.querySelectorAll('.brz-section').forEach(function (section) {
        var value = section.textContent.replace(/\s+/g, ' ').trim();
        if (value.length < 1200 && /Operator: ICTHendrikse|Chamber of Commerce KVK:/.test(value) && /©/.test(value)) exclusions.push(section);
      });
      var title = Array.from(document.querySelectorAll(titles + ',h1')).find(function (node) {
        return !exclusions.some(function (root) { return root.contains(node); }) &&
          !node.closest('template,.xl-card,[data-calorieapp-account],.ctstyle-help-widget');
      });
      var footer = Array.from(document.querySelectorAll(footers)).find(function (node) {
        return !node.closest('template') && (!title || !!(title.compareDocumentPosition(node) & 4));
      });
      function eligible(node) {
        // Explicit owner addition: the floating CalorieHelp interior shares
        // the app style too, even though it sits outside the page's main flow.
        // The launcher/mascot, position and all conversation handlers stay intact.
        if (node && node.closest('.ctstyle-help-widget')) {
          return !node.closest('script,style,svg,picture,.ctstyle-help-avatar,.ctstyle-help-mascot,[contenteditable],.screen-reader-text');
        }
        if (node && node.matches('.ctstyle-app-launcher-panel') && node.querySelector('.ctstyle-help-widget')) return true;
        if (!node || node.closest(protectedSelector) || exclusions.some(function (root) { return root.contains(node) || node.contains(root); })) return false;
        if (title && (node.contains(title) || !(title.compareDocumentPosition(node) & 4))) return false;
        if (footer && (node.contains(footer) || !(node.compareDocumentPosition(footer) & 4))) return false;
        return true;
      }
      function select(selector, name, guard) {
        // Richlist can retain 14,000 paginated rows. Style its table once,
        // without annotating every cell/link or observing pagination churn.
        document.querySelectorAll(':is(' + selector + '):not(.xl-richlist *)').forEach(function (node) {
          if (eligible(node) && (!guard || guard(node))) mark(node, name);
        });
      }
      // Never restyle a container around a protected illustration/slider. Its
      // ordinary text siblings can still receive the app's typography.
      select(cards, 'ct-content-card', function (node) { return !node.querySelector(protectedSelector); });
      select(prose, 'ct-content-prose', function (node) { return !node.querySelector(protectedSelector); });
      select(lanes, 'ct-content-lane', function (node) { return !node.querySelector(protectedSelector); });
      select(text, 'ct-content-text', function (node) { return !node.querySelector(protectedSelector + ',img,iframe,video,canvas'); });
      select('h2,h3,h4,h5,h6,.ctstyle-section-heading,[role="heading"]', 'ct-content-heading', function (node) { return !node.querySelector(protectedSelector); });
      select(actions, 'ct-content-action', function (node) { return !node.querySelector('img,iframe') && !node.closest('.calorieapp-xpmarket-widget'); });
      select('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="button"]),textarea,select', 'ct-content-field');
      select('.calorieapp-xpmarket-widget', 'ct-content-market');
      select('.ctstyle-help-widget', 'ct-content-help');
      select('.ctstyle-app-launcher-panel', 'ct-content-help-shell');
      select('.ctstyle-faq-item>summary,.brz-accordion__nav', 'ct-content-summary');
      select('table', 'ct-content-table', function (node) { return !node.querySelector(protectedSelector); });
      select('.calorieapp-xpmarket-widget span,.calorieapp-xpmarket-widget strong,.calorieapp-xpmarket-widget small,.calorieapp-xpmarket-link', 'ct-content-inline');
      select('.brz-rich-text span,.brz-rich-text strong,.brz-rich-text b,.brz-rich-text em,.ctstyle-word-heading span', 'ct-content-inline', function (node) { return !node.closest('[aria-hidden="true"]') && !node.querySelector(protectedSelector); });
      select('a[href]', 'ct-content-link', function (node) { return !node.querySelector('img,svg') && !node.closest('.calorieapp-xpmarket-widget'); });
      // Only known content wrappers: no section reordering, no slider sizes,
      // no iframe, token image, form, or table replacement.
      select('.ctstyle-shared-panel-nested', 'ct-content-inset');
      select('.ctstyle-discovery-status,.calorieapp-context-note,.cal-buy-risk', 'ct-content-notice');
    }
    owned.forEach(function (names, node) {
      names.forEach(function (name) { if (!next.has(node) || !next.get(node).has(name)) node.classList.remove(name); });
    });
    next.forEach(function (names, node) { names.forEach(function (name) { if (!node.classList.contains(name)) node.classList.add(name); }); });
    owned = next;
    document.body.classList.toggle('ct-content-theme', allowed());
  }
  function queue() { if (!pending) { pending = true; requestAnimationFrame(apply); } }
  function start() {
    apply();
    var observer = new MutationObserver(function (records) {
      if (records.some(function (record) {
        if (record.type !== 'attributes') return true;
        // Our own marker changes do not start an observer feedback loop.
        var clean = function (value) { return (value || '').split(/\s+/).filter(function (part) { return part && !/^ct-content-/.test(part); }).sort().join(' '); };
        return clean(record.oldValue) !== clean(record.target.getAttribute('class'));
      })) queue();
    });
    observer.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class'], attributeOldValue:true});
    window.CalorieTokenContentStyle = {refresh:queue};
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
}());
