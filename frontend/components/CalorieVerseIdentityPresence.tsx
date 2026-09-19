"use client";

import { useEffect, useState } from "react";
import type { AgeBand } from "@/lib/ageExperience";
import { backendRequest } from "@/lib/backendRequest";

type IdentityResponse = {
  user_id?: unknown;
  nickname?: unknown;
};

function safeNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim();
  const chars = Array.from(normalized);
  if (
    chars.length < 2 ||
    chars.length > 32 ||
    /[\u0000-\u001F\u007F-\u009F<>\u202A-\u202E\u2066-\u2069]/u.test(normalized)
  ) return null;
  return normalized;
}

export function CalorieVerseIdentityPresence({
  ageBand,
  starterId,
}: {
  ageBand: AgeBand;
  starterId: string;
}) {
  const [nickname,setNickname] = useState<string | null>(null);

  useEffect(() => {
    if (ageBand !== "adult") {
      setNickname(null);
      return;
    }

    const controller = new AbortController();
    void backendRequest("/api/backend/api/identity/me",{signal:controller.signal})
      .then(async response => {
        if (!response.ok) return null;
        return await response.json() as IdentityResponse;
      })
      .then(payload => {
        if (!payload || controller.signal.aborted) return;
        setNickname(safeNickname(payload.nickname));
      })
      .catch(() => {
        if (!controller.signal.aborted) setNickname(null);
      });

    return () => controller.abort();
  },[ageBand]);

  return (
    <>
      <strong data-calorieverse-display-name>
        {nickname ?? starterId}
      </strong>
      {nickname ? (
        <span className="gameverse-starter-id" data-calorieverse-starter-id>
          {starterId}
        </span>
      ) : null}
    </>
  );
}
