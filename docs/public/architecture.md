# CALORIEAPP V1 PUBLIC ARCHITECTURE

## 1. Architecture Overview

CalorieApp V1 is a web application focused on food and nutrition tracking.

Current architectural model:

- Frontend web client for user interaction
- Backend API service for application behavior and data handling
- SQLite persistence for current application records
- External food data integration through Open Food Facts
- Backend-managed identity/session flow for authenticated user actions

This document describes the current implementation boundary and clearly separates future architecture direction.

## 2. Frontend

Frontend stack:

- Next.js
- TypeScript
- Tailwind CSS

Frontend responsibilities:

- Render user interfaces
- Handle local UI state
- Call backend API endpoints
- Display food search and log experiences

The frontend is not the authority for business data or authentication security decisions.

## 3. Backend

Backend stack:

- FastAPI
- SQLModel

Backend responsibilities:

- Implement API endpoints
- Enforce identity/session boundaries
- Validate and persist food log data
- Broker food search requests to Open Food Facts

The backend is the authority for authenticated application behavior.

## 4. API

Current public-facing functional API categories:

- Health endpoint
- Identity/authentication endpoints
- Food search endpoint
- Authenticated food log endpoints

Current behavior summary:

- Food search is API-mediated and external-data backed.
- Food logging and retrieval are user-scoped through authenticated sessions.
- Log deletion paths are user-scoped and authorization-checked.

## 5. Data Persistence

Current persistence model:

- SQLite database for application state
- Food log records
- Identity/session-related records used by the current authentication flow

Current data reality:

- Persistence is application-database truth for current web behavior.
- Database records are not equivalent to external ledger truth or physical-world truth.

## 6. Food Data Integration

CalorieApp V1 integrates with Open Food Facts for food data retrieval.

Boundary:

- Open Food Facts is an external reference source for food metadata.
- CalorieApp remains responsible for application-layer behavior, validation, and user experience.

## 7. Identity/Authentication

Current authentication model:

- Backend-managed session cookie authentication
- Identity flow that supports authenticated user-specific food logging
- Replay-resistance and state validation controls in current implementation

Boundary:

- Identity/auth is implemented for current web application needs.
- This does not imply deployed wallet infrastructure, token runtime, or validator/node runtime.

## 8. Current Security Boundaries

Current public architecture security posture emphasizes:

- Server-side API boundary enforcement
- Session-based access control for user-scoped operations
- Separation of frontend UI concerns from backend data/security concerns
- Non-public handling for sensitive local runtime artifacts

Security note:

- Operational security details, staging topology, and internal forensic materials are intentionally outside this public architecture document.

## 9. Current Non-Financial Scope

CalorieApp V1 scope is explicitly non-financial and non-custodial.

Not implemented as V1 runtime capabilities:

- Custodial wallet behavior
- Token payments or balances
- Validator operations
- Node operations

V1 remains a food and nutrition tracking application.

## 10. Current Limitations

Current public limitations include:

- Web-first implementation boundary
- Centralized application/data model for current operations
- No implemented decentralized storage runtime
- No implemented XRPL transaction runtime behavior
- No implemented CAL, NFT, treasury, or governance runtime mechanisms
- No native application clients currently implemented in this repository

## 11. Future Architecture Direction (FUTURE / PROPOSED)

Future-direction research (not implemented in V1) explores:

- CalorieDB concepts
- Decentralized storage patterns, including IPFS and Helia
- XRPL transaction-hash correlation and ledger-reference integrity models
- NFT utility and food provenance models
- Production/distribution/wholesale/retail traceability concepts
- Biological and laboratory traceability concepts
- Native client directions across Android, iOS, Windows, macOS, and Linux
- Community infrastructure models including nodes, validators, and governance/incentive research

Critical truth-model distinction for future design:

- Physical-world truth is not automatically proven by an app record.
- Database/application truth is not automatically equivalent to ledger truth.
- Ledger truth is not automatically equivalent to physical-world truth.

Any future implementation of financial, token-related, decentralized-storage, or platform expansion capabilities requires dedicated legal, regulatory, privacy, security, and platform-policy review before deployment.
