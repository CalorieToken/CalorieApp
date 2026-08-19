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

Forbidden in V1:

- Blockchain / XRPL / Xaman
- Wallets or key storage
- Token systems or financial logic
- IPFS or BigchainDB
- Any concept of balances, payments, or value transfer

## ARCHITECTURAL ENFORCEMENT RULES

- Frontend MUST NOT contain business logic beyond UI state
- Backend MUST NOT handle financial or blockchain logic
- No cross-layer mixing of responsibilities
- External APIs limited to Open Food Facts only in V1

## DATA RULES

- Only store food and calorie data
- No user financial data
- No pseudo-wallet structures
- No ledger simulation

## FUTURE SYSTEM DESIGN (DO NOT IMPLEMENT)

Future phases MAY include:

- XRPL integration via Xaman (non-custodial only)
- IPFS for decentralized media storage
- BigchainDB for immutable audit logging

These MUST remain inactive design references only.

## DEVELOPMENT PRINCIPLE

Always prioritize:

1. Minimal working system
2. Clear separation of concerns
3. No premature optimization
4. No Web3 or blockchain expansion in V1
