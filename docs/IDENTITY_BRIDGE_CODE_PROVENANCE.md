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

### XUMM Login

The current implementation directly reads option names owned operationally by
another installed plugin. That may be a compatibility interface rather than
copied code, but the repository does not contain the exact upstream package
needed to verify the distinction. Depending on undocumented internal option
names is also a maintenance and security risk.

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

## Automated gate

Ordinary CI may build a local inspection archive whose manifest records the
blocked provenance status. The tag-release workflow adds
`--require-cleared-provenance`; therefore it cannot publish a new plugin release
while the contract remains blocked. Adding any file to the archive also fails
until that file receives an inventory entry.

This gate does not merge, deploy, publish or change the live WordPress plugin.
