import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {parseHTML}=require('linkedom');
const source=readFileSync(new URL('../../wordpress-plugins/calorieapp-account-profile/assets/profile-widget.js',import.meta.url),'utf8');
function fixture(fetcher){
 const {window,document}=parseHTML('<html><body><div class="xl-card"><div class="xl-card-body"><button class="calorieapp-site-logout">Logout</button></div></div><div data-calorieapp-embed><iframe src="https://app.calorietoken.net/"></iframe></div></body></html>');
 const listeners=new Map(),calls=[];let observer;
 class Observer{constructor(fn){this.fn=fn;observer=this;}observe(){}disconnect(){}}
 const fakeWindow={CalorieAppAccountProfile:{endpoint:'https://calorietoken.net/wp-admin/admin-ajax.php',accountUrl:'https://calorietoken.net/index.php/calorieapp/'},addEventListener:(n,f)=>listeners.set(n,f)};
 const frame=document.querySelector('iframe');frame.contentWindow={};
 vm.runInNewContext(source,{window:fakeWindow,document,location:{href:'https://calorietoken.net/',origin:'https://calorietoken.net'},URL,AbortController,MutationObserver:Observer,setTimeout,clearTimeout,fetch:(...args)=>{calls.push(args);return fetcher(...args);}});
 return{window,document,calls,frame,listeners,get observer(){return observer;},flush:()=>new Promise(setImmediate),message(data,origin='https://app.calorietoken.net',sender=frame.contentWindow){listeners.get('message')({data,origin,source:sender});},close(){listeners.get('pagehide')();}};
}
const response=nickname=>({ok:true,json:async()=>({nickname})});
test('widget shows server nickname as text and clears immediately on existing logout action',async()=>{
 const h=fixture(async()=>response('Piet'));try{await h.flush();const name=h.document.querySelector('[data-calorieapp-nickname]');assert.equal(name.textContent,'Piet');assert.equal(name.href,'https://calorietoken.net/index.php/calorieapp/');assert.equal(h.calls[0][1].credentials,'same-origin');assert.equal(h.calls[0][1].cache,'no-store');h.document.querySelector('button').dispatchEvent(new h.window.Event('click',{bubbles:true}));assert.equal(h.document.querySelector('[data-calorieapp-nickname]'),null);}finally{h.close();}
});
test('untrusted parent messages cannot set or refresh a nickname',async()=>{
 const h=fixture(async()=>response('Piet'));try{await h.flush();h.message({type:'calorieapp:profile:changed',version:1,nickname:'Attacker'},'https://wrong.invalid');h.message({type:'calorieapp:profile:changed',version:1,nickname:'Attacker'},'https://app.calorietoken.net',{});await h.flush();assert.equal(h.calls.length,1);assert.equal(h.document.querySelector('[data-calorieapp-nickname]').textContent,'Piet');}finally{h.close();}
});
test('authenticated session refresh recovers after checking cancels an initial read',async()=>{
 let firstResolve;let count=0;const h=fixture(async()=>++count===1?await new Promise(r=>firstResolve=r):response('Current'));try{
 h.message({type:'calorieapp:session:state',version:1,status:'checking'});
 h.message({type:'calorieapp:session:state',version:1,status:'authenticated'});await h.flush();
 firstResolve(response('Old'));await h.flush();assert.equal(h.document.querySelector('[data-calorieapp-nickname]').textContent,'Current');assert.equal(h.calls.length,2);
 h.message({type:'calorieapp:session:state',version:1,status:'signed_out'});assert.equal(h.document.querySelector('[data-calorieapp-nickname]'),null);
 }finally{h.close();}
});
test('server removal and failed reads remove the old name without changing the login widget',async()=>{
 let current='Piet';const h=fixture(async()=>response(current));try{await h.flush();current=null;h.message({type:'calorieapp:profile:changed',version:1,nickname:'Ignore'});await h.flush();assert.equal(h.document.querySelector('[data-calorieapp-nickname]'),null);assert.equal(h.document.querySelectorAll('.xl-card button').length,1);}finally{h.close();}
});
test('markup or oversized values never appear in the widget',async()=>{
 for(const value of ['<img src=x onerror=alert(1)>','a'.repeat(33),'a\u202eb']){const h=fixture(async()=>response(value));try{await h.flush();assert.equal(h.document.querySelector('[data-calorieapp-nickname]'),null);}finally{h.close();}}
});
