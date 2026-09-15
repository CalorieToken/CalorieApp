# Review checkpoint: 15 September 2026, round 2

This is a content/review checkpoint, not a completed live release. Continue the
existing application candidate `ac724aabf1534e51e819ef5d84df04f246eeea23`; do not
create another alternative app implementation. Draft PR #148 contains only
content/documentation changes and remains unmerged.

## Completed work

WordPress draft page 8073 was created through the authenticated standard REST
API and read back successfully with `status=draft`. Its source-letter and USDA
confirmation explanations cover all eleven locales. Existing public pages,
Brizy content, Help data and server-side plugin files were not replaced.

The two existing public food/Help guides were aligned in documentation commit
`e267571d521f0d003be1dfb1eef867cd5a6d7e25`. The distinction between the tested app
candidate, historical deployments and the observed live Help version is explicit.

The local combined review was rebuilt with the 97 retained proposals and their
original copy, media, channels and historical proposed dates unchanged. The
per-item approval interface, feedback storage and feedback export were removed.
Every proposal remains unscheduled and unauthorised. Two original proposed dates
were already past; they do not trigger catch-up publication.

A new feature section pairs the updated instructions with the exact-source USDA
screenshot in each of the eleven locales, including RTL for Arabic and Urdu.
The original CalorieToken image assets are retained. No font files, external
scripts, tracking, API writes or autoplay were added.

## Deliverables saved with the conversation

- `CalorieApp_Nieuwe_Bediening_11_Talen.html`: self-contained eleven-language
  instruction/screenshot guide, 1,293,069 bytes. SHA-256:
  `29ddcf3d2ad2753cb90653682cb05fa75fa4b4fb7883126f630236113426fedd`.
- `CalorieToken_Werkreview_2026-09-15_R2.zip`: complete review package with the
  retained media, 553,402,968 bytes. Extract and open `EEN_OVERZICHT.html`.
  SHA-256: `02b7b34d7470f821fa948b91905af6a1edfc47115f76cbbf042958caf236d29a`.
- `CalorieToken_Hervatpunt_2026-09-15_R2.zip`: compact checkpoint, guarded Help
  patch, validation reports, build scripts and exact-source CI artifact,
  7,518,462 bytes. SHA-256:
  `35b4b53b591aedd1edd4c4ea386093f5876f1274847d8b2cbe8df2c7ea490182`.

These files are conversation artifacts, not claimed to be uploaded to GitHub,
WordPress, Google Drive, Buffer or another publishing service.

## Checks and limits

All 218 actively used local media/caption/image paths exist. Both ZIPs passed
CRC validation. Original proposal content was compared with the recovered
source archive. The new review scripts passed syntax checking and 152 checks
in a minimal structural DOM harness. That harness is not a visual browser or
layout test. No new rendered-browser acceptance is claimed for the review.

The guarded Help patch changes 33 fields across eleven locales, reproduces the
retained candidate, and rejects deliberately changed source input. Its hashes
refer to the retained snapshot, not a newly fetched complete live file.

A fresh local application regression attempt DID NOT PASS: the runner reported
200 passing and 11 failing tests. All 11 failures reported missing modules in
this extracted source archive: `react`, `@zxing/library` or `linkedom`. Installed
frontend dependencies were not included in the source archive; no installation,
source workaround or production change was performed. Preserve the failure log.
Do not relabel this attempt as successful or as a new production-build result.

The earlier exact-source CI artifact remains separate evidence: run
`35006320526`, artifact `10411468462`, completed build and 56 browser assertions
using a synthetic API/diary. Archive SHA-256 was independently matched after
retrieval: `3f56ed370f3c851afda626b1dd064993473169f9819449de10eed0146f2919ca`.
This does not establish real Xaman, camera, real diary, native-language or
complete live-site acceptance.

## Resume without another inventory loop

The standard WordPress connection now supports reads and draft creation. Its
missing companion-plugin route is a separate issue for server-file/CLI work;
do not keep reauthorising the working connection. Use a supported authorised
current-plugin update path rather than overwriting the site from an old full
repository plugin snapshot.

Render workspace selection still awaits the owner's explicit confirmation of
`My Workspace`. No selection, branch retargeting or deployment occurred here.
After confirmation, verify the actual live version before a controlled rollout.

Still outstanding: coordinated app/Help/site rollout; full website and applicable
legal-copy alignment; complete new-feature recordings and remaining spoken
language versions; complete overall owner review. The connected HeyGen profile
reported a free plan with null credit availability, not a verified generation
allowance. No new paid generation was started.

Campaign scheduling/publication remains gated on the owner's later explicit
overall approval in chat. No individual approval forms and no automatic
publication of expired proposed dates.
