import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source=readFileSync(new URL('../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-page-ending.js',import.meta.url),'utf8');
const appOrigin='https://app.calorietoken.net';
function element(attrs={}){return {attrs,hidden:false,textContent:'',events:new Map(),
 getAttribute(n){return this.attrs[n]??null;},setAttribute(n,v){this.attrs[n]=String(v);},removeAttribute(n){delete this.attrs[n];},
 addEventListener(n,fn){this.events.set(n,fn);}
};}
function harness({frameOrigin=appOrigin,locale='en'}={}){
 const stage=element({'data-calorieapp-frame-loading':'1','aria-busy':'true'});
 const frame=element({src:frameOrigin+'?embedded=1&locale='+locale});frame.contentWindow={};
 let reloads=0;const set=frame.setAttribute;frame.setAttribute=function(n,v){if(n==='src')reloads++;set.call(this,n,v);};
 const mask=element({'data-slow-message':'Still starting. Wait or try again.'});
 const message=element();message.textContent='Your food log will appear here.';
 const actions=element();actions.hidden=true;
 const retry=element(),reveal=element();
 const children=new Map([
  ['[data-calorieapp-frame-stage]',stage],['.calorieapp-embed-frame',frame],['[data-calorieapp-embed-loading]',mask],
  ['[data-calorieapp-loading-message]',message],['[data-calorieapp-loading-actions]',actions],
  ['[data-calorieapp-loading-retry]',retry],['[data-calorieapp-loading-reveal]',reveal]
 ]);
 const root=element({'data-app-origin':appOrigin,'data-locale':locale});
 root.querySelector=mask.querySelector=s=>children.get(s)||null;
 const events=new Map(),timers=new Map();let timerId=0;
 const document={body:{},readyState:'complete',querySelectorAll(s){return s==='[data-calorieapp-embed]'?[root]:[];}};
 const window={
  addEventListener(n,fn){if(!events.has(n))events.set(n,[]);events.get(n).push(fn);},
  setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout(id){timers.delete(id);},
  fetch(){throw new Error('The loader must not send authentication or readiness requests.');}
 };
 vm.runInNewContext(source,{document,window,URL,Intl});
 return {stage,frame,mask,message,actions,retry,reveal,timers,reloads:()=>reloads,
  messageEvent(data={type:'calorieapp:bridge:initialized',locale},origin=appOrigin,sender=frame.contentWindow){for(const fn of events.get('message')||[])fn({origin,source:sender,data});},
  slow(){for(const {fn,ms} of [...timers.values()]){assert.equal(ms,45000);fn();}},
  frameLoad(){frame.events.get('load')?.();}
 };
}
test('provider iframe load does not uncover the app before its existing handshake',()=>{
 const h=harness();h.frameLoad();assert.equal(h.mask.hidden,false);assert.equal(h.stage.getAttribute('data-calorieapp-frame-loading'),'1');
 h.messageEvent();assert.equal(h.mask.hidden,true);assert.equal(h.stage.getAttribute('data-calorieapp-frame-loading'),null);
 assert.equal(h.stage.getAttribute('aria-busy'),'false');assert.equal(h.timers.size,0);assert.equal(h.reloads(),0);
});
test('foreign origins, other frames, wrong locales and unrelated messages cannot dismiss the loader',()=>{
 const h=harness();
 h.messageEvent(undefined,'https://untrusted.example');h.messageEvent(undefined,appOrigin,{});
 h.messageEvent({type:'calorieapp:bridge:initialized',locale:'nl'});
 h.messageEvent({type:'calorieapp:bridge:ready',locale:'en'});
 h.messageEvent({type:'calorieapp:login:complete',locale:'en'});
 assert.equal(h.mask.hidden,false);h.messageEvent();assert.equal(h.mask.hidden,true);
});
test('a slow start offers manual choices without automatic reloads or authentication requests',()=>{
 const h=harness();h.slow();assert.equal(h.actions.hidden,false);assert.match(h.message.textContent,/Still starting/);assert.equal(h.reloads(),0);
 h.retry.events.get('click')();assert.equal(h.reloads(),1);assert.equal(h.actions.hidden,true);assert.equal(h.mask.hidden,false);
 h.messageEvent();h.retry.events.get('click')();assert.equal(h.reloads(),1,'No retry can reset a ready app.');
});
test('the user can reveal a stalled frame and later readiness remains harmless',()=>{
 const h=harness();h.slow();h.reveal.events.get('click')();assert.equal(h.mask.hidden,true);assert.equal(h.reloads(),0);
 h.messageEvent();assert.equal(h.mask.hidden,true);
});
test('mismatched frame origin is never initialized by the loader',()=>{
 const h=harness({frameOrigin:'https://other.example'});assert.equal(h.mask.getAttribute('data-loading-ready'),null);assert.equal(h.timers.size,0);
});
