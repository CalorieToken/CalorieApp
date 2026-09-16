import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { parseHTML } = require('linkedom');
const root = new URL('../../wordpress-plugins/calorietoken-heading-repair/', import.meta.url);
const source = fs.readFileSync(new URL('assets/nutrition-summary.js', root), 'utf8');
const appFocusSource = fs.readFileSync(new URL('assets/app-focus.js', root), 'utf8');
const css = fs.readFileSync(new URL('assets/app-focus.css', root), 'utf8');
const php = fs.readFileSync(new URL('calorietoken-heading-repair.php', root), 'utf8');
const readme = fs.readFileSync(new URL('README.txt', root), 'utf8');
const helpBootstrap = fs.readFileSync(new URL('assets/help-label-bootstrap.js', root), 'utf8');
const helpSource = fs.readFileSync(new URL('assets/help.js', root), 'utf8');
const languageBootstrap = fs.readFileSync(new URL('assets/language-bootstrap.js', root), 'utf8');
const helpLabels = JSON.parse(fs.readFileSync(new URL('assets/help-link-labels.json', root), 'utf8'));
const helpTopics = JSON.parse(fs.readFileSync(new URL('assets/help-topic-additions.json', root), 'utf8'));
const mascot = fs.readFileSync(new URL('assets/caloriehelp-mascot-v2.png', root));
const baseHelpData = JSON.parse(fs.readFileSync(new URL('../calorietoken-site-style/assets/help-data.json', root), 'utf8'));

function instrumentedApi() {
  const instrumented = source.replace(
    /\}\)\(\);\s*$/,
    'window.__ctNutritionTest={normaliseNutrition:normaliseNutrition,copy:copy};})();',
  );
  const context = {
    window: { addEventListener() {} },
    document: {
      readyState: 'loading',
      documentElement: { lang: 'en-US' },
      addEventListener() {},
      querySelector() { return null; },
    },
  };
  vm.runInNewContext(instrumented, context, { filename: 'nutrition-summary.js' });
  return context.window.__ctNutritionTest;
}

test('private aggregate payload is strictly validated in all eleven locales', () => {
  const api = instrumentedApi();
  const message = {
    type: 'calorieapp:nutrition-summary',
    version: 1,
    status: 'ready',
    locale: 'nl',
    period: 'week',
    total: 7,
    known: 4,
    missing: 1,
    counts: { A: 2, B: 1, C: 0, D: 0, E: 1 },
    sources: { open_food_facts: 5, usda: 1, other: 1 },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(api.normaliseNutrition(message))), {
    locale: 'nl',
    period: 'week',
    total: 7,
    known: 4,
    missing: 1,
    counts: { A: 2, B: 1, C: 0, D: 0, E: 1 },
    sources: { open_food_facts: 5, usda: 1, other: 1 },
  });
  for (const invalid of [
    { ...message, status: 'loading' },
    { ...message, version: 2 },
    { ...message, period: 'year' },
    { ...message, total: 2 },
    { ...message, known: 5 },
    { ...message, missing: 2 },
    { ...message, counts: { ...message.counts, A: -1 } },
    { ...message, counts: { ...message.counts, E: 100001 } },
    { ...message, sources: { ...message.sources, usda: -1 } },
    { ...message, sources: { ...message.sources, other: 2 } },
    { ...message, sources: { ...message.sources, open_food_facts: 3 } },
  ]) assert.equal(api.normaliseNutrition(invalid), null);

  for (const tag of ['en', 'nl', 'zh-Hans', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'id', 'ur']) {
    const value = api.copy(tag);
    for (const key of ['title', 'scope', 'periodTitle', 'day', 'week', 'month', 'all', 'loading', 'unavailable', 'details', 'coverage', 'empty', 'off', 'usda', 'other', 'note']) {
      assert.ok(value[key]?.trim(), `${tag}.${key}`);
    }
  }
});

