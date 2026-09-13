import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../../wordpress-plugins/calorietoken-site-style/assets/app-integration.js', import.meta.url), 'utf8');
const origins = ['https://app.calorietoken.net', 'https://calorieapp-frontend.onrender.com'];

function adapter(src, count = 1, initialPermission = "") {
  const events = new Map(), sent = [], frameWindow = {};
  const attributes = new Map(initialPermission ? [["allow", initialPermission]] : []);
  const frame = { src, contentWindow: frameWindow, closest: () => null, getAttribute: key => attributes.get(key) ?? null, setAttribute: (key, value) => attributes.set(key, value) };
  frameWindow.postMessage = (data, origin) => sent.push({ data, origin });
  let host, scrolls = 0;
  const disclosure = {open:false};
  const guide = { scrollIntoView: () => {assert.equal(disclosure.open,true);scrolls++;}, querySelector: selector => selector==='.ctstyle-testnet-disclosure'?disclosure:null };
  const document = {
    body: { matches: () => true }, readyState: 'complete',
    querySelector: selector => selector.startsWith('#ctstyle-testnet') ? guide : null,
    querySelectorAll: () => Array.from({ length: count }, () => frame),
    addEventListener: () => {},
  };
  const window = {
    location: new URL('https://calorietoken.net/index.php/calorieapp/'),
    crypto: { randomUUID: () => 'test-display-host-1234567890' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: (name, fn) => events.set(name, fn),
    CalorieTokenDiscovery: { page: 7880, copy: { en: {}, nl: {} } },
    CalorieTokenDiscoveryUI: { getLocale: () => 'en', setLocale: () => {} },
    CalorieAppDisplayLanguage: {
      createStore: () => ({ get: () => ({ locale: 'en' }), valid: () => false, subscribe: () => {}, select: () => {} }),
      connectHost: options => { host = options; },
    },
  };
  runInNewContext(source, { window, document, URL });
  return { frame, frameWindow, host, sent, disclosure, scrolls: () => scrolls,
    message: (origin, sourceWindow = frameWindow, extra = {}) => events.get('message')({
      origin, source: sourceWindow, data: { type: 'calorieapp:testnet-guide:open', version: 1, ...extra },
    }),
  };
}

for (const origin of origins) {
  test(`Display host uses the actual ${origin} iframe origin`, () => {
    const src = origin + '/?embedded=1&locale=en';
    const h = adapter(src), peers = h.host.frames();
    assert.equal(peers.length, 1);
    assert.equal(peers[0].origin, origin);
    assert.equal(peers[0].window, h.frameWindow);
    assert.equal(h.sent.length, 1);
    assert.equal(h.sent[0].origin, origin);
    h.message(origin);
    assert.equal(h.scrolls(), 1);
    assert.equal(h.disclosure.open,true,'The app guide button opens the collapsed website block before scrolling');
    assert.equal(h.frame.src, src, 'display messages do not reload or rewrite login parameters');
  });
}

test('Untrusted destinations, credentials and non-root paths cannot receive display messages', () => {
  for (const src of [
    'https://app.calorietoken.net.evil.example/', 'https://evil.example/',
    'http://app.calorietoken.net/', 'https://app.calorietoken.net:444/',
    'https://user@app.calorietoken.net/', 'https://app.calorietoken.net/other/',
  ]) {
    const h = adapter(src);
    assert.equal(h.host.frames().length, 0, src);
    assert.equal(h.sent.length, 0, src);
    h.message(new URL(src).origin);
    assert.equal(h.scrolls(), 0, src);
  }
});

test('Missing or duplicate app frames cannot establish the display channel', () => {
  for (const count of [0, 2]) {
    const h = adapter(origins[0] + '/', count);
    assert.equal(h.host.frames().length, 0);
    assert.equal(h.sent.length, 0);
  }
});

test('A known origin still needs the actual current iframe window and exact guide message', () => {
  const h = adapter(origins[0] + '/');
  h.message(origins[1]);
  h.message(origins[0], {});
  h.message(origins[0], h.frameWindow, { account: 'forged' });
  assert.equal(h.scrolls(), 0);
  assert.equal(h.disclosure.open,false);
  h.frame.contentWindow = {};
  h.message(origins[0]);
  assert.equal(h.scrolls(), 0, 'retired iframe window is rejected');
});

for (const origin of origins) test(`Camera delegation is limited to ${origin}`, () => {
  const h = adapter(origin + '/?embedded=1');
  assert.equal(h.frame.getAttribute('allow'), 'camera ' + origin);
  const restricted = adapter(origin + '/', 1, "camera 'none'; fullscreen 'self'");
  assert.equal(restricted.frame.getAttribute('allow'), "camera 'none'; fullscreen 'self'");
  const other = adapter(origin + '/', 1, "fullscreen 'self'");
  assert.equal(other.frame.getAttribute('allow'), "fullscreen 'self'; camera " + origin);
});

test('An unrelated or duplicate iframe never receives camera permission', () => {
  for (const h of [adapter('https://evil.example/'), adapter(origins[0] + '/', 2)]) {
    assert.equal(h.frame.getAttribute('allow'), null);
  }
});
