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
