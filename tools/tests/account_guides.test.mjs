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

const install=JSON.parse(readFileSync(new URL('../../frontend/config/xaman-install-copy.json',import.meta.url),'utf8'));
const welcome=JSON.parse(readFileSync(new URL('../../frontend/config/account-welcome-copy.json',import.meta.url),'utf8'));

function harness({importEnabled=false,stored=new Map(),hash='',age='adult',testnet={},confirm=()=>true}={}){
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>');
 window.parent=window;
 Object.defineProperty(window,'location',{configurable:true,value:new URL('https://app.calorietoken.net/'+hash)});
 window.cancelAnimationFrame=()=>{};
 window.requestAnimationFrame=fn=>{fn();return 1;};
 Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)}});
 window.history={state:null,replaceState(_state,_title,url){window.location.href=new URL(url,window.location).href;}};
 window.confirm=confirm;
 const old=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 globalThis.window=window;globalThis.document=document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const imports={
  'react':React,'react/jsx-runtime':require('react/jsx-runtime'),
  '@/components/DisplayLanguageProvider':{useDisplayLanguage:()=>({enabled:true,locale:'nl'})},
  '@/lib/locales':{localeDirection:()=> 'ltr'},
  '@/components/AgeExperienceControl':{AgeExperienceControl:()=>null,useAgeExperience:()=>[age,()=>{},true]},
  '@/components/FoodSearchPlaceholder':{FoodSearchPlaceholder:({activeView})=>React.createElement('div',{hidden:!activeView},'Food fixture')},
  '@/components/NicknameProfile':{NicknameProfile:()=>null},
  '@/components/XamanLoginPanel':{XamanLoginPanel:({guides,welcome:renderWelcome})=>React.createElement('div',null,'Account fixture: no login requests',renderWelcome?.(React.createElement('button',null,'Sign in fixture')),guides)},
  '@/lib/authUi':{getAuthUi:()=>({copy:{accountTools:'Accountbeheer'}})},
  '@/lib/foodDiscovery':{discoveryCopy:()=>({backToProduct:'Terug naar {food}'})},
  '@/lib/foodDiary':{diaryCopy:()=>({title:'Dagboek'})},
  '@/lib/foodExperience':{foodExperience:()=>({copy:{sourceTitle:'Basisvoeding',navigation:'Ga naar'}})},
  '@/lib/foodUi':{getFoodUi:()=>({copy:{searchTitle:'Zoeken'},locale:'nl',direction:'ltr'})},
  '@/config/account-profile-copy.json': {default: profileCopy},
  '@/config/account-welcome-copy.json': {default: welcome},
  '@/config/xaman-install-copy.json': {default: install},
    '@/config/testnet-entry-copy.json':{default:copy},
  '@/config/account-setup-copy.json':{default:setup},
  '@/lib/navigationBridge':{postNavigationTarget:()=>false,trustedWordPressParentOrigin:()=>null},
  '@/lib/testnetAccount':{testnetWait:()=>0,...testnet},
 };
 function load(name){
  if(name in imports)return imports[name];
  const path=name.replace('@/','../../frontend/')+(name.startsWith('@/lib/')?'.ts':'.tsx');
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require:load,window,document,AbortController,CustomEvent:window.CustomEvent,process:{env:{NEXT_PUBLIC_ACCOUNT_DATA_IMPORT_UI_ENABLED:String(importEnabled)}}});
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
  const saved=h.load('@/lib/accountJourney').readAccountJourney();
  assert.equal(saved.route,'move');assert.equal(saved.index,3);
  assert.deepEqual(Object.keys(saved).sort(),['index','route']);
  assert.equal(h.button(copy.nl.openImportTools),undefined);
  await h.click(setup.nl.cancelGuide);
  assert.equal(h.button(copy.nl.returnGuide),undefined);
  assert.equal(h.load('@/lib/accountJourney').readAccountJourney(),null);
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
  await h.click(setup.nl.cancelGuide);
  assert.equal(h.document.querySelector('#calorie-panel-account').hidden,false);
  assert.equal(h.button(copy.nl.returnGuide),undefined);
  assert.equal(h.window.location.hash,'');
 }finally{await h.close();}
});

