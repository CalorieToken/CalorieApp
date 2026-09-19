import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../../frontend/lib/nutritionSummaryBridge.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function load(referrer = 'https://calorietoken.net/index.php/calorieapp/') {
  const sent = [];
  const parent = { postMessage(message, origin) { sent.push({message, origin}); } };
  const window = { parent };
  const module = {exports: {}};
  vm.runInNewContext(code, {
    module, exports: module.exports, URL,
    window, document: {referrer},
  });
  return {bridge: module.exports, sent, parent, window};
}

const overview = {
  count: 7,
  grades: {A: 2, B: 1, C: 0, D: 0, E: 1},
  sources: {open_food_facts: 5, usda: 1, other: 1},
};

test('ready summary contains only bounded aggregate product-grade counts', () => {
  const {bridge} = load();
  const message = bridge.nutritionSummaryMessage({
    authenticated: true, loading: false, unavailable: false,
    locale: 'nl', period: 'week', overview,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(message)), {
    type: 'calorieapp:nutrition-summary', version: 1, locale: 'nl', period: 'week',
    status: 'ready', total: 7, known: 4, missing: 1,
    counts: {A: 2, B: 1, C: 0, D: 0, E: 1},
    sources: {open_food_facts: 5, usda: 1, other: 1},
  });
  for (const forbidden of ['entries', 'calories', 'protein', 'account', 'wallet', 'date']) {
    assert.equal(Object.hasOwn(message, forbidden), false, forbidden);
  }
});

test('signed out, loading and unavailable states never retain private counts', () => {
  const {bridge} = load();
  for (const input of [
    {authenticated: false, loading: false, unavailable: false},
    {authenticated: true, loading: true, unavailable: false},
    {authenticated: true, loading: false, unavailable: true},
  ]) {
    const message = bridge.nutritionSummaryMessage({...input, locale: 'en', period: 'day', overview});
    assert.equal(Object.hasOwn(message, 'counts'), false);
    assert.equal(Object.hasOwn(message, 'total'), false);
  }
});

test('malformed totals, grade counts, source splits and over-coverage fail closed', () => {
  const {bridge} = load();
  for (const candidate of [
    {...overview, count: 1.5},
    {...overview, grades: {...overview.grades, A: -1}},
    {...overview, count: 2},
    {...overview, count: 100001},
    {...overview, sources: {...overview.sources, usda: -1}},
    {...overview, sources: {...overview.sources, other: 2}},
    {...overview, sources: {...overview.sources, open_food_facts: 3}},
  ]) {
    const message = bridge.nutritionSummaryMessage({authenticated: true, loading: false, unavailable: false, locale: 'en', period: 'day', overview: candidate});
    assert.equal(message.status, 'unavailable');
    assert.equal(Object.hasOwn(message, 'counts'), false);
  }
});

test('summary posts only to an exact approved parent origin', () => {
  const approved = load('https://www.calorietoken.net/calorieapp/');
  const message = approved.bridge.nutritionSummaryMessage({authenticated: true, loading: false, unavailable: false, locale: 'en', period: 'all', overview});
  assert.equal(approved.bridge.postNutritionSummaryToParent(message), true);
  assert.equal(approved.sent.length, 1);
  assert.equal(approved.sent[0].origin, 'https://www.calorietoken.net');

  for (const referrer of ['', 'https://example.com/calorieapp/', 'javascript:alert(1)']) {
    const blocked = load(referrer);
    assert.equal(blocked.bridge.postNutritionSummaryToParent(message), false);
    assert.equal(blocked.sent.length, 0);
  }
});

test('period presets are accepted only from the exact WordPress parent and contain no date', () => {
  const approved = load('https://calorietoken.net/calorieapp/');
  for (const period of ['day', 'week', 'month', 'all']) {
    const event = {
      source: approved.parent,
      origin: 'https://calorietoken.net',
      data: {type: 'calorieapp:nutrition-period', version: 1, period},
    };
    assert.equal(approved.bridge.nutritionPeriodFromParent(event), period);
    assert.equal(Object.hasOwn(event.data, 'date'), false);
  }
  for (const event of [
    {source: approved.parent, origin: 'https://evil.example', data: {type: 'calorieapp:nutrition-period', version: 1, period: 'week'}},
    {source: {}, origin: 'https://calorietoken.net', data: {type: 'calorieapp:nutrition-period', version: 1, period: 'week'}},
    {source: approved.parent, origin: 'https://calorietoken.net', data: {type: 'calorieapp:nutrition-period', version: 1, period: 'year'}},
    {source: approved.parent, origin: 'https://calorietoken.net', data: {type: 'calorieapp:nutrition-period', version: 2, period: 'week'}},
  ]) assert.equal(approved.bridge.nutritionPeriodFromParent(event), null);
});

test('the food screen publishes the summary from the authenticated diary state', () => {
  const component = readFileSync(new URL('../../frontend/components/FoodSearchPlaceholder.tsx', import.meta.url), 'utf8');
  assert.match(component, /postNutritionSummaryToParent\(nutritionSummaryMessage\(/);
  assert.match(component, /authenticated:\s*diaryAuthenticatedRef\.current/);
  assert.match(component, /unavailable:\s*Boolean\(logError/);
  assert.match(component, /nutritionPeriodFromParent\(event\)/);
  assert.match(component, /setDiaryDate\(localDiaryDate\(\)\)|const today = localDiaryDate\(\)/);
});
