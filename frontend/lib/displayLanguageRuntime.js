/* Display-language preferences only. No identity, consent or payment messages. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CalorieAppDisplayLanguage = factory();
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  var prefix = "calorieapp:display-language:";
  var storageKey = "calorieapp.display-language.v1";
  var lifetime = 30 * 24 * 60 * 60 * 1000;
  function record(value, keys) {
    return value && typeof value === "object" && !Array.isArray(value)
      && Object.keys(value).length === keys.length
      && keys.every(function (key) { return Object.prototype.hasOwnProperty.call(value, key); });
  }
  function identifier(value) { return typeof value === "string" && /^[a-zA-Z0-9-]{16,64}$/.test(value); }
  function integer(value) { return Number.isSafeInteger(value) && value >= 0; }
  function origin(value) {
    try { var url = new URL(value); return url.protocol === "https:" && url.origin === value; }
    catch (_) { return false; }
  }
  function createStore(options) {
    var tags = options.locales.slice();
    var valid = function (value) { return typeof value === "string" && tags.indexOf(value) !== -1; };
    if (!valid(options.fallback)) throw new Error("Invalid display fallback");
    var now = options.now || Date.now, storage = options.storage, listeners = new Set();
    var state = { locale: valid(options.initialLocale) ? options.initialLocale : options.fallback, explicit: false };
    try {
      var saved = JSON.parse(storage.getItem(storageKey));
      if (record(saved, ["locale", "savedAt"]) && valid(saved.locale)
          && Number.isFinite(saved.savedAt) && saved.savedAt <= now() && now() - saved.savedAt < lifetime) {
        state = { locale: saved.locale, explicit: true };
      } else if (saved !== null) storage.removeItem(storageKey);
    } catch (_) { /* Storage denial never blocks the language control. */ }
    function update(locale, explicit, source) {
      if (!valid(locale) || typeof explicit !== "boolean") return false;
      var changed = state.locale !== locale || state.explicit !== explicit;
      state = { locale: locale, explicit: explicit };
      // Persist only a new explicit choice, not every page load or host sync.
      if (explicit && changed) {
        try { storage.setItem(storageKey, JSON.stringify({ locale: locale, savedAt: now() })); }
        catch (_) { /* In-memory selection still works. */ }
      }
      if (changed) listeners.forEach(function (listener) { listener(state, source); });
      return changed;
    }
    return {
      get: function () { return { locale: state.locale, explicit: state.explicit }; },
      valid: valid,
      select: function (locale) { return update(locale, true, "local"); },
      apply: function (locale, explicit) { return update(locale, explicit, "remote"); },
      subscribe: function (listener) { listeners.add(listener); return function () { listeners.delete(listener); }; }
    };
  }
  function connectHost(options) {
    if (!identifier(options.epoch)) throw new Error("Invalid display epoch");
    var peers = new Map(), revision = 0, closed = false;
    function trusted(event) {
      return options.frames().find(function (frame) {
        return origin(frame.origin) && frame.origin === event.origin && frame.window === event.source;
      });
    }
    function send(peer) {
      if (closed || !trusted({ source: peer.window, origin: peer.origin })) return;
      var state = options.store.get();
      peer.window.postMessage({
        type: prefix + "state", version: 1, channel: peer.channel,
        epoch: options.epoch, revision: revision, ack: peer.sequence,
        locale: state.locale, explicit: state.explicit
      }, peer.origin);
    }
    function message(event) {
      var data = event.data;
      if (closed || !trusted(event) || !data || data.version !== 1 || !identifier(data.channel)) return;
      if (data.type === prefix + "ready" && record(data, ["type", "version", "channel"])) {
        var prior = peers.get(event.source);
        var peer = prior && prior.channel === data.channel ? prior : {
          window: event.source, origin: event.origin, channel: data.channel, sequence: 0
        };
        peers.set(event.source, peer);
        send(peer);
        return;
      }
      var peer = peers.get(event.source);
      if (!peer || data.type !== prefix + "request"
          || !record(data, ["type", "version", "channel", "epoch", "sequence", "revision", "locale"])
          || data.channel !== peer.channel || data.epoch !== options.epoch
          || !integer(data.sequence) || data.sequence <= peer.sequence
          || !integer(data.revision) || !options.store.valid(data.locale)) return;
      peer.sequence = data.sequence;
      if (data.revision === revision) options.store.apply(data.locale, true);
      // A stale revision is acknowledged with current state, never applied.
      send(peer);
    }
    function announce() {
      if (closed) return;
      options.frames().forEach(function (frame) {
        if (origin(frame.origin)) frame.window.postMessage({ type: prefix + "hello", version: 1 }, frame.origin);
      });
    }
    var unsubscribe = options.store.subscribe(function () {
      revision += 1;
      peers.forEach(function (peer, key) {
        if (!trusted({ source: peer.window, origin: peer.origin })) peers.delete(key);
        else send(peer);
      });
    });
    options.window.addEventListener("message", message);
    options.window.addEventListener("load", announce);
    options.window.addEventListener("pageshow", announce);
    announce();
    return function () {
      closed = true;
      unsubscribe();
      peers.clear();
      options.window.removeEventListener("message", message);
      options.window.removeEventListener("load", announce);
      options.window.removeEventListener("pageshow", announce);
    };
  }
  function connectGuest(options) {
    if (!identifier(options.channel) || !options.origins.length
        || !options.origins.every(origin)) throw new Error("Invalid display peer");
    var host = null, revision = -1, sequence = 0, inFlight = 0, desired = null, closed = false;
    function announce() {
      if (!closed) options.origins.forEach(function (target) {
        options.parent.postMessage({ type: prefix + "ready", version: 1, channel: options.channel }, target);
      });
    }
    function flush() {
      if (closed || !host || inFlight || desired === null) return;
      inFlight = ++sequence;
      options.parent.postMessage({
        type: prefix + "request", version: 1, channel: options.channel,
        epoch: host.epoch, sequence: inFlight, revision: revision, locale: desired
      }, host.origin);
    }
    function message(event) {
      var data = event.data;
      if (!closed && event.source === options.parent && options.origins.indexOf(event.origin) !== -1
          && record(data, ["type", "version"]) && data.type === prefix + "hello" && data.version === 1) {
        announce();
        return;
      }
      if (closed || event.source !== options.parent || options.origins.indexOf(event.origin) === -1
          || !record(data, ["type", "version", "channel", "epoch", "revision", "ack", "locale", "explicit"])
          || data.type !== prefix + "state" || data.version !== 1 || data.channel !== options.channel
          || !identifier(data.epoch) || !integer(data.revision) || !integer(data.ack)
          || data.ack > sequence || !options.store.valid(data.locale) || typeof data.explicit !== "boolean") return;
      if (host && (host.origin !== event.origin || host.epoch !== data.epoch || data.revision < revision)) return;
      host = { origin: event.origin, epoch: data.epoch };
      revision = data.revision;
      if (inFlight && data.ack >= inFlight) inFlight = 0;
      if (desired !== null) {
        if (inFlight) return;
        if (data.locale !== desired) { flush(); return; }
        desired = null;
      }
      options.store.apply(data.locale, data.explicit);
    }
    var unsubscribe = options.store.subscribe(function (state, source) {
      if (source !== "local") return;
      desired = state.locale;
      flush();
    });
    options.window.addEventListener("message", message);
    options.window.addEventListener("pageshow", announce);
    // Also announce on load: the WP controller may load after the embedded app.
    options.window.addEventListener("load", announce);
    announce();
    return function () {
      closed = true;
      unsubscribe();
      options.window.removeEventListener("message", message);
      options.window.removeEventListener("pageshow", announce);
      options.window.removeEventListener("load", announce);
    };
  }
  return { createStore: createStore, connectHost: connectHost, connectGuest: connectGuest };
});
