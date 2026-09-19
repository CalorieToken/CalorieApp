# CalorieToken Showcase Open World — Locked Master Plan

Status: implementation baseline
Branch: `feat/showcase-open-world-masterplan`

## Purpose

Create a highly replayable, modular CalorieToken Showcase open world that combines CalorieApp, the C ecosystem, food and beverage, XRPL/Web3 education, real food, nature, animals, cultures, community, strategy and discovery.

The experience must feel like a real game world rather than a static showcase page, but remain lightweight enough that most movement, scenery, animation and exploration happen client-side. Render/Postgres should primarily handle identity, progress, quests, unlocks, data-backed events and future monetization entitlements.


## Campaign visual continuity

The current approved CalorieToken campaign is the visual reference for the game
and its visible participation interfaces. Preserve its recognizable theme and
production quality as features are added:

- Use the established CalorieToken/CalorieApp logos, colors and typography as a
  coherent visual family, with the historical site identity retained where this
  plan calls for it.
- Carry forward consistent characters, culturally diverse settings, food,
  nature, community and people using CalorieApp on phones.
- For adult-facing scenes, pursue the campaign's realistic visual treatment;
  child and teen treatments adapt to their age rules while remaining recognizable.
- Keep motion smooth and screens sharp and readable; avoid warped phone content,
  blurred/shaking composites and abrupt transitions.
- Use clear narration with complete openings/endings, sensible pacing and subtle
  optional music when audio is present. Avoid unnecessary static text overlays.
- Select approved current assets when implementing a visible scene. Do not treat
  earlier rejected video revisions or obsolete campaign thumbnails as references.
- Reuse suitable approved assets before commissioning more media. Retain source
  and approval/version references with the content pack.

The local participation simulator has no end-user visual interface. Its technical
output does not establish the style of the future game or participation controls.

## Product family and public names

The shared umbrella is the **Calorie Ecosystem**.

- **CalorieApp** is the food/nutrition application running on that ecosystem.
- **CalorieVerse** is the public name of the persistent live metaverse/open world.
- **CalorieStudio** is a creator surface inside CalorieVerse and can also be
  opened directly, but it is not a separate competing ecosystem.

The existing internal terms `Gameverse` and `Creator Gallery`, routes `/gameverse` and legacy `/gallery`, file names and stable IDs may remain
where changing them would add migration risk. The canonical direct creator route
is `/studio`. Public-facing copy should use **CalorieVerse** and
**CalorieStudio**.

This gives one clear hierarchy:

`Calorie Ecosystem -> CalorieApp + CalorieVerse -> CalorieStudio and other ecosystem surfaces`.

## One continuously evolving live Gameverse

The Gameverse is designed as **one persistent live world**, not as a franchise
sequence of replacement titles such as "Gameverse 2" or "Gameverse 3".

The first public world may begin deliberately small, simple and lightweight, but
that same world is expected to keep evolving in place over time. New regions,
systems, quests, social layers, creator tools, visual fidelity, infrastructure
and ecosystem connections are added to the existing live world instead of
replacing it with a separate sequel.

Rules:

- there is one continuity of world identity, player identity and progress;
- the original starting world remains part of the living world as it expands;
- visual quality may become richer, more realistic and more advanced over time
  without erasing the recognizable character of the original experience;
- technical schema, engine, content-pack and protocol versions may change
  internally, but they are migration mechanisms, not new consumer-facing games;
- major upgrades must prefer backward-compatible migration of progress, starter
  character, creator content and world history over resets;
- expansions should feel like the world becoming larger and deeper while people
  are already living in it;
- no planned sequel cadence should be used as an excuse to abandon, freeze or
  replace the current live Gameverse.

The intended arc is therefore:

`small live world -> richer live world -> larger connected ecosystem -> mature metaverse`

while remaining recognizably the **same Gameverse**.

## Freedom-first world design

The Gameverse should feel highly open and self-directed: a world where people
can explore, create, cooperate, trade where permitted, contribute resources, or
simply play without being pushed into a prescribed lifestyle or system.

This is a **player-autonomy design principle**, not a political campaign or party
position. In product terms it means:

- free exploration and multiple valid routes instead of one mandatory questline;
- no required faction, ideology, creator role, node role, wallet, token, market
  activity or social participation to enjoy the core world;
- participation in storage, compute, validation, creator systems, community
  projects and future economies is opt-in and reversible;
- players may change their mind, pause a role, leave a group or return to ordinary
  play without losing core access or unrelated progress;
- broad avatar, creator and self-expression choices are encouraged within clear
  age, safety, rights, moderation and performance boundaries;
- creator ownership, provenance and user control over their own local data and
  permissions are preferred over platform lock-in;
- future trade and marketplace systems must use voluntary exchange, transparent
  terms and no pay-to-win pressure;
- social features should support communities and cooperation without forcing
  public visibility, voice, direct messages or persistent presence;
- the world should tolerate many play styles: explorer, builder, creator, learner,
  farmer, collector, helper, competitive player, observer or participant node;
- restrictions should exist only where needed for safety, minors, abuse
  prevention, legal compliance, technical integrity or the rights of other
  players.

The practical rule is: **maximum meaningful player freedom, minimum necessary
coercion**. Freedom for one participant must not remove the safety, access,
privacy or agency of another.

## Preserve the starting character while the world grows

Scaling and continued development must not make the project feel like a different
product. The first playable world establishes a recognizable **starting
character** for the Gameverse and participation experience: its visual language,
pace, approachable scale, voluntary-participation ethos, CalorieApp connection,
food/nature/community focus and the feeling of the original starting world.

Growth is therefore additive rather than replacement-driven:

