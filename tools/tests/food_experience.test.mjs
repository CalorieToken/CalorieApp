import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const ts=require('typescript'), React=require('react'), {renderToStaticMarkup}=require('react-dom/server');
const json=path=>({default:JSON.parse(readFileSync(new URL(`../../frontend/${path}`,import.meta.url)))});
const modules={
  '@/config/locales.json':json('config/locales.json'),
  '@/config/food-ui-copy.json':json('config/food-ui-copy.json'),
  '@/config/food-experience-copy.json':json('config/food-experience-copy.json'),
  '@/config/food-source-copy.json':json('config/food-source-copy.json'),
};
function load(path) {
  const source=readFileSync(new URL(`../../frontend/${path}`,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,URL,require(name){
    if(name.startsWith('react'))return require(name);
    if(Object.hasOwn(modules,name))return modules[name];
    throw new Error(`Unmapped dependency: ${name}`);
  }});
  return module.exports;
}
modules['@/lib/locales']=load('lib/locales.ts');
modules['@/lib/foodUi']=load('lib/foodUi.ts');
modules['@/lib/foodSource']=load('lib/foodSource.ts');
const sourceApi=modules['@/lib/foodSource'];
const experience=modules['@/lib/foodExperience']=load('lib/foodExperience.ts');
const {RecordedGradeSummary}=load('components/RecordedGradeSummary.tsx');
const copy=modules['@/config/food-experience-copy.json'].default;
const sourceCopy=modules['@/config/food-source-copy.json'].default;
const summary={grades:[{grade:'A',count:2},{grade:'B',count:1},{grade:'C',count:0},{grade:'D',count:0},{grade:'E',count:1}],known:4,total:7,missing:3};
const sources={open_food_facts:7,usda:2,other:1};
const plain=value=>JSON.parse(JSON.stringify(value));
const escaped=text=>renderToStaticMarkup(React.createElement('span',null,text)).slice(6,-7);

test('coverage accepts only consistent safe integer counts with exactly one entry per grade',()=>{
  assert.deepEqual(plain(experience.gradeCoverage(summary)),summary);
  for(const bad of [
    {...summary,total:3},{...summary,known:5},{...summary,missing:-1},{...summary,total:NaN},
    {...summary,total:Infinity},{...summary,total:7.5},{...summary,known:Number.MAX_SAFE_INTEGER+1},
    {...summary,grades:summary.grades.slice(1)},
    {...summary,grades:summary.grades.map((e,i)=>i===0?{grade:'B',count:2}:e)},
    {...summary,grades:summary.grades.map((e,i)=>i===0?{grade:'A',count:-2}:e)},
  ]) assert.equal(experience.gradeCoverage(bad),null);
});

test('product grades normalize only valid A to E and leave unknown or malformed values unscored',()=>{
  for(const grade of ['A','B','C','D','E'])assert.equal(experience.productGrade(` ${grade.toLowerCase()} `),grade);
  for(const grade of [undefined,null,'','unknown','F','A/B','<script>'])assert.equal(experience.productGrade(grade),null);
});

test('food source and alternative-image rules are conservative and privacy-safe',()=>{
  assert.equal(sourceApi.foodSource({barcode:'0012345678905',brand:'Brand'}),'open_food_facts');
  assert.equal(sourceApi.foodSource({barcode:null,brand:'USDA FoodData Central · FDC 168878'}),'usda');
  assert.equal(sourceApi.foodSource({barcode:null,brand:'USDA-like'}),'other');
  assert.equal(sourceApi.safeFoodImageUrl('https://images.openfoodfacts.org/images/products/001/234/front.jpg'),'https://images.openfoodfacts.org/images/products/001/234/front.jpg');
  for(const value of [null,'','http://images.openfoodfacts.org/images/products/x.jpg','https://evil.example/pixel.gif','javascript:alert(1)'])
    assert.equal(sourceApi.safeFoodImageUrl(value),null);
  assert.deepEqual(plain(sourceApi.validFoodSourceCounts({open_food_facts:5,usda:1,other:1},7)),{open_food_facts:5,usda:1,other:1});
  for(const value of [{open_food_facts:5,usda:1,other:2},{open_food_facts:5,usda:-1,other:1},{open_food_facts:5.5,usda:1,other:1},null])
    assert.equal(sourceApi.validFoodSourceCounts(value,7),null);
  assert.equal(sourceApi.foodFallbackImage('open_food_facts'),'/images/food-placeholder-off.svg');
  assert.equal(sourceApi.foodFallbackImage('usda'),'/images/food-placeholder-usda.svg');
  assert.equal(sourceApi.foodFallbackImage('other'),'/images/food-placeholder-other.svg');
});

