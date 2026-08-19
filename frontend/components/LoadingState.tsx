type LoadingStateProps = {
  variant: "search" | "logs";
};

export function LoadingState({ variant }: LoadingStateProps) {
  if (variant === "logs") {
    return (
      <div className="mt-4 space-y-2" aria-live="polite" aria-busy="true">
        <div className="h-14 rounded-lg bg-brand-secondary/10 animate-pulse" />
        <div className="h-14 rounded-lg bg-brand-secondary/10 animate-pulse" />
      </div>
    );
  }

  return (
    <ul className="mt-5 space-y-3" aria-live="polite" aria-busy="true">
      <li className="rounded-xl border border-brand-secondary/15 bg-white p-5 shadow-sm">
        <div className="h-5 w-2/3 rounded bg-brand-secondary/10 animate-pulse" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
          <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
          <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
          <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
        </div>
        <div className="mt-4 h-8 w-28 rounded-full bg-brand-primary/20 animate-pulse" />
      </li>
      <li className="rounded-xl border border-brand-secondary/15 bg-white p-5 shadow-sm">
        <div className="h-5 w-1/2 rounded bg-brand-secondary/10 animate-pulse" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
          <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
          <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
          <div className="h-10 rounded bg-brand-secondary/10 animate-pulse" />
        </div>
        <div className="mt-4 h-8 w-28 rounded-full bg-brand-primary/20 animate-pulse" />
      </li>
    </ul>
  );
}
