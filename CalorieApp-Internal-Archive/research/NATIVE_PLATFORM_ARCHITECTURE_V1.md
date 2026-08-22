# CALORIEAPP - NATIVE PLATFORM & COMMUNITY NODE ARCHITECTURE RESEARCH v1

Status: Research-only architecture document. No implementation changes.

Scope guard:
- [REPO-EVIDENCE] V1 must remain non-financial and non-custodial with food/nutrition tracking only; blockchain, wallet, token, IPFS, and BigchainDB runtime are forbidden in V1 implementation scope. Sources: .github/copilot-instructions.md, README.md, docs/architecture.md.

Evidence labels used throughout:
- REPO-EVIDENCE: Verified from repository code or docs.
- EXTERNAL-EVIDENCE: Verified from external official docs/pages.
- INFERENCE: Logical conclusion from evidence.
- UNKNOWN - REQUIRES VERIFICATION: Not yet proven with authoritative source or experiment.
- LEGAL QUESTION: Requires jurisdiction-specific legal/compliance interpretation.

---

## 1. Executive Summary

CalorieApp currently operates as a centralized web system with a Next.js frontend, FastAPI backend, SQLite persistence, and cookie-authenticated user flows. Identity is bridged via WordPress + XUMM/Xaman callback exchange. There is no implemented decentralized runtime in the current codebase.

- [REPO-EVIDENCE] Centralized backend endpoints handle identity and food logging in backend/app/main.py.
- [REPO-EVIDENCE] Frontend performs credentialed backend calls from frontend/components/XamanLoginPanel.tsx, frontend/app/auth/callback/page.tsx, and frontend/components/FoodSearchPlaceholder.tsx.
- [REPO-EVIDENCE] V1 constraints explicitly forbid blockchain/wallet/token/financial logic and IPFS/BigchainDB runtime.

Recommended strategic direction (future-phase research, not V1 implementation):
- Use a hybrid architecture:
  - Client-side encryption for nutrition artifacts.
  - Decentralized content storage for encrypted blobs (IPFS/Helia plus pinning).
  - Minimal central metadata/index API for product UX.
  - Optional integrity anchoring to XRPL only for proof/audit use cases.
- Keep consumer app path separate from validator/operator path.

- [INFERENCE] This hybrid path best preserves current UX while reducing central plaintext custody and avoiding immediate infrastructure overreach.

---

## 2. Current State (As-Is)

### 2.1 Product and Scope
- [REPO-EVIDENCE] Product role: non-financial food and nutrition tracker (README.md, .github/copilot-instructions.md).
- [REPO-EVIDENCE] Allowed V1 integration: Open Food Facts only.
- [REPO-EVIDENCE] Forbidden V1 runtime: blockchain/XRPL logic, wallets, token systems, IPFS/BigchainDB.

### 2.2 Backend Reality
- [REPO-EVIDENCE] Identity APIs:
  - POST /api/identity/login/start
  - POST /api/identity/login/state/validate
  - POST /api/identity/callback
  - GET /api/identity/me
  - POST /api/identity/logout
- [REPO-EVIDENCE] Food APIs:
  - GET /search-food
  - POST /log-food
  - GET /logs
  - DELETE /logs/{log_id}
  - DELETE /logs
- [REPO-EVIDENCE] SQLite persistence and SQLModel models are implemented.

### 2.3 Frontend Reality
- [REPO-EVIDENCE] Auth and food requests use credentials include in fetch, meaning backend sessions remain central to current UX.

### 2.4 Implemented vs Planned
- [REPO-EVIDENCE] Implemented: centralized web app with backend authority and local DB.
- [REPO-EVIDENCE] Planned references (non-active): XRPL, IPFS, BigchainDB appear only as future phase references in docs.

---

## 3. Target Problem Statement

How can CalorieApp evolve into a native-capable platform with optional community-operated infrastructure while preserving:
- strict non-financial scope,
- user privacy,
- app store policy compliance,
- practical operability for a small team?

