# CALORIEAPP V1 PUBLIC DEPLOYMENT GUIDE

This guide describes public-safe deployment concepts for CalorieApp V1.

Scope boundary:

- Current implemented product: web application for food and nutrition tracking
- Current implemented stack: Next.js frontend, FastAPI backend, SQLite persistence, Open Food Facts integration
- Non-financial and non-custodial V1 boundary remains in effect

This guide intentionally avoids internal staging topology and private operational details.

## 1. Deployment Model Overview

CalorieApp V1 deploys as two web services:

1. Frontend web application service
2. Backend API service

The frontend calls the backend over HTTPS in deployed environments.

## 2. Backend Deployment Requirements

Backend runtime:

- Python 3.11+
- Dependencies from backend/requirements.txt

Backend service requirements:

- Health endpoint available
- CORS configured for authorized frontend origins
- Persistent or managed storage strategy aligned with application needs

## 3. Frontend Deployment Requirements

Frontend runtime:

- Node.js 20+
- Dependencies from frontend/package.json

Frontend service requirements:

- Production build succeeds
- Public backend base URL configured for API calls

## 4. Environment Variable Concepts

Use environment variables for deployment configuration.

Common categories:

- Backend network and origin configuration
- Backend data-store path or connection configuration
- Frontend backend-base-url configuration
- Identity-related server-side configuration where applicable

Public-safety rule:

- Do not store secrets in repository files.
- Keep secret values in deployment platform secret management.

## 5. Build and Run Concepts

Backend deployment concept:

- Install dependencies
- Start FastAPI service with production host/port configuration
- Validate health endpoint

Frontend deployment concept:

- Install dependencies
- Build production artifacts
- Serve built frontend

## 6. Data Persistence Considerations

CalorieApp currently uses SQLite for V1 data persistence.

Deployment considerations:

- Confirm persistence behavior of your hosting platform
- Use persistent storage where required
- Establish backup and restore procedures

## 7. Security and Operational Boundaries

Public deployment guidance includes:

- HTTPS for frontend and backend traffic
- Restrictive CORS origin policy
- Secret management outside source control
- Session and authentication boundary validation

Not included in this public guide:

- Private hostnames
- Internal staging topology
- Operational credentials
- Internal security findings

## 8. Validation Before Release

Minimum public-safe validation expectations:

- Backend tests pass
- Frontend lint passes
- Frontend production build passes
- Health endpoint verification passes

## 9. Out of Scope

This deployment guide does not claim implementation of:

- XRPL financial runtime
- CAL payment or treasury runtime
- Validator or node runtime
- Decentralized storage runtime in V1

Future infrastructure concepts remain PROPOSED/RESEARCH and are documented separately in research materials.