# Identity Bridge code-provenance review

Status: public distribution and ecosystem reuse expansion blocked pending
source clearance. Local builds and tests remain allowed.

This review addresses code and documentation used to create the official
CalorieApp Identity Bridge. It is an engineering inventory, not a legal opinion
or a finding of exclusive authorship.

## Current evidence

- The release archive contains no Composer, npm, `vendor` or bundled SDK tree.
- Runtime code calls WordPress core APIs and the Xaman Platform API directly.
- The bridge reads three `xummlogin_*` WordPress options from the installed XUMM
  Login integration, but no XUMM Login source file is present in the archive.
- The exact installed XUMM Login directory was exported on 2026-09-04 through
  a temporary server archive. The verified archive contains 105 members,
  declares version `1.3.1`, and has SHA-256
  `8a0ec7531f536033a403196e934680882e7cde53a66dd4df453e81927b203806`.
  The temporary server archive was deleted after the local download passed its
  integrity and path-safety checks; the raw third-party package is not committed
  to this repository.
- The content-safe exact-package report binds all 63 PHP, JavaScript and CSS
  files in that archive to the scanned tree. It contains paths, hashes and
  overlap metrics only, not source lines, tokens or credentials.
- Repository history attributes plugin-path commits to the `xrpbanks` account
  and Codex. Commit attribution does not prove who authored every expression or
  whether a fragment was adapted from another source.
- The plugin declares GPL-2.0-or-later. That declaration cannot erase an
  incompatible third-party right or cure missing permission for copied code.

The machine-readable inventory at
`contracts/identity-bridge/v1/code-provenance.json` lists every file permitted
in the deterministic plugin archive. The release builder fails when the archive
allowlist and provenance inventory differ.

## Known external boundaries

### WordPress

The plugin depends on WordPress core APIs. WordPress states that its software is
GPLv2 or later and describes plugins and themes as derivative works in its
licensing position. The bridge's GPL declaration is compatible with that stated
platform boundary, but this is not a conclusion about every individual source
fragment.

### Xaman

The bridge uses documented server-side HTTP headers and payload endpoints. No
Xaman SDK is bundled. Xaman's developer documentation says backend API secrets
belong only in the backend; the current implementation follows that security
boundary. API/service terms and trade marks are separate from source-code
licensing and still need a recorded review.

The public XRPL Labs terms found during this review are B2C terms, version 1.3
from April 2025. They do not record the terms accepted for the Xaman developer
API account used by CalorieApp. Preserve the applicable developer-console/API
agreement or written provider confirmation before treating the service-terms
review as complete.

### XUMM Login

The current implementation directly reads option names owned operationally by
another installed plugin. That may be a compatibility interface rather than
copied code. The exact live package has now been compared without committing
its raw source to this repository, but every reported finding still needs human
review. Depending on undocumented internal option names is also a maintenance
and security risk.

The exact export identifies XUMM Login `1.3.1` and includes a
`CALORIEAPP-PATCH.md` note describing it as a CalorieApp cross-browser return
patch based on `1.3.0`. The patch note describes a return-URL handoff, whereas
Identity Bridge `0.3.3` again omits Xaman return URLs so Android and iOS cannot
move the flow into a different default browser. The committed similarity
reports remain the historical `0.3.2` review snapshot; they are technical
evidence only and do not prove independent authorship or permission.

After line-ending normalization, 75 of 79 paths shared with the public `1.3.0`
tree are identical. The four changed code files are
`includes/class-xummlogin-utils.php`, `includes/class-xummlogin-xumm.php`,
`public/js/xummlogin-public.js` and `xummlogin.php`. The exact package also adds
the patch note and two `.gitignore` files. This narrows the custom-patch origin
review without reproducing third-party source content.

