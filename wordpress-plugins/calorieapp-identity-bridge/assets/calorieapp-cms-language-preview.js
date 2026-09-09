/* Two-paragraph FAQ experiment. Loaded only by the opt-in WordPress preview. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CalorieAppCmsLanguagePreview = factory();
})(typeof window === "object" ? window : this, function () {
  "use strict";

  var protectedSelector = "form,a,button,input,select,textarea,[contenteditable],#wpadminbar,.brz-ed,.xl-card,.woocommerce,.cmplz-cookiebanner,[data-calorieapp-embed],[data-calorieapp-account]";

  function snapshot(node) {
    if (node.nodeType === 3) return node.data;
    if (node.nodeType !== 1) return null;
    return {
      tag: node.tagName.toLowerCase(),
      attributes: Array.from(node.attributes).map(function (attribute) {
        return [attribute.name, attribute.value];
      }).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }),
      children: Array.from(node.childNodes).map(snapshot)
    };
  }

  function textNodes(node) {
    if (node.nodeType === 3) return [node];
    return Array.from(node.childNodes).reduce(function (result, child) {
      return result.concat(textNodes(child));
    }, []);
  }

  function safeShape(shape, top) {
    if (typeof shape === "string") return !top;
    return shape && (top ? shape.tag === "p" : ["strong", "span"].indexOf(shape.tag) !== -1)
      && Array.isArray(shape.attributes) && shape.attributes.every(function (attribute) {
        return Array.isArray(attribute) && attribute.length === 2
          && ["class", "style", "data-uniq-id", "data-generated-css", "lang", "dir"].indexOf(attribute[0]) !== -1
          && typeof attribute[1] === "string";
      }) && Array.isArray(shape.children) && shape.children.every(function (child) {
        return safeShape(child, false);
      });
  }

  function connect(options) {
    var document = options.document, location = options.location;
    var catalogue = options.catalogue, store = options.store;
    var enabled = options.enabled === true;
    var active = null, stopped = false, unsubscribe = function () {};
    var result = { status: "disabled", locale: null };

    function report(status, locale) {
      result = { status: status, locale: locale || null };
      return result;
    }
    function routeMatches() {
      try {
        var url = new URL(location.href);
        return catalogue.origins.indexOf(url.origin) !== -1 && url.pathname === catalogue.pathname
          && Array.from(url.searchParams.keys()).every(function (key) { return key === "ui_lang"; })
          && document.body.classList.contains("page-id-" + catalogue.wordpress_id)
          && !document.querySelector(".brz-ed");
      } catch (_) { return false; }
    }
    function inScope(node) {
      return node.isConnected && !node.closest(protectedSelector)
        && node.parentElement && node.parentElement.tagName === "DIV"
        && node.parentElement.getAttribute("data-brz-translate-text") === "1"
        && node.parentElement.parentElement
        && node.parentElement.parentElement.classList.contains("brz-rich-text");
    }
    function unchanged(entry) {
      if (!inScope(entry.node) || entry.node.parentElement !== entry.parent
        || JSON.stringify(snapshot(entry.node)) !== entry.expected) return false;
      var matches = document.querySelectorAll('p[data-uniq-id="' + entry.id + '"]');
      if (matches.length !== 1 || matches[0] !== entry.node) return false;
      var current = textNodes(entry.node);
      return current.length === entry.texts.length && current.every(function (node, index) {
        return node === entry.texts[index];
      });
    }
    function restore() {
      if (!active) return;
      active.forEach(function (entry) {
        // Never overwrite an edited/replaced node or a node moved into a form.
        if (!unchanged(entry)) return;
        entry.texts.forEach(function (node, index) { node.data = entry.original[index]; });
        ["lang", "dir"].forEach(function (name) {
          if (entry.attributes[name] === null) entry.node.removeAttribute(name);
          else entry.node.setAttribute(name, entry.attributes[name]);
        });
      });
      active = null;
    }
    function locate() {
      var entries = [];
      for (var slot of catalogue.slots) {
        var matches = document.querySelectorAll('p[data-uniq-id="' + slot.element_id + '"]');
        if (matches.length !== 1 || !inScope(matches[0])) return null;
        var node = matches[0];
        var signature = JSON.stringify(snapshot(node));
        if (signature !== JSON.stringify(slot.source)) return null;
        if (entries.length && node.parentElement !== entries[0].parent) return null;
        var texts = textNodes(node);
        entries.push({
          key: slot.key, id: slot.element_id, node: node, parent: node.parentElement, texts: texts,
          original: texts.map(function (text) { return text.data; }), expected: signature,
          attributes: { lang: node.getAttribute("lang"), dir: node.getAttribute("dir") }
        });
      }
      return entries;
    }
    function render(state) {
      if (stopped) return result;
      if (!routeMatches()) {
        restore(); stopped = true; unsubscribe();
        return report("outside-scope");
      }
      if (active && !active.every(unchanged)) {
        restore(); stopped = true; unsubscribe();
        return report("source-changed");
      }
      var translation = state && typeof state.locale === "string"
        && Object.prototype.hasOwnProperty.call(catalogue.translations, state.locale)
        ? catalogue.translations[state.locale] : null;
      if (!translation || translation.copy_version !== catalogue.copy_version
        || translation.direction !== (["ar", "ur"].indexOf(state.locale) !== -1 ? "rtl" : "ltr")
        || !translation.slots || typeof translation.slots !== "object") {
        restore(); return report("translation-pending");
      }
      var entries = active || locate();
      if (!entries) return report("source-pending");
      // Validate the whole question/answer before changing any text node.
      var valid = entries.every(function (entry) {
        var values = translation.slots[entry.key];
        return Array.isArray(values) && values.length === entry.texts.length
          && values.every(function (value) { return typeof value === "string"; })
          && values.some(function (value) { return value.trim() !== ""; });
      });
      if (!valid) { restore(); return report("translation-pending"); }
      active = entries;
      entries.forEach(function (entry) {
        entry.texts.forEach(function (node, index) { node.data = translation.slots[entry.key][index]; });
        entry.node.setAttribute("lang", state.locale);
        entry.node.setAttribute("dir", translation.direction);
        entry.expected = JSON.stringify(snapshot(entry.node));
      });
      return report("preview", state.locale);
    }

    var api = {
      get: function () { return { status: result.status, locale: result.locale }; },
      refresh: function () { return enabled && !stopped ? render(store.get()) : api.get(); },
      disconnect: function () { unsubscribe(); restore(); stopped = true; report("disconnected"); }
    };
    if (!enabled) return api;
    if (!catalogue || catalogue.schema_version !== 1 || catalogue.mode !== "opt-in-development-preview"
      || !Number.isInteger(catalogue.wordpress_id) || catalogue.wordpress_id <= 0
      || !Array.isArray(catalogue.origins) || !catalogue.origins.length
      || typeof catalogue.pathname !== "string" || typeof catalogue.copy_version !== "string"
      || !catalogue.copy_version || !catalogue.translations
      || !Array.isArray(catalogue.slots) || catalogue.slots.length !== 2
      || !catalogue.slots.every(function (slot) {
        return slot && ["question", "answer"].indexOf(slot.key) !== -1
          && typeof slot.element_id === "string" && /^[a-zA-Z0-9_-]+$/.test(slot.element_id)
          && safeShape(slot.source, true);
      }) || new Set(catalogue.slots.map(function (slot) { return slot.key; })).size !== 2
      || new Set(catalogue.slots.map(function (slot) { return slot.element_id; })).size !== 2
      || !store || typeof store.subscribe !== "function" || typeof store.get !== "function") {
      stopped = true; report("invalid-catalogue"); return api;
    }
    render(store.get());
    if (!stopped) unsubscribe = store.subscribe(render);
    return api;
  }
  return { connect: connect };
});
