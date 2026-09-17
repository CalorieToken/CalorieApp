// Isolated review fixture built from the actual UI modules. No real accounts or requests.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),require=createRequire(root+'/frontend/package.json'),ts=require('typescript');
const out=resolve(process.argv[2]||root+'/dist/account-guide-preview');mkdirSync(out,{recursive:true});
const read=p=>readFileSync(root+'/'+p,'utf8');
const accountCopy=JSON.parse(read('frontend/config/testnet-entry-copy.json'));
const copy={...JSON.parse(read('wordpress-plugins/calorietoken-site-style/assets/testnet-data.json'))};
for(const [tag,c]of Object.entries(copy))Object.assign(c,{keepPageOpen:accountCopy[tag].description,previewPictures:c.importHelp,networkDeveloper:c.import1,networkSwitch:c.stepNetwork,networkSelect:c.stepNetwork,importExisting:c.import2,importAccess:c.stepImport,importFamily:c.stepImport,screenshotSource:'Xaman Help Center',enlargeScreenshot:c.importHelp,screenshotNote:c.pilotScope,finishImport:c.import3});
const modules={};
for(const [name,path]of Object.entries({'@/components/CalorieAppWorkspace':'frontend/components/CalorieAppWorkspace.tsx','@/components/TestnetEntry':'frontend/components/TestnetEntry.tsx','@/lib/accountJourney':'frontend/lib/accountJourney.ts'})){
 modules[name]=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
}
const moduleText=Object.entries(modules).map(([name,code])=>`factories[${JSON.stringify(name)}]=function(require,module,exports){${code}\n};`).join('\n');
const css=execFileSync(root+'/frontend/node_modules/.bin/tailwindcss',['-i','app/globals.css','--minify'],{cwd:root+'/frontend',encoding:'utf8'}).replaceAll("url('/calorieapp-background.png')","url('./calorieapp-background.png')");
copyFileSync(root+'/frontend/public/calorieapp-background.png',out+'/calorieapp-background.png');
copyFileSync(root+'/frontend/public/logo.png',out+'/logo.png');
const react=read('frontend/node_modules/react/umd/react.production.min.js')+'\n'+read('frontend/node_modules/react-dom/umd/react-dom.production.min.js');
const common=`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; frame-src 'self';"><title>CalorieApp · accountbegeleiding · controlevoorbeeld</title>`;
writeFileSync(out+'/app.html',common+`<style>${css}</style></head><body><main class="mx-auto max-w-5xl px-4 py-6"><div class="mb-4 rounded-xl bg-amber-50 p-3 text-sm">Controlevoorbeeld · geen echte accounts of gegevens</div><header class="mb-5 flex items-center gap-4"><img src="logo.png" alt="CalorieApp" width="52" height="52"><h1 class="text-3xl font-bold text-brand-primary">CalorieApp</h1></header><div id="root"></div></main><script>${react}</script><script>
const lang=new URLSearchParams(location.search).get('locale')||'nl',copy=${JSON.stringify(accountCopy)};
const c=copy[lang]||copy.nl;
const imports={
'react':React,'react/jsx-runtime':{jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key})},
'@/config/testnet-entry-copy.json':{default:copy},
'@/components/DisplayLanguageProvider':{useDisplayLanguage:()=>({enabled:true,locale:lang})},
'@/lib/locales':{localeDirection:tag=>['ar','ur'].includes(tag)?'rtl':'ltr'},
'@/components/AgeExperienceControl':{AgeExperienceControl:()=>null,useAgeExperience:()=>['adult',()=>{}]},
'@/components/FoodSearchPlaceholder':{FoodSearchPlaceholder:({activeView})=>React.createElement('p',{hidden:!activeView,className:'rounded-xl bg-white p-4'},'Voorbeeld van de gekozen appsectie. Je kunt hierboven naar je stappenplan terug.')},
'@/components/NicknameProfile':{NicknameProfile:()=>null},
'@/components/XamanLoginPanel':{XamanLoginPanel:()=>React.createElement('section',{className:'rounded-2xl border border-brand-secondary/20 bg-white p-5'},React.createElement('h2',{className:'text-xl font-bold text-brand-primary'},'Accountbeheer'),React.createElement('p',{className:'mt-3 text-sm text-brand-secondary'},'De twee knoppen hierboven openen de echte aangepaste begeleidingsschermen. In dit voorbeeld is aanmelden uitgeschakeld.'))},
'@/lib/authUi':{getAuthUi:()=>({copy:{accountTools:'Accountbeheer'}})},
'@/lib/foodDiary':{diaryCopy:()=>({title:'Eetdagboek'})},
'@/lib/foodExperience':{foodExperience:()=>({copy:{sourceTitle:'Basisvoeding',navigation:'Ga naar'}})},
'@/lib/foodUi':{getFoodUi:()=>({copy:{searchTitle:'Product zoeken'},locale:lang,direction:['ar','ur'].includes(lang)?'rtl':'ltr'})},
};
const process={env:{}},factories={};${moduleText}
function require(name){if(imports[name])return imports[name];const module={exports:{}};factories[name](require,module,module.exports);imports[name]=module.exports;return module.exports;}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(require('@/components/CalorieAppWorkspace').CalorieAppWorkspace));
</script></body></html>`);
const testScript=read('wordpress-plugins/calorietoken-heading-repair/assets/site-testnet.js');
const focusScript=read('wordpress-plugins/calorietoken-heading-repair/assets/app-focus.js');
writeFileSync(out+'/test.html',common+`<style>*{box-sizing:border-box}body{margin:0;background:#f5f5f5;color:#1d2b36}p,h2,h3{font-family:Georgia,serif;font-size:36px;line-height:1.8}button{font-family:Georgia;font-size:24px}.preview-label{font:14px/1.4 Arial;padding:10px;background:#fff8e9}.ctstyle-shared-panel{background:#efe9d8;border:4px solid #505ba9;padding:30px;border-radius:28px}.ctstyle-testnet-create{border:3px solid orange;padding:30px}.ctstyle-discovery-card p{font-size:36px!important}[data-calorieapp-embed] iframe{border:0;width:100%;height:120px}${read('wordpress-plugins/calorietoken-heading-repair/assets/app-focus.css')}</style></head><body class="ctstyle-enabled page-id-7880"><div class="preview-label">Controlevoorbeeld · alleen fictieve testgegevens · geen netwerkverzoeken</div><div data-calorieapp-embed><iframe title="CalorieApp" src="about:blank"></iframe><button id="preview-open">Testaccount instellen</button></div><section id="ctstyle-testnet" data-ctstyle-testnet="1" class="ctstyle-discovery-card ctstyle-shared-panel"><details class="ctstyle-testnet-disclosure"><summary><h2>Testaccount instellen</h2></summary><p>Oude lange WordPress-introductie</p><p>Oude melding</p><div class="ctstyle-test-steps"></div></details></section><script>
const lang=new URLSearchParams(location.search).get('locale')||'nl';document.documentElement.lang=lang;document.documentElement.dir=['ar','ur'].includes(lang)?'rtl':'ltr';
const realWindow=window,handlers=new Map(),fake=Object.create(null);
for(const name of ['setTimeout','clearTimeout','requestAnimationFrame','matchMedia','scrollTo'])fake[name]=window[name].bind(window);
fake.location=new URL('https://calorietoken.net/calorieapp/');fake.sessionStorage=window.sessionStorage;fake.AbortController=AbortController;fake.CalorieTokenAgeExperience={getBand:()=> 'adult'};
fake.addEventListener=(name,fn)=>{handlers.set(name,[...handlers.get(name)||[],fn]);};
fake.CalorieTokenDiscovery={page:7880,testCopy:${JSON.stringify(copy)}};
let socket;
fake.WebSocket=class {constructor(){socket=this;setTimeout(()=>this.onopen?.(),1);}send(){setTimeout(()=>this.onmessage?.({data:JSON.stringify({id:1,status:'success',result:{validated:true,account_data:{Account:'r'+'1'.repeat(25),Balance:'10000000'}}})}),1);}close(){}};
fake.fetch=async()=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({account:{address:'r'+'1'.repeat(25)},seed:'s'+'2'.repeat(24)})});
const fakeNavigator={clipboard:{writeText:async()=>{}}};
(function(window,navigator){${testScript}\n})(fake,fakeNavigator);
const frame=document.querySelector('iframe'),fakeFrame={postMessage(){}};
Object.defineProperty(frame,'src',{get:()=> 'https://app.calorietoken.net/?embedded=1'});
Object.defineProperty(frame,'contentWindow',{get:()=>fakeFrame});
(function(window){${focusScript}\n})(fake);
document.addEventListener('DOMContentLoaded',()=>{
 fake.CalorieTokenTestnet.refresh(lang);
 document.querySelector('#preview-open').onclick=()=>{for(const fn of handlers.get('message')||[])fn({source:fakeFrame,origin:'https://app.calorietoken.net',data:{type:'calorieapp:testnet-guide:open',version:1}});};
 document.querySelector('#preview-open').click();
});
</script></body></html>`);
writeFileSync(out+'/index.html',`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Controle CalorieApp accounthulp</title><style>body{font:16px/1.5 'Segoe UI',sans-serif;background:#eef1f4;margin:24px;color:#253152}button,a{display:inline-block;font:inherit;border:1px solid #505ba9;border-radius:9px;padding:8px 12px;background:#fff;color:#253152;margin:4px;cursor:pointer}iframe{display:block;margin:20px auto;border:1px solid #c2c6d1;border-radius:12px;max-width:100%;height:1100px;background:#fff}h1{color:#008d36}nav{position:sticky;top:0;background:#eef1f4;padding:8px}</style></head><body><h1>CalorieApp · accounthulp</h1><p>Controlevoorbeeld van de aangepaste appcode. Accountaanmaak, aanmelden en gegevensoverdracht zijn gesimuleerd. Er worden geen echte accounts gemaakt.</p><nav><button onclick="show('app')">App en overstap</button><button onclick="show('test')">Testaccount instellen</button><button onclick="size(360)">360 px</button><button onclick="size(412)">412 px</button><button onclick="size(1440)">1440 px</button><select aria-label="Voorbeeldtaal" onchange="lang=this.value;show(mode)">${Object.keys(copy).map(t=>`<option value="${t}" ${t==='nl'?'selected':''}>${t}</option>`).join('')}</select></nav><iframe id="preview" title="Accountbegeleiding voorbeeld" width="412" src="app.html"></iframe><script>let mode='app',lang='nl';function show(value){mode=value;document.querySelector('iframe').src=value+'.html?locale='+encodeURIComponent(lang)}function size(value){document.querySelector('iframe').width=value}</script></body></html>`);
console.log(out);
