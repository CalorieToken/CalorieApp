import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const ts = require('typescript');
const pack = JSON.parse(readFileSync(new URL('../../frontend/config/calorieverse-meadow.json', import.meta.url)));
const source = readFileSync(new URL('../../frontend/lib/calorieVerseMeadow.ts', import.meta.url), 'utf8');
const module = {exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText, {
  module,exports:module.exports,require:()=>pack,
});
const game = module.exports;
const json = value => JSON.parse(JSON.stringify(value));

test('a visitor completes the meadow through nearby actions and returns to the same state', () => {
  let state = game.initialMeadow();
  for (const object of pack.objects.filter(item=>item.kind==='apple')) {
    state = {...state,position:{x:object.x,y:object.y}};
    state = game.interact(state,object.id);
  }
  const garden = pack.objects.find(item=>item.kind==='garden');
  state = {...state,position:{x:garden.x,y:garden.y}};
  for (let i=0;i<3;i++) state=game.interact(state,garden.id);
  assert.equal(game.meadowComplete(state),true);
  assert.equal(game.appleCount(state),3);
  assert.equal(game.interact(state,garden.id),state,'harvesting cannot be repeated');
  const restored = game.restoreMeadow(JSON.stringify(state));
  assert.equal(restored.writable,true);
  assert.deepEqual(json(restored.state),json(state));
});

test('distant actions, unknown objects and repeated collection cannot create progress', () => {
  const state = game.initialMeadow();
  assert.equal(game.interact(state,pack.objects[0].id),state);
  assert.equal(game.interact(state,'unknown'),state);
  const nearby = {...state,position:{x:pack.objects[0].x,y:pack.objects[0].y}};
  const collected = game.interact(nearby,pack.objects[0].id);
  assert.equal(game.interact(collected,pack.objects[0].id),collected);
  assert.equal(game.appleCount(collected),1);
});

test('growing content keeps old save identity, unknown extensions and retired collected IDs', () => {
  const state={...game.initialMeadow(),collected:['future.region.apple','future.region.apple'],extensions:{farm:{earned:7}}};
  const restored=game.restoreMeadow(JSON.stringify(state));
  assert.equal(restored.state.world_id,'calorie-gameverse-starter-world');
  assert.equal(restored.state.extensions.farm.earned,7);
  assert.deepEqual(json(restored.state.collected),['future.region.apple']);
  assert.equal(game.appleCount(restored.state),0);
});

test('invalid or future saves are never silently overwritten', () => {
  for (const raw of ['bad json','null',JSON.stringify({...game.initialMeadow(),schema:2}),JSON.stringify({...game.initialMeadow(),world_id:'other'})]) {
    assert.equal(game.restoreMeadow(raw).writable,false);
  }
  assert.equal(game.restoreMeadow(null).writable,true);
});

test('movement stays inside the meadow and resumes without a large clock jump', () => {
  let point=game.initialMeadow().position;
  for(let i=0;i<1000;i++) point=game.moveToward(point,{x:200,y:-200},.05);
  assert.equal(point.x,pack.bounds.right);
  assert.equal(point.y,pack.bounds.top);
  const next=game.moveToward({x:20,y:30},{x:90,y:80},500);
  assert.ok(Math.hypot(next.x-20,next.y-30)<=pack.speed*.06+.0001);
  const restored=game.restoreMeadow(JSON.stringify({...game.initialMeadow(),position:{x:1e9,y:null}}));
  assert.equal(restored.state.position.x,pack.bounds.right);
  assert.equal(restored.state.position.y,pack.start.y);
});

test('the small live module has complete copy for the shared eleven-language registry', () => {
  const copy=JSON.parse(readFileSync(new URL('../../frontend/config/calorieverse-meadow-copy.json',import.meta.url)));
  const registry=JSON.parse(readFileSync(new URL('../../frontend/config/locales.json',import.meta.url)));
  for(const locale of registry.locales) {
    assert.deepEqual(Object.keys(copy[locale.tag]).sort(),Object.keys(copy.en).sort());
    for(const value of Object.values(copy[locale.tag])) assert.ok(typeof value==='string'&&value.trim());
  }
});
