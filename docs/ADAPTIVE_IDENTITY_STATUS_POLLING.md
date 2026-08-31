# Adaptive Identity Bridge status polling

Status: implemented for the CalorieApp origin-handoff status and the embedded
WordPress/Xaman finish status.

## Purpose

The initiating browser must detect when an external Xaman sign-in completes,
including after the operating system temporarily leaves or suspends that tab.
A fixed five-second poll gives a quick initial response but produces unnecessary
requests when signing takes longer or a service is temporarily unavailable.

Both polling layers now use the same reviewed elapsed-time schedule:

| Time since polling began | Next pending-status check |
| --- | ---: |
| First 30 seconds | 5 seconds |
| 30 through 89 seconds | 10 seconds |
| 90 seconds and later | 20 seconds |

The initial five-second responsiveness is preserved. A continuously pending
five-minute backend handoff produces roughly 22 scheduled checks instead of up
to 60. Browser timer throttling and request duration may reduce that number
further.

## Failures and provider guidance

Consecutive transport or retryable HTTP failures use delays of 10, 20 and then
30 seconds. A successful pending response clears the failure count but does not
reset the elapsed-time phase. A valid `Retry-After` value is honored when it is
longer, with a maximum of 60 seconds. There is no nested retry loop and no extra
probe request.

The existing state and flow expiries remain final deadlines. The frontend does
not issue a status request at or after the known handoff expiry.

## Browser lifecycle and event behavior

Focus, visibility and page-show events may initiate the first WordPress status
check after returning from Xaman, but cannot bypass an already scheduled delay.
This prevents repeated focus events from creating a burst. A verified positive
Xaman WebSocket `signed` event is event-driven rather than a periodic poll and
may trigger an immediate completion check.

Aborting or replacing a login cancels its timer. Pending state remains bound to
the initiating tab through the existing hashed handoff proof.

## Cost and scope

This control is entirely client-side scheduling. It adds no database table,
external provider, paid service, GitHub Actions job or recurring request type.
It reduces expected backend, WordPress and Xaman status traffic.

This change does not prove the deployed frontend/proxy topology and does not
implement a trusted short-lived network-signal limit. Those remain explicit V2
release gates. No production deployment is claimed by this repository change.
