# Offline Review Summary

Reviewed: 2026-08-23

## Completed

- Extracted only the standalone WordPress plugin from the uploaded archive.
- Excluded the embedded CalorieApp backup, dependencies, build output, caches,
  databases, environment files, and other unrelated content.
- Updated the plugin from 0.1.0 to 0.1.1.
- Aligned outbound state validation with the backend v1 timestamp/nonce/HMAC protocol.
- Stopped transmitting the shared secret during state validation.
- Retained secret-and-client-ID authentication for backend-to-bridge code exchange.
- Corrected allowlisted external callback redirects without weakening exact URL validation.
- Changed release defaults to fail closed until callback and backend URLs are verified.
- Documented the observed `/index.php/wp-json/` WordPress REST root.
- Added repository safety guidance and ignore rules.
- Expanded WordPress tests to verify signed headers and secret non-disclosure.

## Verification results

- CalorieApp backend identity tests: 100 passed.
- Release archive path/content scan: required before handoff and recorded outside this source tree.
- PHP syntax lint: not run because PHP is not installed in the review VM.
- WordPress PHPUnit: not run because no WordPress core test runtime is provisioned.

## Remaining deployment gates

- Run `php -l` over every PHP file in an environment with a supported PHP runtime.
- Run the included WordPress PHPUnit suite.
- Independently verify the production backend origin and callback URL.
- Configure a long random bridge secret only through secure server/admin configuration.
- Perform the first end-to-end flow on isolated staging, including login, callback,
  exchange, session, logout, replay rejection, expiry rejection, and user reuse.
- Production installation, activation, configuration, and deployment remain unperformed.
