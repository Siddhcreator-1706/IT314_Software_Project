# ResQ: Contribution Document

Group 30. **Group leader: Siddh.**

This document records what each member delivered. Every item is taken from the member's own commits in the GitHub repository (`git log --all --no-merges --author=<identity>` on `origin`, read on 24 Nov 2026), grouped by area, together with the sprint tasks the member owned in the [sprint plan](../project/sprints/Sprint-Member-Wise.pdf). Work that exists only on a branch not merged into `main` is marked as such. Commit subjects and dates are in the repository history and can be shown in the viva.

## 1. Team

| # | Member | Git identities | Role |
|---|---|---|---|
| 1 | Siddh *(leader)* | Siddhcreator-1706, Siddh Shah | Tech lead, integration and release owner, CI/CD |
| 2 | Zalak | Zalak | Authentication, citizen backend, administration console |
| 3 | Nisarg | Nisarg Vekariya | Field-team backend, dispatch state machine, recommendations, geo |
| 4 | Shlok | Shlok Gohel | Disaster Management module, payments and donations |
| 5 | Janvi | JanviVPatel | Citizen and field frontend, accessibility, shared navigation |
| 6 | Tanishq | Tanishq7361, Tanishq Shah | Database schema, public site, dispatcher UI, security fixes |
| 7 | Dhruv | D202401433, Dhruvmistri2007 | QA and test lead |
| 8 | Rudra | RudraBhat, Rudra Bhatt | Alert and signal ingestion, English text analysis |
| 9 | Neeti | neeti-gunsai | AI lead, session security, documentation |
| 10 | Dhruvil | Dhruvil Kansagra, Dhruvil-14 | Image and multilingual text classifiers |

## 2. Contribution of each member

### 2.1 Siddh (leader)

**Sprint tasks owned:** S1-01, S1-02, S1-18, S1-19, S2-15, S2-16, S3-02, S3-12, S3-15, S3-18.

- **Project set-up and delivery pipeline (Sep–Nov):**
  - Repository, Docker and compose.
  - CI quality gate: lint, PostGIS tests, gitleaks, Bandit, pip-audit, Trivy, CodeQL, Playwright e2e, Dependabot.
  - CD: images to GHCR, deploy to staging, smoke test, then production; deploy hooks for Render and Vercel.
  - Cancelling superseded runs, and failing the run when an expected deploy is skipped.
  - Hardening `docker-compose.prod.yml`.
