"use client";

import { useEffect, useState } from "react";

export function ShowcaseActivity() {
  const [active, setActive] = useState<number | null>(null);
  const [nl, setNl] = useState(false);
  useEffect(() => {
    setNl(new URLSearchParams(window.location.search).get("locale") === "nl");
    const controller = new AbortController();
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/activity", { cache: "no-store", credentials: "omit", signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const data = await response.json();
        setActive(Number.isInteger(data.active) && data.active >= 0 && data.active <= 2000 ? data.active : null);
      } catch { if (!controller.signal.aborted) setActive(null); }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return <section lang={nl ? "nl" : "en"} className="rounded-2xl border border-brand-secondary/20 bg-white p-4 text-center text-brand-secondary">
    <p className="text-sm font-semibold">CalorieApp · {nl ? "Actieve sessies" : "Active sessions"}</p>
    <p role="status" className="my-1 text-2xl font-bold text-brand-primary">{active === null ? "—" : active}</p>
    <p className="text-xs">{active === null ? (nl ? "Telling tijdelijk niet beschikbaar" : "Count temporarily unavailable") : (nl ? "Actief in de afgelopen 5 minuten" : "Active in the past 5 minutes")}</p>
    <p className="mt-2 text-xs">{nl ? "Schatting van geopende appvensters, geen unieke personen. Begint opnieuw na een herstart." : "Estimated open app windows, not unique people. Resets after a restart."}</p>
  </section>;
}
