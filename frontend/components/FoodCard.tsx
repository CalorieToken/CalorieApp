"use client";

import { FoodSearchItem } from "@/components/foodTypes";
import Image from "next/image";
import { ReactNode, useEffect, useId, useRef, useState } from "react";

type FoodCardProps = {
  item: FoodSearchItem;
  isLogging: boolean;
  isDisabled?: boolean;
  onLog: () => void;
  formatNumber: (value: number) => string;
  children?: ReactNode;
  feedback?: { message: string; isError: boolean } | null;
};

export function FoodCard({ item, isLogging, isDisabled = false, onLog, formatNumber, children, feedback }: FoodCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const portionId = useId();
  const portionRef = useRef<HTMLDivElement>(null);
  const logButtonRef = useRef<HTMLButtonElement>(null);
  const wasExpandedRef = useRef(false);
  const isExpanded = Boolean(children);
  const showImage = Boolean(item.image_url) && !imageFailed;

  useEffect(() => {
    if (isExpanded && !wasExpandedRef.current) {
      portionRef.current?.focus({ preventScroll: true });
      portionRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
    } else if (!isExpanded && wasExpandedRef.current) {
      if (isDisabled || isLogging) return;
      // Restore keyboard focus after the portion controls are removed, while
      // leaving focus alone if the user has moved to another product or search.
      if (document.activeElement === document.body) {
        logButtonRef.current?.focus({ preventScroll: true });
      }
    }
    wasExpandedRef.current = isExpanded;
  }, [isExpanded, isDisabled, isLogging]);

  return (
    <li className={`rounded-xl border bg-white p-4 sm:p-5 shadow-sm transition duration-200 ${isExpanded ? "border-brand-primary ring-2 ring-brand-primary/15" : "border-brand-secondary/15 hover:shadow-md"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="h-24 w-full shrink-0 overflow-hidden rounded-lg border border-brand-secondary/15 bg-brand-bg sm:h-24 sm:w-24">
          {showImage ? (
            <Image
              src={item.image_url ?? ""}
              alt={`${item.product_name} product image`}
              className="h-full w-full object-contain"
              width={96}
              height={96}
              sizes="96px"
              unoptimized
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-medium text-brand-secondary/60">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-brand-primary">{item.product_name}</p>
          {item.brand ? (
            <p className="mt-1 truncate text-xs text-brand-secondary/80" title={item.brand}>
              {item.brand}
            </p>
          ) : null}
          {item.barcode ? (
            <p className="mt-1 truncate text-xs text-brand-secondary/75" title={`Barcode: ${item.barcode}`}>
              Barcode: {item.barcode}
            </p>
          ) : null}
          {(item.serving_size || item.nutri_score) ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-secondary/75">
              {item.serving_size ? <p>Serving: {item.serving_size}</p> : null}
              {item.nutri_score ? <p>Nutri-Score: {item.nutri_score}</p> : null}
            </div>
          ) : null}

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
        </div>
      </div>
      <button
        ref={logButtonRef}
        type="button"
        className="mt-4 min-h-11 rounded-full bg-brand-primary px-6 py-2 text-xs font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onLog}
        disabled={isLogging || isDisabled || isExpanded}
        aria-busy={isLogging}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? portionId : undefined}
        aria-label={`Log ${item.product_name}`}
      >
        {isLogging ? "Logging..." : isExpanded ? "Choose your portion below" : "Log Food"}
      </button>
      {isExpanded ? (
        <div
          id={portionId}
          ref={portionRef}
          tabIndex={-1}
          role="region"
          aria-label={`Choose a portion for ${item.product_name}`}
          className="scroll-mt-4 outline-none"
        >
          {children}
        </div>
      ) : null}
      {feedback ? (
        <p
          role={feedback.isError ? "alert" : "status"}
          className={`mt-3 text-sm font-semibold ${feedback.isError ? "text-red-600" : "text-brand-primary"}`}
        >
          {feedback.message}
        </p>
      ) : null}
    </li>
  );
}
