import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { parseHTML } = require('linkedom');
const source = fs.readFileSync(new URL('../../wordpress-plugins/calorietoken-heading-repair/assets/content-style.js', import.meta.url), 'utf8');

function fixture(content, bodyClass='ctstyle-enabled', path='/calorieapp/') {
  const {window:domWindow,document} = parseHTML(`<html><head></head><body class="${bodyClass}">
  <header class="ctstyle-site-header"><p id="header-copy">Header</p><button>Login</button></header>
  <div class="ctstyle-title"><h1>Historic title</h1></div>${content}
  <footer class="ctstyle-footer"><p id="footer-copy">Historic footer</p><button>Next social</button></footer>
  <aside><p id="after-footer">Outside the requested region</p></aside></body></html>`);
  const window={Event:domWindow.Event,Element:domWindow.Element};
  // Linkedom reverses document order for descendants of preceding siblings.
  // Supply the standard ordering here; Chromium tests use the native method.
  window.Element.prototype.compareDocumentPosition=function(other) {
    if(this===other)return 0;
    if(this.contains(other))return 20;
    if(other.contains(this))return 10;
    const nodes=Array.from(this.ownerDocument.querySelectorAll('*'));
    return nodes.indexOf(this)<nodes.indexOf(other)?4:2;
  };
  const frames=[];
  const context={window,document,location:{origin:'https://calorietoken.net',pathname:path},requestAnimationFrame:fn=>frames.push(fn),MutationObserver:class{observe(){}},Map,Set};
  vm.runInNewContext(source,context);
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const refresh=()=>{window.CalorieTokenContentStyle.refresh();while(frames.length)frames.shift()();};
  return {window,document,refresh};
}
test('only ordinary content between the historical title and footer receives markers',()=>{
  const {document}=fixture('<section id="card" class="ctstyle-shared-panel"><h2>About the app</h2><p id="copy">Body copy</p><a href="/faq/">Help</a></section>');
  assert.ok(document.querySelector('#card').classList.contains('ct-content-card'));
  assert.ok(document.querySelector('#copy').classList.contains('ct-content-text'));
  for(const id of ['header-copy','footer-copy','after-footer'])assert.ok(!document.getElementById(id).className.includes('ct-content-'));
  assert.ok(!document.querySelector('h1').className.includes('ct-content-'));
});
test('historical art, Home animation and slider nodes/handlers are retained',()=>{
  const {document,refresh}=fixture('<div class="brz-animated"><p id="moving">Moving Home copy</p></div><div class="brz-image"><a href="/restaurants/"><img src="/historic.png"></a></div><div class="brz-carousel"><button id="slide">Next</button><p>Slide</p></div>','ctstyle-footer-only page-id-1090');
  const image=document.querySelector('.brz-image'),before=image.outerHTML,button=document.querySelector('#slide');
  let clicks=0;button.addEventListener('click',()=>clicks++);refresh();button.click();
  assert.equal(clicks,1);assert.equal(image.outerHTML,before);assert.equal(document.querySelector('#slide'),button);
  assert.ok(!document.querySelector('#moving').className.includes('ct-content-'));
  assert.ok(!button.className.includes('ct-content-'));
});
test('no text, URLs, table values, inputs, form semantics or disclosure state are rewritten',()=>{
  const {document,refresh}=fixture('<section class="ctstyle-discovery-card"><details open><summary>FAQ</summary><p>Same answer</p></details><form><label>Value<input value="synthetic"></label><button type="submit" disabled>Send</button></form><table class="xl-richlist"><tbody><tr><td><a href="/rank/">123</a></td></tr></tbody></table></section>');
  const form=document.querySelector('form'),input=document.querySelector('input');
  refresh();assert.equal(input.value,'synthetic');assert.equal(document.querySelector('form'),form);
  assert.equal(document.querySelector('a').getAttribute('href'),'/rank/');assert.equal(document.querySelector('td').textContent,'123');
  assert.ok(document.querySelector('details').hasAttribute('open'));assert.ok(document.querySelector('form button').disabled);
  assert.ok(document.querySelector('table').classList.contains('ct-content-table'));
  assert.equal(document.querySelectorAll('.xl-richlist .ct-content-text,.xl-richlist .ct-content-link').length,0);
});
test('late cards receive styles and nodes moved into a protected header lose them',()=>{
  const {document,refresh}=fixture('');
  const card=document.createElement('section');card.className='ctstyle-discovery-card';card.innerHTML='<h2>Late translation</h2><p>Body</p>';
  document.querySelector('footer').before(card);refresh();assert.ok(card.classList.contains('ct-content-card'));
  document.querySelector('header').append(card);refresh();
  assert.ok(!card.classList.contains('ct-content-card'));assert.ok(!card.querySelector('p').classList.contains('ct-content-text'));
});
test('account/consent/app surfaces and admin/editor views are outside the change',()=>{
  const content='<div class="xl-card"><p id="account">Account</p><button>Log out</button></div><div data-calorieapp-embed><p id="app">Embedded app</p></div><div role="dialog"><p id="dialog">Consent</p></div>';
  const {document}=fixture(content);
  for(const id of ['account','app','dialog'])assert.equal(document.getElementById(id).className,'');
  const admin=fixture('<p id="admin">Admin</p>','ctstyle-enabled','/wp-admin/post.php');
  assert.ok(!admin.document.body.classList.contains('ct-content-theme'));
});
test('CalorieHelp interior follows the app style outside the footer while its mascot is retained',()=>{
  const {document,refresh}=fixture('');
  const launcher=document.createElement('aside');launcher.id='ctstyle-app-launcher';
  launcher.innerHTML='<img class="ctstyle-help-mascot" src="/mascot.png"><section class="ctstyle-help-widget"><header class="ctstyle-help-header"><img class="ctstyle-help-avatar" src="/mascot.png"><h2>CalorieHelp</h2></header><p>Ask your question</p><button type="button">Search</button><div class="ctstyle-help-reply"><p>Answer</p></div></section>';
  document.body.append(launcher);const mascot=launcher.querySelector('img').outerHTML;refresh();
  assert.ok(launcher.querySelector('.ctstyle-help-widget').classList.contains('ct-content-help'));
  assert.ok(launcher.querySelector('h2').classList.contains('ct-content-heading'));
  assert.ok(launcher.querySelector('button').classList.contains('ct-content-action'));
  assert.equal(launcher.querySelector('img').outerHTML,mascot);
});