- the original starting world and its core route remain playable as later regions,
  systems and community capacity are added;
- later visual upgrades may improve fidelity, animation and performance, but must
  preserve recognizable shapes, palette, atmosphere, navigation logic and brand
  cues instead of restyling the experience into an unrelated game;
- new realms, node features, DAO/community systems and larger infrastructure are
  layered around the original experience rather than forcing a redesign of its
  identity;
- the simple zero-participation path remains a first-class experience even when
  community infrastructure becomes large;
- optional storage, compute, rewards, Web3 and advanced systems remain optional
  at every scale, so the original "just enter and use/play" character survives;
- content/version migrations must preserve earned progress and existing user
  choices wherever technically possible.

For the **player avatar itself**, the initial chosen starter character must also
remain a persistent valid identity as the game evolves. New bodies, outfits,
styles or higher-fidelity models may be offered, but an update must not silently
replace a player's starter choice. Store a stable character identity separately
from render/model versions so old starter characters can be migrated and remain
selectable across future content packs and engine revisions.

A future release should only retire a starter visual asset when there is a real
technical or safety requirement, and then preserve the player's identity and
progress through an explicit compatible migration rather than resetting the
character.

## One-link metaverse entry

There is one primary Gameverse link for everyone. A visitor does not choose a
separate installer or separate product for "player", "node" or "validator" mode.

The link opens the same live Gameverse in ordinary non-participant mode. Inside
that world, an eligible user may voluntarily enable bounded browser participation
and choose storage, compute and/or validator/verification roles. They may also do
nothing and simply continue playing.

No native install, desktop daemon, browser extension or mandatory PWA install is
part of the participation requirement. Persistent storage may be requested from
the browser where supported, and compute/validator preferences may be remembered,
but actual background execution remains subject to normal browser and operating
system limits.

This rule is part of the product identity: **one world, one link, participation
optional**.

## Voluntary participation and reward choice

Ordinary CalorieApp use and core game exploration must remain available without
running a node, providing storage/compute, claiming rewards, owning crypto,
connecting an NFT storage provider or using NFT/crypto functions. Each optional
capability is a separate explicit choice, default off. Refusal, pause or stopping
must not remove ordinary features or earned game progress.

Node controls must offer indefinite pause, a user-selected timed pause, manual
resume and full stop. A full stop revokes storage and compute permissions and
does not automatically restart. Resource budgets are chosen by the participant.
More verified useful work may earn a larger bounded optional reward; declared
hardware power, idle time and unneeded/padded data do not create reward eligibility.

For now **CALT on XRPL Testnet is the only token reward/airdrop asset**. Real CAL
and XRP are not reward currencies. The previously planned optional NFT payment
rails are a separate feature and remain disabled. The local simulator's
`CALT_SIMULATED` unit is an internal test-accounting label, not a second token or
a claim for token redemption. Child/teen non-financial gameplay remains intact.

The latest supply discussion favors starting small and controlled replenishment,
with no blackholing now. Issuer, amounts and any 100-billion ceiling remain
undecided; see `CALT_TESTNET_SUPPLY_DISCUSSION.md`. This is design discussion, not
authorization or implementation of on-chain issuance.

## Open ecosystem with sustainable founder and treasury funding

CalorieVerse and CalorieStudio are intended to remain open to independent
builders and voluntary participants while the official products retain a
sustainable commercial model.

The commercial principle is **free core, optional paid services**:

- entering and exploring CalorieVerse remains free;
- ordinary CalorieStudio browsing and core creator participation stay free;
- optional premium CalorieApp/CalorieStudio tooling may be sold;
- official managed hosting, rendering, API/data and support may be sold;
- cosmetic/world content may be sold only where it does not create pay-to-win;
- marketplace/service fees remain a later separately reviewed capability.

Revenue may first recover documented project investment and pay reasonable
development/operating compensation. As recurring revenue matures, an explicit
ecosystem-treasury allocation should grow. The long-term goal is for ecosystem
infrastructure, security, creator tooling and community development to become a
substantial and potentially primary beneficiary of ecosystem surplus.

No revenue percentage, treasury controller or legal stewardship entity is
hard-coded yet. Those decisions require recorded approval, accounting/tax review
and the future governance/handover process.

The ecosystem's open-building path and the official products' commercial rights
are deliberately separate. Independent builders can create compatible projects
under their own code/branding, while official marks, hosted services and
commercial product presentation remain governed separately.

See `docs/ECOSYSTEM_OPEN_STEWARDSHIP_AND_FUNDING.md` and
`contracts/ecosystem/v2/open-stewardship-and-funding.json`.

## Long-term ecosystem revenue model

The user clarified that the goal is a revenue model that can fund CalEco
development and, eventually, the ecosystem DAO. The working direction is a free
core with optional paid services for organizations and developers. Candidate
revenue comes from managed food-data/API services, verified data/provenance work,
and later managed storage/compute or optional platform marketplace services.
Participant nodes can help provide useful services; CALT test rewards are not
themselves revenue. See `CALECO_REVENUE_MODEL_DISCUSSION.md` for the proposal and
its separation from the existing future-DAO governance boundaries.

## Eleven-language launch requirement

The first playable release must support the same fixed eleven display languages already used by CalorieApp and the WordPress display-language protocol. Do not create a separate game language system.

Launch locales:
- English (`en`)
- Mandarin Chinese, Simplified (`zh-Hans`)
- Hindi (`hi`)
- Spanish (`es`)
- Modern Standard Arabic (`ar`, RTL)
- French (`fr`)
- Bengali (`bn`)
- Portuguese (`pt`)
- Indonesian (`id`)
- Urdu (`ur`, RTL)
- Dutch (`nl`)

