import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {parseHTML}=require('linkedom');
const source=readFileSync(new URL('../../wordpress-plugins/calorietoken-heading-repair/assets/age-experience.js',import.meta.url),'utf8');

function page(url,{stored=null,crypto=false}={}){
  const {window,document}=parseHTML(`<!doctype html><html lang="en"><body class="ctstyle-enabled page-id-7880">
    <main><section class="xl-card calorieapp-identity-card"><div class="xl-card-body"></div></section>
      ${crypto?'<div id="ctstyle-cal-crypto"><a href="https://xpmarket.com/dex/test">Trade</a></div>':''}
      <iframe title="CalorieApp" src="https://app.calorietoken.net/"></iframe>
    </main>
    <aside id="ctstyle-app-launcher"><details><summary>CalorieHelp</summary><div class="ctstyle-app-launcher-panel">
      <section id="ctstyle-widget-help"><form><input value="wallet"></form><div class="ctstyle-help-reply" hidden><h3></h3><div></div></div><div class="ctstyle-help-topics"><button data-topic="app">App</button><button data-topic="exchange">Crypto</button><button data-topic="trustline">Trustline</button></div></section>
    </div></details></aside>
  </body></html>`);
  Object.defineProperty(window,'location',{value:new URL(url),configurable:true});
  Object.defineProperty(document,'readyState',{value:'complete',configurable:true});
  const values=new Map(stored?[['calorieapp.age-band.v1',stored]]:[]);
  Object.defineProperty(window,'sessionStorage',{value:{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},configurable:true});
  const sent=[];const frame=document.querySelector('iframe');const frameWindow={postMessage(message,origin){sent.push({message,origin});}};
  Object.defineProperty(frame,'contentWindow',{value:frameWindow});
  const listeners=new Map(),native=window.addEventListener.bind(window);
  window.addEventListener=(type,listener,options)=>{listeners.set(type,listener);native(type,listener,options);};
  vm.runInContext(source,vm.createContext({window,document,URL,MutationObserver:window.MutationObserver,HTMLFormElement:window.HTMLFormElement}));
  return {window,document,values,sent,frameWindow,listeners};
}

test('relevant WordPress pages require one neutral three-button choice and send only the fixed band',()=>{
  const env=page('https://calorietoken.net/calorieapp/');
  const gate=env.document.getElementById('ct-age-gate');
  assert.ok(gate);
  assert.equal(gate.getAttribute('role'),'dialog');
  assert.equal(gate.querySelectorAll('button[data-band]').length,3);
  assert.equal(gate.querySelector('.ct-age-cancel').hidden,true);
  assert.equal(gate.querySelectorAll('input').length,0);
  gate.querySelector('[data-band="child"]').click();
  assert.equal(env.document.getElementById('ct-age-gate'),null);
  assert.equal(env.values.get('calorieapp.age-band.v1'),'child');
  assert.equal(env.document.body.dataset.ctAgeBand,'child');
  assert.equal(env.document.querySelector('.xl-card').hidden,true);
  assert.equal(env.document.getElementById('ct-age-page-status'),null);
  assert.deepEqual(JSON.parse(JSON.stringify(env.sent)),[{message:{type:'calorieapp:age-band',version:1,band:'child'},origin:'https://app.calorietoken.net'}]);
  assert.equal(Object.hasOwn(env.sent[0].message,'birthDate'),false);
});

test('minor CAL and Crypto view hides the transaction guide and links but keeps a clear explanation',()=>{
  const env=page('https://calorietoken.net/how-to-buy-calorie/',{stored:'teen',crypto:true});
  assert.equal(env.document.getElementById('ct-age-gate'),null);
  assert.equal(env.document.getElementById('ctstyle-cal-crypto').hidden,true);
  assert.equal(env.document.getElementById('ct-age-finance-notice').hidden,false);
  assert.match(env.document.getElementById('ct-age-finance-notice').textContent,/crypto services intended for adults/i);
  assert.ok(env.document.querySelector('a[href*="xpmarket.com"]').classList.contains('ct-age-financial-action'));
  assert.equal(env.document.querySelector('[data-topic="exchange"]').hidden,true);
  assert.equal(env.document.querySelector('[data-topic="app"]').hidden,false);
  const helpStatus=env.document.getElementById('ctstyle-widget-help-age-status');
  assert.equal(helpStatus.dataset.band,'teen');
  assert.match(helpStatus.textContent,/Age experience: Young person · 13–17/i);
  assert.doesNotMatch(helpStatus.textContent,/Wallet, trading, trustline and test-fund instructions/i);
});