- [INFERENCE] The architecture must split consumer UX from optional node/operator concerns to avoid forcing high-complexity infra on normal users.

---

## 4. Platform Feasibility Research

## 4.1 Android

What external evidence says:
- [EXTERNAL-EVIDENCE] Android imposes substantial background optimization constraints; apps may be restricted from background execution by user/system policy. Source: https://developer.android.com/topic/performance/background-optimization
- [EXTERNAL-EVIDENCE] WorkManager/JobScheduler are recommended for background work rather than unrestricted background services. Same source.
- [EXTERNAL-EVIDENCE] Google Play payments policy requires Play billing for many in-app digital purchases. Source: https://support.google.com/googleplay/android-developer/answer/10281818

Implications:
- [INFERENCE] Always-on mobile node behavior is fragile under battery/power policy and should not be a baseline architecture requirement.
- [INFERENCE] Crypto-like features must be policy-checked even when non-custodial to avoid enforcement risk.

Unknowns:
- [UNKNOWN - REQUIRES VERIFICATION] Current Google Play policy details for crypto exchange/software-wallet classification at submission time.
- [LEGAL QUESTION] Whether any optional integrity-anchor UX triggers jurisdictional financial-services interpretation in specific countries.

## 4.2 iOS

What external evidence says:
- [EXTERNAL-EVIDENCE] App Store guidelines and iOS runtime constraints tightly regulate background behavior and app categories. Source: https://developer.apple.com/app-store/review/guidelines/
- [EXTERNAL-EVIDENCE] iOS secure storage patterns rely on Keychain/Secure Enclave-related primitives. Sources: Apple developer documentation family.

Implications:
- [INFERENCE] iOS is suitable for consumer client UX, but unsuitable as a dependable always-on community node host.
- [INFERENCE] Any key material handling must prioritize OS-native secure storage and explicit user recovery model.

Unknowns:
- [UNKNOWN - REQUIRES VERIFICATION] Specific App Review interpretation for optional decentralized data and integrity-anchor wording in product copy.

## 4.3 Windows

What external evidence says:
- [EXTERNAL-EVIDENCE] Windows service programs can run as background processes with service control manager integration. Source: https://learn.microsoft.com/windows/win32/services/service-programs

Implications:
- [INFERENCE] Windows desktop can host an optional community node role more realistically than mobile.
- [UNKNOWN - REQUIRES VERIFICATION] Exact Windows-native DPAPI guidance page and recommended key hierarchy for this product profile.

## 4.4 macOS

What external evidence says:
- [EXTERNAL-EVIDENCE] Desktop-class process control and local secure storage primitives exist; app distribution/security posture differs from iOS App Store model.

Implications:
- [INFERENCE] macOS is a viable optional operator host for light node responsibilities, with proper packaging and update model.

Unknowns:
- [UNKNOWN - REQUIRES VERIFICATION] Hardened runtime/notarization requirements for selected desktop framework and plugin set.

## 4.5 Linux

What external evidence says:
- [EXTERNAL-EVIDENCE] Linux is standard for infrastructure workloads and aligns with validator/server operations seen in XRPL docs.

Implications:
- [INFERENCE] Linux is the primary target for serious operator/validator workloads, not consumer mobile clients.

---

## 5. Framework and Runtime Tradeoff Research

## 5.1 React Native
- [EXTERNAL-EVIDENCE] React Native is intended for native app development with shared React code and framework options (Expo). Source: https://reactnative.dev/docs/getting-started
- [EXTERNAL-EVIDENCE] Architecture docs indicate evolving internal architecture and renderer/threading model. Source: https://reactnative.dev/architecture/overview
- [INFERENCE] Strong mobile fit; desktop/operator path still requires separate strategy.

## 5.2 Flutter
- [EXTERNAL-EVIDENCE] Flutter positions single codebase delivery across iOS/Android and broader platforms, with native compilation model. Sources: https://flutter.dev/multi-platform/mobile and https://docs.flutter.dev/flutter-for/react-native-devs
- [INFERENCE] High consistency and broad platform ambition, but team skill shift to Dart is a key adoption factor.

