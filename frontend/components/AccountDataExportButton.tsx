"use client";

import { useEffect, useRef, useState } from "react";
import {
  BACKEND_WAKE_BASE_URL,
  backendRequest,
  backendUnavailableMessage,
  waitForBackendReady,
} from "@/lib/backendRequest";
import {
  PRIVATE_EXPORT_REQUEST_HEADER,
  PRIVATE_EXPORT_REQUEST_VALUE,
} from "@/lib/privateExportRequest";
import { getAccountPrivacyCopy } from "@/lib/accountPrivacyCopy";

const BACKEND_BASE_URL = "/api/backend";
const ACCOUNT_EXPORT_VERSION = "calorieapp-account-data-v1";
const ACCOUNT_EXPORT_FILENAME = "calorieapp-account-data-v1.json";
const PRIVATE_EXPORT_URL_REVOCATION_DELAY_MS = 1_000;

type AccountDataExportButtonProps = {
  locale?: string;
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
    (candidate.inactive_account_notices === undefined ||
      Array.isArray(candidate.inactive_account_notices)) &&
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
  locale,
  onAuthenticationLost,
}: AccountDataExportButtonProps) {
  const localized = getAccountPrivacyCopy(locale);
  const copy = localized.export;
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
          headers: {
            Accept: "application/json",
            [PRIVATE_EXPORT_REQUEST_HEADER]: PRIVATE_EXPORT_REQUEST_VALUE,
          },
          signal: controller.signal,
        }
      );

      if (response.status === 401) {
        onAuthenticationLost(copy.session_expired);
        return;
      }
      if (response.status === 409) {
        setError(copy.review_required);
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
      setSuccess(copy.success);
    } catch (requestError) {
      if (controller.signal.aborted) {
        return;
      }
      setError(
        backendUnavailableMessage(
          requestError,
          copy.unavailable,
          localized.service_startup_timeout
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
      aria-label={copy.section_label}
      lang={localized.locale}
      dir={localized.direction}
      className="rounded-xl border border-brand-secondary/15 bg-white/80 p-3"
    >
      <p className="text-sm font-semibold text-brand-primary">
        {copy.title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-brand-secondary/90">
        {copy.description}
      </p>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="mt-3 inline-flex items-center justify-center rounded-full bg-brand-secondary px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isDownloading ? copy.button_busy : copy.button_idle}
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
