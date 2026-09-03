# Public deployment guidance

Deploy the frontend and backend only after the repository tests and release checks pass. Production environments require HTTPS, explicit origins and redirects, securely managed environment values, protected databases, restricted administrative access, monitoring and a tested rollback process.

Never commit production credentials, database contents, cookies, authorization codes or deployment-specific private configuration. Provider-specific procedures and live endpoints are maintained privately.

Set `CALORIEAPP_BUILD_ID` on the backend and
`NEXT_PUBLIC_CALORIEAPP_BUILD_ID` on the frontend to the same non-secret release
source commit identifier. The backend exposes it through `/health`; the
frontend renders it as `data-calorieapp-build-id` on the HTML root. Verify both
before the integrated manual acceptance round:

```text
python tools/deployment_smoke_test.py --backend-url <BACKEND_HTTPS_ORIGIN> --frontend-url <FRONTEND_HTTPS_ORIGIN> --expected-build-id <id>
```

Build the deterministic Identity Bridge archive first, then create the
non-secret V2 deployment manifest with:

```text
python tools/build_v2_release_manifest.py --source-commit <40-character-commit> --deployed-at-utc <YYYY-MM-DDTHH:MM:SSZ> --plugin-archive <identity-bridge.zip> --output <release-manifest.json>
```

The manifest binds the common build identifier to the backend dependency file,
frontend lockfile, exact WordPress plugin archive and deployment time. It never
contains deployment credentials or private configuration and refuses to
overwrite an existing manifest.