## 5.3 Capacitor
- [EXTERNAL-EVIDENCE] Capacitor is a web-first native runtime that keeps web standards close while exposing native plugins. Source: https://capacitorjs.com/docs
- [INFERENCE] Best for accelerating current Next.js/web talent toward mobile shells with selective native bridges.

## 5.4 Electron
- [EXTERNAL-EVIDENCE] Electron uses a main/renderer multi-process model with security boundaries and preload/context isolation patterns. Source: https://www.electronjs.org/docs/latest/tutorial/process-model
- [INFERENCE] Good desktop UX path, larger runtime footprint, mature ecosystem.

## 5.5 Tauri
- [EXTERNAL-EVIDENCE] Tauri emphasizes smaller app size via system webview and Rust-based secure foundation claims. Source: https://v2.tauri.app/start/
- [INFERENCE] Strong candidate for lightweight desktop companion/operator app if Rust capability is acceptable.

---

## 6. Calorie Node Definition (Proposed)

A Calorie Node is not a blockchain validator by default. It is a role-based software profile.

Role tiers:
1. Consumer Node (default app mode)
- Handles local encrypted cache and sync requests.
- No always-on requirement.
- [INFERENCE] Must work under normal mobile/desktop app lifecycle limits.

2. Community Relay Node (optional desktop/server mode)
- Pins encrypted records/CIDs.
- Serves availability and replication functions.
- Requires uptime monitoring, storage policy, abuse controls.

3. Integrity Anchor Operator (optional service mode)
- Publishes periodic proof references (e.g., hash/CID commitments) to selected integrity layer.
- Separate from nutrition app UX path.

4. Validator (separate class, not consumer app)
- Full network validator/operator responsibilities where applicable.
- [INFERENCE] Should be isolated operationally and legally from CalorieApp consumer runtime.

---

## 7. Validator Research (XRPL and Operations)

What external evidence says:
- [EXTERNAL-EVIDENCE] Production-grade XRPL server guidance recommends strong hardware (e.g., 64 GB RAM, high IOPS SSD/NVMe, robust network) and careful capacity planning. Sources:
  - https://xrpl.org/docs/infrastructure/installation/system-requirements
  - https://xrpl.org/docs/infrastructure/installation/capacity-planning
- [EXTERNAL-EVIDENCE] Node sizing and data retention choices materially affect reliability and storage growth.
- [EXTERNAL-EVIDENCE] NuDB is recommended for most modern production scenarios in XRPL docs.

Implications:
- [INFERENCE] Running validator-grade infra is a dedicated ops discipline and should not be bundled into ordinary end-user app expectations.
- [INFERENCE] If CalorieApp ever relies on validator-operated proofs, it should treat that as a separate platform capability with its own SLOs and security controls.

Unknowns:
- [UNKNOWN - REQUIRES VERIFICATION] Exact long-term operating cost model for multi-region validator/relay fleet.
- [LEGAL QUESTION] Whether offering validator-backed integrity services in some jurisdictions changes regulatory posture.

---

## 8. Data and Security Architecture (Future Design)

## 8.1 Proposed Data Partitioning
- Public/minimal metadata index (central API DB): owner pointer, CID/hash, timestamps, schema version.
- Encrypted nutrition payloads in decentralized storage.
- Optional integrity anchor records for tamper evidence.

- [INFERENCE] This minimizes central plaintext custody while preserving search/sync UX.

## 8.2 Persistence Reality
- [EXTERNAL-EVIDENCE] IPFS persistence requires explicit pinning/retention strategy. Source: https://docs.ipfs.tech/concepts/persistence/
- [INFERENCE] Community storage must include reliability contracts, not only protocol assumptions.

