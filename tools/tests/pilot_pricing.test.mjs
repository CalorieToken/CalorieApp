import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const React=require('react'), {renderToStaticMarkup}=require('react-dom/server'), ts=require('typescript');
const policy=JSON.parse(readFileSync(new URL('../../contracts/pilot/v1/pricing.json',import.meta.url),'utf8'));
function render(locale,override={}) {
 const module={exports:{}};
 const source=readFileSync(new URL('../../frontend/components/PricingNotice.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>name.includes('pricing.json')?{default:{...policy,...override}}:require(name)});
 return renderToStaticMarkup(React.createElement(module.exports.PricingNotice,{locale}));
}
test('all eleven pricing notices are compact, zero fee and do not initiate billing',()=>{
 for(const locale of ['en','nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur']){
  const markup=render(locale);
  assert.match(markup,/<details/);assert.doesNotMatch(markup,/<details[^>]*\bopen/);
  assert.match(markup,/free-launch-2026-09-22/);assert.doesNotMatch(markup,/<(?:form|iframe|script|input)/);
 }
 assert.match(render('nl'),/geen abonnement/);
 assert.match(render('en'),/no automatic paid conversion/);
});
test('notice fails closed for every contradicting paid-policy setting',()=>{
 for(const override of [{billing_enabled:true},{mode:'paid'},{subscription_price_minor:1},{platform_transaction_fee_bps:1},{platform_transaction_fee_fixed:'1'},{current_features_paywalled:true},{automatic_renewal:true}])assert.equal(render('nl',override),'');
});
