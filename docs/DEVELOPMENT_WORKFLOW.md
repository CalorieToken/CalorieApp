# CalorieApp Development Workflow

This workflow keeps the Windows/VS environment, Codex VM, and GitHub aligned
without copying an entire machine or exposing runtime data.

## Simple model

1. **GitHub is the source-code handoff.** Reviewed commits are the durable shared
   history between environments.
2. **Each environment has its own checkout.** Windows/VS and the VM install their
   own dependencies and keep their own local runtime files.
   `.gitattributes` keeps cross-platform line endings consistent.
3. **`AGENTS.md` carries project rules.** AI coding agents should read it before
   changing the repository.
4. **Release scripts carry validation rules.** Windows uses
   `release-check.ps1`; the VM uses `release-check.sh`.
5. **External services are separate.** A Git push must not automatically imply a
   production change. Render auto-deploy remains disabled unless deliberately
   reauthorized.

## Files that may travel through Git

- Application source code
- Automated tests
- Dependency manifests and lockfiles
- Safe `.env.example` templates containing placeholders only
- Public and development documentation
- CI and validation scripts

## Files that must stay local

- `.env`, `.env.local`, and other real environment files
- Bridge secrets, Xaman/XUMM credentials, cookies, login states, and auth codes
- Private keys, seeds, signing material, and wallet credentials
- SQLite databases and other runtime/user data
- `.venv`, `node_modules`, `.next`, caches, logs, and build output
- Machine-specific editor state

The repository `.gitignore`, release scripts, and CI boundary job reinforce these
rules, but they do not replace reviewing changes before a commit.

## Windows and VS workflow

1. Open the existing CalorieApp checkout in VS Code.
   You can run **Terminal -> Run Task -> CalorieApp: Full offline validation** at
   any time; VS Code automatically selects the Windows validation command.
2. Review `git status` before editing so existing work is not overwritten.
3. Keep frontend runtime configuration in `frontend/.env.local` and backend
   runtime configuration outside Git.
4. Make and review a small change.
5. Run:

   ```powershell
   .\release-check.ps1 -SkipHealthCheck
   ```

6. Run the optional health check only when the required local services and
   non-production configuration are ready:

   ```powershell
   .\release-check.ps1
   ```

7. Inspect `git diff`, `git diff --check`, and untracked files before deciding
   whether to authorize a commit or push.

## Codex VM workflow

1. Work in the CalorieApp checkout and read `AGENTS.md`.
2. Preserve existing uncommitted changes and work offline by default.
3. Make a small, test-backed change.
4. Run:

   ```bash
   ./release-check.sh
   ```

   In VS Code on Linux, the shared **CalorieApp: Full offline validation** task
   runs the same command.

5. Report which checks passed and which could not run.
6. Leave changes uncommitted and undeployed unless the user explicitly
   authorizes the exact Git or external-service action.

## Safe handoff sequence

When a checkpoint is eventually approved for Git:

1. Confirm the intended changed files and exclude unrelated work.
2. Run the complete validation gate in the environment holding the changes.
3. Review the diff for secrets, runtime artifacts, scope expansion, and misleading
   public claims.
4. Create a focused commit only after explicit authorization.
5. Push only after explicit authorization and verify the target branch/repository.
6. In the other environment, check for local work before fetching or merging.
7. Rerun that environment's validation gate after the handoff.

## Google Drive and other file storage

Google Drive may be used for presentations, approved documentation exports, and
deliberate backups. It should not be used as a live two-way synchronization layer
for the source tree. Two-way folder synchronization can copy secrets, databases,
dependencies, build output, or conflicting partial edits.

## Production boundary

Repository readiness and production readiness are separate decisions. GitHub,
Render, WordPress, Xaman/XUMM, DNS, and secrets each require their own verified
configuration and authorization. Passing local checks does not authorize an
installation or deployment.
