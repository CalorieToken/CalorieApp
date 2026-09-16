import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),ts=require('typescript');
const source=readFileSync(new URL('../../frontend/components/NicknameProfile.tsx',import.meta.url),'utf8');
const copy=JSON.parse(readFileSync(new URL('../../frontend/config/testnet-entry-copy.json',import.meta.url),'utf8'));

function load(locale='en'){
  const module={exports:{}};
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require(name){
    if(name==='react'||name==='react/jsx-runtime')return require(name);
    if(name==='@/components/authEvents')return {AUTH_STATE_CHANGED_EVENT:'calorieapp:auth-state-changed'};
    if(name==='@/components/DisplayLanguageProvider')return {useDisplayLanguage:()=>({enabled:true,locale})};
    if(name==='@/lib/locales')return {localeDirection:tag=>['ar','ur'].includes(tag)?'rtl':'ltr'};
    if(name==='@/config/testnet-entry-copy.json')return {default:copy};
    throw new Error(name);
  }});
  return module.exports;
}

test('nickname accepts a small visible value and rejects unsafe or excessive input',()=>{
  const {validNickname}=load();
  assert.equal(validNickname('  Pieter  '),'Pieter');
  assert.equal(validNickname('🍏P'),'🍏P');
  for(const value of ['A','a'.repeat(33),'<Pieter>','ok\u0000'])assert.equal(validNickname(value),null,value);
});

test('nickname is tab-only, clearable on logout and never part of account transfer',()=>{
  assert.match(source,/sessionStorage\.setItem\(NICKNAME_STORAGE_KEY/);
  assert.match(source,/sessionStorage\.removeItem\(NICKNAME_STORAGE_KEY/);
  assert.match(source,/AUTH_STATE_CHANGED_EVENT/);
  assert.match(source,/authenticated !== false/);
  assert.doesNotMatch(source,/localStorage|fetch\(|backendRequest|user_id|xrpl|wallet/i);
  const html=renderToStaticMarkup(React.createElement(load('nl').NicknameProfile));
  assert.match(html,/Nickname in dit tabblad/);
  assert.match(html,/niet in een export/);
});
