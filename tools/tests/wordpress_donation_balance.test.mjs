import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const {parseHTML} = require('linkedom');
const assets = new URL('../../wordpress-plugins/calorietoken-site-style/assets/', import.meta.url);
const copy = JSON.parse(readFileSync(new URL('donations-data.json', assets), 'utf8'));
const source = readFileSync(new URL('donations.js', assets), 'utf8');
const wallet = 'rEfiRssDCQd466z2bi63vi64u2rYiMrnhL';
function measurement(now, overrides={}) {
  return {wallet,network:'mainnet',balanceDrops:'401268984',ledgerIndex:106938900,checkedAt:now/1000,validated:true,status:'current',cumulative:true,startingDrops:'401268984',newDonationDrops:'0',totalDrops:'401268984',baselineLedger:106938803,baselineAt:1789231051,donationsCheckedAt:now/1000,donationsStatus:'current',...overrides};
}
function fixture({page=6897, endpoint='https://calorietoken.net/wp-json/calorietoken/v1/donation-balance'}={}) {
  const {document, window: dom} = parseHTML(`<html lang="en"><body class="ctstyle-enabled page-id-${page}"><form><input value="0.01"></form><section id="ctstyle-donation-balance"><h2 data-donation-copy="title"></h2><strong data-donation-amount>—</strong><p data-donation-status></p><time data-donation-time></time><span data-donation-ledger></span><strong data-donation-wallet-amount></strong><strong data-donation-added></strong><strong data-donation-opening></strong><time data-donation-wallet-time></time></section></body></html>`);
  let now=1800000000000, seq=0, calls=0, requests=[], response=measurement(now);
  const timers=new Map(), events=new Map();
  class Clock extends Date { static now(){return now;} }
  const window={location:new URL('https://calorietoken.net/donate/'),CalorieTokenDonations:{wallet,endpoint,copy},
    setTimeout(fn,ms){const id=++seq;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
    addEventListener(n,fn){events.set(n,[...(events.get(n)||[]),fn]);},
    async fetch(url,options){calls++;requests.push({url,options});return {ok:response!==null,json:async()=>response};}};
  const context={window,document,URL,Intl,BigInt,Date:Clock,AbortController};
  const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  return {document,window,timers,requests,flush,get calls(){return calls;},
    async run(){vm.runInNewContext(source,context);await flush();},
    async tick(ms=60000){now+=ms;for(const [id,t] of [...timers])if(t.ms===60000){timers.delete(id);t.fn();}await flush();},
    setResponse(r){response=r;},good(overrides={}){return measurement(now,overrides);},
    async emit(n){for(const fn of events.get(n)||[])fn();await flush();}
  };
}
test('Cumulative total retains every drop, uses one same-origin read and preserves donation controls',async()=>{
  const h=fixture(),input=h.document.querySelector('input');h.setResponse(h.good({newDonationDrops:'12345678511076694',totalDrops:'12345678912345678'}));await h.run();
  assert.equal(h.document.querySelector('[data-donation-amount]').textContent,'12,345,678,912.345678');
  assert.equal(h.calls,1);assert.equal(h.requests[0].options.credentials,'omit');
  assert.equal(h.document.querySelector('input'),input);assert.equal(input.value,'0.01');
  for(const lang of Object.keys(copy)){
    h.window.CalorieTokenDonationBalance.setLocale(lang);
    const root=h.document.querySelector('section');assert.equal(root.lang,lang);assert.equal(root.dir,['ar','ur'].includes(lang)?'rtl':'ltr');
    assert.equal(root.querySelector('h2').textContent,copy[lang].title);
  }
  assert.equal(h.calls,1,'Language changes never request another balance');
});
test('Timeouts or wrong-wallet responses retain last measurement and explicitly show stale status',async()=>{
  const h=fixture();await h.run();h.setResponse(null);await h.tick();
  assert.equal(h.document.querySelector('section').dataset.state,'stale');
  assert.equal(h.document.querySelector('[data-donation-amount]').textContent,'401.268984');
  h.setResponse(h.good({wallet:'wrong',balanceDrops:'0'}));await h.tick();
  assert.equal(h.document.querySelector('section').dataset.state,'stale');
  h.setResponse(h.good({balanceDrops:'0'}));await h.tick();
  assert.equal(h.document.querySelector('[data-donation-amount]').textContent,'401.268984');
  assert.equal(h.document.querySelector('[data-donation-wallet-amount]').textContent,'0.00');
  assert.equal(h.document.querySelector('section').dataset.state,'current');
});
test('A first failure never invents a zero and hidden pages do not poll',async()=>{
  const h=fixture();h.setResponse(null);await h.run();
  assert.equal(h.document.querySelector('[data-donation-amount]').textContent,'—');
  assert.equal(h.document.querySelector('section').dataset.state,'unavailable');
  Object.defineProperty(h.document,'hidden',{value:true,writable:true});
  h.document.dispatchEvent(new h.document.defaultView.Event('visibilitychange'));await h.tick();assert.equal(h.calls,1);
  h.document.hidden=false;h.document.dispatchEvent(new h.document.defaultView.Event('visibilitychange'));await h.flush();assert.equal(h.calls,2);
  await h.emit('pagehide');await h.tick();assert.equal(h.calls,2);
  await h.emit('pageshow');assert.equal(h.calls,3);
});
test('Unexpected page or external endpoint never starts requests',async()=>{
  for(const options of [{page:6914},{endpoint:'https://example.org/collect'}]){const h=fixture(options);await h.run();assert.equal(h.calls,0);}
  const h=fixture();h.setResponse(h.good({validated:false}));await h.run();
  assert.equal(h.document.querySelector('section').dataset.state,'unavailable');
});
test('All eleven languages have complete live-balance copy and matching fixed help answers',()=>{
  const help=JSON.parse(readFileSync(new URL('help-data.json',assets),'utf8'));
  assert.equal(Object.keys(copy).length,11);
  for(const [locale,data] of Object.entries(copy)){
    assert.deepEqual(Object.keys(data),Object.keys(copy.en));
    assert.ok(Object.values(data).every(value=>typeof value==='string'&&value.trim()));
    assert.ok(help[locale].topics.donations.text.includes(data.note));
    assert.deepEqual(help[locale].topics.donations.links,['donations','donationWallet']);
  }
});

test('Recorded support survives a wallet outage and increases only by registered donations',async()=>{
  const h=fixture();await h.run();
  h.setResponse(h.good({newDonationDrops:'10000000',totalDrops:'411268984',balanceDrops:'300000000'}));await h.tick();
  assert.equal(h.document.querySelector('[data-donation-amount]').textContent,'411.268984');
  assert.equal(h.document.querySelector('[data-donation-wallet-amount]').textContent,'300.00');
  h.setResponse(h.good({newDonationDrops:'10000000',totalDrops:'411268984',balanceDrops:null,checkedAt:null,ledgerIndex:null,validated:false,status:'unavailable'}));await h.tick();
  assert.equal(h.document.querySelector('[data-donation-amount]').textContent,'411.268984');
  assert.equal(h.document.querySelector('[data-donation-wallet-amount]').textContent,'—');
  h.setResponse(null);await h.tick(86401000);
  assert.equal(h.document.querySelector('[data-donation-amount]').textContent,'411.268984');
  assert.equal(h.document.querySelector('section').dataset.state,'stale');
});
test('Wrong baseline or inconsistent totals never replace the recorded amount',async()=>{
  const h=fixture();await h.run();
  for(const bad of [{startingDrops:'1'},{baselineLedger:106938804},{totalDrops:'999999999'}, {cumulative:false}]){
    h.setResponse(h.good(bad));await h.tick();
    assert.equal(h.document.querySelector('[data-donation-amount]').textContent,'401.268984');
    assert.equal(h.document.querySelector('section').dataset.state,'stale');
  }
});
