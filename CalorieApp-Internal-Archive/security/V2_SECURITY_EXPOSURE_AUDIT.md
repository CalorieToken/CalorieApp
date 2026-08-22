# CALORIEAPP V2 SECURITY / GIT EXPOSURE AUDIT

Status: Read-only security review for public/open-source readiness assessment.

## Evidence discipline

This audit uses explicit labels:

- REPO-EVIDENCE: verified from repository state, git output, tracked files, ignore rules, or source code.
- GIT-HISTORY-EVIDENCE: verified from git log, git rev-list, git grep, or commit metadata.
- INFERENCE: reasoned conclusion from evidence.
- RECOMMENDATION: suggested next action, not a current fact.
- UNKNOWN: not yet verified.

---

## 1. CURRENT FILE EXPOSURE

### Repository state summary

- REPO-EVIDENCE: git status shows a dirty working tree with modified tracked files and untracked files.
- REPO-EVIDENCE: git ls-files lists the repo’s tracked source files; the tracked set is primarily app code and docs, not runtime secrets.
- REPO-EVIDENCE: git ls-files --others --exclude-standard shows untracked staging and identity files.
- REPO-EVIDENCE: git check-ignore confirms .env.local and *.db patterns are intended to be ignored.
- REPO-EVIDENCE: root .gitignore includes *.db, *.sqlite, *.sqlite3, .env.local, and backend/calorieapp.db.
- REPO-EVIDENCE: backend/.gitignore includes .env, .env.local, calorieapp.db, and *.db.

### Sensitive files present in current repo state

| Finding | Classification | Notes |
|---|---|---|
| backend/.env | CRITICAL | Real local runtime config exists in the workspace; it is ignored but still present. |
| backend/.env.staging.example | REVIEW | Staging template indicates bridge and host configuration but uses placeholders only. |
| frontend/.env.local | HIGH RISK | Local frontend env file exists and is git-ignored; it may contain runtime secrets if populated. |
| backend/calorieapp.db | CRITICAL | Local SQLite database file exists and should never be public. |
| calorieapp.db | CRITICAL | Root-level database file exists and is ignored. |
| .env.example | SAFE | Placeholder template, not a real secret file. |
| frontend/.env.example | SAFE | Placeholder template, not a real secret file. |
| .next outputs / node_modules / caches | SAFE / REVIEW | Generated artifacts, not source-of-truth; not themselves secrets but operationally sensitive. |
| docs/STAGING_DEPLOYMENT_PLAN.md | REVIEW | Reveals domains, hostnames, and staging architecture patterns. |
| docs/STAGING_XAMAN_TEST.md | REVIEW | Contains bridge variable names and integration structure; no values printed, but operationally revealing. |
| backend/app/services/identity.py | REVIEW | Contains env variable references for bridge secret and auth flow; not a secret itself but sensitive implementation detail. |
| backend/app/main.py | REVIEW | Uses bridge secret and identity environment values. |

### Current exposure assessment

- REPO-EVIDENCE: There are actual local runtime config files and database files in the working tree, even though .gitignore attempts to exclude them.
- INFERENCE: The repository is not currently safe for public publication as-is because local secret-bearing files and sensitive operational artifacts are present in the workspace.
- RECOMMENDATION: Treat the working tree as private and do not publish without a secret review and cleanup pass.

---

## 2. GIT HISTORY SECRET SCAN

### Historical env/database and credential patterns reviewed

- GIT-HISTORY-EVIDENCE: git rev-list --all --objects showed only placeholder env files in history: backend/.env.example and frontend/.env.example.
- GIT-HISTORY-EVIDENCE: no actual .env, .env.local, .env.staging, .sqlite, .sqlite3, or .db files were found in commit objects for the current repo history.
- GIT-HISTORY-EVIDENCE: git log --all --name-only for env/db patterns did not reveal a real committed database file.
- GIT-HISTORY-EVIDENCE: no history entries were found for secret-like names in tracked paths such as actual secret-bearing filenames.

### Credential-like keywords reviewed

The repository contains references to secret-related names in source code and docs, but not actual values. The review looked for patterns including:

