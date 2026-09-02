# Calorie ecosystem continuity foundation

Status: pre-release and incomplete. V1 food-history import planning,
clean-target admission and guarded internal transaction staging are
implemented, while the authenticated endpoint, production activation and
provider-exit proof remain blocked. This document defines the
technical continuity target; it does not transfer legal ownership, credentials,
personal data or trade mark rights.

## Official management and parallel ecosystem

Pieter Hendrikse and CalorieToken remain the active operator of the official
CalorieApp. Official release decisions, infrastructure administration and use
of the CalorieApp and CalorieToken brands remain under that operator's control.
Open source or open contracts do not make an external implementation official.
Contributions and integrations enter the official app only after operator
review and approval.

A parallel Calorie ecosystem may grow through published schemas, contracts,
data formats, verification specifications and documented extension interfaces.
This layer enables independent experimentation and interoperability without
creating shared control over the official product. Publication or public source
visibility is not by itself reuse permission: every component remains governed
by its explicit licence or written permission. A permitted fork may not present
itself as the official CalorieApp or use protected CalorieApp or CalorieToken
branding without authorization.

The continuity provisions below are emergency preservation and recovery
measures. They do not pre-authorize a takeover, credential transfer, release or
brand transfer while the current operator is active.

## Continuity goal

The open technical foundation should remain understandable, verifiable,
deployable and forkable if Pieter Hendrikse, CalorieToken as the current project
operator or the current development team becomes unavailable. No public release
may claim this resilience until a synthetic handover and restore have succeeded.

## Public continuity layer

- Source, schemas, migration history and machine-readable contracts remain in
  version control under the repository's approved licences.
- Builds and validation are deterministic and documented.
- The database schema remains provider-neutral and can be recreated without a
  paid proprietary database feature.
- Export and import formats are versioned so authorized data can move to a
  successor deployment.
- Public XRPL transaction anchors remain independently verifiable even when the
  CalorieApp service is offline.
- Public documentation contains roles and procedures, never credentials,
  recovery codes, personal data or private operational endpoints.

## External developer boundary

Future ecosystem developers may integrate through a reviewed, revocable client
interface, not through direct access to the Identity Bridge database, password
store, session store or private user records. Every client must use narrowly
defined scopes, an allowlisted redirect destination, short-lived
audience-restricted tokens and explicit user consent for each purpose. A
pairwise pseudonymous subject prevents different ecosystem apps from silently
combining the same user's activity.

The Identity Bridge may therefore operate as the managed connection tool and
trust boundary between the official CalorieApp and the parallel ecosystem. Its
foundation, security policy, client approvals, releases and revocations remain
under Pieter Hendrikse and CalorieToken. Participating in the ecosystem does not
grant authority to administer or alter that foundation.

Specifications, contracts and local conformance tools explicitly designated
for ecosystem use must remain free to access; their exact reuse rights must be
stated per component.
Separately reviewed premium developer services may later cover a managed
sandbox, higher rate limits, integration review, verified-client status or
professional support. Payment must never buy broader access to personal data.
Food history and donation details remain unavailable by default, and any future
scope needs its own product, privacy, security and legal review before it can be
enabled.

## Confidential operator layer

A separate access-controlled runbook must identify recovery and successor roles
for the domain, WordPress, GitHub organization, app runtime, database, encrypted
backups, signing material and relevant XRPL administration. It must document
credential rotation, loss recovery, incident contact and lawful data-controller
handover without placing any secret in the repository.

At least two authorized recovery paths are required for every release-critical
service. That does not mean publishing or casually sharing keys. Access follows
least privilege and is tested with synthetic credentials and data before public
onboarding.

## User continuity

Users need an authenticated, portable export and a later user-controlled
encrypted backup. If the central service disappears, those artifacts preserve
the user's own history without exposing it publicly. A successor service may
import it only after authentication, format validation and explicit user action.

The current pure import planner validates the exact v1 private export and
prepares only food-log snapshots for a separately authenticated target account.
The pure admission layer then requires the authenticated target and explicit
confirmation to match, allows a new plan only for a clean target, treats an
already-recorded exact digest as a no-op, and enforces the retained-row ceiling.
An internal, disabled-by-default non-production helper now stages the admitted
food rows and private replay receipt under the same transaction lock without
committing. None of these layers rehydrates exported identities, sessions,
authorization activity, browser handoffs or retention notices. There is still
no authenticated upload endpoint or provider-exit evidence; see
`ACCOUNT_DATA_IMPORT.md`.

## Prohibited shortcuts

- No automatic dead-man switch.
- No automatic credential, treasury, token or domain transfer.
- No public recovery secrets or personal data.
- No claim that open source alone guarantees continued hosting.
- No combining previously separate identity, donation, food-history or wallet
  purposes during a handover.

## Release evidence still required

1. Rebuild the services from a clean checkout using only documented inputs.
2. Export, restore and import a synthetic user and food history.
3. Restore an encrypted synthetic backup into a clean PostgreSQL instance.
4. Complete a role-based operator handover without using the founder's active
   browser session or personal device.
5. Confirm that loss of the app does not prevent independent verification of a
   public XRPL anchor.
6. Obtain separate legal review for trade mark, company, data-controller and
   other non-technical succession questions.
