import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const ts=require('typescript');
const source=readFileSync(new URL('../../frontend/lib/testnetAccount.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
// Deliberately nonfunctional fixtures: format-shaped, not valid wallet credentials.
const address='r'+'1'.repeat(25),seed='s'+'1'.repeat(24);
const response=(value={account:{address},seed},status=200,headers={})=>({ok:status===200,status,headers:{get:name=>headers[name]??(name==='content-type'?'application/json':null)},json:async()=>value});
function harness(fetch=async()=>response()){
 const stored=new Map(),calls=[],sockets=[],timers=new Map();let now=1_800_000_000_000,id=0;
 class Clock extends Date{static now(){return now;}}
 class Socket{constructor(url){this.url=url;sockets.push(this);}send(text){this.sent=JSON.parse(text);}close(){this.closed=true;}}
 const window={AbortController,WebSocket:Socket,fetch:async(url,options)=>{calls.push({url,options});return fetch(url,options);},sessionStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)};
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,window,AbortController,Date:Clock,SyntaxError});
 return {api:module.exports,window,stored,calls,sockets,timers,advance:ms=>{now+=ms;}};
}

test('native faucet accepts current and legacy shapes but rejects conflicting or malformed recovery material',()=>{
 const {api}=harness();
 for(const data of [{account:{address},seed},{account:{classicAddress:address,secret:seed}}]){
  const account=api.parseTestnetAccount(data);assert.equal(account.address,address);assert.equal(account.secret,seed);
 }
 for(const data of [null,{}, {account:{address},seed:''}, {account:{address,secret:seed},seed:'invalid'}, {account:{address,secret:'s'+'2'.repeat(24)},seed}, {account:{address:'bad'},seed}]){
  assert.throws(()=>api.parseTestnetAccount(data),e=>e.code==='invalidResponse');
 }
});

test('native creation posts no account material, persists only deadlines and throttles repeated requests',async()=>{
 const h=harness(),controller=new AbortController();
 const account=await h.api.createTestnetAccount(controller.signal);
 assert.equal(account.secret,seed);assert.equal(h.calls.length,1);
 const {url,options}=h.calls[0];assert.equal(url,h.api.TESTNET_FAUCET);
 for(const [key,value]of Object.entries({method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'}))assert.equal(options[key],value);
 assert.equal(options.body,undefined);assert.equal(options.headers,undefined);
 assert.equal(h.api.testnetWait('create'),60);
 await assert.rejects(h.api.createTestnetAccount(controller.signal),e=>e.code==='limited');
 assert.equal(h.calls.length,1);assert.equal(h.timers.size,0);
 for(const value of h.stored.values()){assert.equal(value.includes(seed),false);assert.equal(value.includes(address),false);assert.deepEqual(Object.keys(JSON.parse(value)).sort(),['check','create']);}
});

test('provider retry-after survives reload and malformed responses never become accounts',async()=>{
 const h=harness(async()=>response(null,429,{'retry-after':'180'}));
 await assert.rejects(h.api.createTestnetAccount(new AbortController().signal),e=>e.code==='limited');
 assert.equal(h.api.testnetWait('create'),180);h.advance(60000);assert.equal(h.api.testnetWait('create'),120);
 for(const reply of [response({},200),response({},200,{'content-type':'text/html'}),response({},503)]){
  const fixture=harness(async()=>reply);
  await assert.rejects(fixture.api.createTestnetAccount(new AbortController().signal),e=>['invalidResponse','failed'].includes(e.code));
 }
});

test('aborted and timed-out faucet responses cannot return recovery material',async()=>{
 let finish;const h=harness(()=>new Promise(resolve=>{finish=resolve;})),controller=new AbortController();
 const pending=h.api.createTestnetAccount(controller.signal);controller.abort();finish(response());
 await assert.rejects(pending);assert.equal(h.timers.size,0);
 let late;const timed=harness(()=>new Promise(resolve=>{late=resolve;}));
 const request=timed.api.createTestnetAccount(new AbortController().signal);
 [...timed.timers.values()][0]();late(response());
 await assert.rejects(request,e=>e.code==='timedOut');
});

test('Testnet verification sends only a public address and requires a validated matching funded account',async()=>{
 for(const valid of [true,false]){
  const h=harness(),controller=new AbortController();
  const pending=h.api.checkTestnetAccount(address,controller.signal),socket=h.sockets[0];socket.onopen();
  assert.equal(socket.url,h.api.TESTNET_LEDGER);assert.deepEqual(Object.keys(socket.sent).sort(),['account','command','id','ledger_index','strict']);
  assert.equal(socket.sent.account,address);assert.equal(JSON.stringify(socket.sent).includes(seed),false);
  socket.onmessage({data:JSON.stringify({id:1,status:'success',result:{validated:valid,account_data:{Account:address,Balance:'100000000'}}})});
  assert.equal(await pending,valid);assert.equal(socket.closed,true);assert.equal(h.timers.size,0);
 }
});

test('ledger cancellation closes the socket and provider pressure retains a delay',async()=>{
 const h=harness(),controller=new AbortController();
 const pending=h.api.checkTestnetAccount(address,controller.signal);controller.abort();assert.equal(await pending,false);assert.equal(h.sockets[0].closed,true);
 h.advance(15000);const next=h.api.checkTestnetAccount(address,new AbortController().signal);h.sockets[1].onclose({code:1008});
 assert.equal(await next,false);assert.equal(h.api.testnetWait('check'),60);
});
