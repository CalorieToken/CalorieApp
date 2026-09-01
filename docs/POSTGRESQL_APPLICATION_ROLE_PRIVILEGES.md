# PostgreSQL application-role privileges

Status: provider-neutral policy and synthetic PostgreSQL proof implemented;
staging and production application remain release-blocking.

## Boundary

CalorieApp uses two database roles with different responsibilities:

- the schema owner/migration role applies an explicitly approved forward
  migration and then applies this privilege policy;
- the runtime application role owns no database or schema object, inherits no
  other role and performs only the required row operations.

The reviewed runtime matrix is fail-closed:

- normal application tables: `SELECT`, `INSERT`, `UPDATE`, `DELETE`;
- the four minimal audit tables: `SELECT`, `INSERT` only;
- `calorie_schema_revision`: `SELECT` only;
- application sequences: `USAGE`, `SELECT`, `UPDATE`;
- database: `CONNECT` only; no `CREATE` or `TEMPORARY`;
- `public` schema: `USAGE` only; no `CREATE`;
- no `TRUNCATE`, `REFERENCES` or `TRIGGER` table privilege.

The policy refuses an unclassified table, a role with powerful attributes or
inherited roles, a role that owns the database or a table, and execution on a
non-PostgreSQL database. PostgreSQL privileges are additive, so the apply step
also removes table, sequence, schema-create and database-create/temporary
privileges inherited through `PUBLIC` before granting the narrow matrix.

## Approved operator commands

Run these only with the separate schema owner/migration credentials, after the
schema is at the exact application head:

```bash
python -m app.postgresql_privilege_cli apply \
  --application-role calorieapp_runtime \
  --approval-reference CHANGE-REFERENCE

python -m app.postgresql_privilege_cli check \
  --application-role calorieapp_runtime
```

`apply` requires an explicit approval reference and performs all grant changes
and verification in one transaction. It must run after every approved schema
migration; a newly added table deliberately causes a failure until its access
class is reviewed in `backend/app/postgresql_privileges.py`.

Never put either database URL, password or provider token in the approval
reference, command output, repository or CI evidence.

## Synthetic proof

The existing loopback-only PostgreSQL 16 integration test creates a temporary
role with no elevated capability, migrates a disposable database, applies the
policy and proves that the role can:

- update an ordinary application row;
- insert a minimal audit receipt;
- insert a sequence-backed food-log row.

It then proves PostgreSQL rejects attempts to update, delete or truncate that
audit receipt, modify migration history, create a persistent table or create a
temporary table. The audit value is read again through the schema owner to
prove it was not changed.

## What remains blocked

This synthetic test does not select a provider and does not configure or inspect
staging or production. Before public onboarding, a human-approved staging run
must create distinct credentials, apply the exact policy, connect the deployed
backend only as the runtime role, repeat the negative mutation/DDL exercise and
record redacted evidence. The same reviewed procedure and a separate approval
are required for production. Real caller authentication and authorization for
the currently internal catalog mutations remain a separate open control.
