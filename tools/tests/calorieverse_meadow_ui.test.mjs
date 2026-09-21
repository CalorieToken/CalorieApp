import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const React=require('react'), {createRoot}=require('react-dom/client'), {parseHTML}=require('linkedom'), ts=require('typescript');
const read=path=>readFileSync(new URL('../../frontend/'+path,import.meta.url),'utf8');
const json=path=>JSON.parse(read(path));
const meadowPack=json('config/calorieverse-meadow.json'), foodPack=json('config/calorieverse-food-activity.json');
function load(path,imports,globals={}) {
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{
    ...globals,module,exports:module.exports,require(name){
      if(name==='react'||name==='react/jsx-runtime')return require(name);
      if(Object.hasOwn(imports,name))return imports[name];
      throw Error('Unexpected preview dependency: '+name);
    },
  });
  return module.exports;
}
const meadow=load('lib/calorieVerseMeadow.ts',{'../config/calorieverse-meadow.json':meadowPack});
const activities=load('lib/calorieVerseActivities.ts',{'../config/calorieverse-food-activity.json':foodPack,'./calorieVerseMeadow':meadow});
async function fixture({raw=null,locale='nl'}={}) {
  const {window,document}=parseHTML('<html><body><div id="root"></div></body></html>');
  const old=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  globalThis.window=window;globalThis.document=document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const saved=new Map([[meadow.STARTER_KEY,'{"starter_character_id":"existing-starter"}']]);
  if(raw!==null)saved.set(meadow.MEADOW_KEY,raw);
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
  let timer=0; const timers=new Map();
  const module=load('components/CalorieVerseMeadow.tsx',{
    'next/image':props=>React.createElement('img',props),
    'next/link':props=>React.createElement('a',props),
    '@/components/DisplayLanguageProvider':{useDisplayLanguage:()=>({enabled:true,locale}),DisplayLanguagePicker:()=>null},
    '@/lib/locales':{localeDirection:value=>['ar','ur'].includes(value)?'rtl':'ltr'},
    '@/config/calorieverse-meadow-copy.json':json('config/calorieverse-meadow-copy.json'),
    '@/config/calorieverse-food-copy.json':json('config/calorieverse-food-copy.json'),
    '@/lib/calorieVerseMeadow':meadow,'@/lib/calorieVerseActivities':activities,
    './CalorieVerseMeadow.module.css':{},
  },{window,document,localStorage:storage,requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},
    setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(module.CalorieVerseMeadow)));
  return {document,window,saved,
    button:text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text),
    async click(node){assert.ok(node,'button exists');assert.equal(node.disabled,false);await React.act(async()=>node.dispatchEvent(new window.Event('click',{bubbles:true})));},
    async flush(){await React.act(async()=>{for(const fn of timers.values())fn();timers.clear();});},
    async close(){await React.act(async()=>root.unmount());for(const[k,v]of old){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}},
  };
}

test('visitor answers at the stand, pauses, resumes, saves and restores without changing starter identity',async()=>{
  const before={...meadow.initialMeadow(),position:{x:foodPack.object.x,y:foodPack.object.y},garden:'harvested'};
  const h=await fixture({raw:JSON.stringify(before)});
  let raw;
  try {
    await h.click(h.document.querySelector('[data-world-object="meadow.food-data.stand"]'));
    await h.click(h.button('Wortel'));
    assert.ok(h.document.body.textContent.includes('Kijk nog eens goed'));
    const copy=json('config/calorieverse-meadow-copy.json').nl;
    await h.click(h.button(copy.pause));
    assert.equal(h.button('Appel').disabled,true);
    await h.click(h.button(copy.resume));
    await h.click(h.button('Appel'));
    assert.ok(h.document.body.textContent.includes('Je eerste voedseldata-activiteit is voltooid'));
    assert.equal(h.button('Appel'),undefined);
    const link=[...h.document.querySelectorAll('a')].find(a=>a.textContent.includes('Ontdek CalorieApp'));
    assert.equal(link.getAttribute('href'),'/?ui_lang=nl');
    await h.flush();raw=h.saved.get(meadow.MEADOW_KEY);
    assert.equal(JSON.parse(raw).garden,'harvested');
    assert.equal(JSON.parse(h.saved.get(meadow.STARTER_KEY)).starter_character_id,'existing-starter');
  }finally{await h.close();}
  const again=await fixture({raw});
  try {
    await again.click(again.document.querySelector('[data-world-object="meadow.food-data.stand"]'));
    assert.ok(again.document.body.textContent.includes('Je eerste voedseldata-activiteit is voltooid'));
  }finally{await again.close();}
});

test('far-away visitor must approach the activity; malformed saves remain untouched on exit',async()=>{
  const h=await fixture({raw:'unreadable-save'});
  try {
    await h.click(h.document.querySelector('[data-world-object="meadow.food-data.stand"]'));
    assert.equal(h.button('Appel'),undefined);
    assert.ok(h.button(json('config/calorieverse-meadow-copy.json').nl.walk));
    await h.flush();
    assert.equal(h.saved.get(meadow.MEADOW_KEY),'unreadable-save');
  }finally{await h.close();}
  assert.equal(h.saved.get(meadow.MEADOW_KEY),'unreadable-save');
});

test('the same activity presents Arabic copy and RTL without replacing saved progress',async()=>{
  const state={...meadow.initialMeadow(),position:{x:foodPack.object.x,y:foodPack.object.y}};
  const h=await fixture({raw:JSON.stringify(state),locale:'ar'});
  try {
    await h.click(h.document.querySelector('[data-world-object="meadow.food-data.stand"]'));
    assert.equal(h.document.querySelector('main').getAttribute('dir'),'rtl');
    const copy=json('config/calorieverse-food-copy.json').ar;
    assert.ok(h.button(copy.apple));
    assert.ok(h.document.body.textContent.includes(copy.question));
    await h.click(h.button(copy.apple));
    assert.ok(h.document.body.textContent.includes(copy.complete));
  }finally{await h.close();}
});
