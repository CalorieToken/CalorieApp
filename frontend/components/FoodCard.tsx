"use client";

import { FoodPropertyIcon } from "@/components/FoodPropertyIcon";
import { FoodLabels } from "@/components/FoodLabels";
import { FoodRecipeIdeas } from "@/components/FoodRecipeIdeas";
import { FoodExplore } from "@/components/FoodExplore";

import { FoodSearchItem } from "@/components/foodTypes";
import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { displayServingSize, formatFoodUi, getFoodUi } from "@/lib/foodUi";
import { NutriScoreBar } from "@/components/NutriScoreBar";
import { FoodImage } from "@/components/FoodImage";
import { postNavigationTarget } from "@/lib/navigationBridge";

type FoodCardProps = {
  item: FoodSearchItem;
  isLogging: boolean;
  imagePriority?: boolean;
  isDisabled?: boolean;
  canLog?: boolean;
  isSelected?: boolean;
  controlsId?: string;
  onLog: () => void;
  formatNumber: (value: number) => string;
  children?: ReactNode;
  comparison?: ReactNode;
  feedback?: { message: string; isError: boolean } | null;
  restoreDetails?: boolean;
  selectedProductName?: string;
  onOpenDiary?: () => void;
  diaryLabel?: string;
  onChooseRecipe?: (food: FoodSearchItem) => void;
  onIngredient?: (fdcId: number, grams: number) => void;
};

