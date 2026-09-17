import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const React=require('react'),{createRoot}=require('react-dom/client'),{parseHTML}=require('linkedom'),ts=require('typescript');
const source=readFileSync(new URL('../../frontend/components/NicknameProfile.tsx',import.meta.url),'utf8');
const copy=JSON.parse(readFileSync(new URL('../../frontend/config/account-profile-copy.json',import.meta.url),'utf8'));
function load(request=async()=>{},locale='nl'){
 const module={exports:{}};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,AbortController,require(name){
  if(name==='react'||name==='react/jsx-runtime')return require(name);
  if(name==='@/components/DisplayLanguageProvider')return {useDisplayLanguage:()=>({enabled:true,locale})};
  if(name==='@/lib/locales')return {localeDirection:tag=>['ar','ur'].includes(tag)?'rtl':'ltr'};
  if(name==='@/lib/backendRequest')return {backendRequest:request};
  if(name==='@/config/account-profile-copy.json')return {default:copy};
  throw new Error(name);
 }});return module.exports;
}
async function fixture(request,locale='nl'){
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>');
 const old=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 globalThis.window=window;globalThis.document=document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const Profile=load(request,locale).NicknameProfile,root=createRoot(document.getElementById('root'));
 let saved=[],lost=0,props={userId:'account-a',nickname:null,onSaved:(...a)=>saved.push(a),onAuthenticationLost:()=>lost++};
 const h={window,document,saved,get lost(){return lost;},
 async render(next={}){props={...props,...next};await React.act(async()=>root.render(React.createElement(Profile,{key:props.userId,...props})));},
 async type(value){const input=document.querySelector('input');const key=Object.keys(input).find(k=>k.startsWith('__reactProps'));await React.act(async()=>input[key].onChange({target:{value}}));},
 async submit(){await React.act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));},
 async close(){await React.act(async()=>root.unmount());for(const[k,v]of old){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}}
 };await h.render();return h;
}
test('nickname normalizes Unicode and rejects controls, markup and excessive input',()=>{
 const {validNickname}=load();assert.equal(validNickname('  Pe\u0301ter  '),'Péter');assert.equal(validNickname('🍏P'),'🍏P');
 for(const value of ['A','a'.repeat(33),'<Piet>','ok\u0000','ab\u0085','ab\u202e','ab\u2067'])assert.equal(validNickname(value),null);
});
test('explicit save is tied to current account and confirmed only by the server',async()=>{
 const requests=[];const h=await fixture(async(url,options)=>{requests.push({url,options});return {ok:true,status:200,json:async()=>({user_id:'account-a',nickname:'Piet'})};});
 try{await h.type('  Piet  ');await h.submit();assert.deepEqual(h.saved,[['Piet','account-a']]);assert.equal(requests.length,1);assert.deepEqual(JSON.parse(requests[0].options.body),{user_id:'account-a',nickname:'Piet'});assert.equal(requests[0].options.headers['X-CalorieApp-Request'],'account-profile');assert.equal(h.document.querySelector('[role=status]').textContent,copy.nl.saved);assert.equal(h.document.querySelector('input').value,'Piet');}finally{await h.close();}
});
test('failed persistence is not reported as saved',async()=>{
 const h=await fixture(async()=>({ok:false,status:503}));try{await h.type('Piet');await h.submit();assert.equal(h.saved.length,0);assert.equal(h.document.querySelector('[role=alert]').textContent,copy.nl.saveError);assert.equal(h.document.querySelector('[role=status]'),null);}finally{await h.close();}
});
test('a changed authenticated account hides the old identity',async()=>{
 for(const status of [401,409]){const h=await fixture(async()=>({ok:false,status}));try{await h.type('Piet');await h.submit();assert.equal(h.lost,1);assert.equal(h.saved.length,0);}finally{await h.close();}}
});
test('a delayed response after switching accounts cannot restore the old nickname',async()=>{
 let resolve,signal;const h=await fixture((_url,options)=>{signal=options.signal;return new Promise(r=>{resolve=r;});});
 try{await h.type('Piet');await h.submit();await h.render({userId:'account-b',nickname:'Another'});assert.equal(signal.aborted,true);await React.act(async()=>{resolve({ok:true,status:200,json:async()=>({user_id:'account-a',nickname:'Piet'})});});assert.equal(h.saved.length,0);assert.equal(h.document.querySelector('input').value,'Another');}finally{await h.close();}
});
test('all eleven locales expose the same account controls and localize profile copy',async()=>{
 assert.equal(Object.keys(copy).length,11);
 for(const locale of Object.keys(copy)){const h=await fixture(async()=>{},locale);try{assert.equal(h.document.querySelector('h3').textContent,copy[locale].profile);assert.equal(h.document.querySelector('section').getAttribute('dir'),['ar','ur'].includes(locale)?'rtl':'ltr');assert.ok(h.document.body.textContent.includes(copy[locale].description));}finally{await h.close();}}
});
