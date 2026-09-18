import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const ts=require('typescript');
const source=readFileSync(new URL('../../frontend/lib/appEntryBridge.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({origin='https://calorietoken.net',hash='',embedded=true}={}){
 const listeners=new Map(),sent=[],opened=[];
 const parent={postMessage:(message,origin)=>sent.push({message,origin})};
 const window={parent,location:{hash},addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
 if(!embedded)window.parent=window;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,window,require:()=>({trustedWordPressParentOrigin:()=>embedded?origin:null})});
 const disconnect=module.exports.connectAppEntry(target=>opened.push(target));
 return {api:module.exports,window,parent,listeners,sent,opened,disconnect};
}
test('trusted host navigation accepts only fixed targets and rejects forged or extra-field messages',()=>{
 const h=harness(),send=h.listeners.get('message');
 const valid={source:h.parent,origin:'https://calorietoken.net',data:{type:'calorieapp:entry:open',version:1,target:'test-account',requestId:'entry-0'}};
 for(const event of [{...valid,source:{}},{...valid,origin:'https://evil.example'},{...valid,data:{...valid.data,extra:'rejected'}},{...valid,data:{...valid.data,target:'sign-out'}},{...valid,data:{...valid.data,version:2}},{...valid,data:{...valid.data,requestId:'invalid'}}])send(event);
 assert.deepEqual(h.opened,[]);
 send(valid);send(valid);
 assert.deepEqual(h.opened,['test-account'],'readiness retries never reopen an in-progress guide');
 for(const [index,target] of h.api.APP_ENTRY_TARGETS.entries())send({...valid,data:{...valid.data,target,requestId:'entry-'+(index+1)}});
 assert.deepEqual(h.opened.slice(1),Array.from(h.api.APP_ENTRY_TARGETS));
 assert.deepEqual(Object.keys(h.sent[0].message).sort(),['type','version']);
 assert.equal(h.sent[0].origin,'https://calorietoken.net');
 h.disconnect();assert.equal(h.listeners.size,0);
});
test('standalone URLs resolve the legacy test link and public tasks without inventing unknown routes',()=>{
 for(const [hash,want] of [['#ctstyle-testnet','test-account'],['#food-scan','food-scan'],['#account-export','account-export'],['',null],['#sign-out',null]]){
  const h=harness({hash,embedded:false});assert.deepEqual(h.opened,want?[want]:[]);assert.equal(h.sent.length,0);h.disconnect();
 }
 const untrusted=harness({origin:null});
 untrusted.listeners.get('message')({source:untrusted.parent,origin:'https://evil.example',data:{type:'calorieapp:entry:open',version:1,target:'test-account',requestId:'entry-0'}});
 assert.equal(untrusted.opened.length,0);assert.equal(untrusted.sent.length,0);
});