export function FoodCard({ item, isLogging, imagePriority = false, isDisabled = false, canLog = true, isSelected = false, controlsId, onLog, formatNumber, children, comparison, feedback, restoreDetails = false, selectedProductName, onOpenDiary, diaryLabel, onChooseRecipe, onIngredient }: FoodCardProps) {
  const display = useDisplayLanguage();
  const { copy, locale, direction } = getFoodUi(display.enabled ? display.locale : "en");
  const portionId = useId();
  const detailsId = useId();
  const portionRef = useRef<HTMLDivElement>(null);
  const detailsButtonRef = useRef<HTMLButtonElement>(null);
  const logButtonRef = useRef<HTMLButtonElement>(null);
  const wasExpandedRef = useRef(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const revealDetails = useRef(false);
  // Restored details must exist before the parent restores the list offset.
  const [detailsOpen, setDetailsOpen] = useState(restoreDetails);
  const isExpanded = canLog && (isSelected || Boolean(children));
  useEffect(() => { if (restoreDetails) setDetailsOpen(true); }, [restoreDetails]);
  useEffect(() => {
    if (detailsOpen && revealDetails.current) postNavigationTarget("calorieapp-add", detailsRef.current, true);
    revealDetails.current = false;
  }, [detailsOpen]);

  useEffect(() => {
    if (children && isExpanded && !wasExpandedRef.current) {
      portionRef.current?.focus({ preventScroll: true });
      postNavigationTarget("calorieapp-add", portionRef.current, true);
    } else if (!isExpanded && wasExpandedRef.current) {
      if (isDisabled || isLogging) return;
      // Restore keyboard focus after the portion controls are removed, while
      // leaving focus alone if the user has moved to another product or search.
      if (document.activeElement === document.body) {
        logButtonRef.current?.focus({ preventScroll: true });
      }
    }
    wasExpandedRef.current = isExpanded;
  }, [children, isExpanded, isDisabled, isLogging]);

  return (
    <li lang={locale} dir={direction} className={`scroll-mt-3 rounded-xl border bg-white p-3 shadow-sm transition duration-200 sm:p-4 ${isExpanded ? "border-brand-primary ring-2 ring-brand-primary/15" : "border-brand-secondary/15 hover:shadow-md"}`}>
      <div className="flex min-w-0 items-start gap-3">
        <FoodImage item={item} eager={imagePriority} size={96} className="h-20 w-20 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold leading-snug text-brand-primary sm:text-base"><bdi>{item.product_name}</bdi></p>
          {item.brand ? (
            <p className="mt-1 truncate text-xs text-brand-secondary/80" title={item.brand}>
              <bdi>{item.brand}</bdi>
            </p>
          ) : null}
          {item.barcode ? (
            <p className="mt-1 truncate text-xs text-brand-secondary/75" title={`${copy.barcode}: ${item.barcode}`}>
              {copy.barcode}: <bdi dir="ltr">{item.barcode}</bdi>
            </p>
          ) : null}
          <p className="mt-2 text-xs text-brand-secondary/75">
            {item.serving_size ? <>{copy.serving}: <bdi>{displayServingSize(item.serving_size, copy)}</bdi></> : copy.sourceReference}
          </p>
          <p className="mt-1 text-sm font-semibold text-brand-primary"><bdi>{formatNumber(item.calories)} kcal</bdi></p>
        </div>
      </div>

      <NutriScoreBar grade={item.nutri_score} compact />

      <div className="mt-3 flex flex-wrap items-stretch gap-2">
        {canLog ? <button
          ref={logButtonRef}
          type="button"
          className="min-h-11 flex-1 rounded-full bg-brand-primary px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onLog}
          disabled={isLogging || isDisabled || isExpanded}
          aria-busy={isLogging}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? controlsId || portionId : undefined}
          aria-label={formatFoodUi(copy.logProduct, { product: item.product_name })}
        >
          {isLogging ? copy.logging : isExpanded ? copy.chooseBelow : copy.logFood}
        </button> : null}
        <button ref={detailsButtonRef} type="button" onClick={() => { revealDetails.current = !detailsOpen; setDetailsOpen(value => !value); }}
          className="min-h-11 flex-1 rounded-full border-2 border-brand-secondary bg-white px-4 py-2 text-xs font-semibold text-brand-secondary transition hover:bg-brand-secondary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          aria-expanded={detailsOpen} aria-controls={detailsId}
          aria-label={formatFoodUi(copy.viewDetails, { product: item.product_name })}>
          {detailsOpen ? copy.backToList : copy.detailsAndCompare}
        </button>
      </div>

      {isExpanded ? (
        <div
          id={portionId}
          ref={portionRef}
          tabIndex={-1}
          role="region"
          aria-label={formatFoodUi(copy.choosePortionFor, { product: selectedProductName || item.product_name })}
          className="scroll-mt-3 outline-none"
        >
          {children}
        </div>
      ) : null}
      {canLog && feedback ? (
        <p
          role={feedback.isError ? "alert" : "status"}
          className={`mt-3 text-sm font-semibold ${feedback.isError ? "text-red-600" : "text-brand-primary"}`}
        >
          {feedback.message}
        </p>
      ) : null}
      {canLog && feedback && !feedback.isError && onOpenDiary ? <button type="button" onClick={onOpenDiary}
        className="mt-2 min-h-11 rounded-full border-2 border-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary focus-visible:ring-2 focus-visible:ring-brand-secondary">{diaryLabel}</button> : null}

      {detailsOpen ? <div id={detailsId} ref={detailsRef} className="mt-3 border-t border-brand-secondary/15 pt-3">
          <FoodExplore locale={locale} productName={item.product_name} initialSection={restoreDetails ? "comparison" : "nutrition"}
          onBack={() => { setDetailsOpen(false); detailsButtonRef.current?.focus({ preventScroll: true }); }} backLabel={copy.backToList} nutrition={
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-brand-secondary/80"><FoodPropertyIcon kind="calories" />{copy.calories}</span>
              <p className="font-semibold text-brand-primary"><bdi>{formatNumber(item.calories)} kcal</bdi></p>
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 text-brand-secondary/80"><FoodPropertyIcon kind="protein" />{copy.protein}</span>
              <p className="font-semibold text-brand-primary"><bdi>{formatNumber(item.protein)}g</bdi></p>
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 text-brand-secondary/80"><FoodPropertyIcon kind="fat" />{copy.fat}</span>
              <p className="font-semibold text-brand-primary"><bdi>{formatNumber(item.fat)}g</bdi></p>
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 text-brand-secondary/80"><FoodPropertyIcon kind="carbohydrates" />{copy.carbs}</span>
              <p className="font-semibold text-brand-primary"><bdi>{formatNumber(item.carbohydrates)}g</bdi></p>
            </div>
          </div>
          } comparison={comparison}
          labels={<FoodLabels food={item} locale={locale} embedded />}
          recipes={<FoodRecipeIdeas key={item.barcode || item.product_name} food={item} locale={locale} embedded onLog={canLog ? onChooseRecipe : undefined} onIngredient={onIngredient} disabled={isDisabled || isLogging} />} />
        </div> : null}
    </li>
  );
}
