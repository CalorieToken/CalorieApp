import galleryConfig from "@/config/gallery-assets.json";
import copyConfig from "@/config/gallery-copy.json";
import { resolveLocale } from "@/lib/locales";
import type { AgeBand } from "@/lib/ageExperience";
import { showcaseEconomyConfig } from "@/lib/showcaseEconomy";

export type GalleryAssetType = (typeof galleryConfig.asset_types)[number];
export type GalleryAsset = {
  id: string;
  type: GalleryAssetType;
  title: string;
  creator: string;
  region: string;
  ages: AgeBand[];
  transfer_mode: "game-native" | "simulated-license";
  rarity: string;
  tags: string[];
};

export type GalleryCopy = {
  title: string;
  intro: string;
  browse: string;
  workshop: string;
  localDraft: string;
  localDraftNote: string;
  newDraft: string;
  draftTitle: string;
  draftType: string;
  saveDraft: string;
  saved: string;
  noWallet: string;
  modeChild: string;
  modeTeen: string;
  modeAdult: string;
  marketplaceOff: string;
  storage: string;
  storageNote: string;
  all: string;
  openInWorld: string;
  types: string;
  creator: string;
  mode: string;
  drafts: string;
};

export type LocalGalleryDraft = {
  id: string;
  title: string;
  type: GalleryAssetType;
  age_band: AgeBand;
  created_at: string;
};

export const GALLERY_DRAFTS_KEY = "calorie.gallery.local-drafts.v1";

const assetTypes = new Set<string>(galleryConfig.asset_types);

export const galleryAssetTypes = galleryConfig.asset_types as GalleryAssetType[];
export const galleryAssets = galleryConfig.assets as GalleryAsset[];

export function galleryCopy(locale?: string | null): {
  locale: string;
  copy: GalleryCopy;
} {
  const resolved = resolveLocale(locale);
  const source = copyConfig as unknown as Record<string, GalleryCopy>;
  return { locale: source[resolved] ? resolved : "en", copy: source[resolved] ?? source.en };
}

export function galleryModeForAge(ageBand: AgeBand): {
  labelKey: "modeChild" | "modeTeen" | "modeAdult";
  walletRequired: false;
  realSettlementEnabled: boolean;
  transferModes: Array<GalleryAsset["transfer_mode"]>;
} {
  if (ageBand === "child") {
    return {
      labelKey: "modeChild",
      walletRequired: false,
      realSettlementEnabled: false,
      transferModes: ["game-native"],
    };
  }
  if (ageBand === "teen") {
    return {
      labelKey: "modeTeen",
      walletRequired: false,
      realSettlementEnabled: false,
      transferModes: ["game-native", "simulated-license"],
    };
  }
  return {
    labelKey: "modeAdult",
    walletRequired: false,
    realSettlementEnabled: Boolean(showcaseEconomyConfig.marketplace.enabled),
    transferModes: ["game-native", "simulated-license"],
  };
}

export function galleryAssetsForAge(ageBand: AgeBand, type?: string | null): GalleryAsset[] {
  return galleryAssets.filter(asset =>
    asset.ages.includes(ageBand) &&
    (!type || type === "all" || asset.type === type)
  );
}

export function isGalleryAssetType(value: unknown): value is GalleryAssetType {
  return typeof value === "string" && assetTypes.has(value);
}

export function createLocalGalleryDraft(input: {
  title: string;
  type: unknown;
  ageBand: AgeBand;
  now?: Date;
  id?: string;
}): LocalGalleryDraft {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (!title || title.length > 80) throw new Error("invalid-gallery-draft-title");
  if (!isGalleryAssetType(input.type)) throw new Error("invalid-gallery-draft-type");
  const now = input.now ?? new Date();
  return {
    id: input.id ?? `draft-${now.getTime()}`,
    title,
    type: input.type,
    age_band: input.ageBand,
    created_at: now.toISOString(),
  };
}

export function parseLocalGalleryDrafts(value: string | null): LocalGalleryDraft[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const draft = item as Record<string, unknown>;
      if (
        typeof draft.id !== "string" ||
        typeof draft.title !== "string" ||
        typeof draft.created_at !== "string" ||
        !isGalleryAssetType(draft.type) ||
        (draft.age_band !== "child" && draft.age_band !== "teen" && draft.age_band !== "adult")
      ) return [];
      try {
        return [createLocalGalleryDraft({
          id: draft.id,
          title: draft.title,
          type: draft.type,
          ageBand: draft.age_band,
          now: new Date(draft.created_at),
        })];
      } catch {
        return [];
      }
    }).slice(0, 50);
  } catch {
    return [];
  }
}

export const galleryEcosystemConfig = galleryConfig;
