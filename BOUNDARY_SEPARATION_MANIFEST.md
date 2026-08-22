# CalorieApp Boundary Separation Manifest

Status: Documentation-only preparation for public/private separation.

## Public keep list

The following content is intended to remain in the public-facing repository surface:

- frontend
- backend
- tests
- README.md
- public
- sanitized examples
- LICENSE / SECURITY.md if later added

## Private archive list

The following content should be moved into the private archive and kept out of the public repository surface:

- .github
- project-context
- checkpoints
- evidence
- research
- tickets
- security audits
- staging plans

## Local only / never public

The following content must remain local-only and never be published:

- .env
- .env.local
- *.db
- *.sqlite
- calorieapp.db
- .venv
- node_modules
- .next

## Documentation classification

- Public product documentation: product README, public-facing app docs, sanitized examples, release-facing guidance that does not disclose infrastructure or governance details
- Private operational documentation: internal governance, project-context, checkpoint archives, security reviews, staging plans, evidence, tickets, research, and any deployment or internal operational notes

## Release script review

- release-check.ps1: REVIEW REQUIRED

This script is not a secret file, but it is operational tooling and should be explicitly reviewed before public release or public packaging.

## Archive plan

The repo will be prepared for a future public/private separation by organizing the internal material into an archive such as:

- CalorieApp-Internal-Archive/
  - governance/
  - security/
  - evidence/
  - research/
  - staging/

## Rule

This file is a documentation and planning artifact only. It does not change repository content, delete files, move files, or modify Git history.
