import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const {parseHTML} = require('linkedom');
const assets = new URL('../../wordpress-plugins/calorietoken-site-style/assets/', import.meta.url);
const source = readFileSync(new URL('testnet.js', assets), 'utf8');
const copy = JSON.parse(readFileSync(new URL('testnet-data.json', assets), 'utf8'));
// Shape-only placeholders with invalid checksums: no real wallet or network is used.
const address = 'r' + '1'.repeat(25), secret = 's' + '2'.repeat(24);
const accountReply = () => ({account: {classicAddress: address, secret}});
const response = (data = accountReply(), {status = 200, type = 'application/json', json} = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: {get: name => name === 'content-type' ? type : null},
  json: json || (async () => data),
});
const deferred = () => {let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};};
const settle = async () => {await new Promise(setImmediate);};

function fixture({fetch = async () => response(), locale = 'nl', url = 'https://calorietoken.net/index.php/calorieapp/', bodyClass = 'ctstyle-enabled page-id-7880'} = {}) {
  const {document, window: dom} = parseHTML(`<html lang="${locale}"><head></head><body class="${bodyClass}"><section id="ctstyle-testnet" data-ctstyle-testnet="1" lang="${locale}"><div class="ctstyle-test-steps"></div></section></body></html>`);
  const requests = [], sockets = [], timers = new Map(), events = new Map(), clipboard = [];
  let sequence = 0;
  const forbidden = () => {throw new Error('Unexpected storage, logging or message transport');};
  class Socket {
    constructor(url) {this.url = url; this.sent = []; this.closed = false; sockets.push(this);}
    send(text) {this.sent.push(JSON.parse(text));}
    close() {this.closed = true;}
    open() {this.onopen?.();}
    message(data) {this.onmessage?.({data: JSON.stringify(data)});}
    fail() {this.onerror?.();}
  }
  const window = {
    location: new URL(url),
    CalorieTokenDiscovery: {page: 7880, testCopy: copy},
    fetch: (url, options) => {requests.push({url, options}); return fetch(url, options);},
    AbortController, WebSocket: Socket,
    setTimeout(fn, delay) {const id = ++sequence; timers.set(id, {fn, delay}); return id;},
    clearTimeout: id => timers.delete(id),
    addEventListener(name, fn) {events.set(name, [...events.get(name) || [], fn]);},
    postMessage: forbidden,
  };
  Object.defineProperties(window, {localStorage: {get: forbidden}, sessionStorage: {get: forbidden}});
  vm.runInNewContext(source, {window, document, URL,
    console: {log: forbidden, error: forbidden, warn: forbidden, debug: forbidden},
    navigator: {clipboard: {writeText: async text => {clipboard.push(text);}}, sendBeacon: forbidden},
  });
  document.dispatchEvent(new dom.Event('DOMContentLoaded'));
  const query = selector => document.querySelector(selector);
  return {document, window, requests, sockets, timers, clipboard, query,
    click(selector) {const node = query(selector); assert.ok(node, selector); node.dispatchEvent(new dom.Event('click'));},
    clickCopy(key) {const node = [...document.querySelectorAll('button')].find(node => node.textContent === copy[locale][key]); assert.ok(node, key); node.dispatchEvent(new dom.Event('click'));},
    status: () => query('.ctstyle-discovery-status')?.textContent,
    emit(name) {for (const fn of events.get(name) || []) fn();},
    expire(delay) {for (const [id, timer] of [...timers]) if (timer.delay === delay) {timers.delete(id); timer.fn();}},
    funded(socket = sockets.at(-1)) {socket.open(); socket.message({id: 1, status: 'success', result: {validated: true, account_data: {Account: address, Balance: '10000000'}}});},
  };
}

test('Creating an account requires a click and sends one minimal, credential-free Testnet POST', async () => {
  const pending = deferred(), h = fixture({fetch: () => pending.promise});
  assert.equal(h.requests.length, 0);
  h.window.CalorieTokenTestnet.refresh('nl'); h.emit('load');
  assert.equal(h.requests.length, 0);
  h.click('#ctstyle-testnet-create-button'); h.click('#ctstyle-testnet-create-button');
  assert.equal(h.requests.length, 1, 'A second click while waiting cannot create another account');
  const {url, options} = h.requests[0];
  assert.equal(url, 'https://faucet.altnet.rippletest.net/accounts');
  assert.equal(options.method, 'POST'); assert.equal(options.mode, 'cors');
  assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
  assert.equal(options.referrerPolicy, 'no-referrer'); assert.equal(options.cache, 'no-store');
  assert.equal(options.body, undefined, 'Creating a fresh account needs no destination or metadata');
  assert.equal(options.headers, undefined, 'Do not force an unnecessary JSON preflight');
  pending.resolve(response()); await settle();
  h.funded(); await settle();
  assert.equal(h.status(), copy.nl.funded);
  assert.equal(h.timers.size, 0);
});

