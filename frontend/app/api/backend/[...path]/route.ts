import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_UPSTREAM_TIMEOUT_MS = 18_000;
const HEALTH_UPSTREAM_TIMEOUT_MS = 70_000;

const ROUTE_METHODS: Array<{ pattern: RegExp; methods: Set<string> }> = [
  { pattern: /^health$/, methods: new Set(["GET"]) },
  { pattern: /^search-food$/, methods: new Set(["GET"]) },
  { pattern: /^log-food$/, methods: new Set(["POST"]) },
  { pattern: /^logs$/, methods: new Set(["GET", "DELETE"]) },
  { pattern: /^logs\/[^/]+$/, methods: new Set(["DELETE"]) },
  {
    pattern: /^api\/identity\/(login\/start|callback|logout)$/,
    methods: new Set(["POST"]),
  },
  { pattern: /^api\/identity\/me$/, methods: new Set(["GET"]) },
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

  if (!isTrustedMutationRequest(request)) {
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

  const controller = new AbortController();
  // A sleeping Render backend can need well over the ordinary request timeout
  // before its health endpoint answers. Keep only this readiness probe alive
  // long enough to wake it; normal application requests retain the tighter
  // timeout after readiness has been established.
  const upstreamTimeoutMs =
    path === "health" ? HEALTH_UPSTREAM_TIMEOUT_MS : DEFAULT_UPSTREAM_TIMEOUT_MS;
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
      "content-type",
      "pragma",
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
