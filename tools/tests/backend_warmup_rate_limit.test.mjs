import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const requireFromFrontend = createRequire(
  new URL("../../frontend/package.json", import.meta.url)
);
const typescript = requireFromFrontend("typescript");
const source = await readFile(
  new URL("../../frontend/lib/backendRequest.ts", import.meta.url),
  "utf8"
);
const compiled = typescript.transpileModule(source, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022,
  },
}).outputText;

function response(status, retryAfter = null, contentType = "text/plain") {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => name === "retry-after" ? retryAfter : contentType,
    },
    json: async () => ({ status: "ok" }),
    body: { cancel: async () => {} },
  };
}

const healthy = () => response(200, null, "application/json");

function warmupHarness(responses) {
  let now = Date.UTC(2026, 0, 1);
  const startedAt = now;
  let nextTimer = 0;
  const timers = new Map();
  const requests = [];
  const module = { exports: {} };
  class Clock extends Date {
    static now() { return now; }
  }
  const context = vm.createContext({
    AbortController,
    Date: Clock,
    module,
    exports: module.exports,
    process: { env: {} },
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    fetch: async (url, options) => {
      const index = requests.length;
      requests.push({ url, options, at: now - startedAt });
      if (typeof responses === "function") return responses(url, index);
      assert.ok(index < responses.length, "Unexpected extra health request");
      return responses[index];
    },
  });
  vm.runInContext(compiled, context);

  return {
    requests,
    start: (signal, timeout = 180_000, baseUrl = "/api/backend") =>
      module.exports.waitForBackendReady(baseUrl, signal, timeout),
    async settle(operation) {
      let outcome;
      operation.then(
        (value) => { outcome = { value }; },
        (error) => { outcome = { error }; }
      );
      for (let tick = 0; tick < 100; tick += 1) {
        // Drain actual promises before advancing the synthetic clock. No
        // external requests or real retry delays are used by these tests.
        await new Promise(setImmediate);
        if (outcome) {
          if (outcome.error) throw outcome.error;
          return outcome.value;
        }
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        assert.ok(next, "Warmup stalled without a timer");
        timers.delete(next[0]);
        now = next[1].at;
        next[1].callback();
      }
      assert.fail("Warmup exceeded the bounded test clock");
    },
  };
}

test("ready backend proceeds immediately without credentials", async () => {
  const harness = warmupHarness([healthy()]);
  await harness.settle(harness.start());
  assert.deepEqual(harness.requests.map(({ at }) => at), [0]);
  assert.equal(harness.requests[0].options.credentials, "omit");
});

test("repeated zero Retry-After values cannot cause a request burst", async () => {
  const harness = warmupHarness([
    response(429, "0"), response(429, "0"), response(429, "0"), healthy(),
  ]);
  await harness.settle(harness.start());
  assert.deepEqual(harness.requests.map(({ at }) => at), [0, 30_000, 60_000, 90_000]);
});

for (const retryAfter of ["120", "Thu, 01 Jan 2026 00:02:00 GMT"]) {
  test(`server cooldown is not shortened: ${retryAfter}`, async () => {
    const harness = warmupHarness([response(429, retryAfter), healthy()]);
    await harness.settle(harness.start());
    assert.deepEqual(harness.requests.map(({ at }) => at), [0, 120_000]);
  });
}

test("cooldown beyond the login window ends without another request", async () => {
  const harness = warmupHarness([response(429, "240"), healthy()]);
  await assert.rejects(harness.settle(harness.start()), {
    name: "BackendRequestTimeoutError",
  });
  assert.equal(harness.requests.length, 1);
});

for (const retryAfter of [null, "invalid", "-1", "5"]) {
  test(`rate limit retains a minimum pause: ${retryAfter}`, async () => {
    const harness = warmupHarness([response(429, retryAfter), healthy()]);
    await harness.settle(harness.start());
    assert.deepEqual(harness.requests.map(({ at }) => at), [0, 30_000]);
  });
}

test("ordinary startup responses keep their existing backoff", async () => {
  const harness = warmupHarness([response(503), response(200), healthy()]);
  await harness.settle(harness.start());
  assert.deepEqual(harness.requests.map(({ at }) => at), [0, 5_000, 15_000]);
});

test("cancelled login sends no health request", async () => {
  const harness = warmupHarness([]);
  const controller = new AbortController();
  controller.abort(new Error("Login cancelled"));
  await assert.rejects(harness.settle(harness.start(controller.signal)), /Login cancelled/);
  assert.equal(harness.requests.length, 0);
});

for (const limitedUrl of ["/api/backend/health", "https://backend.example/health"]) {
  test(`both wake-up paths respect a cooldown from ${limitedUrl}`, async () => {
    let limitedRequests = 0;
    const harness = warmupHarness((url) => {
      if (url !== limitedUrl) throw new Error("Network response unavailable");
      return limitedRequests++ === 0 ? response(429, "120") : healthy();
    });
    await harness.settle(harness.start(undefined, 180_000, "https://backend.example"));
    assert.equal(harness.requests.filter(({ at }) => at < 120_000).length, 2);
    assert.equal(harness.requests.filter(({ url }) => url === limitedUrl).length, 2);
  });
}
