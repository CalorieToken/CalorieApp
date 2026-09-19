# Local voluntary-node simulator — first implementation slice

Status: implemented and locally verified; production participation remains disabled.
Base: `feat/showcase-open-world-masterplan` at `3aa559b382db1c35db314f1c63142cb5f2cd8009`.
Implementation branch: `feat/participation-node-simulator`.

## What this step delivers

An offline demonstration of one voluntarily stored synthetic CalorieDB shard:

1. Register a fictional participant with storage, compute and reward consent off.
2. Explicitly enable storage and optionally simulated reward accounting.
3. Issue a bounded challenge for an embedded synthetic public shard.
4. Save the exact shard bytes in the node's directory.
5. Re-read that file and hash its bytes together with a fresh challenge.
6. Verify the response against the coordinator's original challenge and bytes.
7. Atomically consume the challenge and record at most one fictitious credit.

The fixtures are invented apple, bread, water and vegetable-catalog labels. There are no actual
food-source imports, personal logs, account identifiers, wallet addresses or keys.
The command accepts no data file, URL or database connection parameter.

## Run and check

Python 3.11 or later, standard library only, from the repository root:

```bash
python -m unittest tools.tests.test_participation_simulator -v
python -m tools.participation_simulator --enable-synthetic-demo
```

Without `--enable-synthetic-demo`, the command reports `disabled`, exits with code
2 and creates no simulator state. The enabled demonstration creates an isolated
temporary coordinator database and node directory, then removes both on exit.
It uses a fixed synthetic clock so the demo also works across real midnight.

Expected result:

| Scenario | Verified | New simulated units |
| --- | --- | --- |
| First valid response | Yes | 1 |
| Same response again | No new acceptance | 0 |
| New challenge for the same participant/shard/day | Yes | 0 |
| Pending response after withdrawal | No | 0 |

The first participant's final balance is `1 CALT_SIMULATED`; on-chain transactions
are `0`. A second participant completing the larger vegetable shard receives `2`
simulated units. The demo also exercises a timed pause, fresh work after the
chosen resume time and full stop with local shard deletion.
These numerical units and caps are demonstration settings, not an approved CALT
distribution schedule or an entitlement to real or Testnet tokens.

## Versioned protocol and accounting

Policy is in `contracts/participation/v1/simulator.json`; the network contract
links to it. `participant_node`, `participant_compute` and
`participant_testnet_settlement` remain false. Neither CalorieApp nor WordPress
imports this simulator or starts work when a person opens a page.

- The manifest declares a schema, classification, exact byte length and SHA-256.
  Admission only accepts the embedded fixtures, not arbitrary bytes carrying a
  `public` label.
- Each challenge binds a fresh 256-bit nonce, a challenge ID, participant ID,
  manifest, task version, consent revision and server-issued time window.
- The response is SHA-256 over the UTF-8/ASCII proof domain, a NUL separator,
  canonical JSON of the challenge, another NUL separator, and the stored bytes.
  Canonical JSON sorts keys, uses compact separators and ASCII escaping.
- The coordinator reconstructs the response from its own saved challenge. A
  client cannot supply different owner, reward amount, shard or expiry metadata.
- Expiry is exclusive, after at most 120 seconds and no later than the next UTC
  midnight. A fresh day's accounting requires a fresh valid challenge.
- An owned invalid response consumes its challenge. A different caller cannot
  consume another participant's pending challenge.
- One credit receipt per participant/shard/UTC day. Its amount is one simulated
  unit per 256 verified fixture bytes, rounded up, with a two-unit daily limit
  across shards. A larger accepted shard can earn more, up to the remaining daily
  budget; a partially capped receipt cannot claim a second remainder that day.
  Only the coordinator's exact allowlisted fixture bytes count. Multiple node
  directories for one participant share the same limit.
- Challenge consumption, duplicate detection, cap checking and credit insertion
  occur inside one SQLite `BEGIN IMMEDIATE` transaction with uniqueness keys.
  A database failure rolls the whole acceptance back. Receipts survive a restart
  when the same isolated coordinator file is reused by the test harness.

The central SQLite file is just the local simulator ledger. It does not replace,
connect to or migrate the application's PostgreSQL database.

## Consent and resource behavior

- Storage and compute are independent opt-ins; compute consent cannot authorize
  storage. No compute jobs exist in this slice.
- Rewards require a separate opt-in and a synthetic adult participant. Child and
  teen test identities can complete the non-value simulation, but earn no credits.
- Every central consent change increments a revision. Pause/resume or withdrawal
  followed by re-enrollment cannot revive an old challenge.
