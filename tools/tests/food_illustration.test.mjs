import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const ts=require('typescript');
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../frontend/lib/foodIllustration.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports});
const {foodIllustration}=module.exports;

test('food illustrations follow the product, including compound foods and the reported diary',()=>{
  const cases={Apple:'apple',appel:'apple',苹果:'apple',सेब:'apple',manzana:'apple',تفاح:'apple',pomme:'apple',আপেল:'apple','maçã':'apple',apel:'apple',سیب:'apple',
    'Whole wheat bread':'bread','Volkoren brood':'bread','Volkorenbrood':'bread','Kipfilet':'poultry','Champignons':'vegetables','Cherries':'fruit','Banana bread':'bread','Apple juice':'drink','Strawberry yoghurt':'yogurt','Milk chocolate':'chocolate','Chocolate milk':'milk',
    'Melons, casaba, raw':'melon','Marmorette dr oetker':'yogurt','Beverages, COCA-COLA, POWERADE, lemon-lime flavored, ready-to-drink':'drink',
    'Pineapple, raw':'pineapple','Pomme de terre':'potato','Chicken noodle soup':'soup','Vegetable oil':'oil','The mystery food':'meal','Unknown product 123':'meal'};
  for(const [product,icon] of Object.entries(cases)) assert.equal(foodIllustration(product),`/images/food-illustrations/${icon}.svg`,product);
});
test('fallback assets are original local vectors with no tracking or remote resources',()=>{
  const root=new URL('../../frontend/public/images/food-illustrations/',import.meta.url);
  const assets=readdirSync(root).filter(name=>name.endsWith('.svg'));
  assert.equal(assets.length,38);
  const drawings=new Set();
  for(const name of assets){const svg=readFileSync(new URL(name,root),'utf8');assert.match(svg,/viewBox="0 0 160 160"/);assert.doesNotMatch(svg,/<script|<image|href=|foreignObject/);drawings.add(svg);}
  assert.equal(drawings.size,38);
  for(const name of ['../../private','https://tracker.example/x','<script>']) assert.equal(foodIllustration(name),'/images/food-illustrations/meal.svg');
});

test('a known catalogue category gives an appropriate fallback without inventing an asset path',()=>{
  assert.equal(foodIllustration('Unfamiliar plant', 'Vegetables and Vegetable Products'),'/images/food-illustrations/vegetables.svg');
  assert.equal(foodIllustration('Apple', 'Fruits and Fruit Juices'),'/images/food-illustrations/apple.svg');
  for(const category of ['../../secret','toString','__proto__']) assert.equal(foodIllustration('Unknown',category),'/images/food-illustrations/meal.svg');
});
