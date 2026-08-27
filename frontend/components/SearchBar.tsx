import { FormEvent } from "react";

type SearchBarProps = {
  query: string;
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SearchBar({
  query,
  isLoading,
  onQueryChange,
  onSubmit,
}: SearchBarProps) {
  return (
    <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
      <label htmlFor="food-search" className="sr-only">
        Search for a food product
      </label>
      <input
        id="food-search"
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Try banana, apple, or oats"
        className="w-full rounded-full border-2 border-brand-secondary/30 bg-white px-6 py-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
        aria-label="Search food by product name"
      />
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary px-8 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 whitespace-nowrap"
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Searching...
          </>
        ) : (
          "Search"
        )}
      </button>
    </form>
  );
}