## 8.3 Key Management Reality
- [EXTERNAL-EVIDENCE] Web Crypto is low-level and secure-context constrained; misuse risk is real. Sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
  - https://www.w3.org/TR/WebCryptoAPI/
- [INFERENCE] Product success depends on practical key recovery and device migration design, not only cryptographic correctness.

---

## 9. Compliance and Governance Research

## 9.1 GDPR (EU)
- [EXTERNAL-EVIDENCE] GDPR is core EU personal data legal framework, with DPAs/EDPB structure for enforcement and interpretation consistency. Source: https://commission.europa.eu/law/law-topic/data-protection/data-protection-eu_en
- [LEGAL QUESTION] If encrypted user-linked nutrition artifacts are content-addressed and distributed, who is controller/processor per processing purpose in each flow?
- [LEGAL QUESTION] How should right-to-erasure and data minimization be interpreted when immutable addressing and third-party pinning are involved?

## 9.2 MiCA / Crypto-Asset Context (EU)
- [EXTERNAL-EVIDENCE] EU digital finance pages describe MiCA as a framework for crypto-assets and related services. Source: https://finance.ec.europa.eu/digital-finance/crypto-assets_en
- [LEGAL QUESTION] Does optional integrity anchoring (without token issuance/payment functionality) trigger any MiCA-adjacent obligations for this specific product model?

## 9.3 Global Compliance
- [INFERENCE] App store policy, privacy law, and consumer protection obligations will vary by jurisdiction and distribution channel.
- [UNKNOWN - REQUIRES VERIFICATION] Country-by-country obligations for non-financial apps that still expose optional cryptographic integrity proofs.

---

## 10. BigchainDB Position

- [EXTERNAL-EVIDENCE] Public repository/release activity appears relatively old (latest release shown as 2020). Sources:
  - https://github.com/bigchaindb/bigchaindb
  - https://github.com/bigchaindb/bigchaindb/releases
- [INFERENCE] Risk is elevated for adopting as core dependency without renewed maintenance confidence.

Decision:
- Do not select BigchainDB as primary architecture in this phase.

---

## 11. Decision Matrix

Scoring scale: 1 (poor) to 5 (strong). Scores are directional and should be validated by POC.

Criteria:
- Delivery speed from current codebase
- Native capability depth
- Desktop/operator viability
- Security posture potential
- Operational complexity
- Policy/regulatory predictability

Option A: Stay web-only (Next.js + current backend)
- Delivery speed: 5
- Native depth: 1
- Operator viability: 1
- Security posture potential: 3
- Ops complexity: 2
- Policy predictability: 4
- [INFERENCE] Best near-term stability, weakest strategic decentralization path.

Option B: React Native mobile + existing backend
- Delivery speed: 3
- Native depth: 4
- Operator viability: 2
- Security posture potential: 3
- Ops complexity: 3
- Policy predictability: 3
- [INFERENCE] Good mobile path, still requires separate desktop/operator strategy.

Option C: Flutter unified client approach
- Delivery speed: 2
- Native depth: 4
- Operator viability: 3
- Security posture potential: 4
- Ops complexity: 4
- Policy predictability: 3
- [INFERENCE] Strong long-term platform ambition, higher transition cost now.

Option D: Web-first mobile with Capacitor + desktop companion (Tauri/Electron) + optional community services
- Delivery speed: 4
- Native depth: 3
- Operator viability: 4
- Security posture potential: 4
- Ops complexity: 4
- Policy predictability: 3
- [INFERENCE] Best balance with current team and architecture, if scope discipline is maintained.

Preferred: Option D, phased.

---

## 12. Final Architecture Recommendation

Phase-safe recommendation:
1. Keep V1 implementation centralized and compliant with existing constraints.
2. Build a web-first native wrapper path (mobile shell and desktop companion) without introducing forbidden V1 runtime behaviors.
3. Prototype encrypted blob pipeline + CID metadata index in a research environment.
4. Add optional community relay/pinning role for desktop/server operators.
5. Treat validator/integrity-anchor services as separate operational product line, not default app behavior.

