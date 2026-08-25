# Testing

## Automated Tests Included

The test suite is designed for WordPress core test framework + PHPUnit.

Covered scenarios:

1. unauthenticated authorization request rejected
2. authenticated WordPress user accepted
3. XRPL address retrieved from xrpl-r-address
4. missing XRPL address rejected
5. invalid XRPL address rejected
6. authorization code generated
7. code has high-entropy URL-safe shape
8. code expires
9. expired code rejected
10. used code rejected
11. code cannot be reused
12. wrong state rejected
13. arbitrary redirect rejected
14. allowlisted callback accepted
15. bridge secret never returned to browser
16. exchange requires server-to-server authentication
17. unrelated WordPress user cannot authorize with another user meta
18. code cannot be redeemed twice
19. plaintext code is not stored
20. backend state validation uses timestamp/nonce/HMAC headers
21. backend state validation does not transmit the shared secret
22. canonical WordPress REST root is documented for `/index.php/wp-json/` deployments

## Files

- tests/bootstrap.php
- tests/test-identity-bridge-rest.php
- phpunit.xml.dist

## Run (WordPress Test Environment)

Example (adjust paths):

1. Set WP_TESTS_DIR to WordPress test library location.
2. Ensure plugin directory is available to test bootstrap.
3. Run phpunit from plugin root.

This workspace session did not execute WordPress PHPUnit because a WordPress test runtime was not provisioned here.
