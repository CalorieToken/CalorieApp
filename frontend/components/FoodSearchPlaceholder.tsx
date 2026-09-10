"use client";

import { createFoodSearchReadiness } from "@/lib/foodSearchReadiness";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FoodCard } from "@/components/FoodCard";
import { FoodLogList } from "@/components/FoodLogList";
import { NutriScoreBar } from "@/components/NutriScoreBar";
import { LoadingState } from "@/components/LoadingState";
import { SearchBar } from "@/components/SearchBar";
import { FoodSearchItem, FoodSearchResponse } from "@/components/foodTypes";
import Image from "next/image";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { countRecordedGrades, formatFoodUi, getFoodUi, recordedGradeStyle, translateFoodStatus } from "@/lib/foodUi";
import { foodSearchRetryAt } from "@/lib/foodSearchAvailability";
import {
  AUTH_STATE_CHANGED_EVENT,
} from "@/components/authEvents";
import type { AuthStateChangedDetail } from "@/components/authEvents";
import {
  BACKEND_WAKE_BASE_URL,
  FOOD_SEARCH_TIMEOUT_MS,
  backendRequest,
  backendUnavailableMessage,
  waitForBackendReady,
} from "@/lib/backendRequest";

const BACKEND_BASE_URL = "/api/backend";
type PortionOption = "whole" | "half" | "quarter" | "custom";
const SIGN_IN_REQUIRED_LOG_MESSAGE =
  "Your session has expired or you are not signed in. Please sign in again to manage food logs.";

function toNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function toOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

function normalizeFoodItem(value: unknown): FoodSearchItem | null {
  const raw = (value ?? {}) as Record<string, unknown>;
  const productName =
    typeof raw.product_name === "string" && raw.product_name.trim().length > 0
      ? raw.product_name
      : "Unknown food";
  const calories = toNumber(raw.calories);
  const protein = toNumber(raw.protein);
  const fat = toNumber(raw.fat);
  const carbohydrates = toNumber(raw.carbohydrates);

  if (
    calories === null ||
    protein === null ||
    fat === null ||
    carbohydrates === null
  ) {
    return null;
  }

  return {
    id: toOptionalNumber(raw.id),
    created_at: toOptionalText(raw.created_at),
    product_name: productName,
    calories,
    protein,
    fat,
    carbohydrates,
    portion_percentage: toOptionalNumber(raw.portion_percentage),
    image_url: toOptionalText(raw.image_url),
    barcode: toOptionalText(raw.barcode),
    brand: toOptionalText(raw.brand),
    serving_size: toOptionalText(raw.serving_size),
    nutri_score: toOptionalText(raw.nutri_score)?.toUpperCase() ?? null,
  };
}

function normalizeFoodItems(values: unknown[]): FoodSearchItem[] {
  return values
    .map(normalizeFoodItem)
    .filter((item): item is FoodSearchItem => item !== null);
}

function getPortionPercentage(option: PortionOption, customValue: string): number | null {
  if (option === "whole") {
    return 100;
  }
  if (option === "half") {
    return 50;
  }
  if (option === "quarter") {
    return 25;
  }

  const parsed = Number(customValue);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < 1 || parsed > 100) {
    return null;
  }
  return parsed;
}

function scaleNutrition(item: FoodSearchItem, percentage: number): FoodSearchItem {
  const factor = percentage / 100;
  return {
    ...item,
    calories: Number((item.calories * factor).toFixed(2)),
    protein: Number((item.protein * factor).toFixed(2)),
    fat: Number((item.fat * factor).toFixed(2)),
    carbohydrates: Number((item.carbohydrates * factor).toFixed(2)),
    portion_percentage: Number(percentage.toFixed(2)),
  };
}

function portionForDisplay(value: number | null | undefined): number {
  return value ?? 100;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0";
  }
  return value.toFixed(1);
}

function formatInteger(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Math.round(value).toLocaleString();
}

function formatLoggedAt(value: string | null | undefined, locale?: string, unknown = "Unknown"): string {
  if (!value) {
    return unknown;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return unknown;
  }
  return date.toLocaleString(locale);
}