Why this is recommended:
- [REPO-EVIDENCE] Aligns with existing code and team stack.
- [EXTERNAL-EVIDENCE] Matches platform policy/runtime realities (mobile background limits, validator hardware burden, decentralized persistence requirements).
- [INFERENCE] Preserves product velocity while reducing architectural lock-in.

---

## 13. Recommended First POC (Research-Only)

POC objective:
- Demonstrate end-to-end encrypted nutrition record flow with decentralized storage reference and central metadata index, while keeping app UX coherent.

POC boundaries:
- No financial features.
- No wallet custody.
- No production validator dependency.

POC success criteria:
- Client encrypts payload, stores by content-addressed reference, and retrieves/decrypts on second device with approved recovery path.
- Metadata index can list user records without exposing plaintext nutrition body.
- Failure modes documented (offline, key loss, pin expiry, partial replication).

- [UNKNOWN - REQUIRES VERIFICATION] Performance envelope on low-end mobile devices and background constraints under realistic usage.

---

## 14. Major Platform Limitations

- [EXTERNAL-EVIDENCE] Mobile OS background restrictions reduce feasibility of always-on node behavior. Source: Android background optimization docs and iOS platform constraints.
- [EXTERNAL-EVIDENCE] Decentralized storage persistence is not automatic; pinning economics and reliability are mandatory design concerns.
- [EXTERNAL-EVIDENCE] Validator-grade infrastructure has meaningful hardware/network/operations burden.
- [INFERENCE] Consumer app, relay operator, and validator roles must remain separate to avoid poor UX and unmanageable complexity.

---

## 15. Open Questions

1. Key custody and recovery model
- [LEGAL QUESTION] Is user-managed recovery only acceptable for target jurisdictions and support obligations?
- [UNKNOWN - REQUIRES VERIFICATION] What recovery UX can non-technical users reliably complete?

2. Data controller/processor boundaries in decentralized flows
- [LEGAL QUESTION] How should controller responsibilities be allocated among app operator, relay operators, and optional anchor operators?

3. Right-to-erasure strategy
- [LEGAL QUESTION] What combination of key revocation, unpinning, and metadata tombstoning satisfies legal expectations per jurisdiction?

4. App store interpretation
- [UNKNOWN - REQUIRES VERIFICATION] How will Apple and Google review teams classify optional integrity-anchor wording and feature toggles at submission time?

5. Operating model for community nodes
- [UNKNOWN - REQUIRES VERIFICATION] What incentives, governance, and abuse controls are needed for sustainable relay participation?

6. Proof anchoring cadence
- [INFERENCE] Periodic batch anchoring may lower costs and policy risk versus per-event anchoring.
- [UNKNOWN - REQUIRES VERIFICATION] What cadence meets audit needs without overloading ops and compliance overhead?

---

## 16. Final Answers To Core Research Questions

Q1: Should CalorieApp force mobile apps to act as always-on nodes?
- Answer: No.
- Basis: [EXTERNAL-EVIDENCE] Mobile background and battery restrictions plus [INFERENCE] poor reliability/UX.

Q2: Should validator responsibilities be mixed into normal user app runtime?
- Answer: No.
- Basis: [EXTERNAL-EVIDENCE] Validator hardware/ops requirements and [INFERENCE] separation-of-concerns necessity.

Q3: Is BigchainDB recommended as primary core?
- Answer: No.
- Basis: [EXTERNAL-EVIDENCE] activity/maintenance signals and [INFERENCE] avoid unnecessary stack risk.

Q4: What architecture is recommended?
- Answer: Hybrid model with encrypted client data, decentralized blob storage with pinning, minimal central metadata index, and optional integrity anchoring as a separate capability.

Q5: What is the first practical step?
- Answer: Controlled POC of encrypted blob + CID metadata + recovery UX validation, without introducing forbidden V1 runtime features.

---

NATIVE PLATFORM ARCHITECTURE RESEARCH COMPLETE