- API_KEY
- SECRET
- TOKEN
- PASSWORD
- PRIVATE_KEY
- CLIENT_SECRET
- BRIDGE_SECRET
- AUTHORIZATION
- COOKIE_SECRET
- JWT_SECRET
- WORDPRESS_BRIDGE_SECRET
- XUMM
- Xaman
- Vercel
- Railway
- Render
- DATABASE_URL

### Result of historical scan

- GIT-HISTORY-EVIDENCE: no actual credential values were found in git history.
- INFERENCE: the repo history is not obviously contaminated with leaked secret strings in tracked files.
- RECOMMENDATION: full secret scanning should still be done as part of a cleanup pass because local and ignored files may not be part of git history.

### Historical findings (type-only, no values)

| Finding | Commit / Location | Approximate type | Risk |
|---|---|---|---|
| backend/.env.example | history only | placeholder env template | SAFE |
| frontend/.env.example | history only | placeholder env template | SAFE |
| staging env template files | untracked/working tree | staging config placeholders | REVIEW |
| local DB files | ignored working tree | SQLite runtime DB | CRITICAL |
| no actual secret values found in commit history | entire repo history | none observed | SAFE |

---

## 3. GIT OBJECT / HISTORY REVIEW

### Whether sensitive files were committed, added, removed, renamed, or copied

- GIT-HISTORY-EVIDENCE: no actual .env files or database files were found in the reachable git object history.
- GIT-HISTORY-EVIDENCE: placeholder environment templates are present in history, but they are not real credential-bearing configs.
- GIT-HISTORY-EVIDENCE: local and ignored files such as backend/.env, backend/calorieapp.db, and frontend/.env.local are present in the current workspace but are not tracked by git.
- REPO-EVIDENCE: There are untracked staging files and identity files, but not tracked secret files.
- INFERENCE: The repo history does not appear to contain committed secret-bearing config or DB snapshots, which is a good sign.
- UNKNOWN: Whether a previous branch or non-current historical ref contained secret-bearing artifacts is not proven absent a broader forensic sweep of all refs and stash objects.
- RECOMMENDATION: For a public release, still do a full secret sweep across all local refs and stash states before publishing.

### Historical file status summary

| Action | Status |
|---|---|
| committed real .env files | not observed |
| committed real DB files | not observed |
| removed secret-bearing files from git | not observed |
| renamed secret-bearing files | not observed |
| copied secret-bearing files | not observed |
| current ignored secrets in working tree | observed |

---

## 4. DATABASE EXPOSURE

### Database files and tracking review

- REPO-EVIDENCE: backend/.gitignore explicitly ignores *.db, *.sqlite, *.sqlite3, and backend/calorieapp.db.
- REPO-EVIDENCE: root .gitignore also ignores *.db and *.sqlite.
- REPO-EVIDENCE: local DB files are present in the workspace: backend/calorieapp.db and calorieapp.db.
- GIT-HISTORY-EVIDENCE: no committed database file was found in git object history.

### Database risk classification

| File | Status | Risk |
|---|---|---|
| backend/calorieapp.db | present, ignored, untracked | CRITICAL |
| calorieapp.db | present, ignored, untracked | CRITICAL |
| any *.db file in history | not observed | SAFE |
| any *.sqlite file in history | not observed | SAFE |

### Important note

- REPO-EVIDENCE: Database files are not tracked by git in the current history scan.
- INFERENCE: This reduces the likelihood of a git-based leak, but the local database files are still sensitive and must remain private.
- RECOMMENDATION: Keep DB files completely out of any public repository or public archive.

---

## 5. ENVIRONMENT EXPOSURE

### Environment file review

- REPO-EVIDENCE: backend/.env exists in the workspace and is ignored.
- REPO-EVIDENCE: frontend/.env.local exists in the workspace and is ignored.
- REPO-EVIDENCE: backend/.env.staging.example exists and is untracked.
- REPO-EVIDENCE: frontend/.env.staging.example exists and is untracked.
- REPO-EVIDENCE: tracked files include .env.example and frontend/.env.example as safe placeholder templates.

### Distinction: placeholder vs real secret-bearing config

