import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const copy = JSON.parse(readFileSync(new URL('../../frontend/config/testnet-entry-copy.json', import.meta.url)));
function fixture(embedded = true) {
  let host = null, receive, cleanup;
  const sent = [], parent = { postMessage: (data, origin) => sent.push({data, origin}) };
  const window = { parent, addEventListener: (_, fn) => { receive = fn; }, removeEventListener: () => { receive = null; } };
  if (!embedded) window.parent = window;
  const display = { enabled: true, locale: 'en' };
  const module = {exports:{}};
  const source = readFileSync(new URL('../../frontend/components/TestnetEntry.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { window, module, exports:module.exports, require(name) {
    if (name === 'react') return {useState: () => [host, value => {host=value;}], useEffect: fn => { cleanup = fn(); }};
    if (name === 'react/jsx-runtime') return require(name);
    if (name === '@/components/DisplayLanguageProvider') return {useDisplayLanguage: () => display};
    if (name === '@/lib/locales') return {localeDirection: tag => ['ar','ur'].includes(tag) ? 'rtl' : 'ltr'};
    if (name === '@/config/testnet-entry-copy.json') return {default:copy};
    throw new Error(name);
  }});
  return {window,parent,sent,display, render:() => module.exports.TestnetEntry(), message:event => receive?.(event), cleanup:()=>cleanup?.()};
}
test('all eleven test entry translations expose a fixed public guide and honest account scope', () => {
  assert.equal(Object.keys(copy).length,11);
  const f=fixture(false);
  for (const tag of Object.keys(copy)) {
    f.display.locale=tag;
    const html=renderToStaticMarkup(f.render());
    assert.ok(html.includes(`lang="${tag}"`));
    assert.match(html,/href="https:\/\/calorietoken.net\/index.php\/calorieapp\/#ctstyle-testnet"/);
    assert.doesNotMatch(html, /iframe|secret|seed|xl-trustline/);
    assert.deepEqual(Object.keys(copy[tag]).sort(),Object.keys(copy.en).sort());
  }
  assert.equal(f.sent.length,0);
});
test('only a verified parent capability replaces navigation; messages carry no account or login data', () => {
  const f=fixture();
  const link=tree => tree.props.children.find(child => child?.type === 'a');
  let prevented=false;
  const click=()=>({preventDefault:()=>{prevented=true;}});
  let tree=f.render();
  link(tree).props.onClick(click()); assert.equal(prevented,false);
  const data={type:'calorieapp:testnet-guide:available',version:1};
  for(const event of [
    {data,origin:'https://evil.example',source:f.parent},
    {data,origin:'https://calorietoken.net',source:{}},
    {data:{...data,account:'forged'},origin:'https://calorietoken.net',source:f.parent},
  ]) {f.message(event);tree=f.render();link(tree).props.onClick(click());assert.equal(prevented,false);}
  f.message({data,origin:'https://calorietoken.net',source:f.parent});
  tree=f.render();link(tree).props.onClick(click());assert.equal(prevented,true);
  assert.equal(JSON.stringify(f.sent.at(-1)),JSON.stringify({data:{type:'calorieapp:testnet-guide:open',version:1},origin:'https://calorietoken.net'}));
  f.cleanup();
});
