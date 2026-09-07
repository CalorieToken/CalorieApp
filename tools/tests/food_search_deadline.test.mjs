import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const requireFromFrontend = createRequire(new URL("../../frontend/package.json", import.meta.url));
const ts = requireFromFrontend("typescript");

function clock() {
  let now = 0, id = 0;
  const jobs = new Map();
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return {
    setTimeout(callback, delay) { jobs.set(++id, { at: now + delay, callback }); return id; },
    clearTimeout(key) { jobs.delete(key); },
    async advance(ms) {
      await settle();
      const end = now + ms;
      for (;;) {
        const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at; jobs.delete(next[0]); next[1].callback();
        await settle();
      }
      now = end; await settle();
    },
  };
}

class NextResponse extends Response {
  static json(value, options) { return new NextResponse(JSON.stringify(value), options); }
}

async function load(relative, fetchImpl, time) {
  const source = await readFile(new URL(`../../${relative}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, fetch: fetchImpl, ...time,
    AbortController, Headers, Response, URL, Error, console,
    process: { env: { BACKEND_URL: "https://backend.example" } },
    require(name) {
      if (name === "next/server") return { NextResponse };
      if (name === "@/lib/accountErasureRequest") return { isTrustedAccountErasureRequest: () => true };
      if (name === "@/lib/privateExportRequest") return { isTrustedPrivateExportRequest: () => true };
      if (name === "@/lib/accountImportRequest") return { ACCOUNT_IMPORT_PATH: "api/identity/import", isTrustedAccountImportRequest: () => true };
      throw new Error(`Unexpected module ${name}`);
    },
  });
  return module.exports;
}

async function harness(path, delay, responseStatus = 200) {
  const time = clock(), calls = [];
  const route = await load("frontend/app/api/backend/[...path]/route.ts", (url, init) => {
    calls.push(String(url));
    return new Promise((resolve, reject) => {
      const timer = time.setTimeout(() => resolve(new Response(JSON.stringify({ results: [{ product_name: "Magnum" }] }), {
        status: responseStatus, headers: { "content-type": "application/json", "retry-after": "60" },
      })), delay);
      init.signal.addEventListener("abort", () => {
        time.clearTimeout(timer);
        const error = new Error("timed out"); error.name = "AbortError"; reject(error);
      });
    });
  }, time);
  const client = await load("frontend/lib/backendRequest.ts", (_url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason));
    route.GET({ method: "GET", headers: new Headers(), nextUrl: new URL(`https://app.example/api/backend/${path}?q=Magnum`) }, { params: { path: path.split("/") } }).then(resolve, reject);
  }), time);
  return { time, calls, client };
}

test("one search survives a slow provider fallback through both proxy and browser", async () => {
  const h = await harness("search-food", 26_000);
  let settled = false;
  const result = h.client.backendRequest("/api/backend/search-food?q=Magnum", {}, h.client.FOOD_SEARCH_TIMEOUT_MS).then(response => { settled = true; return response; });
  await h.time.advance(19_000);
  assert.equal(settled, false, "the proxy must not turn a still-running search into an 18s error");
  await h.time.advance(7_000);
  const response = await result;
  assert.equal(response.status, 200);
  assert.equal((await response.json()).results[0].product_name, "Magnum");
  assert.deepEqual(h.calls, ["https://backend.example/search-food?q=Magnum"]);
});

test("search still has a finite proxy deadline and does not retry on timeout", async () => {
  const h = await harness("search-food", 60_000);
  const result = h.client.backendRequest("/api/backend/search-food", {}, h.client.FOOD_SEARCH_TIMEOUT_MS);
  await h.time.advance(45_000);
  assert.equal((await result).status, 504);
  assert.equal(h.calls.length, 1);
});

test("ordinary requests retain their shorter deadline", async () => {
  const h = await harness("logs", 26_000);
  const result = h.client.backendRequest("/api/backend/logs");
  await h.time.advance(18_000);
  const response = await result;
  assert.equal(response.status, 504);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("rate limits are returned with Retry-After without another request", async () => {
  const h = await harness("search-food", 100, 429);
  const result = h.client.backendRequest("/api/backend/search-food", {}, h.client.FOOD_SEARCH_TIMEOUT_MS);
  await h.time.advance(100);
  const response = await result;
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(h.calls.length, 1);
});
