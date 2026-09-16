/* Resolve the public display language before visible widgets are built. GPL-2.0-or-later. */
(function(){'use strict';
  var tags=['en','nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur'];
  var aliases={'zh':'zh-Hans','zh-cn':'zh-Hans','zh-sg':'zh-Hans'};
  var key='calorieapp.display-language.v1',lifetime=30*24*60*60*1000;
  function resolve(value){
    if(typeof value!=='string')return null;
    var values=value.split(',');
    for(var i=0;i<values.length;i+=1){
      var raw=values[i].split(';')[0].trim().replace(/_/g,'-'),lower=raw.toLowerCase();
      var exact=tags.find(function(tag){return tag.toLowerCase()===lower;});
      if(exact)return exact;
      if(aliases[lower])return aliases[lower];
      var primary=lower.split('-')[0],base=tags.find(function(tag){return tag.toLowerCase()===primary;});
      if(base)return base;
    }
    return null;
  }
  function saved(){try{
    var value=JSON.parse(window.localStorage.getItem(key));
    if(value&&Object.keys(value).length===2&&typeof value.locale==='string'&&typeof value.savedAt==='number'&&
      value.savedAt<=Date.now()&&Date.now()-value.savedAt<lifetime)return resolve(value.locale);
  }catch(_){}return null;}
  var query=new URL(window.location.href).searchParams;
  var explicit=resolve(query.get('ui_lang')||query.get('locale'));
  var browser=resolve((navigator.languages||[]).join(','))||resolve(navigator.language);
  var site=resolve(document.documentElement.lang);
  var locale=explicit||saved()||browser||site||'nl';
  document.documentElement.lang=locale;
  document.documentElement.dir=['ar','ur'].indexOf(locale)>=0?'rtl':'ltr';
  document.documentElement.dataset.ctDisplayLocale=locale;
  function reconcile(){
    var ui=window.CalorieTokenContentLanguageUI;
    if(ui&&typeof ui.refresh==='function')ui.refresh(locale);
  }
  function schedule(){[0,250,1000].forEach(function(delay){window.setTimeout(reconcile,delay);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('pageshow',schedule);
  document.addEventListener('calorietoken:display-language',function(event){locale=resolve(event.detail&&event.detail.locale)||locale;schedule();});
})();
