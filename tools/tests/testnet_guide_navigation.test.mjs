import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './wordpress_testnet_onboarding.test.mjs';

const implementation = readFileSync(new URL('../../wordpress-plugins/calorietoken-heading-repair/assets/site-testnet.js', import.meta.url), 'utf8');
const settle = async () => new Promise(setImmediate);

test('test setup has four reachable steps, returns to creation without another account and conceals recovery data', async () => {
  const h = fixture({implementation});
  const active = () => h.query('[role="tab"][aria-selected="true"]').id;
  assert.equal(active(), 'ctstyle-testnet-tab-1');
  assert.equal(h.query('#ctstyle-testnet-tab-2').disabled, true);
  assert.equal(h.query('.ctstyle-testnet-navigation button').disabled, true);
  h.click('#ctstyle-testnet-create-button'); await settle();
  h.funded(); await settle();
  assert.equal(active(), 'ctstyle-testnet-tab-2');
  h.clickCopy('previous');
  assert.equal(active(), 'ctstyle-testnet-tab-1');
  assert.equal(h.query('.ctstyle-testnet-welcome').hidden, false);
  assert.equal(h.query('#ctstyle-testnet-create-button').hidden, true);
  h.clickCopy('next');
  h.clickCopy('next');
  assert.equal(active(), 'ctstyle-testnet-tab-3');
  h.clickCopy('show');
  assert.notEqual(h.query('#ctstyle-testnet-secret').textContent, '');
  h.clickCopy('previous');
  assert.equal(h.query('#ctstyle-testnet-secret').textContent, '');
  h.click('#ctstyle-testnet-tab-4');
  assert.equal(active(), 'ctstyle-testnet-tab-4');
  h.click('#ctstyle-testnet-tab-3'); h.clickCopy('show');
  h.window.CalorieTokenTestnet.conceal();
  assert.equal(h.query('#ctstyle-testnet-secret').textContent, '');
  assert.equal(h.requests.length, 1);
  assert.ok([...h.storage.values()].every(value => !value.includes('address') && !value.includes('secret')));
});
