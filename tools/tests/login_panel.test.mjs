import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {parseHTML}=require('linkedom');
const dir=new URL('../../wordpress-plugins/calorieapp-account-profile/assets/',import.meta.url);
const script=readFileSync(new URL('login-panel.js',dir),'utf8');
const copy=JSON.parse(readFileSync(new URL('login-panel-copy.json',dir),'utf8'));
const bridge=readFileSync(new URL('../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-embed.js',import.meta.url),'utf8');

function fixture({withBridge=false,bridgeFirst=true}={}){
  const {window,document}=parseHTML(`<html lang="nl"><body><button id="ct-calorieapp-focus-toggle">Focus</button><div data-calorieapp-embed data-app-origin="https://app.calorietoken.net" data-locale="nl"><div data-calorieapp-frame-stage><iframe class="calorieapp-embed-frame" src="https://app.calorietoken.net/?embedded=1"></iframe></div><div class="calorieapp-login-modal" hidden role="dialog" aria-modal="true" aria-labelledby="login-title"><div class="calorieapp-login-card"><button class="calorieapp-login-close">Close</button><h2 id="login-title">Sign in</h2><p class="calorieapp-login-status" role="status">Preparing</p><p class="calorieapp-login-guidance">Instructions</p><img class="calorieapp-login-qr" hidden><a class="calorieapp-login-open" href="https://xaman.app/test" hidden>Open</a><button class="calorieapp-login-retry" hidden>Retry</button></div></div></div></body></html>`);
  const root=document.querySelector('[data-calorieapp-embed]'),panel=root.querySelector('.calorieapp-login-modal'),frame=root.querySelector('iframe');
  const status=root.querySelector('.calorieapp-login-status'),qr=root.querySelector('.calorieapp-login-qr'),open=root.querySelector('a'),retry=root.querySelector('.calorieapp-login-retry'),close=root.querySelector('.calorieapp-login-close');
  const calls={open:0,retry:0,focus:0,scroll:0,focusToggle:0,reload:0,requests:[]};const events=new Map(),timers=new Map();let render,timerId=0;
  frame.contentWindow={postMessage(){}};
  root.querySelector('h2').focus=()=>calls.focus++;
  panel.scrollIntoView=()=>calls.scroll++;
  open.addEventListener('click',()=>calls.open++);
  retry.addEventListener('click',()=>calls.retry++);
  close.addEventListener('click',()=>{panel.hidden=true;});
  document.querySelector('#ct-calorieapp-focus-toggle').addEventListener('click',()=>{calls.focusToggle++;document.body.classList.remove('ct-calorieapp-focus');});
  const context={document,URL,MutationObserver:class{constructor(fn){render=fn;}observe(){}},WebSocket:class{close(){}},
    fetch:async(url)=>{calls.requests.push(url);assert.equal(url,'/start');return {ok:true,status:201,json:async()=>({flow_id:'synthetic-flow',flow_proof:'synthetic-proof',next_url:'https://xaman.app/test',qr_png_url:'https://xaman.app/qr',websocket_url:'wss://xaman.app/test',locale:'nl'})};},
    window:{location:{href:'https://calorietoken.net/calorieapp/',origin:'https://calorietoken.net',pathname:'/calorieapp/',reload:()=>calls.reload++},CalorieAppAccountProfile:{loginCopy:copy},
      setTimeout:(callback,delay)=>{timers.set(++timerId,{callback,delay});return timerId;},clearTimeout:id=>timers.delete(id),
      addEventListener:(n,fn)=>events.set(n,[...(events.get(n)||[]),fn])}};
  if(withBridge){root.dataset.startUrl='/start';root.dataset.finishUrl='/finish';root.dataset.authorizeUrl='/authorize';}
  if(withBridge&&bridgeFirst)vm.runInNewContext(bridge,context);
  vm.runInNewContext(script,context);
  if(withBridge&&!bridgeFirst)vm.runInNewContext(bridge,context);
  return {document,root,panel,frame,status,qr,open,retry,close,calls,render:()=>render(),summary:()=>root.querySelector('.calorieapp-login-summary').textContent,
    timers,flush:()=>new Promise(setImmediate),show(){panel.hidden=false;render();},message(type,origin='https://app.calorietoken.net',source=frame.contentWindow,locale='nl',requestId='request-12345678'){
      for(const fn of events.get('message')||[])fn({origin,source,data:{type,locale,requestId,state:'synthetic-login-state-abcdefghijklmnopqrstuvwxyz'}});render();
    },runAgain(){vm.runInNewContext(script,context);}};
}
test('one inline region preserves the existing authentication controls and handlers',()=>{
  const h=fixture();
  assert.equal(h.panel.getAttribute('role'),'region');assert.equal(h.panel.hasAttribute('aria-modal'),false);
  assert.equal(h.root.firstElementChild,h.panel);assert.equal(h.summary(),'');
  assert.equal(h.root.querySelectorAll('[role="status"]').length,1);
  h.show();assert.equal(h.summary(),copy.nl.preparing);assert.equal(h.calls.focus,1);
  h.qr.hidden=false;h.qr.src='https://xaman.app/qr';h.open.hidden=false;h.render();
  assert.equal(h.summary(),copy.nl.waiting);assert.equal(h.root.querySelector('details').hasAttribute('open'),false);
  assert.equal(h.root.querySelector('details img'),h.qr);
  h.open.click();h.retry.click();assert.equal(h.calls.open,1);assert.equal(h.calls.retry,1);
  assert.equal(h.open.href,'https://xaman.app/test');assert.equal(h.qr.src,'https://xaman.app/qr');
  h.runAgain();assert.equal(h.root.querySelectorAll('.calorieapp-login-summary').length,1);
  h.close.click();h.render();assert.equal(h.panel.hidden,true);assert.equal(h.summary(),'');
});
test('routine progress stays quiet; real errors and retry remain visible',()=>{
  const h=fixture();h.show();h.qr.hidden=false;h.render();
  for(const progress of ['Xaman opened','Signing','WordPress signed in','Activating session']){
    h.status.textContent=progress;h.render();assert.equal(h.summary(),copy.nl.waiting);
  }
  assert.equal(h.calls.focus,1);assert.equal(h.calls.scroll,1);
  h.status.classList.add('is-error');h.status.textContent='Request expired';h.retry.hidden=false;h.render();
  assert.equal(h.summary(),'Request expired');assert.equal(h.retry.hidden,false);
  h.status.classList.remove('is-error');h.qr.hidden=true;h.render();assert.equal(h.summary(),copy.nl.preparing);
});
test('only the exact trusted frame can close completed sign-in or logout presentation',()=>{
  const h=fixture();h.show();
  h.message('calorieapp:login:complete');assert.equal(h.panel.hidden,false,'A completion with no active request cannot hide the current screen');
  h.message('calorieapp:login:start');
  h.message('calorieapp:login:complete','https://evil.invalid');assert.equal(h.panel.hidden,false);
  h.message('calorieapp:login:complete','https://app.calorietoken.net',{});assert.equal(h.panel.hidden,false);
  h.message('calorieapp:login:complete','https://app.calorietoken.net',h.frame.contentWindow,'en');assert.equal(h.panel.hidden,false);
  h.message('calorieapp:login:complete','https://app.calorietoken.net',h.frame.contentWindow,'nl','obsolete-request');assert.equal(h.panel.hidden,false);
  for(const type of ['calorieapp:login:complete','calorieapp:logout:request','calorieapp:logout:complete']){
    h.message('calorieapp:login:start','https://app.calorietoken.net',h.frame.contentWindow,'nl',type+'-request');
    h.show();h.message(type,'https://app.calorietoken.net',h.frame.contentWindow,'nl',type+'-request');assert.equal(h.panel.hidden,true);assert.equal(h.summary(),'');
  }
  h.message('calorieapp:login:start');assert.equal(h.panel.hidden,true,'Existing bridge still owns opening and authentication');
});
for(const bridgeFirst of [true,false])test(`real bridge completes without leaving its success popup visible (bridge first: ${bridgeFirst})`,async()=>{
  const h=fixture({withBridge:true,bridgeFirst});
  h.message('calorieapp:login:start');await h.flush();h.render();
  assert.equal(h.panel.hidden,false);assert.equal(h.open.hidden,false);assert.equal(h.summary(),copy.nl.waiting);
  h.message('calorieapp:login:complete');
  assert.equal(h.panel.hidden,true);assert.equal(h.open.hidden,true);assert.equal(h.qr.hidden,true);assert.equal(h.retry.hidden,true);assert.equal(h.summary(),'');
  const reload=[...h.timers.values()].find(t=>t.delay===1400);assert.ok(reload,'Keep the original bridge account-controls refresh');
  assert.equal(h.calls.reload,0,'Do not need to wait for the delayed reload to hide the panel');
  h.message('calorieapp:login:progress');h.status.textContent='Signed in to WordPress and CalorieApp. Updating your account controls...';h.render();
  assert.equal(h.panel.hidden,true);assert.equal(h.summary(),'');
  reload.callback();assert.equal(h.calls.reload,1);assert.deepEqual(h.calls.requests,['/start']);
});
test('completed controls stay hidden on replay, while a genuinely new request can be shown',()=>{
  const h=fixture();h.message('calorieapp:login:start');h.show();h.open.hidden=false;h.qr.hidden=false;
  h.message('calorieapp:login:complete');
  h.message('calorieapp:login:start');h.show();assert.equal(h.panel.hidden,true);
  h.message('calorieapp:login:start','https://app.calorietoken.net',h.frame.contentWindow,'nl','request-new-1234');h.show();assert.equal(h.panel.hidden,false);
  h.qr.hidden=false;h.open.hidden=false;h.status.classList.add('is-error');h.status.textContent='Request expired';h.retry.hidden=false;h.render();
  assert.equal(h.open.hidden,true);assert.equal(h.root.querySelector('details').hidden,true);assert.equal(h.retry.hidden,false);assert.equal(h.summary(),'Request expired');
});
test('fullscreen exits through the existing control once; all app languages keep usable sign-in copy',()=>{
  const h=fixture();h.document.body.classList.add('ct-calorieapp-focus');h.show();h.render();assert.equal(h.calls.focusToggle,1);
  for(const [locale,row] of Object.entries(copy)){
    assert.deepEqual(Object.keys(row).sort(),Object.keys(copy.en).sort());
    h.document.documentElement.lang=locale;h.render();assert.equal(h.panel.lang,locale);assert.equal(h.summary(),row.preparing);
    assert.equal(h.panel.dir,['ar','ur'].includes(locale)?'rtl':'ltr');
  }
});