- `node.pause()` and `coordinator.pause(id)` pause indefinitely.
  `pause(until=unix_timestamp)` resumes eligibility only at the explicitly chosen
  time. `resume()` removes the pause without enabling any unselected resource role.
- `node.stop()` revokes storage, compute and reward consent and deletes local
  fixture shards by default. `coordinator.stop(id)` revokes the central permissions.
  Full stop does not automatically resume, even after restart or `resume()`;
  participating again requires new explicit consent.
- The local node rejects work while storage is off or paused. Local deletion
  remains available. Previously earned accounting receipts are not erased by
  withdrawing participation.
- Selected limits bound aggregate shard-file bytes and simulated transfer bytes.
  Transfers count received payloads and serialized proof responses, per node run.
  Transfer counters are local and reset when a new node object is constructed;
  this is not a monthly bandwidth meter. Challenge/control traffic and filesystem
  metadata overhead are not included.

## Evidence and limitations

The 41 behavioral tests cover the successful local file round trip, corrupt or
missing shards, manifest/proof substitution, wrong callers, expiry, midnight,
withdrawal/re-opt-in, pause, optional rewards, minors, storage/transfer caps,
coordinator restart, concurrent replay, concurrent duplicate work, concurrent
reward-cap enforcement, transaction rollback, timed/manual pause and resume,
full stop, larger useful contributions, rejected padding and an offline CLI run.
The test suite is included in the repository CI workflow.

The demonstration is deliberately confined to one trusted local machine. Synthetic
participant IDs and age bands are assigned by the harness; they are not real
authentication or age verification. Consent changes are applied separately to
the node and coordinator in the harness. No remote consent synchronization,
signed challenge transport or Sybil resistance is implemented.

Participation, resource roles and optional CALT rewards must never gate normal
app use or core gameplay. Larger resource allowances alone do not earn more.
Future compute rewards should be based on verified accepted task work, while
storage-duration/reliability rewards require actual retention verification first.
These are future policies, not implemented storage-duration or compute proofs.

A successful answer demonstrates that the bytes were available to compute a
response. It does not establish continuous retention, a separate physical copy,
an independent operator, useful long-term storage, or a production proof-of-storage
protocol. Public bytes could be fetched again or reconstructed. The fixtures are
embedded in both roles because this is a synthetic flow demonstration.

There is no network server, real volunteer enrollment, browser background worker,
arbitrary job runner, payment adapter or blockchain transaction. The Node API is
single-process; only central accounting concurrency is exercised. Participant
endpoints require a separately reviewed implementation before real onboarding.

## Second bounded slice: deterministic synthetic compute

The same branch now also contains a separate compute-only demonstration in
`tools/participation_compute_simulator.py` and a fixed child-process worker in
`tools/participation_compute_worker.py`. It remains disabled unless the
synthetic demo flag is supplied.

The task is deliberately narrow: summarize one of the same embedded invented
public catalog fixtures into a deterministic record count, sorted synthetic IDs
and sorted label initials. The node cannot submit Python, shell commands, URLs,
paths or arbitrary input. Compute requires its own explicit consent; storage
consent alone does not enable it. Pause or any consent revision invalidates
pending work.

The worker runs as a separate Python process with isolated interpreter mode,
bounded input/output, a two-second wall-clock deadline and a per-node task-count
limit. The coordinator independently executes the fixed worker over its own
allowlisted input and compares the complete canonical result. This is useful
process isolation for the synthetic drill, **not** a secure sandbox for
untrusted general-purpose code. No real volunteer device may receive arbitrary
jobs until a separately reviewed sandbox has been selected.

Compute rewards remain fictitious `CALT_SIMULATED` accounting, adult-only when
reward opt-in is selected, deduplicated per participant/input/day and capped.
The compute simulator uses a separate local SQLite ledger from the storage
simulator, so its demo does not claim a combined cross-service daily accounting
system. Real settlement remains disabled.

Run:

```bash
python -m unittest tools.tests.test_participation_compute_simulator -v
python -m tools.participation_compute_simulator --enable-synthetic-demo
```

## Continuity and next step

Continue in small, verified steps, preserving the architecture decisions in
`DECENTRALIZED_PARTICIPATION_ARCHITECTURE.md` and the campaign visual continuity
requirements in `SHOWCASE_OPEN_WORLD_MASTERPLAN.md`.

## Grow-from-small architecture

The first usable release should deliberately be small: one local participation
service, a limited set of synthetic/public-data jobs, conservative resource
limits, simple verification, and no dependency on having a large volunteer
network on day one.