test('summary renders beside the app instead of enlarging Xaman and clears stale data', () => {
  const { document, window } = parseHTML(`<!doctype html><html lang="nl"><body>
    <section class="xl-card"><div id="ctstyle-account-app"></div></section>
    <iframe title="CalorieApp" src="https://app.calorietoken.net/"></iframe>
  </body></html>`);
  const frame = document.querySelector('iframe');
  const sent = [];
  const trustedFrameWindow = { postMessage(message, origin) { sent.push({message, origin}); } };
  Object.defineProperty(frame, 'contentWindow', { value: trustedFrameWindow });
  Object.defineProperty(window, 'location', {
    value: new URL('https://calorietoken.net/calorieapp/'),
    configurable: true,
  });
  const listeners = new Map();
  const nativeAddEventListener = window.addEventListener.bind(window);
  window.addEventListener = (type, listener, options) => {
    listeners.set(type, listener);
    nativeAddEventListener(type, listener, options);
  };
  window.setTimeout = () => 0;
  window.clearTimeout = () => {};

  vm.runInContext(source, vm.createContext({
    window,
    document,
    URL,
    Intl,
    MutationObserver: window.MutationObserver,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
  }), { filename: 'nutrition-summary.js' });

  const summary = document.getElementById('ct-calorieapp-nutrition-summary');
  assert.ok(summary);
  assert.equal(summary.closest('.xl-card'), null);
  assert.equal(summary.nextElementSibling, frame);
  assert.equal(summary.hidden, true);
  assert.equal(summary.querySelectorAll('[data-ct-nutrition-grade]').length, 5);
  assert.equal(summary.querySelectorAll('[data-ct-nutrition-source]').length, 3);
  assert.equal(summary.querySelectorAll('[data-ct-nutrition-period]').length, 4);

  const ready = {
    type: 'calorieapp:nutrition-summary',
    version: 1,
    status: 'ready',
    locale: 'nl',
    period: 'week',
    total: 7,
    known: 4,
    missing: 1,
    counts: { A: 2, B: 1, C: 0, D: 0, E: 1 },
    sources: { open_food_facts: 5, usda: 1, other: 1 },
  };
  const onMessage = listeners.get('message');
  onMessage({ source: {}, origin: 'https://app.calorietoken.net', data: ready });
  assert.equal(summary.hidden, true);
  onMessage({ source: trustedFrameWindow, origin: 'https://evil.example', data: ready });
  assert.equal(summary.hidden, true);
  onMessage({ source: trustedFrameWindow, origin: 'https://app.calorietoken.net', data: ready });
  assert.equal(summary.hidden, false);
  assert.equal(summary.lang, 'nl');
  assert.match(summary.querySelector('.ct-calorieapp-nutrition-coverage').textContent, /4 van 5/);
  assert.equal(summary.querySelector('[data-ct-nutrition-source="usda"] dd').textContent, '1');
  assert.equal(summary.querySelector('[data-ct-nutrition-period="week"]').getAttribute('aria-pressed'), 'true');
  assert.equal(summary.querySelectorAll('.ct-calorieapp-nutrition-segment').length, 3);
  assert.match(summary.querySelector('.ct-calorieapp-nutrition-bar').getAttribute('aria-label'), /A: 2/);

  summary.querySelector('[data-ct-nutrition-period="month"]').click();
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [{
    message: {type: 'calorieapp:nutrition-period', version: 1, period: 'month'},
    origin: 'https://app.calorietoken.net',
  }]);
  assert.equal(summary.dataset.state, 'loading');
  assert.equal(summary.querySelector('.ct-calorieapp-nutrition-body').hidden, true);
  assert.equal(summary.querySelector('[data-ct-nutrition-period="month"]').getAttribute('aria-pressed'), 'true');
  onMessage({ source: trustedFrameWindow, origin: 'https://app.calorietoken.net', data: {...ready, status: 'loading', period: 'month'} });
  assert.match(summary.querySelector('.ct-calorieapp-nutrition-status').textContent, /bijgewerkt/);
  onMessage({ source: trustedFrameWindow, origin: 'https://app.calorietoken.net', data: {...ready, period: 'month'} });
  assert.equal(summary.dataset.state, 'ready');

  onMessage({
    source: trustedFrameWindow,
    origin: 'https://app.calorietoken.net',
    data: { ...ready, locale: 'ar' },
  });
  assert.equal(summary.lang, 'ar');
  assert.equal(summary.dir, 'rtl');

  onMessage({
    source: trustedFrameWindow,
    origin: 'https://app.calorietoken.net',
    data: { ...ready, status: 'signed_out' },
  });
  assert.equal(summary.hidden, true);
  onMessage({ source: trustedFrameWindow, origin: 'https://app.calorietoken.net', data: ready });
  frame.dispatchEvent(new window.Event('load'));
  assert.equal(summary.hidden, true);
});

