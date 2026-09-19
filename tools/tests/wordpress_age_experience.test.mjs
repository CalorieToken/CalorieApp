import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {parseHTML}=require('linkedom');
const source=readFileSync(new URL('../../wordpress-plugins/calorietoken-heading-repair/assets/age-experience.js',import.meta.url),'utf8');

function page(url,{stored=null,crypto=false,showcases=false,faqFinancial=false,trustline=false,donation=false,legacy=false,appInfo=false}={}){
  const {window,document}=parseHTML(`<!doctype html><html lang="en"><body class="ctstyle-enabled page-id-7880">
    <header class="ctstyle-site-header"><section class="xl-card xl-no-wallet"><button>Header login</button></section></header>
    <main><section class="xl-card calorieapp-identity-card"><div class="xl-card-body"></div></section>
      ${crypto?`<div class="ctstyle-exchange-layout">
        <div id="ctstyle-cal-crypto"><a href="https://xpmarket.com/dex/test">Trade</a></div>
        <section id="ctstyle-own-dex">DEX wallet route</section>
        <article id="ctstyle-cal-options" class="cal-buy-guide">Buy guide</article>
        <section id="ctstyle-external-exchange"><button>SWFT toestaan en openen</button><iframe src="https://defi.swft.pro/"></iframe></section>
      </div>`:''}
      ${showcases?`<section class="showcase-intro ctstyle-shared-panel"><p class="eyebrow">Project</p><h1>Showcases</h1><p>Search food and keep a personal diary.</p><p><a href="/calorieapp/">Try the app</a></p></section>
      <aside class="showcase-auth"><div class="xl-card xl-no-wallet"><a href="https://xaman.app/">Wallet login</a></div></aside>
      <div class="showcase-grid"><article class="showcase-card">Search</article><article class="showcase-card">Understand</article><article class="showcase-card">Build your personal log</article></div>`:''}
      ${faqFinancial?`<a id="faq-market" href="https://xpmarket.com/dex/test">XPMarket</a>`:''}
      ${trustline?`<h1>Trustline</h1><section class="ctstyle-trustline-methods">Methods</section><section class="ctstyle-trustline-options">Options</section><div class="ctstyle-market-layout"><a href="https://xpmarket.com">Market</a></div>`:''}
      ${donation?`<h1>Donate</h1><nav id="calorieapp-donation-steps">Donation steps</nav><section class="ctstyle-donation-balance">Public balance</section><a id="donate-action" href="/product/donation/">Donate now</a><a id="explorer" href="https://bithomp.com/explorer/test">Explorer</a>`:''}
      ${legacy?`<h1>How to buy</h1><div class="calorie-legacy-page"><section>Adult buying route</section></div>`:''}
      ${appInfo?`<article class="calorieapp-app-info"><div><h2>CalorieApp</h2><p>Search foods and keep a personal diary.</p><div class="ctstyle-app-sources"><p>Source</p></div></div></article>`:''}
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
  assert.equal(env.document.querySelector('.ctstyle-site-header .xl-card').hidden,true);
  assert.equal(env.document.getElementById('ct-age-page-status'),null);
  assert.deepEqual(JSON.parse(JSON.stringify(env.sent)),[{message:{type:'calorieapp:age-band',version:1,band:'child'},origin:'https://app.calorietoken.net'}]);
  assert.equal(Object.hasOwn(env.sent[0].message,'birthDate'),false);
});

test('both minor CAL and Crypto views hide every DEX, guide and SWFT route but keep one explanation',()=>{
  for(const stored of ['child','teen']){
    const env=page('https://calorietoken.net/how-to-buy-calorie/',{stored,crypto:true});
    assert.equal(env.document.getElementById('ct-age-gate'),null);
    for(const selector of ['.ctstyle-exchange-layout','#ctstyle-cal-crypto','#ctstyle-own-dex','#ctstyle-cal-options','#ctstyle-external-exchange','.cal-buy-guide']){
      assert.equal(env.document.querySelector(selector).hidden,true,`${stored} ${selector}`);
    }
    assert.equal(env.document.getElementById('ct-age-finance-notice').hidden,false);
    assert.equal(env.document.getElementById('ct-age-finance-notice').parentElement,env.document.querySelector('main'));
    assert.match(env.document.getElementById('ct-age-finance-notice').textContent,/crypto services intended for adults/i);
    assert.ok(env.document.querySelector('a[href*="xpmarket.com"]').classList.contains('ct-age-financial-action'));
    assert.equal(env.document.querySelector('[data-topic="exchange"]').hidden,true);
    assert.equal(env.document.querySelector('[data-topic="app"]').hidden,false);
    const helpStatus=env.document.getElementById('ctstyle-widget-help-age-status');
    assert.equal(helpStatus.dataset.band,stored);
    assert.doesNotMatch(helpStatus.textContent,/Wallet, trading, trustline and test-fund instructions/i);
  }
});

test('adult crypto view restores all routes hidden during a previous minor selection',()=>{
  const env=page('https://calorietoken.net/how-to-buy-calorie/',{stored:'child',crypto:true});
  env.window.CalorieTokenAgeExperience.getBand();
  env.document.querySelector('#ctstyle-widget-help-age-status .ct-age-change').click();
  env.document.querySelector('#ct-age-gate [data-band="adult"]').click();
  assert.equal(env.document.querySelector('.ctstyle-exchange-layout').hidden,false);
  assert.equal(env.document.getElementById('ctstyle-external-exchange').hidden,false);
  assert.equal(env.document.querySelector('.ctstyle-site-header .xl-card').hidden,false);
  assert.equal(env.document.getElementById('ct-age-finance-notice').hidden,true);
});

test('minor Showcases views hide wallet identity, the personal journey and financial shortcuts',()=>{
  for(const stored of ['child','teen']){
    const env=page('https://calorietoken.net/showcases/',{stored,showcases:true});
    assert.equal(env.document.querySelector('.showcase-auth').hidden,true,stored);
    const cards=env.document.querySelectorAll('.showcase-card');
    assert.equal(cards[0].hidden,false,stored);
    assert.equal(cards[1].hidden,false,stored);
    assert.equal(cards[2].hidden,true,stored);
    const introCopy=Array.from(env.document.querySelector('.showcase-intro').children).find(node=>node.tagName==='P'&&!node.classList.contains('eyebrow')&&!node.querySelector('a'));
    assert.equal(introCopy.hidden,true,stored);
    assert.equal(env.document.getElementById('ct-age-showcase-note').hidden,false,stored);
    assert.match(env.document.getElementById('ct-age-showcase-note').textContent,/public food search|public information/i);
    assert.ok(env.document.querySelector('a[href*="xaman.app"]').classList.contains('ct-age-financial-action'));
  }
});

test('minor modes protect Trustline, donation and legacy buying routes while public information remains',()=>{
  for(const stored of ['child','teen']){
    const trust=page('https://calorietoken.net/trustline/',{stored,trustline:true,appInfo:true});
    assert.equal(trust.document.querySelector('.ctstyle-trustline-methods').hidden,true);
    assert.equal(trust.document.querySelector('.ctstyle-trustline-options').hidden,true);
    assert.equal(trust.document.querySelector('.ctstyle-market-layout').hidden,true);
    assert.match(trust.document.querySelector('h1').textContent,/CAL information/i);
    assert.match(trust.document.querySelector('.calorieapp-app-info p').textContent,/hidden/i);
    assert.equal(trust.document.getElementById('ct-age-finance-notice').hidden,false);

    const donate=page('https://calorietoken.net/donate/',{stored,donation:true});
    assert.equal(donate.document.getElementById('calorieapp-donation-steps').hidden,true);
    assert.equal(donate.document.getElementById('donate-action').hidden,true);
    assert.equal(donate.document.getElementById('explorer').hidden,true);
    assert.equal(donate.document.querySelector('.ctstyle-donation-balance').hidden,false);
    assert.equal(donate.document.getElementById('ct-age-finance-notice').hidden,false);

    const legacy=page('https://calorietoken.net/how-to-buy-dex/',{stored,legacy:true});
    assert.equal(Array.from(legacy.document.querySelectorAll('.calorie-legacy-page section')).find(node=>node.id!=='ct-age-finance-notice').hidden,true);
    const notice=legacy.document.getElementById('ct-age-finance-notice');
    assert.equal(notice.hidden,false);
    assert.equal(notice.querySelector('h1').tagName,'H1');
    assert.equal(notice.hasAttribute('data-ct-age-hidden'),false);
  }
});

test('adult selection restores protected route titles and public-app copy',()=>{
  const env=page('https://calorietoken.net/trustline/',{stored:'child',trustline:true,appInfo:true});
  env.document.querySelector('#ctstyle-widget-help-age-status .ct-age-change').click();
  env.document.querySelector('#ct-age-gate [data-band="adult"]').click();
  assert.equal(env.document.querySelector('.ctstyle-trustline-methods').hidden,false);
  assert.equal(env.document.querySelector('h1').textContent,'Trustline');
  assert.equal(env.document.querySelector('.calorieapp-app-info p').textContent,'Search foods and keep a personal diary.');
});

test('FAQ stays public but applies page-wide financial filtering after a minor choice',()=>{
  const env=page('https://calorietoken.net/faq/',{faqFinancial:true});
  assert.equal(env.document.getElementById('ct-age-gate'),null);
  assert.equal(env.document.getElementById('faq-market').classList.contains('ct-age-financial-action'),false);
  const details=env.document.querySelector('#ctstyle-app-launcher>details');
  details.open=true;details.dispatchEvent(new env.window.Event('toggle'));
  env.document.querySelector('#ct-age-gate [data-band="child"]').click();
  assert.equal(env.document.body.dataset.ctAgeBand,'child');
  assert.ok(env.document.getElementById('faq-market').classList.contains('ct-age-financial-action'));
});

test('a SWFT route inserted after the age script is immediately covered for minors',async()=>{
  const env=page('https://calorietoken.net/how-to-buy-calorie/',{stored:'teen'});
  const layout=env.document.createElement('div');layout.className='ctstyle-exchange-layout';
  layout.innerHTML='<section id="ctstyle-external-exchange"><button>Open SWFT</button></section>';
  env.document.querySelector('main').append(layout);
  await Promise.resolve();await Promise.resolve();
  assert.equal(layout.hidden,true);
  assert.equal(env.document.getElementById('ctstyle-external-exchange').hidden,true);
  assert.equal(env.document.getElementById('ct-age-finance-notice').hidden,false);
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
