import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const ts = require('typescript');
const read = path => readFileSync(new URL('../../frontend/' + path, import.meta.url), 'utf8');
const meadowPack = JSON.parse(read('config/calorieverse-meadow.json'));
const pack = JSON.parse(read('config/calorieverse-food-activity.json'));
const plain = value => JSON.parse(JSON.stringify(value));
function load(path, imports) {
  const module = {exports:{}};
  vm.runInNewContext(ts.transpileModule(read(path), {compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText, {
    module, exports:module.exports, require: id => {
      assert.ok(id in imports, `unexpected dependency: ${id}`);
      return imports[id];
    },
  });
  return module.exports;
}
const meadow = load('lib/calorieVerseMeadow.ts', {'../config/calorieverse-meadow.json':meadowPack});
const game = load('lib/calorieVerseActivities.ts', {
  '../config/calorieverse-food-activity.json':pack, './calorieVerseMeadow':meadow,
});
const atStand = () => ({...meadow.initialMeadow(), position:{x:pack.object.x,y:pack.object.y}});

test('food review preserves earned garden progress, unknown modules and save extensions', () => {
  const original = {...atStand(), collected:meadowPack.objects.filter(o=>o.kind==='apple').map(o=>o.id), garden:'harvested',
    extensions:{starter:'unchanged'}, modules:{'future.module':{schema:7, earned:4}}};
  const done = game.reviewFoodSample(original,'apple');
  assert.equal(game.foodActivityStatus(done),'complete');
  assert.equal(meadow.meadowComplete(done),true);
  assert.deepEqual(plain(done.modules['future.module']),{schema:7,earned:4});
  assert.deepEqual(plain(done.extensions),{starter:'unchanged'});
  assert.equal(original.modules[pack.module_id],undefined,'input not mutated');
  assert.equal(game.foodActivityStatus(meadow.restoreMeadow(JSON.stringify(done)).state),'complete');
  assert.equal(game.reviewFoodSample(done,'apple'),done,'completion cannot be repeated');
});

test('distance, wrong answers and different world/region cannot complete an activity', () => {
  for (const state of [meadow.initialMeadow(), {...atStand(),world_id:'other'}, {...atStand(),region_id:'other'}]) {
    assert.equal(game.reviewFoodSample(state,'apple'),state);
  }
  const state=atStand();
  for(const answer of ['carrot','unknown','',null]) assert.equal(game.reviewFoodSample(state,answer),state);
  assert.equal(game.foodActivityStatus(state),'new');
});

test('future or malformed module saves remain intact instead of being reset', () => {
  for(const modules of [null, [], 'bad', {[pack.module_id]:{schema:2,completed:[]}}, {[pack.module_id]:{schema:1,completed:'bad'}}]) {
    const state={...atStand(),modules};
    assert.equal(game.foodActivityStatus(state),'unsupported');
    assert.equal(game.reviewFoodSample(state,'apple'),state);
    const restored=meadow.restoreMeadow(JSON.stringify(state));
    assert.deepEqual(plain(restored.state.modules),plain(modules));
  }
  const state={...atStand(),modules:{[pack.module_id]:{schema:1,completed:['future.sample'],extra:{keep:true}}}};
  const result=game.reviewFoodSample(state,'apple');
  assert.deepEqual(plain(result.modules[pack.module_id].completed),['future.sample',pack.sample.id]);
  assert.deepEqual(plain(result.modules[pack.module_id].extra),{keep:true});
});

test('activity pack shares existing world and F&B role IDs with no invented provider claims', () => {
  assert.equal(pack.world_id,meadowPack.world_id);
  assert.equal(pack.region_id,meadowPack.region_id);
  assert.ok(JSON.parse(read('config/calorieverse-fnb-chain.json')).roles.some(role=>role.id===pack.role_id));
  assert.equal(pack.data_class,'invented-local-fixture');
  assert.ok(!meadowPack.objects.some(object=>object.id===pack.object.id));
  assert.ok(pack.object.x>=meadowPack.bounds.left && pack.object.x<=meadowPack.bounds.right);
  assert.ok(pack.object.y>=meadowPack.bounds.top && pack.object.y<=meadowPack.bounds.bottom);
});

test('all eleven locales cover every activity phrase and answer', () => {
  const copy=JSON.parse(read('config/calorieverse-food-copy.json'));
  for(const {tag} of JSON.parse(read('config/locales.json')).locales) {
    assert.deepEqual(Object.keys(copy[tag]).sort(),Object.keys(copy.en).sort());
    for(const value of Object.values(copy[tag])) assert.ok(typeof value==='string' && value.trim());
    for(const answer of pack.sample.choices) assert.ok(copy[tag][answer]);
  }
});
