# Native CalorieApp account guidance — 17 September 2026

The owner's second mobile screenshots showed that Heading Repair 1.6.6 still displayed the Testnet setup as a long, WordPress-styled page. Styling that separate document did not meet the requested app navigation. This correction starts from live frontend commit `83b826a63f98850c1d15a9c87a0872d52188d1a2` and moves the entire in-app setup into the existing React workspace.

## Behaviour

- Account tools retains two explicit entry points. Account help also offers both routes.
- Test setup displays one of six pages: introduction, explicit account creation, mandatory secret backup, Testnet selection in Xaman, account import in Xaman, and return to sign-in.
- Migration displays one of seven pages: food export, sign-out, separate Mainnet creation in Xaman, mandatory recovery backup, sign-in, food import availability, and continue.
- A compact header, progress indicator and Previous/Next controls replace the stacked outer and inner tab grids. The normal workspace tab bar is hidden only while a guide is open; Back to account tools and Return to my guide preserve the current step.
- Native help no longer opens or sends account-guide handoff messages to WordPress. Existing WordPress standalone help remains in the installed plugin; a new plugin upload is not required for this frontend correction.
- No secret-entry field exists. New test credentials come directly from the official Testnet faucet after an explicit click. They remain in component memory only. The request has no body, credentials, redirects or referrer, and no app-server proxy.
- Secret reveal/copy is explicit, the backup acknowledgement requires prior access to the secret, and Next requires acknowledgement. Changing pages, hiding the guide or changing document visibility conceals it. Page departure/unmount clears it and aborts requests. Leaving with an unconfirmed backup requests the browser's standard leave-page warning.
- Back navigation does not create another account. Courtesy limits and provider Retry-After delays are retained, and funding checks use only the public address on the official Testnet ledger.
- Only a route/index pair and rate-limit deadlines may be saved. No recovery material or acknowledgement is persisted. After a reload, test setup starts safely from its introduction; later migration navigation returns to the backup checkpoint for reconfirmation.
- All added guidance is provided in the existing eleven locales, with RTL direction. Existing age, authentication, export and import controls remain in force. The import gate remains disabled; the guide does not claim food data has moved.

## Verification

Local production build and TypeScript validation passed. The full Node suite passed 380 tests, including response validation, conflicting seed rejection, empty outgoing requests, rate limits, abort/timeout cleanup, funding verification, migration navigation and translation structure.

A dedicated CI browser test embeds the production-built app inside a synthetic WordPress page with deliberately oversized serif theme styles and the installed app-focus script. It checks both routes, secret backup gates, concealment, return navigation, no duplicate creation, all eleven locales at 360/412/1440 px, and absence of recovery data in storage or parent messages. It intercepts every request and uses nonfunctional credential-shaped fixtures. No real faucet/account/wallet/food operation is performed. Its result and screenshots must be reviewed before rollout; local build checks alone are not visual acceptance.

## Rollout boundary

This is a correction to the same rollout the owner approved in this conversation. Keep PR #146 draft and unmerged; do not retry the previously rejected draft-status change. After successful verification, advance the existing release branch without force and deploy only the existing frontend. Do not deploy the backend, enable imports, change hosting costs/configuration, touch campaign material or perform real wallet operations. The currently installed Heading Repair 1.6.6 remains compatible because native help no longer uses the WordPress handoff.

Rollback reference before this correction: Render frontend deployment `dep-dalud7m5vjqs738mthb0`, commit `83b826a63f98850c1d15a9c87a0872d52188d1a2`.