- **Integration and review:**
  - Merged and integrated the team's pull requests: shared dispatch transitions, live health check reporting the deployed commit, the ingestion cron (#56).
  - The AI development orchestration pipeline (#60).
  - The Sprint 3 deployment, security and documentation release (#160).
- **Features:**
  - Gujarat geofence.
  - SACHET CAP adapter with ingest-run lifecycle and fallback alerts; Google News and Bluesky adapters.
  - DM signals page, team-recommendation panel and team-request decisions.
  - Field responder UI with TOTP.
  - Donations flow, Razorpay Checkout and citizen notifications.
  - Owner-only evidence upload with metadata stripping.
  - Searchable language selector.
  - Rebuilt live map, shared navigation and light theme across roles.
  - Agency types and assignment dialog.
  - Connecting live signals and the hosted IndicBERT model to `/triage`.
- **Security and data:**
  - Trusted proxy IPs; scans set to block the pipeline; S3-02 security regression tests.
  - Removal of unused schema (migration 19).
- **Documentation:**
  - Migration and release runbooks, contribution guide, API contract updates.
  - README and CONTRIBUTING rewrites, SECURITY policy and code of conduct.
  - Agent rules; regenerating the ER diagram.
- **Bug fixes** across citizen, frontend, CI/CD, ingestion, dispatch and auth throughout Sprints 1–3.

### 2.2 Zalak

**Sprint tasks owned:** S1-03, S1-04, S2-08, S2-13, S3-06, S3-16.

- **Authentication (Oct–Nov):**
  - First role-based login and sign-up.
  - Staff MFA, staff management and DM workspace session routing.
  - Google OAuth sign-in.
  - Forgot and reset password; secure email invitations and the set-up page; citizen registration validation.
- **Citizen backend and screens:**
  - Information response with readable timeline labels and abuse limits.
  - Photo attachments.
  - Profile, password change and notifications.
  - Withdrawal requests, account deletion and email copies.
  - Account page; corrected-location reply.
  - Requiring the `Idempotency-Key` on reports.
- **Public information:**
  - Published safety guidance and public updates.
  - Public map centred on Gujarat with district zoom.
- **AI and dispatch:**
  - Optional LLM adapter (second opinion, summaries) in `/triage`.
  - Wording-similarity scoring of duplicate candidates.
  - Internal incident notes; CSV exports of the incident and dispatch queues.
  - Reopen rules for resolved and rejected incidents.
  - Agency management for supervisors.
  - Shelters for citizens and dispatchers.
- **Administration console:**
  - Staff account directory.
  - Disable, enable and bulk actions.
  - Edit permissions and details; reset sign-in; sign out of every device.
  - Session counts, per-account audit history, CSV export.
  - System status page; `create-admin` CLI.
- **Tests and docs:**
  - OpenAPI contract and role-leak tests.
  - Citizen, public and incident-stage tests.
  - API documentation for each feature; ER diagram generator; final report assembly.

### 2.3 Nisarg

**Sprint tasks owned:** S1-07, S1-11, S2-01, S2-02, S3-13, S3-14.

- **Early backend and security (Oct):**
  - GIS map rendering and JWT integration.
  - High-entropy `JWT_SECRET` enforcement.
  - Removal of plaintext passwords; CI gate fixes.
- **Field-team backend (S2-01), delivered in five phases on 31 Oct:**
  - Field schemas, auth dependency and CLI provisioning.
  - Unified dispatch state machine with row locking and audit.
  - Field responder REST API with team isolation.
  - Spatial team-ranking engine and backup-decision workflow.
  - Dedicated test suites.
- **Geo and recommendations:**
  - Geospatial utilities, public routers, recommendation engine and Gujarat seed data.
  - PostGIS boundary RAM cache.
  - Sprint 3 recommendation tuning, EXPLAIN checks and scenario steps.
- **Docs and tests:**
  - API contracts for field operations and team recommendations.
  - SACHET ingestion unit tests.
  - Final-report section on dispatch, field and the public map; the sprint plan PDF.

### 2.4 Shlok

**Sprint tasks owned:** S1-16, S2-10, S2-12, S3-11.

- **Disaster Management module (15 Oct):** backend API, staff login with MFA, DM workspace and live map layer.
- **Payments:**
  - `PaymentGateway` interface with MockGateway and Razorpay adapter.
  - Campaigns and donation-order API with conflict-safe idempotency.
  - Gateway settings and secrets handling.
- **Payment hardening (S3-11):**
  - Server-side endings for unpaid donations (cancel, expiry).
  - Failure-reason breakdown in DM oversight; sandbox notice.
  - Citizen donation-receipts view.
- **Operations:**
  - Guarded database backup and restore script.
  - Load-test script and the recorded public map p95.
  - About 20 demo incidents across Gujarat districts.
- **Tests and docs:** DB-backed payment tests, e2e test for receipts, gateway test-account findings, payments guide.

### 2.5 Janvi

**Sprint tasks owned:** S1-05, S1-06, S2-04, S2-11, S3-03.

- **Citizen screens:**
  - First citizen dashboard (October).
  - Citizen auth proxy, report form and My reports timeline (S1-05, S1-06).
  - Navigation links; information-reply status fixes; "Server unreachable" state.
- **Field and public:** field live polling, public alerts layer and citizen information reply (S2-04, S2-11, S2-13).
- **Accessibility and payments UI:** mobile responsiveness, keyboard focus and contrast (S3-03); UI states for declined, abandoned and timed-out payments.
- **Shared navigation:** `UnifiedSiteHeader` with persistent navigation and mobile drawer, standardised across every screen.
- **Quality:**
  - Keyboard-only e2e tests; navigation-consistency e2e suite.
  - Dependency-audit fixes; ruff fixes.
  - Citizen and field operations guide.

### 2.6 Tanishq

**Sprint tasks owned:** S1-08, S1-09, S2-03, S3-04.

- **Database design (29 Sep):**
  - BCNF-normalised schema and versioned migrations with a runner.
  - FR coverage checks; schema reduced to 20 core tables.
  - CI schema validation and audit-chain test.
- **UI foundation:** shared API and session utilities, whitish theme, unified navigation, simplified map controls.
- **Public site:**
  - Gujarat-locked public map with district filter and legend; mobile overlap fixes.
  - About and How-to pages.
  - Safety guidance with NDMA and GSDMA sources; removal of earthquake reports.
- **Dispatcher UI:**
  - Team-requests queue.
  - AI suggestions labelled "not verified".
  - Resolution prompt after field completion.
  - Duplicate score and explanation.
  - Secondary capability matches.
  - AI-versus-human analytics chart (S3-06); advisory photo-analysis control (S3-08).
- **Auth UX:** sign-in and sign-up redesign for stressed and mobile users; trilingual language switcher; removal of localStorage tokens.
- **Security:** fixed all three open CodeQL alerts (XSS, clear-text logging, ReDoS).
- **Docs:** dispatcher and public site guide.

### 2.7 Dhruv

**Sprint tasks owned:** S1-17, S2-14, S3-01, S3-17.

- **Test harness (Oct):**
  - Core-loop smoke test.
  - Seed reset with a safety guard; Makefile targets.
  - Auto-tagged DB fixtures and the CI ran-and-skipped guard.
- **Sprint 2 test hardening:**
  - DB-backed tests for the field router, signals and promotion, donations and payment webhook.
  - AI triage gate tests.
  - Smoke test extended to the field and donation flows.
  - Staging smoke and webhook report; Sprint 2 gate report.
- **Sprint 3:**
  - Automated cyclone scenario runner.
  - Fix for the backend suite hanging without a test database (D-14).
  - Defect list and refreshed demo script.
- **Docs:**
  - Testing guide, Day-3 demo checklist, staging verification report.
  - Architecture class and sequence diagrams (`docs/architecture/class-diagram.md`, `sequence-diagram.md`), merged with PR #196 on 21 Nov.
- **Not merged into `main`:** admin account and security management (`dhruv/feature/admin-account-security`).

### 2.8 Rudra

**Sprint tasks owned:** S1-13, S1-15, S2-09, S3-09, S3-10.

- **Ingestion:**
  - Hazard ingestion and dispatch monitoring.
  - CAP handling of multiple information areas.
  - Reuse of pre-labels for unchanged signals.
  - Live social-signal pipeline; connection of live signals to the disaster classifier.
- **AI:** English crisis text analysis v1 (`/analyze-text`), with a Bandit-clean implementation.
- **Tests:** CAP regression fixtures.

### 2.9 Neeti

**Sprint tasks owned:** S1-10, S1-12, S2-05, S2-06, S3-05, S3-07.

- **AI:**
  - Text dataset and baseline evaluation tools (S1-10, S1-12).
  - Trained scenario model support in `/triage` when one is configured (S2-06).
  - Class-balanced weights and aggregate multilabel metrics for the English model.
  - Triage rules, model card and evaluation report.
- **Signals:** dispatcher related-signal matching; ingestion geometry fix and staging evidence.
- **Security and sessions:**
  - Rotating refresh tokens with idle, absolute and session-count limits.
  - Hardened staff Google sign-in and authenticator QR codes.
  - Shared staff workspace with wrong-role redirects and fewer database round trips per request.
  - Fix for a CodeQL DOM-XSS alert.
- **Documentation:**
  - Reorganised `docs/` into purpose folders and moved the AI docs.
  - Moved the English text model into `models/text_model`.
  - **The final submission documentation set** (`docs/submission`: SRS v2 parts A and B, use cases, backlog v6, sprint details, system and object design, UML 2.5.1 diagrams, planning report v2).
  - The reformatted sprint plan PDF.
  - The documentation review and formatting pass.

### 2.10 Dhruvil

**Sprint tasks owned:** S1-14, S2-07, S3-08.

- **Image classifier:** ConvNeXt-Tiny training, evaluation notebook and FastAPI service (Oct), with the API server test.
- **Multilingual text classifier:**
  - IndicBERT training and ONNX INT8 export.
  - MuRIL comparison, with its Bandit and ruff fixes.
  - Hosted services and model documentation (`models.md`).
  - Merged into `main` with PR #186 on 20 Nov.

## 3. Signatures

| Member | Signature | Date |
|---|---|---|
| Siddh (leader) | | |
| Zalak | | |
| Nisarg | | |
| Shlok | | |
| Janvi | | |
| Tanishq | | |
| Dhruv | | |
| Rudra | | |
| Neeti | | |
| Dhruvil | | |
