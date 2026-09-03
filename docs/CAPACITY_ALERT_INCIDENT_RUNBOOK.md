# Capacity alert incident runbook

Status: provider-neutral response contract and synthetic CI proof complete.
External alert destination and live delivery proof remain release-blocking for
public onboarding.

For isolated Neon synthetic staging only, current provider-native Free hard
limits plus mandatory console and database-probe observations before and after
each manual run form the approved zero-cost boundary. This is not continuous
alerting and does not remove the public-onboarding block.

## Probe contract

Run `python -m app.capacity_probe` from the backend environment. The command is
read-only. It emits exactly one deterministic JSON object and a stable exit code:

| Exit | Status or level | Required operator response |
|---:|---|---|
| 0 | normal | No capacity action |
| 10 | warning (70%) | Review growth and verify the approved quota |
| 20 | critical (85%) | Prepare the onboarding pause and investigate the cause |
| 30 | pause (95%) | Keep existing access available; confirm new onboarding is paused |
| 40 | unconfigured | Keep public release blocked; configure no guessed quota |
| 50 | unavailable | Investigate immediately; new onboarding already fails closed when configured |

The JSON schema identifier is `calorieapp.capacity-probe.v1`. Payloads include
only status, configured state, policy level, crossed threshold, onboarding state,
action and—when needed—a fixed reason code. Exact bytes, utilization, database
address, exception details, user identifiers and request content are excluded.

## Response by level

### Warning — 70 percent

1. Acknowledge during the same operator workday.
2. Confirm the configured byte budget still matches the human-approved provider
   quota and current terms.
3. Check aggregate growth and recent deploy/migration changes without inspecting
   private request content.
4. Record the finding. Do not buy capacity or delete history automatically.

### Critical — 85 percent

1. Start same-day incident review and increase observation frequency within the
   provider's free and abuse-safe limits.
2. Verify backup/restore and provider-exit evidence is current.
3. Prepare a user-safe onboarding-pause notice, but do not publish or broaden its
   scope without human review.
4. Suspend nonessential new ingest only through a separately approved control;
   existing read, export and erasure access stays available.

### Pause — 95 percent

1. Confirm the backend returns HTTP 503 plus bounded `Retry-After` only for a new
   identity and creates no partial account.
2. Confirm an existing identity can still log in and use read, export and erasure
   routes.
3. Stop any discretionary growth source that has an approved reversible pause.
4. Review backup and exit options. Never trigger an automatic paid upgrade and
   never delete or shorten existing history to remain free.
5. A human decides the recovery action and any user communication.

### Unconfigured or unavailable

An unconfigured exact limit blocks public release; it is not permission to guess
a provider quota. If a configured measurement is unavailable, the application
already fails closed for new onboarding. Investigate connectivity, permissions
and configuration without logging credentials or connection strings. Existing
user routes remain outside the onboarding-only guard.

## Recovery and closure

Do not declare recovery from a single dashboard screenshot. Confirm the probe,
database readiness and onboarding behavior with repeat synthetic checks. Record
the cause, actions, evidence and human decision. Any quota change, provider
change, paid service, deletion policy or broader mutation requires separate
approval. The external alert destination and schedule are selected only after a
provider is approved; CI proves the adapter contract, not real-world delivery.
