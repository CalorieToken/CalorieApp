import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const source=await readFile(new URL('../../wordpress-plugins/calorieapp-identity-bridge/assets/calorieapp-site-navigation.js',import.meta.url),'utf8');
const site='https://calorietoken.net';
const app=site+'/index.php/calorieapp/';
const logo=site+'/wp-content/plugins/calorieapp-identity-bridge/assets/calorieapp-logo.svg';
function style(){const values=new Map();return {
 setProperty(n,v,p=''){values.set(n,{v,p});this[n]=v;},
 getPropertyValue(n){return values.get(n)?.v||'';},getPropertyPriority(n){return values.get(n)?.p||'';},
 removeProperty(n){values.delete(n);delete this[n];}
};}
function harness({pathname='/index.php/faq/',embedded=false,isHome='0',appLogo=logo,missingBar=false,height=2400,viewport=800,delayed=false}={}){
 const config={dataset:{homePage:site+'/',appPage:app,appLogo,isHome}};
 const body={scrollHeight:height};
 const html={scrollHeight:height};
 const links=[];
 function link(href,{floating=true,glyph='',sharedRoot=null}={}){
  const root=sharedRoot||{parentElement:body,position:floating&&!delayed?'fixed':'relative',hidden:false,style:style()};
  const container={parentElement:root,position:'static',hidden:false,style:style()};
  const item={rawHref:href,attributes:{},
   get href(){return new URL(this.rawHref,site+pathname).href;},
   closest(){return container;},
   getAttribute(n){return n==='href'?this.rawHref:this.attributes[n]??null;},
   querySelector(s){return s==='use'&&glyph?{getAttribute(){return '/icons/'+glyph+'.svg#nc_icon';}}:null;}
  };
  const pair={item,container,root};links.push(pair);
  root.querySelectorAll=()=>links.filter(x=>x.root===root).map(x=>x.item);
  return pair;
 }
 const home=link(site+'/');const legacy=link(site+'/index.php/integrated-exchange/');const currentApp=link(app);
 const top=link('#',{glyph:'square-upload'});const bottom=link('#bottom',{glyph:'square-download'});
 const inline=link(app,{floating:false});const other=link(site+'/index.php/contact/');
 const foreign=link('https://elsewhere.example/index.php/calorieapp/');
 const fragment=link(site+'/#top');const unrelatedScroll=link(site+'/another/#top',{glyph:'square-upload'});
 const mixed=link(app);const mixedOther=link(site+'/index.php/contact/',{sharedRoot:mixed.root});
 const slots=Object.fromEntries(['home','app','bottom','top'].map(role=>[role,{hidden:true,getAttribute(){return role;}}]));
 const buttons=Object.fromEntries(['top','bottom'].map(role=>[role,{getAttribute(){return role;},addEventListener(n,fn){this[n]=fn;}}]));
 const bar={hidden:true,querySelectorAll(s){return s==='[data-calorieapp-scroll]'?Object.values(buttons):Object.values(slots);}};
 const events=new Map(),frames=[];let mutation,resize,observed;
 const document={body,documentElement:html,readyState:'complete',
  querySelector(s){if(s==='[data-calorieapp-site-integration]')return config;if(s==='[data-calorieapp-fallback-shortcuts]')return missingBar?null:bar;if(s==='[data-calorieapp-embed]')return embedded?{}:null;return null;},
  querySelectorAll(){return links.map(x=>x.item);}
 };
 const window={location:{href:site+pathname},innerHeight:viewport,
  getComputedStyle(n){return {position:n.position,display:n.style?.display||'block'};},
  requestAnimationFrame(fn){frames.push(fn);},addEventListener(n,fn){events.set(n,fn);},
  matchMedia(){return {matches:true};},scrollTo(v){this.scrolled=v;},
  MutationObserver:class{constructor(fn){mutation=fn;}disconnect(){}observe(_target,options){observed=options;}},
  ResizeObserver:class{constructor(fn){resize=fn;}observe(){}}
 };
 const flush=()=>{while(frames.length)frames.shift()();};
 const run=()=>vm.runInNewContext(source,{document,window,URL});run();
 return {home,legacy,currentApp,top,bottom,inline,other,foreign,fragment,unrelatedScroll,mixed,mixedOther,bar,slots,buttons,window,body,html,
  run,link,visible:()=>Object.keys(slots).filter(r=>!slots[r].hidden),
  event(n){events.get(n)?.();flush();},mutate(){mutation?.([]);flush();},resize(){resize?.();flush();},observed:()=>observed};
}
test('Home and CalorieApp omit their own destination in one shared stack',()=>{
 for(const pathname of ['/','/index.php/','/?campaign=test']){
  const h=harness({pathname});assert.deepEqual(h.visible(),['app','bottom','top']);
  for(const x of [h.home,h.legacy,h.currentApp,h.top,h.bottom]){assert.equal(x.container.hidden,true);assert.equal(x.root.hidden,true);}
 }
 for(const options of [{pathname:'/index.php/calorieapp/'},{pathname:'/calorieapp?locale=nl'},{pathname:'/preview/?preview=true',embedded:true}]){
  const h=harness(options);assert.deepEqual(h.visible(),['home','bottom','top']);assert.equal(h.bar.hidden,false);
 }
 assert.equal(harness({pathname:'/welcome/',isHome:'1'}).slots.home.hidden,true);
});
test('published, off-menu and private-preview routes use the same controls',()=>{
 const paths=['faq','tokenomics-update','whitepaper','trustline','richlist','blog','contact','donate','merchnfts','delivery','cafes','takeaway','restaurants','groceries','wholesalers','cart','checkout','privacy-policy','terms-conditions','cookie-policy','legal-notice','community-voting-hub/?preview=true'];
 for(const page of paths){const h=harness({pathname:'/index.php/'+page});assert.deepEqual(h.visible(),['home','app','bottom','top']);}
});
test('inline links, other floating actions and mixed wrappers are preserved',()=>{
 const h=harness();
 for(const x of [h.inline,h.other,h.foreign,h.fragment,h.unrelatedScroll,h.mixedOther]){
  assert.equal(x.container.hidden,false);assert.deepEqual(x.item.attributes,{});
 }
 assert.equal(h.mixed.container.hidden,true);assert.equal(h.mixed.root.hidden,false);
});
test('the down control follows actual page length including later iframe/image growth',()=>{
 const h=harness({height:1500});assert.equal(h.slots.bottom.hidden,true);
 h.body.scrollHeight=4000;h.resize();assert.equal(h.slots.bottom.hidden,false);
 h.body.scrollHeight=1200;h.html.scrollHeight=1200;h.resize();assert.equal(h.slots.bottom.hidden,true);
 h.window.innerHeight=500;h.event('resize');assert.equal(h.slots.bottom.hidden,false);
});
test('top and bottom scroll the current page and respect reduced motion',()=>{
 const h=harness();let prevented=0;
 h.buttons.top.click({preventDefault(){prevented++;}});assert.equal(h.window.scrolled.top,0);
 h.body.scrollHeight=4100;h.buttons.bottom.click({preventDefault(){prevented++;}});
 assert.equal(h.window.scrolled.top,4100);assert.equal(h.window.scrolled.behavior,'auto');assert.equal(prevented,2);
});
test('late controls and delayed Brizy styles are reconciled without duplicate stacks',()=>{
 const h=harness({delayed:true});assert.equal(h.legacy.container.hidden,false);
 h.legacy.root.position='fixed';h.event('load');assert.equal(h.legacy.container.hidden,true);
 const late=h.link(app);late.root.position='fixed';h.mutate();assert.equal(late.container.hidden,true);
 h.run();h.event('pageshow');assert.equal(h.bar.hidden,false);
 assert.deepEqual(Array.from(h.observed().attributeFilter),['class','style','href']);
});
test('an old control restored to ordinary content is no longer hidden',()=>{
 const h=harness();assert.equal(h.legacy.container.hidden,true);
 h.legacy.root.position='relative';h.event('resize');assert.equal(h.legacy.container.hidden,false);assert.equal(h.legacy.root.hidden,false);
});
test('missing replacement or invalid asset config never suppresses existing navigation',()=>{
 for(const options of [{missingBar:true},{appLogo:'https://elsewhere.example/logo.svg'}]){
  const h=harness(options);assert.equal(h.home.container.hidden,false);assert.equal(h.bar.hidden,true);
 }
});
