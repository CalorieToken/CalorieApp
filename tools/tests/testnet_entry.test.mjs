import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const ts = require('typescript');
const copy = JSON.parse(readFileSync(new URL('../../frontend/config/testnet-entry-copy.json', import.meta.url)));
const setup = JSON.parse(readFileSync(new URL('../../frontend/config/account-setup-copy.json', import.meta.url)));
const source = readFileSync(new URL('../../frontend/components/TestnetEntry.tsx', import.meta.url), 'utf8');

function load(display = {enabled:true, locale:'en'}) {
  const module={exports:{}};
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(compiled,{module,exports:module.exports,process:{env:{}},require(name){
    if(name==='react'||name==='react/jsx-runtime')return require(name);
    if(name==='@/components/DisplayLanguageProvider')return {useDisplayLanguage:()=>display};
    if(name==='@/components/XamanInstallGuide')return {XamanInstallGuide:()=>null};
    if(name==='@/lib/locales')return {localeDirection:tag=>['ar','ur'].includes(tag)?'rtl':'ltr'};
    if(name==='@/config/testnet-entry-copy.json')return {default:copy};
    if(name==='@/config/account-welcome-copy.json')return {default:JSON.parse(readFileSync(new URL('../../frontend/config/account-welcome-copy.json',import.meta.url)))};
    if(name==='@/config/account-setup-copy.json')return {default:setup};
    if(name==='@/lib/navigationBridge')return {postNavigationTarget:()=>false};
    if(name==='@/lib/testnetAccount')return {};
    if(name==='@/lib/accountJourney')return {readAccountJourney:()=>null,saveAccountJourney:()=>{}};
    throw new Error(name);
  }});
  return module.exports;
}

test('all eleven account-journey translations have the same complete structure',()=>{
  const expected=['en','nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur'];
  assert.deepEqual(Object.keys(copy),expected);
  const keys=Object.keys(copy.en).sort();
  for(const tag of expected){
    assert.deepEqual(Object.keys(copy[tag]).sort(),keys,tag);
    assert.equal(copy[tag].moveSteps.length,5,tag);
    for(const value of Object.values(copy[tag])){
      if(Array.isArray(value))value.forEach(item=>assert.ok(item.trim(),tag));
      else assert.ok(value.trim(),tag);
    }
  }
  assert.match(copy.en.seedWarning,/never paste|never reuse/i);
  assert.match(copy.nl.seedWarning,/nooit.*CalorieApp|nooit.*hergebruik/i);
  assert.match(copy.en.moveText,/fresh Mainnet account/i);
  assert.match(copy.nl.moveText,/nieuw Mainnet-account/i);
});

test('native guide starts with two app routes and never hands off to WordPress',()=>{
  const display={enabled:true,locale:'en'},api=load(display);
  assert.deepEqual(Object.keys(setup).sort(),Object.keys(copy).sort());
  for(const tag of Object.keys(copy)){
    display.locale=tag;
    assert.deepEqual(Object.keys(setup[tag]).sort(),Object.keys(setup.en).sort());
    for(const value of Object.values(setup[tag]))assert.ok(typeof value==='string'&&value.trim(),tag);
    const html=renderToStaticMarkup(React.createElement(api.TestnetEntry,{onNavigate(){},onOpenAccountTools(){}}));
    assert.ok(html.includes(`lang="${tag}"`),tag);
    assert.equal((html.match(/data-account-guide-screen/g)||[]).length,1,tag);
    assert.ok(html.includes(copy[tag].testRoute),tag);
    assert.ok(html.includes(copy[tag].moveRoute),tag);
    assert.doesNotMatch(html,/ctstyle-testnet|iframe|role="tab"/);
    assert.match(html,new RegExp(`dir="${['ar','ur'].includes(tag)?'rtl':'ltr'}"`));
  }
});

test('recovery controls have no secret input, URL or WordPress message handoff',()=>{
  assert.doesNotMatch(source,/postMessage|localStorage|ctstyle-testnet|target="_top"/);
  assert.doesNotMatch(source,/<input[^>]*type="(?:text|password|hidden)"/);
  assert.match(source,/shown \? account.secret : ""/);
  assert.match(source,/document.addEventListener\("visibilitychange", conceal\)/);
  assert.match(source,/window.addEventListener\("pagehide", clear\)/);
});