test('unrelated pages preserve the original account markup and receive no app-only additions', () => {
  const {document,window}=parseHTML(`<!doctype html><html><body><section class="xl-card calorieapp-identity-card xl-no-wallet"><div class="xl-card-body"></div><footer class="xl-card-footer"><div id="ctstyle-account-app"></div></footer></section><iframe title="CalorieApp" src="https://app.calorietoken.net/"></iframe></body></html>`);
  Object.defineProperty(window,'location',{value:new URL('https://calorietoken.net/faq/'),configurable:true});
  Object.defineProperty(document,'readyState',{value:'complete',configurable:true});
  window.setTimeout=()=>0;window.clearTimeout=()=>{};window.scrollTo=()=>{};window.matchMedia=()=>({matches:false});
  const frame=document.querySelector('iframe');Object.defineProperty(frame,'contentWindow',{value:{postMessage(){}}});
  const context=vm.createContext({window,document,URL,MutationObserver:window.MutationObserver,getComputedStyle:()=>({display:'block'}),setTimeout:window.setTimeout,clearTimeout:window.clearTimeout});
  vm.runInContext(appFocusSource,context,{filename:'app-focus.js'});
  vm.runInContext(source,context,{filename:'nutrition-summary.js'});
  assert.equal(document.body.classList.contains('ct-account-compact'),true);
  assert.equal(document.body.classList.contains('ct-calorieapp-page'),false);
  assert.equal(document.getElementById('ct-calorieapp-session-indicator'),null);
  assert.equal(document.getElementById('ct-calorieapp-nutrition-summary'),null);
  assert.equal(document.getElementById('ct-calorieapp-focus-toolbar'),null);
  const liveHotfix=css.indexOf('BEGIN CalorieToken UX regression hotfix 2026-09-16 v4');
  assert.ok(liveHotfix>css.indexOf('body.ct-account-compact .xl-card.calorieapp-identity-card .xl-card-footer{display:none!important}'));
  assert.match(css.slice(liveHotfix),/:is\(\.xl-card-header,\.xl-card-balance,\.xl-card-rank,\.xl-card-footer\) \{\s*display:block!important/);
});

test('CalorieApp embed prepares the resolved language without restarting its first document', () => {
  const {document,window}=parseHTML(`<!doctype html><html lang="nl"><body class="ctstyle-enabled page-id-7880">
    <select id="ctstyle-language-select"><option value="nl" selected>Nederlands</option></select>
    <section><div id="ctstyle-account-app"><div class="ctstyle-account-app-brand">CalorieApp</div></div></section>
    <div data-calorieapp-embed data-locale="en"><div data-calorieapp-frame-stage data-calorieapp-frame-loading="1" aria-busy="true">
      <div data-calorieapp-embed-loading data-loading-ready="1"><strong>CalorieApp is starting</strong><p data-calorieapp-loading-message></p>
        <button data-calorieapp-loading-retry>Try again</button><button data-calorieapp-loading-reveal>Show app</button></div>
      <iframe title="CalorieApp" src="https://app.calorietoken.net/?embedded=1&amp;locale=en"></iframe>
    </div></div>
  </body></html>`);
  Object.defineProperty(window,'location',{value:new URL('https://calorietoken.net/calorieapp/?ui_lang=nl'),configurable:true});
  Object.defineProperty(document,'readyState',{value:'complete',configurable:true});
  const frame=document.querySelector('iframe'),loader=document.querySelector('[data-calorieapp-embed-loading]'),stage=document.querySelector('[data-calorieapp-frame-stage]');
  Object.defineProperty(frame,'contentWindow',{value:{postMessage(){}}});
  let reveals=0;document.querySelector('[data-calorieapp-loading-reveal]').addEventListener('click',()=>{reveals+=1;loader.hidden=true;delete stage.dataset.calorieappFrameLoading;stage.setAttribute('aria-busy','false');});
  window.setTimeout=callback=>{callback();return 1;};window.clearTimeout=()=>{};window.requestAnimationFrame=callback=>{callback(0);return 1;};window.scrollTo=()=>{};window.matchMedia=()=>({matches:false});
  vm.runInContext(appFocusSource,vm.createContext({window,document,URL,MutationObserver:window.MutationObserver,getComputedStyle:()=>({display:'block'}),setTimeout:window.setTimeout,clearTimeout:window.clearTimeout}),{filename:'app-focus.js'});
  assert.equal(document.querySelector('[data-calorieapp-embed]').dataset.locale,'nl');
  assert.equal(new URL(frame.src).searchParams.get('locale'),'en');
  assert.equal(loader.querySelector('strong').textContent,'CalorieApp wordt gestart');
  assert.equal(loader.querySelector('[data-calorieapp-loading-reveal]').textContent,'App tonen');
  assert.equal(reveals,1);
  assert.equal(loader.hidden,true);
  assert.equal(stage.getAttribute('aria-busy'),'false');
});

test('adult account journey opens the original guide as a strict, seed-free dialog bridge', () => {
  const {document, window} = parseHTML(`<!doctype html><html lang="nl"><body class="ctstyle-enabled page-id-7880">
    <section class="xl-card"><div id="ctstyle-account-app"><div class="ctstyle-account-app-brand">CalorieApp</div></div></section>
    <div data-calorieapp-embed><iframe title="CalorieApp" src="https://app.calorietoken.net/?embedded=1"></iframe></div>
    <section id="ctstyle-testnet" data-ctstyle-testnet="1"><h2>Veilige testaccountgids</h2>
      <div id="ctstyle-testnet-step-4"><button id="copy-address">Kopieer adres</button><button id="return-to-app">Terug naar app</button></div>
    </section>
  </body></html>`);
  Object.defineProperty(window, 'location', {value: new URL('https://calorietoken.net/calorieapp/'), configurable: true});
  Object.defineProperty(document, 'readyState', {value: 'complete', configurable: true});
  const frame = document.querySelector('iframe');
  const sent = [];
  const trustedFrameWindow = {postMessage(message, origin) { sent.push({message, origin}); }};
  Object.defineProperty(frame, 'contentWindow', {value: trustedFrameWindow});
  const listeners = new Map();
  const nativeAddEventListener = window.addEventListener.bind(window);
  window.addEventListener = (type, listener, options) => {
    listeners.set(type, listener);
    nativeAddEventListener(type, listener, options);
  };
  let ageBand = 'teen';
  window.CalorieTokenAgeExperience = {getBand: () => ageBand};
  window.setTimeout = callback => { callback(); return 1; };
  window.clearTimeout = () => {};
  window.requestAnimationFrame = callback => { callback(0); return 1; };
  window.scrollTo = () => {};
  window.matchMedia = () => ({matches: false});

  vm.runInContext(appFocusSource, vm.createContext({
    window, document, URL, MutationObserver: window.MutationObserver,
    getComputedStyle: () => ({display: 'block'}),
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
  }), {filename: 'app-focus.js'});

  const layer = document.getElementById('ct-testnet-guide-layer');
  const guide = document.getElementById('ctstyle-testnet');
  assert.ok(layer);
  assert.equal(guide.parentElement.classList.contains('ct-testnet-guide-panel'), true);
  assert.equal(layer.getAttribute('aria-hidden'), 'true');
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [{
    message: {type: 'calorieapp:testnet-guide:available', version: 1},
    origin: 'https://app.calorietoken.net',
  }]);

  const onMessage = listeners.get('message');
  onMessage({source: trustedFrameWindow, origin: 'https://app.calorietoken.net', data: {
    type: 'calorieapp:testnet-guide:open', version: 1, seed: 'forged',
  }});
  assert.equal(document.body.classList.contains('ct-testnet-guide-open'), false);
  onMessage({source: {}, origin: 'https://app.calorietoken.net', data: {
    type: 'calorieapp:testnet-guide:open', version: 1,
  }});
  assert.equal(document.body.classList.contains('ct-testnet-guide-open'), false);
  onMessage({source: trustedFrameWindow, origin: 'https://app.calorietoken.net', data: {
    type: 'calorieapp:testnet-guide:open', version: 1,
  }});
  assert.equal(document.body.classList.contains('ct-testnet-guide-open'), false);
  ageBand = 'adult';
  onMessage({source: trustedFrameWindow, origin: 'https://app.calorietoken.net', data: {
    type: 'calorieapp:testnet-guide:open', version: 1,
  }});
  assert.equal(document.body.classList.contains('ct-testnet-guide-open'), true);
  assert.equal(layer.getAttribute('aria-hidden'), 'false');

  document.getElementById('return-to-app').click();
  assert.equal(document.body.classList.contains('ct-testnet-guide-open'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1))), {
    message: {type: 'calorieapp:testnet-guide:complete', version: 1},
    origin: 'https://app.calorietoken.net',
  });
  assert.deepEqual(Object.keys(sent.at(-1).message).sort(), ['type', 'version']);
});

