"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FoodCard } from "@/components/FoodCard";
import { FoodLogList } from "@/components/FoodLogList";
import { LoadingState } from "@/components/LoadingState";
import { SearchBar } from "@/components/SearchBar";
import { FoodSearchItem, FoodSearchResponse } from "@/components/foodTypes";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

function toNumber(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
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

function normalizeFoodItem(value: unknown): FoodSearchItem {
  const raw = (value ?? {}) as Record<string, unknown>;
  const productName =
    typeof raw.product_name === "string" && raw.product_name.trim().length > 0
      ? raw.product_name
      : "Unknown food";

  return {
    product_name: productName,
    calories: toNumber(raw.calories),
    protein: toNumber(raw.protein),
    fat: toNumber(raw.fat),
    carbohydrates: toNumber(raw.carbohydrates),
    image_url: toOptionalText(raw.image_url),
    barcode: toOptionalText(raw.barcode),
  };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0";
  }
  return value.toFixed(1);
}

export function FoodSearchPlaceholder() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchItem[]>([]);
  const [logs, setLogs] = useState<FoodSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [isLogging, setIsLogging] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [didSearch, setDidSearch] = useState(false);

  const hasResults = useMemo(() => results.length > 0, [results]);
  const hasLogs = useMemo(() => logs.length > 0, [logs]);

  async function fetchLogs() {
    if (!BACKEND_BASE_URL) {
      setLogError("Backend URL is not configured. Set NEXT_PUBLIC_BACKEND_URL.");
      return;
    }

    setIsLogsLoading(true);
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/logs`);
      if (!response.ok) {
        throw new Error("Logs request failed.");
      }
      const data = (await response.json()) as unknown[];
      setLogs((data ?? []).map(normalizeFoodItem));
      setLogError(null);
    } catch {
      setLogError("Unable to load logged foods right now.");
    } finally {
      setIsLogsLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!BACKEND_BASE_URL) {
      setError("Backend URL is not configured. Set NEXT_PUBLIC_BACKEND_URL.");
      return;
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setError("Enter a food name to search.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setDidSearch(true);

    try {
      const response = await fetch(
        `${BACKEND_BASE_URL}/search-food?q=${encodeURIComponent(trimmedQuery)}`
      );

      if (!response.ok) {
        throw new Error("Search request failed.");
      }

      const data = (await response.json()) as FoodSearchResponse;
      setResults((data.results ?? []).map(normalizeFoodItem));
    } catch {
      setResults([]);
      setError("Unable to fetch foods right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onLogFood(item: FoodSearchItem, index: number) {
    if (!BACKEND_BASE_URL) {
      setLogError("Backend URL is not configured. Set NEXT_PUBLIC_BACKEND_URL.");
      return;
    }

    setIsLogging(index);
    setLogError(null);

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/log-food`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      });

      if (!response.ok) {
        throw new Error("Log request failed.");
      }

      await fetchLogs();
    } catch {
      setLogError("Unable to log this food right now. Please try again.");
    } finally {
      setIsLogging(null);
    }
  }

  return (
    <section className="space-y-6">
      {/* Search Section */}
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-5 sm:p-6 shadow-md transition duration-200">
        <h2 className="text-lg font-bold text-brand-primary">Search Foods</h2>
        <p className="mt-1 text-sm text-brand-secondary/80">
          Find nutrition info from our database
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

        {isLoading ? <LoadingState variant="search" /> : null}

        {!error && !isLoading && didSearch && !hasResults ? (
          <div className="mt-4">
            <EmptyState
              title="No matching foods"
              description="Try a broader query like banana, apple, or oats."
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
      </div>

      {/* Logged Foods Section */}
      {logError ? <ErrorBanner message={logError} /> : null}

      {isLogsLoading ? <LoadingState variant="logs" /> : null}

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
          isLoading={isLogsLoading}
          formatNumber={formatNumber}
        />
      ) : null}
    </section>
  );
}
