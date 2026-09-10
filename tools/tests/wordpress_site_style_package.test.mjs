import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
const plugin=new URL('../../wordpress-plugins/calorietoken-site-style/',import.meta.url);
test('Every shipped Site Style JavaScript file compiles',()=>{
 const files=readdirSync(new URL('assets/',plugin)).filter(name=>name.endsWith('.js'));
 assert.ok(files.length>=10);
 for(const name of files)assert.doesNotThrow(()=>new vm.Script(readFileSync(new URL('assets/'+name,plugin),'utf8'),{filename:name}));
});
test('Website and app use the exact same display-language protocol implementation',()=>{
 assert.equal(readFileSync(new URL('assets/display-language-runtime.js',plugin),'utf8'),readFileSync(new URL('../../frontend/lib/displayLanguageRuntime.js',import.meta.url),'utf8'));
});
test('Every language ships the same declared display-copy keys with nonempty text',()=>{
 for(const file of ['discovery-data.json','testnet-data.json','help-data.json']){
  const copy=JSON.parse(readFileSync(new URL('assets/'+file,plugin),'utf8'));assert.equal(Object.keys(copy).length,11);const keys=Object.keys(copy.en).sort();
  for(const row of Object.values(copy)){assert.deepEqual(Object.keys(row).sort(),keys);const leaves=value=>typeof value==='string'?[value]:Object.values(value).flatMap(leaves);assert.ok(leaves(row).every(text=>text.trim()));}
 }
 const menu=JSON.parse(readFileSync(new URL('assets/menu-data.json',plugin),'utf8'));assert.equal(Object.keys(menu.sharedLabels).length,11);
});
test('Public content catalogue declares exact sources, page scope and truthful locale coverage',()=>{
 const data=JSON.parse(readFileSync(new URL('assets/content-data.json',plugin),'utf8'));
 assert.equal(data.schema,1);assert.equal(new Set(data.entries.map(e=>e.source)).size,data.entries.length);
 const locales=['nl','zh-Hans','hi','es','ar','fr','bn','pt','id','ur'];
 for(const row of data.entries){
  assert.ok(row.source.trim());assert.ok(row.translations.nl?.trim());assert.ok(row.pages.length);
  assert.ok(row.pages.every(p=>p==='*'||Number.isSafeInteger(p)&&p>0));
  for(const [tag,value]of Object.entries(row.translations)){assert.ok(locales.includes(tag));assert.ok(value.trim());}
  if(row.pages.includes(6855)||row.source==='Add Your Donation')assert.deepEqual(Object.keys(row.translations).sort(),[...locales].sort());
 }
 assert.ok(data.entries.some(e=>e.pages.includes(7608)&&Object.keys(e.translations).length===1),'Historical Dutch content does not falsely declare all languages');
});
