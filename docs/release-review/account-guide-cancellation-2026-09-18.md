# Account guide cancellation

The account guide previously treated leaving the guide as a pause and always
kept the “Return to my guide” banner. Cancellation now has its own action in
the guide header and beside that banner.

Cancelling clears the saved navigation, consumes the guide launch fragment,
returns to account tools, and remounts the guide to discard its private state
and abort any pending request. A late response cannot restore the cancelled
guide. If a generated recovery code has not been acknowledged as saved, the
user must confirm before it is discarded. All eleven locales include the new
labels. Account tools opened as a step in migration still preserve progress.

Heading Repair 1.6.17 accepts the fixed cancellation message only from the
trusted embedded app. It clears only test or migration destinations, keeping
other direct task links unchanged. This prevents a refresh from replaying the
cancelled launch URL.

Validation: production build and TypeScript checks passed. All 26 focused
tests passed, covering cancellation, remount, new setup, pending request abort,
late response rejection, declining an unsaved-code confirmation, trusted host
messages, unchanged task destinations, and eleven-language copy.

Rollout: existing Render frontend only, from release/step3-render-3845de6;
replace the existing WordPress Heading Repair 1.6.16 with 1.6.17 and purge the
page cache. No backend, account, infrastructure or service-plan changes.
