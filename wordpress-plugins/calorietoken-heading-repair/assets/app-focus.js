/* CalorieApp focus view and read-only app-session indicator. GPL-2.0-or-later. */
(function(){'use strict';
  var allowedOrigins=['https://app.calorietoken.net','https://calorieapp-frontend.onrender.com'];
  var labels={
    en:{expand:'Maximize CalorieApp',shrink:'Return to page',hint:'CalorieHelp remains available in this view.',entered:'CalorieApp maximized. Press Escape to return.',exited:'Returned to the page.',session:'CalorieApp login',checking:'Checking…',authenticated:'Signed in',signed_out:'Not signed in',unavailable:'Open CalorieApp to check'},
    nl:{expand:'CalorieApp maximaliseren',shrink:'Terug naar de pagina',hint:'CalorieHelp blijft in deze weergave beschikbaar.',entered:'CalorieApp is gemaximaliseerd. Druk op Escape om terug te gaan.',exited:'Teruggekeerd naar de pagina.',session:'CalorieApp-login',checking:'Controleren…',authenticated:'Ingelogd',signed_out:'Niet ingelogd',unavailable:'Open CalorieApp om te controleren'},
    'zh-Hans':{expand:'最大化 CalorieApp',shrink:'返回页面',hint:'此视图中仍可使用 CalorieHelp。',entered:'CalorieApp 已最大化。按 Escape 返回。',exited:'已返回页面。',session:'CalorieApp 登录',checking:'正在检查…',authenticated:'已登录',signed_out:'未登录',unavailable:'打开 CalorieApp 进行检查'},
    hi:{expand:'CalorieApp बड़ा करें',shrink:'पेज पर वापस जाएँ',hint:'इस दृश्य में CalorieHelp उपलब्ध रहता है।',entered:'CalorieApp बड़ा किया गया है। वापस जाने के लिए Escape दबाएँ।',exited:'पेज पर वापस आ गए।',session:'CalorieApp लॉगिन',checking:'जाँच हो रही है…',authenticated:'साइन इन है',signed_out:'साइन इन नहीं है',unavailable:'जाँचने के लिए CalorieApp खोलें'},
    es:{expand:'Maximizar CalorieApp',shrink:'Volver a la página',hint:'CalorieHelp sigue disponible en esta vista.',entered:'CalorieApp está maximizada. Pulsa Escape para volver.',exited:'Has vuelto a la página.',session:'Inicio de sesión de CalorieApp',checking:'Comprobando…',authenticated:'Sesión iniciada',signed_out:'Sesión no iniciada',unavailable:'Abre CalorieApp para comprobarlo'},
    ar:{expand:'تكبير CalorieApp',shrink:'العودة إلى الصفحة',hint:'يبقى CalorieHelp متاحاً في هذا العرض.',entered:'تم تكبير CalorieApp. اضغط Escape للعودة.',exited:'تمت العودة إلى الصفحة.',session:'تسجيل دخول CalorieApp',checking:'جارٍ التحقق…',authenticated:'تم تسجيل الدخول',signed_out:'لم يتم تسجيل الدخول',unavailable:'افتح CalorieApp للتحقق'},
    fr:{expand:'Agrandir CalorieApp',shrink:'Revenir à la page',hint:'CalorieHelp reste disponible dans cette vue.',entered:'CalorieApp est agrandie. Appuyez sur Échap pour revenir.',exited:'Retour à la page.',session:'Connexion CalorieApp',checking:'Vérification…',authenticated:'Connecté',signed_out:'Non connecté',unavailable:'Ouvrez CalorieApp pour vérifier'},
    bn:{expand:'CalorieApp বড় করুন',shrink:'পৃষ্ঠায় ফিরুন',hint:'এই দৃশ্যে CalorieHelp ব্যবহার করা যাবে।',entered:'CalorieApp বড় করা হয়েছে। ফিরতে Escape চাপুন।',exited:'পৃষ্ঠায় ফেরা হয়েছে।',session:'CalorieApp লগইন',checking:'যাচাই করা হচ্ছে…',authenticated:'লগইন করা',signed_out:'লগইন করা নেই',unavailable:'যাচাই করতে CalorieApp খুলুন'},
    pt:{expand:'Maximizar a CalorieApp',shrink:'Voltar à página',hint:'O CalorieHelp continua disponível nesta vista.',entered:'A CalorieApp está maximizada. Prima Escape para voltar.',exited:'Regressou à página.',session:'Início de sessão da CalorieApp',checking:'A verificar…',authenticated:'Sessão iniciada',signed_out:'Sessão não iniciada',unavailable:'Abra a CalorieApp para verificar'},
    id:{expand:'Maksimalkan CalorieApp',shrink:'Kembali ke halaman',hint:'CalorieHelp tetap tersedia dalam tampilan ini.',entered:'CalorieApp dimaksimalkan. Tekan Escape untuk kembali.',exited:'Kembali ke halaman.',session:'Login CalorieApp',checking:'Memeriksa…',authenticated:'Sudah masuk',signed_out:'Belum masuk',unavailable:'Buka CalorieApp untuk memeriksa'},
    ur:{expand:'CalorieApp کو بڑا کریں',shrink:'صفحے پر واپس جائیں',hint:'اس منظر میں CalorieHelp دستیاب رہتا ہے۔',entered:'CalorieApp بڑا کر دیا گیا ہے۔ واپس جانے کے لیے Escape دبائیں۔',exited:'صفحے پر واپس آ گئے۔',session:'CalorieApp لاگ اِن',checking:'جانچ جاری ہے…',authenticated:'لاگ اِن ہے',signed_out:'لاگ اِن نہیں ہے',unavailable:'جانچنے کے لیے CalorieApp کھولیں'}
  };
  var focus={frame:null,button:null,label:null,status:null,toolbar:null,scrollY:0};
  var sessionState='unavailable',sessionNode=null,sessionValue=null;
  function locale(preferred){
    var picker=document.querySelector('#ctstyle-language-select,#ctstyle-account-language');
    var value=typeof preferred==='string'&&preferred||picker&&picker.value||document.documentElement.lang||'en';
    if(/^zh(?:-|$)/i.test(value))return 'zh-Hans';
    value=value.split('-')[0];return labels[value]?value:'en';
  }
  function copy(preferred){return labels[locale(preferred)]||labels.en;}
  function eligibleFrames(){return Array.from(document.querySelectorAll('iframe[title="CalorieApp"]')).filter(function(frame){
    try{return allowedOrigins.includes(new URL(frame.src,window.location.href).origin);}catch(_){return false;}
  });}
  function setFocus(on,announce){
    if(!focus.frame||!focus.button)return;
    var active=document.body.classList.contains('ct-calorieapp-focus');
    if(active===on){updateLabels();return;}
    if(on){
      focus.scrollY=window.scrollY||0;updateTop();
      focus.frame.dataset.ctFocusTarget='true';document.body.classList.add('ct-calorieapp-focus');
    }else{
      document.body.classList.remove('ct-calorieapp-focus');delete focus.frame.dataset.ctFocusTarget;
      document.documentElement.style.removeProperty('--ct-calorieapp-focus-top');
      window.requestAnimationFrame(function(){window.scrollTo(0,focus.scrollY);focus.button.focus({preventScroll:true});});
    }
    focus.button.setAttribute('aria-pressed',String(on));updateLabels();
    if(announce&&focus.status)focus.status.textContent=on?copy().entered:copy().exited;
  }
  function updateTop(){
    var bar=document.getElementById('wpadminbar'),height=bar&&getComputedStyle(bar).display!=='none'?Math.max(0,bar.getBoundingClientRect().height):0;
    document.documentElement.style.setProperty('--ct-calorieapp-focus-top',height+'px');
  }
  function updateLabels(preferred){
    var c=copy(preferred),active=document.body.classList.contains('ct-calorieapp-focus');
    if(focus.label)focus.label.textContent=active?c.shrink:c.expand;
    if(focus.button){focus.button.title=active?c.shrink:c.expand;focus.button.setAttribute('aria-label',active?c.shrink:c.expand);}
    var note=focus.toolbar&&focus.toolbar.querySelector('.ct-calorieapp-focus-note');if(note)note.textContent=c.hint;
    if(sessionNode){sessionNode.querySelector('.ct-calorieapp-session-label').textContent=c.session;sessionValue.textContent=c[sessionState]||c.unavailable;}
  }
  function installFocus(){
    if(focus.button&&focus.button.isConnected)return true;
    var frames=eligibleFrames();if(frames.length!==1)return false;
    var frame=frames[0],toolbar=document.createElement('div'),button=document.createElement('button'),icon=document.createElement('span'),label=document.createElement('span'),note=document.createElement('span'),status=document.createElement('span');
    toolbar.id='ct-calorieapp-focus-toolbar';toolbar.className='ct-calorieapp-focus-toolbar';
    button.type='button';button.id='ct-calorieapp-focus-toggle';button.className='ct-calorieapp-focus-toggle';button.setAttribute('aria-pressed','false');
    icon.className='ct-calorieapp-focus-icon';icon.setAttribute('aria-hidden','true');icon.textContent='⛶';
    label.className='ct-calorieapp-focus-label';note.className='ct-calorieapp-focus-note';status.className='ct-calorieapp-focus-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    button.append(icon,label);toolbar.append(button,note,status);frame.before(toolbar);
    focus={frame:frame,button:button,label:label,status:status,toolbar:toolbar,scrollY:0};
    button.addEventListener('click',function(event){
      event.stopPropagation();
      setFocus(!document.body.classList.contains('ct-calorieapp-focus'),true);
    });
    frame.addEventListener('load',function(){setSession('checking');});updateLabels();return true;
  }
  function setSession(value){
    if(!['checking','authenticated','signed_out','unavailable'].includes(value))return;
    sessionState=value;if(sessionNode){sessionNode.dataset.state=value;updateLabels();}
  }
  function installSession(){
    if(sessionNode&&sessionNode.isConnected)return true;
    var account=document.getElementById('ctstyle-account-app');if(!account)return false;
    var node=document.createElement('div'),dot=document.createElement('span'),text=document.createElement('span'),key=document.createElement('span'),value=document.createElement('strong');
    node.id='ct-calorieapp-session-indicator';node.className='ct-calorieapp-session-indicator';node.setAttribute('role','status');node.setAttribute('aria-live','polite');
    dot.className='ct-calorieapp-session-dot';dot.setAttribute('aria-hidden','true');text.className='ct-calorieapp-session-copy';key.className='ct-calorieapp-session-label';value.className='ct-calorieapp-session-value';
    text.append(key,value);node.append(dot,text);var brand=account.querySelector('.ctstyle-account-app-brand');if(brand)brand.after(node);else account.prepend(node);
    sessionNode=node;sessionValue=value;setSession(eligibleFrames().length===1?'checking':'unavailable');return true;
  }
  function install(){var a=installFocus(),b=installSession();return a&&b;}
  window.addEventListener('message',function(event){
    var frames=eligibleFrames(),frame=frames.length===1?frames[0]:null;
    if(!frame||event.source!==frame.contentWindow||!allowedOrigins.includes(event.origin)||!event.data||typeof event.data.type!=='string')return;
    if(event.data.type==='calorieapp:bridge:initialized')setSession('checking');
    if(event.data.type==='calorieapp:login:complete')setSession('authenticated');
    if(event.data.type==='calorieapp:logout:complete')setSession('signed_out');
    if(event.data.type==='calorieapp:session:state'&&event.data.version===1)setSession(event.data.status);
    if(event.data.type==='calorieapp:navigation:target'&&event.data.version===1&&!document.body.classList.contains('ct-calorieapp-focus')){
      var targets=['calorieapp-navigation','calorieapp-account','calorieapp-add','calorieapp-diary'];
      var offset=event.data.offset,frameHeight=Math.max(frame.getBoundingClientRect().height,frame.offsetHeight||0);
      if(targets.includes(event.data.target)&&typeof offset==='number'&&Number.isFinite(offset)&&offset>=0&&offset<=frameHeight+512){
        var top=(window.scrollY||0)+frame.getBoundingClientRect().top+offset-16;
        window.scrollTo({top:Math.max(0,top),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      }
    }
  });
  document.addEventListener('change',function(event){
    if(event.target&&event.target.matches&&event.target.matches('#ctstyle-language-select,#ctstyle-account-language'))updateLabels(event.target.value);
  },true);
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&document.body.classList.contains('ct-calorieapp-focus'))setFocus(false,true);});
  window.addEventListener('resize',function(){if(document.body.classList.contains('ct-calorieapp-focus'))updateTop();});
  window.addEventListener('pagehide',function(){setFocus(false,false);});
  function ready(){
    if(install())return;var observer=new MutationObserver(function(){if(install())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});
    window.setTimeout(function(){observer.disconnect();install();},10000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
