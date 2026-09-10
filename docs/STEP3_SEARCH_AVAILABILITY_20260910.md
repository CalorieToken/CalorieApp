# Step 3: patient food search

The operator confirmed that food search returns results, but reported startup
and rate-limit errors during repeated attempts. The existing bounded backend
warmup, search proxy deadline, public-result cache and provider cooldown remain.

This frontend correction prevents form resubmissions from aborting/restarting a
pending warmup or food search. It displays a short startup explanation in all
11 display languages. After HTTP 429 the button waits at least 60 seconds and
honors a longer numeric or HTTP-date Retry-After. Temporary 502/503/504 and
connection/startup failures pause for at least 30 seconds; longer server pauses
are honored when supplied. The countdown is a local UI timer: expiry never
automatically repeats a food search. The query remains available for a deliberate
retry. Login, saved food logs, requests' locale/auth semantics and backend logic
are unchanged.

This improves feedback and avoids impatient duplicate submissions; it does not
promise uninterrupted availability or remove hosting/provider limits. Refreshes
and separate browser tabs still rely on the backend's existing limit enforcement.
This change deploys with CalorieApp, separately from the WordPress plugin ZIP.
The actual Render deployment and first-search experience need live confirmation.

Verification includes a pending warmup with repeated submissions, duplicate
submissions during the actual search, 429 countdown/expiry without auto-retry,
startup failure, numeric/date/missing/invalid Retry-After, and all 11 languages.