test('cancelling clears saved progress, survives remount, and a later setup starts at step one',async()=>{
 const stored=new Map();let h=harness({stored,hash:'#test-account'});
 try{
  await h.render();await h.click(copy.nl.next);
  assert.equal(h.load('@/lib/accountJourney').readAccountJourney().index,1);
  await h.click(setup.nl.cancelGuide);
  assert.equal(h.load('@/lib/accountJourney').readAccountJourney(),null);
  assert.equal(h.button(copy.nl.returnGuide),undefined);
  assert.equal(h.window.location.hash,'');
  await h.click(copy.nl.testRoute);
  assert.equal(h.document.querySelector('#account-journey-title').textContent,setup.nl.beforeStart);
  await h.click(setup.nl.cancelGuide);
 }finally{await h.close();}
 h=harness({stored});
 try{await h.render();assert.equal(h.button(copy.nl.returnGuide),undefined);assert.equal(h.document.querySelector('#calorie-panel-account').hidden,false);}
 finally{await h.close();}
});

test('a paused guide can be cancelled from the account overview',async()=>{
 const stored=new Map(),h=harness({stored});
 try{
  h.load('@/lib/accountJourney').saveAccountJourney({route:'test',index:1});
  await h.render();assert.ok(h.button(copy.nl.returnGuide));
  await h.click(setup.nl.cancelGuide);
  assert.equal(h.button(copy.nl.returnGuide),undefined);
  assert.equal(h.load('@/lib/accountJourney').readAccountJourney(),null);
 }finally{await h.close();}
});

test('cancellation aborts a pending creation and ignores its late response',async()=>{
 let resolveCreate,signal;
 const h=harness({testnet:{createTestnetAccount:value=>{signal=value;return new Promise(resolve=>{resolveCreate=resolve;});}}});
 try{
  await h.render();await h.click(copy.nl.testRoute);await h.click(copy.nl.next);await h.click(setup.nl.create);
  await h.click(setup.nl.cancelGuide);assert.equal(signal.aborted,true);
  await React.act(async()=>resolveCreate({address:'fixture-address',secret:'fixture-secret'}));
  assert.equal(h.button(copy.nl.returnGuide),undefined);
  assert.equal(h.load('@/lib/accountJourney').readAccountJourney(),null);
  assert.equal(h.document.body.textContent.includes('fixture-secret'),false);
  await h.click(copy.nl.testRoute);
  assert.equal(h.document.querySelector('#account-journey-title').textContent,setup.nl.beforeStart);
 }finally{await h.close();}
});

test('an unsaved recovery code is kept when cancellation is declined and discarded only after confirmation',async()=>{
 let accept=false,confirmations=0;
 const h=harness({confirm:message=>{assert.equal(message,setup.nl.cancelUnsaved);confirmations++;return accept;},testnet:{createTestnetAccount:async()=>({address:'fixture-address',secret:'fixture-secret'}),checkTestnetAccount:async()=>true}});
 try{
  await h.render();await h.click(copy.nl.testRoute);await h.click(copy.nl.next);await h.click(setup.nl.create);
  assert.equal(h.document.querySelector('#account-journey-title').textContent,setup.nl.saveTitle);
  await h.click(setup.nl.cancelGuide);
  assert.equal(confirmations,1);assert.equal(h.document.querySelector('#calorie-panel-journey').hidden,false);
  await h.click(setup.nl.show);assert.equal(h.document.querySelector('#account-guide-secret').textContent,'fixture-secret');
  accept=true;await h.click(setup.nl.cancelGuide);
  assert.equal(confirmations,2);assert.equal(h.button(copy.nl.returnGuide),undefined);
  assert.equal(h.document.body.textContent.includes('fixture-secret'),false);
  assert.equal(h.load('@/lib/accountJourney').readAccountJourney(),null);
 }finally{await h.close();}
});

