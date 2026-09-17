import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {parseHTML}=require('linkedom');
const assets=new URL('../../wordpress-plugins/calorietoken-heading-repair/assets/',import.meta.url);
const names=['help','site-app-integration','site-blog-timeline','site-discovery','site-menu-pages','site-ready-languages','site-testnet','site-tokenomics'];

test('public campaign parameters stay enabled while preview and unknown parameters stay blocked',()=>{
  for(const name of names){
    const source=readFileSync(new URL(`${name}.js`,assets),'utf8');
    const functionSource=source.match(/function safeQueryKey\(key\)\s*\{[\s\S]*?\n?\s*\}/)?.[0];
    assert.ok(functionSource,`${name} defines the reviewed allowlist`);
    const context={};vm.runInNewContext(`${functionSource};this.safeQueryKey=safeQueryKey`,context);
    for(const key of ['ui_lang','utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','gclid','dclid','fbclid','msclkid','ttclid','twclid'])assert.equal(context.safeQueryKey(key),true,`${name}: ${key}`);
    for(const key of ['preview','brizy-edit','customize_changeset_uuid','ref','redirect_to','foo'])assert.equal(context.safeQueryKey(key),false,`${name}: ${key}`);
    assert.match(source,/\.every\(safeQueryKey\)/,`${name} applies the allowlist`);
  }
});

test('Richlist shows a bounded page, supports filtering and jumps to the known user row',()=>{
  const rows=Array.from({length:250},(_,index)=>`<tr class="${index===204?'xl-is-user':''}"><td>${index+1}</td><td>rADDRESS${String(index+1).padStart(4,'0')}</td><td>${1000-index}</td></tr>`).join('');
  const {window,document}=parseHTML(`<!doctype html><html lang="en"><body class="ctstyle-enabled page-id-3243"><main><table class="xl-richlist"><thead><tr><th>Rank</th><th>Address</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table></main></body></html>`);
  Object.defineProperty(window,'location',{value:new URL('https://calorietoken.net/richlist/?utm_source=audit'),configurable:true});
  Object.defineProperty(document,'readyState',{value:'complete',configurable:true});
  window.HTMLElement.prototype.scrollIntoView=function(){};
  window.HTMLElement.prototype.focus=function(){};
  window.matchMedia=()=>({matches:true});
  window.CalorieTokenSiteStyleMenu={
    initialLocale:'en',locales:[{tag:'en'}],contentUpdates:[],usecases:[],articleNotes:[],faqUpdates:[],merchUpdates:[],
    blog:{copy:{en:{description:'',action:'',settings:'',load:'',retry:''}}},copy:{en:{}},trustline:{translations:{}},
    richlist:{translations:{en:{region:'Holder table',action:'My position',jump:'Jump to my position'}}}
  };
  const source=readFileSync(new URL('site-menu-pages.js',assets),'utf8');
  vm.runInContext(source,vm.createContext({window,document,URL,Event:window.Event,MutationObserver:window.MutationObserver,Set,WeakMap,Intl,console}));
  const dataRows=[...document.querySelectorAll('tbody tr')];
  assert.equal(dataRows.filter(row=>!row.hidden).length,100);
  assert.match(document.querySelector('.calorieapp-richlist-page-status').textContent,/1.*100.*250/);
  assert.equal(document.querySelector('.calorieapp-richlist-filter').getAttribute('aria-label'),'Filter by rank or address');
  const jump=document.querySelector('.calorieapp-own-rank-jump');assert.equal(jump.hidden,false);jump.click();
  assert.equal(dataRows[204].hidden,false);assert.match(document.querySelector('.calorieapp-richlist-page-status').textContent,/201.*250.*250/);
  const search=document.querySelector('.calorieapp-richlist-filter');search.value='rADDRESS0022';search.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(dataRows.filter(row=>!row.hidden).length,1);assert.equal(dataRows[21].hidden,false);assert.match(document.querySelector('.calorieapp-richlist-page-status').textContent,/1.*1.*1/);
});
