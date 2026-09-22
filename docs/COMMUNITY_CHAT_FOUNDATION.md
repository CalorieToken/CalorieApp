# Community forum/chat foundation

Status: draft architecture checkpoint. No live forum, public write route, automated account
creation, reward programme, CalDB mutation, merge or deployment is enabled by this document.

## Purpose

Provide one low-maintenance community conversation layer that can later be reused by the
CalorieToken website, CalorieApp, CalorieEco and CalorieVerse without turning private app
data or CalDB into a chat database.

The initial WordPress surface should be a simple community/forum page. The underlying
conversation contract is deliberately product-neutral so the same rooms, moderation state
and user controls can later be rendered in other clients.

## Core separation

Three data classes remain separate:

1. **Conversation data** — posts, replies, reactions, room membership and moderation state.
2. **Private application data** — food logs, account/session data, age state and other
   CalorieApp private records. Chat never receives these by default.
3. **CalDB/catalog contributions** — structured, explicitly submitted food/product claims
   that pass the existing provenance, quarantine and human-moderation flow.

A forum message is never automatically a CalDB contribution. If a participant chooses to
turn a message into a structured contribution, the client must show a separate review and
consent step and create a new contribution object with its own provenance.

## Low-maintenance anti-spam model

The service should minimise operator workload without pretending automated moderation is
infallible:

- per-account and per-network rate limits;
- stricter limits for new accounts;
- duplicate/link burst detection;
- configurable blocked-link and obvious-spam rules;
- trust tiers based on age of account and accepted participation history, never on token
  holdings or spending;
- a quarantine queue for suspicious content instead of immediate permanent deletion;
- user report/mute/block controls;
- moderator actions with reason codes and minimal append-only audit metadata;
- temporary auto-hiding only for high-confidence abuse rules, with moderator review;
- no generative bot is allowed to impersonate a human participant or create fake community
  activity.

Automation may classify, throttle and queue content. It must not silently rewrite a
participant's post.

## Identity and wallets

Ordinary reading and posting must not require CAL, XRP, RLUSD, a wallet, storage
contribution or compute participation.

Where sign-in is later shared with CalorieApp, use the existing application identity layer.
A public wallet address may optionally be linked by the user, but private keys, recovery
phrases and wallet credentials are never chat fields.

Pseudonymous display names are supported. The public display name is not a durable identity
key and may change without rewriting historical moderation records.

## Rooms and future clients

Version 1 reserves stable room namespaces rather than hard-coding a WordPress-only model:

- `community:general`
- `community:calorieapp`
- `community:calorieeco`
- `community:caldb`
- `community:calorieverse`
- `community:help`

A client may expose only a subset. CalorieVerse may later render the same room stream
inside the world, but it does not get a separate incompatible chat database.

## CalDB hand-off

Only a separate structured contribution flow may pass information toward CalDB:

`message -> user chooses contribute -> structured form -> provenance/licence checks ->
quarantine -> human moderation -> accepted source assertion`

The original message stays conversation data. Acceptance or rejection of the structured
contribution does not edit the chat post.

## Privacy and retention

Collect the minimum operational metadata needed for abuse prevention, security and
moderation. Do not copy food logs, precise location, age records, private wallet data or
health information into conversation records.

Retention periods must be configurable by data class. Moderator audit records may have a
different retention period from ordinary chat content. Deletion/erasure handling must
preserve only the minimum records that must legally or operationally survive and should
pseudonymise references where possible.

## Safety boundaries for the first release

The first public release should remain intentionally small:

- text posts and replies;
- room selection;
- report, mute and block;
- basic reactions;
- anti-spam/rate limiting;
- moderation queue;
- no direct messages;
- no file uploads;
- no token rewards;
- no trading execution;
- no public CalDB write;
- no autonomous moderation that permanently bans or deletes without a human-reviewed rule.

This keeps the initial surface easy to operate while preserving a path to richer
CalorieVerse social features later.

## WordPress integration

The prepared public copy lives at
`wordpress-plugins/calorietoken-site-style/content/community-chat.html`.

It is content-only in this checkpoint. The existing Site Style migration is not changed to
auto-publish the page yet. Live publication must happen as a separate, recoverable
WordPress step after visual review and connector availability return.

## Machine-readable contract

See `contracts/community/v1/community-chat-policy.json`. Clients and future services
should treat that contract as the minimum compatibility boundary. New fields may be added
without breaking older clients; unknown fields must be ignored rather than destroyed.
