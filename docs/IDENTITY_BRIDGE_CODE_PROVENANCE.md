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
- The live public page exposed XUMM Login JavaScript and CSS assets labelled
  `1.3.1` on 2026-09-03. This identifies the runtime label, not the exact PHP
  package contents or their integrity.
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
copied code, but the repository does not contain the exact upstream package
needed to verify the distinction. Depending on undocumented internal option
names is also a maintenance and security risk.

The live assets identify XUMM Login `1.3.1`. The candidate public repository is
`xrpfactchecker/xummlogin`, whose recorded history moves from `1.3.0` at commit
`a2f00fb5065f613a8f74cbd9ca42020b92f2f1a6` to `1.5.0` at commit
`0a692dd91de44f7e7e4c2dcb44d7c210596e9fa2`; it has no public `1.3.1` tag.
The `1.3.0` plugin header declares GPL-2.0-or-later while its included `LICENSE`
is GPLv3 text. Consequently, the public repository can identify a candidate
licensing boundary but cannot substitute for an export of the installed
package and its actual notices.

The recommended target is bridge-owned Xaman application credentials and an
explicit, documented migration from the existing XUMM Login configuration. No
credential value may be copied into source control or exposed to a browser.
Until that migration is designed and tested, the current login path must not be
silently changed.

## Clearance work before another public release

1. Export the exact installed XUMM Login plugin package without credentials.
2. Record its name, version, source URL, licence and required notices.
3. Compare its PHP, JavaScript and CSS against every Identity Bridge release
   file using a reproducible similarity/provenance scan plus human review.
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
