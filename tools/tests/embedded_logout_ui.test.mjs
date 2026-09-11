import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {authUi,authCopy} from './helpers/auth_ui.mjs';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url)),ts=require('typescript');
const source=readFileSync(new URL('../../frontend/components/XamanLoginPanel.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const nodes=(tree,p)=>Array.isArray(tree)?tree.flatMap(x=>nodes(x,p)):tree&&typeof tree==='object'?[...(p(tree)?[tree]:[]),...nodes(tree.props?.children,p)]:[];
const text=tree=>Array.isArray(tree)?tree.map(text).join(' '):tree&&typeof tree==='object'?text(tree.props?.children):tree==null||typeof tree==='boolean'?'':String(tree);
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
async function fixture({me,logout}={}){
 const hooks=[],events=new Map(),requests=[],sent=[],announcements=[];let cursor=0,effects=[],tree;
 const parent={postMessage:(data,origin)=>sent.push({data,origin})};
 const hook=init=>{const i=cursor++;if(!(i in hooks))hooks[i]=init();return i;};
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const react={useState(init){const i=hook(()=>typeof init==='function'?init():init);return [hooks[i],v=>hooks[i]=typeof v==='function'?v(hooks[i]):v];},useRef(v){return hooks[hook(()=>({current:v}))];},useMemo(fn,deps){const i=hook(()=>null);if(!equal(hooks[i]?.deps,deps))hooks[i]={deps,value:fn()};return hooks[i].value;},useCallback(fn,deps){return react.useMemo(()=>fn,deps);},useEffect(fn,deps){const i=hook(()=>null);if(!equal(hooks[i]?.deps,deps)){hooks[i]?.cleanup?.();hooks[i]={deps};effects.push(()=>hooks[i].cleanup=fn());}}};
 const window={parent,location:{search:'?embedded=1'},sessionStorage:{getItem:()=>null,removeItem(){},setItem(){}},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name)=>events.delete(name)};
 const module={exports:{}};
 vm.runInNewContext(compiled,{module,exports:module.exports,window,document:{referrer:'https://calorietoken.net/calorieapp/',documentElement:{lang:'en',scrollHeight:800},body:{scrollHeight:800}},navigator:{language:'en'},process:{env:{NODE_ENV:'production'}},AbortController,URL,URLSearchParams,Error,console,
 require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};if(name==='@/components/authEvents')return {announceAuthState:v=>announcements.push(v)};if(name==='@/lib/authUi')return authUi;if(name==='@/lib/locales')return {resolveLocale:v=>v||'en'};if(name.startsWith('@/components/'))return {};
 if(name==='@/lib/backendRequest')return {BACKEND_WAKE_BASE_URL:'/api/backend',backendUnavailableMessage:(_e,fallback)=>fallback,backendRequest:async(url,options)=>{requests.push({url,options});if(url.endsWith('/me'))return me?await me():{ok:true,json:async()=>({user_id:'synthetic-user'})};if(url.endsWith('/logout'))return logout?await logout():{ok:true,status:204};throw new Error('Unexpected request');}};
 throw new Error(name);}});
 const render=()=>{cursor=0;effects=[];tree=module.exports.XamanLoginPanel();effects.forEach(f=>f());return tree;};render();
 const flush=async()=>{await new Promise(setImmediate);render();};
 const message=async(type,{origin='https://calorietoken.net',source=parent}={})=>{await events.get('message')?.({data:{type,locale:'en'},origin,source});render();};
 await flush();await message('calorieapp:bridge:init');
 return {get tree(){return tree;},render,flush,message,requests,sent,announcements,parent,
 button(label){const found=nodes(tree,n=>n.type==='button'&&text(n).trim()===label);assert.equal(found.length,1,label);return found[0];},
 close(){hooks.forEach(h=>h?.cleanup?.());}};
}
test('an app logout completes without any response from the WordPress parent',async()=>{
 const request=deferred();const h=await fixture({logout:()=>request.promise});
 try{
  assert.ok(text(h.tree).includes(authCopy.en.signedIn));
  const pending=h.button(authCopy.en.logout).props.onClick();await h.flush();
  assert.equal(h.announcements.at(-1),false,'Hide private data as soon as logout starts');
  assert.ok(!text(h.tree).includes(authCopy.en.signedIn));
  assert.equal(h.requests.filter(r=>r.url.endsWith('/logout')).length,1);
  request.resolve({ok:true,status:204});await pending;await h.flush();
  assert.ok(!text(h.tree).includes(authCopy.en.loggingOut));
  assert.ok(text(h.tree).includes(authCopy.en.signedOutApp));
  assert.equal(h.sent.filter(m=>m.data.type==='calorieapp:logout:request').length,1);
  // Existing parents can finish their own WordPress logout without repeating the app POST.
  await h.message('calorieapp:logout');assert.equal(h.requests.filter(r=>r.url.endsWith('/logout')).length,1);
  assert.ok(h.sent.some(m=>m.data.type==='calorieapp:logout:complete'&&m.origin==='https://calorietoken.net'));
 }finally{h.close();}
});
test('simultaneous trusted logout commands share one request; untrusted sources cannot log out',async()=>{
 const request=deferred();const h=await fixture({logout:()=>request.promise});
 try{
  await h.message('calorieapp:logout',{origin:'https://untrusted.example'});await h.message('calorieapp:logout',{source:{}});
  assert.equal(h.requests.filter(r=>r.url.endsWith('/logout')).length,0);
  const first=h.message('calorieapp:logout'),second=h.message('calorieapp:logout');await h.flush();
  assert.equal(h.requests.filter(r=>r.url.endsWith('/logout')).length,1);
  request.resolve({ok:true,status:204});await Promise.all([first,second]);assert.equal(h.announcements.at(-1),false);
 }finally{h.close();}
});
test('failed cookie clearing keeps a visible retry and cannot claim successful logout',async()=>{
 let calls=0;const h=await fixture({logout:async()=>++calls===1?{ok:false,status:503}:{ok:true,status:204}});
 try{
  await h.button(authCopy.en.logout).props.onClick();await h.flush();
  assert.ok(!text(h.tree).includes(authCopy.en.signedOutApp));
  assert.equal(nodes(h.tree,n=>n.type==='a').length,0,'Do not offer sign-in while logout is unconfirmed');
  await h.button(authCopy.en.retryLogout).props.onClick();await h.flush();assert.equal(calls,2);assert.ok(text(h.tree).includes(authCopy.en.signedOutApp));
 }finally{h.close();}
});
test('a late session-restore response cannot resurrect the app after logout',async()=>{
 const me=deferred();const h=await fixture({me:()=>me.promise});
 try{
  await h.message('calorieapp:logout');
  me.resolve({ok:true,json:async()=>({user_id:'old-synthetic-user'})});await h.flush();
  assert.ok(!text(h.tree).includes(authCopy.en.signedIn));assert.ok(!h.announcements.includes(true));
 }finally{h.close();}
});