export function FoodSearchPlaceholder() {
  const display = useDisplayLanguage();
  const { copy, locale, direction } = getFoodUi(display.enabled ? display.locale : "en");
  const numbers = useMemo(() => ({
    decimal: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }),
    integer: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    percentage: new Intl.NumberFormat(locale, { maximumFractionDigits: 20, useGrouping: false }),
  }), [locale]);
  const displayNumber = (value: number) => display.enabled
    ? numbers.decimal.format(Number(formatNumber(value))) : formatNumber(value);
  const displayInteger = (value: number) => display.enabled
    ? numbers.integer.format(Number.isFinite(value) ? Math.round(value) : 0) : formatInteger(value);
  const displayPercentage = (value: number) => display.enabled ? numbers.percentage.format(value) : String(value);
  const searchReadinessRef = useRef<ReturnType<typeof createFoodSearchReadiness> | null>(null);
  useEffect(() => {
    // Anonymous visitors get the same startup preparation as returning visitors.
    // This only reads public health; no sign-in or provider search is started.
    const readiness = createFoodSearchReadiness();
    searchReadinessRef.current = readiness;
    void readiness.prepare().catch(() => { /* The search action presents any remaining error. */ });
    return () => {
      readiness.dispose();
      if (searchReadinessRef.current === readiness) searchReadinessRef.current = null;
    };
  }, []);
  const searchRequestIdRef = useRef(0);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const searchInFlightRef = useRef(false);
  const searchRetryAtRef = useRef(0);
  const logsRequestIdRef = useRef(0);
  const logMutationInFlightRef = useRef(false);
  const logSelectionIdRef = useRef(0);
  const deleteMutationInFlightRef = useRef(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchItem[]>([]);
  const [logs, setLogs] = useState<FoodSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [isLogging, setIsLogging] = useState<number | null>(null);
  const [pendingLogItem, setPendingLogItem] = useState<FoodSearchItem | null>(null);
  const [pendingLogIndex, setPendingLogIndex] = useState<number | null>(null);
  const [portionOption, setPortionOption] = useState<PortionOption>("whole");
  const [customPortion, setCustomPortion] = useState("30");
  const [portionError, setPortionError] = useState<string | null>(null);
  const [logFeedback, setLogFeedback] = useState<{
    index: number;
    message: string;
    isError: boolean;
    added?: { product: string; percentage: number };
  } | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<number | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(SIGN_IN_REQUIRED_LOG_MESSAGE);
  const [didSearch, setDidSearch] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [searchRetryAt, setSearchRetryAt] = useState(0);
  const [searchWaitSeconds, setSearchWaitSeconds] = useState(0);

  useEffect(() => {
    if (!searchRetryAt) return;
    const update = () => setSearchWaitSeconds(Math.max(0, Math.ceil((searchRetryAt - Date.now()) / 1_000)));
    update();
    const timer = setInterval(() => {
      update();
      if (Date.now() >= searchRetryAt) clearInterval(timer);
    }, 1_000);
    return () => clearInterval(timer);
  }, [searchRetryAt]);

  function pauseSearch(retryAt: number) {
    searchRetryAtRef.current = retryAt;
    setSearchRetryAt(retryAt);
    setSearchWaitSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000)));
  }

  const hasResults = useMemo(() => results.length > 0, [results]);
  const hasLogs = useMemo(() => logs.length > 0, [logs]);
  const summary = useMemo(() => {
    return logs.reduce(
      (totals, item) => {
        totals.calories += item.calories;
        totals.protein += item.protein;
        totals.fat += item.fat;
        totals.carbohydrates += item.carbohydrates;
        totals.count += 1;
        return totals;
      },
      {
        calories: 0,
        protein: 0,
        fat: 0,
        carbohydrates: 0,
        count: 0,
      }
    );
  }, [logs]);
  const selectedLog = useMemo(
    () => logs.find((item) => item.id === selectedLogId) ?? null,
    [logs, selectedLogId]
  );
  const recordedGrades = useMemo(() => countRecordedGrades(logs), [logs]);
  const selectedPortionPercentage = useMemo(
    () => getPortionPercentage(portionOption, customPortion),
    [portionOption, customPortion]
  );
  const portionPreview = useMemo(() => {
    if (!pendingLogItem || selectedPortionPercentage === null) {
      return null;
    }
    return scaleNutrition(pendingLogItem, selectedPortionPercentage);
  }, [pendingLogItem, selectedPortionPercentage]);

  const clearPrivateLogState = useCallback(() => {
    // Invalidate any request that began under the previous authentication
    // state so a late response cannot repopulate another session's logs.
    logsRequestIdRef.current += 1;
    logSelectionIdRef.current += 1;
    setLogs([]);
    setSelectedLogId(null);
    setPendingLogItem(null);
    setPendingLogIndex(null);
    setPortionError(null);
    setLogFeedback(null);
    setIsLogsLoading(false);
    setLogError(SIGN_IN_REQUIRED_LOG_MESSAGE);
  }, []);

  useEffect(() => {
    if (selectedLogId === null) {
      return;
    }
    const exists = logs.some((item) => item.id === selectedLogId);
    if (!exists) {
      setSelectedLogId(null);
    }
  }, [logs, selectedLogId]);

  const fetchLogs = useCallback(async () => {
    const requestId = ++logsRequestIdRef.current;

    setIsLogsLoading(true);
    setLogError(null);
    try {
      const response = await backendRequest(`${BACKEND_BASE_URL}/logs`);
      if (requestId !== logsRequestIdRef.current) {
        return;
      }
      if (response.status === 401) {
        clearPrivateLogState();
        return;
      }
      if (!response.ok) {
        throw new Error("Logs request failed.");
      }
      const data = (await response.json()) as unknown[];
      if (requestId !== logsRequestIdRef.current) {
        return;
      }
      setLogs(normalizeFoodItems(data ?? []));
      setLogError(null);
    } catch (requestError) {
      if (requestId === logsRequestIdRef.current) {
        setLogError(
          backendUnavailableMessage(
            requestError,
            "Unable to load logged foods right now."
          )
        );
      }
    } finally {
      if (requestId === logsRequestIdRef.current) {
        setIsLogsLoading(false);
      }
    }
  }, [clearPrivateLogState]);

  useEffect(() => {
    return () => {
      searchAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    function handleAuthStateChanged(event: Event) {
      const authEvent = event as CustomEvent<AuthStateChangedDetail>;
      if (authEvent.detail?.authenticated) {
        void fetchLogs();
        return;
      }

      // Food logs are private session data. Remove them from the rendered UI
      // immediately when another component completes logout instead of
      // leaving the previous account's entries visible until a page refresh.
      clearPrivateLogState();
    }

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);
    };
  }, [clearPrivateLogState, fetchLogs]);

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter-key submissions and rapid clicks must not cancel/restart a cold start.
    if (logMutationInFlightRef.current || searchInFlightRef.current || Date.now() < searchRetryAtRef.current) return;
    cancelPortionLogging();
    setLogFeedback(null);

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      searchAbortControllerRef.current?.abort();
      searchRequestIdRef.current += 1;
      setResults([]);
      setError("Enter a food name to search.");
      return;
    }

    searchAbortControllerRef.current?.abort();
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;
    const requestId = ++searchRequestIdRef.current;
    searchInFlightRef.current = true;
    pauseSearch(0);

    setIsLoading(true);
    setError(null);
    setDidSearch(true);
    setSearchStatus(
      "Preparing food search. This can take a moment after inactivity."
    );

    try {
      await (searchReadinessRef.current?.prepare(controller.signal) ?? waitForBackendReady(BACKEND_WAKE_BASE_URL, controller.signal));
      setSearchStatus("Searching foods. This can take up to 45 seconds.");

      const response = await backendRequest(
        `${BACKEND_BASE_URL}/search-food?q=${encodeURIComponent(trimmedQuery)}`,
        { signal: controller.signal },
        FOOD_SEARCH_TIMEOUT_MS
      );

      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      if (!response.ok) {
        pauseSearch(foodSearchRetryAt(response.status, response.headers?.get("retry-after") ?? null));
        setResults([]);
        setError(response.status === 429
          ? "Food search is busy. Please wait before searching again."
          : response.status === 504
            ? "The food search took longer than expected. Please try again later."
            : "Food search is temporarily unavailable. Please try again later.");
        return;
      }

      const data = (await response.json()) as FoodSearchResponse;
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      setResults(normalizeFoodItems(data.results ?? []));
    } catch (requestError) {
      if (!controller.signal.aborted && requestId === searchRequestIdRef.current) {
        pauseSearch(foodSearchRetryAt(503, null));
        setResults([]);
        setError(
          backendUnavailableMessage(
            requestError,
            "Unable to fetch foods right now. Please try again.",
            "The food search took longer than expected. Please try again later."
          )
        );
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        searchInFlightRef.current = false;
        setIsLoading(false);
        setSearchStatus(null);
      }
    }
  }

  function onLogFood(item: FoodSearchItem, index: number) {
    if (logMutationInFlightRef.current || isLoading) return;
    logSelectionIdRef.current += 1;
    setPendingLogItem(item);
    setPendingLogIndex(index);
    setPortionOption("whole");
    setCustomPortion("30");
    setPortionError(null);
    setLogFeedback(null);
  }

  function cancelPortionLogging() {
    logSelectionIdRef.current += 1;
    setPendingLogItem(null);
    setPendingLogIndex(null);
    setPortionOption("whole");
    setCustomPortion("30");
    setPortionError(null);
  }

  async function confirmPortionLogging() {
    if (logMutationInFlightRef.current) {
      return;
    }

    if (!pendingLogItem || pendingLogIndex === null) {
      return;
    }

    if (selectedPortionPercentage === null) {
      // The field already presents one inline validation message.
      return;
    }

    const selectionId = logSelectionIdRef.current;
    const payload = scaleNutrition(pendingLogItem, selectedPortionPercentage);

    logMutationInFlightRef.current = true;
    setIsLogging(pendingLogIndex);
    setPortionError(null);

    try {
      const response = await backendRequest(`${BACKEND_BASE_URL}/log-food`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (selectionId !== logSelectionIdRef.current) return;

      if (response.status === 401) {
        clearPrivateLogState();
        setLogFeedback({
          index: pendingLogIndex,
          message: "Sign in with Xaman to save food to your personal log.",
          isError: true,
        });
        return;
      }

      if (response.status === 409) {
        setPortionError(
          "Your private food log has reached its storage limit. Export or delete existing entries before adding more."
        );
        return;
      }

      if (!response.ok) {
        throw new Error("Log request failed.");
      }

      setLogFeedback({
        index: pendingLogIndex,
        message: `Added ${pendingLogItem.product_name} (${selectedPortionPercentage}%) to your food log.`,
        isError: false,
        added: { product: pendingLogItem.product_name, percentage: selectedPortionPercentage },
      });
      await fetchLogs();
      cancelPortionLogging();
    } catch (requestError) {
      if (selectionId === logSelectionIdRef.current) {
        setPortionError(
          backendUnavailableMessage(
            requestError,
            "Unable to log this food right now. Please try again."
          )
        );
      }
    } finally {
      logMutationInFlightRef.current = false;
      setIsLogging(null);
    }
  }

  async function onDeleteLog(logId: number) {
    if (deleteMutationInFlightRef.current) {
      return;
    }

    deleteMutationInFlightRef.current = true;
    setDeletingLogId(logId);
    setLogError(null);
    try {
      const response = await backendRequest(`${BACKEND_BASE_URL}/logs/${logId}`, {
        method: "DELETE",
      });
      if (response.status === 401) {
        clearPrivateLogState();
        return;
      }
      if (response.status === 404) {
        throw new Error("Log entry not found.");
      }
      if (!response.ok) {
        throw new Error("Delete request failed.");
      }
      if (selectedLogId === logId) {
        setSelectedLogId(null);
      }
      await fetchLogs();
    } catch (requestError) {
      setLogError(
        backendUnavailableMessage(
          requestError,
          "Unable to delete this logged food right now. Please try again."
        )
      );
    } finally {
      deleteMutationInFlightRef.current = false;
      setDeletingLogId(null);
    }
  }

  async function onDeleteAllLogs() {
    if (deleteMutationInFlightRef.current) {
      return;
    }

    const confirmed = window.confirm(copy.deleteAllConfirm);
    if (!confirmed) {
      return;
    }

    deleteMutationInFlightRef.current = true;
    setIsClearingAll(true);
    setLogError(null);
    try {
      const response = await backendRequest(`${BACKEND_BASE_URL}/logs`, {
        method: "DELETE",
      });
      if (response.status === 401) {
        clearPrivateLogState();
        return;
      }
      if (!response.ok) {
        throw new Error("Delete-all request failed.");
      }
      setSelectedLogId(null);
      await fetchLogs();
    } catch (requestError) {
      setLogError(
        backendUnavailableMessage(
          requestError,
          "Unable to clear logged foods right now. Please try again."
        )
      );
    } finally {
      deleteMutationInFlightRef.current = false;
      setIsClearingAll(false);
    }
  }

  const portionControls = pendingLogItem ? (
    <form
      className="mt-4 rounded-xl border border-brand-secondary/20 bg-brand-bg p-4 sm:p-5"
      onSubmit={(event) => { event.preventDefault(); void confirmPortionLogging(); }}
      aria-busy={isLogging !== null}
    >
      <h3 className="text-sm font-bold text-brand-primary">{copy.portionTitle}</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary ${
            portionOption === "whole"
              ? "border-brand-primary bg-brand-primary text-white"
              : "border-brand-secondary/30 bg-white text-brand-secondary hover:bg-brand-secondary/5"
          }`}
          onClick={() => setPortionOption("whole")}
          aria-pressed={portionOption === "whole"}
          disabled={isLogging !== null}
        >
          {copy.whole}
        </button>
        <button
          type="button"
          className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary ${
            portionOption === "half"
              ? "border-brand-primary bg-brand-primary text-white"
              : "border-brand-secondary/30 bg-white text-brand-secondary hover:bg-brand-secondary/5"
          }`}
          onClick={() => setPortionOption("half")}
          aria-pressed={portionOption === "half"}
          disabled={isLogging !== null}
        >
          {copy.half}
        </button>
        <button
          type="button"
          className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary ${
            portionOption === "quarter"
              ? "border-brand-primary bg-brand-primary text-white"
              : "border-brand-secondary/30 bg-white text-brand-secondary hover:bg-brand-secondary/5"
          }`}
          onClick={() => setPortionOption("quarter")}
          aria-pressed={portionOption === "quarter"}
          disabled={isLogging !== null}
        >
          {copy.quarter}
        </button>
        <button
          type="button"
          className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary ${
            portionOption === "custom"
              ? "border-brand-primary bg-brand-primary text-white"
              : "border-brand-secondary/30 bg-white text-brand-secondary hover:bg-brand-secondary/5"
          }`}
          onClick={() => setPortionOption("custom")}
          aria-pressed={portionOption === "custom"}
          disabled={isLogging !== null}
        >
          {copy.custom}
        </button>
      </div>

      {portionOption === "custom" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="custom-portion" className="text-xs font-semibold text-brand-secondary">
            {copy.customPortion}
          </label>
          <input
            id="custom-portion"
            type="number"
            dir="ltr"
            inputMode="numeric"
            min={1}
            max={100}
            step="any"
            aria-invalid={selectedPortionPercentage === null}
            aria-describedby={selectedPortionPercentage === null ? "portion-validation" : undefined}
            value={customPortion}
            onChange={(event) => setCustomPortion(event.target.value)}
            disabled={isLogging !== null}
            className="min-h-11 w-24 rounded-md border border-brand-secondary/30 bg-white px-2 py-1 text-sm text-brand-primary outline-none focus:border-brand-primary"
          />
          <span className="text-xs font-semibold text-brand-secondary">%</span>
        </div>
      ) : null}

      {selectedPortionPercentage === null ? (
        <p id="portion-validation" className="mt-2 text-xs font-semibold text-red-600">
          {copy.invalidPortion}
        </p>
      ) : null}

      {portionPreview ? (
        <div className="mt-4 rounded-lg border border-brand-secondary/10 bg-white p-3">
          <p className="text-xs text-brand-secondary/80">{formatFoodUi(copy.portionPreview, { percentage: displayPercentage(selectedPortionPercentage ?? 100) })}</p>
          <p className="mt-1 break-words text-sm font-bold text-brand-primary"><bdi>{pendingLogItem.product_name}</bdi></p>
          {pendingLogItem.brand ? <p className="mt-1 break-words text-xs text-brand-secondary/80"><bdi>{pendingLogItem.brand}</bdi></p> : null}
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <p><span className="text-brand-secondary/70">{copy.calories}:</span> <bdi>{displayNumber(portionPreview.calories)} kcal</bdi></p>
            <p><span className="text-brand-secondary/70">{copy.protein}:</span> <bdi>{displayNumber(portionPreview.protein)} g</bdi></p>
            <p><span className="text-brand-secondary/70">{copy.fat}:</span> <bdi>{displayNumber(portionPreview.fat)} g</bdi></p>
            <p><span className="text-brand-secondary/70">{copy.carbohydrates}:</span> <bdi>{displayNumber(portionPreview.carbohydrates)} g</bdi></p>
          </div>
        </div>
      ) : null}

      {portionError ? <div className="mt-3"><ErrorBanner message={translateFoodStatus(portionError, copy)} /></div> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="min-h-11 rounded-full border-2 border-brand-secondary bg-white px-4 py-2 text-xs font-semibold text-brand-secondary transition hover:bg-brand-secondary/5"
          onClick={cancelPortionLogging}
          disabled={isLogging !== null}
        >
          {copy.cancel}
        </button>
        <button
          type="submit"
          className="min-h-11 rounded-full bg-brand-primary px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={selectedPortionPercentage === null || isLogging === pendingLogIndex}
        >
          {isLogging === pendingLogIndex ? copy.adding : copy.addToLog}
        </button>
      </div>
    </form>
  ) : null;

  return (
    <section className="space-y-6" lang={locale} dir={direction}>
      {/* Search Section */}
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-5 sm:p-6 shadow-md transition duration-200">
        <h2 className="text-lg font-bold text-brand-primary">{copy.searchTitle}</h2>
        <p className="mt-1 text-sm text-brand-secondary/80">
          {copy.searchIntro}
        </p>
        <p className="mt-1 text-xs text-brand-secondary/70">
          {copy.completeOnly}
        </p>

        <SearchBar
          query={query}
          isLoading={isLoading}
          retrySeconds={searchWaitSeconds}
          onQueryChange={setQuery}
          onSubmit={onSearch}
        />

        {error ? <div className="mt-4"><ErrorBanner message={translateFoodStatus(error, copy)} /></div> : null}
        {searchWaitSeconds > 0 ? <p className="mt-3 text-sm text-brand-secondary" role="status">{copy.searchCooldownNotice}</p> : null}

        {!error && !hasResults && !isLoading && !didSearch ? (
          <div className="mt-4">
            <EmptyState
              title={copy.readyTitle}
              description={copy.readyDescription}
            />
          </div>
        ) : null}

        {isLoading ? (
          <div>
            <LoadingState variant="search" message={searchStatus ? translateFoodStatus(searchStatus, copy) : undefined} />
            <p className="mt-2 text-sm text-brand-secondary">{copy.searchStartupHint}</p>
          </div>
        ) : null}

        {!error && !isLoading && didSearch && !hasResults ? (
          <div className="mt-4">
            <EmptyState
              title={copy.noResultsTitle}
              description={copy.noResultsDescription}
            />
          </div>
        ) : null}

        {hasResults ? (
          <ul className="mt-5 space-y-3">
            {results.map((item, index) => (
              <FoodCard
                key={`${item.product_name}-${index}`}
                item={item}
                isLogging={isLogging === index}
                isDisabled={isLogging !== null || isLoading}
                feedback={logFeedback?.index === index ? {
                  ...logFeedback,
                  message: logFeedback.added
                    ? formatFoodUi(copy.addedFeedback, { product: logFeedback.added.product, percentage: displayPercentage(logFeedback.added.percentage) })
                    : translateFoodStatus(logFeedback.message, copy),
                } : null}
                onLog={() => onLogFood(item, index)}
                formatNumber={displayNumber}
              >
                {pendingLogIndex === index ? portionControls : null}
              </FoodCard>
            ))}
          </ul>
        ) : null}

      </div>

      {/* Logged Foods Section */}
      {logError === SIGN_IN_REQUIRED_LOG_MESSAGE ? (
        <div
          role="status"
          className="rounded-xl border border-brand-secondary/20 bg-brand-primary/5 p-4 text-sm text-brand-secondary"
        >
          <p className="font-semibold text-brand-primary">{copy.signInTitle}</p>
          <p className="mt-1">
            {copy.signInDescription}
          </p>
          <p className="mt-2 text-xs leading-relaxed">
            {copy.signInReturn}
          </p>
        </div>
      ) : logError ? (
        <div className="space-y-3">
          <ErrorBanner message={translateFoodStatus(logError, copy)} />
          <button
            type="button"
            onClick={fetchLogs}
            disabled={isLogsLoading}
            className="rounded-full border-2 border-brand-secondary bg-white px-5 py-2 text-xs font-semibold text-brand-secondary transition hover:bg-brand-secondary/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLogsLoading ? copy.connecting : copy.retry}
          </button>
        </div>
      ) : null}

      {isLogsLoading ? <LoadingState variant="logs" /> : null}

      {!logError && !isLogsLoading ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-5 sm:p-6 shadow-md">
          <h3 className="text-lg font-bold text-brand-primary">{copy.summaryTitle}</h3>
          <p className="mt-1 text-sm text-brand-secondary/80">
            {copy.summaryDescription}
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-2">
              <dt className="text-brand-secondary/70">{copy.totalCalories}</dt>
              <dd className="font-semibold text-brand-accent"><bdi>{displayInteger(summary.calories)} kcal</bdi></dd>
            </div>
            <div className="rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-2">
              <dt className="text-brand-secondary/70">{copy.totalProtein}</dt>
              <dd className="font-semibold text-brand-primary"><bdi>{displayNumber(summary.protein)} g</bdi></dd>
            </div>
            <div className="rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-2">
              <dt className="text-brand-secondary/70">{copy.totalFat}</dt>
              <dd className="font-semibold text-brand-primary"><bdi>{displayNumber(summary.fat)} g</bdi></dd>
            </div>
            <div className="rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-2">
              <dt className="text-brand-secondary/70">{copy.totalCarbohydrates}</dt>
              <dd className="font-semibold text-brand-primary"><bdi>{displayNumber(summary.carbohydrates)} g</bdi></dd>
            </div>
            <div className="rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-2 sm:col-span-2">
              <dt className="text-brand-secondary/70">{copy.foodsLogged}</dt>
              <dd className="font-semibold text-brand-primary"><bdi>{displayInteger(summary.count)}</bdi></dd>
            </div>
          </dl>

          <div className="mt-4 rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-3">
            <p className="text-sm font-semibold text-brand-primary">{copy.scoreTitle}</p>
            <p className="mt-1 text-xs text-brand-secondary/75">{copy.scoreDescription}</p>
            <p className="mt-2 text-xs text-brand-secondary/75">
              {formatFoodUi(copy.scoreCoverage, { known: displayInteger(recordedGrades.known), total: displayInteger(recordedGrades.total) })}
            </p>
            <dl className="mt-3 grid grid-cols-5 overflow-hidden rounded-xl text-center text-sm" aria-label={copy.scoreTitle} dir="ltr">
              {recordedGrades.grades.map(({ grade, count }) => (
                <div key={grade} className="min-w-0 border-r border-white/40 px-1 py-3 last:border-r-0" style={recordedGradeStyle(grade)}>
                  <dt className="font-bold"><bdi dir="ltr">{grade}</bdi></dt>
                  <dd className="mt-1"><bdi>{displayInteger(count)}</bdi></dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-brand-secondary/75">{copy.scoreMissing}: <bdi>{displayInteger(recordedGrades.missing)}</bdi></p>
          </div>
        </div>
      ) : null}

      {selectedLog ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-5 sm:p-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-brand-primary">{copy.detailsTitle}</h3>
            <button
              type="button"
              className="rounded-full border-2 border-brand-secondary bg-transparent px-4 py-2 text-xs font-semibold text-brand-secondary transition hover:bg-brand-secondary/5"
              onClick={() => setSelectedLogId(null)}
            >
              {copy.backToList}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="h-28 w-full shrink-0 overflow-hidden rounded-lg border border-brand-secondary/15 bg-brand-bg sm:h-28 sm:w-28">
              {selectedLog.image_url ? (
                <Image
                  src={selectedLog.image_url}
                  alt={formatFoodUi(copy.productImage, { product: selectedLog.product_name })}
                  className="h-full w-full object-contain"
                  width={112}
                  height={112}
                  sizes="112px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-medium text-brand-secondary/60">
                  {copy.noImage}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-brand-primary"><bdi>{selectedLog.product_name}</bdi></p>
              {selectedLog.brand ? <p className="mt-1 text-sm text-brand-secondary/80"><bdi>{selectedLog.brand}</bdi></p> : null}
              {selectedLog.barcode ? <p className="mt-2 text-xs text-brand-secondary/75">{copy.barcode}: <bdi dir="ltr">{selectedLog.barcode}</bdi></p> : null}
              {selectedLog.serving_size ? (
                <p className="mt-1 text-xs text-brand-secondary/75">{copy.serving}: <bdi>{selectedLog.serving_size}</bdi></p>
              ) : null}
              <NutriScoreBar grade={selectedLog.nutri_score} />
              <p className="mt-1 text-xs text-brand-secondary/75">
                {copy.portionEaten}: <bdi>{displayNumber(portionForDisplay(selectedLog.portion_percentage))}%</bdi>
              </p>
              <p className="mt-1 text-xs text-brand-secondary/75">{copy.loggedAt}: <bdi>{formatLoggedAt(selectedLog.created_at, display.enabled ? locale : undefined, copy.unknownDate)}</bdi></p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-brand-secondary/70">{copy.calories}</span>
                  <p className="font-semibold text-brand-accent"><bdi>{displayNumber(selectedLog.calories)} kcal</bdi></p>
                </div>
                <div>
                  <span className="text-brand-secondary/70">{copy.protein}</span>
                  <p className="font-semibold text-brand-primary"><bdi>{displayNumber(selectedLog.protein)}g</bdi></p>
                </div>
                <div>
                  <span className="text-brand-secondary/70">{copy.fat}</span>
                  <p className="font-semibold text-brand-primary"><bdi>{displayNumber(selectedLog.fat)}g</bdi></p>
                </div>
                <div>
                  <span className="text-brand-secondary/70">{copy.carbs}</span>
                  <p className="font-semibold text-brand-primary"><bdi>{displayNumber(selectedLog.carbohydrates)}g</bdi></p>
                </div>
              </div>

              {selectedLog.id ? (
                <button
                  type="button"
                  className="mt-4 rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => onDeleteLog(selectedLog.id as number)}
                  disabled={deletingLogId === selectedLog.id || isClearingAll}
                >
                  {deletingLogId === selectedLog.id ? copy.deleting : copy.deleteThis}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!logError && !isLogsLoading && !hasLogs ? (
        <EmptyState
          title={copy.emptyLogsTitle}
          description={copy.emptyLogsDescription}
        />
      ) : null}

      {hasLogs ? (
        <FoodLogList
          logs={logs}
          onRefresh={fetchLogs}
          onSelectLog={(log) => setSelectedLogId(log.id ?? null)}
          onDeleteLog={onDeleteLog}
          onDeleteAllLogs={onDeleteAllLogs}
          deletingLogId={deletingLogId}
          isClearingAll={isClearingAll}
          isLoading={isLogsLoading}
          formatNumber={displayNumber}
        />
      ) : null}
    </section>
  );
}
