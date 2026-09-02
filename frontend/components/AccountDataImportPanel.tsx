"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import {
  BACKEND_WAKE_BASE_URL,
  backendRequest,
  backendUnavailableMessage,
  waitForBackendReady,
} from "@/lib/backendRequest";
import {
  ACCOUNT_IMPORT_ACKNOWLEDGEMENT,
  ACCOUNT_IMPORT_ACKNOWLEDGEMENT_HEADER,
  ACCOUNT_IMPORT_PATH,
  ACCOUNT_IMPORT_REQUEST_HEADER,
  ACCOUNT_IMPORT_REQUEST_VALUE,
  ACCOUNT_IMPORT_SOURCE_HEADER,
  ACCOUNT_IMPORT_TARGET_HEADER,
} from "@/lib/accountImportRequest";
import { getAccountPrivacyCopy } from "@/lib/accountPrivacyCopy";

const BACKEND_BASE_URL = "/api/backend";
export const ACCOUNT_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

type AccountDataImportPanelProps = {
  userId: string;
  locale?: string;
  onAuthenticationLost: (message: string) => void;
};

type AccountDataImportResponse = {
  import_version: "calorieapp-account-data-import-transaction-v1";
  status: "imported" | "already_imported";
  imported_food_log_rows: number;
};

export function isAccountDataImportResponse(
  payload: unknown
): payload is AccountDataImportResponse {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    candidate.import_version ===
      "calorieapp-account-data-import-transaction-v1" &&
    ["imported", "already_imported"].includes(String(candidate.status)) &&
    Number.isInteger(candidate.imported_food_log_rows) &&
    Number(candidate.imported_food_log_rows) >= 0 &&
    Number(candidate.imported_food_log_rows) <= 10_000
  );
}

export function isAccountDataImportConfirmationReady(
  userId: string,
  sourceConfirmation: string,
  targetConfirmation: string,
  acknowledged: boolean,
  selectedFile: File | null
): boolean {
  return (
    selectedFile !== null &&
    selectedFile.size > 0 &&
    selectedFile.size <= ACCOUNT_IMPORT_MAX_BYTES &&
    sourceConfirmation.length > 0 &&
    targetConfirmation === userId &&
    acknowledged
  );
}

