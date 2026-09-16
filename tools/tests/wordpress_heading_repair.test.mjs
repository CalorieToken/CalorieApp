import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { parseHTML } = require('linkedom');
const root = new URL('../../wordpress-plugins/calorietoken-heading-repair/', import.meta.url);
const source = fs.readFileSync(new URL('assets/nutrition-summary.js', root), 'utf8');
const css = fs.readFileSync(new URL('assets/app-focus.css', root), 'utf8');
const php = fs.readFileSync(new URL('calorietoken-heading-repair.php', root), 'utf8');
const readme = fs.readFileSync(new URL('README.txt', root), 'utf8');
const helpBootstrap = fs.readFileSync(new URL('assets/help-label-bootstrap.js', root), 'utf8');
const helpLabels = JSON.parse(fs.readFileSync(new URL('assets/help-link-labels.json', root), 'utf8'));
const helpTopics = JSON.parse(fs.readFileSync(new URL('assets/help-topic-additions.json', root), 'utf8'));

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

test('summary renders inside the existing Xaman card and clears stale data', () => {
  const { document, window } = parseHTML(`<!doctype html><html lang="nl"><body>
    <section class="xl-card"><div id="ctstyle-account-app"></div></section>
    <iframe title="CalorieApp" src="https://app.calorietoken.net/"></iframe>
  </body></html>`);
  const frame = document.querySelector('iframe');
  const sent = [];
  const trustedFrameWindow = { postMessage(message, origin) { sent.push({message, origin}); } };
  Object.defineProperty(frame, 'contentWindow', { value: trustedFrameWindow });
  Object.defineProperty(window, 'location', {
    value: new URL('https://calorietoken.net/usecases/'),
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
  assert.equal(summary.parentElement.id, 'ctstyle-account-app');
  assert.ok(summary.closest('.xl-card'));
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

test('CalorieHelp additions cover all locales and append without replacing existing answers', () => {
  const locales = ['en', 'nl', 'zh-Hans', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'id', 'ur'];
  assert.deepEqual(Object.keys(helpTopics).sort(), locales.sort());
  const copy = {};
  for (const tag of locales) {
    assert.deepEqual(Object.keys(helpTopics[tag]).sort(), ['app', 'usda']);
    for (const key of ['app', 'usda']) {
      assert.deepEqual(Object.keys(helpTopics[tag][key]).sort(), ['step', 'text']);
      assert.ok(helpTopics[tag][key].text.trim());
      assert.ok(helpTopics[tag][key].step.trim());
      assert.doesNotMatch(helpTopics[tag][key].text + helpTopics[tag][key].step, /<[^>]+>|https?:\/\//);
    }
    copy[tag] = {
      topics: {
        app: {title: 'Existing app title', text: 'Existing app answer.', steps: ['Existing app step.'], links: ['app']},
        usda: {title: 'Existing USDA title', text: 'Existing USDA answer.', steps: ['Existing USDA step.'], links: ['usda']},
      },
    };
  }
  const context = {window: {
    CalorieTokenHelp: {copy},
    CalorieTokenHeadingRepairLabels: helpLabels,
    CalorieTokenHeadingRepairTopics: helpTopics,
  }};
  vm.runInNewContext(helpBootstrap, context, {filename: 'help-label-bootstrap.js'});
  vm.runInNewContext(helpBootstrap, context, {filename: 'help-label-bootstrap.js'});
  for (const tag of locales) for (const key of ['app', 'usda']) {
    const topic = copy[tag].topics[key];
    assert.ok(topic.text.startsWith(`Existing ${key === 'app' ? 'app' : 'USDA'} answer.`));
    assert.equal(topic.text.split(helpTopics[tag][key].text).length - 1, 1);
    assert.equal(topic.steps.filter(step => step === helpTopics[tag][key].step).length, 1);
    assert.deepEqual(topic.links, [key]);
  }
});

test('release stays hash-gated, non-persistent and compact', () => {
  assert.match(php, /Version: 1\.4\.0/);
  assert.match(php, /const VERSION = '1\.4\.0'/);
  assert.match(php, /calorietoken-nutrition-summary/);
  assert.match(php, /array\('calorietoken-app-focus'\)/);
  assert.match(source, /event\.source!==frame\.contentWindow/);
  assert.match(source, /allowedOrigins\.includes\(event\.origin\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\s*\(/);
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /\.ct-calorieapp-nutrition-periods\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.ct-calorieapp-nutrition-sources\{display:grid;grid-template-columns:1fr/);
  assert.match(css, /\.ct-calorieapp-nutrition-summary\[hidden\]\{display:none!important\}/);
  assert.match(readme, /not an overall nutrition or health assessment/i);
  assert.match(readme, /Nothing is stored in\s+WordPress or browser storage/i);
  assert.match(php, /help-topic-additions\.json/);
});
