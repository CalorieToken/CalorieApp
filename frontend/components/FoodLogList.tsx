"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FoodSearchItem } from "@/components/foodTypes";
import { filterLoggedFoods, getFoodLogFilterCopy } from "@/lib/foodLogFilter";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { diaryCopy } from "@/lib/foodDiary";
import { formatFoodUi, getFoodUi } from "@/lib/foodUi";

type FoodLogListProps = {
  logs: FoodSearchItem[];
  periodFiltered?: boolean;
  total?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh: () => void;
  onSelectLog: (log: FoodSearchItem) => void;
  onDeleteLog: (logId: number) => void;
  onDeleteAllLogs: () => void;
  deletingLogId: number | null;
  isClearingAll: boolean;
  isLoading: boolean;
  formatNumber: (value: number) => string;
};

export function FoodLogList({
  logs,
  periodFiltered = false, total = logs.length, hasMore = false, onLoadMore,
  onRefresh,
  onSelectLog,
  onDeleteLog,
  onDeleteAllLogs,
  deletingLogId,
  isClearingAll,
  isLoading,
  formatNumber,
}: FoodLogListProps) {
  const [filter, setFilter] = useState("");
  const [initialLocale, setLocale] = useState("en");
  const display = useDisplayLanguage();
  const locale = display.enabled ? display.locale : initialLocale;
  const diaryUi = diaryCopy(locale);
  const ui = getFoodUi(display.enabled ? locale : "en");
  const filterId = useId();
  const filterInput = useRef<HTMLInputElement>(null);
  const { copy, direction } = getFoodLogFilterCopy(locale);
  const visibleLogs = useMemo(() => filterLoggedFoods(logs, filter), [logs, filter]);
  const filtering = filter.trim().length > 0;

  useEffect(() => {
    // Follow the existing UI locale precedence without changing sign-in.
    setLocale(getFoodLogFilterCopy(
      new URLSearchParams(window.location.search).get("locale") ||
      document.documentElement.lang || navigator.languages?.join(",") || navigator.language
    ).locale);
  }, []);

  function clearFilter() {
    setFilter("");
    filterInput.current?.focus();
  }

  return (
    <div lang={ui.locale} dir={ui.direction} className="rounded-2xl border border-brand-secondary/20 bg-white p-5 sm:p-6 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-brand-primary">{ui.copy.loggedTitle}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border-2 border-brand-secondary bg-transparent px-4 py-2 text-xs font-semibold text-brand-secondary transition hover:bg-brand-secondary/5 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onRefresh}
            disabled={isLoading || isClearingAll || deletingLogId !== null}
            aria-label={ui.copy.refreshLabel}
          >
            {isLoading ? ui.copy.refreshing : ui.copy.refresh}
          </button>
          <button
            type="button"
            className="rounded-full border-2 border-red-300 bg-transparent px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onDeleteAllLogs}
            disabled={
              isLoading || isClearingAll || deletingLogId !== null || logs.length === 0 || filtering || periodFiltered
            }
            aria-label={ui.copy.deleteAllLabel}
            aria-describedby={filtering || periodFiltered ? `${filterId}-delete-hint` : undefined}
          >
            {isClearingAll ? ui.copy.deleting : ui.copy.deleteAll}
          </button>
        </div>
      </div>

      <div className="mt-4" lang={locale} dir={direction}>
        <label htmlFor={filterId} className="text-sm font-semibold text-brand-primary">
          {copy.label}
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            ref={filterInput}
            id={filterId}
            type="search"
            maxLength={120}
            autoComplete="off"
            spellCheck={false}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Escape") clearFilter(); }}
            placeholder={copy.placeholder}
            aria-describedby={`${filterId}-scope ${filterId}-count`}
            className="min-h-11 min-w-0 flex-1 basis-48 rounded-md border border-brand-secondary/30 bg-white px-3 py-2 text-sm text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary"
          />
          {filter ? (
            <button
              type="button"
              onClick={clearFilter}
              className="min-h-11 rounded-md border border-brand-secondary px-3 py-2 text-sm font-semibold text-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary"
            >
              {copy.clear}
            </button>
          ) : null}
        </div>
        <p id={`${filterId}-scope`} className="mt-2 text-xs text-brand-secondary/80">{diaryUi.listScope}</p>
        <p id={`${filterId}-count`} role="status" className="mt-1 text-xs text-brand-secondary/80">
          {copy.count
            .replace("{shown}", new Intl.NumberFormat(locale).format(visibleLogs.length))
            .replace("{total}", new Intl.NumberFormat(locale).format(logs.length))}
        </p>
        {filtering || periodFiltered ? (
          <p id={`${filterId}-delete-hint`} className="mt-1 text-xs text-brand-secondary/80">{diaryUi.deleteHint}</p>
        ) : null}
        {visibleLogs.length === 0 ? (
          <p className="mt-3 text-sm text-brand-primary">{copy.empty}</p>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2">
        {visibleLogs.map((item, index) => (
          <li
            key={item.id ?? `${item.product_name}-log-${index}`}
            className="rounded-lg border border-brand-secondary/10 bg-brand-bg p-4 hover:bg-brand-secondary/5 transition duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-start"
                onClick={() => onSelectLog(item)}
                aria-label={formatFoodUi(ui.copy.viewDetails, { product: item.product_name })}
              >
                <p className="text-sm font-semibold text-brand-primary"><bdi>{item.product_name}</bdi></p>
                {item.created_at && Number.isFinite(Date.parse(item.created_at)) ? <p className="mt-1 text-xs text-brand-secondary/80"><time dateTime={item.created_at}><bdi>{new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short"}).format(new Date(item.created_at))}</bdi></time></p> : null}
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-brand-secondary/60">{ui.copy.calories}</span>
                    <p className="font-semibold text-brand-accent"><bdi>{formatNumber(item.calories)}</bdi></p>
                  </div>
                  <div>
                    <span className="text-brand-secondary/60">{ui.copy.protein}</span>
                    <p className="font-semibold text-brand-primary"><bdi>{formatNumber(item.protein)}g</bdi></p>
                  </div>
                  <div>
                    <span className="text-brand-secondary/60">{ui.copy.fat}</span>
                    <p className="font-semibold text-brand-primary"><bdi>{formatNumber(item.fat)}g</bdi></p>
                  </div>
                  <div>
                    <span className="text-brand-secondary/60">{ui.copy.carbs}</span>
                    <p className="font-semibold text-brand-primary"><bdi>{formatNumber(item.carbohydrates)}g</bdi></p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                className="shrink-0 rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => item.id && onDeleteLog(item.id)}
                disabled={!item.id || deletingLogId !== null || isClearingAll || isLoading}
                aria-label={formatFoodUi(ui.copy.deleteProduct, { product: item.product_name })}
                title={ui.copy.deleteTitle}
              >
                {deletingLogId === item.id ? ui.copy.deleting : ui.copy.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-brand-secondary/80">{formatFoodUi(diaryUi.loaded, {shown: String(logs.length), total: String(total)})}</p>
      {hasMore ? <button type="button" disabled={isLoading || isClearingAll || deletingLogId !== null} onClick={onLoadMore}
        className="mt-3 min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 text-sm font-semibold text-brand-secondary disabled:opacity-50">{diaryUi.more}</button> : null}
    </div>
  );
}
