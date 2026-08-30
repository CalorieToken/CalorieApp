# Public deployment guidance

Deploy the frontend and backend only after the repository tests and release checks pass. Production environments require HTTPS, explicit origins and redirects, securely managed environment values, protected databases, restricted administrative access, monitoring and a tested rollback process.

Never commit production credentials, database contents, cookies, authorization codes or deployment-specific private configuration. Provider-specific procedures and live endpoints are maintained privately.

Set `CALORIEAPP_BUILD_ID` on the backend and
`NEXT_PUBLIC_CALORIEAPP_BUILD_ID` on the frontend to the same non-secret release
commit or manifest identifier. The backend exposes it through `/health`; the
frontend renders it as `data-calorieapp-build-id` on the HTML root. Verify both
with `tools/deployment_smoke_test.py --expected-build-id <id>` before the
integrated manual acceptance round.
