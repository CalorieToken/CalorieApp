import { NextRequest, NextResponse } from "next/server";
import { appActivity } from "@/lib/appActivity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export function GET() {
  return NextResponse.json(appActivity.snapshot(), { headers });
}

export async function POST(request: NextRequest) {
  // Compare with the public Host header: Next's internal URL can use the proxy
  // hostname or normalize loopback addresses, even for a same-origin request.
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    const url = new URL(origin ?? "");
    sameOrigin = url.origin === origin && ["https:", "http:"].includes(url.protocol) && url.host === request.headers.get("host");
  } catch { /* Missing or malformed Origin is rejected. */ }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!sameOrigin || (fetchSite && fetchSite !== "same-origin") || Number(request.headers.get("content-length") || 0) > 128) {
    return new NextResponse(null, { status: 403, headers });
  }
  // Bound the body before parsing, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return new NextResponse(null, { status: 400, headers });
  let body = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      body += decoder.decode(chunk.value, { stream: true });
      if (body.length > 128) { await reader.cancel(); return new NextResponse(null, { status: 413, headers }); }
    }
    const data = JSON.parse(body);
    if (typeof data.session !== "string") return new NextResponse(null, { status: 400, headers });
    return new NextResponse(null, { status: appActivity.touch(data.session) ? 204 : 429, headers });
  } catch { return new NextResponse(null, { status: 400, headers }); }
}
