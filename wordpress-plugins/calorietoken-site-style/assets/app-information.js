/* CalorieToken Site Style — shared information card, including Home's footer-only mode. */
(function () {
  'use strict';
  var config = window.CalorieTokenAppInformation, view = null;
  if (!config || window.CalorieTokenAppInfo) return;
  function allowed() {
    return document.body && document.body.matches('.ctstyle-enabled,.ctstyle-footer-only') &&
      !document.body.matches('.page-id-8001,.brz-ed') && !document.querySelector('.brz-ed,#brz-ed-iframe') &&
      !/\/wp-admin\//.test(window.location.pathname) &&
      !Array.from(new URL(window.location.href).searchParams.keys()).some(function (key) {
        return /^(preview|customize_changeset_uuid|brizy-edit|brizy-edit-iframe|brz-edit|brz-edit-iframe)$/.test(key);
      }) && (!document.body.matches('.home,.page-id-1090') || document.body.classList.contains('ctstyle-footer-only'));
  }
  function locale(requested) {
    requested = requested || new URL(window.location.href).searchParams.get('ui_lang') || document.documentElement.lang || 'en';
    var match = config.locales.find(function (item) { return item.tag.toLowerCase() === requested.toLowerCase(); }) ||
      config.locales.find(function (item) { return item.tag === requested.split('-')[0]; });
    return match ? match.tag : 'en';
  }
  function sources(copy) {
    if (!document.body.classList.contains('page-id-7880') || !view || !copy.offAttribution || !copy.usdaAttribution) return;
    var block=view.panel.querySelector('.ctstyle-app-sources');
    if (!block) {block=document.createElement('div');block.className='ctstyle-app-sources';view.panel.append(block);}
    var links={off:['Open Food Facts','https://world.openfoodfacts.org'],odbl:['ODbL','https://opendatacommons.org/licenses/odbl/1-0/'],usda:['USDA FoodData Central','https://fdc.nal.usda.gov/'],cc0:['CC0 1.0','https://creativecommons.org/publicdomain/zero/1.0/']};
    block.replaceChildren();
    ['offAttribution','usdaAttribution'].forEach(function (key) {
      var p=document.createElement('p');
      copy[key].split(/(\{(?:off|odbl|usda|cc0)\})/g).forEach(function (part) {
        var pair=links[part.slice(1,-1)];
        if (/^\{.*\}$/.test(part) && pair) {var a=document.createElement('a');a.href=pair[1];a.textContent=pair[0];a.dir='ltr';a.target='_blank';a.rel='noopener noreferrer';p.append(a);}
        else p.append(document.createTextNode(part));
      });
      block.append(p);
    });
  }
  function refresh(requested) {
    if (!allowed()) return;
    var tag = locale(requested), copy = config.copy[tag] || config.copy.en;
    if (!view) {
      if (document.querySelector('.calorieapp-app-info')) return;
      var footers = document.querySelectorAll('.ctstyle-footer'), footer = footers.length === 1 && footers[0];
      if (!footer || footer.closest('form,[contenteditable],[hidden],[inert]')) return;
      var panel = document.createElement('section'); panel.className = 'calorieapp-app-info';
      panel.setAttribute('data-calorieapp-app-info', ''); panel.setAttribute('data-ctstyle-app-info', '');
      panel.setAttribute('aria-labelledby', 'ctstyle-app-info-title');
      var logo = document.createElement('img'); logo.src = config.appLogo; logo.alt = ''; logo.width = 64; logo.height = 64;
      var content = document.createElement('div'), heading = document.createElement('h2'), description = document.createElement('p');
      heading.id = 'ctstyle-app-info-title'; heading.textContent = 'CalorieApp';
      var onApp = document.body.classList.contains('page-id-7880'), action = document.createElement(onApp ? 'p' : 'a');
      action.className = onApp ? 'calorieapp-app-info-current' : 'calorieapp-app-info-link';
      if (!onApp) action.href = config.appURL;
      content.append(heading, description); panel.append(logo, content, action);
      var ending=document.createElement('div');ending.className='ctstyle-app-ending';ending.append(panel);footer.before(ending);
      view = {panel: panel, description: description, action: action, key: onApp ? 'on_page' : 'action'};
    } else {
      // A new CMS edit or other owner's custom text wins over automatic refresh.
      if (!view.panel.isConnected || view.description.parentElement.parentElement !== view.panel ||
          view.action.parentElement !== view.panel ||
          (view.key === 'action' && view.action.getAttribute('href') !== config.appURL) ||
          !Object.values(config.copy).some(function (text) { return text.description === view.description.textContent; }) ||
          !Object.values(config.copy).some(function (text) { return text[view.key] === view.action.textContent; })) return;
    }
    view.panel.lang = tag; view.panel.dir = ['ar', 'ur'].includes(tag) ? 'rtl' : 'ltr';
    view.description.textContent = copy.description; view.action.textContent = copy[view.key];
    sources(copy);
  }
  window.CalorieTokenAppInfo = {refresh: refresh};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { refresh(); }, {once: true});
  else refresh();
  window.addEventListener('load', function () { refresh(); }, {once: true});
  // Read an existing language choice; never change the native picker or account state.
  document.addEventListener('change', function (event) {
    if (event.target.matches('select') && event.target.closest('[data-calorieapp-display-language]')) refresh(event.target.value);
  });
})();
