/* First-party public text catalogue; no translation provider, tracking or content requests. GPL-2.0-or-later. */
(function () {
  'use strict';
  var cfg=window.CalorieTokenContentLanguage;
  if(!cfg||!Array.isArray(cfg.entries)||window.CalorieTokenContentLanguageUI)return;
  var lookup=new Map(), records=new WeakMap(), active=[], observer=null, queued=false, locale='en';
  var excluded='script,style,template,svg,iframe,input,textarea,select,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],#ctstyle-testnet-secret,.woocommerce-customer-details,.woocommerce-order-details,.woocommerce-order-overview,.comment-content,.comment-list,.cmplz-cookiebanner,.ctstyle-help-reply';
  var owned='[data-cal-buy-copy],#ctstyle-account-app,#ctstyle-app-launcher,.ctstyle-discovery,.ctstyle-discovery-card:not(.ctstyle-faq-hub),.calorieapp-tokenomics-note,[data-calorieapp-trustline-ui],[data-ctstyle-app-info],.ctstyle-faq-hub';
  var candidates='.ctstyle-legal p,.ctstyle-market-card h2,.ctstyle-market-card p,.brz-rich-text p,.brz-rich-text li,.brz-rich-text h1,.brz-rich-text h2,.brz-rich-text h3,.brz-rich-text h4,.brz-rich-text h5,.brz-rich-text summary,.entry-content p,.entry-content li,.entry-content h1,.entry-content h2,.entry-content h3,.entry-title,.ctstyle-title h1,.ctstyle-title h2,.ctstyle-roadmap-preview p,.ctstyle-roadmap-preview h3,.ctstyle-roadmap-preview a,.calorieapp-context-note p,.calorieapp-context-note strong,.calorieapp-context-note a,.woocommerce label,.woocommerce button,.woocommerce th,.woocommerce h2,.woocommerce h3,.woocommerce .product_title,.woocommerce a,.woocommerce-notices-wrapper,.brz-posts p,.brz-posts h2,.brz-posts a';
  function norm(v){return String(v||'').replace(/\s+/g,' ').trim();}
  cfg.entries.forEach(function(row){if(row&&typeof row.source==='string'&&row.translations)lookup.set(norm(row.source),row);});
  function allowed(){return document.body&&document.body.matches('.ctstyle-enabled,.ctstyle-footer-only')&&!document.body.matches('.page-id-8001,.brz-ed')&&!document.querySelector('.brz-ed,#brz-ed-iframe')&&['https://calorietoken.net','https://www.calorietoken.net'].includes(window.location.origin)&&!/\/wp-admin\//.test(window.location.pathname)&&!Array.from(new URL(window.location.href).searchParams.keys()).some(function(k){return /^(?:preview|customize_changeset_uuid|brizy-edit|brizy-edit-iframe|brz-edit|brz-edit-iframe|xl-)/.test(k);});}
  function safe(n){return n&&n.isConnected&&!n.closest(excluded+','+owned);}
  function available(row){return locale==='en'?row.source:row.translations[locale];}
  function paint(record){
    var node=record.node;if(!node.isConnected)return;
    if(record.kind==='text'){
      if(!safe(node.parentElement)||node.data!==record.last)return;
      var translated=available(record.row);
      var next=translated ? (record.original.match(/^\s*/)[0]+translated+record.original.match(/\s*$/)[0]) : record.original;
      if(locale==='en')next=record.original;
      if(node.data!==next)node.data=next;record.last=next;
      return;
    }
    if(!safe(node)||norm(node.textContent)!==record.last)return;
    var value=available(record.row);
    if(locale==='en'||!value){
      if(record.changed){node.replaceChildren.apply(node,record.children);record.changed=false;}
      if(record.lang===null)node.removeAttribute('lang');else node.setAttribute('lang',record.lang);
      if(record.dir===null)node.removeAttribute('dir');else node.setAttribute('dir',record.dir);
      record.last=norm(node.textContent);return;
    }
    if(norm(node.textContent)!==value)node.replaceChildren(document.createTextNode(value));
    node.lang=locale;node.dir=['ar','ur'].includes(locale)?'rtl':'ltr';record.last=value;record.changed=true;
  }
  function block(n){
    if(!safe(n)||n.querySelector(excluded)||records.has(n))return;
    var row=lookup.get(norm(n.textContent));if(!row)return;
    // Keep anchors, icons, labels and controls alive. Complex content uses text-node matches.
    if(Array.from(n.querySelectorAll('*')).some(function(x){return !['SPAN','STRONG','B','EM','I','BR'].includes(x.tagName);}))return;
    var record={node:n,row:row,children:Array.from(n.childNodes),last:norm(n.textContent),kind:'block',lang:n.getAttribute('lang'),dir:n.getAttribute('dir'),changed:false};
    records.set(n,record);active.push(record);paint(record);
  }
  function fragments(root){
    if(!safe(root))return;
    Array.from(root.childNodes).forEach(function(n){
      if(n.nodeType===1){if(!records.has(n))fragments(n);return;}
      if(n.nodeType!==3||records.has(n)||!norm(n.data))return;
      var row=lookup.get(norm(n.data));if(!row)return;
      var record={node:n,row:row,original:n.data,last:n.data,kind:'text'};
      records.set(n,record);active.push(record);paint(record);
    });
  }
  function refresh(tag){
    if(!allowed())return;
    var next=tag||(window.CalorieTokenDiscoveryUI&&window.CalorieTokenDiscoveryUI.getLocale())||'en';
    if(!cfg.locales.includes(next))next='en';locale=next;
    if(observer)observer.disconnect();
    // Ask existing owners to translate their own mutable controls and notes.
    ['CalorieAppTokenomics'].forEach(function(key){if(window[key]&&typeof window[key].setLocale==='function')window[key].setLocale(locale);});
    active=active.filter(function(r){return r.node.isConnected;});active.forEach(paint);
    document.querySelectorAll(candidates).forEach(block);
    document.querySelectorAll('.ctstyle-legal,.ctstyle-market-card,.brz-rich-text,.entry-content,.woocommerce,.woocommerce-notices-wrapper,.ctstyle-roadmap-preview,.calorieapp-context-note,.brz-posts').forEach(function(root){if(!records.has(root))fragments(root);});
    if(observer)observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  }
  window.CalorieTokenContentLanguageUI={refresh:refresh,getLocale:function(){return locale;},coverage:function(){return {locale:locale,translated:active.filter(function(r){return r.node.isConnected&&locale!=='en'&&!!r.row.translations[locale];}).length};}};
  if(typeof window.MutationObserver==='function')observer=new window.MutationObserver(function(){
    if(queued)return;queued=true;window.requestAnimationFrame(function(){queued=false;refresh();});
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){refresh();},{once:true});else refresh();
  window.addEventListener('load',function(){refresh();},{once:true});
  document.addEventListener('calorietoken:display-language',function(e){refresh(e.detail&&e.detail.locale);});
  window.addEventListener('pagehide',function(){if(observer)observer.disconnect();});
  window.addEventListener('pageshow',function(){refresh();});
})();
