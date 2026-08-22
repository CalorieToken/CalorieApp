# CalorieApp Copilot System Constraints

## SYSTEM ROLE

CalorieApp is a non-financial, non-custodial food and nutrition tracking system.

## PHASE LOCK (CRITICAL)

### V1 ONLY SCOPE:

Allowed:

- Next.js frontend (UI only)
- FastAPI backend (data only)
- Open Food Facts API integration
- Food search and nutrition display
- Food logging system (non-financial)
- External Xaman/XUMM identity authentication
- External WordPress identity bridge
- Server-side identity verification
- Opaque CalorieApp sessions
- XRPL address retention as external identity metadata only

Forbidden in V1:

- Private keys, seed phrases, or signing credentials
- Wallet custody or key storage
- XRPL transaction signing or transaction submission by CalorieApp
- Token systems or financial logic
- Balances, payments, transfers, exchange/trading, token administration, or financial-account functionality
- Rewards, value-transfer functionality, or any other financial functionality
- IPFS or BigchainDB

## ARCHITECTURAL ENFORCEMENT RULES

- Frontend MUST NOT contain business logic beyond UI state
- Backend MUST NOT handle financial or blockchain logic
- No cross-layer mixing of responsibilities
- Open Food Facts is the only V1 food-data API. The approved WordPress/Xaman identity boundary is the only V1 external identity exception.
- The Xaman/WordPress exception is for identity only; it is not permission for generalized Web3, wallet, token, or financial integration.

## DATA RULES

- Only store food and calorie data
- No user financial data
- No pseudo-wallet structures
- No ledger simulation
- An XRPL address may be retained only as external identity metadata; it must not be used for custody, balances, transactions, or value transfer.

## FUTURE SYSTEM DESIGN (DO NOT IMPLEMENT)

Future phases MAY include:

- Financial, wallet, token, transaction, custody, payment, transfer, or value-transfer capabilities only after a separate architecture decision and dedicated legal/compliance, privacy, security, threat-model, and operational review
- IPFS for decentralized media storage
- BigchainDB for immutable audit logging

These MUST remain inactive design references only.

## DEVELOPMENT PRINCIPLE

Always prioritize:

1. Minimal working system
2. Clear separation of concerns
3. No premature optimization
4. No Web3 or blockchain expansion in V1