test('changing an existing choice is dismissible and preserves the current band until replacement',()=>{
  const env=page('https://calorietoken.net/calorieapp/',{stored:'adult'});
  assert.equal(env.document.getElementById('ct-age-page-status'),null);
  env.document.querySelector('#ctstyle-widget-help-age-status .ct-age-change').click();
  const gate=env.document.getElementById('ct-age-gate');
  assert.ok(gate);
  assert.equal(gate.querySelector('.ct-age-cancel').hidden,false);
  assert.equal(env.values.get('calorieapp.age-band.v1'),'adult');
  assert.equal(env.document.body.dataset.ctAgeBand,'adult');
  gate.querySelector('.ct-age-cancel').click();
  assert.equal(env.document.getElementById('ct-age-gate'),null);
  assert.equal(env.values.get('calorieapp.age-band.v1'),'adult');
  assert.equal(env.document.body.dataset.ctAgeBand,'adult');
});

test('ordinary pages stay open until CalorieHelp is deliberately opened',()=>{
  const env=page('https://calorietoken.net/faq/');
  assert.equal(env.document.getElementById('ct-age-gate'),null);
  const details=env.document.querySelector('#ctstyle-app-launcher>details');
  details.open=true;
  details.dispatchEvent(new env.window.Event('toggle'));
  const gate=env.document.getElementById('ct-age-gate');
  assert.ok(gate);
  assert.equal(details.open,false);
  assert.equal(gate.querySelector('.ct-age-cancel').hidden,false);
  gate.querySelector('.ct-age-cancel').click();
  assert.equal(env.document.getElementById('ct-age-gate'),null);
  assert.equal(env.document.body.classList.contains('ct-age-gate-open'),false);
  assert.equal(details.open,false);
});

test('inline Help interactions also require an age choice before showing answers',()=>{
  const env=page('https://calorietoken.net/faq/');
  const faq=env.document.createElement('section');
  faq.id='ctstyle-faq-help';
  const button=env.document.createElement('button');
  button.type='button';button.dataset.topic='app';button.textContent='CalorieApp';faq.append(button);env.document.body.append(faq);
  assert.equal(env.document.getElementById('ct-age-gate'),null);
  button.click();
  assert.ok(env.document.getElementById('ct-age-gate'));
});

test('fixed age messages accept only the exact known iframe and all locales have complete copy',()=>{
  const env=page('https://calorietoken.net/calorieapp/',{stored:'adult'});
  const listener=env.listeners.get('message');
  const before=env.sent.length;
  listener({source:{},origin:'https://app.calorietoken.net',data:{type:'calorieapp:age-band:request',version:1}});
  listener({source:env.frameWindow,origin:'https://evil.example',data:{type:'calorieapp:age-band:request',version:1}});
  assert.equal(env.sent.length,before);
  listener({source:env.frameWindow,origin:'https://app.calorietoken.net',data:{type:'calorieapp:age-band:request',version:1}});
  assert.equal(env.sent.length,before+1);
  for(const tag of ['en','nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur']){
    env.document.documentElement.lang=tag;
    const translated=env.window.CalorieTokenAgeExperience.copy();
    for(const value of Object.values(translated))assert.ok(typeof value==='string'&&value.trim(),tag);
  }
  assert.doesNotMatch(source,/localStorage|dateOfBirth|birthDate|\bdob\b/i);
  assert.match(source,/sessionStorage/);
});
