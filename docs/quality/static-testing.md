# Static testing report

Static testing examines the code, configuration and dependencies **without running the application**. It finds
defects that tests miss because no test happens to take that path. This report records the run of
28 November 2026 on `main` at `d1387fd`: the tools used, the results, how each finding was triaged and what changed.

## 1. Method

1. Run the checks that CI already enforces, to confirm a clean baseline.
2. Run stricter analyzers with wider rule sets than CI uses.
3. Review every finding that could be a defect against the source code.
4. For each real defect: write a test that fails, open an issue, fix it, and commit the fix and test together.
5. Enforce the useful new rules in CI so the same class of defect cannot return.

## 2. Tools and results

| Check | Tool | Scope | Result |
|---|---|---|---|
| Lint (CI gate) | Ruff 0.17.1 | `backend/`, `ai-workers/`, `models/` | Passed |
| Lint (deep, 20 rule families) | Ruff | 71 application files in `backend/` and `ai-workers/service/` | 254 findings, mostly style; the correctness and security ones are triaged in section 3 |
| Type check | mypy 1.18.2 | `backend/app`, `main.py` (67 files) | 498 messages, 478 from one typing limitation, 20 reviewed |
| Security analysis (CI gate) | Bandit 1.9.4, medium and above | Python code and `scripts/` | Passed |
| Security analysis (all levels) | Bandit | Application code, 14,478 lines | 9 low, 1 medium, 0 high; all false positives |
| Security patterns | Semgrep (Python, TypeScript, React, OWASP Top 10, Dockerfile, GitHub Actions) | 275 files | 57 findings, all in CI and package configuration |
| Python dependencies | pip-audit 2.10.1 | Backend and AI worker requirements | No known vulnerabilities |
| Model service dependencies | GitHub Dependabot, pip-audit | `models/*/deployment/requirements.txt` | 6 open alerts (4 high, 1 moderate, 1 low), see section 3.3 |
| JavaScript dependencies | `npm audit` | Frontend, including development dependencies | 0 vulnerabilities |
| Vulnerability, misconfiguration and secret scan | Trivy (high and critical) | Backend and AI worker requirements, frontend lockfile, 3 Dockerfiles (`models/` not scanned) | 0 findings |
| Secrets in history | Gitleaks | 493 commits | 1 finding, false positive |
| Dockerfile lint | Hadolint | 3 Dockerfiles | 14 warnings and notes, accepted |
| Frontend lint | ESLint | `frontend/` | Passed |
| Frontend type check | TypeScript 5.9 (`tsc --noEmit`) | Committed frontend code | Passed |
| Complexity | Radon | Backend, 644 functions and classes | Average A (3.95); 9 functions rated D or worse |
| Dead code | Vulture (80% confidence) | Backend | 1 finding, false positive |

## 3. Triage

### 3.1 Defects found and fixed

