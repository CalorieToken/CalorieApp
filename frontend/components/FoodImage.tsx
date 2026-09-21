"use client";

import Image from "next/image";
import { useState } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { formatFoodUi, getFoodUi } from "@/lib/foodUi";
import {
  foodSource,
  foodImageThumbnail,
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

export function FoodImage({ item, size = 96, className = "", eager = false }: {
  item: ImageFood;
  size?: 96 | 112;
  className?: string;
  eager?: boolean;
}) {
  const display = useDisplayLanguage();
  const ui = getFoodUi(display.enabled ? display.locale : "en");
  const sourceUi = foodSourceCopy(display.enabled ? display.locale : "en");
  const source = foodSource(item);
  const remote = safeFoodImageUrl(item.image_url);
  const thumbnail = size === 96 ? foodImageThumbnail(remote) : remote;
  const [failure, setFailure] = useState<{ remote: string; stage: "thumbnail" | "original" } | null>(null);
  const stage = failure?.remote === remote ? failure?.stage : null;
  const useFallback = !remote || stage === "original";
  const imageSource = useFallback ? foodIllustration(item.product_name, item.category)
    : stage === "thumbnail" ? remote! : thumbnail!;
  const sourceName = source === "open_food_facts"
    ? sourceUi.copy.openFoodFacts
    : source === "usda" ? sourceUi.copy.usda : sourceUi.copy.other;

  return (
    <figure className={`relative m-0 overflow-hidden rounded-lg border border-brand-secondary/15 bg-brand-bg ${className}`.trim()}>
      <Image
        key={imageSource}
        src={imageSource}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager && !useFallback ? "high" : "auto"}
        decoding="async"
        alt={useFallback
          ? formatFoodUi(sourceUi.copy.fallbackAlt, { product: item.product_name })
          : formatFoodUi(ui.copy.productImage, { product: item.product_name })}
        className={`h-full w-full object-contain`}
        width={size}
        height={size}
        sizes={`${size}px`}
        unoptimized
        onError={useFallback ? undefined : () => setFailure({
          remote: remote!, stage: imageSource !== remote ? "thumbnail" : "original",
        })}
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