| File type | Classification |
|---|---|
| .env.example / frontend/.env.example | SAFE placeholder templates |
| backend/.env.staging.example | REVIEW staging template |
| frontend/.env.staging.example | REVIEW staging template |
| backend/.env | CRITICAL real local config in working tree |
| frontend/.env.local | HIGH RISK real local config in working tree |

### Evidence from actual template content

- REPO-EVIDENCE: backend/.env contains placeholder values such as CHANGE_ME and staging WordPress host references.
- REPO-EVIDENCE: backend/.env.staging.example includes staging domain references and a bridge secret placeholder value labeled CHANGE_ME.
- REPO-EVIDENCE: the files are not actual credentials, but their presence and naming still reveal environment structure and secret-handling patterns.

### Conclusion

- REPO-EVIDENCE: real environment files are not tracked in git, which is positive.
- INFERENCE: however, they are active in the local workspace and remain a serious publication risk if accidentally archived or shared.

---

## 6. SOURCE CODE SECRET REVIEW

### Search scope

The codebase was reviewed for hard-coded credentials and secret-bearing identifiers in source, scripts, docs, and tests.

### Findings

- REPO-EVIDENCE: backend/app/main.py contains environment variable references to WORDPRESS_BRIDGE_SECRET and related bridge configuration.
- REPO-EVIDENCE: backend/app/services/identity.py also references WORDPRESS_BRIDGE_SECRET, CALORIEAPP_CLIENT_ID, and session cookie security handling.
- REPO-EVIDENCE: docs/STAGING_XAMAN_TEST.md contains explicit variable names and staging examples for bridge secret and auth flow operations.
- REPO-EVIDENCE: backend/.env and backend/.env.staging.example contain secret placeholder names and environment design references.
- REPO-EVIDENCE: no actual secret value strings were printed or exposed in this report.

### Classification of source findings

| Finding | Classification | Notes |
|---|---|---|
| secret variable names in source | REVIEW | Important for policy, not for public disclosure |
| staging hostnames in docs | REVIEW | Operationally revealing but not a secret value |
| placeholder values like CHANGE_ME | SAFE | placeholders only |
| actual credentials in code | none observed | not found in tracked repo files |
| actual private keys / JWT secrets | none observed | not found in tracked repo files |
| hard-coded wallet or DB credentials | none observed | not found in tracked repo files |

### Additional check

- REPO-EVIDENCE: there are no obvious private-key blobs or wallet material embedded in the tracked repo source files reviewed.
- INFERENCE: the main risk is not a literal secret in source, but the presence of secret-bearing configuration names and staging infrastructure references.

---

## 7. DOCUMENTATION EXPOSURE

### Documentation review

The following files were reviewed for operational leak risk:

- README.md
- docs/
- architecture docs
- staging docs
- deployment docs
- checkpoint documents
- research docs

### Potentially exposing operational information

| Document | Classification | Why |
|---|---|---|
| docs/STAGING_DEPLOYMENT_PLAN.md | REVIEW | Exposes proposed domain names, bridge architecture, staging patterns, and security boundaries. |
| docs/STAGING_XAMAN_TEST.md | REVIEW | Lists bridge variables, callback flow, and host assumptions in a concrete way. |
| docs/IDENTITY_FOUNDATION.md | REVIEW | Explains identity flow and WordPress/Xaman trust boundaries. |
| docs/CLOUD_DEPLOYMENT.md | REVIEW | Mentions deployment platforms and architecture patterns. |
| CALORIE_ECOSYSTEM_ARCHITECTURE_V1.md | REVIEW | Future architecture content may reveal broader ecosystem direction. |
| DECENTRALIZED_ARCHITECTURE_V1.md | REVIEW | Describes future architecture and platform-level design assumptions. |
| NATIVE_PLATFORM_ARCHITECTURE_V1.md | REVIEW | Describes platform and role boundaries that may be sensitive in a future public strategy. |
| README.md | SAFE | Product description is largely generic and non-sensitive. |

### Key concern

- INFERENCE: the main documentation risk is not a leaked secret but a leaked operational blueprint. This matters because staging and identity docs reveal how the system is connected together.
- RECOMMENDATION: When making the repo public, keep the public docs generic and move detailed host, bridge, and staging architecture instructions to a private or restricted document set.

---

