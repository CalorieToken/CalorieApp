import { FoodSearchItem } from "@/components/foodTypes";

type FoodCardProps = {
  item: FoodSearchItem;
  isLogging: boolean;
  onLog: () => void;
  formatNumber: (value: number) => string;
};

export function FoodCard({ item, isLogging, onLog, formatNumber }: FoodCardProps) {
  return (
    <li className="rounded-xl border border-brand-secondary/15 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition duration-200">
      <p className="text-base font-semibold text-brand-primary">{item.product_name}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <span className="text-brand-secondary/70">Calories</span>
          <p className="font-semibold text-brand-accent">{formatNumber(item.calories)} kcal</p>
        </div>
        <div>
          <span className="text-brand-secondary/70">Protein</span>
          <p className="font-semibold text-brand-primary">{formatNumber(item.protein)}g</p>
        </div>
        <div>
          <span className="text-brand-secondary/70">Fat</span>
          <p className="font-semibold text-brand-primary">{formatNumber(item.fat)}g</p>
        </div>
        <div>
          <span className="text-brand-secondary/70">Carbs</span>
          <p className="font-semibold text-brand-primary">{formatNumber(item.carbohydrates)}g</p>
        </div>
      </div>
      <button
        type="button"
        className="mt-4 rounded-full bg-brand-primary px-6 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onLog}
        disabled={isLogging}
        aria-busy={isLogging}
        aria-label={`Log ${item.product_name}`}
      >
        {isLogging ? "Logging..." : "Log Food"}
      </button>
    </li>
  );
}
