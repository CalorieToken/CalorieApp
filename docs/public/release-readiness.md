# Public release readiness

A public CalorieApp release should proceed only when:

- backend tests, frontend lint/build and relevant plugin tests pass;
- the live environment uses durable PostgreSQL rather than SQLite;
- formal migrations, restart/redeploy persistence and owner-isolation checks pass;
- an encrypted backup has passed a documented staging restore exercise;
- authenticated export, deletion and approved retention disclosures are complete;
- secret, personal-data and generated-artifact checks pass;
- public claims match released functionality;
- licences, notices, attribution and asset provenance have been reviewed;
- security, privacy, rollback and operational ownership are confirmed privately.

Passing this checklist does not constitute legal, security or regulatory certification.
