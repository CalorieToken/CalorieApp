import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const ts=require('typescript');
const source=readFileSync(new URL('../../frontend/lib/navigationBridge.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

function load(referrer='https://calorietoken.net/calorieapp/'){
  const sent=[];
  const parent={postMessage(message,origin){sent.push({message,origin});}};
  const window={parent,scrollY:100};
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,window,document:{referrer},URL});
  return {api:module.exports,sent};
}

test('an in-app task sends only its fixed target and finite iframe offset to the approved parent',()=>{
  const env=load();
  assert.equal(env.api.postNavigationTarget('calorieapp-add',{getBoundingClientRect:()=>({top:42.4})}),true);
  assert.deepEqual(JSON.parse(JSON.stringify(env.sent)),[{
    message:{type:'calorieapp:navigation:target',version:1,target:'calorieapp-add',offset:142},
    origin:'https://calorietoken.net',
  }]);
  assert.deepEqual(Object.keys(env.sent[0].message).sort(),['offset','target','type','version']);
});

test('unapproved parents, missing elements and invalid offsets receive no navigation message',()=>{
  for(const referrer of ['', 'https://example.com/calorieapp/', 'javascript:alert(1)']){
    const env=load(referrer);
    assert.equal(env.api.postNavigationTarget('calorieapp-add',{getBoundingClientRect:()=>({top:10})}),false);
    assert.equal(env.sent.length,0);
  }
  const approved=load();
  assert.equal(approved.api.postNavigationTarget('calorieapp-diary',null),false);
  assert.equal(approved.api.postNavigationTarget('calorieapp-diary',{getBoundingClientRect:()=>({top:Number.NaN})}),false);
  assert.equal(approved.sent.length,0);
});
