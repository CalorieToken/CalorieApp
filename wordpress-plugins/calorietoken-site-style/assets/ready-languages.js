/* CalorieToken Site Style — GPL-2.0-or-later.
 * Language presentation for the owned buy guide, progress and app information.
 * No new picker, persistence, authentication, request or payment handling. */
(function () {
  'use strict';
  var config=window.CalorieTokenSiteStyleMenu;
  var protectedNodes='form,input,select,textarea,button,[contenteditable],.xl-card,[data-calorieapp-embed],[data-calorieapp-account],[hidden],[inert],[aria-hidden="true"]';
  var protectedDescendants='form,input,select,textarea,button,iframe,video,audio,canvas,[contenteditable],.xl-card,[data-calorieapp-embed],[data-calorieapp-account]';
  function allowed() {
    return document.body && document.body.classList.contains('ctstyle-enabled')
      && !document.body.matches('.home,.page-id-1090,.page-id-8001,.brz-ed')
      && !document.querySelector('.brz-ed,#brz-ed-iframe')
      && !/\/wp-admin\//.test(window.location.pathname)
      && !Array.from(new URL(window.location.href).searchParams.keys()).some(function (key) {
        return /^(?:preview|customize_changeset_uuid|brizy-edit|brizy-edit-iframe|brz-edit|brz-edit-iframe)$/.test(key);
      });
  }
  if (!allowed() || !config || !Array.isArray(config.locales) || window.CalorieTokenPageLanguage) return;
  function one(selector,root) {var nodes=(root||document).querySelectorAll(selector);return nodes.length===1?nodes[0]:null;}
  function resolve(value) {
    var tag=String(value||'').replace(/_/g,'-').toLowerCase();
    var match=config.locales.find(function (item) {return item.tag.toLowerCase()===tag;});
    if (!match) match=config.locales.find(function (item) {return item.tag===tag.split('-')[0];});
    return match?match.tag:null;
  }
  function direction(tag) {return ['ar','ur'].includes(tag)?'rtl':'ltr';}
  function pageId() {var match=document.body.className.match(/(?:^|\s)(?:page-id|postid)-(\d+)(?:\s|$)/);return match?Number(match[1]):0;}
  function activePicker() {
    var panel=one('[data-calorieapp-display-language]');
    return panel && panel.dataset.ready==='1' && !panel.closest('[hidden],[inert],[contenteditable]')?one('select',panel):null;
  }
  function initialLocale() {
    var picker=activePicker();
    return (picker&&resolve(picker.value)) || resolve(new URL(window.location.href).searchParams.get('ui_lang')) || resolve(document.documentElement.lang) || 'en';
  }
  var locale=initialLocale(), ownsGuide=false, observer=null, watchedPanel=null, observing=true;
  var boundPickers=new WeakSet();
  function textField(node) {return node && node.childNodes.length===1 && node.childNodes[0].nodeType===3;}
  function knownField(node,catalogue,key) {
    return textField(node) && Object.values(catalogue).some(function (copy) {return copy && copy[key]===node.childNodes[0].data;});
  }
  function translateGuide() {
    if (!ownsGuide || pageId()!==4205 || config.buyGuide?.publicPage!==true) return;
    var url=new URL(window.location.href);
    if (!['https://calorietoken.net','https://www.calorietoken.net'].includes(url.origin)
      || !['/index.php/how-to-buy-calorie/','/how-to-buy-calorie/'].includes(url.pathname)
      || Array.from(url.searchParams.keys()).some(function (key) {return key!=='ui_lang';})) return;
    var root=one('.cal-buy-guide');
    if (!root || root.dataset.calorieappBuyGuide!=='1' || root.closest(protectedNodes) || root.querySelector(protectedDescendants)) return;
    var catalogue=config.buyGuide.copy, selected=catalogue?.[locale], keys=Object.keys(catalogue?.en||{});
    var fields=Array.from(root.querySelectorAll('[data-cal-buy-copy]'));
    if (!selected || !keys.length || fields.length!==keys.length || !keys.every(function (key) {
      return typeof selected[key]==='string' && selected[key].trim() && fields.filter(function (node) {return node.getAttribute('data-cal-buy-copy')===key;}).length===1;
    }) || !fields.every(function (node) {return knownField(node,catalogue,node.getAttribute('data-cal-buy-copy'));})) return;
    var values=Array.from(root.querySelectorAll('.cal-buy-identity code'));
    var identity=['Calorie (CAL)','rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY','43616C6F72696500000000000000000000000000'];
    if (values.length!==3 || !values.every(function (node,index) {return textField(node)&&node.textContent===identity[index];})) return;
    var destinations=['https://xaman.app/','https://xumm.app/detect/xapp:xumm.buysellxrp',
      'https://xrpl.org/docs/concepts/accounts/reserves',url.origin+'/index.php/trustline/',
      'https://xpmarket.com/dex/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP', 'https://xpmarket.com/dex/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP', 'https://xpmarket.com/swap/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP/market'];
    var links=Array.from(root.querySelectorAll('a'));
    if (links.length!==destinations.length || !links.every(function (node,index) {return node.getAttribute('href')===destinations[index];})) return;
    fields.forEach(function (node) {node.childNodes[0].data=selected[node.getAttribute('data-cal-buy-copy')];});
    root.lang=locale;root.dir=direction(locale);root.setAttribute('aria-label',selected.title);
  }
  function stepText(index,label) {return (index+1)+'. '+label;}
  function translateDonation() {
    var routes=[[6897,'donate'],[6914,'product/donation'],[6926,'cart'],[6937,'checkout']];
    var index=routes.findIndex(function (item) {return item[0]===pageId();});
    if (index<0) return;
    var root=one('#calorieapp-donation-steps[data-ctstyle-donation-steps]');
    var catalogue=config.donationCopy, selected=catalogue?.[locale];
    if (!root || !selected || selected.length!==5 || !selected.every(function (value) {return typeof value==='string'&&value.trim();})
      || root.closest(protectedNodes) || root.querySelector(protectedNodes)) return;
    var fields=Array.from(root.querySelectorAll('[data-ctstyle-donation-step]'));
    if (fields.length!==4 || root.querySelectorAll('a').length!==index || !fields.every(function (node,n) {
      return node.getAttribute('data-ctstyle-donation-step')===String(n) && textField(node)
        && Object.values(catalogue).some(function (copy) {return node.textContent===stepText(n,copy[n+1]);})
        && node.tagName===(n<index?'A':'SPAN')
        && (n>=index || node.getAttribute('href')===window.location.origin+'/index.php/'+routes[n][1]+'/')
        && node.getAttribute('aria-current')===(n===index?'step':null);
    })) return;
    fields.forEach(function (node,n) {node.childNodes[0].data=stepText(n,selected[n+1]);});
    root.setAttribute('aria-label',selected[0]);root.lang=locale;root.dir=direction(locale);
  }
  function translateInformation() {
    var root=one('[data-ctstyle-app-info][data-calorieapp-app-info]');
    if (!root || root.closest(protectedNodes) || root.querySelector(protectedNodes)) return;
    var catalogue=config.appInformation, selected=catalogue?.[locale];
    var description=one(':scope > div:not(.ctstyle-app-sources) > p',root), action=one('.calorieapp-app-info-link,.calorieapp-app-info-current',root);
    var onApp=pageId()===7880, key=onApp?'on_page':'action';
    if (!selected || !knownField(description,catalogue,'description') || !knownField(action,catalogue,key)
      || (onApp?action.tagName!=='P':action.tagName!=='A'||action.getAttribute('href')!==window.location.origin+'/index.php/calorieapp/')) return;
    description.childNodes[0].data=selected.description;action.childNodes[0].data=selected[key];root.lang=locale;root.dir=direction(locale);
    if (window.CalorieTokenAppInfo) window.CalorieTokenAppInfo.refresh(locale);
  }
  function render() {if (allowed()) {translateGuide();translateDonation();translateInformation();}}
  function setLocale(value) {var next=resolve(value);if (next) {locale=next;render();}}
  function bindPicker() {
    var panel=one('[data-calorieapp-display-language]');
    if (panel!==watchedPanel) {if (observer) observer.disconnect();watchedPanel=panel;}
    var picker=activePicker();
    if (picker && !boundPickers.has(picker)) {
      boundPickers.add(picker);
      picker.addEventListener('change',function () {if (activePicker()===picker) setLocale(picker.value);});
    }
    if (picker) {var tag=resolve(picker.value);if (tag) locale=tag;}
    if (observer && watchedPanel && observing) observer.observe(watchedPanel,{attributes:true,attributeFilter:['data-ready','lang','dir','hidden','inert'],childList:true,subtree:true});
  }
  function refresh() {if (!allowed()) return;if(pageId()===4205 && one('.cal-buy-guide[data-ctstyle-buy-routes="1"]')) ownsGuide=true;bindPicker();render();}
  window.CalorieTokenPageLanguage={refresh:refresh,setLocale:setLocale};
  if (pageId()===4205 && !window.CalorieAppBuyGuide) {
    ownsGuide=true;window.CalorieAppBuyGuide={refresh:render,setLocale:setLocale};
  }
  if (typeof window.MutationObserver==='function') observer=new window.MutationObserver(refresh);
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',refresh,{once:true});
  else refresh();
  window.addEventListener('load',refresh,{once:true});
  window.addEventListener('pageshow',function () {observing=true;refresh();});
  window.addEventListener('pagehide',function () {observing=false;if (observer) observer.disconnect();});
  if (ownsGuide) window.dispatchEvent(new window.Event('calorieapp:buy-guide-ready'));
})();
