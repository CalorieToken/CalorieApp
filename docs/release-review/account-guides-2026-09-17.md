# Account setup and Testnet-to-real-account guidance — 17 September 2026

Prepared on the existing draft PR #146, starting from `66780abf518e98148d5279fe10435752275911dc`.

The owner reported that the Testnet guide looked and navigated like a separate WordPress page, and could not find the real-account transition. The screenshot showed oversized theme text inside a nested scrolling dialog.

## Change

- Account tools now has explicit **Testaccount instellen** and **Van test naar echt account** entry points. All five workspace tabs remain visible on small screens.
- The migration guide displays one of five actionable steps at a time: export, sign out, create a fresh Mainnet account in Xaman, sign in with that account, and import eligible food history if available. Previous/Next and direct step selection preserve position.
- Export/import links open the relevant existing account tool. A return-to-guide button restores the same step after visiting account tools or the diary. Only an enum and a step number are retained in tab storage, including across the existing sign-in return; no identity, wallet, food record or recovery information is retained by this navigation feature.
- Heading Repair **1.6.6** places the existing first-party Testnet guide inline in the app area with CalorieApp typography and controls. It has four step tabs, Previous/Next, optional screenshot disclosures and a return to the same mounted app iframe. Theme introductions are hidden in this view.
- Returning to the creation step retains the original test account and cannot issue another faucet request. Leaving a step or closing the guide conceals any revealed recovery code.
- All added user-facing account-guide labels are supplied in the eleven existing locales. Existing age restrictions and strict origin/source/message-shape checks remain in place.

## Verification

- Production Next.js build and TypeScript check passed locally.
- Full Node regression suite: 374 passed, zero failed.
- Five release-packaging checks passed; archive contents are verified against the source files.
- Added functional tests cover the five migration screens, forward/back navigation, return from account tools, resuming after remount, disabled import, enabled import entry-point visibility, corrupt saved navigation and four Testnet steps without duplicate account creation.
- The local browser preview could not be opened: Cloud Browser's URL policy rejected the local file URL. No visual acceptance of the changed UI or end-to-end real wallet flow is claimed. The preview generator is an isolated fixture, with account/login tools simulated and all network requests blocked.

## Release boundary and continuity

This work does **not** merge PR #146, deploy Render, install a WordPress plugin, create any real account, move any user data, or activate the disabled import gate. The owner previously limited live work to Heading Repair 1.6.5. Treat 1.6.6 and the changed frontend as a paired review candidate. Preserve the existing login/logout fixes and source-hash checks. Do not replace the installed Site Style or Identity Bridge from old repository snapshots.

The existing import control remains build-flagged and server-checked. Test XRP cannot become real XRP. Guidance is not a promise that data has been imported, and stepping forward does not execute export, sign-out, account creation or import. Mainnet account creation remains in Xaman. Official instructions: https://help.xaman.app/app/getting-started-with-xaman/your-first-xrp-ledger-account/how-to-create-an-xrpl-account .

Before an authorized rollout, review the frontend candidate together with the companion package. After rollout, check the actual embedded site at 360, 412 and 1440 px, verify back/next/return paths and language switching, and perform the owner's normal real-device acceptance. Full-wallet, mainnet or personal-data operations require the owner's own actions.
