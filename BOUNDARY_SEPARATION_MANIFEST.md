# CalorieApp Boundary Separation Manifest

Status: Documentation-only preparation for public/private separation. This is a
target classification plan, not a record that the listed moves have happened.

## Public keep list

The following content is intended to remain in the public-facing repository surface:

- frontend
- backend
- tests
- README.md
- docs/public
- sanitized GitHub Actions workflows required for public CI and release checks
- sanitized deployment configuration such as render.yaml
- reviewed release-check scripts and public-safe tooling
- sanitized examples
- repository governance and contribution guidance such as AGENTS.md and CONTRIBUTING.md
- public rights, licensing, security, regulatory, and provenance documents:
  LICENSE, NOTICE, COPYRIGHT.md, TRADEMARKS.md, SECURITY.md, REGULATORY.md,
  DATA_LICENSING.md, THIRD_PARTY_NOTICES.md, ASSET_PROVENANCE.md, and
  IP_CLEARANCE.md
- the sanitized public evidence index in IP_EVIDENCE_REGISTER.md; this index is
  not the private primary evidence itself

## Private archive list

The following content should be moved into the private archive and kept out of the public repository surface:

- private GitHub operational material, if any (excluding sanitized public CI workflows)
- project-context
- checkpoints
- private primary evidence, including agreements, certificates,
  correspondence, sensitive source material, identity records, and unredacted
  evidence packages
- internal research working papers
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

- Public product documentation: product README, public-facing app docs,
  public-safe research summaries, sanitized examples, public legal and policy
  documents, the sanitized evidence index, and release-facing guidance that
  does not disclose secrets or private operational details
- Private operational documentation: internal governance, project-context,
  checkpoint archives, security reviews, staging plans, private primary
  evidence, tickets, research working papers, and private deployment or
  operational notes

## Release script review

- release-check.ps1 and release-check.sh: REVIEW REQUIRED FOR PUBLIC PACKAGING

These scripts are not secret files and are used by the current development
workflow, but they should be explicitly reviewed for secrets and private
operational detail before public release or packaging.

## Archive plan

The repo will be prepared for a future public/private separation by organizing the internal material into an archive such as:

- CalorieApp-Internal-Archive/
  - governance/
  - security/
  - evidence/
  - research/
  - staging/

## Rule

This file is a documentation and planning artifact only. It does not change
repository content, delete files, move files, or modify Git history. In
particular, it does not authorize removing `.github/workflows`, release tooling,
deployment configuration, or any other current file from the public repository.
