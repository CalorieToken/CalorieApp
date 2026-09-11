/* Shared presentation over the current WordPress menu; no account or provider requests. */
(function () {
  'use strict';
  var cfg=window.CalorieTokenPresentation;
  if(!cfg||window.CalorieTokenPresentationUI)return;
  var observer=null, queued=false, locale='en', menus=new WeakMap();
  var bodySelector='.ctstyle-enabled,.ctstyle-footer-only,.ctstyle-presentation-preview';
  var headings='.ctstyle-heading,.ctstyle-crypto-intro h2,.showcase-hero h1,.showcase-title-banner h1';
  var excluded='a,button,input,select,textarea,svg,script,style,iframe,[contenteditable],.xl-card,[data-calorieapp-account]';
  function allowed(){return document.body&&document.body.matches(bodySelector)&&!document.querySelector('.brz-ed,#brz-ed-iframe')&&['https://calorietoken.net','https://www.calorietoken.net'].includes(window.location.origin)&&!/\/wp-admin\//.test(window.location.pathname);}
  function path(value){try{return new URL(value,window.location.href).pathname.replace(/^\/index\.php(?=\/)/,'').replace(/\/+$/,'')||'/';}catch(e){return '';}}
  function category(value){
    if(['/whitepaper','/showcases','/roadmap','/tokenomics-update'].includes(value))return 'project';
    if(['/how-to-buy-calorie','/trustline','/richlist'].includes(value))return 'crypto';
    if(['/community-voting-hub-info','/blog','/donate','/merchnfts'].includes(value))return 'community';
    if(['/contact','/faq'].includes(value))return 'help';
    return '';
  }
  function link(row){
    var a=document.createElement('a');a.textContent=row.title;a.href=row.url;
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
  function paintHeading(node){
    if(!node.matches(headings)||node.closest(excluded)||node.querySelector(excluded))return;
    if(node.dataset.ctstyleColorText===node.textContent&&node.querySelector('.ctstyle-word-initial'))return;
    node.querySelectorAll('.ctstyle-word-initial').forEach(function(span){span.replaceWith(document.createTextNode(span.textContent));});
    node.normalize();
    function walk(parent){Array.from(parent.childNodes).forEach(function(child){
      if(child.nodeType===1){walk(child);return;}if(child.nodeType!==3)return;
      var text=child.data, regex=/\p{L}[\p{L}\p{M}\p{N}'’]*/gu, match, last=0, fragment=document.createDocumentFragment(), found=false;
      while((match=regex.exec(text))){
        found=true;fragment.appendChild(document.createTextNode(text.slice(last,match.index)));
        var word=match[0],first=Array.from(word)[0];
        if(typeof Intl.Segmenter==='function')first=Array.from(new Intl.Segmenter(locale,{granularity:'grapheme'}).segment(word))[0].segment;
        var initial=document.createElement('span');initial.className='ctstyle-word-initial';initial.textContent=first;
        fragment.append(initial,document.createTextNode(word.slice(first.length)));last=match.index+word.length;
      }
      if(found){fragment.appendChild(document.createTextNode(text.slice(last)));child.replaceWith(fragment);}
    });}
    walk(node);node.classList.add('ctstyle-word-heading');node.dataset.ctstyleColorText=node.textContent;
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
  }
  function refresh(tag){
    if(!allowed())return;
    locale=tag||(window.CalorieTokenDiscoveryUI&&window.CalorieTokenDiscoveryUI.getLocale())||locale;if(!cfg.copy[locale])locale='en';
    if(observer)observer.disconnect();
    [['paper',cfg.paperImage],['header',cfg.headerImage],['title',cfg.titleImage]].forEach(function(pair){if(/^https?:\/\//.test(pair[1]||''))document.body.style.setProperty('--ctstyle-'+pair[0]+'-image','url('+JSON.stringify(pair[1])+')');});
    sharedHeader();
    document.querySelectorAll('.showcase-hero h1,.showcase-title-banner h1').forEach(function(node){node.classList.add('ctstyle-heading');var box=node.closest('.showcase-hero,.showcase-title-banner');if(box)box.classList.add('ctstyle-shared-banner');});
    document.querySelectorAll('.ctstyle-crypto-intro,.showcase-intro,.showcase-next,.ctstyle-document-copy,.calorieapp-app-info,.ctstyle-faq-hub,.ctstyle-discovery-card').forEach(function(node){node.classList.add('ctstyle-shared-panel');});
    if(document.body.classList.contains('ctstyle-presentation-preview'))document.querySelectorAll('.entry-title,.brz-rich-text h1').forEach(function(node){node.classList.add('ctstyle-heading','ctstyle-shared-banner');});
    document.querySelectorAll(headings).forEach(function(node){
      if(window.CalorieTokenContentLanguageUI&&window.CalorieTokenContentLanguageUI.decorateHeading)window.CalorieTokenContentLanguageUI.decorateHeading(node,paintHeading);else paintHeading(node);
    });
    if(observer)observer.observe(document.body,{subtree:true,childList:true});
  }
  window.CalorieTokenPresentationUI={refresh:refresh,paintHeading:paintHeading};
  if(typeof window.MutationObserver==='function')observer=new window.MutationObserver(function(records){
    if(queued||!records.some(function(r){return !r.target.closest(excluded)&&Array.from(r.addedNodes).some(function(n){return n.nodeType===1&&!n.matches('.ctstyle-word-initial')&&!n.closest('.ctstyle-menu-groups');});}))return;
    queued=true;window.requestAnimationFrame(function(){queued=false;refresh();});
  });
  document.addEventListener('click',function(e){document.querySelectorAll('.ctstyle-menu-category[open]').forEach(function(details){if(!details.contains(e.target))details.open=false;});});
  document.addEventListener('calorietoken:display-language',function(e){refresh(e.detail&&e.detail.locale);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){refresh();},{once:true});else refresh();
  window.addEventListener('load',function(){refresh();},{once:true});
  window.addEventListener('pagehide',function(){if(observer)observer.disconnect();});
  window.addEventListener('pageshow',function(){refresh();});
})();
