"use client";

import { useEffect, useRef } from "react";

/** No UI: the aggregate is displayed only on the public Showcase page. */
export function AppActivityHeartbeat() {
  const session = useRef<string>();
  useEffect(() => {
    if (!crypto.randomUUID) return;
    session.current ??= crypto.randomUUID();
    let inFlight = false;
    const controller = new AbortController();
    async function heartbeat() {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      try {
        await fetch("/api/activity", { method: "POST", credentials: "omit", cache: "no-store",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: session.current }), signal: controller.signal });
      } catch { /* Activity reporting must never affect the app. */ }
      finally { inFlight = false; }
    }
    void heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", heartbeat); };
  }, []);
  return null;
}