Rules:
- Reuse `frontend/config/locales.json` as the canonical locale registry.
- Reuse the existing `DisplayLanguageProvider` / display-language protocol instead of introducing a second selector or preference store.
- When the game is embedded on calorietoken.net, WordPress is the display-language host and the game must follow the same selected language as the site and CalorieApp.
- When the game is opened directly, the existing CalorieApp language picker and preference logic apply.
- A language change must update game UI, quests, Helpbot copy, world labels, onboarding, age-mode copy, F&B role text, navigation and accessibility text without resetting progress or reloading identity state.
- Arabic and Urdu must support RTL layout and bidi-safe rendering of identifiers and brand/source names.
- User-entered text, product names, brands, barcodes, wallet/account identifiers and external source values are not automatically translated.
- Translation state must not alter authentication locale, consent, payment, account identity or stored food-log values.
- Game content packs must require complete eleven-locale copy coverage or explicitly fall back to English with a visible fallback state.
- The WordPress site, CalorieApp and Showcase game should therefore feel like one multilingual ecosystem rather than three separate products.

## Design lessons from established open worlds, RPGs and creator platforms

The Gameverse should learn from successful design patterns without copying any
other game's characters, worlds, art direction, maps, story, interface or
proprietary mechanics. The goal is to use proven **design principles** while
keeping a distinct Calorie identity.

### Exploration and world readability

- Learn from *The Legend of Zelda: Breath of the Wild*: use a small number of
  consistent world systems that interact with each other, rather than scripting
  every encounter as an isolated minigame. Food, water, farms, weather, public
  data, creator objects and route choices should produce understandable effects
  across multiple areas.
- Learn from *Elden Ring*: preserve genuine route freedom while controlling pace
  with strong landmarks, terrain, mystery and optional side paths. The distant
  natural mountains are therefore a long-range attractor before they ever become
  a branded reveal.
- Learn from good open-world level design generally: each destination should
  reveal or suggest another destination. The player should rarely reach a point
  of interest and then have no visual or gameplay reason to continue.

### Player-authored stories and quests

- Learn from *The Elder Scrolls*: handcrafted quests carry the important story,
  while small dynamic activities may adapt to what the player has already seen.
  Do not procedurally assemble major story beats.
- Let systems overlap. A food-data task can affect a farm, a Gallery object can
  appear in the world, a community event can alter a route, and a Helpbot hint
  can react to progress. These intersections create memorable player stories.
- Avoid repetitive fetch-quest design as the dominant loop. Even small quests
  should teach, reveal, transform, connect or let the player make a meaningful
  choice.

### Sandbox and creator expression

- Learn from *Minecraft*: allow multiple valid ways to enjoy the same world.
  Exploration, collecting, creating, learning, food-chain role play and
  community contribution should coexist without one mandatory end-state.
- Gallery creations should increasingly become usable or visible world objects
  rather than staying in a separate catalogue screen.
- The world remains playable for someone who never creates, trades, runs a node,
  connects a wallet or participates in a marketplace.

### Onboarding and live evolution

- Learn from Fortnite/UEFN and Roblox creator guidance: teach only the essentials
  first, get the player into meaningful play quickly, and use contextual
  just-in-time guidance when a player first reaches a new mechanic.
- Prefer environmental cues, short Helpbot prompts and local interaction hints
  over a long front-loaded tutorial.
- Measure onboarding drop-off, route completion and return play when analytics
  are eventually enabled, but do not turn raw screen time or idle time into a
  reward target.
- Expand the Gameverse through additive districts, quests, creator content and
  world events while keeping the original starting world and starter-character
  identity stable.

### Social-metaverse safety

- Learn from VRChat's user-control approach: safe defaults come first and richer
  social visibility is permissioned rather than assumed.
- The first shared-world release keeps social presence lightweight, age-gated
  and controllable. No unrestricted child/adult private channels and no
  unrestricted public voice are introduced merely to make the product look
  "more metaverse".
- Avatar/content complexity must be bounded so one participant cannot degrade
  another player's device or experience.

### Creator economy

- Learn from Roblox and Fortnite creator ecosystems that creators need a clear
  path from making useful content to reaching players, with strong moderation,
  discovery and analytics around that loop.
- Do not copy engagement-payout mechanics directly. Calorie's eventual creator
  model must reward useful, enjoyable ecosystem content without encouraging
  idle-time farming, spam, pay-to-win or financial pressure.
- Marketplace, Mainnet CAL and XRP settlement remain separately gated features.
  The first creator loop is create -> review -> use/display in the world, with
  local/off-chain simulation before any real-value rail.

This benchmark set is a design reference, not a feature checklist. Features are
only adopted when they strengthen the Calorie world's food, nature, community,
creator and ecosystem identity.

## First interconnected world-systems slice

The first live CalorieVerse interactions are deliberately small, handcrafted and
optional. They prove that the world can respond to what a player does without
turning every activity into a mandatory quest.

The initial four-system slice is:

- **Food Data Grove** — inspect a public food-data record and create a world clue;
- **Community Farm** — balance a small water route between crops and nature;
- **CalorieStudio** — curate a local-first creator display that becomes visible
  in the world;
- **Helpbot Garden** — request one contextual hint without switching the world
  into a guided-tour mode.

These interactions do **not** gate the core route, wallet access, participation,
the maze or ordinary exploration. They can be ignored, replayed and completed in
different orders.

World systems may overlap. For example, completing both the food-data and farm
interactions can create a small visual link between farm and market activity,
while Gallery and Helpbot interactions add creator and route-awareness cues.
This is the seed of the larger systemic-world model: future events should reuse
shared food, water, creator, nature, community and data state instead of becoming
isolated minigames.

