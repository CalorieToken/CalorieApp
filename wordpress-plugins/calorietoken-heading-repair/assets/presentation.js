/* Shared presentation over the current WordPress menu; no account or provider requests. */
(function () {
  'use strict';
  var cfg=window.CalorieTokenPresentation;
  if(!cfg||window.CalorieTokenPresentationUI)return;
  var observer=null, queued=false, locale='en', menus=new WeakMap(), menuRows=new WeakMap();
  var bodySelector='.ctstyle-enabled,.ctstyle-footer-only,.ctstyle-presentation-preview';
  var headings='.ctstyle-heading,.ctstyle-section-heading,.ctstyle-crypto-intro h2,.showcase-hero h1,.showcase-title-banner h1';
  var excluded='a,button,input,select,textarea,svg,script,style,iframe,[contenteditable],.xl-card,[data-calorieapp-account]';
  var panelRoots='.cal-road-intro,.calorieapp-tokenomics-note,.calorie-legacy-page section:not(#ct-age-finance-notice),.page-id-7224 [data-brz-custom-id="owoOYYzWylhn"],.ctstyle-crypto-intro,.showcase-intro,.showcase-next,.showcase-card,.ctstyle-document-copy,.calorieapp-app-info,.calorieapp-context-note,.calorieapp-art-gallery,.calorieapp-social-panel,.cart-collaterals .cart_totals,.ctstyle-faq-hub,.ctstyle-discovery-card,.ctstyle-manual-trustline,.ctstyle-community-status,.ctstyle-roadmap-preview,.calorieapp-article-copy,.cal-buy-hero,.cal-buy-own-dex,.cal-buy-risk,.cal-buy-markets,.cal-buy-steps>li';
  var panelExcluded='.ctstyle-site-header,.ctstyle-header,.ctstyle-header-fallback,.showcase-page-header,.ctstyle-title,.ctstyle-footer,footer,nav,.xl-card,[data-calorieapp-account],[data-calorieapp-embed],.calorieapp-trustline-context,form,[contenteditable]';
  function allowed(){return document.body&&document.body.matches(bodySelector)&&!document.querySelector('.brz-ed,#brz-ed-iframe')&&['https://calorietoken.net','https://www.calorietoken.net'].includes(window.location.origin)&&!/\/wp-admin\//.test(window.location.pathname);}
  function path(value){try{return new URL(value,window.location.href).pathname.replace(/^\/index\.php(?=\/)/,'').replace(/\/+$/,'')||'/';}catch(e){return '';}}
  function category(value){
    if(['/whitepaper','/showcases','/roadmap','/tokenomics-update'].includes(value))return 'project';
    if(['/how-to-buy-calorie','/trustline','/richlist'].includes(value))return 'crypto';
    if(['/community-voting-hub-info','/blog','/donate','/merchnfts'].includes(value))return 'community';
    if(['/contact','/faq'].includes(value))return 'help';
    return '';
  }
  function resolveLocale(value){
    var tag=typeof value==='string'?value.trim().replace(/_/g,'-').toLowerCase():'';
    var exact=Object.keys(cfg.copy).find(function(key){return key.toLowerCase()===tag;});
    if(exact)return exact;
    if(/^(?:zh|zh-(?:hans(?:-[a-z]{2})?|cn|sg))$/.test(tag)&&cfg.copy['zh-Hans'])return 'zh-Hans';
    var primary=tag.split('-')[0];
    return Object.prototype.hasOwnProperty.call(cfg.copy,primary)?primary:null;
  }
  function translateMenuLink(a,row){
    // Only anchors created by this menu renderer are eligible. Never replace
    // a header, account widget, menu control, destination or event handler.
    var url;try{url=new URL(row.url,window.location.href);}catch(e){return;}
    var settings=window.CalorieTokenSiteStyleMenu;
    var labels=settings&&settings.sharedLabels&&settings.sharedLabels[locale];
    var text=url.origin===window.location.origin&&!url.search&&!url.hash&&labels&&labels[path(row.url)];
    if(typeof text!=='string'||!text.trim())text=row.title;
    if(a.textContent!==text)a.textContent=text;
    if(labels&&labels[path(row.url)]===text&&url.origin===window.location.origin&&!url.search&&!url.hash){
      a.lang=locale;a.dir=['ar','ur'].includes(locale)?'rtl':'ltr';
    }else{a.removeAttribute('lang');a.removeAttribute('dir');}
  }
  function link(row){
    var a=document.createElement('a');a.href=row.url;menuRows.set(a,row);translateMenuLink(a,row);
    if(new URL(row.url,window.location.href).origin===window.location.origin&&path(row.url)===path(window.location.href))a.setAttribute('aria-current','page');
    return a;
  }
  function renderMenu(host){
    if(!Array.isArray(cfg.links)||!cfg.links.length)return;
    if(menus.get(host))return;
    var rows=cfg.links.filter(function(row){try{return row&&row.title&&/^https?:$/.test(new URL(row.url,window.location.href).protocol);}catch(e){return false;}});
    if(!rows.length)return;
    var list=document.createElement('ul');list.className='ctstyle-menu-groups';
    var groups={}, seen=new Set();
    rows.forEach(function(row){
      if(seen.has(row.url))return;seen.add(row.url);
      var url=new URL(row.url,window.location.href),key=url.origin===window.location.origin?category(path(row.url)):'';
      if(!key){var li=document.createElement('li');li.appendChild(link(row));list.appendChild(li);return;}
      if(!groups[key])groups[key]=[];groups[key].push(row);
    });
    ['project','crypto','community','help'].forEach(function(key){
      if(!groups[key])return;
      var li=document.createElement('li'),details=document.createElement('details'),summary=document.createElement('summary'),children=document.createElement('ul');
      details.className='ctstyle-menu-category';summary.dataset.ctstyleMenuGroup=key;summary.textContent=cfg.copy[locale][key];
      groups[key].forEach(function(row){var child=document.createElement('li');child.appendChild(link(row));children.appendChild(child);});
      if(children.querySelector('[aria-current]'))details.classList.add('ctstyle-current-category');
      details.append(summary,children);li.appendChild(details);list.appendChild(li);
      details.addEventListener('toggle',function(){if(details.open)list.querySelectorAll('details[open]').forEach(function(other){if(other!==details)other.open=false;});});
      details.addEventListener('keydown',function(e){if(e.key==='Escape'&&details.open){e.stopPropagation();details.open=false;summary.focus();}});
    });
    // Replace navigation links only. Xaman nodes and Brizy's mobile checkbox remain alive.
    host.replaceChildren(list);menus.set(host,true);
  }
  // Decoration must not split, normalize, replace, or restore translated text.
  // Owners (including the site's locale renderer) keep their original text nodes.
  var headingHighlight=null, headingRangeMap=new WeakMap(), highlightedHeadings=new Set();
  function highlightRegistry(){
    if(!window.CSS||!window.CSS.highlights||typeof window.Highlight!=='function')return null;
    if(!headingHighlight)headingHighlight=new window.Highlight();
    if(window.CSS.highlights.get('ctstyle-initials')!==headingHighlight)window.CSS.highlights.set('ctstyle-initials',headingHighlight);
    return headingHighlight;
  }
  function forgetHeading(node){
    var old=headingRangeMap.get(node)||[];
    if(headingHighlight)old.forEach(function(range){headingHighlight.delete(range);});
    headingRangeMap.delete(node);highlightedHeadings.delete(node);
  }
  function pruneHeadings(){
    highlightedHeadings.forEach(function(node){if(!node.isConnected||!node.matches(headings)||node.closest(excluded)||node.querySelector(excluded))forgetHeading(node);});
  }
  function paintHeading(node){
    if(!node.isConnected||!node.matches(headings)||node.closest(excluded)||node.querySelector(excluded)){forgetHeading(node);return;}
    var registry=highlightRegistry();forgetHeading(node);
    node.classList.add('ctstyle-word-heading');
    node.classList.toggle('ctstyle-initials-fallback',!registry);
    // Older browsers retain readable text and a CSS first-letter accent. Never
    // fall back to DOM rewriting, which is the incompatible behavior repaired here.
    if(!registry)return;
    var text='',nodes=[],ranges=[],match,regex=/\p{L}[\p{L}\p{M}\p{N}'\u2019\u200c\u200d]*/gu;
    function collect(parent){Array.from(parent.childNodes).forEach(function(child){
      if(child.nodeType===3){nodes.push({node:child,start:text.length,end:text.length+child.data.length});text+=child.data;}
      else if(child.nodeType===1){if(child.tagName==='BR')text+='\n';else collect(child);}
    });}
    collect(node);
    var richlistTitle=(document.body.classList.contains('page-id-3243')||path(window.location.href)==='/richlist')
      &&node.matches('.ctstyle-heading')&&/^\$[^$]+\$$/.test(text.trim());
    var segmenter=null;
    try{if(typeof Intl.Segmenter==='function')segmenter=new Intl.Segmenter(locale,{granularity:'grapheme'});}catch(_){/* use a Unicode code point */}
    if(richlistTitle)[text.indexOf('$'),text.lastIndexOf('$')].forEach(function(index){ranges.push({start:index,end:index+1});});
    while(!richlistTitle&&(match=regex.exec(text))){
      var first=segmenter?segmenter.segment(match[0])[Symbol.iterator]().next().value.segment:Array.from(match[0])[0];
      ranges.push({start:match.index,end:match.index+first.length});
    }
    var painted=[];
    ranges.forEach(function(part){
      var first=nodes.find(function(entry){return entry.start<=part.start&&part.start<entry.end;});
      var last=nodes.find(function(entry){return entry.start<part.end&&part.end<=entry.end;});
      if(!first||!last)return;
      var range=document.createRange();
      range.setStart(first.node,part.start-first.start);range.setEnd(last.node,part.end-last.start);
      registry.add(range);painted.push(range);
    });
    headingRangeMap.set(node,painted);highlightedHeadings.add(node);
  }
  function sharedPanels(){
    document.querySelectorAll(panelRoots).forEach(function(node){
      if(!node.closest(panelExcluded))node.classList.add('ctstyle-shared-panel');
    });
    document.querySelectorAll('.brz-posts .brz-wp-post-excerpt').forEach(function(excerpt){
      var box=excerpt.closest('.brz-column__items');
      if(box&&!box.closest(panelExcluded)&&box.querySelector('.brz-wp-title-content'))box.classList.add('ctstyle-shared-panel','ctstyle-blog-card');
    });
    // Frame existing Brizy content cards, not entire layout rows, banners,
    // account widgets or embeds. Keep every original node and event handler.
    document.querySelectorAll('.brz-columns>.brz-column__items').forEach(function(box){
      if(box.closest(panelExcluded+',.ctstyle-shared-panel')||box.querySelector('.brz-columns,iframe,.xl-card,[data-calorieapp-embed],.ctstyle-shared-panel'))return;
      var ownHeading=Array.from(box.querySelectorAll('.brz-rich-text h2,.brz-rich-text h3')).some(function(h){return h.closest('.brz-column__items')===box&&!h.closest(excluded);});
      var copy=Array.from(box.querySelectorAll('.brz-rich-text p')).some(function(p){return p.closest('.brz-column__items')===box&&p.textContent.trim();});
      if(ownHeading&&copy)box.classList.add('ctstyle-shared-panel','ctstyle-brizy-panel');
    });
    document.querySelectorAll('.ctstyle-shared-panel').forEach(function(panel){
      if(panel.parentElement&&panel.parentElement.closest('.ctstyle-shared-panel'))panel.classList.add('ctstyle-shared-panel-nested');
      if(panel.tagName==='DETAILS')panel.classList.add('ctstyle-shared-disclosure');
      if (panel.matches('.calorie-legacy-page section:not(#ct-age-finance-notice),.ctstyle-document-copy')) panel.querySelectorAll('h1').forEach(function(h){h.classList.add('ctstyle-section-heading');});
      panel.querySelectorAll('h2,h3').forEach(function(h){if(!h.closest(excluded))h.classList.add('ctstyle-section-heading');});
    });
  }
  function sharedHeader(){
    document.querySelectorAll('.brz-menu-simple').forEach(function(menu){
      var header=menu.closest('.brz-section,section,header');if(header)header.classList.add('ctstyle-site-header');
      var list=menu.querySelector('.menu-hoofdmenu3-container');
      if(!list){var original=menu.querySelector('ul');list=original&&original.parentElement;}
      if(list)renderMenu(list);
      var input=menu.querySelector('input[type="checkbox"]'),label=menu.querySelector('.brz-menu-simple__icon');
      if(input)input.setAttribute('aria-label',cfg.copy[locale].menu);
      if(label)label.classList.add('ctstyle-menu-toggle');
    });
    document.querySelectorAll('.ctstyle-header-fallback,.showcase-page-header').forEach(function(header){
      header.classList.add('ctstyle-site-header');
      header.querySelectorAll('nav.ctstyle-desktop-nav,.ctstyle-mobile-nav nav,nav.showcase-header-menu,.showcase-mobile-menu nav').forEach(renderMenu);
      header.querySelectorAll('.ctstyle-mobile-nav>summary,.showcase-mobile-menu>summary').forEach(function(summary){summary.classList.add('ctstyle-menu-toggle');summary.setAttribute('aria-label',cfg.copy[locale].menu);});
    });
    document.querySelectorAll('[data-ctstyle-menu-group]').forEach(function(node){node.textContent=cfg.copy[locale][node.dataset.ctstyleMenuGroup];node.lang=locale;node.dir=['ar','ur'].includes(locale)?'rtl':'ltr';});
    // Initial remembered languages and fallback menus must not depend on a
    // previous translation pass over nodes this renderer has just replaced.
    document.querySelectorAll('.ctstyle-menu-groups a[href]').forEach(function(a){var row=menuRows.get(a);if(row)translateMenuLink(a,row);});
  }
  function widgetLabels(){
    // Translate only observed static labels. Keep balances, wallet addresses,
    // QR images, links, account state and their event handlers owned by Xaman.
    [['.xl-card-balance>strong','balance'],['.xl-card-rank>strong','rank'],['.xl-card-balance>a','trade'],['.xl-card-note','signInNote']].forEach(function(pair){
      var key=pair[1],current=cfg.copy[locale][key];if(!current)return;
      var known=Object.keys(cfg.copy).map(function(tag){return cfg.copy[tag][key];});
      document.querySelectorAll('.xl-card '+pair[0]).forEach(function(node){
        if(node.children.length||!known.includes(node.textContent.trim()))return;
        var next=current+(node.tagName==='STRONG'?' ':'');
        if(node.textContent!==next)node.textContent=next;
        node.lang=locale;node.dir=['ar','ur'].includes(locale)?'rtl':'ltr';
      });
    });
  }
  function structuralPolish(){
    // Twenty Nineteen assumes every click occurs on a page with a
    // .site-branding element. Several intentionally headerless Brizy pages do
    // not have one, so provide one inert compatibility target for the theme's
    // own focus cleanup without changing the visible page or click handling.
    if(!document.querySelector('.site-branding')){
      var themeGuard=document.createElement('div');themeGuard.className='site-branding ct-heading-repair-theme-guard';themeGuard.hidden=true;themeGuard.setAttribute('aria-hidden','true');document.body.prepend(themeGuard);
    }
    // Restore before re-evaluating so translated headings and late builder
    // content remain authoritative.
    document.querySelectorAll('[data-ct-duplicate-h1="1"]').forEach(function(node){
      node.hidden=node.dataset.ctDuplicateWasHidden==='1';delete node.dataset.ctDuplicateWasHidden;delete node.dataset.ctDuplicateH1;
    });
    if(document.body.matches('.page-id-7860,.page-id-1209')){
      var h1s=Array.from(document.querySelectorAll('h1')).filter(function(node){return !node.hidden&&!node.closest('[hidden],[inert],[aria-hidden="true"]');});
      if(h1s.length>1){
        var first=h1s[0].textContent.replace(/\s+/g,' ').trim().toLocaleLowerCase(locale);
        h1s.slice(1).forEach(function(node){if(node.textContent.replace(/\s+/g,' ').trim().toLocaleLowerCase(locale)===first){node.dataset.ctDuplicateWasHidden=node.hidden?'1':'0';node.dataset.ctDuplicateH1='1';node.hidden=true;}});
      }
    }
    var generated=document.querySelector('[data-ct-home-h1="1"]');
    if(document.body.classList.contains('page-id-1090')&&!document.querySelector('h1:not([hidden])')){
      if(!generated){generated=document.createElement('h1');generated.dataset.ctHomeH1='1';generated.className='ct-heading-repair-sr-only';generated.textContent='CalorieToken';var main=document.querySelector('main,#main,.site-content')||document.body;main.prepend(generated);}
    }else if(generated)generated.remove();
    document.querySelectorAll('.page-id-1213 h5').forEach(function(node){if(!node.closest('header,footer,nav,[hidden]')){node.setAttribute('role','heading');node.setAttribute('aria-level','2');}});
    document.querySelectorAll('.page-id-531 .ctstyle-document-copy,.page-id-586 .ctstyle-document-copy,.page-id-7860 .ctstyle-document-copy').forEach(function(node){node.lang='en';node.dir='ltr';});
  }
  function refresh(tag){
    if(!allowed())return;
    locale=resolveLocale(tag)||resolveLocale(window.CalorieTokenDiscoveryUI&&window.CalorieTokenDiscoveryUI.getLocale())||resolveLocale(document.documentElement.lang)||locale;if(!cfg.copy[locale])locale='en';
    if(observer)observer.disconnect();
    [['paper',cfg.paperImage],['header',cfg.headerImage],['title',cfg.titleImage]].forEach(function(pair){if(/^https?:\/\//.test(pair[1]||''))document.body.style.setProperty('--ctstyle-'+pair[0]+'-image','url('+JSON.stringify(pair[1])+')');});
    pruneHeadings();sharedHeader();widgetLabels();structuralPolish();
    document.querySelectorAll('.showcase-hero h1,.showcase-title-banner h1').forEach(function(node){node.classList.add('ctstyle-heading');var box=node.closest('.showcase-hero,.showcase-title-banner');if(box)box.classList.add('ctstyle-shared-banner');});
    sharedPanels();
    // These observed builder section titles are paragraphs/spans rather than
    // heading tags. Preserve their contents while supplying heading semantics.
    document.querySelectorAll('.page-id-1207 [data-brz-custom-id="vOnO0_eybQxY"] p,.page-id-7224 p[data-uniq-id="vIP4b"],.ctstyle-roadmap-timeline>.brz-timeline__tab>.brz-timeline__nav--title,.brz-posts .brz-wp-title-content').forEach(function(node){node.classList.add('ctstyle-section-heading');node.setAttribute('role','heading');node.setAttribute('aria-level','2');});
    if(document.body.classList.contains('ctstyle-presentation-preview'))document.querySelectorAll('.entry-title,.brz-rich-text h1').forEach(function(node){node.classList.add('ctstyle-heading','ctstyle-shared-banner');});
    document.querySelectorAll(headings).forEach(function(node){
      if(window.CalorieTokenContentLanguageUI&&window.CalorieTokenContentLanguageUI.decorateHeading)window.CalorieTokenContentLanguageUI.decorateHeading(node,paintHeading);else paintHeading(node);
    });
    if(observer)observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  }
  window.CalorieTokenPresentationUI={refresh:refresh,paintHeading:paintHeading};
  if(typeof window.MutationObserver==='function')observer=new window.MutationObserver(function(records){
    if(queued||!records.some(function(r){
      var target=r.target.nodeType===3?r.target.parentElement:r.target;
      if(!target)return false;
      if(r.type==='characterData')return !!target.closest(headings)&&!target.closest(excluded);
      if(target.closest('.xl-card-balance,.xl-card-rank,.xl-card-note'))return true;
      if(target.closest(headings)&&!target.closest(excluded))return true;
      return Array.from(r.addedNodes).some(function(n){
        if(n.nodeType!==1)return false;
        if(n.matches('.xl-card')||n.querySelector('.xl-card'))return true;
        return !r.target.closest(excluded)&&!n.matches('.ctstyle-word-initial')&&!n.closest('.ctstyle-menu-groups');
      });
    }))return;
    queued=true;window.requestAnimationFrame(function(){queued=false;refresh();});
  });
  document.addEventListener('click',function(e){document.querySelectorAll('.ctstyle-menu-category[open]').forEach(function(details){if(!details.contains(e.target))details.open=false;});});
  document.addEventListener('calorietoken:display-language',function(e){refresh(e.detail&&e.detail.locale);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){refresh();},{once:true});else refresh();
  window.addEventListener('load',function(){refresh();},{once:true});
  window.addEventListener('pagehide',function(){if(observer)observer.disconnect();if(headingHighlight)headingHighlight.clear();highlightedHeadings.clear();headingRangeMap=new WeakMap();});
  window.addEventListener('pageshow',function(){refresh();});
})();
