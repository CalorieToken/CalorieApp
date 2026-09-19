# CalorieVerse idea continuity ledger

Status: locked continuity companion to `SHOWCASE_OPEN_WORLD_MASTERPLAN.md`  
Purpose: preserve the many user ideas accumulated from the original Showcase concept through the current CalorieVerse plan.

## Why this exists

CalorieVerse did not start as a blank metaverse design. It grew from the original
CalorieToken Showcase story, then an interactive Showcase page, then a playable
open-world idea, and finally into one continuously evolving metaverse tied to
CalorieApp, CalorieDB, CalorieStudio, XRPL/Testnet experiments and voluntary
ecosystem participation.

This ledger prevents later implementation work from simplifying the project back
down to only the newest feature. New work must remain compatible with the older
ideas unless a later explicit decision supersedes them.

## Origin story that remains visible

The original Showcase narrative remains a useful spine:

**Food -> People -> Data -> Value -> Ecosystem**

- CalorieToken represents the XRPL/value side of the wider ecosystem.
- CalorieApp is the everyday food/nutrition user experience.
- CalorieDB is the food-data, provenance and intelligence layer.
- CalorieVerse turns those relationships into a world people can explore and
  experience rather than only read about.
- CalorieStudio lets people make content that can become part of that same world.

The original Showcase purpose therefore survives inside the game: someone who
enters CalorieVerse should gradually understand the project by doing things, not
by reading a static marketing page.

## Requirements that must survive implementation

The machine-readable companion
`contracts/gameverse/v1/calorieverse-idea-ledger.json` is the full invariant
register. The following groups are intentionally all retained:

### World identity and continuity

One persistent live CalorieVerse, no replacement sequel model; stable starter
character identity; original starting world remains playable; natural misty
mountains and the real maze route; exact mountain reveal order/colors only at
the reveal area; teleport/warp remains a surprise.

### Freedom and different ways to play

Players can explore, learn, build, create, farm, collect, cooperate, role-play,
use CalorieApp, participate in data/community systems or simply wander. Wallet,
node, token, creator role, social participation and marketplace activity are not
requirements for the core world.

### Real food and the complete F&B chain

The game keeps returning to real food, cooking, farms, water, soil, biodiversity,
seasons, animals, waste, logistics, hospitality and meaningful human work. The
F&B role system spans consumer, retail, hospitality, delivery, wholesale,
warehouse/cold-chain, logistics, processing, craft/kitchen, producer/farmer and
food-data roles. Choices should propagate through the chain instead of becoming
isolated minigames.

### Global and culturally broad world

Different cuisines, regions, clothing, architecture, landscapes and daily food
life belong naturally in the world. No culture is the default and no region gets
a more valuable reward. Conflict-context content stays politically neutral and
focuses on human dignity, food access, safety, rebuilding, logistics, shared
resources and care for civilians, animals and nature.

### CalorieApp, CalorieDB and Helpbot

Food search, barcode scanning, nutrition, alternatives, OFF/USDA source
understanding, personal logs, provenance and food-data contribution can become
missions. Helpbot is an in-world guide. Nickname may follow the player; wallet
address is not public by default.

### Child, teen and adult modes

The same world engine supports three distinct experiences. Children receive safe,
playful, non-financial systems; teens receive deeper strategy and simulated
economy/Web3 learning; adults may access separately gated Testnet/economic/data
depth. Age rules are functional permissions, not only different colors.

### CalorieStudio and creator world-building

Recipes, menus, food photography, GIFs, 3D/Blender work, avatars, farm and
restaurant objects, educational/provenance media and community art can become
world content. Creator ownership, BYO storage and immutable content identity are
preserved. Creator items should increasingly become visible/usable in the world,
not remain trapped in a catalogue.

### CALT Testnet economy

CALT remains Testnet-only, non-redeemable and clearly separated from Mainnet
CAL. The rolling newcomer welcome experience is global, duplicate-protected and
fair across cultures/scenes. Attention and useful play may produce only a small
bounded extra over the fair base. Idle time, screen-time farming, reload loops,
wealth hoarding and pay-to-win are not rewarded. Generosity may improve
reputation/community/world state without creating circular token farming.

### Voluntary decentralized participation

Storage, compute and validator participation are independent, explicit and
reversible. The same browser link is used by participants and non-participants;
nothing needs to be installed. Zero volunteer nodes remains a healthy operating
state. Public/licence-compatible data and deterministic tasks may decentralize
gradually while private identity, sessions, consent and personal food logs stay
protected.

### Lightweight social metaverse

The first shared-world layer can show other players, nickname presence, preset
emotes, cooperative goals, group exploration and asynchronous collaboration,
while avoiding unrestricted public voice/DMs and child-adult private channels.
Only game-world location is shared.

### Open ecosystem plus sustainable funding

Independent compatible builders remain welcome under their own namespace and
non-misleading branding. Open protocols do not silently relicense the official
repository or official marks. Premium services may fund operating costs,
documented investment recovery and reasonable development compensation while a
growing long-term ecosystem treasury remains the goal.

### Return factor and modular growth

The intended loop is:

**explore -> learn -> choose -> challenge -> consequence -> unlock -> revisit -> discover change**

Daily/weekly quests, changing mazes, seasons, new F&B branches, community
challenges, hidden changes, collection sets, cosmetics, evolving NPCs and
choice-dependent routes can extend the same world. New content should be added as
modules/content packs rather than requiring a rewrite of the engine.

## Implementation rule

Before starting a large new CalorieVerse subsystem, check it against this ledger.
If a feature conflicts with a locked item, preserve both where possible or record
an explicit superseding decision. Silence or implementation convenience does not
count as a decision to remove an earlier idea.

The ledger is not a promise that every feature launches on day one. It is a
continuity map so the small first world can grow toward the larger vision without
forgetting why each layer exists.
