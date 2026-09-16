import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const source = readFileSync(new URL('../../frontend/lib/ageExperience.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText;

function load(referrer='https://calorietoken.net/calorieapp/') {
  const sent=[];
  const values=new Map();
  const parent={postMessage(message,origin){sent.push({message,origin});}};
  const window={parent,sessionStorage:{
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
  }};
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,window,document:{referrer},URL});
  return {api:module.exports,window,parent,sent,values};
}

function loadControl(api) {
  const componentSource=readFileSync(new URL('../../frontend/components/AgeExperienceControl.tsx',import.meta.url),'utf8');
  const componentCode=ts.transpileModule(componentSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(componentCode,{module,exports:module.exports,window:{},document:{},require(name){
    if(name==='react'||name==='react/jsx-runtime')return require(name);
    if(name==='@/components/DisplayLanguageProvider')return {useDisplayLanguage:()=>({enabled:true,locale:'nl'})};
    if(name==='@/lib/ageExperience')return api;
    throw new Error(`Unexpected age-control dependency: ${name}`);
  }});
  return module.exports.AgeExperienceControl;
}

test('three fixed age bands have complete copy in all eleven interface languages',()=>{
  const {api}=load('');
  assert.equal(api.isAgeBand('child'),true);
  assert.equal(api.isAgeBand('teen'),true);
  assert.equal(api.isAgeBand('adult'),true);
  for(const value of [null,'','minor','12','child '])assert.equal(api.isAgeBand(value),false);
  for(const tag of ['en','nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur']){
    const ui=api.ageExperienceCopy(tag);
    assert.equal(ui.locale,tag);
    assert.equal(ui.direction,['ar','ur'].includes(tag)?'rtl':'ltr');
    for(const value of Object.values(ui.copy))assert.ok(typeof value==='string'&&value.trim(),tag);
  }
});

test('the actual selector has three equal choices, no birth-date field and an always available change control',()=>{
  const {api}=load('');
  const Control=loadControl(api);
  const selector=renderToStaticMarkup(React.createElement(Control,{band:null,onChange(){}}));
  assert.equal((selector.match(/<button/g)||[]).length,3);
  assert.equal((selector.match(/<input/g)||[]).length,0);
  for(const band of ['child','teen','adult'])assert.match(selector,new RegExp(`data-age-option="${band}"`));
  for(const text of ['Kind · 0–12','Jongere · 13–17','Volwassene · 18+'])assert.ok(selector.includes(text));
  assert.match(selector,/geen bewijs van leeftijd/i);
  const selected=renderToStaticMarkup(React.createElement(Control,{band:'child',onChange(){}}));
  assert.equal((selected.match(/<button/g)||[]).length,1);
  assert.match(selected,/Leeftijdsgroep wijzigen/);
  assert.match(selected,/Kind · 0–12/);
  assert.doesNotMatch(selected,/Wallet-login|Openbare voedingstools/);
});

test('age choice is session-only, contains no date and crosses only the exact parent channel',()=>{
  const approved=load();
  approved.api.storeSessionAgeBand('teen');
  assert.equal(approved.api.readSessionAgeBand(),'teen');
  assert.deepEqual([...approved.values.entries()],[[approved.api.AGE_BAND_STORAGE_KEY,'teen']]);
  assert.equal(approved.api.postAgeBandToParent('teen'),true);
  assert.equal(approved.api.requestAgeBandFromParent(),true);
  assert.deepEqual(JSON.parse(JSON.stringify(approved.sent)),[
    {message:{type:'calorieapp:age-band',version:1,band:'teen'},origin:'https://calorietoken.net'},
    {message:{type:'calorieapp:age-band:request',version:1},origin:'https://calorietoken.net'},
  ]);
  assert.equal(approved.api.ageBandFromParent({source:approved.parent,origin:'https://calorietoken.net',data:{type:'calorieapp:age-band',version:1,band:'child'}}),'child');
  for(const event of [
    {source:{},origin:'https://calorietoken.net',data:{type:'calorieapp:age-band',version:1,band:'adult'}},
    {source:approved.parent,origin:'https://evil.example',data:{type:'calorieapp:age-band',version:1,band:'adult'}},
    {source:approved.parent,origin:'https://calorietoken.net',data:{type:'calorieapp:age-band',version:1,band:'minor'}},
    {source:approved.parent,origin:'https://calorietoken.net',data:{type:'calorieapp:age-band',version:2,band:'adult'}},
  ])assert.equal(approved.api.ageBandFromParent(event),null);
  approved.api.storeSessionAgeBand(null);
  assert.equal(approved.api.readSessionAgeBand(),null);
  assert.doesNotMatch(source,/localStorage|date_of_birth|birthDate|\bdob\b|account(?:Id|_id)/i);
});

test('unapproved parents cannot receive or set an age band',()=>{
  for(const referrer of ['','https://example.com/calorieapp/','javascript:alert(1)']){
    const blocked=load(referrer);
    assert.equal(blocked.api.postAgeBandToParent('adult'),false);
    assert.equal(blocked.api.requestAgeBandFromParent(),false);
    assert.equal(blocked.sent.length,0);
  }
});
