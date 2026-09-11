import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {parseHTML}=require('linkedom');
const base=new URL('../../wordpress-plugins/calorietoken-site-style/assets/',import.meta.url);
const source=name=>readFileSync(new URL(name,base),'utf8');
const copy=JSON.parse(source('presentation-data.json'));
const paths=['','calorieapp','showcases','community-voting-hub-info','whitepaper','how-to-buy-calorie','trustline','tokenomics-update','roadmap','richlist','blog','contact','faq','donate','merchnfts'];
function fixture(html){
 const {document}=parseHTML('<html><body class="ctstyle-enabled">'+html+'</body></html>');
 const window={location:new URL('https://calorietoken.net/showcases/'),CalorieTokenPresentation:{copy,links:paths.map(path=>({title:path||'Home',url:'https://calorietoken.net/'+path+(path?'/':'')}))},addEventListener(){}};
 const context=vm.createContext({window,document,URL,Intl,console});
 const run=name=>vm.runInContext(source(name),context);
 return {document,window,run};
}
test('native, fallback and Showcases headers receive the same groups without replacing authentication controls',()=>{
 const h=fixture('<section><div class="brz-menu-simple"><div><input id="mobile" type="checkbox"><label class="brz-menu-simple__icon" for="mobile"></label><div class="menu-hoofdmenu3-container"><ul><li>old</li></ul></div></div></div><div class="xl-card"><button>Existing auth control</button></div></section><header class="ctstyle-header-fallback"><nav class="ctstyle-desktop-nav"></nav><details class="ctstyle-mobile-nav"><summary>Menu</summary><nav></nav></details></header><header class="showcase-page-header"><nav class="showcase-header-menu"></nav><details class="showcase-mobile-menu"><summary>Menu</summary><nav></nav></details></header>');
 const widget=h.document.querySelector('.xl-card'),input=h.document.querySelector('#mobile');
 h.run('presentation.js');
 const menus=h.document.querySelectorAll('.ctstyle-menu-groups');assert.equal(menus.length,5);
 for(const menu of menus){assert.equal(menu.querySelectorAll('a').length,15);assert.equal(menu.querySelectorAll('details').length,4);assert.equal(menu.children.length,6);assert.deepEqual([...menu.querySelectorAll('a')].map(a=>a.href).sort(),paths.map(p=>'https://calorietoken.net/'+p+(p?'/':'')).sort());}
 assert.equal(h.document.querySelector('.xl-card'),widget);assert.equal(h.document.querySelector('#mobile'),input);
 for(const locale of Object.keys(copy)){h.window.CalorieTokenPresentationUI.refresh(locale);assert.equal(h.document.querySelector('[data-ctstyle-menu-group="help"]').textContent,copy[locale].help);}
 assert.equal(h.document.querySelectorAll('.ctstyle-menu-groups').length,5);assert.equal(h.document.querySelectorAll('input').length,1);
});
test('title initials survive translated text and English restoration without duplicate wrappers',()=>{
 const h=fixture('<div class="brz-rich-text"><h1 class="ctstyle-heading">Free Test Account</h1></div><header class="ctstyle-crypto-intro"><h2>CAL &amp; Crypto</h2></header>');
 h.window.CalorieTokenContentLanguage={locales:['en','nl'],entries:[{source:'Free Test Account',translations:{nl:'Gratis Testaccount'}}]};
 h.run('content-language.js');h.run('presentation.js');
 assert.deepEqual([...h.document.querySelectorAll('.ctstyle-crypto-intro .ctstyle-word-initial')].map(n=>n.textContent),['C','C']);
 for(let i=0;i<3;i++)for(const [locale,text,letters] of [['nl','Gratis Testaccount',['G','T']],['en','Free Test Account',['F','T','A']]]){
  h.window.CalorieTokenContentLanguageUI.refresh(locale);h.window.CalorieTokenPresentationUI.refresh(locale);
  const heading=h.document.querySelector('h1');assert.equal(heading.textContent,text);assert.deepEqual([...heading.querySelectorAll('.ctstyle-word-initial')].map(n=>n.textContent),letters);
 }
});
test('a presentation-only draft preview styles headings without creating login, camera or faucet elements',()=>{
 const h=fixture('<main><h1 class="entry-title">Draft Showcase</h1></main>');h.document.body.className='ctstyle-presentation-preview';
 h.run('presentation.js');assert.equal(h.document.querySelectorAll('.ctstyle-word-initial').length,2);
 assert.equal(h.document.querySelectorAll('iframe,form,button,.xl-card').length,0);
});
test('fragmented Brizy words have one initial, preserve markup, and treat line breaks as word boundaries',()=>{
 const h=fixture('<h1 class="ctstyle-heading"><strong>C</strong><strong>alorie</strong><strong>A</strong><strong>pp</strong></h1><h2 class="ctstyle-heading"><span>S</span><em>howcases</em><br><strong>Voting</strong> <span>Hub</span></h2><h3 class="ctstyle-heading"><b>E</b><i>\u0301nergie</i></h3>');
 const strongs=[...h.document.querySelectorAll('strong')],em=h.document.querySelector('em');
 h.run('presentation.js');
 for(let i=0;i<3;i++)h.window.CalorieTokenPresentationUI.refresh();
 assert.equal(h.document.querySelector('h1').textContent,'CalorieApp');
 assert.deepEqual([...h.document.querySelectorAll('h1 .ctstyle-word-initial')].map(n=>n.textContent),['C']);
 assert.deepEqual([...h.document.querySelectorAll('h2 .ctstyle-word-initial')].map(n=>n.textContent),['S','V','H']);
 assert.equal([...h.document.querySelectorAll('h3 .ctstyle-word-initial')].map(n=>n.textContent).join(''),'E\u0301');
 assert.deepEqual([...h.document.querySelectorAll('strong')],strongs);assert.equal(h.document.querySelector('em'),em);
 assert.equal(h.document.querySelectorAll('br').length,1);
});
test('fragmented title markup returns intact after translation and English restoration',()=>{
 const h=fixture('<div class="brz-rich-text"><h1 class="ctstyle-heading"><strong>S</strong><span>howcases</span></h1></div>');
 h.window.CalorieTokenContentLanguage={locales:['en','nl'],entries:[{source:'Showcases',translations:{nl:'Voorbeelden'}}]};
 h.run('content-language.js');h.run('presentation.js');
 for(let i=0;i<3;i++)for(const [locale,text,letter] of [['nl','Voorbeelden','V'],['en','Showcases','S']]){
  h.window.CalorieTokenContentLanguageUI.refresh(locale);h.window.CalorieTokenPresentationUI.refresh(locale);
  const heading=h.document.querySelector('h1');assert.equal(heading.textContent,text);
  assert.deepEqual([...heading.querySelectorAll('.ctstyle-word-initial')].map(n=>n.textContent),[letter]);
 }
 assert.equal(h.document.querySelector('h1 strong').textContent,'S');
});
test('content panels share framing while Brizy structure, forms, disclosures, and account controls survive',()=>{
 const h=fixture('<header class="ctstyle-header"><div class="brz-columns"><div class="brz-column__items"><div class="brz-rich-text"><h2>Header</h2><p>Brand</p></div></div></div></header><div class="brz-columns"><div id="content" class="brz-column__items"><div class="brz-rich-text"><h2><strong>Public</strong> guide</h2><p>Existing content</p></div><button id="action">Continue</button></div></div><section class="ctstyle-discovery-card"><h2>Test account</h2><form><label>Input <input value="keep"></label></form></section><details class="ctstyle-manual-trustline"><summary>Manual setup</summary><p>Existing guide</p></details><ol class="cal-buy-steps"><li><span>1</span><div><h3>Set up wallet</h3><p>Guide text</p></div></li></ol><div class="brz-columns"><div id="protected" class="brz-column__items"><h2>Account</h2><div class="xl-card"><button>Login</button></div></div></div><article class="showcase-card"><h2>Find a product</h2></article>');
 const input=h.document.querySelector('input'),button=h.document.querySelector('#action'),details=h.document.querySelector('details');let clicks=0;
 button.addEventListener('click',()=>clicks++);
 h.run('presentation.js');h.window.CalorieTokenPresentationUI.refresh();button.click();
 assert.equal(clicks,1);assert.equal(h.document.querySelector('input'),input);assert.equal(input.value,'keep');assert.equal(h.document.querySelector('details'),details);assert.equal(details.hasAttribute('open'),false);
 assert.ok(h.document.querySelector('#content.ctstyle-shared-panel'));
 assert.ok(h.document.querySelector('.showcase-card.ctstyle-shared-panel'));
 assert.ok(h.document.querySelector('.cal-buy-steps>li.ctstyle-shared-panel'));
 assert.ok(h.document.querySelector('.ctstyle-manual-trustline.ctstyle-shared-disclosure'));
 assert.equal(h.document.querySelectorAll('.ctstyle-header .ctstyle-shared-panel,#protected.ctstyle-shared-panel').length,0);
 assert.deepEqual([...h.document.querySelectorAll('#content .ctstyle-word-initial')].map(n=>n.textContent),['P','g']);
});
