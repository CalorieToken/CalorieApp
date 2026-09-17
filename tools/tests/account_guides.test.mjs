import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const React=require('react'),{createRoot}=require('react-dom/client'),{parseHTML}=require('linkedom'),ts=require('typescript');
const copy=JSON.parse(readFileSync(new URL('../../frontend/config/testnet-entry-copy.json',import.meta.url)));

function harness({importEnabled=false,stored=new Map()}={}){
 const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>');
 window.parent=window;
 window.requestAnimationFrame=fn=>{fn();return 1;};
 Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)}});
 const old=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 globalThis.window=window;globalThis.document=document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const imports={
  'react':React,'react/jsx-runtime':require('react/jsx-runtime'),
  '@/components/DisplayLanguageProvider':{useDisplayLanguage:()=>({enabled:true,locale:'nl'})},
  '@/lib/locales':{localeDirection:()=> 'ltr'},
  '@/components/AgeExperienceControl':{AgeExperienceControl:()=>null,useAgeExperience:()=>['adult',()=>{}]},
  '@/components/FoodSearchPlaceholder':{FoodSearchPlaceholder:({activeView})=>React.createElement('div',{hidden:!activeView},'Food fixture')},
  '@/components/NicknameProfile':{NicknameProfile:()=>null},
  '@/components/XamanLoginPanel':{XamanLoginPanel:()=>React.createElement('p',null,'Account fixture: no login requests')},
  '@/lib/authUi':{getAuthUi:()=>({copy:{accountTools:'Accountbeheer'}})},
  '@/lib/foodDiary':{diaryCopy:()=>({title:'Dagboek'})},
  '@/lib/foodExperience':{foodExperience:()=>({copy:{sourceTitle:'Basisvoeding',navigation:'Ga naar'}})},
  '@/lib/foodUi':{getFoodUi:()=>({copy:{searchTitle:'Zoeken'},locale:'nl',direction:'ltr'})},
  '@/config/testnet-entry-copy.json':{default:copy},
 };
 function load(name){
  if(name in imports)return imports[name];
  const path=name.replace('@/','../../frontend/')+(name.endsWith('accountJourney')?'.ts':'.tsx');
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require:load,window,document,CustomEvent:window.CustomEvent,process:{env:{NEXT_PUBLIC_ACCOUNT_DATA_IMPORT_UI_ENABLED:String(importEnabled)}}});
  imports[name]=module.exports;return module.exports;
 }
 const root=createRoot(document.getElementById('root'));
 const visible=node=>!node.closest('[hidden]');
 const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent===text&&visible(node));
 return {window,document,stored,load,button,
  async render(){await React.act(async()=>root.render(React.createElement(load('@/components/CalorieAppWorkspace').CalorieAppWorkspace)));},
  async click(text){const node=button(text);assert.ok(node,`visible button: ${text}`);assert.equal(node.disabled,false);await React.act(async()=>node.dispatchEvent(new window.Event('click',{bubbles:true})));},
  async close(){await React.act(async()=>root.unmount());for(const[key,value]of old){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}
 };
}

test('two account shortcuts, five migration screens and return path retain progress without enabling import',async()=>{
 const h=harness();
 try{
  await h.render();
  assert.ok(h.button(copy.nl.testRoute));assert.ok(h.button(copy.nl.moveRoute));
  await h.click(copy.nl.moveRoute);
  assert.equal(h.document.querySelector('#account-journey-panel-move').hidden,false);
  assert.equal(h.document.querySelector('h4').textContent,copy.nl.moveLabels[0]);
  await h.click(copy.nl.next);
  assert.equal(h.document.querySelector('h4').textContent,copy.nl.moveLabels[1]);
  await h.click(copy.nl.previous);
  await h.click(copy.nl.openExportTools);
  assert.equal(h.document.querySelector('#calorie-panel-account').hidden,false);
  await h.click(copy.nl.returnGuide);
  assert.equal(h.document.querySelector('h4').textContent,copy.nl.moveLabels[0]);
  for(let i=1;i<5;i++){
   await h.click(copy.nl.next);
   assert.equal(h.document.querySelector('h4').textContent,copy.nl.moveLabels[i]);
  }
  assert.equal(h.button(copy.nl.openImportTools),undefined);
  assert.ok(h.document.querySelector('#account-journey-panel-move').textContent.includes(copy.nl.importPending));
  const saved=h.load('@/lib/accountJourney').readAccountJourney();
  assert.equal(saved.step,'move');assert.equal(saved.moveIndex,4);
  assert.deepEqual(Object.keys(saved).sort(),['moveIndex','step']);
  await h.click(copy.nl.next);assert.equal(h.document.querySelector('#account-journey-panel-finish').hidden,false);
  await h.click(copy.nl.previous);assert.equal(h.document.querySelector('h4').textContent,copy.nl.moveLabels[4]);
 }finally{await h.close();}
});

test('account navigation survives a remount and shows a return button after sign-in',async()=>{
 const stored=new Map();let h=harness({stored});
 try{await h.render();await h.click(copy.nl.moveRoute);await h.click(copy.nl.next);await h.click(copy.nl.next);}finally{await h.close();}
 h=harness({stored,importEnabled:true});
 try{
  await h.render();await h.click(copy.nl.returnGuide);
  assert.equal(h.document.querySelector('h4').textContent,copy.nl.moveLabels[2]);
  await h.click(copy.nl.next);await h.click(copy.nl.next);
  assert.ok(h.button(copy.nl.openImportTools));
  assert.equal([...stored.values()].some(value=>/address|seed|wallet|secret/i.test(value)),false);
 }finally{await h.close();}
});

test('corrupt, extra-field and out-of-range saved navigation is ignored',async()=>{
 const stored=new Map(),h=harness({stored});
 try{
  const api=h.load('@/lib/accountJourney');
  api.saveAccountJourney({step:'move',moveIndex:2});const key=[...stored.keys()][0];
  for(const value of ['invalid','null',JSON.stringify({step:'move',moveIndex:6}),JSON.stringify({step:'evil',moveIndex:0}),JSON.stringify({step:'move',moveIndex:0,seed:'forged'})]){
   stored.set(key,value);assert.equal(api.readAccountJourney(),null);
  }
 }finally{await h.close();}
});
