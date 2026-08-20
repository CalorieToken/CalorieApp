# CALORIEAPP V1 PUBLIC IDENTITY OVERVIEW

This document describes the high-level identity and authentication model used by CalorieApp V1.

## 1. Purpose

CalorieApp uses identity and session controls to protect user-scoped application behavior such as food logging and retrieval.

## 2. Current Identity Model

Current implemented model:

- Backend-managed identity/session flow
- Session cookie used for authenticated requests
- User-scoped authorization boundaries on protected endpoints

The backend remains the authority for authentication and authorization checks.

## 3. High-Level Flow

At a high level, the V1 flow includes:

1. Login flow initiation
2. Callback handling and state validation
3. Backend identity resolution or creation
4. Session issuance for authenticated API access

## 4. Security Concepts (High-Level)

Current implementation uses security concepts such as:

- Request/state validation in authentication flow
- Replay-resistance patterns
- Session-bound authenticated access to protected operations
- Frontend/backend separation of responsibilities

## 5. Authorization Boundary

CalorieApp V1 enforces user-level boundaries for protected data operations.

Examples:

- Authenticated access is required for user food-log actions.
- User-scoped operations are constrained by backend authorization checks.

## 6. Scope Boundary

This identity architecture is part of the current V1 web application.

It does not imply:

- custodial wallet behavior
- token/payment runtime behavior
- validator or node runtime behavior

## 7. Public vs Internal Documentation Boundary

This public overview intentionally excludes internal operational details such as:

- private hostnames
- operational credentials and secrets
- staging topology
- internal deployment/security procedures

An internal identity reference is maintained separately for operational and implementation detail.

## 8. Future Direction Boundary

Future ecosystem identity evolution may be explored as PROPOSED/RESEARCH work, but this document reflects the current implemented V1 identity scope only.