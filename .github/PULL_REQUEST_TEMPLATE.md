## Summary

<!-- What changed and why, in two or three sentences. -->

## Type of change

<!-- Tick one. The PR title must be a Conventional Commit, e.g. `feat(citizen): add offline report drafts`. -->

- [ ] `feat`: new feature
- [ ] `fix`: bug fix
- [ ] `docs`: documentation only
- [ ] `test`: tests only
- [ ] `refactor` / `perf`: no behaviour change
- [ ] `ci` / `build` / `chore`: tooling, pipelines, dependencies

## Related issue

<!-- Link an issue or sprint task (e.g. S3-02), or write "None". Use closing keywords when appropriate, e.g. Fixes #123. -->

## Changes

<!-- One bullet per meaningful change, grouped by area (backend, frontend, database, ai-workers, docs, CI). -->

- 

## Verification

- [ ] Backend tests / checks: <!-- commands run and results, or why not run -->
- [ ] Frontend tests / checks: <!-- commands run and results, or why not run -->
- [ ] Database migrations / schema changes reviewed, if applicable
- [ ] New behaviour is covered by a test, or the reason it is not is stated here

## Risk and rollback

<!-- Impact on staging/production, config or secret names that must be set (names only), migration order, and how to roll back. Write "Low risk, revert the PR" if that is all. -->

## Screenshots

<!-- Include before/after screenshots for user-facing changes, or write "Not applicable". -->

## Checklist

- [ ] I followed the repository's contribution guidance and used a Conventional Commit title.
- [ ] I updated relevant documentation (`docs/`, `docs/api_contracts.md`, `docs/env-variables.md`).
- [ ] I did not include secrets, credentials, or real personal/emergency-report data.
- [ ] Public responses expose no reporter PII, and public coordinates stay rounded to 4 decimals.
- [ ] AI output stays advisory; verification, dispatch, escalation and closure still need a human dispatcher.
- [ ] State changes write to `audit_logs`; no Supabase Auth or Supabase-specific SQL was added.
