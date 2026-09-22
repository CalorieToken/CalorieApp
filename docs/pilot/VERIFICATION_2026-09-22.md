# Candidate verification — 22 September 2026

- Pilot isolation tests: **41 passed**, including amount precision, exact asset
  identity, voluntary participation, stock reservation/retry/cancellation,
  access isolation, failed/partial/wrong-issuer/wrong-fee payments, explicit
  fractional logging, quota rollback and separate practice diary.
- Account navigation, guided setup, pricing and WordPress help tests: **27
  passed**. The pricing notice renders in eleven locales, starts collapsed and
  refuses to call a paid policy free. Existing age restrictions remain intact.
- Frontend production build: **passed**. Existing TestnetEntry effect-cleanup
  lint warnings remain; there are no new build failures.
- Repository legal-boundary checks and `git diff --check`: **passed**. This is
  consistency testing, not professional legal approval.

No Mainnet/Testnet transfer, Xaman signing payload, live database/schema change,
production fee, paid subscription or Render deployment was performed for this
candidate. The existing live app stays on the previously verified release.
No physical-device or production pilot end-to-end acceptance is claimed.

The DEX worktree was checked again after implementation: its service still reads
WordPress `xummlogin_api_key` / `xummlogin_api_secret`. A requested **separate
CalorieApp payment rail** was not found. The rail seam fails closed, and no CALT
issuer has been invented. These missing inputs block completion of the live
payment path, alongside the documented API/UI, operations and review work.

WordPress help/FAQ and legal additions are source drafts. Another work chat is
also changing legal documents and DEX code. Integrate current versions carefully;
this candidate does not overwrite those edits or the site's live plugin files.
