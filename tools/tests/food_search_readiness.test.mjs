import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url)),ts=require('typescript');
const compiled=ts.transpileModule(readFileSync(new URL('../../frontend/lib/foodSearchReadiness.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(){
 let now=100000,calls=[];const module={exports:{}};class Clock extends Date{static now(){return now;}}
 vm.runInNewContext(compiled,{module,exports:module.exports,Date:Clock,AbortController,require(name){assert.equal(name,'@/lib/backendRequest');return {BACKEND_WAKE_BASE_URL:'https://backend.example',waitForBackendReady(url,signal){assert.equal(url,'https://backend.example');return new Promise((resolve,reject)=>{calls.push({signal,resolve,reject});signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});}};}});
 return {api:module.exports.createFoodSearchReadiness(),calls,advance(ms){now+=ms;}};
}
test('Preparation and first search share one public probe; readiness expires',async()=>{
 const h=fixture(),warm=h.api.prepare(),search=h.api.prepare();assert.equal(h.calls.length,1);h.calls[0].resolve();await Promise.all([warm,search]);await h.api.prepare();assert.equal(h.calls.length,1);h.advance(61000);const fresh=h.api.prepare();assert.equal(h.calls.length,2);h.calls[1].resolve();await fresh;
});
test('Cancelling a search preserves page preparation and rejects the cancelled caller',async()=>{
 const h=fixture(),warm=h.api.prepare(),controller=new AbortController(),search=h.api.prepare(controller.signal);controller.abort();await assert.rejects(search);assert.equal(h.calls[0].signal.aborted,false);h.calls[0].resolve();await warm;await h.api.prepare();assert.equal(h.calls.length,1);
});
test('Failed readiness is not cached and unmount stops the outstanding probe',async()=>{
 const h=fixture(),first=h.api.prepare();h.calls[0].reject(new Error('not ready'));await assert.rejects(first);const retry=h.api.prepare();assert.equal(h.calls.length,2);h.api.dispose();await assert.rejects(retry);assert.equal(h.calls[1].signal.aborted,true);await assert.rejects(h.api.prepare());assert.equal(h.calls.length,2);
});
test('Disposal does not abort a health probe that already settled',async()=>{
 for(const success of [true,false]){
  const h=fixture(),probe=h.api.prepare();
  if(success){h.calls[0].resolve();await probe;}else{h.calls[0].reject(new Error('not ready'));await assert.rejects(probe);}
  h.api.dispose();assert.equal(h.calls[0].signal.aborted,false);
 }
});