The architecture should nevertheless be designed so that participation can
increase capacity rather than force a redesign later:

- **Useful at zero participation:** CalorieApp and the Gameverse remain functional
  even if nobody contributes storage or compute.
- **Graceful growth:** each additional opted-in participant can add bounded storage
  capacity, bounded compute capacity, or both.
- **No minimum network assumption:** core product features must not require a
  threshold number of volunteer nodes before they work.
- **Provider-neutral task model:** storage shards and deterministic compute jobs
  use versioned contracts so that future desktop, browser, mobile, hosted, or
  community node implementations can participate without changing the logical
  task format.
- **Horizontal scaling first:** prefer many small independent contributions over
  assuming a few powerful nodes.
- **Replication scales with supply:** redundancy targets may increase gradually as
  the number and reliability of volunteer nodes grows. Early stages can keep a
  central/hosted fallback while the volunteer layer proves itself.
- **Capability discovery:** future nodes should advertise only coarse, privacy-safe
  capabilities and user-selected limits; the coordinator assigns work within
  those limits.
- **Backpressure and quotas:** when volunteer capacity is scarce, work remains
  queued, reduced, or handled by the fallback service rather than pressuring
  participants to contribute more.
- **Progressive decentralization:** central coordination, verification, and
  persistence can be replaced or complemented in bounded steps after each layer
  has enough participation, observability, and reliability.
- **Reward economics follow proven capacity:** simulated rewards come first;
  Testnet/mainnet or DAO-linked economics must not be required for the initial
  useful product and should only follow measured, abuse-resistant participation.

A practical growth path is therefore:

`small hosted core -> optional volunteer storage -> optional deterministic compute
-> increasing replication/coverage -> community-operated services -> later
decentralized coordination where justified`.

This keeps the first deliverable achievable within a short timeframe while
preserving a path to a substantially larger community-powered Calorie ecosystem.

## Storage stop and data release choices

Stopping storage participation means **no new storage work**. It does not silently
delete already assigned local public/synthetic shards. The participant chooses
what happens next:

- **Keep existing local copies** — stop receiving new work but retain current
  assigned copies locally.
- **Safe handoff, then delete** — request release, verify that enough other copies
  or the hosted fallback exist, then remove the participant's local copies.
- **Delete my local copies now** — the participant may always remove their own
  volunteer-node copies immediately. In the early architecture the hosted core
  absorbs the availability loss when possible; the user is never forced to keep
  data for network availability.

These controls apply only to volunteer-node eligible data. They do not delete
private CalorieApp logs, identity state, Gameverse progress or ordinary product
data. Private/user data remains outside this volunteer storage plane.

## Participation principles for the UI and Gameverse

Participation is never a prerequisite for using CalorieApp or the Gameverse.
A user may use the product with **zero contributed storage and zero contributed
compute** and must not be blocked, degraded, or penalized for that choice.

Storage and compute are independent opt-in choices:

- **Storage contribution** is separately configurable and may be left enabled even
  while compute is paused or stopped. It can also be reduced, paused, stopped, or
  fully opted out at any time, subject to the simulator's safe handling rules.
- **Compute/process contribution** has its own explicit lifecycle: Start, Pause,
  Resume, Stop, and Exit participation. No process starts automatically merely
  because the user opened CalorieApp or entered the Gameverse.
- **Exit participation** means leaving the voluntary node program entirely without
  losing normal access to CalorieApp or the Gameverse.
- Reward opt-in is separate from both storage and compute. A participant can
  contribute without rewards where policy allows, or use the app/game without
  contributing anything.
- Resource limits remain user-controlled and may be changed independently for
  storage and compute.

The UI should present these as optional contribution controls rather than as an
onboarding requirement.

The deterministic **synthetic** public-data compute task is now the second bounded
implementation slice. The next step is a small participation-control UI prototype
for storage, compute, reward opt-in, resource limits and an explicit lifecycle:
**Start** when participation is off, **Pause** while running, **Resume** while paused,
and **Stop** for a full shutdown, using synthetic state only. Real participant onboarding, remote transport,
replica/reconstruction drills and any untrusted-code sandbox remain later work.

Keep PostgreSQL authoritative, personal data protected and provider choice open.
The broader game and its future participation UI should retain the approved
campaign's visual quality. Current approved visual assets must be inspected when
those interfaces are built; this CLI step has no visual styling claim.

CALT remains the only proposed token reward. Supply and issuer choices are still
under discussion in `CALT_TESTNET_SUPPLY_DISCUSSION.md`; simulator accounting does
not mint tokens or choose the eventual airdrop amounts.
