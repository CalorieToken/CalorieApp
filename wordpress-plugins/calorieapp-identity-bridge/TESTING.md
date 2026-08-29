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
23. known obsolete cached legal footer variants are normalized in rendered HTML
24. the current footer remains unchanged when the filter runs repeatedly
25. unrelated rendered HTML remains unchanged
26. embedded login start rejects a foreign Origin
27. Xaman SignIn payload contains no browser return URL
28. browser response never exposes Xaman credentials
29. unresolved Xaman payload remains pending
30. resolved SignIn authenticates the matching WordPress user
31. wrong flow proof cannot finish sign-in
32. completed WordPress flow issues a CalorieApp authorization code
33. shortcode embeds the app without exposing secrets
34. Xaman custom identifier stays within the 40-character API limit
35. embedded Xaman controls remain hidden until CalorieApp state is ready

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
