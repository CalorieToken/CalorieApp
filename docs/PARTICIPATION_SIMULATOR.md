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

The deterministic **synthetic** public-data compute task is now the second bounded
implementation slice. The next step is a small participation-control UI prototype
for storage, compute, reward opt-in, resource limits, pause/resume and full stop,
using synthetic state only. Real participant onboarding, remote transport,
replica/reconstruction drills and any untrusted-code sandbox remain later work.

Keep PostgreSQL authoritative, personal data protected and provider choice open.
The broader game and its future participation UI should retain the approved
campaign's visual quality. Current approved visual assets must be inspected when
those interfaces are built; this CLI step has no visual styling claim.

CALT remains the only proposed token reward. Supply and issuer choices are still
under discussion in `CALT_TESTNET_SUPPLY_DISCUSSION.md`; simulator accounting does
not mint tokens or choose the eventual airdrop amounts.
