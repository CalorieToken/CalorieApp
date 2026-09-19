"use client";

import { useEffect, useMemo, useState } from "react";
import { useDisplayLanguage } from "@/components/DisplayLanguageProvider";
import type { AgeBand } from "@/lib/ageExperience";
import {
  CALORIEVERSE_FNB_KEY,
  allFnbRoles,
  branchesForAge,
  chooseFnbBranch,
  chooseFnbRole,
  fnbCopy,
  fnbRole,
  fnbRoleCopy,
  parseFnbProgress,
  type FnbBranchId,
  type FnbLocalProgress,
  type FnbRoleId,
} from "@/lib/calorieVerseFnbChain";

export function CalorieVerseFnbChain({
  ageBand,
  compact = false,
}: {
  ageBand: AgeBand;
  compact?: boolean;
}) {
  const display = useDisplayLanguage();
  const locale = display.enabled ? display.locale : "en";
  const {copy} = fnbCopy(locale);
  const [progress,setProgress] = useState<FnbLocalProgress>(() => parseFnbProgress(null));
  const [ready,setReady] = useState(false);

  useEffect(() => {
    try {
      setProgress(parseFnbProgress(window.localStorage.getItem(CALORIEVERSE_FNB_KEY)));
    } catch {
      setProgress(parseFnbProgress(null));
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(CALORIEVERSE_FNB_KEY,JSON.stringify(progress));
    } catch {
      // F&B role play remains usable in-memory when browser storage is unavailable.
    }
  }, [progress,ready]);

  const branches = useMemo(() => branchesForAge(ageBand),[ageBand]);
  const roles = useMemo(() => allFnbRoles(),[]);
  const currentRole = progress.role_id ? fnbRole(progress.role_id) : null;

  function selectBranch(branchId:FnbBranchId) {
    setProgress(previous => chooseFnbBranch(previous,branchId));
  }

  function selectRole(roleId:FnbRoleId) {
    setProgress(previous => chooseFnbRole(previous,roleId));
  }

  if (!ready) return null;

  return (
    <section
      className={compact ? "calorieverse-fnb is-compact" : "calorieverse-fnb"}
      data-fnb-age={ageBand}
      aria-labelledby={compact ? "fnb-title-compact" : "fnb-title"}
    >
      <header className="calorieverse-fnb-head">
        <div>
          <small>{copy.branch}</small>
          <h3 id={compact ? "fnb-title-compact" : "fnb-title"}>{copy.title}</h3>
          <p>{copy.intro}</p>
        </div>
        <span>{copy.optional}</span>
      </header>

      <div className="calorieverse-fnb-branches" role="group" aria-label={copy.branch}>
        {branches.map(branch => (
          <button
            type="button"
            key={branch.id}
            aria-pressed={progress.branch_id === branch.id}
            onClick={() => selectBranch(branch.id)}
          >
            {copy.branchNames[branch.id]}
          </button>
        ))}
      </div>

      <div className="calorieverse-fnb-role-grid">
        {roles.slice(0,compact ? 6 : roles.length).map(role => {
          const info = fnbRoleCopy(locale,role.id);
          const active = progress.role_id === role.id;
          const visited = progress.visited_role_ids.includes(role.id);
          return (
            <article
              key={role.id}
              className={[
                "calorieverse-fnb-role",
                active ? "is-active" : "",
                visited ? "is-visited" : "",
              ].filter(Boolean).join(" ")}
            >
              <div>
                <small>{copy.role}</small>
                <h4>{info.name}</h4>
                {!compact ? (
                  <>
                    <p>{info.description}</p>
                    {info.descriptionFallback ? (
                      <span className="gameverse-fallback">{copy.detailFallback}</span>
                    ) : null}
                  </>
                ) : null}
              </div>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => selectRole(role.id)}
              >
                {active ? copy.active : copy.start}
              </button>
            </article>
          );
        })}
      </div>

      {currentRole ? (
        <div className="calorieverse-fnb-flow" role="status">
          <div>
            <small>{copy.active}</small>
            <strong>{fnbRoleCopy(locale,currentRole.id).name}</strong>
          </div>
          <div className="calorieverse-fnb-links">
            <section>
              <small>{copy.upstream}</small>
              <div>
                {currentRole.upstream.length
                  ? currentRole.upstream.map(id => <span key={id}>{fnbRoleCopy(locale,id).name}</span>)
                  : <span>—</span>}
              </div>
            </section>
            <section>
              <small>{copy.downstream}</small>
              <div>
                {currentRole.downstream.length
                  ? currentRole.downstream.map(id => <span key={id}>{fnbRoleCopy(locale,id).name}</span>)
                  : <span>—</span>}
              </div>
            </section>
          </div>
          <div className="calorieverse-fnb-consequences">
            <small>{copy.consequence}</small>
            <div>
              {currentRole.consequence_ids.map(id => <span key={id}>{id.replaceAll("-"," ")}</span>)}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
