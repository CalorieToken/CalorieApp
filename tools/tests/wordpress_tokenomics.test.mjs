import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createFaqDom, Node, shape, fromShape, locales } from '../fixtures/step3/faq-language-model.mjs';
const base = new URL('../../wordpress-plugins/calorieapp-identity-bridge/', import.meta.url);
const source = readFileSync(new URL('assets/calorieapp-tokenomics.js', base), 'utf8');
const catalogue = JSON.parse(readFileSync(new URL('config/tokenomics.json', base)));
const wallet = 'rEfiRssDCQd466z2bi63vi64u2rYiMrnhL';

// Observed public Brizy IDs and chart title, reduced to insertion boundaries.
// This is a DOM contract test, not browser rendering or installed WP acceptance.
function harness({page=1209, url='https://calorietoken.net/index.php/tokenomics-update/', mutate, configure}={}) {
  const h = createFaqDom(); h.body.setAttribute('class', 'brz page-id-'+page);
  const make = (tag, attrs={}, text) => {
    const n = new Node(tag, attrs);
    n.after = sibling => {
      sibling.remove(); sibling.parentNode = n.parentNode;
      n.parentNode.childNodes.splice(n.parentNode.childNodes.indexOf(n)+1,0,sibling);
    };
    if (text !== undefined) n.appendChild(new Node('#text',{},text));
    return n;
  };
  const root = make('div',{'data-brz-custom-id':'rmpolgctfmggclsdfezbyrgrptsoksmyibth'}); h.body.appendChild(root);
  const container = make('div',{class:'brz-container'}); root.appendChild(container);
  const chart = make('div',{class:'brz-wrapper'}); container.appendChild(chart);
  const image = make('div',{'data-brz-custom-id':'dqvixegjsqsgfpehzvyzdhvvjusglgsaioai'}); chart.appendChild(image);
  image.appendChild(make('img',{title:'Tokenomics update 2024 10',src:'https://calorietoken.net/wp-content/uploads/2024/10/Tokenomics-update-2024-10-1024x562.png',alt:''}));
  const row = make('div',{'data-brz-custom-id':'qzyfxcwgwvmqaychwaxfgllbvrxwptqijdnb'}); container.appendChild(row);
  row.appendChild(make('a',{href:'https://bithomp.com/explorer/rUWHYEdNVA7aMCqP5a4WLqtqPAAYd58K83'},'Original developer wallet'));
  const config={publicPage:true,initialLocale:'en',locales,copy:structuredClone(catalogue.translations)}; configure?.(config);
  const events = new Map();
  const listen=(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);};
  h.document.createElement=make;h.document.createTextNode=text=>new Node('#text',{},text);
  h.document.getElementById=id=>h.document.querySelector('[id="'+id+'"]');
  h.document.readyState='complete';h.document.addEventListener=listen;
  const window={location:{href:url},calorieappSitePolish:{tokenomics:config},addEventListener:listen,
    dispatchEvent:e=>(events.get(e.type)||[]).forEach(fn=>fn(e)),
    fetch(){throw Error('No requests');},setInterval(){throw Error('No polling');},
    localStorage:{setItem(){throw Error('No independent preference storage');}}};
  Object.assign(h,{make,root,container,chart,image,row,window,config});mutate?.(h);
  h.before={chart:shape(chart),row:shape(row),controls:shape(h.controls)};
  const context=vm.createContext({window,document:h.document,URL,Event});
  h.run=()=>vm.runInContext(source,context);h.run();
  h.fire=type=>window.dispatchEvent(new Event(type));
  h.status=()=>h.document.getElementById('calorieapp-tokenomics-status');
  h.panel=()=>h.document.getElementById('calorieapp-consolidation-wallet');
  return h;
}

