"use client";

import { FormEvent } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { formatFoodUi, getFoodUi } from "@/lib/foodUi";

type SearchBarProps = {
  query: string;
  isLoading: boolean;
  retrySeconds?: number;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SearchBar({
  query,
  isLoading,
  retrySeconds = 0,
  onQueryChange,
  onSubmit,
}: SearchBarProps) {
  const display = useDisplayLanguage();
  const { copy, locale, direction } = getFoodUi(display.enabled ? display.locale : "en");
  return (
    <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit} lang={locale} dir={direction}>
      <label htmlFor="food-search" className="sr-only">
        {copy.searchLabel}
      </label>
      <div className="relative min-w-0 flex-1">
        <input
          id="food-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={copy.searchPlaceholder}
          dir="auto"
          className="w-full truncate rounded-full border-2 border-brand-secondary/30 bg-white py-3 ps-5 pe-12 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
          aria-label={copy.searchInputLabel}
          title={query || copy.searchPlaceholder}
        />
        {query ? <button type="button" onClick={() => onQueryChange("")} aria-label={copy.cancel} title={copy.cancel}
          className="absolute inset-y-1 end-1 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-xl font-bold text-brand-secondary hover:bg-brand-secondary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
          <span aria-hidden="true">×</span>
        </button> : null}
      </div>
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary px-8 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 whitespace-nowrap"
        disabled={isLoading || retrySeconds > 0}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            {copy.searching}
          </>
        ) : retrySeconds > 0 ? (
          formatFoodUi(copy.searchWait, { seconds: new Intl.NumberFormat(locale).format(retrySeconds) })
        ) : (
          copy.search
        )}
      </button>
    </form>
  );
}
