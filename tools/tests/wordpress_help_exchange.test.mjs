import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {parseHTML}=require('linkedom');
const assets=new URL('../../wordpress-plugins/calorietoken-site-style/assets/',import.meta.url);
const source=name=>readFileSync(new URL(name,assets),'utf8');
const help=JSON.parse(source('help-data.json')), copy=JSON.parse(source('discovery-data.json'));
function fixture(route='faq',page=6855){
 const {document,window:dom}=parseHTML(`<html lang="en"><body class="ctstyle-enabled page-id-${page}"><section class="ctstyle-title"><h1>FAQ</h1></section><div id="ctstyle-app-launcher"><details><summary><span class="ctstyle-help-icon">?</span></summary><div class="ctstyle-app-launcher-panel"><label for="ctstyle-language-select">Language</label><select id="ctstyle-language-select"><option value="en">English</option></select></div></details></div><div class="cal-buy-guide" data-calorieapp-buy-guide="1"><p>Existing guide</p></div></body></html>`);
 // linkedom omits the browser's writable select.value property.
 Object.defineProperty(dom.HTMLSelectElement.prototype,'value',{configurable:true,
  get(){return this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? '';},
  set(value){this.querySelectorAll('option').forEach(option=>option.toggleAttribute('selected',option.value===value));}
 });
 const events=new Map(),timers=[];let permitted=false,network=0,storage=0;
 const window={Event:dom.Event,CustomEvent:dom.CustomEvent,Element:dom.Element,
  location:new URL('https://calorietoken.net/'+route+'/'),
  CalorieTokenHelp:{page,copy:help,avatar:'https://calorietoken.net/avatar.webp'},
  CalorieTokenDiscovery:{page,copy,appURL:'https://calorietoken.net/calorieapp/',appLogo:'/logo.svg'},
  CalorieTokenDiscoveryUI:{getLocale:()=>document.documentElement.lang},
  localStorage:{getItem(){storage++;throw Error('No storage');},setItem(){storage++;throw Error('No storage');}},
  fetch(){network++;throw Error('No provider');},
  getComputedStyle:e=>({display:e.style.display||'block',visibility:e.style.visibility||'visible',opacity:'1'}),
  addEventListener(n,f){events.set(n,[...(events.get(n)||[]),f]);},
  setTimeout(f){timers.push(f);return timers.length;},clearTimeout(){},
  requestAnimationFrame(f){timers.push(f);},
  cmplz_has_service_consent:()=>permitted,
 };
 class Observer{observe(){}disconnect(){}}
 const context={document,window,URL,navigator:{},MutationObserver:Observer};
 return {document,window,run(name){vm.runInNewContext(source(name),context);document.dispatchEvent(new dom.Event('DOMContentLoaded'));},
  consent(value,event='cmplz_status_change_service'){permitted=value;document.dispatchEvent(new dom.Event(event));},
  click(e){e.dispatchEvent(new dom.Event('click',{bubbles:true}));},
  emit(n){for(const f of events.get(n)||[])f();},stats(){return {network,storage};},
  flush(){let budget=20;while(timers.length&&budget--)timers.shift()();assert.equal(timers.length,0);}
 };
}
test('Bounded help uses one panel, preserves the language control, and clears raw questions without storage or requests',()=>{
 const h=fixture(),picker=h.document.querySelector('select');h.run('help.js');
 assert.equal(h.document.querySelector('#ctstyle-language-select'),picker);
 assert.equal(h.document.querySelector('#ctstyle-widget-help').tagName,'SECTION');
 assert.equal(h.document.querySelectorAll('#ctstyle-widget-help').length,1);
 const input=h.document.querySelector('#ctstyle-widget-help input'),form=input.closest('form');
 input.value='testnet import';form.dispatchEvent(new h.window.Event('submit',{bubbles:true}));
 assert.equal(input.value,'');assert.equal(h.document.querySelector('#ctstyle-widget-help .ctstyle-help-reply h3').textContent,help.en.topics.test.title);
 input.value='<img src=x onerror=alert(1)> private-sample';form.dispatchEvent(new h.window.Event('submit',{bubbles:true}));
 assert.equal(input.value,'');assert.ok(!h.document.querySelector('.ctstyle-help-reply').textContent.includes('private-sample'));
 assert.equal(h.document.querySelector('.ctstyle-help-reply img'),null);
 assert.deepEqual(h.stats(),{network:0,storage:0});
 input.value='unsent';h.emit('pagehide');assert.equal(input.value,'');
 assert.ok(h.document.querySelector('#ctstyle-widget-help .ctstyle-help-reply').hidden);
});
test('Every language keeps tutorial answers, source links, dictation guidance and the original controls',()=>{
 const h=fixture();h.run('help.js');const root=h.document.querySelector('#ctstyle-widget-help'),input=root.querySelector('input');
 h.click(root.querySelector('[data-topic="exchange"]'));
 for(const lang of Object.keys(help)){
  h.window.CalorieTokenHelpUI.refresh(lang);
  assert.equal(root.querySelector('input'),input);assert.equal(input.lang,lang);
  assert.equal(root.dir,['ar','ur'].includes(lang)?'rtl':'ltr');
  assert.equal(root.querySelector('.ctstyle-help-reply p').textContent,help[lang].topics.exchange.text);
  assert.equal(root.querySelectorAll('.ctstyle-help-reply li').length,3);
  assert.equal(root.querySelector('.ctstyle-help-voice summary').textContent,help[lang].voiceTitle);
 }
 h.click(root.querySelector('[data-topic="history"]'));
 assert.equal(root.querySelectorAll('.ctstyle-help-reply a').length,3);
 assert.ok([...root.querySelectorAll('.ctstyle-help-reply a')].every(a=>a.href.startsWith('https://github.com/CalorieToken/Publications/')));
});
test('The full SWFT frame requires service consent and an explicit request; revoke unloads it and unrelated consent does not reopen it',()=>{
 const h=fixture('how-to-buy-calorie',4205);delete h.window.CalorieTokenDiscoveryUI;
 h.window.localStorage={getItem:()=>null,setItem(){throw Error('No consent writes');}};
 h.run('discovery.js');
 const area=h.document.querySelector('#ctstyle-swft-frame'),permit=h.document.querySelector('#ctstyle-external-exchange .cmplz-accept-service');
 assert.equal(area.querySelector('iframe'),null);assert.equal(permit.dataset.service,'swft');
 h.click(permit);h.flush();assert.equal(area.querySelector('iframe'),null,'Click alone cannot override denied service consent');
 h.consent(true);assert.equal(area.querySelectorAll('iframe').length,1);
 const frame=area.querySelector('iframe');assert.equal(frame.src,'https://defi.swft.pro/#/?sourceFlag=CALORIE');
 // Complianz cookiebanner/js/complianz.js reads data-src-cmplz for IFRAMEs.
 // Exercise that external activation contract, including a second activation.
 for(let activation=0;activation<2;activation++){
  frame.setAttribute('src',frame.getAttribute('data-src-cmplz'));
  assert.equal(frame.src,'https://defi.swft.pro/#/?sourceFlag=CALORIE');
 }
 assert.equal(frame.dataset.service,'swft');assert.ok(!frame.src.includes('BTC')&&!frame.src.includes('XRP'));
 h.consent(false,'cmplz_revoke');assert.equal(area.querySelector('iframe'),null);
 h.consent(true);assert.equal(area.querySelector('iframe'),null);
 const load=h.document.querySelector('#ctstyle-external-exchange button[aria-controls="ctstyle-swft-frame"]');
 h.click(load);h.click(load);assert.equal(area.querySelectorAll('iframe').length,1);
});
