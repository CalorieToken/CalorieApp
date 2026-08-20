import { FoodSearchItem } from "@/components/foodTypes";

type FoodLogListProps = {
  logs: FoodSearchItem[];
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
  onRefresh,
  onSelectLog,
  onDeleteLog,
  onDeleteAllLogs,
  deletingLogId,
  isClearingAll,
  isLoading,
  formatNumber,
}: FoodLogListProps) {
  return (
    <div className="rounded-2xl border border-brand-secondary/20 bg-white p-5 sm:p-6 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-brand-primary">Logged Foods</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border-2 border-brand-secondary bg-transparent px-4 py-2 text-xs font-semibold text-brand-secondary transition hover:bg-brand-secondary/5 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onRefresh}
            disabled={isLoading || isClearingAll}
            aria-label="Refresh logged foods"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            className="rounded-full border-2 border-red-300 bg-transparent px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onDeleteAllLogs}
            disabled={isLoading || isClearingAll || logs.length === 0}
            aria-label="Delete all logged foods"
          >
            {isClearingAll ? "Deleting..." : "Delete All"}
          </button>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {logs.map((item, index) => (
          <li
            key={item.id ?? `${item.product_name}-log-${index}`}
            className="rounded-lg border border-brand-secondary/10 bg-brand-bg p-4 hover:bg-brand-secondary/5 transition duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onSelectLog(item)}
                aria-label={`View details for ${item.product_name}`}
              >
                <p className="text-sm font-semibold text-brand-primary">{item.product_name}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-brand-secondary/60">Calories</span>
                    <p className="font-semibold text-brand-accent">{formatNumber(item.calories)}</p>
                  </div>
                  <div>
                    <span className="text-brand-secondary/60">Protein</span>
                    <p className="font-semibold text-brand-primary">{formatNumber(item.protein)}g</p>
                  </div>
                  <div>
                    <span className="text-brand-secondary/60">Fat</span>
                    <p className="font-semibold text-brand-primary">{formatNumber(item.fat)}g</p>
                  </div>
                  <div>
                    <span className="text-brand-secondary/60">Carbs</span>
                    <p className="font-semibold text-brand-primary">{formatNumber(item.carbohydrates)}g</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                className="shrink-0 rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => item.id && onDeleteLog(item.id)}
                disabled={!item.id || deletingLogId === item.id || isClearingAll}
                aria-label={`Delete ${item.product_name}`}
                title="Delete logged food"
              >
                {deletingLogId === item.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