The first implementation stores this interaction progress locally only. Server
sync or multiplayer world-state adoption requires a later versioned design and
must preserve offline/zero-login play.

## Non-negotiable world structure

1. The player starts in a large open world with many explorable places, moving characters, nature, water, villages, markets, farms, cities, F&B businesses, CalorieApp activity, Helpbot guidance and global cultural variety.
2. The three special mountains are not presented as colored game objects at the start. From the starting world they are natural, distant, misty, partially hidden landscape.
3. A real maze / labyrinth route is part of the journey toward the mountains. It is not a separate unrelated minigame.
4. The route gradually takes the player physically closer to the mountain area through decisions, quests, hidden routes and age-appropriate challenges.
5. The CalorieToken mountain colors remain completely hidden until the player actually reaches the mountain reveal area.
6. At the reveal, the three mountains appear in the same spatial sequence and depth order as the original reference image: green mountain first/left/frontward in sequence, blue-purple mountain next/center/deeper, yellow mountain last/right/deeper.
7. The exact brand colors are the CalorieToken colors already used by the app:
   - green: #008D36
   - blue/purple: #505BA9
   - yellow: #F9B233
8. The mountains remain realistic mountains. Their brand colors should softly blend into natural rock, earth, vegetation, snow, mist, light and shadow rather than look painted or plastic.
9. There must never be words, letters, numbers, labels, names, level indicators, arrows or explanatory text on or immediately beside the colored mountains.
10. The mountain reveal is the reward. Teleportation is also a surprise and must not be announced in advance.
11. After the reveal, an original high-speed energy-blink / warp transition can unlock travel to additional realms. It may feel sudden and exciting, but must not copy any existing franchise character or visual identity.

## Three age experiences

The same underlying world engine serves three age bands, with different tone, content depth, visual treatment and permissions.

### Child
- cheerful, bright, playful, friendly and safe;
- more cartoon-like CalorieToken and CalorieApp identity;
- real food, nature, animals, farms, cooking, movement, cooperation and curiosity;
- no crypto trading, financial calls to action or speculative mechanics;
- rewards are badges, collectibles, avatar items, knowledge, routes and world unlocks;
- cooperation, kindness and caring for animals/nature are central.

### Teen
- more exciting, mysterious and strategic;
- more adventurous movement, hidden routes, puzzles, resource choices and team challenges;
- brand identity moves closer to the real CalorieToken logos;
- XRPL/Web3 may be explained conceptually and technically, without trading pressure;
- missions can involve logistics, sustainability, data quality, resilience, conflict resolution and innovation.

### Adult 18+
- more informative, realistic and ecosystem-focused;
- logos should be as close as possible to the actual official CalorieToken/CalorieApp/OFF/USDA/XRPL assets;
- deeper F&B chain, data, business, XRPL, tokenomics, community and ecosystem information;
- still a game world, not a spreadsheet;
- educational simulations must be clearly distinguished from currently live commercial functionality.

## Real life, food, nature and purpose

The experience must make the player feel that technology is a tool, not the whole point.

The game should repeatedly reconnect digital play to:
- real food and drink;
- cooking, eating together and understanding ingredients;
- farms, soil, water, biodiversity and seasons;
- physical movement, outdoor life and real communities;
- animal welfare and the role of animals in ecosystems;
- reducing unnecessary waste;
- healthy curiosity about where food comes from;
- meaningful human roles even as automation increases.

Automation must not be framed as making people useless. The world should show that people can still contribute through care, craft, judgement, creativity, hospitality, science, food production, repair, logistics, education, stewardship, community work and responsible technology.

## Global cultures and inclusion

The world is global and everyone may participate.

- Include many cultures, regions, cuisines, languages, clothing styles, markets, homes, landscapes and F&B traditions without reducing them to stereotypes.
- Do not portray one culture as the default and others as decoration.
- Cultural content should be respectful and based around food, daily life, craft, community and learning.
- Where cultures, communities or regions are in conflict, the game must not force the player to take a political side.
- Conflict-related scenarios should emphasize human dignity, safety, cooperation, food access, rebuilding, dialogue, logistics, shared resources and protecting civilians, animals and nature.
- Children experience friendship/cooperation missions; teens can get mediation/resource-sharing/resilience challenges; adults can get deeper supply-chain and reconstruction/resilience case studies.
- No real-world group is excluded from participation merely because of nationality, ethnicity, religion or political conflict.

## CalorieApp and C ecosystem

CalorieApp is one of the most important interactive areas, not a side booth.

Possible missions include:
- searching for food;
- scanning a barcode;
- understanding nutrition;
- comparing alternatives;
- learning the difference between data sources;
- using Open Food Facts and USDA-backed information where available;
- understanding a personal food log;
- contributing/reviewing food data in age-appropriate form;
- following provenance from source to product.

The game should use the existing authenticated CalorieApp/Xaman identity where possible. A nickname may follow the user through the world. Do not expose a wallet address publicly by default.

CalorieHelpbot is the persistent in-world guide, not a separate bolt-on. It can give hints, explain systems, react to progress and guide age-appropriate content.

## F&B Chain World

The F&B world is a major role-play system. A player can experience a branch from consumer all the way back to the producer/farmer, or start at another point and move through the chain.

Reusable roles include:
- consumer;
- supermarket / grocery retail;
- restaurant;
- cafe;
- takeaway;
- delivery;
- wholesaler / distributor;
- warehouse / cold chain;
- transport / logistics;
- processor / manufacturer;
- baker / kitchen / production craft;
- farmer / grower / fisher / primary producer;
- food-data contributor / reviewer.