test('public and account links select the relevant tab while a normal app visit keeps the account overview',async()=>{
 for(const [hash,tab] of [['','account'],['#food-search','packaged'],['#food-scan','packaged'],['#food-compare','packaged'],['#basic-foods','basic'],['#food-diary','diary'],['#account','account']]){
  const h=harness({hash});
  try{await h.render();assert.equal(h.document.querySelector('#calorie-tab-'+tab).getAttribute('aria-selected'),'true',hash);}
  finally{await h.close();}
 }
});


test('beginner choices browse without account creation and install before creating a test account',async()=>{
 let calls=0;const h=harness({testnet:{createTestnetAccount:async()=>{calls++;return {address:'fixture-address',secret:'fixture-secret'};},checkTestnetAccount:async()=>true}});
 try{
  await h.render();
  const choices=h.document.querySelector('[data-account-welcome]');assert.ok(choices);
  assert.ok(choices.textContent.includes(welcome.nl.existing));
  const buttons=choices.querySelectorAll('button');
  await React.act(async()=>buttons[0].dispatchEvent(new h.window.Event('click',{bubbles:true})));
  assert.equal(h.document.querySelector('#calorie-tab-packaged').getAttribute('aria-selected'),'true');assert.equal(calls,0);
  await h.click(profileCopy.nl.account);
  await React.act(async()=>buttons[1].dispatchEvent(new h.window.Event('click',{bubbles:true})));
  assert.equal(h.document.querySelector('#account-journey-title').textContent,setup.nl.beforeStart);
  await h.click('Android');
  assert.equal(h.document.querySelector('a[href="https://play.google.com/store/apps/details?id=com.xrpllabs.xumm"]').target,'_blank');
  await h.click('iPhone');
  assert.ok(h.document.querySelector('a[href="https://apps.apple.com/app/id1492302343"]'));
  assert.equal(calls,0);
  await h.click(install.nl.already);
  assert.equal(calls,0);assert.ok(h.button(setup.nl.create));
  await h.click(setup.nl.create);assert.equal(calls,1);
  assert.equal(h.button(copy.nl.next).disabled,true,'Saving the recovery code remains mandatory');
  await h.click(setup.nl.show);
  const ack=h.document.querySelector('input[type="checkbox"]');
  const props=ack[Object.keys(ack).find(key=>key.startsWith('__reactProps$'))];
  await React.act(async()=>props.onChange({target:{checked:true}}));
  await h.click(copy.nl.next);
  const instruction=()=>h.document.querySelector('[data-xaman-instruction]').textContent;
  assert.ok(instruction().includes(welcome.nl.networkSettings));
  await h.click(copy.nl.next);assert.ok(instruction().includes(welcome.nl.networkDeveloper));
  await h.click(copy.nl.previous);assert.ok(instruction().includes(welcome.nl.networkSettings));
  await h.click(copy.nl.next);await h.click(copy.nl.next);assert.ok(instruction().includes(welcome.nl.networkChoose));
  await h.click(copy.nl.next);assert.ok(instruction().includes(welcome.nl.importAccount));
  await h.click(copy.nl.next);assert.ok(instruction().includes(welcome.nl.importAccess));
  await h.click(copy.nl.next);assert.ok(instruction().includes(welcome.nl.importSeed));
  assert.equal(h.button(copy.nl.next).disabled,true,'Import acknowledgement remains mandatory');
  assert.equal(h.document.querySelector('#account-guide-secret').textContent,'','Recovery code is concealed after navigation');
 }finally{await h.close();}
});

test('beginner guidance covers the same eleven locales without missing messages',()=>{
 assert.deepEqual(Object.keys(welcome).sort(),Object.keys(setup).sort());
 for(const [locale,values] of Object.entries(welcome)){
  assert.deepEqual(Object.keys(values).sort(),Object.keys(welcome.en).sort(),locale);
  assert.ok(Object.values(values).every(value=>typeof value==='string'&&value.trim()),locale);
 }
});
