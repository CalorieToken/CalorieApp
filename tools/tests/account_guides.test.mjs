import {profileCopy} from "./helpers/auth_ui.mjs";
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const React=require('react'),{createRoot}=require('react-dom/client'),{parseHTML}=require('linkedom'),ts=require('typescript');
const setup=JSON.parse(readFileSync(new URL('../../frontend/config/account-setup-copy.json',import.meta.url)));
const copy=JSON.parse(readFileSync(new URL('../../frontend/config/testnet-entry-copy.json',import.meta.url)));

function harness({importEnabled=false,stored=new Map(),hash='',age='adult'}={}){
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>');
 window.parent=window;
 Object.defineProperty(window,'location',{configurable:true,value:new URL('https://app.calorietoken.net/'+hash)});
 window.cancelAnimationFrame=()=>{};
 window.requestAnimationFrame=fn=>{fn();return 1;};
 Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)}});
 const old=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 globalThis.window=window;globalThis.document=document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const imports={
  'react':React,'react/jsx-runtime':require('react/jsx-runtime'),
  '@/components/DisplayLanguageProvider':{useDisplayLanguage:()=>({enabled:true,locale:'nl'})},
  '@/lib/locales':{localeDirection:()=> 'ltr'},
  '@/components/AgeExperienceControl':{AgeExperienceControl:()=>null,useAgeExperience:()=>[age,()=>{},true]},
  '@/components/FoodSearchPlaceholder':{FoodSearchPlaceholder:({activeView})=>React.createElement('div',{hidden:!activeView},'Food fixture')},
  '@/components/NicknameProfile':{NicknameProfile:()=>null},
  '@/components/XamanLoginPanel':{XamanLoginPanel:({guides})=>React.createElement('div',null,'Account fixture: no login requests',guides)},
  '@/lib/authUi':{getAuthUi:()=>({copy:{accountTools:'Accountbeheer'}})},
  '@/lib/foodDiary':{diaryCopy:()=>({title:'Dagboek'})},
  '@/lib/foodExperience':{foodExperience:()=>({copy:{sourceTitle:'Basisvoeding',navigation:'Ga naar'}})},
  '@/lib/foodUi':{getFoodUi:()=>({copy:{searchTitle:'Zoeken'},locale:'nl',direction:'ltr'})},
  '@/config/account-profile-copy.json': {default: profileCopy},
    '@/config/testnet-entry-copy.json':{default:copy},
  '@/config/account-setup-copy.json':{default:setup},
  '@/lib/navigationBridge':{postNavigationTarget:()=>false,trustedWordPressParentOrigin:()=>null},
  '@/lib/testnetAccount':{testnetWait:()=>0},
 };
 function load(name){
  if(name in imports)return imports[name];
  const path=name.replace('@/','../../frontend/')+(name.startsWith('@/lib/')?'.ts':'.tsx');
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require:load,window,document,CustomEvent:window.CustomEvent,process:{env:{NEXT_PUBLIC_ACCOUNT_DATA_IMPORT_UI_ENABLED:String(importEnabled)}}});
  imports[name]=module.exports;return module.exports;
 }
 const root=createRoot(document.getElementById('root'));
 const visible=node=>!node.closest('[hidden]');
 const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent.replace(/^[←→]/,'')===text&&visible(node));
 return {window,document,stored,load,button,
  setAge(value){age=value;},
  async render(){await React.act(async()=>root.render(React.createElement(load('@/components/CalorieAppWorkspace').CalorieAppWorkspace)));},
  async click(text){const node=button(text);assert.ok(node,`visible button: ${text}`);assert.equal(node.disabled,false);await React.act(async()=>node.dispatchEvent(new window.Event('click',{bubbles:true})));},
  async close(){await React.act(async()=>root.unmount());for(const[key,value]of old){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}
 };
}