Branches must be modular. Examples: fruit & vegetables, grain/bakery, dairy, drinks, hospitality, retail, delivery and future branches.

Choices in one role may affect downstream roles. Examples:
- harvest quality affects processor and retailer scenarios;
- poor cold-chain decisions increase waste;
- better product data helps the consumer;
- transport choices affect timing, freshness and emissions;
- menu and ingredient choices affect nutrition information and sourcing.

The goal is to make the chain feel connected rather than a collection of unrelated minigames.

## Open-world systems

The world should support:
- avatar customization;
- movement and exploration;
- multiple layers/realms;
- dynamic NPCs;
- Helpbot interactions;
- maze/path challenges;
- quizzes;
- object discovery;
- route choices;
- environmental events;
- food/product interactions;
- mini-games;
- badges and knowledge progress;
- day/week quests;
- temporary events;
- hidden collectibles;
- sequel quests and story arcs;
- unlockable areas;
- surprise transitions;
- maps and navigation so the world remains understandable.

Avatar customization should use user-selected appearance options such as presentation, skin tone, hair, face, clothing, body/character style and accessories. Do not infer sensitive identity attributes from Xaman or a photo.


## Light multiplayer / metaverse start

The first version should already feel shared, but it must stay lightweight, safe and inexpensive.

Start with:
- visible online player avatars in selected shared hubs and public paths;
- nickname-based presence using the existing CalorieApp/Xaman-linked identity, never exposing a wallet address by default;
- lightweight movement/presence updates rather than server-authoritative physics for every object;
- simple age-appropriate emotes, gestures and preset reactions;
- cooperative quests where several players can contribute to a shared objective;
- shared community/nature/F&B events and global progress meters;
- opt-in small-group exploration and maze runs;
- asynchronous collaboration where players can leave useful progress for others without needing everyone online at the same moment;
- culturally mixed public spaces in which players from all supported regions can participate.

Safety rules for the first multiplayer release:
- no unrestricted public voice chat;
- no unrestricted direct messaging;
- no child-to-adult private social channel;
- child, teen and adult social experiences remain separated or strictly permission-gated;
- preset communication should be sufficient for the first release and must exist in all eleven supported display languages;
- blocking/reporting hooks and moderation-ready identifiers must exist before richer social communication is enabled;
- location sharing is game-world location only, never real-world precise location.

Cost architecture:
- keep durable game progress in the existing backend/database layer;
- keep ephemeral presence separate from durable player history;
- do not write every movement frame to PostgreSQL;
- the first presence implementation may use the single backend instance as a lightweight ephemeral presence coordinator because loss of presence on restart is harmless;
- when multiple backend instances or materially higher concurrency become necessary, move ephemeral presence to a shared Key Value/pub-sub layer rather than turning PostgreSQL into a real-time movement bus;
- do not enable costly real-time infrastructure merely to simulate ambient NPCs; NPCs, scenery, animation and most world movement stay client-side.

The multiplayer goal is a shared-world feeling, not a massive MMO on day one. A player should be able to see that other real people are exploring, cooperate on selected tasks, meet others through safe preset interactions and contribute to common world goals while the infrastructure remains comfortably inside the project's cost ceiling.


## Creator economy / NFT Testnet sandbox

The open world should support an extendable creator economy in which eligible players can create, earn, buy, sell, trade or licence Calorie-related digital game assets such as recipes, menu concepts, photos, GIFs, Blender/3D characters, avatar items, food art, F&B objects and digital farm/livestock characters.

The first blockchain-enabled game economy is Testnet-only. Its test currency ticker is **CALT**. Treat CALT as a clearly marked XRPL Testnet currency with no real-world, redeemable or guaranteed future value. Do not use CALT as shorthand for Mainnet CAL and do not imply a conversion rate between them.

A digital asset such as an NFT cow may be transferred between eligible F&B roles (for example farmer to another farmer or an adult processor/butcher simulation), but it is a digital/simulated object by default, not legal ownership of a real animal, meat, revenue or future cashflow.

Age boundary:
- child: game-native non-transferable collectibles/creator items only; no NFT trading or CALT;
- teen: creator tools, galleries and simulated economy concepts; no investment framing;
- adult: optional XRPL Testnet NFT/CALT sandbox behind explicit Testnet flags.

All creator/marketplace functionality must respect cultural and dietary differences. Animal-related branches are optional and non-graphic; plant-based, vegetarian, vegan and other F&B routes receive equally complete gameplay. The system must not infer culture, religion or diet from identity.

Creation must be modular: recipes, menus, photographs, GIFs, 3D/Blender assets, characters, farm objects, restaurant objects, educational media, provenance/story media and future Calorie-related formats all use one versioned asset/marketplace model.

Historical CalorieApp Testnet NFT/token code is reference material only; do not revive the old hardcoded CalorieTest screen. The new game economy should use adapters so CALT Testnet payments/offers, Testnet NFTs and a local/off-chain simulation can be swapped without rewriting game logic.





### User-owned NFT storage and account linking

NFT creators should control where their own media and metadata are stored. CalorieToken should not require every creator to place all NFT files under one CalorieToken-owned storage account.

Principles:
- use a **Bring Your Own Storage** model;
- the creator chooses a supported storage provider/account for each NFT project or sets a personal default;
- the game stores the resulting content identifiers/URIs and verification state, not ownership of the creator's storage account;
- never ask for or store a Google password, GitHub password or provider password;
- when a storage provider exposes standards-based OAuth/account linking, use Authorization Code + PKCE or the provider's supported equivalent;
- if the provider itself offers Google/GitHub/email sign-in, that sign-in remains on the provider's own page; CalorieToken receives only the bounded authorization/connection result needed for storage;
- where OAuth is not available, support a user-owned API token only through a backend secret vault/encrypted credential record; never embed the token in frontend JavaScript, NFT metadata or public ledger data;
- users can disconnect a provider without losing the NFT record; the app retains only public CIDs/URIs and non-secret connection metadata required to display already-minted assets;
- credentials are scoped per user and must never be shared between creators.