test('wallet and completion context are additive, read-only and idempotent',()=>{
 const h=harness();const api=h.window.CalorieAppTokenomics;
 assert.equal(h.container.childNodes.indexOf(h.status()),h.container.childNodes.indexOf(h.chart)+1);
 assert.equal(h.container.childNodes.indexOf(h.panel()),h.container.childNodes.indexOf(h.row)+1);
 const link=h.panel().querySelector('a');assert.equal(link.getAttribute('href'),'https://xpmarket.com/wallet/'+wallet);
 assert.equal(link.getAttribute('target'),'_blank');assert.equal(link.getAttribute('rel'),'noopener noreferrer');
 assert.equal(h.panel().querySelector('code').textContent,wallet);assert.equal(h.panel().querySelector('code').getAttribute('dir'),'ltr');
 assert.match(h.status().textContent,/All airdrops are completed/);assert.match(h.panel().textContent,/2026-09-09/);
 h.fire('load');h.fire('pageshow');h.run();assert.equal(h.window.CalorieAppTokenomics,api);
 assert.equal(h.container.querySelectorAll('.calorieapp-tokenomics-note').length,2);
 assert.deepEqual(shape(h.chart),h.before.chart);assert.deepEqual(shape(h.row),h.before.row);assert.deepEqual(shape(h.controls),h.before.controls);
 assert.equal(h.panel().querySelector('button,input,form,iframe'),null);
});

test('all eleven prepared locales affect owned notes only and preserve address and destination',()=>{
 assert.equal(catalogue.release_approved,false);assert.equal(catalogue.review_status,'prepared-unreviewed');
 assert.deepEqual(Object.keys(catalogue.translations),locales.map(x=>x.tag));
 const h=harness();for(const l of locales){h.window.CalorieAppTokenomics.setLocale(l.tag);
  assert.equal(h.status().getAttribute('lang'),l.tag);assert.equal(h.panel().getAttribute('dir'),l.direction);
  assert.equal(h.panel().querySelector('h2').textContent,catalogue.translations[l.tag].walletTitle);
  assert.equal(h.panel().querySelector('code').textContent,wallet);
  assert.deepEqual(shape(h.chart),h.before.chart);assert.deepEqual(shape(h.row),h.before.row);assert.deepEqual(shape(h.controls),h.before.controls);
 }
});

test('unknown or incomplete locale falls back wholly to English; text is never interpreted as markup',()=>{
 const h=harness();h.window.CalorieAppTokenomics.setLocale('unknown');assert.equal(h.panel().getAttribute('lang'),'en');
 delete h.config.copy.nl.status;h.window.CalorieAppTokenomics.setLocale('nl');assert.equal(h.status().getAttribute('lang'),'en');
 h.config.copy.en.description='<img src=x onerror=alert(1)>';h.window.CalorieAppTokenomics.refresh();
 assert.equal(h.panel().querySelector('img'),null);assert.match(h.panel().textContent,/<img src=x/);
});

test('other routes, editor/private/form contexts and ambiguous source do not receive helpers',()=>{
 const cases=[{page:1090},{url:'https://example.org/index.php/tokenomics-update/'},{url:'https://calorietoken.net/index.php/tokenomics-update/?preview=true'},
  {configure:c=>c.publicPage='true'},{configure:c=>delete c.copy.en},
  {mutate:h=>h.body.setAttribute('class','brz brz-ed page-id-1209')},
  {mutate:h=>h.form.appendChild(h.root)},{mutate:h=>h.root.appendChild(h.make('input'))},
  {mutate:h=>h.body.appendChild(fromShape(shape(h.root)))},
  {mutate:h=>h.image.querySelector('img').setAttribute('title','A different chart')},
  {mutate:h=>h.row.remove()},{mutate:h=>h.root.appendChild(h.chart)}];
 for(const c of cases){const h=harness(c);assert.equal(h.status(),null);assert.equal(h.panel(),null);assert.deepEqual(shape(h.controls),h.before.controls);}
});

test('late source mounts on load and replacement reattaches without changing native content',()=>{
 const h=harness({mutate:h=>h.row.remove()});assert.equal(h.panel(),null);
 h.container.appendChild(h.row);h.fire('load');assert.ok(h.panel());
 const old=h.panel();h.row.remove();h.window.CalorieAppTokenomics.refresh();assert.equal(h.panel(),null);assert.equal(old.parentElement,null);
 h.container.appendChild(h.row);h.fire('pageshow');assert.ok(h.panel());assert.notEqual(h.panel(),old);
 assert.deepEqual(shape(h.row),h.before.row);assert.deepEqual(shape(h.chart),h.before.chart);
});