## 8. PERSONAL DATA REVIEW

### Search for personal data

- REPO-EVIDENCE: source-controlled files do not obviously contain names, addresses, or personal profile data as part of app code.
- REPO-EVIDENCE: local database files may contain user and food logging data, but they were not opened or inspected in this audit.
- REPO-EVIDENCE: the app schema includes owner_id, external_subject, xrpl_address, and food log data in models; therefore user-related data is a real risk if DB files are exposed.

### Classification

| Type | Classification | Evidence |
|---|---|---|
| real user names in tracked source | none observed | no direct evidence in source files |
| email addresses in tracked source | none observed | no direct evidence in source files |
| wallet addresses in tracked source | none observed | schema references exist but no actual wallet values were exposed |
| user IDs / session data in tracked source | possible | user/session-related code exists, but without actual live values |
| food logs in tracked source | none observed | no database data or exported logs found in git-tracked files |
| personal data in local DB files | possible | DB files are sensitive and may contain user/app data |

### Important note

- REPO-EVIDENCE: the schema supports user identity and food logging; the risk is not literal personal data in the repo, but the possibility that local DB artifacts contain live personal data.
- RECOMMENDATION: treat DB files as private and never include them in a public release.

---

## 9. THIRD-PARTY CREDENTIALS

### Third-party services / platform references reviewed

The repo references or implies the following service surfaces:

- WordPress
- XUMM / Xaman
- Open Food Facts
- Vercel
- Railway
- Render
- GitHub
- cloud infrastructure
- DNS / hostnames
- databases

### Risk assessment

| Third-party area | Classification | Notes |
|---|---|---|
| WordPress / Xaman bridge | REVIEW | Integration is real and operationally sensitive. |
| Open Food Facts API | SAFE | Open Food Facts is an allowed public integration, not a private credential system. |
| Vercel, Railway, Render references | REVIEW | Docs reference deployment patterns but no actual provider credentials are present. |
| GitHub / repo metadata | SAFE | No secret values found in tracked history or code. |
| database / DNS / staging hosts | REVIEW | Operational details are present in staging docs and may reveal infrastructure assumptions. |

### Important restriction

- This audit does not print or expose any real third-party credentials.
- Only the existence and sensitivity of credential-bearing patterns were considered.

---

## 10. PUBLIC REPOSITORY READINESS

### Decision

NOT PUBLIC-READY

### Why

- REPO-EVIDENCE: ignored but present local env files exist in the working tree.
- REPO-EVIDENCE: ignored DB files are present in the repo workspace.
- REPO-EVIDENCE: app and docs reveal staging environment design and bridge setup details.
- REPO-EVIDENCE: the repo is not in a clean, audited, redacted state for publication.
- RECOMMENDATION: the repository can become public only after a cleanup and secret review pass.

### Conditions for a later public release

- all real .env files removed from the workspace before publication
- all local DB files removed from the workspace or stored outside the repo
- staging infrastructure references minimized or moved to private docs
- a clean git status and a final repo secret scan executed
- a documented public/private classification policy applied

---

## 11. REMEDIATION PLAN

### CRITICAL

| Issue | Affected files/history | Recommended action | History rewrite required? | Credential rotation required? |
|---|---|---|---|---|
| Local secret-bearing env files present in working tree | backend/.env, frontend/.env.local | remove from working tree, keep separate private store, do not publish | No | Not necessarily, but verify actual secrets if they exist |
| Local SQLite DB files present | backend/calorieapp.db, calorieapp.db | move to private storage; do not include in repo or archive | No | Not a credential rotation issue; treat as data isolation |
| Staging infrastructure references in docs | docs/STAGING_DEPLOYMENT_PLAN.md, docs/STAGING_XAMAN_TEST.md | keep private or redact before public release | No | Not necessarily |

### HIGH

| Issue | Affected files/history | Recommended action | History rewrite required? | Credential rotation required? |
|---|---|---|---|---|
| Bridge secret names and env variable names in source | backend/app/main.py, backend/app/services/identity.py | leave in code but document environment contract privately | No | Only if real values were ever used and exposed |
| Operational detail leakage in docs | docs/IDENTITY_FOUNDATION.md, docs/STAGING_DEPLOYMENT_PLAN.md | reduce public detail and split public/private docs | No | No |
| Local secret files may be accidentally archived | ignored files in workspace | enforce repo hygiene and archive restrictions | No | Maybe, if a real secret ever leaked |

