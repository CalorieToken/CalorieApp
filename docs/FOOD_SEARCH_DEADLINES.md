# Food search deadline correction

The mobile screenshots show one failed search for Magnum followed by results
after a second click. They do not contain an HTTP status, trace or provider log.

The app already waits for backend readiness before searching. In
`backend/services/open_food_facts.py`, the existing primary request has a
10-second timeout and its eligible fallback has a 15-second timeout, with
bounded adapter queueing. Before this change, the frontend proxy stopped at
18 seconds and the browser request helper at 20. A valid slower backend search
could therefore be cut off even though backend readiness had succeeded.

Only `/search-food` now uses a 45-second proxy timeout and a 50-second browser
timeout. The client gives the proxy time to return a controlled 504. Search
progress explains the possible delay; 429, 504 and other service errors have
specific user-facing messages. Identity, logout, ordinary request and account
import deadlines are unchanged. Existing provider concurrency, attempt limits,
queue limits, rate governor and upstream Retry-After forwarding are unchanged.
No automatic search retry is added.

`tools/tests/food_search_deadline.test.mjs` runs the real transpiled browser
helper and proxy together under a virtual clock. It checks one successful
26-second response, a bounded 45-second timeout, an unchanged 18-second ordinary
request timeout, and a forwarded 429/Retry-After without an extra provider call.
Existing food logging and logout behavior tests run beside it in CI.

This demonstrates a concrete deadline mismatch. It does not prove that the
captured failure followed that route or guarantee availability of Open Food
Facts. One live search after inactivity remains the acceptance check after
deployment; the WordPress plugin ZIP alone cannot deliver this app change.
