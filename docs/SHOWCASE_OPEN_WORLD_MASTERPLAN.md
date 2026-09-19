# CalorieToken Showcase Open World — Locked Master Plan

Status: implementation baseline
Branch: `feat/showcase-open-world-masterplan`

## Purpose

Create a highly replayable, modular CalorieToken Showcase open world that combines CalorieApp, the C ecosystem, food and beverage, XRPL/Web3 education, real food, nature, animals, cultures, community, strategy and discovery.

The experience must feel like a real game world rather than a static showcase page, but remain lightweight enough that most movement, scenery, animation and exploration happen client-side. Render/Postgres should primarily handle identity, progress, quests, unlocks, data-backed events and future monetization entitlements.

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
