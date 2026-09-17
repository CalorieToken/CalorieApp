import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { parseHTML } = require('linkedom');
const source = fs.readFileSync(
  new URL('../../wordpress-plugins/calorietoken-heading-repair/assets/site-session-repair.js', import.meta.url),
  'utf8',
);

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function captureMessages(window) {
  const listeners = [];
  const nativeAddEventListener = window.addEventListener.bind(window);
  window.addEventListener = (type, listener, options) => {
    if (type === 'message') listeners.push(listener);
    return nativeAddEventListener(type, listener, options);
  };
  return listeners;
}

test('legacy and clean CalorieApp paths resume the same QR login intent', () => {
  const { document, window } = parseHTML(`<!doctype html><html><body>
    <div data-calorieapp-site-integration
      data-app-origin="https://app.calorietoken.net"
      data-frame-src="https://app.calorietoken.net/?embedded=1&amp;locale=nl"
      data-app-page="https://calorietoken.net/index.php/calorieapp/"
      data-startup-url="https://calorieapp-backend-rvul.onrender.com/health?resume_login=true"
      data-locale="nl"></div>
    <section class="xl-card"><a id="qr-login" href="https://calorietoken.net/?xl-signin=1">QR</a></section>
    <div data-calorieapp-embed data-app-origin="https://app.calorietoken.net" data-locale="nl">
      <iframe class="calorieapp-embed-frame"></iframe>
    </div>
  </body></html>`);
  Object.defineProperty(window, 'location', {
    value: new URL('https://calorietoken.net/calorieapp/'),
    configurable: true,
  });
  Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
  const sessionStorage = storage();
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorage, configurable: true });
  sessionStorage.setItem('calorieapp-site-login-return', JSON.stringify({
    startedAt: Date.now(),
    siteOrigin: 'https://calorietoken.net',
    appOrigin: 'https://app.calorietoken.net',
    pathname: '/index.php/calorieapp/',
    locale: 'nl',
  }));
  const frame = document.querySelector('iframe');
  const sent = [];
  const frameWindow = { postMessage(message, origin) { sent.push({ message, origin }); } };
  Object.defineProperty(frame, 'contentWindow', { value: frameWindow });
  const messageListeners = captureMessages(window);

  vm.runInContext(source, vm.createContext({ window, document, URL }), {
    filename: 'site-session-repair.js',
  });

  assert.equal(document.getElementById('qr-login').href, 'https://calorietoken.net/calorieapp/');
  assert.equal(sessionStorage.getItem('calorieapp-site-login-return'), null);
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [{
    message: { type: 'calorieapp:bridge:init', locale: 'nl' },
    origin: 'https://app.calorietoken.net',
  }]);

  for (const listener of messageListeners) {
    listener({
      origin: 'https://app.calorietoken.net',
      source: frameWindow,
      data: { type: 'calorieapp:bridge:initialized', locale: 'nl' },
    });
  }
  assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1))), {
    message: { type: 'calorieapp:login:trigger', locale: 'nl' },
    origin: 'https://app.calorietoken.net',
  });
});

test('site-wide logout keeps a loadable bridge for the complete bounded window', () => {
  const { document, window } = parseHTML(`<!doctype html><html><body>
    <div data-calorieapp-site-integration
      data-app-origin="https://app.calorietoken.net"
      data-frame-src="https://app.calorietoken.net/?embedded=1&amp;locale=nl"
      data-app-page="https://calorietoken.net/index.php/calorieapp/"
      data-startup-url="https://calorieapp-backend-rvul.onrender.com/health?resume_login=true"
      data-locale="nl"></div>
    <section class="xl-card"></section>
    <div data-calorieapp-sitewide-session-actions>
      <button class="calorieapp-site-logout"
        data-logout-url="https://calorietoken.net/wp-login.php?action=logout&amp;_wpnonce=test"
        data-idle-label="Log out">Log out</button>
      <span class="calorieapp-site-logout-status" hidden></span>
    </div>
  </body></html>`);
  Object.defineProperty(window, 'location', {
    value: new URL('https://calorietoken.net/'),
    configurable: true,
  });
  Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: storage(), configurable: true });
  const messages = [];
  const logoutFrameWindow = {
    postMessage(message, origin) { messages.push({ message, origin }); },
  };
  const nativeCreateElement = document.createElement.bind(document);
  document.createElement = name => {
    const element = nativeCreateElement(name);
    if (String(name).toLowerCase() === 'iframe') {
      Object.defineProperty(element, 'contentWindow', { value: logoutFrameWindow });
    }
    return element;
  };
  const timers = [];
  window.setTimeout = (callback, delay) => {
    timers.push({ callback, delay });
    return timers.length;
  };
  window.clearTimeout = () => {};
  const messageListeners = captureMessages(window);

  vm.runInContext(source, vm.createContext({ window, document, URL }), {
    filename: 'site-session-repair.js',
  });
  const button = document.querySelector('.calorieapp-site-logout');
  button.click();

  const frame = document.querySelector('iframe.calorieapp-sitewide-logout-frame');
  assert.ok(frame);
  assert.equal(frame.hasAttribute('hidden'), false);
  assert.equal(frame.getAttribute('aria-hidden'), 'true');
  assert.match(frame.getAttribute('style'), /left:-10000px!important/);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'Logging out...');
  assert.equal(timers.at(-1).delay, 100000);

  for (const listener of messageListeners) {
    listener({
      origin: 'https://app.calorietoken.net',
      source: logoutFrameWindow,
      data: { type: 'calorieapp:bridge:ready', locale: 'nl' },
    });
  }
  for (const listener of messageListeners) {
    listener({
      origin: 'https://app.calorietoken.net',
      source: logoutFrameWindow,
      data: { type: 'calorieapp:bridge:initialized', locale: 'nl' },
    });
  }
  assert.deepEqual(JSON.parse(JSON.stringify(messages)), [
    {
      message: { type: 'calorieapp:bridge:init', locale: 'nl' },
      origin: 'https://app.calorietoken.net',
    },
    {
      message: { type: 'calorieapp:logout', locale: 'nl' },
      origin: 'https://app.calorietoken.net',
    },
  ]);
});
