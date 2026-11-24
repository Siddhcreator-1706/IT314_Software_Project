# ResQ: Requirements Not Completed or Not Implemented

Group 30, as of 23 Nov 2026 (v1.0 release candidate). This document lists every requirement from [01-requirements-srs-v2.md](01-requirements-srs-v2.md) and every story from [03-user-stories-backlog.md](03-user-stories-backlog.md) that is **not built** (Backlog) or **only partly built** (Partial). For each one it gives the reason and what is left. Of 66 functional requirements, 46 are done, 14 partial and 6 not built. Of 138 stories, 97 are done, 30 partial and 11 not built.

## 1. Not implemented (Backlog)

| Requirement | Stories | What is missing | Reason |
|---|---|---|---|
| NU-FR-10 Physical aid contribution by citizens | US-N14, US-N15 | A citizen form and API to register goods (type, quantity, condition, location, contact) and track each stage. The DM side (needs, verification, allocation, delivery events) exists, so this is mostly a citizen screen plus one endpoint. | Lower priority than the incident and dispatch loop; dropped in Sprint 2 planning |
| NU-FR-15 (Opt) Flag published content | US-N21 | Report button on public content; moderation queue entry | Optional; no public user-generated content is shown |
| NU-FR-13 (Opt) Browser draft | US-N18, US-N35 | Save an unsent report in the browser with a clear "Not yet sent" state | Optional. The legacy localStorage prototype was removed on purpose, and safe retry is covered by the idempotency key |
| AM-FR-09 Notification channel configuration | US-A11 | Admin screen for channels, templates, routing and retry; SMS and push channels | In-app plus an email copy was enough for the demo; SMS needs a paid provider |
| AM-FR-12 Moderation policy configuration | US-A14 | Admin-editable allowed types, size limits, auto-quarantine rules, backlog threshold | Rules are fixed in code (images only, 5 × 5 MB) |
| AM-FR-13 (Opt) Data-request oversight | US-A15 | Admin queue for export and deletion requests | Optional; deletion is self-service |
| AM-FR-14 (Opt) Second-admin approval | US-A16 | Four-eyes approval for critical configuration and role changes | Optional |
| AM-NFR-03 Alerting telemetry | US-A19 | Alerts from service health or error rates to an operator | No monitoring service on the free tier |
| AM-NFR-16 (Opt) Retention schedules | US-A32 | Retention, archival and deletion schedule for each data class | Optional; needs a policy decision |

## 2. Partly implemented

| Requirement | Done | Left to do |
|---|---|---|
| NU-FR-07 Notifications | In-app notifications (source of truth) and an optional email copy | SMS or push; delivery tracking and retry for emails (US-A24, US-X07) |
| NU-FR-12 Withdraw or update own report | Withdrawal *request* decided by staff; location correction and photos through the information response | Free editing of the description before verification |
| NU-FR-14 (Opt) Data export / deletion | Account deletion | Personal-data export (US-N20, US-N36) |
| DM-FR-10 Inter-agency communication | Agency messages and their status events are recorded by staff; agency directory | Actual delivery to agencies (email or webhook) and their replies (US-D14, US-X01) |
| DM-FR-13 Aid allocation | DM needs, verification, allocation and delivery events | Citizen intake (see NU-FR-10) |
| DM-FR-28 Photo analysis | Endpoint, audit and UI; classifier trained (accuracy 0.839, macro-F1 0.815), merged with PR #186 and hosted on Render | Before turning it on: host the service under a project-owned account, require a bearer token, confirm uploads are not stored or logged, record the dataset licence; then set `AI_IMAGE_SERVICE_URL` (defect D-07) |
| DM-FR-05 AI triage, trained model | Rules baseline behind guardrails, human decision recorded; the model loader is ready (`TRIAGE_MODEL_DIR`) | A text model trained on our labelled three-scenario data reaching macro-F1 ≥ 0.75: dataset of ≥ 600 labelled items (S1-10), baselines (S1-12), model (S2-05), error analysis (S3-05), LLM decision numbers (S3-07) (defect D-08) |
| DM-FR-04 Duplicate scoring | `rules+text` score with an explanation | ≥ 100 labelled pairs and tuned weights, with precision ≥ 0.80 measured (S2-07, D-09) |
| AM-FR-03 Configuration management | Environment variables, documented in `env-variables.md` | Admin screen, validation and versioned rollback (US-A05, US-A30) |
| AM-FR-04 Monitoring | `/admin/system`, `/api/v1/health`, ingestion health panel | Queue, storage and integration dashboards; alerts |
| AM-FR-06 Data management | CSV exports, account deletion | Data correction tools, retention |
| AM-FR-07 Security management | Secrets kept outside the repository, CI security scans, sign out everywhere, lockout | Screen for recording security incidents |
| AM-FR-08 Backup and recovery | `scripts/db_backup.py` with guarded restore; Neon branches | Rollback drill part B on staging; production backup before the release tag |
| AM-FR-10 Payment monitoring | Webhook event log, audit trail, DM donation oversight | Admin reconciliation screen; live gateway (only sandbox and test mode are used) |
| AM-FR-11 Abuse and rate-limit controls | Per-endpoint, per-IP limits; lockout; generic errors | Configurable limits; block and allow lists; a shared limiter across instances (today it lives in each process's memory) |
| NU-NFR-02 / DM-NFR-02 Accessibility | Keyboard flows, labels, focus, contrast on the main paths | Formal WCAG audit (US-N23, US-D27) |
| NU-NFR-06 Compatibility | Responsive layout; Chromium e2e | Cross-browser matrix (US-N27) |
| DM-NFR-14 Moderation backlog | Moderation queue | Backlog threshold and alert (US-D39, US-D25) |
| DM-NFR-16 (Opt) Operational continuity | On-stage fallbacks in the demo script | Written manual-fallback procedure for long outages (US-D41) |
| AM-NFR-02 Scalability | Stateless API, pooled connections, indexes | Shared rate limiter; tested horizontal scaling (US-A18, US-A29) |
| AM-NFR-11 Compliance | Simulated data, sandbox payments and AI output are labelled | Formal data-protection and payment compliance review (US-A27) |
| AM-NFR-15 Traceability | FR → story → sprint (this document set) | Story → test-case links, delivered with the testing documents (US-A31) |

## 3. Release and process items open on 24 Nov 2026

| Item | Status on 24 Nov 2026 | Reference |
|---|---|---|
| Testing documents (unit and white-box with coverage, black-box and acceptance, GUI, mutation, non-functional) | Prepared as a separate document set | — |
| Two demo rehearsals recorded in the demo script, with no open P0 defect | Scheduled for Buffer 3 | S3-15, D-11 |
| Scenario runner executed three times against staging; timed clean deploy | Runner done; repeated runs scheduled | S3-12, D-11 |
| Release tags `v1.0.0-rc1` and `v1.0.0`; production pinned to the version image | Scheduled for Buffer 3 | S3-18 |
| Branch `dhruv/feature/admin-account-security` | Not merged; the merged administration console covers the same functions | D-16 |
| Citizen photo storage moved to Cloudinary | Not started; photos stay in PostgreSQL for v1.0 | — |

## 4. Deliberately out of scope

These were excluded by the SRS and are **not** counted as unfinished: other disaster types (earthquake alerts were removed in migration 18), anonymous reporting, agency login accounts, autonomous dispatch, real money movement and native mobile apps.
