# CalorieApp Identity Bridge Agent Guide

## Boundary

- This repository is an identity-only WordPress companion plugin.
- Do not add wallet custody, private-key handling, signing, transactions, payments, token operations, or financial features.
- Do not modify or bundle XUMM Login 1.3.0.
- Treat `xrpl-r-address` as an identity attribute obtained from the authenticated WordPress user only.
- Never place bridge secrets, WordPress cookies, authorization codes, login states, databases, or environment files in source control or chat.

## Change safety

- Work and test offline. Do not install, activate, configure, or update production WordPress from this repository.
- Do not deploy, commit, push, create repositories, or change external services without explicit authorization for that exact action.
- Preserve strict callback allowlisting, short code expiry, hashed code storage, atomic single use, backend state validation, and server-only exchange authentication.
- Production URLs and secrets must be independently verified; source defaults intentionally fail closed.

## Verification

- Run `php -l` on every PHP file.
- Run WordPress PHPUnit tests when a WordPress core test runtime is available.
- Check release archives for secrets, databases, caches, dependencies, nested backups, and path traversal before distribution.
