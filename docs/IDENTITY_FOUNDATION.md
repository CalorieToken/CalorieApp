# Identity foundation

CalorieApp uses a server-mediated external sign-in flow. The external provider establishes identity context; CalorieApp creates its own short-lived application session and does not treat browser-supplied identity claims as authoritative.

Production deployments must use HTTPS, explicit origin and redirect allowlists, short-lived single-use codes, replay protection, HttpOnly cookies, no-store responses for private data and fail-closed secret configuration.

Operational endpoints, credentials and deployment-specific configuration are intentionally not published.

The registered-client login-start budget, outstanding unexpired transaction cap,
atomic state/locale/handoff creation and remaining non-claims are documented in
`IDENTITY_START_ADMISSION_CONTROL.md`.
