"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AgeExperienceControl, useAgeExperience } from "@/components/AgeExperienceControl";
import { DisplayLanguagePicker, useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import { GameverseCreatorGallery } from "@/components/GameverseCreatorGallery";
import { GameverseMazeRoute } from "@/components/GameverseMazeRoute";
import { ParticipationChoiceCard } from "@/components/ParticipationChoiceCard";
import { GALLERY_DRAFTS_KEY, parseLocalGalleryDrafts, type LocalGalleryDraft } from "@/lib/galleryEcosystem";
import {
  coreRouteProgress,
  gameverseCopy,
  gameverseRegions,
  gameverseWorld,
  mazeUnlocked,
  regionCopy,
  regionIsInteractive,
  regionsForAge,
  starterIdentity,
  uniqueVisited,
  type GameverseRegion,
} from "@/lib/gameverseWorld";

const PROGRESS_KEY = "calorie.gameverse.progress.v1";
const IDENTITY_KEY = "calorie.gameverse.starter-character.v1";

type SavedProgress = {
  version: 1;
  starter_character_id: string;
  current_region_id: string;
  visited_region_ids: string[];
  maze_complete?: boolean;
};

function ageLabel(ageBand: "child" | "teen" | "adult", copy: ReturnType<typeof gameverseCopy>["copy"]) {
  return ageBand === "child" ? copy.ageChild : ageBand === "teen" ? copy.ageTeen : copy.ageAdult;
}

function RegionMarker({
  region,
  selected,
  current,
  visited,
  locked,
  coreRoute,
  label,
  onSelect,
}: {
  region: GameverseRegion;
  selected: boolean;
  current: boolean;
  visited: boolean;
  locked: boolean;
  coreRoute: boolean;
  label: string;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      className={[
        "gameverse-region",
        selected ? "is-selected" : "",
        current ? "is-current" : "",
        visited ? "is-visited" : "",
        locked ? "is-locked" : "",
        coreRoute ? "is-core-route" : "",
      ].filter(Boolean).join(" ")}
      style={{ left: region.x + "%", top: region.y + "%" }}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={label}
      data-region-kind={region.kind}
    >
      <span className="gameverse-region-icon" aria-hidden="true">
        {region.kind === "calorieapp" ? "C" :
         region.kind === "helpbot" ? "?" :
         region.kind === "caloriedb" ? "DB" :
         region.kind === "community" ? "☘" :
         region.kind === "gallery" ? "◇" :
         region.kind === "participation" ? "◌" :
         region.kind === "maze" ? "⌗" :
         region.kind === "ridge" ? "△" : "•"}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function GameverseWorld() {
  const display = useDisplayLanguage();
  const locale = display.enabled ? display.locale : "en";
  const { copy } = gameverseCopy(locale);
  const [ageBand, setAgeBand, ageResolved = true] = useAgeExperience();
  const [starterId, setStarterId] = useState(starterIdentity().starter_character_id);
  const [currentRegionId, setCurrentRegionId] = useState(gameverseWorld.start.region_id);
  const [selectedRegionId, setSelectedRegionId] = useState(gameverseWorld.start.region_id);
  const [visited, setVisited] = useState<string[]>([gameverseWorld.start.region_id]);
  const [localGalleryDrafts, setLocalGalleryDrafts] = useState<LocalGalleryDraft[]>([]);
  const [mazeCompleteState, setMazeCompleteState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedIdentity = JSON.parse(window.localStorage.getItem(IDENTITY_KEY) ?? "null") as { starter_character_id?: unknown } | null;
      if (storedIdentity && typeof storedIdentity.starter_character_id === "string") {
        setStarterId(storedIdentity.starter_character_id);
      } else {
        const identity = starterIdentity();
        window.localStorage.setItem(IDENTITY_KEY, JSON.stringify({
          version: 1,
          starter_character_id: identity.starter_character_id,
          render_asset_key: identity.render_asset_key,
        }));
      }

      setLocalGalleryDrafts(parseLocalGalleryDrafts(window.localStorage.getItem(GALLERY_DRAFTS_KEY)));

      const stored = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "null") as SavedProgress | null;
      if (stored?.version === 1 && typeof stored.current_region_id === "string" && Array.isArray(stored.visited_region_ids)) {
        const safeVisited = uniqueVisited(stored.visited_region_ids);
        const currentExists = gameverseRegions.some(region => region.id === stored.current_region_id);
        setVisited(safeVisited.length ? safeVisited : [gameverseWorld.start.region_id]);
        setCurrentRegionId(currentExists ? stored.current_region_id : gameverseWorld.start.region_id);
        setSelectedRegionId(currentExists ? stored.current_region_id : gameverseWorld.start.region_id);
        setMazeCompleteState(stored.maze_complete === true);
      }
    } catch {
      // Local progress failure must never block the starting world.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      const progress: SavedProgress = {
        version: 1,
        starter_character_id: starterId,
        current_region_id: currentRegionId,
        visited_region_ids: uniqueVisited(visited),
        maze_complete: mazeCompleteState,
      };
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // Playing without persistent browser storage remains supported.
    }
  }, [loaded, starterId, currentRegionId, visited, mazeCompleteState]);

  const regions = useMemo(
    () => ageBand
      ? regionsForAge(ageBand).filter(region => region.id !== "misty-ridge" || mazeCompleteState)
      : [],
    [ageBand, mazeCompleteState]
  );
  const selected = regions.find(region => region.id === selectedRegionId) ?? regions[0];
  const current = gameverseRegions.find(region => region.id === currentRegionId) ?? gameverseRegions[0];
  const mazeReady = mazeUnlocked(visited);
  const coreProgress = coreRouteProgress(visited);
  const coreRouteIds = new Set(gameverseWorld.progression.maze_required_regions as string[]);

  function walkTo(region: GameverseRegion) {
    if (!ageBand || !regionIsInteractive(region, ageBand)) return;
    if (region.kind === "maze" && !mazeReady) return;
    setCurrentRegionId(region.id);
    setSelectedRegionId(region.id);
    setVisited(previous => uniqueVisited([...previous, region.id]));
  }

  if (!ageResolved) return null;

  return (
    <main data-calorieapp-content className="gameverse-page">
      <div className="gameverse-shell" lang={locale}>
        <div className="gameverse-topbar">
          <Link href="/" className="gameverse-brand" aria-label="CalorieApp">
            <Image src="/logo.svg" alt="" width={34} height={34} priority />
            <span>{copy.ecosystem}</span>
          </Link>
          <DisplayLanguagePicker />
        </div>

        {!ageBand ? (
          <section className="gameverse-age-entry">
            <p className="gameverse-kicker">{copy.world}</p>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
            <AgeExperienceControl band={ageBand} onChange={setAgeBand} />
          </section>
        ) : (
          <div className="gameverse-layout" data-age-band={ageBand}>
            <section className="gameverse-stage-panel">
              <header className="gameverse-heading">
                <div>
                  <p className="gameverse-kicker">{copy.world} · {ageLabel(ageBand, copy)}</p>
                  <h1>{copy.title}</h1>
                  <p>{copy.subtitle}</p>
                </div>
                <AgeExperienceControl band={ageBand} onChange={setAgeBand} />
              </header>

              <div className="gameverse-stage" tabIndex={0} aria-label={copy.world}>
                <div className="gameverse-sky" aria-hidden="true" />
                <div className="gameverse-sun" aria-hidden="true" />
                <div className="gameverse-mountain-range" aria-hidden="true">
                  <i /><i /><i />
                </div>
                <div className="gameverse-river" aria-hidden="true" />
                <div className="gameverse-path" aria-hidden="true" />
                <div className="gameverse-field field-a" aria-hidden="true" />
                <div className="gameverse-field field-b" aria-hidden="true" />
                <div className="gameverse-trees" aria-hidden="true">● ● ● ● ●</div>

                {localGalleryDrafts
                  .filter(draft => draft.age_band === ageBand)
                  .slice(0, 3)
                  .map((draft, index) => (
                    <div
                      className="gameverse-gallery-object"
                      key={draft.id}
                      style={{
                        left: (66 + index * 2.6) + "%",
                        top: (69 + (index % 2) * 3) + "%",
                      }}
                      title={draft.title}
                      aria-label={draft.title}
                    >
                      <span aria-hidden="true">◇</span>
                    </div>
                  ))}

                {regions.map(region => {
                  const info = regionCopy(locale, region.id);
                  return (
                    <RegionMarker
                      key={region.id}
                      region={region}
                      selected={selectedRegionId === region.id}
                      current={currentRegionId === region.id}
                      visited={visited.includes(region.id)}
                      locked={region.kind === "maze" && !mazeReady}
                      coreRoute={coreRouteIds.has(region.id) && !visited.includes(region.id)}
                      label={info.name}
                      onSelect={() => setSelectedRegionId(region.id)}
                    />
                  );
                })}

                <div
                  className="gameverse-player"
                  style={{ left: current.x + "%", top: current.y + "%" }}
                  aria-label={copy.identity}
                  title={starterId}
                >
                  <span className="gameverse-player-c">C</span>
                  <span className="gameverse-player-shadow" aria-hidden="true" />
                </div>
              </div>

              <div className="gameverse-mountain-note">
                <strong>{copy.mountains}</strong>
                <span>{copy.mountainHint}</span>
              </div>
            </section>

            <aside className="gameverse-side">
              <ParticipationChoiceCard ageBand={ageBand} compact />

              <section className="gameverse-identity-card">
                <div className="gameverse-mini-avatar" aria-hidden="true">C</div>
                <div>
                  <small>{copy.identity}</small>
                  <strong>{starterId}</strong>
                  <p>{copy.identityNote}</p>
                </div>
              </section>

              <section className="gameverse-place-card">
                <small>{copy.explore}</small>
                {selected ? (() => {
                  const info = regionCopy(locale, selected.id);
                  const interactive = regionIsInteractive(selected, ageBand);
                  const mazeLocked = selected.kind === "maze" && !mazeReady;
                  return <>
                    <h2>{info.name}</h2>
                    <p>{info.description}</p>
                    {info.descriptionFallback ? <span className="gameverse-fallback">English detail</span> : null}
                    <div className="gameverse-actions">
                      <button
                        type="button"
                        onClick={() => walkTo(selected)}
                        disabled={!interactive || mazeLocked || selected.id === currentRegionId}
                      >
                        {selected.id === currentRegionId ? "● " + copy.visited : copy.walk}
                      </button>
                      {selected.destination && interactive && !mazeLocked ? (
                        <Link href={selected.destination}>{copy.open}</Link>
                      ) : null}
                    </div>
                    {selected.kind === "maze" ? (
                      <p className="gameverse-lock-note">{mazeReady ? copy.mazeReady : copy.locked}</p>
                    ) : null}
                    {!interactive ? (
                      <p className="gameverse-lock-note">This area is visible for learning, but active contribution controls stay adult-only.</p>
                    ) : null}
                  </>;
                })() : null}
              </section>

              {selected?.kind === "gallery" ? (
                <GameverseCreatorGallery ageBand={ageBand} compact />
              ) : null}

              {selected?.kind === "participation" && ageBand === "adult" ? (
                <ParticipationChoiceCard ageBand={ageBand} />
              ) : null}

              {selected?.kind === "maze" && mazeReady ? (
                <GameverseMazeRoute
                  locale={locale}
                  completed={mazeCompleteState}
                  onComplete={() => setMazeCompleteState(true)}
                  onContinue={() => {
                    const ridge = gameverseRegions.find(region => region.id === "misty-ridge");
                    if (!ridge) return;
                    setMazeCompleteState(true);
                    setCurrentRegionId(ridge.id);
                    setSelectedRegionId(ridge.id);
                    setVisited(previous => uniqueVisited([...previous, ridge.id]));
                  }}
                />
              ) : null}

              <section className="gameverse-progress-card">
                <div>
                  <small>{copy.route}</small>
                  <strong>{coreProgress.visited.length} / {coreProgress.total} {copy.routeProgress}</strong>
                </div>
                <div className="gameverse-progressbar" aria-hidden="true">
                  <span style={{ width: Math.min(100, coreProgress.visited.length / Math.max(1, coreProgress.total) * 100) + "%" }} />
                </div>
                <p>{mazeReady ? copy.routeReady : copy.routeHint}</p>
                <div className="gameverse-progress-divider" />
                <div>
                  <small>{copy.ecosystem}</small>
                  <strong>{uniqueVisited(visited).length} / {regions.length} {copy.visited}</strong>
                </div>
                <p>{copy.optional}</p>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