export function AccountDataImportPanel({
  userId,
  locale,
  onAuthenticationLost,
}: AccountDataImportPanelProps) {
  const localized = getAccountPrivacyCopy(locale);
  const copy = localized.import;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceConfirmation, setSourceConfirmation] = useState("");
  const [targetConfirmation, setTargetConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => requestController.current?.abort();
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSuccess(null);
    if (file && (file.size === 0 || file.size > ACCOUNT_IMPORT_MAX_BYTES)) {
      setSelectedFile(null);
      setError(copy.file_size_invalid);
      event.target.value = "";
      return;
    }
    setError(null);
    setSelectedFile(file);
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !isAccountDataImportConfirmationReady(
        userId,
        sourceConfirmation,
        targetConfirmation,
        acknowledged,
        selectedFile
      ) ||
      !selectedFile
    ) {
      return;
    }

    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = await selectedFile.arrayBuffer();
      if (payload.byteLength === 0 || payload.byteLength > ACCOUNT_IMPORT_MAX_BYTES) {
        setError(copy.file_size_invalid);
        return;
      }

      await waitForBackendReady(BACKEND_WAKE_BASE_URL, controller.signal);
      const response = await backendRequest(
        `${BACKEND_BASE_URL}/${ACCOUNT_IMPORT_PATH}`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            [ACCOUNT_IMPORT_REQUEST_HEADER]: ACCOUNT_IMPORT_REQUEST_VALUE,
            [ACCOUNT_IMPORT_SOURCE_HEADER]: sourceConfirmation,
            [ACCOUNT_IMPORT_TARGET_HEADER]: targetConfirmation,
            [ACCOUNT_IMPORT_ACKNOWLEDGEMENT_HEADER]:
              ACCOUNT_IMPORT_ACKNOWLEDGEMENT,
          },
          body: payload,
          signal: controller.signal,
        }
      );

      if (response.status === 401) {
        requestController.current = null;
        onAuthenticationLost(copy.session_expired);
        return;
      }
      if (response.status === 413) {
        setError(copy.file_size_invalid);
        return;
      }
      if ([400, 415, 422].includes(response.status)) {
        setError(copy.validation_failed);
        return;
      }
      if (response.status === 403 || response.status === 409) {
        setError(copy.import_blocked);
        return;
      }
      if (response.status === 503) {
        setError(copy.temporarily_unavailable);
        return;
      }
      if (!response.ok) {
        throw new Error(`Account import failed with ${response.status}`);
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Account import did not return JSON");
      }
      const responsePayload = (await response.json()) as unknown;
      if (!isAccountDataImportResponse(responsePayload)) {
        throw new Error("Account import returned an unexpected response");
      }

      setSuccess(
        responsePayload.status === "imported"
          ? copy.success
          : copy.already_imported
      );
      setSelectedFile(null);
      setSourceConfirmation("");
      setTargetConfirmation("");
      setAcknowledged(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
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
      }
      if (!controller.signal.aborted) {
        setIsImporting(false);
      }
    }
  }

  return (
    <section
      aria-label={copy.section_label}
      lang={localized.locale}
      dir={localized.direction}
      className="rounded-xl border border-brand-accent/30 bg-brand-accent/5 p-3"
    >
      <p className="text-sm font-semibold text-brand-primary">{copy.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-brand-secondary/90">
        {copy.description}
      </p>

      <form className="mt-3 space-y-3" onSubmit={handleImport}>
        <label className="block text-xs font-semibold text-brand-primary">
          {copy.file_label}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            required
            disabled={isImporting}
            onChange={handleFileChange}
            className="mt-1 block w-full text-xs text-brand-secondary file:mr-3 file:rounded-full file:border-0 file:bg-brand-secondary file:px-4 file:py-2 file:font-semibold file:text-white"
          />
        </label>

        <label className="block text-xs font-semibold text-brand-primary">
          {copy.source_confirmation}
          <input
            type="text"
            value={sourceConfirmation}
            onChange={(event) => setSourceConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={isImporting}
            className="mt-1 block w-full rounded-md border border-brand-secondary/25 bg-white px-3 py-2 font-mono text-xs font-normal text-brand-primary outline-none focus:border-brand-secondary disabled:opacity-70"
          />
        </label>

        <p className="text-xs leading-relaxed text-brand-secondary/90">
          {copy.target_confirmation}
        </p>
        <code className="block break-all rounded-md bg-white px-2 py-1.5 text-xs text-brand-primary">
          {userId}
        </code>
        <label className="block text-xs font-semibold text-brand-primary">
          {copy.target_account_identifier}
          <input
            type="text"
            value={targetConfirmation}
            onChange={(event) => setTargetConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={isImporting}
            className="mt-1 block w-full rounded-md border border-brand-secondary/25 bg-white px-3 py-2 font-mono text-xs font-normal text-brand-primary outline-none focus:border-brand-secondary disabled:opacity-70"
          />
        </label>

        <label className="flex items-start gap-2 text-xs leading-relaxed text-brand-primary">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={isImporting}
            className="mt-0.5"
          />
          <span>{copy.acknowledgement}</span>
        </label>

        <button
          type="submit"
          disabled={
            isImporting ||
            !isAccountDataImportConfirmationReady(
              userId,
              sourceConfirmation,
              targetConfirmation,
              acknowledged,
              selectedFile
            )
          }
          className="inline-flex items-center justify-center rounded-full bg-brand-secondary px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isImporting ? copy.button_busy : copy.button_confirm}
        </button>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800"
          >
            {success}
          </p>
        ) : null}
      </form>
    </section>
  );
}
