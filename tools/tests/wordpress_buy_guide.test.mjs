import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import vm from 'node:vm';
import { createFaqDom, Node, shape, fromShape, locales } from '../fixtures/step3/faq-language-model.mjs';
const base=new URL('../../wordpress-plugins/calorieapp-identity-bridge/',import.meta.url);
const source=readFileSync(new URL('assets/calorieapp-buy-guide-language.js',base),'utf8');
const polish=readFileSync(new URL('assets/calorieapp-site-polish.js',base),'utf8');
const catalogue=JSON.parse(readFileSync(new URL('config/how-to-buy.json',base)));
// The existing full-script polish tests exercise legacy replacement. Parse its
// actual generated fragments independently for the text-only adapter tests.
const array=polish.slice(polish.indexOf('    guide.innerHTML = [')).match(/guide\.innerHTML = (\[[\s\S]*?\])\.join\(""\)/)[1];
const html=JSON.parse(array).join('').replace('__TRUSTLINE__','https://calorietoken.net/index.php/trustline/');
const tree=JSON.parse(execFileSync('python3',['-c',`
from html.parser import HTMLParser
import json,sys
class Parser(HTMLParser):
 def __init__(self): super().__init__(); self.root={'tag':'article','attributes':[['class','cal-buy-guide']],'children':[]}; self.stack=[self.root]
 def handle_starttag(self,t,a):
  n={'tag':t,'attributes':[[k,v or ''] for k,v in a],'children':[]};self.stack[-1]['children'].append(n);self.stack.append(n)
 def handle_endtag(self,t):
  assert self.stack[-1]['tag']==t;self.stack.pop()
 def handle_data(self,s): self.stack[-1]['children'].append(s)
p=Parser();p.feed(sys.stdin.read());assert len(p.stack)==1;print(json.dumps(p.root))
`],{input:html,encoding:'utf8'}));
function harness({page=4205,url='https://calorietoken.net/index.php/how-to-buy-calorie/',configure,mutate}={}){
 const h=createFaqDom();h.body.setAttribute('class','brz page-id-'+page);
 const root=fromShape(tree);root.dataset={calorieappBuyGuide:'1'};h.body.appendChild(root);
 const config={publicPage:true,initialLocale:'en',locales,copy:structuredClone(catalogue.translations)};configure?.(config);
 const events=new Map(),on=(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);};
 const window={location:{href:url},calorieappSitePolish:{buyGuide:config},addEventListener:on,dispatchEvent:e=>(events.get(e.type)||[]).forEach(fn=>fn(e)),fetch(){throw Error('No requests');},localStorage:{setItem(){throw Error('No second preference');}}};
 h.document.readyState='complete';h.document.addEventListener=on;
 Object.assign(h,{root,config,window});mutate?.(h);
 h.before={root:shape(root),controls:shape(h.controls)};
 const context=vm.createContext({window,document:h.document,URL,Event});h.run=()=>vm.runInContext(source,context);h.run();
 h.field=key=>root.querySelector('[data-cal-buy-copy="'+key+'"]');h.fire=type=>window.dispatchEvent(new Event(type));return h;
}

test('all eleven guide translations retain identity, links, nodes and unrelated account/form state',()=>{
 assert.equal(catalogue.release_approved,false);assert.equal(catalogue.review_status,'prepared-unreviewed');
 assert.deepEqual(Object.keys(catalogue.translations),locales.map(x=>x.tag));
 const h=harness(),links=h.root.querySelectorAll('a'),codes=h.root.querySelectorAll('code'),beforeLinks=links.map(x=>x.getAttribute('href')),beforeCodes=codes.map(shape),title=h.field('title');
 for(const l of locales){h.window.CalorieAppBuyGuide.setLocale(l.tag);
  for(const [key,value] of Object.entries(catalogue.translations[l.tag]))assert.equal(h.field(key).textContent,value);
  assert.equal(h.root.getAttribute('lang'),l.tag);assert.equal(h.root.getAttribute('dir'),l.direction);assert.equal(h.root.getAttribute('aria-label'),catalogue.translations[l.tag].title);
  assert.equal(h.field('title'),title);assert.deepEqual(h.root.querySelectorAll('a'),links);assert.deepEqual(links.map(x=>x.getAttribute('href')),beforeLinks);assert.deepEqual(codes.map(shape),beforeCodes);assert.deepEqual(shape(h.controls),h.before.controls);
 }
 const api=h.window.CalorieAppBuyGuide;h.run();h.fire('load');h.fire('pageshow');assert.equal(h.window.CalorieAppBuyGuide,api);
});

test('unknown and incomplete locales fall back wholly; translated strings remain literal text',()=>{
 const h=harness();h.window.CalorieAppBuyGuide.setLocale('xx');assert.equal(h.root.getAttribute('lang'),'en');
 delete h.config.copy.nl.riskText;h.window.CalorieAppBuyGuide.setLocale('nl');assert.equal(h.root.getAttribute('lang'),'en');
 h.config.copy.ar.walletText='<img src=x onerror=alert(1)>';h.window.CalorieAppBuyGuide.setLocale('ar');
 assert.equal(h.field('walletText').textContent,h.config.copy.ar.walletText);assert.equal(h.root.querySelector('img'),null);
});

test('unknown routes, unpublished markers, changed CMS copy/identity/links or private controls are retained',()=>{
 const cases=[{page:1090},{url:'https://example.org/index.php/how-to-buy-calorie/'},{url:'https://calorietoken.net/index.php/how-to-buy-calorie/?preview=true'},
 {configure:c=>c.publicPage='true'}, {mutate:h=>delete h.root.dataset.calorieappBuyGuide},
 {mutate:h=>h.body.setAttribute('class','brz brz-ed page-id-4205')},{mutate:h=>h.form.appendChild(h.root)},
 {mutate:h=>h.root.appendChild(new Node('input'))},{mutate:h=>h.root.setAttribute('contenteditable','true')},
 {mutate:h=>h.root.querySelector('[data-cal-buy-copy="intro"]').childNodes[0].data='A new approved introduction'},
 {mutate:h=>h.root.querySelector('a').setAttribute('href','https://example.org')},
 {mutate:h=>h.root.querySelector('code').childNodes[0].data='Different asset'},
 {mutate:h=>h.root.querySelector('[data-cal-buy-copy="riskText"]').remove()},
 {mutate:h=>h.body.appendChild(fromShape(tree))}];
 for(const c of cases){const h=harness(c);h.window.CalorieAppBuyGuide?.setLocale('nl');assert.deepEqual(shape(h.root),h.before.root);assert.deepEqual(shape(h.controls),h.before.controls);}
});

test('late generated guide follows selected locale; changed replacement is not overwritten',()=>{
 const h=harness({mutate:h=>h.root.remove()});h.window.CalorieAppBuyGuide.setLocale('ur');h.body.appendChild(h.root);h.fire('load');assert.equal(h.root.getAttribute('lang'),'ur');
 h.field('title').childNodes[0].data='Edited after load';const before=shape(h.root);h.window.CalorieAppBuyGuide.setLocale('nl');assert.deepEqual(shape(h.root),before);
});