test('Both documented address fields are accepted and funding is independently checked on Testnet', async () => {
  for (const field of ['classicAddress', 'address']) {
    const h = fixture({fetch: async () => response({account: {[field]: address, secret}})});
    h.click('#ctstyle-testnet-create-button'); await settle();
    assert.equal(h.status(), copy.nl.checking);
    assert.equal(h.query('#ctstyle-testnet-secret').textContent, '');
    assert.equal(h.clipboard.length, 0);
    const socket = h.sockets[0]; assert.equal(socket.url, 'wss://s.altnet.rippletest.net:51233/');
    h.funded(); await settle();
    assert.deepEqual(socket.sent, [{id: 1, command: 'account_info', account: address, ledger_index: 'validated', strict: true}]);
    assert.equal(socket.closed, true); assert.equal(h.status(), copy.nl.funded);
    h.click('#ctstyle-testnet-create-button'); assert.equal(h.requests.length, 1);
    h.clickCopy('next'); h.clickCopy('show');
    assert.equal(h.query('#ctstyle-testnet-secret').textContent, secret);
    h.clickCopy('next'); assert.equal(h.query('#ctstyle-testnet-secret').textContent, '');
    assert.equal([...h.document.querySelectorAll('a')].some(node => node.href.includes(secret) || node.href.includes(address)), false);
  }
});

test('An unconfirmed balance retains the account and Check test XRP never calls the faucet again', async () => {
  const h = fixture(); h.click('#ctstyle-testnet-create-button'); await settle();
  h.sockets[0].fail(); await settle();
  assert.equal(h.status(), copy.nl.pending);
  assert.equal(h.query('#ctstyle-testnet-address').textContent, address);
  h.clickCopy('check'); await settle(); h.funded(); await settle();
  assert.equal(h.requests.length, 1); assert.equal(h.sockets.length, 2);
  assert.equal(h.status(), copy.nl.funded);
});

test('A rejected browser request reports a connection problem without claiming the faucet returned an error', async () => {
  const h = fixture({fetch: async () => {throw new TypeError('Failed to fetch');}});
  h.click('#ctstyle-testnet-create-button'); await settle();
  assert.equal(h.status(), copy.nl.connectionFailed);
  assert.notEqual(h.status(), copy.nl.failed);
  assert.equal(h.query('#ctstyle-testnet-create-button').disabled, false);
  assert.equal(h.query('.ctstyle-testnet-result').hidden, true);
  assert.equal(h.query('a[href="https://xrpl.org/resources/dev-tools/xrp-faucets"]').hidden, false);
  assert.equal(h.requests.length, 1); assert.equal(h.sockets.length, 0); assert.equal(h.timers.size, 0);
});

test('The request timeout aborts once, reports an unknown outcome and never retries automatically', async () => {
  const h = fixture({fetch: (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once: true});
  })});
  h.click('#ctstyle-testnet-create-button'); h.expire(25000); await settle();
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.status(), copy.nl.timedOut); assert.equal(h.requests.length, 1);
  assert.equal(h.sockets.length, 0); assert.equal(h.timers.size, 0);
});

test('An account body delivered after the deadline is not exposed or verified', async () => {
  const body = deferred(), h = fixture({fetch: async () => response(null, {json: () => body.promise})});
  h.click('#ctstyle-testnet-create-button'); await settle();
  h.expire(25000); body.resolve(accountReply()); await settle();
  assert.equal(h.status(), copy.nl.timedOut);
  assert.equal(h.query('#ctstyle-testnet-address').textContent, '');
  assert.equal(h.query('#ctstyle-testnet-secret').textContent, '');
  assert.equal(h.sockets.length, 0);
});

test('HTML, malformed JSON and incomplete account data produce an unusable-response message without showing partial credentials', async () => {
  const cases = [
    response(null, {type: 'text/html'}),
    response(null, {json: async () => {throw new SyntaxError('Malformed JSON');}}),
    response(null), response({account: {classicAddress: address}}),
    response({account: {classicAddress: '<script>bad</script>', secret}}),
    response({account: {classicAddress: address, secret: ''}}),
  ];
  for (const reply of cases) {
    const h = fixture({fetch: async () => reply});
    h.click('#ctstyle-testnet-create-button'); await settle();
    assert.equal(h.status(), copy.nl.invalidResponse);
    assert.equal(h.query('#ctstyle-testnet-address').textContent, '');
    assert.equal(h.query('#ctstyle-testnet-secret').textContent, '');
    assert.equal(h.sockets.length, 0); assert.equal(h.timers.size, 0);
  }
});

