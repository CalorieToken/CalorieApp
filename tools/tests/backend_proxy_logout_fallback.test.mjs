import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const ROUTE_PATH = new URL(
  "../../frontend/app/api/backend/[...path]/route.ts",
  import.meta.url
);
const requireFromFrontend = createRequire(
  new URL("../../frontend/package.json", import.meta.url)
);

class MockNextResponse extends Response {
  constructor(body, init) {
    super(body, init);
    this.cookies = {
      set: (cookie) => {
        const fields = [`${cookie.name}=${cookie.value}`, `Path=${cookie.path}`];
        if (cookie.expires) fields.push(`Expires=${cookie.expires.toUTCString()}`);
        if (cookie.maxAge === 0) fields.push("Max-Age=0");
        if (cookie.httpOnly) fields.push("HttpOnly");
        if (cookie.secure) fields.push("Secure");
        if (cookie.sameSite) fields.push(`SameSite=${cookie.sameSite}`);
        this.headers.append("set-cookie", fields.join("; "));
      },
    };
  }

  static json(payload, init) {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    return new MockNextResponse(JSON.stringify(payload), { ...init, headers });
  }
}

async function loadRoute(fetchImpl) {
  const typescript = requireFromFrontend("typescript");
  const source = await readFile(ROUTE_PATH, "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    AbortController,
    ArrayBuffer,
    Date,
    Error,
    Headers,
    Promise,
    Response,
    URL,
    clearTimeout,
    console,
    fetch: fetchImpl,
    module,
    exports: module.exports,
    process: { env: { BACKEND_URL: "https://backend.example" } },
    require(specifier) {
      if (specifier === "next/server") {
        return { NextResponse: MockNextResponse };
      }
      if (specifier === "@/lib/accountErasureRequest") {
        return { isTrustedAccountErasureRequest: () => true };
      }
      if (specifier === "@/lib/accountImportRequest") {
        return {
          ACCOUNT_IMPORT_ACKNOWLEDGEMENT_HEADER: "x-import-acknowledgement",
          ACCOUNT_IMPORT_PATH: "api/identity/import",
          ACCOUNT_IMPORT_REQUEST_HEADER: "x-import-request",
          ACCOUNT_IMPORT_SOURCE_HEADER: "x-import-source",
          ACCOUNT_IMPORT_TARGET_HEADER: "x-import-target",
          isTrustedAccountImportRequest: () => true,
        };
      }
      if (specifier === "@/lib/privateExportRequest") {
        return { isTrustedPrivateExportRequest: () => true };
      }
      throw new Error(`Unexpected require: ${specifier}`);
    },
    setTimeout,
  });

  vm.runInContext(compiled, context);
  return module.exports;
}

function proxyRequest(path, method = "POST") {
  return {
    method,
    headers: new Headers({
      accept: "application/json",
      cookie: "calorieapp_session=secret",
      "sec-fetch-site": "same-origin",
    }),
    nextUrl: new URL(`https://app.calorietoken.net/api/backend/${path}`),
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

const logoutContext = {
  params: { path: ["api", "identity", "logout"] },
};

function assertSessionCookieCleared(response) {
  const cookie = response.headers.get("set-cookie") || "";
  assert.match(cookie, /calorieapp_session=/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=lax/);
}

test("logout clears the browser session when the backend cannot be reached", async () => {
  const route = await loadRoute(async () => {
    throw new Error("backend unavailable");
  });

  const response = await route.POST(
    proxyRequest("api/identity/logout"),
    logoutContext
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: "Logged out locally" });
  assertSessionCookieCleared(response);
});

test("logout normalizes an upstream failure after clearing the browser session", async () => {
  const route = await loadRoute(async () =>
    new Response("backend failure", { status: 503 })
  );

  const response = await route.POST(
    proxyRequest("api/identity/logout"),
    logoutContext
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: "Logged out locally" });
  assertSessionCookieCleared(response);
});

test("logout also clears an invalid or expired upstream session cookie", async () => {
  const route = await loadRoute(async () =>
    new Response(JSON.stringify({ detail: "Not authenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  );

  const response = await route.POST(
    proxyRequest("api/identity/logout"),
    logoutContext
  );

  assert.equal(response.status, 401);
  assertSessionCookieCleared(response);
});

test("ordinary proxy failures remain errors and do not alter the session cookie", async () => {
  const route = await loadRoute(async () => {
    throw new Error("backend unavailable");
  });

  const response = await route.GET(
    proxyRequest("api/identity/me", "GET"),
    { params: { path: ["api", "identity", "me"] } }
  );

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("set-cookie"), null);
});
