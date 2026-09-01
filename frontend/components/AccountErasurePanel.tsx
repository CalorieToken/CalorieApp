"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  BACKEND_WAKE_BASE_URL,
  backendRequest,
  backendUnavailableMessage,
  waitForBackendReady,
} from "@/lib/backendRequest";
import {
  ACCOUNT_ERASURE_REQUEST_HEADER,
  ACCOUNT_ERASURE_REQUEST_VALUE,
} from "@/lib/accountErasureRequest";

const BACKEND_BASE_URL = "/api/backend";
const ACCOUNT_ERASURE_ACKNOWLEDGEMENT = "delete-my-calorieapp-account";

type AccountErasurePanelProps = {
  userId: string;
  onAuthenticationLost: (message: string) => void;
  onErased: () => void;
};

export function isAccountErasureResponse(payload: unknown): boolean {
  return (
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    (payload as Record<string, unknown>).status === "erased"
  );
}

export function isAccountErasureConfirmationReady(
  userId: string,
  confirmation: string,
  acknowledged: boolean
): boolean {
  return acknowledged && confirmation === userId;
}

export function AccountErasurePanel({
  userId,
  onAuthenticationLost,
  onErased,
}: AccountErasurePanelProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => requestController.current?.abort();
  }, []);

  function closeReview() {
    if (isErasing) {
      return;
    }
    setIsReviewing(false);
    setConfirmation("");
    setAcknowledged(false);
    setError(null);
  }

  async function handleErase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !isAccountErasureConfirmationReady(
        userId,
        confirmation,
        acknowledged
      )
    ) {
      return;
    }

    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setIsErasing(true);
    setError(null);

    try {
      await waitForBackendReady(BACKEND_WAKE_BASE_URL, controller.signal);
      const response = await backendRequest(
        `${BACKEND_BASE_URL}/api/identity/account`,
        {
          method: "DELETE",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            [ACCOUNT_ERASURE_REQUEST_HEADER]: ACCOUNT_ERASURE_REQUEST_VALUE,
          },
          body: JSON.stringify({
            confirm_user_id: confirmation,
            acknowledgement: ACCOUNT_ERASURE_ACKNOWLEDGEMENT,
          }),
          signal: controller.signal,
        }
      );

      if (response.status === 401) {
        requestController.current = null;
        onAuthenticationLost(
          "Your session expired. Sign in again before managing your account. No data was deleted."
        );
        return;
      }
      if (response.status === 409) {
        setError(
          "Deletion stopped safely because the account confirmation or older identity ownership could not be verified. No data was deleted."
        );
        return;
      }
      if (response.status === 503) {
        setError(
          "Account deletion is currently unavailable. No data was deleted."
        );
        return;
      }
      if (!response.ok) {
        throw new Error(`Account deletion failed with ${response.status}`);
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Account deletion did not return JSON");
      }

      const payload = (await response.json()) as unknown;
      if (!isAccountErasureResponse(payload)) {
        throw new Error("Account deletion returned an unexpected response");
      }

      requestController.current = null;
      onErased();
    } catch (requestError) {
      if (controller.signal.aborted) {
        return;
      }
      setError(
        backendUnavailableMessage(
          requestError,
          "Your account could not be deleted right now. No deletion was confirmed. Please try again later."
        )
      );
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
      }
      if (!controller.signal.aborted) {
        setIsErasing(false);
      }
    }
  }

  return (
    <section
      aria-label="Delete CalorieApp account"
      className="rounded-xl border border-red-200 bg-red-50/70 p-3"
    >
      <p className="text-sm font-semibold text-red-900">
        Delete your CalorieApp account
      </p>
      <p className="mt-1 text-xs leading-relaxed text-red-900/90">
        If enabled after release review, this permanently removes your directly
        owned CalorieApp account, food-log history, identity link, sessions, and
        browser handoffs from the primary database immediately. There is no
        recovery window. Encrypted backups may retain a protected copy for at
        most 30 days. Separate WordPress or Xaman accounts, public XRPL data,
        and third-party source data are not deleted.
      </p>

      {!isReviewing ? (
        <button
          type="button"
          onClick={() => setIsReviewing(true)}
          className="mt-3 inline-flex items-center justify-center rounded-full border border-red-700 px-5 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-700 hover:text-white"
        >
          Review account deletion
        </button>
      ) : (
        <form className="mt-3 space-y-3" onSubmit={handleErase}>
          <p className="text-xs leading-relaxed text-red-950">
            Download your private export first if you want a copy. Then type
            this exact account identifier to confirm:
          </p>
          <code className="block break-all rounded-md bg-white px-2 py-1.5 text-xs text-red-950">
            {userId}
          </code>
          <label className="block text-xs font-semibold text-red-950">
            Account identifier
            <input
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={isErasing}
              className="mt-1 block w-full rounded-md border border-red-300 bg-white px-3 py-2 font-mono text-xs font-normal text-red-950 outline-none focus:border-red-700 disabled:opacity-70"
            />
          </label>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-red-950">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              disabled={isErasing}
              className="mt-0.5"
            />
            <span>
              I understand that primary CalorieApp data is deleted immediately,
              cannot be recovered through the app, and that this does not delete
              separate WordPress, Xaman, XRPL, or third-party data.
            </span>
          </label>

          {error ? (
            <p role="alert" className="rounded-lg bg-white px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={
                isErasing ||
                !isAccountErasureConfirmationReady(
                  userId,
                  confirmation,
                  acknowledged
                )
              }
              className="inline-flex items-center justify-center rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isErasing
                ? "Deleting CalorieApp account..."
                : "Delete CalorieApp account permanently"}
            </button>
            <button
              type="button"
              onClick={closeReview}
              disabled={isErasing}
              className="inline-flex items-center justify-center rounded-full border border-red-300 px-5 py-2 text-sm font-semibold text-red-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
