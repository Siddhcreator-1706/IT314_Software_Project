<div align="center">

<img src="frontend/public/logo.svg" alt="ResQ" width="220" />

# ResQ — Gujarat Disaster Response Coordination Hub

**One platform for citizens, dispatchers and field teams to report, verify and respond to disasters in Gujarat.**

[![CI](https://github.com/Siddhcreator-1706/IT314_Software_Project/actions/workflows/ci.yml/badge.svg)](https://github.com/Siddhcreator-1706/IT314_Software_Project/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Siddhcreator-1706/IT314_Software_Project/actions/workflows/codeql.yml/badge.svg)](https://github.com/Siddhcreator-1706/IT314_Software_Project/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Next.js 16 · FastAPI · PostgreSQL 16 + PostGIS · Python AI workers

*Course project for IT314 Software Engineering, DA-IICT.*

</div>

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [What is real and what is simulated](#what-is-real-and-what-is-simulated)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Testing and quality checks](#testing-and-quality-checks)
- [CI/CD and deployment](#cicd-and-deployment)
- [Security and privacy](#security-and-privacy)
- [Documentation](#documentation)
- [Team](#team)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Overview

During a disaster, reports arrive from many people at once, often incomplete, duplicated or outside the area a control room covers. ResQ gives Gujarat's disaster response a single workflow from the first report to the closed incident:

1. **Citizens** report an emergency with its location, details and photos, then follow its status.
2. **Disaster management staff** verify reports, ask for missing information, check advisory AI suggestions and dispatch teams and equipment.
3. **Field teams** receive assignments, acknowledge them and report progress from the scene.
4. **Administrators** manage staff accounts, invitations and permissions.

The platform supports exactly three scenarios: **cyclone**, **industrial fire** and **urban flooding**. Every operational decision (verification, priority, dispatch, escalation and closure) is made by a person; AI output is advisory only.

---

## Features

### Citizens
- Report an incident with a map pin or device location, checked against the Gujarat boundary, plus urgency, people affected, needs and up to five photos.
- Duplicate hints that show nearby reports of the same kind before submitting.
- *My Reports*: a timeline for each report, replies to dispatcher information requests (text or a corrected location) and withdrawal requests.
- Account settings: profile, language (English, Hindi, Gujarati), email alerts, password change and account deletion.
- Sign in with email and password or with Google.
- Donations to relief campaigns with official receipts; see [Payments](docs/payments.md).

### Disaster management staff
- A verification queue with a strict incident state machine: `SUBMITTED → NEEDS_INFORMATION / VERIFIED / REJECTED → DISPATCHED → RESOLVED → CLOSED`.
- Advisory AI triage, team recommendations ranked by PostGIS distance, capability and workload, and dispatch with row-locked resource allocation.
- A live operations map, ingested signal clusters (official alerts and social signals), photo moderation, published safety content and analytics.
- Permissions per staff member: `DISPATCH`, `CLOSURE`, `MODERATOR`, `PUBLISHER`, `SUPERVISOR`.

### Field teams
- An assignment inbox: acknowledge or reject a dispatch, move it through `DISPATCHED` to `COMPLETED` (or `FAILED`), and post situation updates. A dispatch nobody acknowledges is escalated after a timeout.

### Public
- A live map of verified incidents (coordinates rounded to 4 decimal places), official alerts, safety guidance and emergency helplines. No sign-in is needed.

---

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        C[Citizen portal]
        D[DM workspace]
        F[Field view]
        A[Admin]
    end
    subgraph Vercel["Next.js 16 (Vercel)"]
        BFF["BFF route handlers<br/>httpOnly session cookies,<br/>token refresh"]
    end
    subgraph Render
        API["FastAPI backend<br/>auth · incidents · dispatch ·<br/>ingestion · payments"]
        AI["AI triage service<br/>rules baseline, optional model"]
    end
    DB[("Neon PostgreSQL 16<br/>+ PostGIS")]
    Feeds["SACHET CAP alerts ·<br/>social signals"]

    C & D & F & A --> BFF --> API
    API --> DB
    API -- advisory only --> AI
    Feeds --> API
```

- The browser never holds an access token. Next.js route handlers (`/api/citizen`, `/api/dm`, `/api/field`) attach it from an httpOnly cookie and refresh it with a rotating refresh token.
- The backend owns authentication, the incident and dispatch state machines and the hash-chained audit log. The AI service is a separate process and can be switched off.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · ER diagram: [docs/er-diagram.md](docs/er-diagram.md) · API: [docs/api_contracts.md](docs/api_contracts.md)

---

## Technology stack

| Layer | Technologies |
| :--- | :--- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Leaflet with OpenStreetMap |
| Backend | Python 3.12, FastAPI, psycopg 3 with a connection pool, Argon2id, TOTP (RFC 6238), JWT |
| Database | PostgreSQL 16 with PostGIS 3.4 (Neon in staging and production) |
| AI workers | FastAPI triage service with a rules baseline; scikit-learn text classifier; optional PyTorch image and transformer experiments |
| Payments | Sandbox gateway by default; Razorpay Checkout (test or live keys) |
| Testing | pytest, Playwright, Ruff, Bandit, ESLint |
| Delivery | Docker, GitHub Actions, GHCR, Render (API and AI service), Vercel (frontend) |

---

## What is real and what is simulated

| Capability | Status |
| :--- | :--- |
| Staff sign-in with password and TOTP, lockout and token revocation | Implemented |
| Rotating refresh tokens with idle, absolute and session-count limits | Implemented |
| Incident verification workflow and status history | Implemented |
| Dispatch with `SELECT … FOR UPDATE` resource locking | Implemented |
| Append-only, SHA-256 hash-chained audit log | Implemented; checked with `python -m app.cli verify-audit` |
| Gujarat boundary checks (PostGIS) with geocoding fallback | Implemented |
| Citizen photo upload and moderation (stored in PostgreSQL) | Implemented |
| Official alert ingestion (SACHET CAP) | Implemented; runs on a schedule |
| Social signals (Bluesky, Google News) | Implemented, off by default (`BLUESKY_SEARCH_ENABLED`, `NEWS_RSS_ENABLED`) |
| AI triage | Rules baseline in production; a trained model plugs in through `TRIAGE_MODEL_DIR` |
| Image classifier | Prototype, not deployed (photo analysis answers `503`) |
| Payments | Sandbox gateway by default; Razorpay in test mode unless live keys are set |
| Demo incidents, teams and campaigns | Simulated; seeded only when `APP_ENV=development` and flagged `is_simulated` |
| Fallback alerts and social replay data | Simulated; always labelled in the UI |

---

## Repository structure

```text
.
├── backend/            FastAPI application
│   ├── app/            routers (auth, citizen, dm, field, public, internal), services, payments, CLI
│   ├── db/             SQL migrations (01–15) and seeds (reference, demo)
│   └── tests/          pytest suite (unit and PostGIS-backed)
├── frontend/           Next.js application
│   ├── src/app/        pages and BFF route handlers
│   ├── src/components/ shared UI, maps, role views
│   └── e2e/            Playwright tests
├── ai-workers/         triage service, text model, image model, evaluation
├── scripts/            smoke test, seed reset, boundary sync, load test, tooling
├── docs/               architecture, API contracts, runbooks, reports
├── docker-compose.yml  local stack (PostGIS, backend, frontend, AI workers)
└── render.yaml         Render service definitions
```

---

## Getting started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the local PostGIS database)
- [Node.js 22](https://nodejs.org/) and npm
- [Python 3.12](https://www.python.org/)
- Git

### 1. Clone and configure

```bash
git clone https://github.com/Siddhcreator-1706/IT314_Software_Project.git
cd IT314_Software_Project
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

Set a random `JWT_SECRET` of at least 32 characters in `.env`. Every variable is described in [docs/env-variables.md](docs/env-variables.md). Never point a local `.env` at the production database.

### 2. Start the database

```bash
docker compose up -d postgres-postgis
```

This starts PostgreSQL 16 with PostGIS on `localhost:5432`, matching the `DATABASE_URL` in `.env.example`.

### 3. Run the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
python -m app.migrate            # applies migrations, reference seeds and (in development) demo seeds
uvicorn main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs> · Health: <http://localhost:8000/api/v1/health>

### 4. Run the frontend

```bash
cd frontend
npm ci
npm run dev
```

Open <http://localhost:3000>.

### 5. (Optional) Run the AI triage service

```bash
cd ai-workers
pip install -r requirements.txt
uvicorn triage_service:app --port 8001
```

Then set `AI_TRIAGE_URL=http://localhost:8001/triage` in `.env`. Without it, AI triage reports `UNAVAILABLE` and staff triage manually.

### 6. Create accounts

Citizens sign up in the app. Staff, administrator and field accounts are created with the CLI from `backend/`. Each command prints a TOTP secret and QR code for an authenticator app.

```bash
python -m app.cli create-staff --email dispatcher@example.org --name "Asha Rao" --permissions DISPATCH,CLOSURE,MODERATOR
python -m app.cli create-admin --email admin@example.org --name "Platform Admin"
python -m app.cli create-field --email responder@example.org --name "Ravi Patel" --team "<team name or id>"
```

### Run everything with Docker

```bash
docker compose up --build
```

This builds and starts the database, backend (`:8000`), frontend (`:3000`) and AI workers (`:8001`).

---

## Testing and quality checks

| Check | Command |
| :--- | :--- |
| Backend lint | `python -m ruff check backend/` |
| Backend security scan | `python -m bandit -r backend/app -ll` |
| Backend unit tests | `python -m pytest backend/tests/test_units.py -v` |
| Full backend suite (needs PostGIS) | `TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/drch_test python -m pytest backend/tests/ -v --tb=short` |
| AI workers | `cd ai-workers && python -m pytest tests -q` |
| Frontend lint and build | `cd frontend && npm run lint && npm run build` |
| End-to-end (app running) | `cd frontend && npx playwright install chromium && npx playwright test` |
| Core-loop smoke test | `python scripts/smoke.py --base-url http://localhost:8000` (needs `SMOKE_STAFF_*`) |
| Audit hash chain | `cd backend && python -m app.cli verify-audit` |
| Environment docs | `python scripts/check_env_docs.py` |

The test database name must end in `_test`; the suite refuses any other. See [docs/testing.md](docs/testing.md) for fixtures and database guards.

---

## CI/CD and deployment

**Continuous integration** ([`ci.yml`](.github/workflows/ci.yml)) runs on every pull request to `main`, skipping components that did not change:
- **Secrets and dependencies:** Gitleaks secret scan; `npm audit` and `pip-audit`.
- **Code checks:** ESLint, Ruff and Bandit.
- **Backend:** migrations and the full pytest suite on PostGIS, then a strict smoke test.
- **AI workers:** their own pytest suite.
- **End to end:** Playwright tests against a real backend.
- **Containers:** images built and scanned with Trivy.

`Pipeline Status / Quality Gate` is the required check. CodeQL runs separately.

**Continuous deployment** ([`cd.yml`](.github/workflows/cd.yml)) runs on every merge to `main` and on release tags:
1. Publishes the images to GHCR.
2. Deploys the backend to Render **staging** and smoke-tests it there.
3. Promotes the backend to **production** once the staging smoke test passes.
4. Deploys the frontend and the AI triage service through their own deploy hooks.

A scheduled workflow ([`ingest-cron.yml`](.github/workflows/ingest-cron.yml)) wakes the backend and runs ingestion.

| Component | Hosting |
| :--- | :--- |
| Frontend and BFF | Vercel |
| Backend API (staging and production) | Render, from GHCR images |
| AI triage service | Render |
| Database | Neon PostgreSQL 16 + PostGIS |

Render's free tier sleeps when idle, so the first request after a pause can take up to about 90 seconds. Release steps, rollback and secrets: [docs/release-runbook.md](docs/release-runbook.md).

---

## Security and privacy

- **Human in the loop.** AI suggestions are stored separately from the incident and never verify, prioritise or dispatch anything.
- **Strong staff authentication.** Staff use Argon2id passwords and mandatory TOTP. Accounts lock after repeated failures, and sessions can be revoked.
- **Tamper-evident audit.** Every state change is written to `audit_logs`. The log is hash-chained and protected by triggers that block updates and deletes.
- **Least exposure of personal data.**
  - Public feeds never include reporter details and round coordinates to 4 decimal places.
  - Text is scrubbed of personal details before it reaches the AI service.
  - Photos are visible only to their owner and to moderators, and every moderator view is audited.
- **Safe payments.** Only a verified gateway signature confirms a donation, and sandbox payments are always labelled.

Security review and threat notes: [docs/security-review.md](docs/security-review.md). Please report vulnerabilities privately to the maintainers rather than in a public issue.

---

## Documentation

| Topic | Document |
| :--- | :--- |
| Architecture and module map | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| REST API contracts and error format | [docs/api_contracts.md](docs/api_contracts.md) |
| Environment variables | [docs/env-variables.md](docs/env-variables.md) |
| Database ER diagram | [docs/er-diagram.md](docs/er-diagram.md) |
| Testing guide | [docs/testing.md](docs/testing.md) |
| Release and migration runbooks | [docs/release-runbook.md](docs/release-runbook.md), [docs/runbook-migration.md](docs/runbook-migration.md) |
| Ingestion sources | [docs/ingestion-sources.md](docs/ingestion-sources.md) |
| Payments and donations | [docs/payments.md](docs/payments.md) |
| AI model card and evaluation | [docs/ai/model-card.md](docs/ai/model-card.md), [docs/ai/evaluation-report.md](docs/ai/evaluation-report.md) |
| User guides | [Citizen and field](docs/frontend-citizen-field-guide.md), [Dispatcher and public](docs/frontend-dispatcher-public-guide.md) |
| Demo script and defect list | [docs/demo-script.md](docs/demo-script.md), [docs/defect-list.md](docs/defect-list.md) |
| AI-assisted development workflow | [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) |

---

## Team

| Member | Role | Main areas |
| :--- | :--- | :--- |
| **Siddh** (lead) | Tech lead and integration | CI/CD, database migrations, security, releases, code review |
| **Zalak** | Citizen and public backend | Citizen accounts and reporting, timelines, LLM adapter, AI-versus-human analytics |
| **Nisarg** | Dispatch and field backend | Field assignments, Gujarat geofencing, team recommendations |
| **Shlok** | Payments and dispatch | Payment gateways, donations and receipts, signal promotion |
| **Rudra** | Ingestion | Official alert adapters (SACHET CAP), ingestion scheduler |
| **Neeti** | AI lead | Datasets, text classification, evaluation, triage guardrails |
| **Dhruvil** | Computer vision | Image classification, duplicate-text similarity |
| **Janvi** | Frontend (citizen and field) | Report forms, My Reports, field dashboards, alerts layer |
| **Tanishq** | Frontend (public and dispatch) | Public map, dispatcher workspace, recommendations UI |
| **Dhruv** | QA and testing | Test fixtures, smoke and scenario tests, defect tracking |

The work was delivered in three sprints: the core reporting and dispatch loop, then response and AI, then hardening and release. Per-member sprint tasks are in [docs/sprints/](docs/sprints/).

---

## Contributing

Contributions follow a branch → pull request → review workflow with Conventional Commits and a required CI quality gate. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and use the [issue forms](.github/ISSUE_TEMPLATE/) for bugs and feature requests.

---

## License

Released under the [MIT License](LICENSE).

---

## Acknowledgements

- Map data and geocoding: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (tiles and Nominatim).
- Official alerts: NDMA [SACHET](https://sachet.ndma.gov.in/) Common Alerting Protocol feeds.
- Text model training data: R. Munro, *Disaster Response Messages* (CC BY 4.0) and Sinha, Nath and Swain, *Hierarchical Disaster Tweet Classification Corpus* (CC BY 4.0). See [ai-workers/text_model/README.md](ai-workers/text_model/README.md) for full attribution and terms.
