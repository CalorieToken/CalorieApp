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
const source = readFileSync(new URL('../../frontend/components/TestnetEntry.tsx', import.meta.url), 'utf8');

function load(display = {enabled:true, locale:'en'}) {
  const module={exports:{}};
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(compiled,{module,exports:module.exports,process:{env:{}},require(name){
    if(name==='react'||name==='react/jsx-runtime')return require(name);
    if(name==='@/components/DisplayLanguageProvider')return {useDisplayLanguage:()=>display};
    if(name==='@/lib/locales')return {localeDirection:tag=>['ar','ur'].includes(tag)?'rtl':'ltr'};
    if(name==='@/config/testnet-entry-copy.json')return {default:copy};
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

test('the rendered journey has four real tabs, local seed guidance and app destinations',()=>{
  const display={enabled:true,locale:'en'},api=load(display);
  for(const tag of Object.keys(copy)){
    display.locale=tag;
    const html=renderToStaticMarkup(React.createElement(api.TestnetEntry,{onNavigate(){},onOpenAccountTools(){}}));
    assert.ok(html.includes(`lang="${tag}"`),tag);
    assert.equal((html.match(/role="tab"/g)||[]).length,4,tag);
    assert.equal((html.match(/role="tabpanel"/g)||[]).length,4,tag);
    assert.match(html,/href="https:\/\/calorietoken\.net\/index\.php\/calorieapp\/#ctstyle-testnet"/);
    assert.match(html,/href="https:\/\/xaman\.app\/"/);
  }
});

test('guide bridge accepts only exact capability messages and never carries account material',()=>{
  const {exactGuideMessage}=load();
  assert.equal(exactGuideMessage({type:'calorieapp:testnet-guide:available',version:1},'available'),true);
  for(const value of [
    null,
    {type:'calorieapp:testnet-guide:available',version:2},
    {type:'calorieapp:testnet-guide:available',version:1,address:'rForged'},
    {type:'calorieapp:testnet-guide:complete'},
    ['calorieapp:testnet-guide:available',1],
  ])assert.equal(exactGuideMessage(value,'available'),false);
  assert.match(source,/event\.source !== window\.parent/);
  assert.match(source,/origins\.includes\(event\.origin\)/);
  assert.doesNotMatch(source,/postMessage\([^)]*(?:seed|secret|address|account)/i);
  assert.doesNotMatch(source,/localStorage/);
});