Current NFT.Storage reality:
- NFT.Storage Classic no longer accepts new uploads; its legacy login documentation lists email and GitHub, not Google;
- existing Classic content remains retrievable, so users with old NFT.Storage data can still attach/import known CIDs;
- for new creator uploads, use a current hot-IPFS storage provider under the user's own account, then optionally use current NFT.Storage as a long-term preservation layer when its current product/API supports that flow;
- provider adapters must therefore be replaceable: no NFT or game asset ID may depend on one vendor account.

Storage flow:
1. creator makes/selects media in the game;
2. creator chooses **My storage**;
3. creator links or authorizes a supported provider account, or supplies a personal API credential through the secure backend flow;
4. the file is uploaded to that user's storage provider and returns an IPFS CID/URI;
5. metadata is generated, reviewed and stored the same way;
6. before minting, the game verifies that both media and metadata CIDs are retrievable;
7. the XRPL NFToken URI references the immutable IPFS-style metadata/content URI;
8. optional preservation/backup can then be requested through NFT.Storage or another preservation provider;
9. the game stores only the CID, provider reference, public URI, content digest, verification time and a non-secret connection id.

If the creator edits the asset after a CID has been produced, the edit creates a new CID/version. Never silently replace the media behind an already-minted immutable reference.

Storage costs, quota and provider terms belong to the creator's chosen provider/account unless CalorieToken explicitly sponsors a storage action.

### NFT payment choice: CALT, CAL or XRP

Eligible adult NFT listings should be able to offer a **choice of settlement rail**, rather than forcing every creator and buyer into the same currency.

Supported architecture:
- **CALT** — XRPL Testnet sandbox settlement; test-only and non-redeemable.
- **CAL** — optional XRPL Mainnet settlement using the verified Calorie asset identifier; real-value rail, disabled by default until separately approved.
- **XRP** — optional native XRPL Mainnet settlement; real-value rail, disabled by default until separately approved.

Marketplace behaviour:
- the creator/seller chooses which of the available rails a listing accepts;
- the buyer chooses one of the rails offered by that listing;
- CALT, CAL and XRP remain separate assets; never silently convert CALT into CAL or XRP;
- do not auto-route through the DEX in the first implementation;
- every real-value action requires an explicit external-wallet signature and a clear final confirmation containing NFT, network, currency, amount, fees/requirements and destination/offer information;
- CalorieApp/Showcase remains non-custodial and never stores private keys;
- ledger ownership/settlement is accepted only after a validated XRPL result;
- store the chosen settlement asset and validated transaction/offer reference with the marketplace record;
- use the real CAL issuer/currency identity, never a ticker-only match;
- Mainnet CAL/XRP NFT settlement is adult-only and remains behind separate feature, jurisdiction, legal/tax/consumer-protection and security gates;
- children never see real-value NFT purchase/sale flows; teen creator/economy experiences remain non-value/simulated.

XRPL implementation note:
- an XRPL NFToken offer can be denominated in XRP or a fungible issued token, unless the NFT is minted with the only-XRP restriction;
- therefore NFTs intended to support both CAL and XRP must not be minted as XRP-only;
- if an NFT uses an on-ledger transfer fee/royalty and is sold for an issued token such as CAL, the relevant issuer/trust-line requirements must be validated before offering that rail;
- each on-ledger offer has a specific settlement asset. The application may present multiple seller-approved rails, but it must create/verify bounded offers rather than pretending one ledger offer is magically multi-currency.

The first implementation remains CALT/Testnet. CAL and XRP are prepared as **disabled Mainnet adapters** so the marketplace can later turn them on without redesigning the game economy.

### CALT simulated CAL reference peg

For gameplay and marketplace intuition, **1 CALT should have a fictional/reference value equal to the current public market reference for 1 CAL**, while remaining a Testnet-only asset with no redemption or legal/economic claim on real CAL.

Implementation rules:
- source the reference price from the existing WordPress CAL market proxy backed by XPMarket, not from an invented hard-coded price;
- canonical source route: `/wp-json/calorieapp/v1/xpmarket-widget`;
- verify the returned CAL issuer is `rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY`;
- the existing proxy already reduces the upstream payload to public CAL fields and caches it for five minutes;
- treat the peg as **simulated/reference only**: 1 CALT can be displayed as having the same nominal reference price as 1 CAL at that moment, but CALT cannot be redeemed, swapped or converted into CAL by CalorieToken;
- no guaranteed convertibility, no reserve backing, no arbitrage promise and no future-value promise;
- marketplace screens must label the figure as a simulated CAL reference, not as real CAL ownership;
- store or display the source timestamp with valuation snapshots used for game offers so later CAL price moves do not rewrite the historical meaning of an old Testnet trade;
- if the live source is unavailable, use only a bounded last-known snapshot with a visible stale state; after the stale window expires, hide fiat/reference valuation rather than fabricate a price;
- CALT quantities, airdrop entitlement and game rewards remain controlled by the Testnet economy rules; the live CAL price only changes the **display/reference valuation**, not how many CALT a player receives.

This gives the sandbox an intuitive connection to the real CAL ecosystem without turning Testnet CALT into a redeemable or investment asset.

### Global CALT welcome airdrop

The CALT Testnet economy starts with a global **welcome airdrop**, and the newcomer path remains available on a rolling basis after the launch campaign because CALT is Testnet-only.