test('CalorieHelp additions cover all locales and append without replacing existing answers', () => {
  const locales = ['en', 'nl', 'zh-Hans', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'id', 'ur'];
  assert.deepEqual(Object.keys(helpTopics).sort(), locales.sort());
  const copy = {};
  for (const tag of locales) {
    assert.deepEqual(Object.keys(helpTopics[tag]).sort(), ['app', 'test', 'usda']);
    for (const key of ['app', 'test', 'usda']) {
      assert.deepEqual(Object.keys(helpTopics[tag][key]).sort(), ['step', 'text']);
      assert.ok(helpTopics[tag][key].text.trim());
      assert.ok(helpTopics[tag][key].step.trim());
      assert.doesNotMatch(helpTopics[tag][key].text + helpTopics[tag][key].step, /<[^>]+>|https?:\/\//);
    }
    copy[tag] = {
      topics: {
        app: {title: 'Existing app title', text: 'Existing app answer.', steps: ['Existing app step.'], links: ['app']},
        test: {title: 'Existing test title', text: 'Existing test answer.', steps: ['Existing test step.'], links: ['test']},
        usda: {title: 'Existing USDA title', text: 'Existing USDA answer.', steps: ['Existing USDA step.'], links: ['usda']},
      },
    };
  }
  const context = {window: {
    CalorieTokenHelp: {copy},
    CalorieTokenHeadingRepairLabels: helpLabels,
    CalorieTokenHeadingRepairTopics: helpTopics,
    CalorieTokenHeadingRepairAvatar: 'https://calorietoken.net/wp-content/plugins/calorietoken-heading-repair/assets/caloriehelp-mascot-v2.png?ver=1.5.5',
  }};
  vm.runInNewContext(helpBootstrap, context, {filename: 'help-label-bootstrap.js'});
  vm.runInNewContext(helpBootstrap, context, {filename: 'help-label-bootstrap.js'});
  for (const tag of locales) for (const key of ['app', 'test', 'usda']) {
    const topic = copy[tag].topics[key];
    assert.ok(topic.text.startsWith(`Existing ${key === 'usda' ? 'USDA' : key} answer.`));
    assert.equal(topic.text.split(helpTopics[tag][key].text).length - 1, 1);
    assert.equal(topic.steps.filter(step => step === helpTopics[tag][key].step).length, 1);
    assert.deepEqual(topic.links, [key]);
  }
  assert.match(context.window.CalorieTokenHelp.avatar, /caloriehelp-mascot-v2\.png\?ver=1\.5\.5$/);
});

test('language bootstrap resolves URL, saved and browser choices before widgets are built', () => {
  function run({url='https://calorietoken.net/faq/',saved=null,languages=[],language='',html='en'}={}){
    const {document,window}=parseHTML(`<!doctype html><html lang="${html}"><body></body></html>`);
    Object.defineProperty(window,'location',{value:new URL(url),configurable:true});
    let writes=0;
    Object.defineProperty(window,'localStorage',{value:{getItem:()=>saved,setItem(){writes+=1;},removeItem(){writes+=1;}},configurable:true});
    vm.runInContext(languageBootstrap,vm.createContext({window,document,URL,navigator:{languages,language},Date}),{filename:'language-bootstrap.js'});
    return {locale:document.documentElement.lang,direction:document.documentElement.dir,dataset:document.documentElement.dataset.ctDisplayLocale,writes};
  }
  const fresh=Date.now();
  assert.equal(run({url:'https://calorietoken.net/?ui_lang=nl',saved:JSON.stringify({locale:'fr',savedAt:fresh}),languages:['ar']}).locale,'nl');
  assert.equal(run({url:'https://calorietoken.net/?locale=fr',saved:JSON.stringify({locale:'nl',savedAt:fresh}),languages:['ar']}).locale,'fr');
  assert.equal(run({url:'https://calorietoken.net/?ui_lang=made-up',languages:['nl-NL']}).locale,'nl');
  assert.equal(run({saved:JSON.stringify({locale:'fr',savedAt:fresh}),languages:['nl-NL']}).locale,'fr');
  assert.equal(run({languages:['ar-SA'],html:'en'}).direction,'rtl');
  assert.equal(run({languages:['nl-NL'],html:'en'}).dataset,'nl');
  assert.equal(run({languages:[],language:'',html:'xx'}).locale,'nl');
  assert.equal(run({languages:['fr-FR']}).writes,0,'inferred choices are never persisted');
});

test('language bootstrap synchronises only a trusted root and leaves iframe URLs intact', () => {
  const {document,window}=parseHTML(`<!doctype html><html lang="en"><body>
    <div id="trusted" data-calorieapp-embed data-locale="en"><iframe title="CalorieApp" src="https://app.calorietoken.net/?embedded=1&amp;locale=en"></iframe></div>
    <div id="untrusted" data-calorieapp-embed data-locale="en"><iframe title="CalorieApp" src="https://evil.example/?embedded=1&amp;locale=en"></iframe></div>
  </body></html>`);
  Object.defineProperty(window,'location',{value:new URL('https://calorietoken.net/calorieapp/?ui_lang=nl'),configurable:true});
  Object.defineProperty(document,'readyState',{value:'complete',configurable:true});
  Object.defineProperty(window,'localStorage',{value:{getItem:()=>null,setItem(){},removeItem(){}},configurable:true});
  window.setTimeout=callback=>{callback();return 1;};
  const trustedFrame=document.querySelector('#trusted iframe'),trustedSrc=trustedFrame.getAttribute('src');
  vm.runInContext(languageBootstrap,vm.createContext({window,document,URL,navigator:{languages:[],language:''},Date}),{filename:'language-bootstrap.js'});
  assert.equal(document.getElementById('trusted').dataset.locale,'nl');
  assert.equal(trustedFrame.getAttribute('src'),trustedSrc);
  assert.equal(document.getElementById('untrusted').dataset.locale,'en');
});

test('CalorieHelp creates the missing USDA knowledge topic from reviewed local copy', () => {
  const copy=JSON.parse(JSON.stringify(baseHelpData));
  const context={window:{
    CalorieTokenHelp:{copy},CalorieTokenHeadingRepairLabels:helpLabels,
    CalorieTokenHeadingRepairTopics:helpTopics,CalorieTokenHeadingRepairAvatar:'https://calorietoken.net/mascot.png',
  }};
  vm.runInNewContext(helpBootstrap,context,{filename:'help-label-bootstrap.js'});
  for(const tag of Object.keys(copy)){
    const usda=copy[tag].topics.usda;
    assert.ok(usda.title.trim(),tag);
    assert.equal(usda.text,helpTopics[tag].usda.text);
    assert.deepEqual(Array.from(usda.steps),[helpTopics[tag].usda.step]);
    assert.deepEqual(Array.from(usda.links),['usda','foodDiscovery']);
  }
});

test('CalorieHelp renders the open-C mascot and switches compact knowledge by age', () => {
  const copy=JSON.parse(JSON.stringify(baseHelpData));
  const bootstrapContext={window:{
    CalorieTokenHelp:{copy,page:0},CalorieTokenHeadingRepairLabels:helpLabels,
    CalorieTokenHeadingRepairTopics:helpTopics,CalorieTokenHeadingRepairAvatar:'https://calorietoken.net/mascot.png',
  }};
  vm.runInNewContext(helpBootstrap,bootstrapContext,{filename:'help-label-bootstrap.js'});
  const {document,window}=parseHTML(`<!doctype html><html lang="nl"><body class="ctstyle-enabled">
    <aside id="ctstyle-app-launcher"><details><summary><span class="ctstyle-help-icon">?</span><span class="ctstyle-help-caption">CalorieHelp</span></summary>
      <div class="ctstyle-app-launcher-panel"><label for="ctstyle-language-select">Taal</label><select id="ctstyle-language-select"><option value="nl" selected>Nederlands</option></select></div>
    </details></aside></body></html>`);
  Object.defineProperty(window,'location',{value:new URL('https://calorietoken.net/faq/'),configurable:true});
  Object.defineProperty(document,'readyState',{value:'complete',configurable:true});
  let band='child';
  window.CalorieTokenHelp=bootstrapContext.window.CalorieTokenHelp;
  window.CalorieTokenDiscoveryUI={getLocale:()=> 'nl'};
  window.CalorieTokenAgeExperience={getBand:()=>band,copy:()=>({
    childNote:'Openbaar eten zoeken en eenvoudige informatie.',teenNote:'Openbare informatie zonder wallet- of transactietools.',
    safePlaceholder:'Bijvoorbeeld: voeding zoeken of Nutri-Score',moreTopics:'Meer hulponderwerpen',
    helpTitle:'Leeftijdspassende hulp',helpText:'Wallet- en transactiestappen worden niet getoond.',
  })};
  vm.runInContext(helpSource,vm.createContext({window,document,URL}),{filename:'help.js'});
  const widget=document.getElementById('ctstyle-widget-help');
  assert.ok(widget);
  assert.equal(widget.dataset.ctHelpBand,'child');
  assert.equal(widget.querySelector('.ctstyle-help-header .ctstyle-help-avatar').getAttribute('src'),'https://calorietoken.net/mascot.png');
  assert.equal(document.querySelector('.ctstyle-help-icon').classList.contains('ctstyle-help-mascot'),true);
  assert.match(widget.querySelector('input').placeholder,/Nutri-Score/);
  const visibleChild=Array.from(widget.querySelectorAll('button[data-topic]')).filter(button=>!button.hidden).map(button=>button.dataset.topic);
  assert.deepEqual(visibleChild,['app','usda','docs','legal']);
  widget.querySelector('button[data-topic="app"]').click();
  assert.match(widget.querySelector('.ctstyle-help-reply').textContent,/Openbaar eten zoeken/);
  assert.doesNotMatch(widget.querySelector('.ctstyle-help-reply').textContent,/eetdagboek/i);
  const input=widget.querySelector('input');input.value='Wat betekent Nutri-Score?';
  widget.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  assert.match(widget.querySelector('.ctstyle-help-reply').textContent,/USDA/);
  band='adult';window.CalorieTokenHelpUI.refresh('nl');
  assert.equal(widget.dataset.ctHelpBand,'adult');
  assert.match(widget.querySelector('input').placeholder,/testaccount|trustline/i);
  assert.equal(widget.querySelector('.ctstyle-help-more').hidden,false);
  widget.querySelector('button[data-topic="app"]').click();
  assert.match(widget.querySelector('.ctstyle-help-reply').textContent,/eetdagboek/i);
});

test('release stays hash-gated, non-persistent and compact', () => {
  assert.match(php, /Version: 1\.6\.4/);
  assert.match(php, /const VERSION = '1\.6\.4'/);
  assert.match(php, /calorietoken-language-bootstrap/);
  assert.match(php, /asset_url\('language-bootstrap\.js'\), array\(\), VERSION, false/);
  assert.match(php, /calorietoken-age-experience/);
  assert.match(php, /calorietoken-nutrition-summary/);
  assert.match(php, /array\('calorietoken-app-focus'\)/);
  assert.match(source, /event\.source!==frame\.contentWindow/);
  assert.match(source, /allowedOrigins\.includes\(event\.origin\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\s*\(/);
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /\.ct-calorieapp-nutrition-bar\{display:flex/);
  assert.match(css, /body\.ct-calorieapp-page \.xl-card\.calorieapp-identity-card #ctstyle-account-app>\.ctstyle-account-app-brand/);
  assert.match(css, /\.ct-calorieapp-nutrition-periods\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.ct-calorieapp-nutrition-sources\{display:grid;grid-template-columns:1fr/);
  assert.match(css, /\.ct-calorieapp-nutrition-summary\[hidden\]\{display:none!important\}/);
  assert.match(css, /body\[data-ct-age-band="child"\] \.ct-age-financial-action/);
  assert.match(css, /\.ct-age-showcase-note/);
  assert.match(css, /\.ct-age-finance-notice :is\(h1,h2\)/);
  assert.match(css, /BEGIN CalorieToken UX regression hotfix 2026-09-16 v4/);
  assert.match(css, /@media \(max-width:1050px\)/);
  assert.match(css, /data-calorieapp-scroll="top"/);
  assert.match(css, /data-calorieapp-scroll="bottom"/);
  assert.match(appFocusSource, /calorieapp:testnet-guide:/);
  assert.match(appFocusSource, /\[data-calorieapp-embed\] iframe\[title="CalorieApp"\]/);
  assert.match(appFocusSource, /url\.pathname==='\/'/);
  assert.doesNotMatch(appFocusSource, /frame\.src\s*=/);
  assert.match(languageBootstrap, /function syncEmbeds\(\)/);
  assert.match(languageBootstrap, /root\.dataset\.locale=locale/);
  assert.match(appFocusSource, /data-calorieapp-loading-reveal/);
  assert.match(appFocusSource, /event\.stopPropagation\(\)/);
  assert.match(appFocusSource, /if\(age!=='adult'/);
  assert.match(appFocusSource, /exactGuideMessage\(event\.data,'open'\)/);
  assert.match(appFocusSource, /postMessage\(\{type:guidePrefix\+type,version:1\}/);
  assert.doesNotMatch(appFocusSource, /postMessage\([^)]*(?:seed|secret|address|account)/i);
  assert.match(css, /\.ct-testnet-guide-layer\{display:none;position:fixed/);
  assert.match(css, /body\.ct-testnet-guide-open \.ct-testnet-guide-layer\{display:grid\}/);
  assert.match(css, /body\.ct-calorieapp-page #ctstyle-testnet\[data-ctstyle-testnet="1"\]\{display:none!important\}/);
  assert.match(css, /body\.ct-testnet-guide-open \.ct-testnet-guide-panel>#ctstyle-testnet\{display:block!important/);
  assert.match(readme, /not an overall nutrition or health assessment/i);
  assert.match(readme, /Nothing is stored in\s+WordPress or browser storage/i);
  assert.match(php, /help-topic-additions\.json/);
  assert.match(php, /caloriehelp-mascot-v2\.png/);
  for (const asset of ['app-integration','blog-timeline','discovery','menu-pages','ready-languages','testnet','tokenomics']) {
    assert.match(php, new RegExp(`source_matches\\('assets/${asset}\\.js'`));
    assert.match(php, new RegExp(`site-${asset}\\.js`));
  }
  assert.equal(mascot.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(mascot.readUInt32BE(16), 512);
  assert.equal(mascot.readUInt32BE(20), 512);
  assert.match(helpSource, /ageSafety/);
  assert.match(helpSource, /adultOnlyTopics/);
  assert.match(helpSource, /ctstyle-help-more/);
  assert.match(helpSource, /safePlaceholder/);
  assert.match(helpSource, /details\.dataset\.topic=key/);
  assert.match(css, /width:min\(440px,calc\(100vw - 24px\)\)/);
  assert.match(css, /\.ctstyle-help-mascot>/);
});