### MEDIUM

| Issue | Affected files/history | Recommended action | History rewrite required? | Credential rotation required? |
|---|---|---|---|---|
| Untracked staging templates and examples | backend/.env.staging.example, frontend/.env.staging.example | keep private or convert to public-safe placeholders | No | No |
| Repo not clean and not ready for public archive | current working tree | final secret sweep and clean state before release | No | Depends on findings |
| Multiple overlapping docs | docs/ and architecture docs | consolidate public-facing docs | No | No |

### LOW

| Issue | Affected files/history | Recommended action | History rewrite required? | Credential rotation required? |
|---|---|---|---|---|
| Placeholder env names in examples | .env.example, frontend/.env.example | keep as safe examples | No | No |
| Historical docs beyond current app state | checkpoints/* | archive or clearly label as historical | No | No |

### History rewrite decision summary

- INFERENCE: the repo history does not currently show committed secret values or committed DBs.
- RECOMMENDATION: history rewrite is not currently required based on the evidence available in this repo snapshot.
- RECOMMENDATION: history rewrite may still be required later only if a separate secret-bearing branch or local ref is discovered during a broader forensic sweep.

---

## 12. HISTORY REWRITE DECISION

### Decision

NO HISTORY REWRITE REQUIRED

### Why

- GIT-HISTORY-EVIDENCE: no actual .env, .env.local, .db, or .sqlite files were found in current git history.
- GIT-HISTORY-EVIDENCE: placeholder env templates are present but are not secret-bearing.
- REPO-EVIDENCE: the active security issue is local/ignored working-tree exposure rather than committed git history exposure.
- INFERENCE: the current repo history appears cleaner than the active workspace state, though workspace hygiene still matters.

### Caveat

- UNKNOWN: whether older branches or unreferenced objects outside the current branch contain secret material remains unproven without a wider forensic scan of all refs and hidden Git objects.
- RECOMMENDATION: do not rule out a later history review if the repository is moved toward public release.

---

## 13. PUBLIC / PRIVATE CLASSIFICATION

| Category | Public | Private | Review |
|---|---|---|---|
| source code | Yes |  |  |
| architecture | Yes |  |  |
| roadmap | Yes |  |  |
| identity implementation |  |  | Yes |
| staging documentation |  |  | Yes |
| deployment documentation |  |  | Yes |
| databases |  | Yes |  |
| environment files |  | Yes |  |
| node infrastructure |  |  | Yes |
| decentralized POC |  |  | Yes |
| token infrastructure |  |  | Yes |

### Public/private policy guidance

- PUBLIC: generic app and product docs, generic architecture summaries, and safe roadmap text.
- REVIEW: identity flow details, staging docs, deployment architecture, and future ecosystem design.
- PRIVATE: local DB files, real env files, runtime secrets, and production/staging secrets.

---

## 14. SECURITY CHECKPOINT

### Current security posture

- REPO-EVIDENCE: the tracked git history does not show obvious committed secret values or DB snapshots.
- REPO-EVIDENCE: the local workspace does contain ignored secret-bearing files and runtime DB files.
- REPO-EVIDENCE: the project includes staging and bridge docs that reveal the operational architecture at a useful level.
- INFERENCE: the repo is in a private-workspace, not public-release, condition.

### Immediate blockers

- backend/.env exists in the active workspace
- frontend/.env.local exists in the active workspace
- database files exist in the workspace
- staging infrastructure information is documented in repo files
- current working tree is not clean enough for a public archive

### Required remediation

- remove or isolate real env files from the workspace
- remove or isolate DB files from the workspace and private backup storage
- reduce or separate staging deployment references from public documentation
- perform a final secret scan and clean repo state before public release
- classify public vs private docs and infrastructure artifacts explicitly

### Safe next step

- Continue with a controlled repo hygiene and secret review only after all live env files and DB files are confirmed private and excluded from publication.

---

V2 SECURITY EXPOSURE AUDIT COMPLETE