The candidate public repository is `xrpfactchecker/xummlogin`, whose recorded
history moves from `1.3.0` at commit
`a2f00fb5065f613a8f74cbd9ca42020b92f2f1a6` to `1.5.0` at commit
`0a692dd91de44f7e7e4c2dcb44d7c210596e9fa2`; it has no public `1.3.1` tag.
The exact `1.3.1` header declares `GPL-2.0+`, while its `LICENSE` is GPLv3 text
and its separate `LICENSE.txt` is GPLv2 text. The exact source URL and the
intended relationship between those licence statements remain unresolved.

The recommended target is bridge-owned Xaman application credentials and an
explicit, documented migration from the existing XUMM Login configuration. No
credential value may be copied into source control or exposed to a browser.
Until that migration is designed and tested, the current login path must not be
silently changed.

## Clearance work before another public release

1. **Completed for local inspection:** export and integrity-check the exact
   installed XUMM Login package without a database dump or configuration
   credentials. Preserve the raw package in a controlled private legal archive
   before deleting the local working copy.
2. **Partially completed:** record its name, version, package hash and licence
   files. The exact source URL and conflicting licence signals still require
   resolution.
3. **Automated comparison completed; human review pending:** compare its PHP,
   JavaScript and CSS against every Identity Bridge release file using the
   reproducible similarity/provenance scan and review every generated finding.
4. Obtain source and AI-assistance declarations for the initial plugin import
   and later material changes; record any external snippets and permissions.
5. Review Xaman API/service terms for the intended official and ecosystem use.
6. Decide and test whether the bridge will migrate to its own Xaman credentials
   and user-provisioning setting.
7. Have the rights administrator and, where appropriate, independent counsel
   approve the result before changing the machine-readable status to cleared.

Use `docs/IDENTITY_BRIDGE_SOURCE_DECLARATION_TEMPLATE.md` for step 4. An
incomplete, ambiguous or unsupported declaration is evidence of an open item,
not a reason to infer clearance.

## Reproducible similarity scan

`tools/scan_identity_bridge_provenance.py` compares every PHP, JavaScript and
CSS file in the release inventory with every such file in a supplied XUMM Login
tree. It binds both trees by SHA-256 and writes only paths, digests and overlap
metrics; source lines, tokens and possible secrets are never copied into the
report.

Run it only on a preserved, non-executed source tree in a disposable directory:

```text
python tools/scan_identity_bridge_provenance.py \
  --xummlogin-dir <EXTRACTED_XUMMLOGIN_DIRECTORY> \
  --expected-xummlogin-version 1.3.1 \
  --source-reference <IMMUTABLE_PACKAGE_REFERENCE> \
  --package-archive <PRESERVED_XUMMLOGIN_ZIP> \
  --review-date <YYYY-MM-DD> \
  --output <NEW_EVIDENCE_REPORT.json>
```

The preliminary report at
`contracts/identity-bridge/v1/evidence/xummlogin-public-1.3.0-similarity.json`
uses the adjacent public `1.3.0` commit. Across 693 file pairs, its longest exact
normalized block is one line. Human review classified the exact-line matches as
ordinary WordPress/PHP API expressions or the explicitly declared compatibility
identifiers. This is useful negative evidence, but it cannot clear `1.3.1`.

The exact-package report is stored at
`contracts/identity-bridge/v1/evidence/xummlogin-live-1.3.1-similarity.json`.
It verifies the package hash and source-tree match and compares 693 file pairs.
It reports 29 low-overlap pairs, no exact normalized block longer than one line,
and a maximum token-shingle Jaccard score of `0.00334169`. Relative to the
public `1.3.0` scan, the exact package adds one token-only finding with no shared
normalized line and removes none. These results show no multi-line copy signal,
but they do not replace the required human source and rights review.

Every generated finding still needs human review. The report explicitly records
that an automated similarity scan cannot prove authorship, absence of adaptation
or permission and cannot clear public distribution.

## Automated gate

Ordinary CI may build a local inspection archive whose manifest records the
blocked provenance status. The tag-release workflow adds
`--require-cleared-provenance`; therefore it cannot publish a new plugin release
while the contract remains blocked. Adding any file to the archive also fails
until that file receives an inventory entry.

This gate does not merge, deploy, publish or change the live WordPress plugin.