World presentation:
- the airdrop is a global in-world event, visible across the complete open world rather than one Western/default hub;
- every major scene type may show its own culturally respectful version of the same event: city, village, farm, market, harbour, restaurant/cafe, delivery/logistics area, nature reserve, coastal area, mountain route, CalorieApp City, F&B branches and future worlds;
- no culture, nationality, cuisine, religion or region receives a more valuable allocation merely because of its identity or theme;
- art, celebrations, food, clothing, architecture and local environment can differ by scene, but the underlying eligibility/rules remain the same;
- regions/cultures in conflict remain included without partisan symbols or political preference.

Distribution model:
- CALT remains XRPL Testnet-only and explicitly non-redeemable;
- the public launch can have a defined campaign wave, but every eligible newcomer starts their own bounded onboarding-airdrop window when they first enter the game; therefore a player joining months later can still participate;
- exact amount, cadence, per-newcomer onboarding-window length, Testnet issuer and currency code remain configuration values and must not be guessed in code;
- one game identity must not be able to multiply the welcome allocation through scene changes, language changes or repeated reloads;
- persistent claim/progress state belongs in the backend once the Testnet adapter is enabled;
- blockchain submission always requires the user's explicit Testnet wallet authorization and validated-ledger verification;
- no conversion, exchange rate or future-value promise between CALT and Mainnet CAL.

Age experience:
- child scenes participate in the same global launch story through non-financial welcome collectibles/badges, never CALT;
- teen scenes use a non-value learning/simulation version unless a later reviewed policy explicitly changes that boundary;
- adult 18+ users may opt into the real XRPL Testnet CALT welcome distribution when the feature flag and jurisdiction gate are open.

The airdrop should be discoverable naturally while exploring. It may arrive through different in-world storytelling (market welcome desk, farm co-op crate, harbour terminal, CalorieApp mission, community event, etc.), but all variants resolve to the same canonical entitlement state so moving between cultures/scenes can never create duplicate claims. There is no permanent global expiry for the newcomer Testnet airdrop: a player joining much later can still receive the one-time newcomer experience, while returning users do not reset their newcomer status.

Rolling-newcomer rule:
- there is no permanent global expiry for the existence of the Testnet welcome airdrop;
- each eligible game identity can receive the newcomer experience once, even if that person joins long after the original public launch;
- the personal onboarding window begins from a canonical first-eligible/start event recorded by the backend, not from browser storage alone;
- reinstalling, switching language, changing scene, changing browser, logging out/in or returning after a long absence does not create a second newcomer allocation;
- seasonal relaunches may change presentation but must not silently create duplicate base entitlements;
- because CALT is Testnet currency, supply for this sandbox can be configured for ongoing testing, but distribution still uses per-identity caps and anti-abuse rules so gameplay remains meaningful.



### Focus, discovery and generosity loop

The staged CALT launch should reward **active observation and good play**, not raw screen time.

Core idea:
- during each eligible player's newcomer-airdrop window, CALT opportunities can appear naturally throughout world scenes;
- players who pay attention, explore carefully, notice clues, complete meaningful tasks and make good decisions can discover/catch more eligible CALT opportunities within the configured limits;
- standing idle, endlessly refreshing, keeping the game open for hours or repeating trivial actions must not increase rewards;
- accessibility alternatives must exist so reduced-motion, keyboard-only and other players can earn equivalent opportunities without needing fast reflexes.

Generosity is also part of progression:
- eligible adult Testnet players may voluntarily gift part of their CALT to friends, family or community-support pools;
- sharing should be acknowledged through non-financial reputation, generosity badges, community progress, world improvements, story reactions or access to cooperative quests;
- do not create an infinite reward loop in which sending CALT back and forth produces more CALT;
- repeated transfers between the same linked identities, self-controlled identities or obvious circular patterns must not multiply generosity credit;
- the system must never infer that a real person is poor from wallet data, location, culture, nationality or food choices;
- support for people with fewer resources should use opt-in recipients, community funds/quests or clearly defined in-game need states rather than hidden socioeconomic profiling.

Age treatment:
- children experience the same value through sharing food baskets, help, collectibles and community actions, never CALT;
- teens use simulated/non-value generosity mechanics;
- adults may use the CALT Testnet gifting path when enabled.

This mechanic should make the launch feel like **notice -> earn -> choose -> share -> improve the world**, not like attention harvesting or speculative farming.


### Fair-share CALT catch mechanic

The rolling CALT newcomer airdrop should feel active and playful rather than passive, while preventing hoarding.

Principles:
- every eligible adult Testnet player receives a fair base opportunity during the launch period;
- paying more, camping one scene, reloading, changing language or running repetitive low-skill loops must not create a dominant advantage;
- paying attention, exploring carefully, completing useful challenges and making good choices may earn a **small bounded extra** on top of the fair base;
- the effort bonus must be capped and secondary to the equal base distribution;
- missed drops should not create an unrecoverable permanent disadvantage; later catch-up opportunities can restore most of the base allocation;
- the mechanic must reward focus/participation, not compulsive grinding or all-day screen time;
- scene/culture choice never changes the underlying maximum entitlement.

Sharing/generosity:
- eligible players may voluntarily share Testnet CALT or eligible game assets with friends/family through explicit wallet-authorized transfers;
- generosity toward community causes or players who voluntarily opt into an assistance/community-pool mechanic can be recognized;
- the game must not infer that a real person is poor, vulnerable or in need from location, culture, wallet balance, identity or behaviour;
- appreciation for sharing should mainly use reputation, badges, titles, cosmetics, community progress and story unlocks rather than an unlimited CALT rebate that could be farmed;
- any CALT-based generosity bonus, if later enabled, must be small, capped, non-circular and abuse-resistant;
- gifts never create a claim on the recipient and should not pressure children/teens into token activity.

