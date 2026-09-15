import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const component=read('frontend/components/FoodSearchPlaceholder.tsx');
const usda=read('frontend/components/UsdaFoodSearch.tsx');
const copy=JSON.parse(read('frontend/config/food-experience-copy.json'));
const diary=JSON.parse(read('frontend/config/diary-copy.json'));
const expected=['en','nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur'];

test('consolidated quick navigation has complete labels for exactly the eleven supported locales',()=>{
  assert.deepEqual(Object.keys(copy).sort(),expected.toSorted());
  for(const locale of expected){
    assert.ok(copy[locale].navigation?.trim(),locale);
    assert.ok(diary[locale].scope?.trim(),locale);
  }
  assert.match(component, /aria-label=\{experience\.copy\.navigation\}/);
  assert.match(read('frontend/components/FoodDiaryPeriod.tsx'), /\{copy\.scope\}/);
});

test('every navigation target is unique and keyboard-focusable',()=>{
  const combined=component+'\n'+usda;
  for(const id of ['calorie-packaged-foods','calorie-basic-foods','calorie-diary']){
    assert.equal(combined.split(`id="${id}"`).length-1,1,id);
    assert.match(combined,new RegExp(`id="${id}" tabIndex=\\{-1\\}`));
  }
  assert.match(component,/type="button" onClick=\{\(\) => goToSection\(id\)\}/);
});

test('actual navigation handler opens details, focuses and scrolls without saving or fetching',()=>{
  const match=component.match(/function goToSection\(id: string\) \{([\s\S]*?)\n  \}/);
  assert.ok(match,'navigation handler');
  class Details {open=false; focus(options){this.focusOptions=options;} scrollIntoView(options){this.scrollOptions=options;}}
  const target=new Details(); let requests=0;
  const context={document:{getElementById:id=>id==='calorie-basic-foods'?target:null},HTMLDetailsElement:Details,fetch(){requests++;throw new Error('Navigation must not fetch');}};
  vm.runInNewContext(`function goToSection(id){${match[1]}\n}\ngoToSection('calorie-basic-foods');goToSection('missing');`,context);
  assert.equal(target.open,true);
  assert.equal(target.focusOptions.preventScroll,true);
  assert.equal(target.scrollOptions.block,'start');
  assert.equal(requests,0);
});

test('diary explanation refers to grade counts, not the removed average/product bar',()=>{
  const obsolete={en:'product bar',nl:'productbalk',es:'la barra',fr:'la barre',pt:'a barra',id:'bilah produk'};
  for(const [locale,phrase] of Object.entries(obsolete)) assert.ok(!diary[locale].scope.includes(phrase),locale);
});

test('live-route gram display and inline USDA test markers remain preserved',()=>{
  assert.match(read('frontend/lib/foodExperience.ts'),/function loggedUsdaGramAmount/);
  assert.match(read('frontend/components/FoodLogList.tsx'),/loggedUsdaGramAmount/);
  for(const marker of ['usda-food-search','usda-selected-food','usda-nutrition-preview']) assert.ok(usda.includes(`data-testid="${marker}"`));
});
