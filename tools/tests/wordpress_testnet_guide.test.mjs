import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {parseHTML}=require('linkedom');
const base=new URL('../../wordpress-plugins/calorietoken-site-style/assets/',import.meta.url);
const copy=JSON.parse(readFileSync(new URL('testnet-data.json',base),'utf8'));
function fixture(){
 const {document}=parseHTML('<html lang="en"><body class="ctstyle-enabled page-id-7880"><section id="ctstyle-testnet" data-ctstyle-testnet="1"><div class="ctstyle-test-steps"></div></section></body></html>');
 let requests=0;
 const window={location:new URL('https://calorietoken.net/calorieapp/'),CalorieTokenDiscovery:{page:7880,testCopy:copy},addEventListener(){},clearTimeout(){},setTimeout(){throw new Error('Guide preview must not schedule service requests');},fetch(){requests++;throw new Error('Guide preview must not call the faucet');}};
 const context=vm.createContext({window,document,URL,Intl,console});
 vm.runInContext(readFileSync(new URL('testnet.js',base),'utf8'),context);
 return {document,window,requests:()=>requests};
}
test('picture instructions are available before account creation without requesting or exposing an account',()=>{
 const h=fixture();
 const preview=h.document.querySelector('.ctstyle-testnet-picture-preview');
 assert.ok(preview);
 preview.setAttribute('open','');
 assert.equal(preview.querySelectorAll('img').length,6);
 assert.equal(new Set([...preview.querySelectorAll('img')].map(n=>n.src)).size,6);
 assert.ok(preview.textContent.includes('Developer mode'));
 assert.ok(preview.textContent.includes('XRPL Testnet'));
 assert.ok(preview.textContent.includes('Family Seed'));
 for(const img of preview.querySelectorAll('img')){
  assert.equal(new URL(img.src).hostname,'3221812686-files.gitbook.io');
  assert.ok(img.alt.length>30);
 }
 for(const link of preview.querySelectorAll('figcaption a')) assert.equal(new URL(link.href).hostname,'help.xaman.app');
 assert.equal(h.requests(),0);
 assert.equal(h.document.querySelector('#ctstyle-testnet-secret').textContent,'');
 assert.equal(h.document.querySelector('#ctstyle-testnet-secret').hidden,true);
 assert.equal(h.document.querySelector('.ctstyle-testnet-result').hidden,true);
});
test('picture instructions and image descriptions follow every supported language without rebuilding controls',()=>{
 const h=fixture(),create=h.document.querySelector('#ctstyle-testnet-create-button');
 for(const locale of Object.keys(copy)){
  h.window.CalorieTokenTestnet.refresh(locale);
  assert.equal(h.document.querySelector('.ctstyle-testnet-picture-preview>summary').textContent,copy[locale].previewPictures);
  assert.equal(h.document.querySelector('.ctstyle-testnet-picture-preview img').alt,copy[locale].networkDeveloper);
  assert.equal(h.document.querySelectorAll('.ctstyle-testnet-picture-preview').length,1);
  assert.equal(h.document.querySelector('#ctstyle-testnet-create-button'),create);
 }
 assert.equal(h.requests(),0);
});
