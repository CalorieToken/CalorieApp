import { NextRequest, NextResponse } from "next/server";
import { isTrustedAccountErasureRequest } from "@/lib/accountErasureRequest";
import {
  ACCOUNT_IMPORT_ACKNOWLEDGEMENT_HEADER,
  ACCOUNT_IMPORT_PATH,
  ACCOUNT_IMPORT_REQUEST_HEADER,
  ACCOUNT_IMPORT_SOURCE_HEADER,
  ACCOUNT_IMPORT_TARGET_HEADER,
  isTrustedAccountImportRequest,
} from "@/lib/accountImportRequest";
import { isTrustedPrivateExportRequest } from "@/lib/privateExportRequest";

export const dynamic = "force-dynamic";

const DEFAULT_UPSTREAM_TIMEOUT_MS = 18_000;
const COLD_START_UPSTREAM_TIMEOUT_MS = 70_000;
const ACCOUNT_IMPORT_UPSTREAM_TIMEOUT_MS = 60_000;

const ROUTE_METHODS: Array<{ pattern: RegExp; methods: Set<string> }> = [
  { pattern: /^health$/, methods: new Set(["GET"]) },
  { pattern: /^search-food$/, methods: new Set(["GET"]) },
  { pattern: /^log-food$/, methods: new Set(["POST"]) },
  { pattern: /^logs$/, methods: new Set(["GET", "DELETE"]) },
  { pattern: /^logs\/[^/]+$/, methods: new Set(["DELETE"]) },
  {
    pattern: /^api\/identity\/(login\/(start|status)|callback|logout)$/,
    methods: new Set(["POST"]),
  },
  { pattern: /^api\/identity\/(me|export)$/, methods: new Set(["GET"]) },
  { pattern: /^api\/identity\/import$/, methods: new Set(["POST"]) },
  { pattern: /^api\/identity\/account$/, methods: new Set(["DELETE"]) },
];

type RouteContext = {
  params: {
    path: string[];
  };
};

function configuredBackendUrl(): string | null {
  const configured =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim();

  if (!configured) {
    return null;
  }

  try {
    const parsed = new URL(configured);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isAllowedRoute(path: string, method: string): boolean {
  return ROUTE_METHODS.some(
    (route) => route.pattern.test(path) && route.methods.has(method)
  );
}

function isTrustedMutationRequest(request: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return true;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const path = context.params.path.join("/");
  if (!isAllowedRoute(path, request.method)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  if (
    !isTrustedMutationRequest(request) ||
    !isTrustedAccountErasureRequest(path, request) ||
    !isTrustedAccountImportRequest(path, request) ||
    !isTrustedPrivateExportRequest(path, request)
  ) {
    return NextResponse.json({ detail: "Origin not allowed" }, { status: 403 });
  }

  const backendUrl = configuredBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { detail: "CalorieApp backend is not configured" },
      { status: 503 }
    );
  }

  const target = new URL(`${backendUrl}/${path}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie"]) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  if (path === ACCOUNT_IMPORT_PATH) {
    for (const name of [
      ACCOUNT_IMPORT_REQUEST_HEADER,
      ACCOUNT_IMPORT_SOURCE_HEADER,
      ACCOUNT_IMPORT_TARGET_HEADER,
      ACCOUNT_IMPORT_ACKNOWLEDGEMENT_HEADER,
    ]) {
      const value = request.headers.get(name);
      if (value) {
        headers.set(name, value);
      }
    }
  }

  const controller = new AbortController();
  // A sleeping Render backend can need well over the ordinary request timeout
  // before its health endpoint answers. Keep only this readiness probe alive
  // long enough to wake it; normal application requests retain the tighter
  // timeout after readiness has been established.
  const upstreamTimeoutMs =
    path === ACCOUNT_IMPORT_PATH
      ? ACCOUNT_IMPORT_UPSTREAM_TIMEOUT_MS
      : [
          "health",
          "api/identity/login/start",
          "api/identity/callback",
        ].includes(path)
        ? COLD_START_UPSTREAM_TIMEOUT_MS
        : DEFAULT_UPSTREAM_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  try {
    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer();

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });

    const responseHeaders = new Headers();
    for (const name of [
      "cache-control",
      "content-disposition",
      "content-type",
      "pragma",
      "retry-after",
      "set-cookie",
    ]) {
      let value = upstream.headers.get(name);
      if (value) {
        if (name === "set-cookie") {
          value = value.replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
        }
        responseHeaders.set(name, value);
      }
    }

    if (!responseHeaders.has("cache-control")) {
      responseHeaders.set("cache-control", "no-store");
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        detail: timedOut
          ? "CalorieApp backend timed out"
          : "CalorieApp backend is unavailable",
      },
      { status: timedOut ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const DELETE = proxyRequest;