| Issue | Severity | Found by | Defect | Fix and evidence |
|---|---|---|---|---|
| [#206](https://github.com/Siddhcreator-1706/IT314_Software_Project/issues/206) | Major | Review of broad exception handlers (Ruff `BLE001`) | `_email_copy` and `record_dispatch_progress` swallowed database errors inside the caller's transaction. PostgreSQL then aborts the transaction, and a commit silently becomes a rollback, losing the caller's writes without any error. Latent: it needs a database error to trigger. | Each statement runs in a savepoint. 3 tests in `backend/tests/test_transaction_safety.py` fail before and pass after. |
| [#207](https://github.com/Siddhcreator-1706/IT314_Software_Project/issues/207) | Major | Review of `async` route handlers | Google sign-in and the public payment webhook ran blocking database calls on the event loop, stalling every other request meanwhile. | The calls run in a worker thread. 3 tests in `backend/tests/test_event_loop_blocking.py` fail before and pass after. |
| None (lint) | Minor | Ruff `B904` | The Google token check lost the original network error when raising its API error. | The exception is chained. |

### 3.2 Findings reviewed and not changed

| Finding | Count | Reason |
|---|---|---|
| mypy `call-overload`, `index` and related messages about `tuple` rows | 478 | The connection pool returns dictionary rows, but its declared type is a tuple row. A typing limitation, not a runtime fault. Fixing it means annotating the pool's row type across the data layer. |
| Remaining mypy messages | 20 | Each value is guaranteed by an earlier check mypy cannot follow (for example, latitude and longitude are validated together) or the annotation is narrower than the runtime value. No runtime fault found. |
| Bandit `B105`, `B106` "hardcoded password" | 9 | Names containing "token" or "password" that hold SQL text, token type labels or a user message. No credential. |
| Bandit `B608` and Ruff `S608` SQL construction, `routers/dm/incidents.py` | 1 | Concatenates two constants. User input is passed as query parameters. |
| Ruff `S310` URL open, `ai-workers/service/llm.py` | 2 | The scheme is checked to be HTTP or HTTPS first. |
| Gitleaks `linkedin-client-secret`, commit `9928413` | 1 | A property assignment in old frontend code matched the pattern. Not a secret. |
| Vulture unused `attrs`, `services/ingest/signals.py` | 1 | Required by the `HTMLParser.handle_starttag` signature. |
| Hadolint unpinned system packages (`DL3008`, `DL3013`, `DL3018`) | 8 | Base image packages are left unpinned so rebuilds receive security patches. Backend and AI worker dependencies are pinned. |
| Hadolint `DL3025`, `DL3066` | 6 | The health check needs a shell for `|| exit 1`; the user name resolves inside the image. |
| Ruff style rules (long lines, message style, unused arguments, `print` in command-line tools) | Most of 254 | Style only. Unused arguments are FastAPI dependencies and interface methods. |

### 3.3 Open defect

[#208](https://github.com/Siddhcreator-1706/IT314_Software_Project/issues/208): the model services pin
`transformers==4.57.6` and `torch==2.12.1`, which have 6 open Dependabot alerts. CI's `pip-audit` step does not
cover `models/`. Current exposure is limited: the text service loads only a local tokenizer and runs the model with
ONNX Runtime, and the image service loads a pinned checkpoint revision with `weights_only=True`. The upgrade is not
made here because it crosses a major version and the model outputs have to be checked again with the model weights.

### 3.4 Open recommendations

These are hardening or maintenance work, not defects. They are listed so the team can decide.

1. **Pin GitHub Actions to commit hashes** (56 Semgrep findings in `.github/workflows/`). A moved tag could change what
   the pipeline runs.
2. **Set a minimum release age for npm packages** (1 Semgrep finding in `frontend/.npmrc`).
3. **Split the most complex functions** when next changed: `parse_cap_xml` (complexity 43),
   `recommend_candidate_teams` (35), `invite_user` (32), `decide_team_request` (27), `evaluate_pair` (26),
   `_store_signals` (25), `build_groups` (23), `parse_search_response` (22), `_classify_with_indicbert` (21).
4. **Type the database row factory** so mypy can become a CI gate.

## 4. Gate added to CI

`backend/ruff.toml` now also selects `B` (likely bugs), `ASYNC`, `DTZ` (timezone-naive datetimes) and `PLE`
(pylint errors). The existing CI step `ruff check backend/ ai-workers/ models/` enforces them. These rules do not
detect a blocking database helper called from an `async` function; the tests added for #207 cover the known cases.

## 5. How to repeat

From the repository root, with the backend requirements and `requirements-dev.txt` installed:

```bash
ruff check backend/ ai-workers/ models/ --no-fix
bandit -r backend/ ai-workers/ models/ -ll -ii
pip-audit -r backend/requirements.txt -r ai-workers/requirements.txt
pip install mypy==1.18.2 radon vulture
(cd backend && mypy app main.py --ignore-missing-imports --check-untyped-defs)
(cd backend && radon cc app main.py -s -a -n D)
vulture backend/app backend/main.py --min-confidence 80
(cd frontend && npm ci && npm run lint && npx tsc --noEmit && npm audit)
```

Tools that run as containers (read-only mount of the repository):

```bash
docker run --rm -v "$PWD:/repo:ro" ghcr.io/gitleaks/gitleaks:latest git /repo --config /repo/.gitleaks.toml --redact
docker run --rm -v "$PWD:/src:ro" semgrep/semgrep:latest semgrep scan --metrics=off --config p/python \
  --config p/typescript --config p/react --config p/owasp-top-ten --config p/dockerfile \
  --config p/github-actions --exclude tests --exclude e2e /src
docker run --rm -v "$PWD:/src:ro" aquasec/trivy:latest fs --timeout 15m --scanners vuln,misconfig,secret \
  --severity HIGH,CRITICAL --ignorefile /src/.trivyignore /src
docker run --rm -i hadolint/hadolint:latest < backend/Dockerfile
```