test('all eleven actual React summaries render real counts, missing coverage, language and no average marker',()=>{
  for(const [locale,c] of Object.entries(copy)){
    assert.deepEqual(Object.keys(c).sort(),Object.keys(copy.en).sort());
    assert.deepEqual(Object.keys(sourceCopy[locale]).sort(),Object.keys(sourceCopy.en).sort());
    for(const value of Object.values(c))assert.ok(typeof value==='string'&&value.trim());
    for(const value of Object.values(sourceCopy[locale]))assert.ok(typeof value==='string'&&value.trim());
    const html=renderToStaticMarkup(React.createElement(RecordedGradeSummary,{summary,sources,locale}));
    assert.ok(html.includes(`lang="${locale}"`));
    assert.ok(html.includes(`dir="${['ar','ur'].includes(locale)?'rtl':'ltr'}"`));
    assert.ok(html.includes(escaped(sourceCopy[locale].sourcesTitle)));
    assert.ok(html.includes(escaped(sourceCopy[locale].gradeHeading)));
    assert.ok(html.includes(escaped(sourceCopy[locale].gradeScope)));
    assert.equal((html.match(/background-color:/g)||[]).length,5);
    assert.equal((html.match(/<dt /g)||[]).length,8);
    assert.ok(html.includes(escaped(c.coverage.replace('{known}',new Intl.NumberFormat(locale).format(4)).replace('{total}',new Intl.NumberFormat(locale).format(7)))));
    assert.doesNotMatch(html,/data-grade-pointer|role="img"/);
    const emptySources={open_food_facts:3,usda:0,other:0};
    const empty=renderToStaticMarkup(React.createElement(RecordedGradeSummary,{summary:{grades:summary.grades.map(e=>({...e,count:0})),total:3,known:0,missing:3},sources:emptySources,locale}));
    assert.ok(empty.includes(escaped(c.noGrades)));assert.doesNotMatch(empty,/background-color:/);
    const invalid=renderToStaticMarkup(React.createElement(RecordedGradeSummary,{summary:{...summary,known:99},sources,locale}));
    assert.ok(invalid.includes(escaped(c.coverageUnavailable)));assert.doesNotMatch(invalid,/background-color:/);
  }
});

test('grade count labels remain grammatical for a single selected entry',()=>{
  const one={grades:summary.grades.map((entry,index)=>({...entry,count:index===0?1:0})),known:1,total:1,missing:0};
  for(const [locale,c] of Object.entries(copy)){
    const html=renderToStaticMarkup(React.createElement(RecordedGradeSummary,{summary:one,sources:{open_food_facts:1,usda:0,other:0},locale}));
    const expected=c.coverage.replace('{known}',new Intl.NumberFormat(locale).format(1)).replace('{total}',new Intl.NumberFormat(locale).format(1));
    assert.ok(html.includes(escaped(expected)));
  }
  assert.doesNotMatch(copy.en.coverage,/entries/);
  assert.doesNotMatch(copy.nl.coverage,/vermeldingen/);
});

test('USDA amount labels localize generated grams without reinterpreting packaging text',()=>{
  assert.equal(experience.displayUsdaGramAmount('1000 g edible \u00b7 SR Legacy','nl'),'1.000 g');
  assert.equal(experience.displayUsdaGramAmount('75 g edible \u00b7 SR Legacy','en'),'75 g');
  for(const value of ['100 ml','2 tbsp','0 g edible \u00b7 source','10000 g edible \u00b7 source','75 g'])assert.equal(experience.displayUsdaGramAmount(value,'nl'),value);
  assert.equal(experience.displayUsdaGramAmount(null,'en'),'');
});

test('logged USDA amounts show actual grams and preserve historical percentage scaling',()=>{
  const item={brand:'USDA FoodData Central \u00b7 FDC 168878',serving_size:'75 g edible \u00b7 2018-04',portion_percentage:100};
  assert.equal(experience.loggedUsdaGramAmount(item,'nl'),'75 g');
  assert.equal(experience.loggedUsdaGramAmount({...item,portion_percentage:50},'nl'),'37,5 g');
  assert.equal(experience.loggedUsdaGramAmount({...item,portion_percentage:25},'en'),'18.75 g');
  assert.equal(experience.loggedUsdaGramAmount({...item,portion_percentage:undefined},'en'),'75 g');
  for(const pct of [0,-1,101,Infinity,NaN])assert.equal(experience.loggedUsdaGramAmount({...item,portion_percentage:pct},'nl'),null);
  for(const patch of [{brand:'Another brand'},{serving_size:'75 g'},{serving_size:'0 g edible \u00b7 source'},{serving_size:'5001 g edible \u00b7 source'}])assert.equal(experience.loggedUsdaGramAmount({...item,...patch},'nl'),null);
  for(const locale of Object.keys(copy))assert.equal(experience.loggedUsdaGramAmount({...item,portion_percentage:50},locale),new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(37.5)+' g');
});