Anti-hoarding:
- no advantage for simply retaining the largest CALT balance;
- leaderboard design must not rank people by wallet wealth;
- quests should reward useful activity, cooperation, creativity, learning, nature/animal care and F&B contribution rather than accumulation;
- marketplace/game progression must avoid pay-to-win and wealth-gated access to the core world;
- anti-sybil and duplicate-entitlement checks must protect the fair launch distribution without requiring invasive tracking.


## Voluntary decentralized CalorieDB participation

The CalorieApp / metaverse may invite users to voluntarily contribute a small, user-selected amount of storage, bandwidth or deterministic compute to the wider Calorie ecosystem.

Architecture:
- PostgreSQL remains the protected primary store for private identity, sessions, personal food logs, consent and other deletion-sensitive data;
- public/licence-compatible CalorieDB catalog, provenance, NFT/game content and open ecosystem data can gradually become content-addressed, mirrored and verified by participant nodes;
- participant nodes are opt-in, reversible and resource-capped; ordinary app/game use never silently turns a device into a node;
- participant compute receives only bounded non-sensitive task inputs and runs in a restricted sandbox;
- nodes are untrusted by default and results need reproducible/deterministic verification before acceptance;
- adult Testnet participants may later earn capped CALT credits for verified useful storage/compute work; children receive non-financial rewards and teens use simulation/non-value participation;
- no reward for merely leaving a tab open, for storing private data, or for circular/spam work.

The migration from PostgreSQL is gradual:
0. PostgreSQL primary.
1. Public participant replicas.
2. Verified participant compute/storage.
3. Federated public read mirrors.
4. Selected append-only public datasets move to signed-content protocol as source-of-record, with PostgreSQL becoming cache/index.
5. Mature distributed public data/compute if enough independent reliable operators exist.

Phase promotion depends on independent operator diversity, replica coverage, reconstruction drills, verification quality, abuse resistance and cost—not raw signup count. Private mutable account data is never forced into the decentralized public layer.

The official WordPress site remains the CalorieToken product/brand portal, bootstrap/documentation surface and official contract registry. The participation protocol itself must remain independently implementable so third parties can build compatible clients, F&B tools, nodes or games without becoming the official CalorieToken product.

BigchainDB is not selected by this plan. The existing project assessment remains valid; the participation protocol stays provider-neutral so V3 can later reassess underlying decentralized technologies without rewriting the ecosystem contract.

Detailed architecture: `docs/DECENTRALIZED_PARTICIPATION_ARCHITECTURE.md`
Contract: `contracts/participation/v1/network.json`

## Return factor / strategy

The game must remain interesting after the first visit.

Use a loop of:
explore -> learn -> choose -> challenge -> consequence -> unlock -> revisit -> discover change.

Return systems may include:
- rotating daily/weekly quests;
- changing maze routes;
- seasonal/nature events;
- new F&B branches;
- community challenges;
- hidden world changes;
- collection sets;
- avatar cosmetics;
- evolving NPC stories;
- knowledge streaks without punitive addiction mechanics;
- new routes unlocked by earlier choices;
- age-specific strategic layers.

Avoid pure repetitive grinding.

## Monetization readiness and cost discipline

The core world should be enjoyable without a paywall.

Prepare architecture for future:
- feature flags;
- entitlements;
- supporter/premium cosmetics or advanced adult content;
- sponsored F&B educational worlds clearly identified as sponsored;
- B2B food-data/API/analytics products;
- community/supporter contributions;
- future events or partner experiences.

Children must not be monetized through speculative crypto mechanics or manipulative purchase loops.

Target normal infrastructure cost: roughly 20–35 USD/month.
Growth range: 35–60 USD/month.
60–80 USD/month requires review of value/revenue.
80–99 USD/month is peak/emergency room.
99 USD/month is a hard design ceiling unless the owner explicitly decides otherwise.

Most world rendering, movement, scenery and animation should run in the browser. Render/Postgres should store compact durable state rather than simulate every moving object server-side.

## Modular implementation principle

New ideas must be easy to add.

Core engine concepts:
- world modules;
- quest modules;
- interaction modules;
- age rules;
- feature flags;
- content packs;
- events;
- economy/entitlement hooks;
- versioned progress;
- later admin/editor tooling.

The engine should understand generic concepts such as location, trigger, challenge, outcome and unlock. It should not hard-code every future idea.

A new world, quest, F&B branch, NPC, challenge, badge, event or secret route should ideally be introduced as a content/module addition rather than a rewrite of the core.

## Accessibility and safety

- audio is opt-in;
- captions/text equivalents for spoken guidance;
- prefers-reduced-motion support;
- keyboard/touch navigation;
- clear return/map controls;
- no hidden financial pressure;
- age gating enforced by logic, not only by color/style;
- real text in DOM where possible instead of baked into images;
- avoid cultural stereotypes and dehumanizing conflict content;
- protect private food logs and identity data.

## Initial implementation milestones

1. Build a client-side open-world prototype route.
2. Add age mode switching and persistent local prototype progress.
3. Implement the maze-to-mountain path with color reveal only at completion.
4. Add F&B chain role selection and branch framework.
5. Add Helpbot guide hooks and CalorieApp identity nickname display.
6. Add modular config-driven worlds/quests.
7. Add backend game-profile/progress persistence only after the client model is stable.
8. Add WordPress Showcase embedding/navigation after the game route is reviewable.
9. Add official brand assets and age-adjusted logo treatments.
10. Add data-backed CalorieApp/C-database quest events without exposing private food-log details.
