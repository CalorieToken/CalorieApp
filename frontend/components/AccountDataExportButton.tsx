"use client";

import { useEffect, useRef, useState } from "react";
import {
  BACKEND_WAKE_BASE_URL,
  backendRequest,
  backendUnavailableMessage,
  waitForBackendReady,
} from "@/lib/backendRequest";

const BACKEND_BASE_URL = "/api/backend";
const ACCOUNT_EXPORT_VERSION = "calorieapp-account-data-v1";
const ACCOUNT_EXPORT_FILENAME = "calorieapp-account-data-v1.json";
const PRIVATE_EXPORT_URL_REVOCATION_DELAY_MS = 1_000;

type AccountDataExportButtonProps = {
  onAuthenticationLost: (message: string) => void;
};

export function isVersionedAccountExport(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    candidate.export_version === ACCOUNT_EXPORT_VERSION &&
    candidate.account !== null &&
    typeof candidate.account === "object" &&
    !Array.isArray(candidate.account) &&
    Array.isArray(candidate.food_logs) &&
    Array.isArray(candidate.external_identities) &&
    Array.isArray(candidate.authentication_sessions) &&
    Array.isArray(candidate.authorization_events) &&
    Array.isArray(candidate.login_handoffs) &&
    Array.isArray(candidate.excluded_security_fields)
  );
}

export function downloadPrivateJson(payload: unknown): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = ACCOUNT_EXPORT_FILENAME;
  anchor.hidden = true;
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(
      () => URL.revokeObjectURL(objectUrl),
      PRIVATE_EXPORT_URL_REVOCATION_DELAY_MS
    );
  }
}

export function AccountDataExportButton({
  onAuthenticationLost,
}: AccountDataExportButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => requestController.current?.abort();
  }, []);

  async function handleDownload() {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setIsDownloading(true);
    setError(null);
    setSuccess(null);

    try {
      await waitForBackendReady(BACKEND_WAKE_BASE_URL, controller.signal);
      const response = await backendRequest(
        `${BACKEND_BASE_URL}/api/identity/export`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }
      );

      if (response.status === 401) {
        onAuthenticationLost(
          "Your session expired. Sign in again before requesting a private export. No file was downloaded."
        );
        return;
      }
      if (response.status === 409) {
        setError(
          "This export needs operator review because older identity records cannot be assigned safely. No file was downloaded."
        );
        return;
      }
      if (!response.ok) {
        throw new Error(`Account export failed with ${response.status}`);
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Account export was not returned as JSON");
      }

      const payload = (await response.json()) as unknown;
      if (!isVersionedAccountExport(payload)) {
        throw new Error("Account export did not match the reviewed version");
      }

      downloadPrivateJson(payload);
      setSuccess(
        "Private export downloaded. Store it securely and do not share it publicly."
      );
    } catch (requestError) {
      if (controller.signal.aborted) {
        return;
      }
      setError(
        backendUnavailableMessage(
          requestError,
          "Your private export is unavailable right now. No file was downloaded. Please try again later."
        )
      );
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        if (!controller.signal.aborted) {
          setIsDownloading(false);
        }
      }
    }
  }

  return (
    <section
      aria-label="Private account data export"
      className="rounded-xl border border-brand-secondary/15 bg-white/80 p-3"
    >
      <p className="text-sm font-semibold text-brand-primary">
        Download your private account data
      </p>
      <p className="mt-1 text-xs leading-relaxed text-brand-secondary/90">
        The JSON file can include your account identifier, linked identity and
        optional XRPL address, food-log history, and session timing. Security
        tokens are excluded. Some older authorization activity remains withheld
        when ownership cannot be proven. CalorieApp does not send the file
        anywhere else; keep your browser&apos;s configured download location
        private. This download does not delete your CalorieApp data.
      </p>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="mt-3 inline-flex items-center justify-center rounded-full bg-brand-secondary px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isDownloading ? "Preparing private export..." : "Download private JSON"}
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800"
        >
          {success}
        </p>
      ) : null}
    </section>
  );
}
