/* CalorieApp focus view and read-only app-session indicator. GPL-2.0-or-later. */
(function(){'use strict';
  var allowedOrigins=['https://app.calorietoken.net','https://calorieapp-frontend.onrender.com'];
  var labels={
    en:{expand:'Maximize CalorieApp',shrink:'Return to page',hint:'CalorieHelp remains available in this view.',entered:'CalorieApp maximized. Press Escape to return.',exited:'Returned to the page.',session:'CalorieApp login',checking:'Checking…',authenticated:'Signed in',signed_out:'Not signed in',unavailable:'Open CalorieApp to check',starting:'CalorieApp is starting',slow:'CalorieApp is taking longer to start. You can keep waiting or try again.',retry:'Try again',show:'Show app'},
    nl:{expand:'CalorieApp maximaliseren',shrink:'Terug naar de pagina',hint:'CalorieHelp blijft in deze weergave beschikbaar.',entered:'CalorieApp is gemaximaliseerd. Druk op Escape om terug te gaan.',exited:'Teruggekeerd naar de pagina.',session:'CalorieApp-login',checking:'Controleren…',authenticated:'Ingelogd',signed_out:'Niet ingelogd',unavailable:'Open CalorieApp om te controleren',starting:'CalorieApp wordt gestart',slow:'Het starten van CalorieApp duurt langer. Je kunt blijven wachten of het opnieuw proberen.',retry:'Opnieuw proberen',show:'App tonen'},
    'zh-Hans':{expand:'最大化 CalorieApp',shrink:'返回页面',hint:'此视图中仍可使用 CalorieHelp。',entered:'CalorieApp 已最大化。按 Escape 返回。',exited:'已返回页面。',session:'CalorieApp 登录',checking:'正在检查…',authenticated:'已登录',signed_out:'未登录',unavailable:'打开 CalorieApp 进行检查',starting:'CalorieApp 正在启动',slow:'CalorieApp 启动时间较长。你可以继续等待或重试。',retry:'重试',show:'显示应用'},
    hi:{expand:'CalorieApp बड़ा करें',shrink:'पेज पर वापस जाएँ',hint:'इस दृश्य में CalorieHelp उपलब्ध रहता है।',entered:'CalorieApp बड़ा किया गया है। वापस जाने के लिए Escape दबाएँ।',exited:'पेज पर वापस आ गए।',session:'CalorieApp लॉगिन',checking:'जाँच हो रही है…',authenticated:'साइन इन है',signed_out:'साइन इन नहीं है',unavailable:'जाँचने के लिए CalorieApp खोलें',starting:'CalorieApp शुरू हो रहा है',slow:'CalorieApp शुरू होने में अधिक समय लग रहा है। आप प्रतीक्षा कर सकते हैं या फिर कोशिश कर सकते हैं।',retry:'फिर कोशिश करें',show:'ऐप दिखाएँ'},
    es:{expand:'Maximizar CalorieApp',shrink:'Volver a la página',hint:'CalorieHelp sigue disponible en esta vista.',entered:'CalorieApp está maximizada. Pulsa Escape para volver.',exited:'Has vuelto a la página.',session:'Inicio de sesión de CalorieApp',checking:'Comprobando…',authenticated:'Sesión iniciada',signed_out:'Sesión no iniciada',unavailable:'Abre CalorieApp para comprobarlo',starting:'CalorieApp se está iniciando',slow:'CalorieApp tarda más de lo esperado. Puedes seguir esperando o intentarlo de nuevo.',retry:'Intentar de nuevo',show:'Mostrar app'},
    ar:{expand:'تكبير CalorieApp',shrink:'العودة إلى الصفحة',hint:'يبقى CalorieHelp متاحاً في هذا العرض.',entered:'تم تكبير CalorieApp. اضغط Escape للعودة.',exited:'تمت العودة إلى الصفحة.',session:'تسجيل دخول CalorieApp',checking:'جارٍ التحقق…',authenticated:'تم تسجيل الدخول',signed_out:'لم يتم تسجيل الدخول',unavailable:'افتح CalorieApp للتحقق',starting:'جارٍ تشغيل CalorieApp',slow:'يستغرق تشغيل CalorieApp وقتاً أطول. يمكنك الانتظار أو المحاولة مرة أخرى.',retry:'المحاولة مرة أخرى',show:'إظهار التطبيق'},
    fr:{expand:'Agrandir CalorieApp',shrink:'Revenir à la page',hint:'CalorieHelp reste disponible dans cette vue.',entered:'CalorieApp est agrandie. Appuyez sur Échap pour revenir.',exited:'Retour à la page.',session:'Connexion CalorieApp',checking:'Vérification…',authenticated:'Connecté',signed_out:'Non connecté',unavailable:'Ouvrez CalorieApp pour vérifier',starting:'CalorieApp démarre',slow:'Le démarrage de CalorieApp prend plus de temps. Vous pouvez patienter ou réessayer.',retry:'Réessayer',show:"Afficher l’app"},
    bn:{expand:'CalorieApp বড় করুন',shrink:'পৃষ্ঠায় ফিরুন',hint:'এই দৃশ্যে CalorieHelp ব্যবহার করা যাবে।',entered:'CalorieApp বড় করা হয়েছে। ফিরতে Escape চাপুন।',exited:'পৃষ্ঠায় ফেরা হয়েছে।',session:'CalorieApp লগইন',checking:'যাচাই করা হচ্ছে…',authenticated:'লগইন করা',signed_out:'লগইন করা নেই',unavailable:'যাচাই করতে CalorieApp খুলুন',starting:'CalorieApp চালু হচ্ছে',slow:'CalorieApp চালু হতে বেশি সময় লাগছে। অপেক্ষা করুন বা আবার চেষ্টা করুন।',retry:'আবার চেষ্টা করুন',show:'অ্যাপ দেখান'},
    pt:{expand:'Maximizar a CalorieApp',shrink:'Voltar à página',hint:'O CalorieHelp continua disponível nesta vista.',entered:'A CalorieApp está maximizada. Prima Escape para voltar.',exited:'Regressou à página.',session:'Início de sessão da CalorieApp',checking:'A verificar…',authenticated:'Sessão iniciada',signed_out:'Sessão não iniciada',unavailable:'Abra a CalorieApp para verificar',starting:'A CalorieApp está a iniciar',slow:'A CalorieApp está a demorar mais a iniciar. Pode continuar a aguardar ou tentar novamente.',retry:'Tentar novamente',show:'Mostrar aplicação'},
    id:{expand:'Maksimalkan CalorieApp',shrink:'Kembali ke halaman',hint:'CalorieHelp tetap tersedia dalam tampilan ini.',entered:'CalorieApp dimaksimalkan. Tekan Escape untuk kembali.',exited:'Kembali ke halaman.',session:'Login CalorieApp',checking:'Memeriksa…',authenticated:'Sudah masuk',signed_out:'Belum masuk',unavailable:'Buka CalorieApp untuk memeriksa',starting:'CalorieApp sedang dimulai',slow:'CalorieApp memerlukan waktu lebih lama untuk dimulai. Anda dapat menunggu atau mencoba lagi.',retry:'Coba lagi',show:'Tampilkan aplikasi'},
    ur:{expand:'CalorieApp کو بڑا کریں',shrink:'صفحے پر واپس جائیں',hint:'اس منظر میں CalorieHelp دستیاب رہتا ہے۔',entered:'CalorieApp بڑا کر دیا گیا ہے۔ واپس جانے کے لیے Escape دبائیں۔',exited:'صفحے پر واپس آ گئے۔',session:'CalorieApp لاگ اِن',checking:'جانچ جاری ہے…',authenticated:'لاگ اِن ہے',signed_out:'لاگ اِن نہیں ہے',unavailable:'جانچنے کے لیے CalorieApp کھولیں',starting:'CalorieApp شروع ہو رہی ہے',slow:'CalorieApp شروع ہونے میں زیادہ وقت لے رہی ہے۔ انتظار کریں یا دوبارہ کوشش کریں۔',retry:'دوبارہ کوشش کریں',show:'ایپ دکھائیں'}
  };
  var focus={frame:null,button:null,label:null,status:null,toolbar:null,scrollY:0},embedRepairs=new WeakSet();
  var sessionState='unavailable',sessionNode=null,sessionValue=null;
  var guidePrefix='calorieapp:testnet-guide:',guide={layer:null,root:null,frame:null,close:null,lastFocus:null,back:null};
  var guideLabels={
    en:{close:'Back to CalorieApp',dialog:'Secure test-account guide'},nl:{close:'Terug naar CalorieApp',dialog:'Veilige testaccounthulp'},
    'zh-Hans':{close:'返回 CalorieApp',dialog:'安全测试账户指南'},hi:{close:'CalorieApp पर वापस जाएँ',dialog:'सुरक्षित टेस्ट-खाता गाइड'},
    es:{close:'Volver a CalorieApp',dialog:'Guía segura de cuenta de prueba'},ar:{close:'العودة إلى CalorieApp',dialog:'دليل حساب الاختبار الآمن'},
    fr:{close:'Revenir à CalorieApp',dialog:'Guide sécurisé du compte test'},bn:{close:'CalorieApp-এ ফিরুন',dialog:'নিরাপদ টেস্ট-অ্যাকাউন্ট নির্দেশিকা'},
    pt:{close:'Voltar à CalorieApp',dialog:'Guia seguro da conta de teste'},id:{close:'Kembali ke CalorieApp',dialog:'Panduan akun uji yang aman'},
    ur:{close:'CalorieApp پر واپس جائیں',dialog:'محفوظ ٹیسٹ اکاؤنٹ رہنما'}
  };
  function pagePath(){return window.location.pathname.replace(/^\/index\.php(?=\/|$)/,'').replace(/\/+$/,'')||'/';}
  function isCalorieAppPage(){return document.body.classList.contains('page-id-7880')||pagePath()==='/calorieapp';}
  function markPageMode(){
    var appPage=isCalorieAppPage();
    document.body.classList.toggle('ct-calorieapp-page',appPage);
    document.body.classList.toggle('ct-account-compact',!appPage);
    return appPage;
  }
  function locale(preferred){
    var picker=document.querySelector('#ctstyle-language-select,#ctstyle-account-language');
    var value=typeof preferred==='string'&&preferred||picker&&picker.value||document.documentElement.lang||'en';
    if(/^zh(?:-|$)/i.test(value))return 'zh-Hans';
    value=value.split('-')[0];return labels[value]?value:'en';
  }
  function copy(preferred){return labels[locale(preferred)]||labels.en;}
  function guideCopy(preferred){return guideLabels[locale(preferred)]||guideLabels.en;}
  function localizeEmbedLoader(frame,preferred){
    var stage=frame&&frame.closest&&frame.closest('[data-calorieapp-frame-stage]'),loader=stage&&stage.querySelector('[data-calorieapp-embed-loading]');
    if(!loader)return;var c=copy(preferred),heading=loader.querySelector('strong'),message=loader.querySelector('[data-calorieapp-loading-message]'),retry=loader.querySelector('[data-calorieapp-loading-retry]'),show=loader.querySelector('[data-calorieapp-loading-reveal]');
    if(heading)heading.textContent=c.starting;if(message)message.textContent=c.slow;if(retry)retry.textContent=c.retry;if(show)show.textContent=c.show;loader.dataset.slowMessage=c.slow;
  }
  function repairEmbed(frame){
    if(!frame||embedRepairs.has(frame))return;embedRepairs.add(frame);
    var desired=locale(),root=frame.closest('[data-calorieapp-embed]');if(root)root.dataset.locale=desired;
    // Do not rewrite an already loading iframe merely to change its display
    // locale. Aborting Next.js' first document can surface a harmless but noisy
    // "Connection closed" error. The trusted host protocol sends the resolved
    // display language, while language-bootstrap synchronises this root before
    // the identity bridge captures its login locale.
    localizeEmbedLoader(frame,desired);
    var stage=frame.closest('[data-calorieapp-frame-stage]'),loader=stage&&stage.querySelector('[data-calorieapp-embed-loading]'),reveal=loader&&loader.querySelector('[data-calorieapp-loading-reveal]');
    if(!loader||!reveal)return;
    var show=function(){if(loader.isConnected&&!loader.hidden&&!reveal.disabled){
      // Twenty Nineteen's document click handler assumes a menu target and
      // crashes when this automatic first-party reveal bubbles to document.
      // Keep the loader's own click handler intact while containing the event.
      reveal.addEventListener('click',function(event){event.stopPropagation();},{once:true});reveal.click();
    }};
    frame.addEventListener('load',function(){window.setTimeout(show,350);});
    var observer=new MutationObserver(function(){if(loader.dataset.loadingReady==='1'){observer.disconnect();window.setTimeout(show,0);}});
    observer.observe(loader,{attributes:true,attributeFilter:['data-loading-ready']});
    if(loader.dataset.loadingReady==='1'){observer.disconnect();window.setTimeout(show,0);}
  }
  function eligibleFrames(){return Array.from(document.querySelectorAll('[data-calorieapp-embed] iframe[title="CalorieApp"]')).filter(function(frame){
    try{var url=new URL(frame.src,window.location.href);return allowedOrigins.includes(url.origin)&&url.pathname==='/'&&!url.username&&!url.password&&!frame.closest('form,[contenteditable],[hidden],[inert]');}catch(_){return false;}
  });}
  function exactGuideMessage(data,type){return data&&typeof data==='object'&&!Array.isArray(data)&&Object.keys(data).length===2&&data.type===guidePrefix+type&&data.version===1;}
  function postGuide(frame,type){
    if(!frame||!frame.contentWindow)return;var origin;try{origin=new URL(frame.src,window.location.href).origin;}catch(_){return;}
    if(!allowedOrigins.includes(origin))return;frame.contentWindow.postMessage({type:guidePrefix+type,version:1},origin);
  }
  function bindGuideCompletion(){
    if(!guide.root)return;var buttons=guide.root.querySelectorAll('#ctstyle-testnet-step-4 button'),back=buttons.length?buttons[buttons.length-1]:null;
    if(!back||back===guide.back)return;guide.back=back;back.addEventListener('click',function(){window.setTimeout(function(){closeGuide(true);},0);});
  }
  function closeGuide(completed,announce){
    if(!guide.layer||!document.body.classList.contains('ct-testnet-guide-open'))return;
    document.body.classList.remove('ct-testnet-guide-open');guide.layer.setAttribute('aria-hidden','true');guide.layer.hidden=true;
    if(window.CalorieTokenTestnet&&window.CalorieTokenTestnet.conceal)window.CalorieTokenTestnet.conceal();
    if(announce!==false&&guide.frame)postGuide(guide.frame,completed?'complete':'closed');
    var target=guide.frame&&guide.frame.isConnected?guide.frame:guide.lastFocus;guide.lastFocus=null;
    if(target&&target.focus){target.focus({preventScroll:true});if(announce!==false&&target.scrollIntoView)target.scrollIntoView({block:'start',behavior:'auto'});}
  }
  function openGuide(frame){
    var age=window.CalorieTokenAgeExperience&&window.CalorieTokenAgeExperience.getBand&&window.CalorieTokenAgeExperience.getBand();
    if(age!=='adult'||!guide.layer||!guide.root)return;
    setFocus(false,false);guide.frame=frame||guide.frame;guide.lastFocus=document.activeElement;bindGuideCompletion();
    guide.layer.setAttribute('aria-hidden','false');guide.layer.hidden=false;document.body.classList.add('ct-testnet-guide-open');
    var disclosure=guide.root.querySelector('.ctstyle-testnet-disclosure');if(disclosure)disclosure.open=true;
    if(guide.layer.scrollIntoView)guide.layer.scrollIntoView({block:'start',behavior:'auto'});
    var heading=guide.root.querySelector('.ctstyle-testnet-step:not([hidden]) h3,.ctstyle-testnet-welcome:not([hidden]) h3')||guide.root.querySelector('h2,h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}else if(guide.close)guide.close.focus({preventScroll:true});
  }
  function installGuide(){
    if(!isCalorieAppPage())return true;if(guide.layer&&guide.layer.isConnected){bindGuideCompletion();return true;}
    var root=document.querySelector('#ctstyle-testnet[data-ctstyle-testnet="1"]'),frames=eligibleFrames();if(!root||frames.length!==1)return false;
    var layer=document.createElement('div'),panel=document.createElement('div'),close=document.createElement('button');
    layer.id='ct-testnet-guide-layer';layer.className='ct-testnet-guide-layer';layer.setAttribute('role','region');layer.setAttribute('aria-hidden','true');layer.hidden=true;
    panel.className='ct-testnet-guide-panel';close.type='button';close.className='ct-testnet-guide-close';close.addEventListener('click',function(){closeGuide(false);});
    var brand=document.createElement('p');brand.className='ct-testnet-guide-brand';brand.textContent='CalorieApp';
    panel.append(brand,close,root);layer.append(panel);var embed=frames[0].closest('[data-calorieapp-embed]');embed.after(layer);guide={layer:layer,root:root,frame:frames[0],close:close,lastFocus:null,back:null};
    var observer=new MutationObserver(bindGuideCompletion);observer.observe(root,{childList:true,subtree:true});bindGuideCompletion();updateLabels();postGuide(frames[0],'available');
    if(window.location.hash==='#ctstyle-testnet')window.setTimeout(function(){openGuide(frames[0]);},0);return true;
  }
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
    if(focus.frame)localizeEmbedLoader(focus.frame,preferred);
    if(guide.layer&&guide.close){var g=guideCopy(preferred);guide.close.textContent=g.close;guide.close.setAttribute('aria-label',g.close);guide.layer.setAttribute('aria-label',g.dialog);}
  }
  function installFocus(){
    if(!isCalorieAppPage())return true;
    if(focus.button&&focus.button.isConnected)return true;
    var frames=eligibleFrames();if(frames.length!==1)return false;
    var frame=frames[0],toolbar=document.createElement('div'),button=document.createElement('button'),icon=document.createElement('span'),label=document.createElement('span'),note=document.createElement('span'),status=document.createElement('span');repairEmbed(frame);
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
    if(!isCalorieAppPage())return true;
    if(sessionNode&&sessionNode.isConnected)return true;
    var account=document.getElementById('ctstyle-account-app');if(!account)return false;
    var node=document.createElement('div'),dot=document.createElement('span'),text=document.createElement('span'),key=document.createElement('span'),value=document.createElement('strong');
    node.id='ct-calorieapp-session-indicator';node.className='ct-calorieapp-session-indicator';node.setAttribute('role','status');node.setAttribute('aria-live','polite');
    dot.className='ct-calorieapp-session-dot';dot.setAttribute('aria-hidden','true');text.className='ct-calorieapp-session-copy';key.className='ct-calorieapp-session-label';value.className='ct-calorieapp-session-value';
    text.append(key,value);node.append(dot,text);var brand=account.querySelector('.ctstyle-account-app-brand');if(brand)brand.after(node);else account.prepend(node);
    sessionNode=node;sessionValue=value;setSession(eligibleFrames().length===1?'checking':'unavailable');return true;
  }
  function install(){if(!markPageMode())return true;var a=installFocus(),b=installSession(),c=installGuide();return a&&b&&c;}
  window.addEventListener('message',function(event){
    var frames=eligibleFrames(),frame=frames.length===1?frames[0]:null;
    if(!frame||event.source!==frame.contentWindow||!allowedOrigins.includes(event.origin)||!event.data||typeof event.data.type!=='string')return;
    if(exactGuideMessage(event.data,'ready')){guide.frame=frame;postGuide(frame,'available');return;}
    if(exactGuideMessage(event.data,'open')){openGuide(frame);return;}
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
  document.addEventListener('keydown',function(event){
    if(event.key==='Escape'&&document.body.classList.contains('ct-testnet-guide-open')){event.preventDefault();closeGuide(false);return;}
    if(event.key==='Escape'&&document.body.classList.contains('ct-calorieapp-focus'))setFocus(false,true);
  });
  window.addEventListener('resize',function(){if(document.body.classList.contains('ct-calorieapp-focus'))updateTop();});
  window.addEventListener('pagehide',function(){setFocus(false,false);closeGuide(false,false);});
  function ready(){
    if(install())return;var observer=new MutationObserver(function(){if(install())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});
    window.setTimeout(function(){observer.disconnect();install();},10000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
