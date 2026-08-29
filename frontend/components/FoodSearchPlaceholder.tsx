"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FoodCard } from "@/components/FoodCard";
import { FoodLogList } from "@/components/FoodLogList";
import { LoadingState } from "@/components/LoadingState";
import { SearchBar } from "@/components/SearchBar";
import { FoodSearchItem, FoodSearchResponse } from "@/components/foodTypes";
import Image from "next/image";
import {
  AUTH_STATE_CHANGED_EVENT,
} from "@/components/authEvents";
import type { AuthStateChangedDetail } from "@/components/authEvents";
import {
  BACKEND_WAKE_BASE_URL,
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

function formatLoggedAt(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString();
}

function nutriScoreValue(grade: string | null | undefined): number | null {
  switch ((grade ?? "").toUpperCase()) {
    case "A":
      return 5;
    case "B":
      return 4;
    case "C":
      return 3;
    case "D":
      return 2;
    case "E":
      return 1;
    default:
      return null;
  }
}

function nutriScoreGradeFromValue(value: number): "A" | "B" | "C" | "D" | "E" {
  const rounded = Math.max(1, Math.min(5, Math.round(value)));
  if (rounded === 5) {
    return "A";
  }
  if (rounded === 4) {
    return "B";
  }
  if (rounded === 3) {
    return "C";
  }
  if (rounded === 2) {
    return "D";
  }
  return "E";
}

export function FoodSearchPlaceholder() {
  const searchRequestIdRef = useRef(0);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const logsRequestIdRef = useRef(0);
  const logMutationInFlightRef = useRef(false);
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
  const [deletingLogId, setDeletingLogId] = useState<number | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(SIGN_IN_REQUIRED_LOG_MESSAGE);
  const [didSearch, setDidSearch] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

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
  const averageNutriScore = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const item of logs) {
      const value = nutriScoreValue(item.nutri_score);
      if (value === null) {
        continue;
      }
      total += value;
      count += 1;
    }

    if (count === 0) {
      return {
        count: 0,
        averageValue: null,
        grade: null,
        markerPercent: null,
      };
    }

    const averageValue = total / count;
    const grade = nutriScoreGradeFromValue(averageValue);
    const markerPercent = ((averageValue - 1) / 4) * 100;
    return {
      count,
      averageValue,
      grade,
      markerPercent,
    };
  }, [logs]);
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
    setLogs([]);
    setSelectedLogId(null);
    setPendingLogItem(null);
    setPendingLogIndex(null);
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

    setIsLoading(true);
    setError(null);
    setDidSearch(true);
    setSearchStatus(
      "Connecting to the food service. After inactivity, startup can take up to 90 seconds."
    );

    try {
      await waitForBackendReady(BACKEND_WAKE_BASE_URL, controller.signal);
      setSearchStatus("Searching foods...");

      const response = await backendRequest(
        `${BACKEND_BASE_URL}/search-food?q=${encodeURIComponent(trimmedQuery)}`,
        { signal: controller.signal }
      );

      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error("Search request failed.");
      }

      const data = (await response.json()) as FoodSearchResponse;
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      setResults(normalizeFoodItems(data.results ?? []));
    } catch (requestError) {
      if (!controller.signal.aborted && requestId === searchRequestIdRef.current) {
        setResults([]);
        setError(
          backendUnavailableMessage(
            requestError,
            "Unable to fetch foods right now. Please try again."
          )
        );
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsLoading(false);
        setSearchStatus(null);
      }
    }
  }

  function onLogFood(item: FoodSearchItem, index: number) {
    setPendingLogItem(item);
    setPendingLogIndex(index);
    setPortionOption("whole");
    setCustomPortion("30");
  }

  function cancelPortionLogging() {
    setPendingLogItem(null);
    setPendingLogIndex(null);
    setPortionOption("whole");
    setCustomPortion("30");
  }

  async function confirmPortionLogging() {
    if (logMutationInFlightRef.current) {
      return;
    }

    if (!pendingLogItem || pendingLogIndex === null) {
      return;
    }

    if (selectedPortionPercentage === null) {
      setLogError("Enter a valid custom percentage between 1 and 100.");
      return;
    }

    const payload = scaleNutrition(pendingLogItem, selectedPortionPercentage);

    logMutationInFlightRef.current = true;
    setIsLogging(pendingLogIndex);
    setLogError(null);

    try {
      const response = await backendRequest(`${BACKEND_BASE_URL}/log-food`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        clearPrivateLogState();
        return;
      }

      if (!response.ok) {
        throw new Error("Log request failed.");
      }

      await fetchLogs();
      cancelPortionLogging();
    } catch (requestError) {
      setLogError(
        backendUnavailableMessage(
          requestError,
          "Unable to log this food right now. Please try again."
        )
      );
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

    const confirmed = window.confirm("Clear all food logs?\n\nThis cannot be undone.");
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

  return (
    <section className="space-y-6">
      {/* Search Section */}
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-5 sm:p-6 shadow-md transition duration-200">
        <h2 className="text-lg font-bold text-brand-primary">Search Foods</h2>
        <p className="mt-1 text-sm text-brand-secondary/80">
          Explore product nutrition data provided by Open Food Facts.
        </p>
        <p className="mt-1 text-xs text-brand-secondary/70">
          Only records with complete calorie, protein, fat, and carbohydrate values are shown.
        </p>

        <SearchBar
          query={query}
          isLoading={isLoading}
          onQueryChange={setQuery}
          onSubmit={onSearch}
        />

        {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}

        {!error && !hasResults && !isLoading && !didSearch ? (
          <div className="mt-4">
            <EmptyState
              title="Ready to search"
              description="Enter a food name to view nutrition details and log items."
            />
          </div>
        ) : null}

        {isLoading ? (
          <LoadingState variant="search" message={searchStatus ?? undefined} />
        ) : null}

        {!error && !isLoading && didSearch && !hasResults ? (
          <div className="mt-4">
            <EmptyState
              title="No complete nutrition records found"
              description="Try a broader query like banana, apple, or oats. Records with missing nutrition values are not shown."
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
                onLog={() => onLogFood(item, index)}
                formatNumber={formatNumber}
              />
            ))}
          </ul>
        ) : null}

        {pendingLogItem ? (
          <div className="mt-5 rounded-xl border border-brand-secondary/20 bg-brand-bg p-4 sm:p-5">
            <h3 className="text-sm font-bold text-brand-primary">How much did you eat?</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  portionOption === "whole"
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-secondary/30 bg-white text-brand-secondary hover:bg-brand-secondary/5"
                }`}
                onClick={() => setPortionOption("whole")}
                disabled={isLogging !== null}
              >
                Whole - 100%
              </button>
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  portionOption === "half"
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-secondary/30 bg-white text-brand-secondary hover:bg-brand-secondary/5"
                }`}
                onClick={() => setPortionOption("half")}
                disabled={isLogging !== null}
              >
                Half - 50%
              </button>
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  portionOption === "quarter"
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-secondary/30 bg-white text-brand-secondary hover:bg-brand-secondary/5"
                }`}
                onClick={() => setPortionOption("quarter")}
                disabled={isLogging !== null}
              >
                Quarter - 25%
              </button>
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  portionOption === "custom"
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-secondary/30 bg-white text-brand-secondary hover:bg-brand-secondary/5"
                }`}
                onClick={() => setPortionOption("custom")}
                disabled={isLogging !== null}
              >
                Custom
              </button>
            </div>

            {portionOption === "custom" ? (
              <div className="mt-3 flex items-center gap-2">
                <label htmlFor="custom-portion" className="text-xs font-semibold text-brand-secondary">
                  Custom portion
                </label>
                <input
                  id="custom-portion"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={customPortion}
                  onChange={(event) => setCustomPortion(event.target.value)}
                  disabled={isLogging !== null}
                  className="w-24 rounded-md border border-brand-secondary/30 bg-white px-2 py-1 text-sm text-brand-primary outline-none focus:border-brand-primary"
                />
                <span className="text-xs font-semibold text-brand-secondary">%</span>
              </div>
            ) : null}

            {selectedPortionPercentage === null ? (
              <p className="mt-2 text-xs font-semibold text-red-600">
                Enter a valid custom percentage from 1 to 100.
              </p>
            ) : null}

            {portionPreview ? (
              <div className="mt-4 rounded-lg border border-brand-secondary/10 bg-white p-3">
                <p className="text-xs font-semibold text-brand-primary">You will log</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <p><span className="text-brand-secondary/70">Calories:</span> {formatNumber(portionPreview.calories)} kcal</p>
                  <p><span className="text-brand-secondary/70">Protein:</span> {formatNumber(portionPreview.protein)} g</p>
                  <p><span className="text-brand-secondary/70">Fat:</span> {formatNumber(portionPreview.fat)} g</p>
                  <p><span className="text-brand-secondary/70">Carbohydrates:</span> {formatNumber(portionPreview.carbohydrates)} g</p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border-2 border-brand-secondary bg-white px-4 py-2 text-xs font-semibold text-brand-secondary transition hover:bg-brand-secondary/5"
                onClick={cancelPortionLogging}
                disabled={isLogging !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-brand-primary px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={confirmPortionLogging}
                disabled={selectedPortionPercentage === null || isLogging === pendingLogIndex}
              >
                {isLogging === pendingLogIndex ? "Logging..." : "Log Food"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Logged Foods Section */}
      {logError === SIGN_IN_REQUIRED_LOG_MESSAGE ? (
        <div
          role="status"
          className="rounded-xl border border-brand-secondary/20 bg-brand-primary/5 p-4 text-sm text-brand-secondary"
        >
          <p className="font-semibold text-brand-primary">Sign in to manage your food log</p>
          <p className="mt-1">
            Food search is available to everyone. Sign in with Xaman to save and manage items.
          </p>
          <p className="mt-2 text-xs leading-relaxed">
            On the CalorieToken.net page, Xaman opens without a browser return
            link. After signing, use Close or Back to return to that same page;
            WordPress and CalorieApp will finish signing in together.
          </p>
        </div>
      ) : logError ? (
        <div className="space-y-3">
          <ErrorBanner message={logError} />
          <button
            type="button"
            onClick={fetchLogs}
            disabled={isLogsLoading}
            className="rounded-full border-2 border-brand-secondary bg-white px-5 py-2 text-xs font-semibold text-brand-secondary transition hover:bg-brand-secondary/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLogsLoading ? "Connecting..." : "Retry connection"}
          </button>
        </div>
      ) : null}

      {isLogsLoading ? <LoadingState variant="logs" /> : null}

      {!logError && !isLogsLoading ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-5 sm:p-6 shadow-md">
          <h3 className="text-lg font-bold text-brand-primary">Recent Log Summary</h3>
          <p className="mt-1 text-sm text-brand-secondary/80">
            Totals calculated from the food logs currently loaded below.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-2">
              <dt className="text-brand-secondary/70">Total Calories</dt>
              <dd className="font-semibold text-brand-accent">{formatInteger(summary.calories)} kcal</dd>
            </div>
            <div className="rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-2">
              <dt className="text-brand-secondary/70">Total Protein</dt>
              <dd className="font-semibold text-brand-primary">{formatNumber(summary.protein)} g</dd>
            </div>
            <div className="rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-2">
              <dt className="text-brand-secondary/70">Total Fat</dt>
              <dd className="font-semibold text-brand-primary">{formatNumber(summary.fat)} g</dd>
            </div>
            <div className="rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-2">
              <dt className="text-brand-secondary/70">Total Carbohydrates</dt>
              <dd className="font-semibold text-brand-primary">{formatNumber(summary.carbohydrates)} g</dd>
            </div>
            <div className="rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-2 sm:col-span-2">
              <dt className="text-brand-secondary/70">Foods Logged</dt>
              <dd className="font-semibold text-brand-primary">{summary.count}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-lg border border-brand-secondary/10 bg-brand-bg px-3 py-3">
            <p className="text-sm font-semibold text-brand-primary">Average Nutri-Score of logged foods</p>
            <p className="mt-1 text-xs text-brand-secondary/75">
              {averageNutriScore.grade
                ? `Average Nutri-Score: ${averageNutriScore.grade}`
                : "Average Nutri-Score: unavailable"}
            </p>
            <div className="relative mt-3">
              <div className="h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500" />
              {averageNutriScore.markerPercent !== null ? (
                <span
                  className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-brand-primary shadow"
                  style={{ left: `calc(${averageNutriScore.markerPercent}% - 8px)` }}
                  aria-label={`Average Nutri-Score marker at ${averageNutriScore.grade}`}
                />
              ) : null}
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-semibold text-brand-secondary/70">
              <span>E</span>
              <span>D</span>
              <span>C</span>
              <span>B</span>
              <span>A</span>
            </div>
          </div>
        </div>
      ) : null}

      {selectedLog ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-5 sm:p-6 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-brand-primary">Logged Food Details</h3>
            <button
              type="button"
              className="rounded-full border-2 border-brand-secondary bg-transparent px-4 py-2 text-xs font-semibold text-brand-secondary transition hover:bg-brand-secondary/5"
              onClick={() => setSelectedLogId(null)}
            >
              Back to list
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="h-28 w-full shrink-0 overflow-hidden rounded-lg border border-brand-secondary/15 bg-brand-bg sm:h-28 sm:w-28">
              {selectedLog.image_url ? (
                <Image
                  src={selectedLog.image_url}
                  alt={`${selectedLog.product_name} product image`}
                  className="h-full w-full object-contain"
                  width={112}
                  height={112}
                  sizes="112px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-medium text-brand-secondary/60">
                  No image
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-brand-primary">{selectedLog.product_name}</p>
              {selectedLog.brand ? <p className="mt-1 text-sm text-brand-secondary/80">{selectedLog.brand}</p> : null}
              {selectedLog.barcode ? <p className="mt-2 text-xs text-brand-secondary/75">Barcode: {selectedLog.barcode}</p> : null}
              {selectedLog.serving_size ? (
                <p className="mt-1 text-xs text-brand-secondary/75">Serving: {selectedLog.serving_size}</p>
              ) : null}
              {selectedLog.nutri_score ? (
                <p className="mt-1 text-xs text-brand-secondary/75">Nutri-Score: {selectedLog.nutri_score}</p>
              ) : null}
              <p className="mt-1 text-xs text-brand-secondary/75">
                Portion eaten: {formatNumber(portionForDisplay(selectedLog.portion_percentage))}%
              </p>
              <p className="mt-1 text-xs text-brand-secondary/75">Logged: {formatLoggedAt(selectedLog.created_at)}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-brand-secondary/70">Calories</span>
                  <p className="font-semibold text-brand-accent">{formatNumber(selectedLog.calories)} kcal</p>
                </div>
                <div>
                  <span className="text-brand-secondary/70">Protein</span>
                  <p className="font-semibold text-brand-primary">{formatNumber(selectedLog.protein)}g</p>
                </div>
                <div>
                  <span className="text-brand-secondary/70">Fat</span>
                  <p className="font-semibold text-brand-primary">{formatNumber(selectedLog.fat)}g</p>
                </div>
                <div>
                  <span className="text-brand-secondary/70">Carbs</span>
                  <p className="font-semibold text-brand-primary">{formatNumber(selectedLog.carbohydrates)}g</p>
                </div>
              </div>

              {selectedLog.id ? (
                <button
                  type="button"
                  className="mt-4 rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => onDeleteLog(selectedLog.id as number)}
                  disabled={deletingLogId === selectedLog.id || isClearingAll}
                >
                  {deletingLogId === selectedLog.id ? "Deleting..." : "Delete this log"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!logError && !isLogsLoading && !hasLogs ? (
        <EmptyState
          title="No foods logged yet"
          description="Search and use the Log Food button to build your list."
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
          formatNumber={formatNumber}
        />
      ) : null}
    </section>
  );
}