test('native migration shows seven pages, a mandatory recovery checkpoint and a working return path',async()=>{
 const h=harness();
 try{
  await h.render();
  assert.ok(h.button(copy.nl.testRoute));assert.ok(h.button(copy.nl.moveRoute));
  await h.click(copy.nl.moveRoute);
  const title=()=>h.document.querySelector('#account-journey-title').textContent;
  assert.equal(title(),copy.nl.moveLabels[0]);
  assert.equal(h.document.querySelectorAll('[data-account-guide-screen]').length,1);
  await h.click(copy.nl.next);assert.equal(title(),copy.nl.moveLabels[1]);
  await h.click(copy.nl.previous);
  await h.click(copy.nl.openExportTools);
  assert.equal(h.document.querySelector('#calorie-panel-account').hidden,false);
  await h.click(copy.nl.returnGuide);
  assert.equal(title(),copy.nl.moveLabels[0]);
  for(let i=0;i<3;i++)await h.click(copy.nl.next);
  assert.equal(title(),setup.nl.mainBackupTitle);
  assert.equal(h.button(copy.nl.next).disabled,true);
  assert.equal(h.document.querySelectorAll('input:not([type="checkbox"])').length,0);
  await h.click(copy.nl.previous);assert.equal(title(),copy.nl.moveLabels[2]);
  await h.click(copy.nl.next);assert.equal(h.button(copy.nl.next).disabled,true);
  assert.ok(h.document.querySelector('[data-account-guide-screen]').textContent.includes(setup.nl.mainBackupText));
  await h.click(setup.nl.backToAccount);assert.ok(h.button(copy.nl.returnGuide));
  await h.click(copy.nl.returnGuide);assert.equal(title(),setup.nl.mainBackupTitle);
  const saved=h.load('@/lib/accountJourney').readAccountJourney();
  assert.equal(saved.route,'move');assert.equal(saved.index,3);
  assert.deepEqual(Object.keys(saved).sort(),['index','route']);
  assert.equal(h.button(copy.nl.openImportTools),undefined);
 }finally{await h.close();}
});

test('navigation survives remount but a backup acknowledgement is never restored',async()=>{
 const stored=new Map();let h=harness({stored});
 try{h.load('@/lib/accountJourney').saveAccountJourney({route:'move',index:5});}finally{await h.close();}
 h=harness({stored,importEnabled:true});
 try{
  await h.render();await h.click(copy.nl.returnGuide);
  assert.equal(h.document.querySelector('#account-journey-title').textContent,setup.nl.mainBackupTitle);
  assert.equal(h.button(copy.nl.next).disabled,true);
  assert.equal([...stored.values()].some(value=>/address|seed|wallet|secret/i.test(value)),false);
 }finally{await h.close();}
});

test('corrupt, extra-field and out-of-range saved navigation is ignored',async()=>{
 const stored=new Map(),h=harness({stored});
 try{
  const api=h.load('@/lib/accountJourney');
  api.saveAccountJourney({route:'move',index:2});const key=[...stored.keys()][0];
  for(const value of ['invalid','null',JSON.stringify({route:'move',index:7}),JSON.stringify({route:'evil',index:0}),JSON.stringify({route:'move',index:0,seed:'forged'})]){
   stored.set(key,value);assert.equal(api.readAccountJourney(),null);
  }
 }finally{await h.close();}
});


test('helpbot test entry starts the six-step guide after age resolution without creating an account',async()=>{
 const h=harness({hash:'#ctstyle-testnet',age:null});
 try{
  await h.render();assert.equal(h.document.querySelector('#calorie-panel-journey'),null);
  h.setAge('teen');await h.render();assert.equal(h.document.querySelector('#calorie-panel-journey'),null);
  h.setAge('adult');await h.render();
  assert.equal(h.document.querySelector('#calorie-panel-journey').hidden,false);
  assert.equal(h.document.querySelector('#account-journey-title').textContent,setup.nl.beforeStart);
  assert.ok(h.document.querySelector('[data-account-guide="test"]'));
  await h.click(copy.nl.next);
  assert.equal(h.document.querySelector('#account-journey-title').textContent,setup.nl.stepCreate);
  await h.click(setup.nl.backToAccount);
  assert.equal(h.document.querySelector('#calorie-panel-account').hidden,false);
 }finally{await h.close();}
});

test('public and account links select the relevant tab while a normal app visit keeps the account overview',async()=>{
 for(const [hash,tab] of [['','account'],['#food-search','packaged'],['#food-scan','packaged'],['#food-compare','packaged'],['#basic-foods','basic'],['#food-diary','diary'],['#account','account']]){
  const h=harness({hash});
  try{await h.render();assert.equal(h.document.querySelector('#calorie-tab-'+tab).getAttribute('aria-selected'),'true',hash);}
  finally{await h.close();}
 }
});
