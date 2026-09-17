"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { formatFoodUi, getFoodUi } from "@/lib/foodUi";
import {
  foodSource,
  foodSourceCopy,
  safeFoodImageUrl,
} from "@/lib/foodSource";

import { foodIllustration } from "@/lib/foodIllustration";

type ImageFood = {
  product_name: string;
  category?: string;
  image_url?: string | null;
  barcode?: string | null;
  brand?: string | null;
};

export function FoodImage({ item, size = 96, className = "" }: {
  item: ImageFood;
  size?: 96 | 112;
  className?: string;
}) {
  const display = useDisplayLanguage();
  const ui = getFoodUi(display.enabled ? display.locale : "en");
  const sourceUi = foodSourceCopy(display.enabled ? display.locale : "en");
  const source = foodSource(item);
  const remote = safeFoodImageUrl(item.image_url);
  const [failed, setFailed] = useState(false);
  const useFallback = !remote || failed;
  const imageSource = !useFallback && remote ? remote : foodIllustration(item.product_name, item.category);
  const sourceName = source === "open_food_facts"
    ? sourceUi.copy.openFoodFacts
    : source === "usda" ? sourceUi.copy.usda : sourceUi.copy.other;

  useEffect(() => setFailed(false), [remote]);

  return (
    <figure className={`relative m-0 overflow-hidden rounded-lg border border-brand-secondary/15 bg-brand-bg ${className}`.trim()}>
      <Image
        src={imageSource}
        alt={useFallback
          ? formatFoodUi(sourceUi.copy.fallbackAlt, { product: item.product_name })
          : formatFoodUi(ui.copy.productImage, { product: item.product_name })}
        className={`h-full w-full object-contain`}
        width={size}
        height={size}
        sizes={`${size}px`}
        unoptimized
        onError={useFallback ? undefined : () => setFailed(true)}
      />
      {useFallback ? <span className="absolute start-1 top-1 rounded bg-white/95 px-1 text-[9px] font-semibold leading-4 text-brand-secondary">{sourceUi.copy.illustration}</span> : null}
      <figcaption
        className="absolute bottom-1 end-1 max-w-[calc(100%-0.5rem)] truncate rounded-full bg-brand-primary/90 px-2 py-0.5 text-[10px] font-bold leading-4 text-white shadow"
        title={sourceName}
        aria-label={formatFoodUi(sourceUi.copy.sourceLabel, { source: sourceName })}
      >
        <bdi>{source === "open_food_facts" ? "OFF" : source === "usda" ? "USDA" : sourceUi.copy.otherBadge}</bdi>
      </figcaption>
    </figure>
  );
}
