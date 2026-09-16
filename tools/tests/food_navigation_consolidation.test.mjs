import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const component=read('frontend/components/FoodSearchPlaceholder.tsx');
const workspace=read('frontend/components/CalorieAppWorkspace.tsx');
const usda=read('frontend/components/UsdaFoodSearch.tsx');
const copy=JSON.parse(read('frontend/config/food-experience-copy.json'));
const diary=JSON.parse(read('frontend/config/diary-copy.json'));
const auth=JSON.parse(read('frontend/config/auth-ui-copy.json'));
const expected=['en','nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur'];

test('the task tabs have complete labels for exactly the eleven supported locales',()=>{
  assert.deepEqual(Object.keys(copy).sort(),expected.toSorted());
  for(const locale of expected){
    assert.ok(copy[locale].navigation?.trim(),locale);
    assert.ok(diary[locale].scope?.trim(),locale);
    assert.ok(auth[locale].accountTools?.trim(),locale);
  }
  assert.match(workspace, /role="tablist"/);
  assert.match(workspace, /experience\.copy\.navigation/);
  assert.match(read('frontend/components/FoodDiaryPeriod.tsx'), /\{copy\.scope\}/);
});

test('account, guided setup, packaged food, basic food and diary are real exclusive tab panels',()=>{
  const combined=workspace+'\n'+component;
  for(const id of ['account','journey','packaged','basic','diary']){
    assert.equal(combined.split(`id="calorie-panel-${id}"`).length-1,1,id);
    assert.ok(combined.includes(`aria-labelledby="calorie-tab-${id}"`),id);
  }
  assert.match(workspace,/aria-selected=\{visibleTab === tab\.id\}/);
  assert.match(workspace,/tabIndex=\{visibleTab === tab\.id \? 0 : -1\}/);
  assert.match(component,/hidden=\{activeView !== "packaged"\}/);
  assert.match(component,/hidden=\{activeView !== "basic"\}/);
  assert.match(component,/hidden=\{activeView !== "diary"\}/);
  assert.doesNotMatch(component,/goToSection/);
});

test('tab keyboard behavior is complete and switching preserves mounted task state',()=>{
  for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End']) assert.ok(workspace.includes(`"${key}"`),key);
  assert.match(workspace,/requestAnimationFrame\(\(\) => tabRefs\.current\[index\]\?\.focus\(\)\)/);
  assert.match(workspace,/activeView=\{visibleTab === "account" \|\| visibleTab === "journey" \? null : visibleTab\}/);
  assert.match(component,/onOpenAccount/);
  assert.match(component,/type="button" onClick=\{onOpenAccount\}/);
  assert.match(usda,/return <section data-testid="usda-food-search"/);
  assert.match(component,/max-h-\[60dvh\].*overflow-y-auto/);
  assert.match(usda,/max-h-\[55dvh\].*overflow-y-auto/);
  assert.match(read('frontend/components/FoodLogList.tsx'),/max-h-\[60dvh\].*overflow-y-auto/);
  assert.match(component,/pendingLogIndex === index \? portionControls : null/);
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
