import { FoodSearchItem } from "@/components/foodTypes";

type FoodLogListProps = {
  logs: FoodSearchItem[];
  onRefresh: () => void;
  isLoading: boolean;
  formatNumber: (value: number) => string;
};

export function FoodLogList({ logs, onRefresh, isLoading, formatNumber }: FoodLogListProps) {
  return (
    <div className="rounded-2xl border border-brand-secondary/20 bg-white p-5 sm:p-6 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-brand-primary">Logged Foods</h3>
        <button
          type="button"
          className="rounded-full border-2 border-brand-secondary bg-transparent px-4 py-2 text-xs font-semibold text-brand-secondary transition hover:bg-brand-secondary/5 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh logged foods"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {logs.map((item, index) => (
          <li
            key={`${item.product_name}-log-${index}`}
            className="rounded-lg border border-brand-secondary/10 bg-brand-bg p-4 hover:bg-brand-secondary/5 transition duration-200"
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
          </li>
        ))}
      </ul>
    </div>
  );
}
