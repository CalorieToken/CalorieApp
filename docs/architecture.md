# CalorieApp Architecture (V1)

## Layer Responsibilities

- frontend: UI rendering and local UI state only
- backend: API endpoints and food-log data handling
- docs: scope, roadmap, and architecture contracts
- .github: code-generation and governance constraints

## V1 Boundaries

- Allowed domain: food search, nutrition display, food log data
- Forbidden domain: blockchain, wallets, tokens, payments, balances
- Allowed external API: Open Food Facts only

## Future Extensibility (Design Only)

- Phase 2: optional Xaman/XRPL user-signed flows
- Phase 3: optional IPFS media storage
- Phase 4: optional BigchainDB immutable event logging

These future phases are non-active references and must not be implemented in V1.
