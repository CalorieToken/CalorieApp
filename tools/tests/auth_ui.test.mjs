import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {authUi,authCopy} from './helpers/auth_ui.mjs';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const React=require('react'), {renderToStaticMarkup}=require('react-dom/server'), ts=require('typescript');
const source=readFileSync(new URL('../../frontend/components/XamanLoginPanel.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
test('Every agreed language renders the anonymous sign-in panel without a request',()=>{
 assert.equal(Object.keys(authCopy).length,11);
 for(const [locale,copy] of Object.entries(authCopy)){
  assert.deepEqual(Object.keys(copy).sort(),Object.keys(authCopy.en).sort());
  assert.ok(Object.values(copy).every(value=>typeof value==='string'&&value.trim()));
  const module={exports:{}};
  vm.runInNewContext(compiled,{module,exports:module.exports,process:{env:{}},URL,URLSearchParams,window:{location:{search:'?locale='+locale}},document:{documentElement:{lang:locale}},navigator:{language:locale},require(name){
   if(['react','react/jsx-runtime'].includes(name))return require(name);
   if(name==='@/components/DisplayLanguageProvider')return {useDisplayLanguage:()=>({enabled:false,locale:'en'})};if(name==='@/lib/authUi')return authUi;
   if(name==='@/lib/locales')return {resolveLocale:value=>value||'en'};
   if(name==='@/lib/backendRequest')return {BACKEND_WAKE_BASE_URL:'/api/backend',backendRequest(){throw new Error('Rendering must not start sign-in');}};
   if(name.startsWith('@/components/'))return {};
   throw new Error(name);
  }});
  const html=renderToStaticMarkup(React.createElement(module.exports.XamanLoginPanel));
  assert.ok(html.includes(`lang="${locale}"`));assert.ok(html.includes(`dir="${['ar','ur'].includes(locale)?'rtl':'ltr'}"`));
  for(const key of ['optionalAccount','signIn','signInDescription','connectingLogin'])assert.ok(html.includes(copy[key].replaceAll('&','&amp;').replaceAll("'",'&#x27;')),locale+'.'+key);
 }
});
test('Owned progress and errors translate; arbitrary server or product text remains literal',()=>{
 const copy=authUi.getAuthUi('es').copy;
 assert.equal(authUi.translateAuthMessage(authCopy.en.preparing,copy),copy.preparing);
 assert.equal(authUi.translateAuthMessage(authCopy.en.serviceSlow,copy),copy.serviceSlow);
 assert.equal(authUi.translateAuthMessage('WordPress signed in. Restoring CalorieApp in this browser...',copy),copy.reconnecting);
 const unknown='Provider detail <script>not executable</script> {locale}';assert.equal(authUi.translateAuthMessage(unknown,copy),unknown);
 for(const tag of Object.keys(authCopy)){
  const localized=authUi.getAuthUi(tag).copy;
  for(const key of ['logout','signIn','continueXaman','connectedAccount','preparingXaman']){
   assert.equal(authUi.translateAuthMessage(authCopy.en[key],localized),authCopy.en[key],tag+'.'+key);
  }
  for(const key of ['restoring','complete','restoreFailed','preparing','starting','retrying','busy','activating','reconnecting','signedBoth','languageMismatch','responseMismatch','finishFailed','bridgeUnavailable','prepareFailed','logoutFailed','serviceSlow']){
   assert.equal(authUi.translateAuthMessage(authCopy.en[key],localized),localized[key],tag+'.'+key);
  }
 }
 assert.equal(authUi.getAuthUi('unknown').locale,'en');
});
