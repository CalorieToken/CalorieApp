import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../frontend/package.json',import.meta.url));
const React = require('react');
const {createRoot} = require('react-dom/client');
const {parseHTML} = require('linkedom');
const ts = require('typescript');
const runtime = require('./lib/displayLanguageRuntime.js');
const registry = JSON.parse(readFileSync(new URL('../../frontend/config/locales.json',import.meta.url)));
const copy = JSON.parse(readFileSync(new URL('../../frontend/config/display-language-copy.json',import.meta.url)));
function load(path, imports, globals = {}) {
  const source = readFileSync(new URL('../../frontend/' + path,import.meta.url),'utf8');
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module = {exports:{}};
  vm.runInNewContext(code,{...globals,module,exports:module.exports,require(name){
    if(name==='react'||name==='react/jsx-runtime')return require(name);
    if(Object.hasOwn(imports,name))return imports[name];
    throw new Error('Unexpected language dependency: '+name);
  }});
  return module.exports;
}
const locales = load('lib/locales.ts',{'@/config/locales.json':{default:registry}});

async function fixture({embedded = true, enabled = undefined, saved = null} = {}) {
  const {window,document} = parseHTML('<html lang="en"><body><div id="root"></div></body></html>');
  const previous = new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  globalThis.window=window;globalThis.document=document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const sent=[];
  const parent={postMessage:(data,origin)=>sent.push({data,origin})};
  window.location=new URL('https://app.calorietoken.net/');
  window.parent=embedded?parent:window;
  window.localStorage={getItem:()=>saved,setItem(){},removeItem(){}};
  const module=load('components/DisplayLanguageProvider.tsx',{
    '@/lib/displayLanguageRuntime':runtime,'@/lib/locales':locales,
    '@/config/display-language-copy.json':{default:copy},
  },{window,document,URLSearchParams,navigator:{language:'en'},process:{env:{NEXT_PUBLIC_CALORIEAPP_DISPLAY_LANGUAGE:enabled}}});
  const root=createRoot(document.querySelector('#root'));
  await React.act(async()=>root.render(React.createElement(module.DisplayLanguageProvider,null,
    React.createElement(module.DisplayLanguagePicker),React.createElement('p',null,'Existing app'))));
  return {document,sent,parent,window,
    async message(data,{origin='https://calorietoken.net',source=parent}={}) {
      const event=new window.Event('message');Object.assign(event,{data,origin,source});
      await React.act(async()=>window.dispatchEvent(event));
    },
    async close(){
      await React.act(async()=>root.unmount());
      for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
    },
  };
}
function state(channel, overrides = {}) {
  return {type:'calorieapp:display-language:state',version:1,channel,epoch:'trusted-host-epoch-1234',revision:0,ack:0,locale:'en',explicit:false,...overrides};
}

test('The embedded picker remains usable until the trusted parent confirms even an unchanged language',async()=>{
  const h=await fixture();
  try{
    assert.equal(h.document.querySelectorAll('select').length,1);
    const channel=h.sent.find(x=>x.data.type==='calorieapp:display-language:ready').data.channel;
    await h.message(state(channel),{origin:'https://untrusted.example'});
    await h.message(state(channel),{source:{}});
    await h.message(state('wrong-channel-1234'));
    assert.equal(h.document.querySelectorAll('select').length,1,'Invalid messages cannot remove the fallback control');
    await h.message(state(channel));
    assert.equal(h.document.querySelectorAll('select').length,0,'The parent owns the one visible language control');
    await h.message(state(channel,{locale:'ur',explicit:true,revision:1}));
    assert.equal(h.document.documentElement.lang,'ur');
    assert.equal(h.document.documentElement.dir,'rtl');
    assert.ok(h.document.body.textContent.includes('Existing app'));
  }finally{await h.close();}
});

test('The standalone picker keeps eleven choices and follows a saved language without a parent',async()=>{
  const h=await fixture({embedded:false,saved:JSON.stringify({locale:'nl',savedAt:Date.now()})});
  try{
    assert.equal(h.document.querySelectorAll('option').length,11);
    assert.equal(h.sent.length,0);
    assert.equal(h.document.documentElement.lang,'nl');
    assert.equal(h.document.documentElement.dir,'ltr');
  }finally{await h.close();}
});

test('Disabling display language preserves the document and does not open a host channel',async()=>{
  const h=await fixture({enabled:'0'});
  try{
    assert.equal(h.document.querySelectorAll('select').length,0);
    assert.equal(h.sent.length,0);
    assert.equal(h.document.documentElement.lang,'en');
    assert.equal(h.document.documentElement.hasAttribute('dir'),false);
    assert.ok(h.document.body.textContent.includes('Existing app'));
  }finally{await h.close();}
});
