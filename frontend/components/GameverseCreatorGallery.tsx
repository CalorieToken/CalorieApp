"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import type { AgeBand } from "@/lib/ageExperience";
import {
  createLocalGalleryDraft,
  galleryAssetsForAge,
  galleryAssetTypes,
  galleryCopy,
  galleryModeForAge,
  parseLocalGalleryDrafts,
  type GalleryAssetType,
  type LocalGalleryDraft,
} from "@/lib/galleryEcosystem";

const DRAFTS_KEY = "calorie.gallery.local-drafts.v1";

function assetTypeLabel(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

export function GameverseCreatorGallery({
  ageBand,
  compact = false,
}: {
  ageBand: AgeBand;
  compact?: boolean;
}) {
  const display = useDisplayLanguage();
  const locale = display.enabled ? display.locale : "en";
  const { copy } = galleryCopy(locale);
  const mode = galleryModeForAge(ageBand);
  const [type, setType] = useState<string>("all");
  const [drafts, setDrafts] = useState<LocalGalleryDraft[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftType, setDraftType] = useState<GalleryAssetType>(galleryAssetTypes[0]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      setDrafts(parseLocalGalleryDrafts(window.localStorage.getItem(DRAFTS_KEY)));
    } catch {
      setDrafts([]);
    }
  }, []);

  const assets = useMemo(
    () => galleryAssetsForAge(ageBand, type),
    [ageBand, type]
  );

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const draft = createLocalGalleryDraft({ title: draftTitle, type: draftType });
      const next = [draft, ...drafts].slice(0, 50);
      setDrafts(next);
      setDraftTitle("");
      setMessage(copy.saved);
      try {
        window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
      } catch {
        // The workshop stays usable in-memory when browser storage is unavailable.
      }
    } catch {
      setMessage(copy.localDraftNote);
    }
  }

  return (
    <section
      className={compact ? "gallery-ecosystem is-compact" : "gallery-ecosystem"}
      data-gallery-age={ageBand}
      aria-labelledby={compact ? "gallery-title-compact" : "gallery-title"}
    >
      <header className="gallery-ecosystem-head">
        <div>
          <p className="gallery-kicker">{copy.browse}</p>
          <h2 id={compact ? "gallery-title-compact" : "gallery-title"}>{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>
        <div className="gallery-mode">
          <small>{copy.mode}</small>
          <strong>{copy[mode.labelKey]}</strong>
          <span>{copy.noWallet}</span>
        </div>
      </header>

      <div className="gallery-safety-note">
        <strong>{copy.marketplaceOff}</strong>
        <span>{copy.storageNote}</span>
      </div>

      <div className="gallery-filter" role="group" aria-label={copy.types}>
        <button
          type="button"
          aria-pressed={type === "all"}
          onClick={() => setType("all")}
        >
          {copy.all}
        </button>
        {galleryAssetTypes.map(assetType => (
          <button
            key={assetType}
            type="button"
            aria-pressed={type === assetType}
            onClick={() => setType(assetType)}
          >
            {assetTypeLabel(assetType)}
          </button>
        ))}
      </div>

      <div className="gallery-grid">
        {assets.slice(0, compact ? 4 : assets.length).map((asset, index) => (
          <article className="gallery-asset-card" key={asset.id}>
            <div
              className="gallery-asset-art"
              data-gallery-art={(index % 4) + 1}
              aria-hidden="true"
            >
              <span>{asset.type === "recipe" ? "🍎" :
                asset.type === "food-photo" ? "◉" :
                asset.type === "3d-model" ? "◇" :
                asset.type === "avatar-item" ? "C" :
                asset.type === "digital-livestock-character" ? "●" :
                asset.type === "educational-media" ? "↗" :
                asset.type === "menu" ? "≡" : "✦"}</span>
            </div>
            <div className="gallery-asset-body">
              <small>{assetTypeLabel(asset.type)}</small>
              <h3>{asset.title}</h3>
              <p>{copy.creator}: {asset.creator}</p>
              <div className="gallery-tags">
                {asset.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}
              </div>
              <p className="gallery-transfer">{asset.transfer_mode === "game-native" ? "Game-native" : "Simulated licence"}</p>
            </div>
          </article>
        ))}
      </div>

      {compact && drafts.length > 0 ? (
        <div className="gallery-world-drafts">
          <small>{copy.localDraft}</small>
          <strong>{drafts.length} {copy.drafts.toLowerCase()}</strong>
          <div>
            {drafts.slice(0, 3).map(draft => (
              <span key={draft.id}>{draft.title}</span>
            ))}
          </div>
          <p>{copy.localDraftNote}</p>
        </div>
      ) : null}

      {!compact ? (
        <section className="gallery-workshop" aria-labelledby="gallery-workshop-title">
          <div className="gallery-workshop-copy">
            <p className="gallery-kicker">{copy.workshop}</p>
            <h3 id="gallery-workshop-title">{copy.newDraft}</h3>
            <p>{copy.localDraftNote}</p>
            <div className="gallery-storage-card">
              <strong>{copy.storage}</strong>
              <span>{copy.storageNote}</span>
            </div>
          </div>

          <form onSubmit={saveDraft} className="gallery-draft-form">
            <label htmlFor="gallery-draft-title">{copy.draftTitle}</label>
            <input
              id="gallery-draft-title"
              value={draftTitle}
              maxLength={80}
              onChange={event => setDraftTitle(event.target.value)}
              required
            />
            <label htmlFor="gallery-draft-type">{copy.draftType}</label>
            <select
              id="gallery-draft-type"
              value={draftType}
              onChange={event => setDraftType(event.target.value as GalleryAssetType)}
            >
              {galleryAssetTypes.map(assetType => (
                <option key={assetType} value={assetType}>{assetTypeLabel(assetType)}</option>
              ))}
            </select>
            <button type="submit">{copy.saveDraft}</button>
            <p className="gallery-form-message" role="status" aria-live="polite">{message}</p>
          </form>

          <div className="gallery-local-drafts">
            <small>{copy.drafts}</small>
            {drafts.length === 0 ? (
              <p>{copy.localDraftNote}</p>
            ) : (
              <ul>
                {drafts.slice(0, 8).map(draft => (
                  <li key={draft.id}>
                    <strong>{draft.title}</strong>
                    <span>{assetTypeLabel(draft.type)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}
