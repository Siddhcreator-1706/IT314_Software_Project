# Contributing to ResQ

Thank you for helping build ResQ, the Gujarat Disaster Response Coordination Hub. This guide covers how to set up, make a change, and get it reviewed and merged.

## Contents

1. [Ground rules](#1-ground-rules)
2. [Set up your copy](#2-set-up-your-copy)
3. [Create a branch](#3-create-a-branch)
4. [Make your change](#4-make-your-change)
5. [Run the checks locally](#5-run-the-checks-locally)
6. [Commit](#6-commit)
7. [Open a pull request](#7-open-a-pull-request)
8. [Review, CI and merge](#8-review-ci-and-merge)
9. [Issues](#9-issues)
10. [Security problems](#10-security-problems)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Ground rules

These rules come from the project's design and are checked in review:

- **Humans decide.** AI output is advisory and stored separately. Code must never verify, prioritise, dispatch, escalate or close an incident automatically.
- **Audit every state change.** Transitions write to the hash-chained `audit_logs` table; never update or delete audit rows.
- **Lock when allocating.** Resource allocation uses `SELECT … FOR UPDATE` (`backend/app/services/resources.py`).
- **Three scenarios only:** `cyclone`, `industrial_fire`, `urban_flooding`.
- **Protect personal data.** Never expose reporter details publicly. Public coordinates are rounded to 4 decimal places. Never commit secrets, real personal data or real emergency reports.
- **Neon PostgreSQL + PostGIS, application-managed auth.** No Supabase Auth or Supabase-specific SQL.
- **Reuse before adding.** Check `backend/app/` and `frontend/src/` for an existing service, component or type first, and keep changes focused on one task.

Background reading: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/api_contracts.md](docs/api_contracts.md) and [docs/env-variables.md](docs/env-variables.md).

---

## 2. Set up your copy

**Team members** with write access clone the main repository directly:

```bash
git clone https://github.com/Siddhcreator-1706/IT314_Software_Project.git
cd IT314_Software_Project
```

**External contributors** fork the repository on GitHub, clone the fork, and add the main repository as `upstream`:

```bash
git clone https://github.com/<your-username>/IT314_Software_Project.git
cd IT314_Software_Project
git remote add upstream https://github.com/Siddhcreator-1706/IT314_Software_Project.git
```

Then follow [Getting started](README.md#getting-started) in the README to configure `.env`, start PostGIS and run the backend and frontend.

---

## 3. Create a branch

Never commit to `main`; it only changes through reviewed pull requests. Start every change from an up-to-date `main`:

```bash
git switch main
git pull                          # forks: git fetch upstream && git merge upstream/main
git switch -c feat/citizen-offline-drafts
```

Name branches `<type>/<short-topic>` (for example `fix/dispatch-timeout`, `docs/api-errors`) or `<your-name>/<short-topic>`. Use one branch per task.

---

## 4. Make your change

- Follow the existing structure and naming, and the FastAPI and Next.js App Router patterns already in the code.
- Update the docs your change affects:
  - an endpoint → `docs/api_contracts.md`;
  - a setting → `docs/env-variables.md` (names only, never values);
  - architecture → `docs/ARCHITECTURE.md`.
- Add or update tests for new behaviour and bug fixes.
- Database changes go in a new numbered file in `backend/db/migrations/`. Never edit a migration that has already been merged.

---

## 5. Run the checks locally

Run the checks for the parts you changed before pushing. CI runs the same ones.

**Backend** (from the repository root, with your virtual environment active):

```bash
pip install -r backend/requirements.txt -r backend/requirements-dev.txt
python -m ruff check backend/
python -m bandit -r backend/app -ll
python -m pytest backend/tests/test_units.py -v
python scripts/check_env_docs.py
```

The full suite needs PostGIS. With `docker compose up -d postgres-postgis` running:

```bash
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/drch_test python -m pytest backend/tests/ -v --tb=short
```

The test database name must end in `_test`; never point tests at a shared or production database.

**AI workers:**

```bash
cd ai-workers
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest tests -q
```

**Frontend:**

```bash
cd frontend
npm ci
npm run lint      # must report 0 errors
npm run build     # type check and production build
```

End-to-end tests (needs the backend and frontend running): `npx playwright install chromium && npx playwright test`.

See [docs/testing.md](docs/testing.md) for fixtures and database guards.

---

## 6. Commit

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
type(scope): imperative summary
```

- **Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `revert`.
- **Scope** is the module, such as `citizen`, `dm`, `field`, `security`, `ai-workers`, `frontend`, `payments`.
- **Subject:** lowercase, imperative ("add", not "added"), no trailing period, and specific. "fix bug", "update files" and "wip" are not accepted.
- **Breaking changes:** mark with `!` after the type or a `BREAKING CHANGE:` footer.
- **Body:** any non-trivial commit has a blank line and then a full description: what changed and why, which areas it affects, how you verified it, and any trade-off or follow-up. Don't hard-wrap the body to a fixed width.
- **Issue references** go in a footer: `Refs #123` or `Fixes #123`.
- **One concern per commit.** Keep unrelated code and documentation changes in separate commits.

Stage only the files that belong to the task; avoid `git add .` so stray or untracked files are not committed:

```bash
git add backend/app/routers/citizen.py backend/tests/test_citizen_incidents.py
git commit
git push -u origin feat/citizen-offline-drafts
```

Commits and pull request descriptions carry no AI co-author or attribution lines. The one exception: commits on an open pull request that apply review feedback or fix bugs found in that pull request (including CI failures) may end with the AI tool's co-author trailer.

---

## 7. Open a pull request

1. Open a pull request against `main`. Forks: base repository `Siddhcreator-1706/IT314_Software_Project`.
2. Give it a Conventional Commit title, for example `feat(citizen): add offline report drafts`.
3. Fill in [the pull request template](.github/PULL_REQUEST_TEMPLATE.md) completely:
   - Keep every section: Summary, Type of change, Related issue, Changes, Verification, Before merge or deploy, Screenshots and Checklist.
   - Write "None" or "Not applicable" rather than deleting a section.
   - Tick only what you actually did.
4. Add screenshots for any user-facing change.
5. Keep the pull request to one task. Mention new environment variables (names only) and any migration under *Before merge or deploy*.

---

## 8. Review, CI and merge

**CI** ([`ci.yml`](.github/workflows/ci.yml)) runs on every pull request. It skips components you did not change.

- **Secrets and dependencies:** a Gitleaks secret scan, `npm audit` and `pip-audit`.
- **Code checks:** ESLint, Ruff and Bandit.
- **Builds and tests:**
  - the frontend production build;
  - migrations and the full backend suite on PostGIS;
  - a smoke test;
  - the AI workers' tests;
  - Playwright end-to-end tests.
- **Containers:** builds and scans the container images with Trivy.

`Pipeline Status / Quality Gate` must pass, and the branch must be up to date with `main`.

**Review:**
- Ask for a review from the project lead or the owner of the module you changed (see [Team](README.md#team)).
- Answer review comments by pushing new commits to the same branch; the pull request and CI update automatically.

**Merge:** a maintainer merges once the pull request is approved and green. Merging to `main` deploys to staging and then production (see [docs/release-runbook.md](docs/release-runbook.md)), so keep `main` releasable.

First-time contributors from a fork need a maintainer to click **Approve and run** before CI starts.

---

## 9. Issues

Blank issues are disabled. Use the forms in [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/):

- **Bug report** (`[Bug]: …`) for defects: steps to reproduce, expected and actual behaviour, environment.
- **Feature request** (`[Feature]: …`) for enhancements.

Fill every required field and keep the title prefix. Don't paste secrets, tokens or real personal data into issues.

---

## 10. Security problems

Do not open a public issue for a vulnerability. Contact the maintainers privately (the project lead, via GitHub) with the details and steps to reproduce, and give them time to fix it before disclosure.

---

## 11. Troubleshooting

**"This branch has conflicts that must be resolved."** Bring your branch up to date with `main`, resolve the conflict markers, then commit and push:

```bash
git fetch origin                  # forks: git fetch upstream
git merge origin/main             # forks: git merge upstream/main
# fix the files with <<<<<<< / ======= / >>>>>>> markers
git add <resolved-files>
git commit
git push
```

**`SSL certificate problem` on Windows** (campus or office proxy):

```powershell
git config --global http.sslBackend schannel
```

**Backend tests are all skipped.** No test database was reachable. Start PostGIS and set `TEST_DATABASE_URL` (see section 5).

**CI did not start on a fork pull request.** A maintainer has to approve the first run. Also check that the pull request targets `main` and has no conflicts.

Questions? Open a discussion in your pull request or ask the maintainers.