test('Rate limiting remains distinct from other HTTP failures and response bodies are not displayed', async () => {
  for (const [code, key] of [[429, 'limited'], [403, 'failed'], [503, 'failed']]) {
    const h = fixture({fetch: async () => response(null, {status: code, json: async () => {throw new Error('An error body must not be read');}})});
    h.click('#ctstyle-testnet-create-button'); await settle();
    assert.equal(h.status(), copy.nl[key]); assert.equal(h.requests.length, 1);
    assert.equal(h.query('.ctstyle-testnet-result').hidden, true);
  }
});

test('Leaving the page aborts creation and an old response cannot overwrite a new visit', async () => {
  const old = deferred(), latest = deferred(); let calls = 0;
  const h = fixture({fetch: () => (++calls === 1 ? old : latest).promise});
  h.click('#ctstyle-testnet-create-button'); h.emit('pagehide');
  assert.equal(h.requests[0].options.signal.aborted, true);
  h.emit('pageshow'); h.click('#ctstyle-testnet-create-button');
  old.resolve(response()); await settle();
  assert.equal(h.status(), copy.nl.creating); assert.equal(h.query('#ctstyle-testnet-address').textContent, '');
  latest.reject(new TypeError('Failed to fetch')); await settle();
  assert.equal(h.status(), copy.nl.connectionFailed); assert.equal(h.sockets.length, 0);
});

test('Leaving the page clears revealed credentials and cancels the independent balance check', async () => {
  const h = fixture(); h.click('#ctstyle-testnet-create-button'); await settle();
  h.clickCopy('next'); h.clickCopy('show');
  assert.equal(h.query('#ctstyle-testnet-secret').textContent, secret);
  h.emit('pagehide'); await settle();
  assert.equal(h.sockets[0].closed, true); assert.equal(h.timers.size, 0);
  h.emit('pageshow');
  assert.equal(h.query('#ctstyle-testnet-address').textContent, '');
  assert.equal(h.query('#ctstyle-testnet-secret').textContent, '');
  assert.equal(h.query('.ctstyle-testnet-result').hidden, true);
  assert.equal(h.status(), copy.nl.ready);
});

test('Only a validated positive balance for the returned account can be reported as funded', async () => {
  for (const result of [
    {validated: false, account_data: {Account: address, Balance: '10000000'}},
    {validated: true, account_data: {Account: 'r' + '3'.repeat(25), Balance: '10000000'}},
    {validated: true, account_data: {Account: address, Balance: '0'}},
    {validated: true, account_data: {Account: address, Balance: 10000000}},
  ]) {
    const h = fixture(); h.click('#ctstyle-testnet-create-button'); await settle();
    h.sockets[0].message({id: 1, status: 'success', result}); await settle();
    assert.equal(h.status(), copy.nl.pending); assert.equal(h.requests.length, 1);
  }
  const h = fixture(); h.click('#ctstyle-testnet-create-button'); await settle();
  h.expire(15000); await settle();
  assert.equal(h.status(), copy.nl.pending); assert.equal(h.sockets[0].closed, true);
});

test('Account creation stays absent outside the permitted public app page', () => {
  for (const options of [
    {url: 'https://calorietoken.net/index.php/calorieapp/?preview=1'},
    {url: 'https://calorietoken.net/index.php/blog/'},
    {url: 'https://example.org/index.php/calorieapp/'},
    {bodyClass: 'ctstyle-enabled page-id-7880 brz-ed'},
    {bodyClass: 'page-id-7880'},
  ]) {
    const h = fixture(options); assert.equal(h.query('#ctstyle-testnet-create-button'), null);
    assert.equal(h.requests.length, 0);
  }
});

test('All eleven languages explain each failure state and a language change retains that state', async () => {
  const h = fixture({fetch: async () => {throw new TypeError('Failed to fetch');}});
  h.click('#ctstyle-testnet-create-button'); await settle();
  assert.equal(Object.keys(copy).length, 11);
  for (const [locale, words] of Object.entries(copy)) {
    for (const key of ['connectionFailed', 'timedOut', 'invalidResponse', 'failed', 'limited']) {
      assert.equal(typeof words[key], 'string', `${locale}.${key}`); assert.ok(words[key].trim());
    }
    h.window.CalorieTokenTestnet.refresh(locale);
    assert.equal(h.status(), words.connectionFailed);
  }
  assert.equal(h.requests.length, 1);
});
