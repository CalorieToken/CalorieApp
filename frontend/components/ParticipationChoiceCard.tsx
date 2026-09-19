"use client";

import { useEffect, useState } from "react";
import participationCopyConfig from "@/config/participation-choice-copy.json";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import type { AgeBand } from "@/lib/ageExperience";
import { resolveLocale } from "@/lib/locales";
import {
  defaultParticipationChoice,
  normalizeParticipationChoice,
  parseParticipationChoice,
  PARTICIPATION_CHOICE_KEY,
  participationRoleCount,
  type ParticipationChoice,
} from "@/lib/participationPreference";

type ParticipationCopy = (typeof participationCopyConfig)["en"];

function copyFor(locale: string): ParticipationCopy {
  const resolved = resolveLocale(locale);
  const source = participationCopyConfig as unknown as Record<string, ParticipationCopy>;
  return source[resolved] ?? source.en;
}

export function ParticipationChoiceCard({
  ageBand,
  compact = false,
}: {
  ageBand: AgeBand;
  compact?: boolean;
}) {
  const display = useDisplayLanguage();
  const locale = display.enabled ? display.locale : "en";
  const copy = copyFor(locale);
  const [choice, setChoice] = useState<ParticipationChoice>({...defaultParticipationChoice});
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      setChoice(parseParticipationChoice(window.localStorage.getItem(PARTICIPATION_CHOICE_KEY)));
    } catch {
      setChoice({...defaultParticipationChoice});
    } finally {
      setReady(true);
    }
  }, []);

  const effective = normalizeParticipationChoice(choice, ageBand);

  function save(next: ParticipationChoice) {
    setChoice(next);
    setMessage(copy.saved);
    try {
      window.localStorage.setItem(PARTICIPATION_CHOICE_KEY, JSON.stringify(next));
    } catch {
      // The choice still applies for this open page even if browser storage is unavailable.
    }
  }

  function chooseMode(mode: "nonparticipant" | "participant") {
    if (mode === "participant" && ageBand !== "adult") return;
    save({
      ...choice,
      mode,
      storage: mode === "participant" ? choice.storage : false,
      compute: mode === "participant" ? choice.compute : false,
      validator: mode === "participant" ? choice.validator : false,
    });
  }

  function toggleRole(role: "storage" | "compute" | "validator", enabled: boolean) {
    save({...choice, mode: "participant", [role]: enabled});
  }

  if (!ready) return null;

  return (
    <section
      className={compact ? "participation-choice is-compact" : "participation-choice"}
      aria-labelledby={compact ? "participation-choice-title-compact" : "participation-choice-title"}
    >
      <div className="participation-choice-head">
        <div>
          <small>{copy.title}</small>
          <h3 id={compact ? "participation-choice-title-compact" : "participation-choice-title"}>
            {copy.question}
          </h3>
          <p>{copy.optional}</p>
        </div>
        <span className={effective.mode === "participant" ? "is-on" : "is-off"}>
          {effective.mode === "participant"
            ? copy.yes + " · " + participationRoleCount(effective)
            : copy.no}
        </span>
      </div>

      {ageBand !== "adult" ? (
        <div className="participation-choice-inactive">
          <strong>{copy.no}</strong>
          <p>{copy.inactive}</p>
        </div>
      ) : (
        <>
          <div className="participation-choice-modes" role="group" aria-label={copy.question}>
            <button
              type="button"
              aria-pressed={choice.mode === "nonparticipant"}
              onClick={() => chooseMode("nonparticipant")}
            >
              {copy.no}
            </button>
            <button
              type="button"
              aria-pressed={choice.mode === "participant"}
              onClick={() => chooseMode("participant")}
            >
              {copy.yes}
            </button>
          </div>

          {choice.mode === "participant" ? (
            <div className="participation-choice-settings">
              <fieldset>
                <legend>{copy.roles}</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={choice.storage}
                    onChange={event => toggleRole("storage", event.target.checked)}
                  />
                  <span>{copy.storage}</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={choice.compute}
                    onChange={event => toggleRole("compute", event.target.checked)}
                  />
                  <span>{copy.compute}</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={choice.validator}
                    onChange={event => toggleRole("validator", event.target.checked)}
                  />
                  <span>{copy.validator}</span>
                </label>
              </fieldset>

              {choice.storage ? (
                <label className="participation-scope">
                  <span>{copy.storageScope}</span>
                  <select
                    value={choice.storageScope}
                    onChange={event => save({
                      ...choice,
                      storageScope: event.target.value === "persistent-until-revoked"
                        ? "persistent-until-revoked"
                        : "session-temporary",
                    })}
                  >
                    <option value="session-temporary">{copy.session}</option>
                    <option value="persistent-until-revoked">{copy.persistent}</option>
                  </select>
                </label>
              ) : null}

              {(choice.compute || choice.validator) ? (
                <label className="participation-scope">
                  <span>{copy.computeScope}</span>
                  <select
                    value={choice.computeScope}
                    onChange={event => save({
                      ...choice,
                      computeScope: event.target.value === "remember-until-revoked"
                        ? "remember-until-revoked"
                        : "session-only",
                    })}
                  >
                    <option value="session-only">{copy.session}</option>
                    <option value="remember-until-revoked">{copy.remember}</option>
                  </select>
                </label>
              ) : null}

              <p className="participation-choice-note">{copy.none}</p>
            </div>
          ) : null}
        </>
      )}

      <p className="participation-choice-message" role="status" aria-live="polite">{message}</p>
    </section>
  );
}
