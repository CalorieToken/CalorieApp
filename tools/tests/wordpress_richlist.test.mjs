import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {Node,shape,locales} from '../fixtures/step3/faq-language-model.mjs';
const base=new URL('../../wordpress-plugins/calorieapp-identity-bridge/',import.meta.url);
const source=readFileSync(new URL('assets/calorieapp-site-layout.js',base),'utf8');
const catalogue=JSON.parse(readFileSync(new URL('config/richlist.json',base)));

// Synthetic provider rows with queued mutation delivery; not visual/native auth acceptance.
function harness({late=false,marked=true,reduced=false,page=3243,path='/index.php/richlist/',search='',configure,protect}={}){
 const observers=[],events=new Map(),scrolls=[],focuses=[],timers=new Map();let timerSequence=0;
 function emit(record){for(const observer of observers){
  if(!observer.target?.contains(record.target))continue;const options=observer.options;
  if(record.type==='attributes'&&(!options.attributes||!options.attributeFilter.includes(record.attributeName)))continue;
  if(record.type==='characterData'&&!options.characterData)continue;observer.records.push(record);
 }}
 class Element extends Node{
  get data(){return this._data;}set data(value){const old=this._data;this._data=value;if(old!==undefined&&old!==value)emit({type:'characterData',target:this});}
  setAttribute(name,value){const old=this.getAttribute(name);super.setAttribute(name,value);if(old!==String(value))emit({type:'attributes',target:this,attributeName:name});}
  removeAttribute(name){const old=this.getAttribute(name);super.removeAttribute(name);if(old!==null)emit({type:'attributes',target:this,attributeName:name});}
  appendChild(node){super.appendChild(node);emit({type:'childList',target:this,addedNodes:[node],removedNodes:[]});return node;}
  insertBefore(node,reference){node.remove();const index=this.childNodes.indexOf(reference);assert.ok(index>=0);this.childNodes.splice(index,0,node);node.parentNode=this;emit({type:'childList',target:this,addedNodes:[node],removedNodes:[]});}
  remove(){const parent=this.parentNode;super.remove();if(parent)emit({type:'childList',target:parent,addedNodes:[],removedNodes:[this]});}
  contains(node){return node===this||this.childNodes.some(child=>child.contains(node));}
  matches(selector){return selector.split(',').some(part=>{const tagged=part.trim().match(/^([a-z]+)\.([\w-]+)$/);return tagged?this.tagName.toLowerCase()===tagged[1]&&this.classList.contains(tagged[2]):super.matches(part);});}
  addEventListener(name,callback){this.events||=new Map();this.events.set(name,callback);}
  click(){this.events?.get('click')?.();}focus(options){focuses.push({node:this,options});}scrollIntoView(options){scrolls.push({node:this,options});}
 }
 for(const [property,attribute]of Object.entries({id:'id',className:'class',lang:'lang',dir:'dir',tabIndex:'tabindex',type:'type'}))Object.defineProperty(Element.prototype,property,{get(){const value=this.getAttribute(attribute);return property==='tabIndex'?Number(value):value;},set(value){this.setAttribute(attribute,value);}});
 Object.defineProperty(Element.prototype,'hidden',{get(){return this.getAttribute('hidden')!==null;},set(value){if(value)this.setAttribute('hidden','');else this.removeAttribute('hidden');}});
 const make=(tag,attributes={},text)=>{const node=new Element(tag,attributes);if(text!==undefined)node.appendChild(new Element('#text',{},text));return node;};
 const document={nodeType:9,readyState:'complete'},html=make('html',{lang:'en',dir:'ltr'});html.parentNode=document;
 const body=html.appendChild(make('body',{class:'brz page-id-'+page}));document.body=body;
 const slot=body.appendChild(make('div',{class:'brz-wp-shortcode'})),table=make('table',{class:'xl-richlist'});
 const header=table.appendChild(make('tr'));header.appendChild(make('th',{},'Rank'));header.appendChild(make('th',{},'Address'));
 const row=table.appendChild(make('tr',{class:marked?'xl-is-user':''})),rank=row.appendChild(make('td',{},'42'));
 const address=row.appendChild(make('td'));address.appendChild(make('a',{href:'https://example.invalid/account'},'synthetic-public-address'));row.appendChild(make('td',{},'123.45'));
 if(!late)slot.appendChild(table);
 const controls=body.appendChild(make('aside'));controls.appendChild(make('button',{type:'button','data-session-locale':'en'},'Original sign-out'));controls.appendChild(make('input',{name:'amount',value:'1.25'}));controls.appendChild(make('div',{'data-consent':'denied'},'Native choices'));
 const originalControls=shape(controls),originalHeader=shape(header),originalAddress=shape(address);
 document.querySelectorAll=selector=>selector.startsWith('.brz ')?[]:html.querySelectorAll(selector);document.querySelector=selector=>document.querySelectorAll(selector)[0]||null;
 document.getElementById=id=>document.querySelector('[id="'+id+'"]');document.createElement=tag=>{assert.ok(!['script','iframe'].includes(tag));return make(tag);};document.createTextNode=text=>new Element('#text',{},text);
 const config={locales,richlist:structuredClone(catalogue)};configure?.(config);
 const window={location:{origin:'https://calorietoken.net',pathname:path,search},calorieappDisplayLanguageConfig:config,matchMedia:()=>({matches:reduced}),MutationObserver:true,
  addEventListener(type,callback){if(!events.has(type))events.set(type,[]);events.get(type).push(callback);},
  removeEventListener(type,callback){events.set(type,(events.get(type)||[]).filter(fn=>fn!==callback));},
  setTimeout(callback,delay){assert.equal(delay,10000,'Only the bounded card-discovery timeout is permitted');const id=++timerSequence;timers.set(id,callback);return id;},
  clearTimeout(id){timers.delete(id);},setInterval(){throw Error('No polling');},fetch(){throw Error('No provider request');}};
 protect?.({slot,table,row,make,body});
 const context=vm.createContext({window,document,MutationObserver:class{
  constructor(callback){this.callback=callback;this.records=[];observers.push(this);}observe(target,options){this.target=target;this.options=options;}disconnect(){this.target=null;this.records=[];}
 }});
 function flush(){for(let i=0;i<30;i++){const pending=observers.filter(o=>o.records.length);if(!pending.length)return;for(const o of pending)o.callback(o.records.splice(0));}throw Error('Observer loop');}
 const run=()=>{vm.runInContext(source,context);flush();};run();
 return{window,document,html,body,slot,table,row,rank,make,scrolls,focuses,flush,run,
  event(type){for(const fn of events.get(type)||[])fn({persisted:true});flush();},button(){return document.querySelector('[data-calorieapp-own-rank]');},
  unchanged(){assert.deepEqual(shape(controls),originalControls);assert.deepEqual(shape(header),originalHeader);assert.deepEqual(shape(address),originalAddress);assert.equal(html.lang,'en');assert.equal(html.dir,'ltr');}};
}
test('late tables/markers get one preserved scroll wrapper and jump without an observer loop',()=>{
 const h=harness({late:true,marked:false});assert.equal(h.button(),null);
 h.slot.appendChild(h.table);h.flush();assert.equal(h.button().hidden,true);
 h.row.setAttribute('class','xl-is-user');h.flush();assert.equal(h.button().textContent,'My position 42');assert.equal(h.button().hidden,false);
 h.event('load');h.event('pageshow');h.run();assert.equal(h.document.querySelectorAll('.calorieapp-richlist-scroll').length,1);assert.equal(h.document.querySelectorAll('[data-calorieapp-own-rank]').length,1);
 assert.equal(h.table.parentNode.tabIndex,0);assert.equal(h.table.parentNode.getAttribute('role'),'region');assert.ok(h.document.getElementById(h.table.parentNode.getAttribute('aria-labelledby')));
 h.body.appendChild(h.make('p',{},'Unrelated'));h.flush();h.unchanged();
});
test('activation resolves the current row before queued mutations and respects reduced motion',()=>{
 for(const reduced of [false,true]){const h=harness({reduced}),button=h.button();h.row.remove();const replacement=h.table.appendChild(h.make('tr',{class:'xl-is-user'}));replacement.appendChild(h.make('td',{},'73'));button.click();
 assert.equal(button.textContent,'My position 73');assert.equal(h.focuses.at(-1).node,replacement);assert.equal(h.focuses.at(-1).options.preventScroll,true);assert.equal(h.scrolls.at(-1).node,replacement);assert.equal(h.scrolls.at(-1).options.behavior,reduced?'auto':'smooth');assert.equal(h.row.getAttribute('aria-current'),null);assert.equal(h.row.getAttribute('tabindex'),null);h.flush();h.unchanged();}
});
test('removed/hidden/ambiguous markers and removed tables leave no stale active target',()=>{
 for(const change of [h=>h.row.setAttribute('class',''),h=>h.row.hidden=true,h=>{const r=h.table.appendChild(h.make('tr',{class:'xl-is-user'}));r.appendChild(h.make('td',{},'99'));},h=>h.table.remove()]){
 const h=harness(),old=h.button();change(h);old.click();h.flush();assert.equal(h.scrolls.length,0);assert.equal(h.focuses.length,0);assert.ok(!h.button()||h.button().hidden);assert.equal(h.row.getAttribute('aria-current'),null);assert.equal(h.row.getAttribute('tabindex'),null);h.unchanged();}
});
test('replacement and back/forward rebind once and preserve provider-owned attributes',()=>{
 const h=harness({protect:({row})=>{row.setAttribute('tabindex','0');row.setAttribute('aria-current','step');}});assert.equal(h.row.getAttribute('tabindex'),'0');h.row.setAttribute('class','');h.flush();assert.equal(h.row.getAttribute('aria-current'),'step');h.event('pagehide');
 const replacement=h.make('table',{class:'xl-richlist'}),row=replacement.appendChild(h.make('tr',{class:'xl-is-user'}));row.appendChild(h.make('td',{},'8'));h.table.parentNode.appendChild(replacement);h.table.remove();h.event('pageshow');
 assert.equal(h.button().textContent,'My position 8');assert.equal(h.document.querySelectorAll('[data-calorieapp-own-rank]').length,1);row.setAttribute('class','');h.flush();assert.equal(h.button().hidden,true);h.unchanged();
});
test('eleven helper languages and updated ranks preserve source data, controls and direction',()=>{
 assert.equal(catalogue.release_approved,false);assert.deepEqual(Object.keys(catalogue.translations),locales.map(l=>l.tag));const h=harness();
 for(const locale of locales){h.window.CalorieAppRichlist.setLocale(locale.tag);h.flush();assert.equal(h.button().parentNode.lang,locale.tag);assert.equal(h.button().parentNode.dir,locale.direction);assert.equal(h.button().textContent,catalogue.translations[locale.tag].action+' 42');assert.equal(h.document.getElementById(h.table.parentNode.getAttribute('aria-labelledby')).textContent,catalogue.translations[locale.tag].region);assert.equal(h.button().querySelector('bdi').textContent,'42');h.unchanged();}
 h.rank.childNodes[0].data='64';h.flush();assert.equal(h.button().textContent,'Mijn positie 64');h.rank.childNodes[0].data='synthetic-address';h.flush();assert.equal(h.button().textContent,'Mijn positie');h.unchanged();
});
test('incomplete/unknown copy falls back as a whole; markup-looking text is literal',()=>{
 const h=harness({configure:c=>{delete c.richlist.translations.nl.jump;c.richlist.translations.fr.action='<img src=x>';}});
 h.window.CalorieAppRichlist.setLocale('nl');h.flush();assert.equal(h.button().textContent,'My position 42');assert.equal(h.button().parentNode.lang,'en');h.window.CalorieAppRichlist.setLocale('fr');h.flush();assert.equal(h.button().textContent,'<img src=x> 42');assert.equal(h.button().querySelector('img'),null);
 h.window.CalorieAppRichlist.setLocale('unsupported');assert.equal(h.button().parentNode.lang,'en');h.unchanged();const absent=harness({configure:c=>delete c.richlist});absent.window.CalorieAppRichlist.setLocale('ur');assert.equal(absent.button().parentNode.lang,'en');
});
test('other pages/editor previews and protected or hidden ancestors are untouched',()=>{
 const protectedCases=['form','contenteditable','xl-card','data-calorieapp-embed','hidden','inert','aria-hidden'].map(kind=>({protect:({slot,table,make})=>{const attrs=kind==='form'?{}:kind==='xl-card'?{class:kind}:{[kind]:kind==='aria-hidden'?'true':''};slot.appendChild(make(kind==='form'?'form':'div',attrs)).appendChild(table);}}));
 for(const options of [{page:1207},{path:'/index.php/blog/'},{search:'?preview=true'},{search:'?brizy-edit'},{protect:({body})=>body.setAttribute('class','brz brz-ed page-id-3243')},...protectedCases]){const h=harness(options);assert.equal(h.button(),null);assert.equal(h.row.getAttribute('aria-current'),null);h.unchanged();}
});
