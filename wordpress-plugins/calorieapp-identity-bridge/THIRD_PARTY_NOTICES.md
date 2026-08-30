# CalorieApp Identity Bridge third-party notices

This file identifies known external technology boundaries. It is not a legal
clearance opinion and does not prove that the source history is complete.

## WordPress

The plugin runs on WordPress and calls WordPress core APIs. WordPress states
that its software is GPLv2 or later and that plugins and themes are derivative
works in its licensing position. No WordPress core source file is intentionally
bundled in this plugin archive. WordPress names and marks remain with their
respective owners.

Source: https://wordpress.org/about/license/

## Xaman platform

The integrated sign-in flow sends server-side HTTP requests to the Xaman
Platform API. The plugin does not bundle the Xaman JavaScript, TypeScript or PHP
SDK. Xaman documentation requires backend API keys and secrets to remain in a
backend environment; the bridge keeps them server-side.

Sources:

- https://docs.xaman.dev/concepts/authorization
- https://docs.xaman.dev/environments/backend-sdk-api

API access terms, service availability, names and marks remain external to this
plugin licence and require review before any expanded ecosystem offering.

## Existing XUMM Login plugin compatibility

The current bridge reads the WordPress option names `xummlogin_api_key`,
`xummlogin_api_secret` and `xummlogin_create_user` to interoperate with the
installed XUMM Login plugin. No XUMM Login source file or package has been
identified in this release archive. That observation does not prove that no
fragment was adapted during development.

Before another public Identity Bridge release or ecosystem reuse expansion, the
exact installed XUMM Login package, version, source, licence and notices must be
preserved and compared with the bridge. The project must then either document a
permitted compatibility boundary or migrate to bridge-owned Xaman credentials
and an approved user-provisioning setting.

## Project-generated locale registry

`config/locales.json` is a generated deployment copy of
`contracts/identity-bridge/v1/locales.json` in the CalorieApp repository. Its
presence must stay synchronized by the contract tooling.

## Source and contribution limitation

Repository history currently contains commits attributed to the `xrpbanks`
account and to Codex. Commit metadata is technical evidence, not proof of legal
authorship, assignment or independent creation. AI assistance, external
snippets, employer or contractor rights and every adapted source must be
declared and reviewed under the repository contribution policy.
