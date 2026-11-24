# ResQ: Software Requirements Specification, version 2 (final), Part A

| Item | Detail |
|---|---|
| Project | ResQ: Disaster Response Coordination Hub (DRCH) for Gujarat |
| Course | IT314 Software Engineering, Autumn 2026-27 |
| Group | 30 |
| Live system | https://it-314-software-project.vercel.app/ |
| Version | 2.0, 23 Nov 2026. Replaces *Final SRS (Revised)* of 29 Sep 2026, which was submitted at mid-evaluation |
| Parts | **Part A** (this document): scope, changes and the status of every requirement. **Part B**: [full specification of every FR and NFR](01b-detailed-requirement-specifications.md) |
| Status keys | **Done**: implemented and deployed. **Partial**: part of the requirement is implemented, and the missing part is listed in [08-requirements-not-implemented.md](08-requirements-not-implemented.md). **Backlog**: not implemented. **New**: added after mid-evaluation |

## 1. Purpose and scope

ResQ is a role-based web platform that coordinates disaster response in Gujarat:

- **Citizens** report incidents, track them, answer staff questions and donate.
- **Disaster Management (DM) staff** verify reports, prioritise them and dispatch response teams.
- **Field responders** acknowledge assignments and report progress from the scene.
- **Administrators** manage accounts and the integrity of the platform.

Verified incidents appear on a public map without any personal data.

**Fixed scope:**

- **Scenarios:** only three are supported, `cyclone`, `industrial_fire` and `urban_flooding`. The report form offers them as a closed list, and the server validates the value again. Any other value is rejected with `UNSUPPORTED_SCENARIO`.
- **Location:** only inside **Gujarat**. A report outside the state boundary is rejected with `OUTSIDE_GUJARAT`.
- **AI is advisory only.** Verification, priority, dispatch, escalation decisions and closure are always made by a human, and each decision is recorded.
- **No false success:** a donation, dispatch or delivery is shown as successful only after the matching confirmation event.

**Out of scope:** other disaster types; anonymous incident reporting; login accounts for external agencies; autonomous dispatch; real money movement (payments run in sandbox or test mode); native mobile apps.

## 2. What changed since the mid-evaluation SRS (v1, 29 Sep 2026)

| # | Change | Why |
|---|---|---|
| C1 | **A fourth role, Field Responder (`FIELD_TEAM`), was added.** v1 had exactly three roles, and staff recorded every acknowledgement on behalf of the field team. | The dispatch loop needed the people on the ground to acknowledge and report progress themselves. A field account sees only its own team's dispatches. External agencies still have no login. |
| C2 | Geography fixed to **Gujarat**. Each report is checked against PostGIS state and district boundaries, and its district is stored. | v1 had no geographic limit. The project was narrowed to a single state for real alert feeds and realistic seed data. |
| C3 | **New FRs:** public map, external alert and signal ingestion, team recommendations, team requests, shelters, incident notes, staff invitations, Google sign-in, multilingual citizen UI (English, Hindi, Gujarati), CSV exports, session refresh and revocation. | These were built during Sprints 1–3 (section 3.4). |
| C4 | Physical-aid registration by citizens (NU-FR-10) moved to the backlog. Only the DM side (needs, verification, allocation, delivery) was built. | Time; priority was given to the core incident and dispatch loop. |
| C5 | Configurable notification channels (AM-FR-09), moderation policy (AM-FR-12) and versioned configuration with rollback (AM-FR-03) were **simplified**. Settings are environment variables and code constants instead of admin screens. | Time; risk is low for a single deployment. |
| C6 | The plan changed from five two-week sprints to **Sprint 0 plus three one-week sprints, each followed by a buffer**. | The course calendar. See [04-sprint-details.md](04-sprint-details.md). |
| C7 | Error-response mapping was made concrete as `{error:{code,message,details}}`, with stable codes. | This resolves conflict item CR-47 from the mid-evaluation workbook. |
| C8 | The open questions about performance targets ("[named approver]") were answered with measured values (section 5). | The targets now come from measurements. |

## 3. Functional requirements

### 3.1 Citizen (Normal User), NU-FR

| ID | Requirement | Status | Sprint | Implementation / note |
|---|---|---|---|---|
| NU-FR-01 | Register and sign in. Public sign-up creates citizen accounts only. Sign-in by email and password or by Google. Password reset by emailed link. | Done | S1 (Google: S3) | `POST /auth/register`, `/auth/login`, `/auth/google`, `/auth/forgot-password`, `/auth/reset-password` |
| NU-FR-02 | View and update permitted profile fields and change password. A citizen cannot change their own role. | Done | S2 | `GET/PATCH /me/profile`, `POST /me/password` |
| NU-FR-03 | Report an incident in one of the three scenarios, with description, urgency and people affected. Repeating a submission with the same key never creates a duplicate. | Done | S1 | `POST /incidents` with an `Idempotency-Key` header. Reference `INC-YYYY-NNNNNN` |
| NU-FR-04 | Give the location by GPS, map pin or manual address. The location must be inside Gujarat. | Done | S1 | `geo.is_in_gujarat`, `geo.district_for` |
| NU-FR-05 | Attach photo evidence. | Done (photos only) | S3 | Up to 5 images of 5 MB each. Type is checked by content, and metadata is removed. Stored in `evidence_blobs` and moderated before staff use |
| NU-FR-06 | Track own reports (status timeline, verified updates, closure reason) and own donations with receipts. | Done | S1–S2 | `/me/incidents`, `/my-reports`, `/me/donations` |
| NU-FR-07 | Receive notifications about own reports and transactions. | Partial | S2 | In-app notifications (the source of truth) plus an optional email copy. No SMS or push |
| NU-FR-08 | Read approved safety guidance for each scenario. | Done | S3 | `/safety`, `GET /public/safety-content`. Each guide shows its source |
| NU-FR-09 | Donate money to an active campaign without filing an incident. The donation state (Pending, Confirmed or Failed) is never shown falsely. | Done (sandbox) | S2–S3 | `POST /donations`, signed verification, webhook, receipts. No real money moves |
| NU-FR-10 | Register physical aid (type, quantity, condition, location). | **Backlog** | — | DM-side handling of aid exists (DM-FR-13). There is no citizen form or API |
| NU-FR-11 | Answer a staff request for more information. The incident then returns to SUBMITTED for a fresh decision. | Done | S2 | `POST /me/incidents/{id}/information-response` |
| NU-FR-12 | Correct or withdraw own report before an operation depends on it. | Partial | S2 | Withdrawal *request* (staff decide); location correction and photos through the information response. No free editing of the text |
| NU-FR-13 (Opt) | Browser draft and safe retry. | Partial | S1 | Safe retry is done (idempotency key). Browser drafts are not built |
| NU-FR-14 (Opt) | Data export and deletion request. | Partial | S3 | Self-service account deletion (`POST /me/account/deletion`). Data export is not built |
| NU-FR-15 (Opt) | Flag published content. | Backlog | — | — |
| **NU-FR-16** (New) | View the public Gujarat map of verified incidents, active alerts, open shelters and active campaigns, without signing in and without personal data. | Done | S1–S3 | `GET /public/incidents`, `/alerts`, `/shelters`, `/campaigns`, `/updates`. Coordinates rounded to 4 decimal places |
| **NU-FR-17** (New) | Use the citizen screens in English, Hindi or Gujarati. | Done | S3 | `LanguageSelector`, `lib/citizenI18n.ts` |

### 3.2 Disaster Management staff, DM-FR

| ID | Requirement | Status | Sprint | Implementation / note |
|---|---|---|---|---|
| DM-FR-01 | Staff sign-in with password and TOTP MFA. Account locks after repeated failures. | Done | S0 | 5 failures lock the account for 15 minutes; `token_version` revokes sessions |
| DM-FR-02 | Dashboard of incidents, priorities, pending actions and map. | Done | S0–S1 | `GET /dm/dashboard`, `/dm` |
| DM-FR-03 | Review evidence; verify, reject or request information, with a rationale. | Done | S0–S1 | `POST /dm/incidents/{id}/verification`, `/information-requests` |
| DM-FR-04 | Show likely duplicates with the reason; link, merge or dismiss them (never automatically). | Done | S0, S3 | Rules plus character-trigram text score (`"method": "rules+text"`). The weights are not yet tuned |
| DM-FR-05 | Advisory AI classification with confidence and uncertainty; accept, modify or reject it; record the decision. | Done (rules baseline) | S1–S2 | `ai-workers /triage` behind `ai_provider` guardrails. A trained model is not deployed (section 8) |
| DM-FR-06 | Set operational priority with a rationale. | Done | S0 | `PUT /dm/incidents/{id}/priority` |
| DM-FR-07 | Operational map of incidents, resources, teams and shelters. | Done | S1–S3 | `/dm/live-map`, `GET /dm/map`, `/dm/map/layers` |
| DM-FR-08 | Track and reserve teams, vehicles, supplies and support resources without double-booking. | Done | S0–S2 | `resources.reserve()` takes a `SELECT … FOR UPDATE` row lock |
| DM-FR-09 | Create and track dispatches for verified incidents. Escalate a dispatch not acknowledged within the timeout. | Done | S0–S2 | `DISPATCH_TRANSITIONS`; `escalate_overdue()` runs every 60 s |
| DM-FR-10 | Send coordination messages to external agencies and record their responses. | Partial | S0 | Messages and their status events are recorded by staff. Nothing is actually sent to the agency |
| DM-FR-11 | Publish verified public updates (PUBLISHER permission). | Done | S2 | `/dm/public-updates` |
| DM-FR-12 | Oversee confirmed donations and verified aid. | Done | S2 | `/dm/oversight/donations`, `/dm/oversight/aid` |
| DM-FR-13 | Allocate verified aid to a need and track its delivery. | Partial | S0–S2 | The DM workflow is built. It has no citizen intake (NU-FR-10) |
| DM-FR-14 | Analytics by time, scenario and district, with metric definitions. | Done | S2–S3 | `/dm/analytics`, including AI-versus-human agreement and CSV export |
| DM-FR-15 | Close an incident with a reason and an optional public summary. Open dispatches block closure unless overridden with a rationale. Reopen. | Done | S0 | CLOSURE permission |
| DM-FR-16 | Manage donation campaigns for the three scenarios. | Done | S1–S2 | `/dm/campaigns` |
| DM-FR-17 | Author, approve and publish versioned safety content. | Done | S2–S3 | Draft → Approved → Published → Superseded |
| DM-FR-18 | Moderate uploaded evidence: approve, quarantine or remove. | Done | S3 | `/dm/moderation/queue` (MODERATOR permission) |
| DM-FR-19 (Opt) | Manage operational needs. | Done | S2 | `/dm/needs` |
| DM-FR-20 (Opt) | Agency directory. | Done | S3 | `/dm/agencies` |
| **DM-FR-21** (New) | Review a queue of signals ingested from external sources and promote each one to an incident or dismiss it. Show related signals. | Done | S2–S3 | `/dm/signals`, `/signals/{id}/promote` (PUBLISHER or SUPERVISOR), `/signals/related` |
| **DM-FR-22** (New) | See ranked team recommendations (distance, capability match, reasons) for an incident. Recommendations never create a dispatch. | Done | S1–S2 | `GET /dm/incidents/{id}/team-recommendations` |
| **DM-FR-23** (New) | Decide backup requests raised by field teams. | Done | S2 | `POST /dm/team-requests/{id}/decision` (DISPATCH) |
| **DM-FR-24** (New) | Maintain shelters, relief camps and medical posts with capacity and status. | Done | S3 | `/dm/shelters`; open ones appear on the public map |
| **DM-FR-25** (New) | Add internal staff notes to an incident. | Done | S3 | `/dm/incidents/{id}/notes` |
| **DM-FR-26** (New) | Export incidents and dispatches as CSV. | Done | S3 | `/dm/incidents/export`, `/dm/dispatches/export` (rate-limited) |
| **DM-FR-27** (New) | Run an ingestion poll on demand and see ingestion health. | Done | S2 | `/dm/ingestion/health`, `/poll` |
| **DM-FR-28** (New) | Optional photo analysis by the image classifier (advisory). | Partial | S3 | The endpoint exists. It answers `503 AI_PHOTO_UNAVAILABLE` until the service is configured |

### 3.3 Application Management (administrator), AM-FR

| ID | Requirement | Status | Sprint | Implementation / note |
|---|---|---|---|---|
| AM-FR-01 | Administrator sign-in with MFA. | Done | S0 | Same mechanism as DM-FR-01 |
| AM-FR-02 | Create, disable and enable accounts; grant DM permissions; prevent self-escalation. | Done | S0–S3 | `/admin/accounts/*`, invitations, bulk actions, credential reset |
| AM-FR-03 | Manage configuration (timeouts, thresholds) safely. | Partial | — | Environment variables registered in `env-variables.md`. There is no admin screen and no versioned rollback |
| AM-FR-04 | Monitor services and integrations. | Partial | S2–S3 | `/admin/system`, `/api/v1/health`, ingestion health. No alerting |
| AM-FR-05 | Search and verify protected audit records. | Done | S0, S3 | `/admin/audit`, `POST /admin/audit/verify`, CLI `verify-audit` |
| AM-FR-06 | Validate, correct and manage data and its lifecycle. | Partial | S3 | Exports and account deletion. No retention schedules |
| AM-FR-07 | Manage security controls and secrets. | Partial | S0–S3 | Secrets live only in the hosting consoles; CI scans; "sign out everywhere". No screen for security incidents |
| AM-FR-08 | Back up and restore. | Partial | S3 | `scripts/db_backup.py` and Neon branches. The production restore drill is open |
| AM-FR-09 | Configure notification channels and routing. | Backlog | — | Fixed: in-app plus email |
| AM-FR-10 | Monitor payment integration and reconciliation. | Partial | S3 | Webhook event log, audit, DM oversight. No admin reconciliation screen |
| AM-FR-11 | Rate limits and abuse controls. | Partial | S1–S3 | Per-endpoint, per-IP limits fixed in code and kept in process memory. No block or allow lists |
| AM-FR-12 | Configure moderation policy. | Backlog | — | Allowed types and sizes are constants in code |
| AM-FR-13 (Opt) | Oversee data requests. | Backlog | — | — |
| AM-FR-14 (Opt) | Second-administrator approval for critical changes. | Backlog | — | — |
| **AM-FR-15** (New) | Invite staff and field responders by email; the invitee sets a password and TOTP. | Done | S1–S3 | `/auth/invitations`, `/setup-account` |
| **AM-FR-16** (New) | Sign a user out of every session; refresh-token rotation with idle and absolute expiry for each role. | Done | S3 | `services/sessions.py`, `refresh_tokens` |

### 3.4 Field Responder, FT-FR (new role)

| ID | Requirement | Status | Sprint | Implementation |
|---|---|---|---|---|
| FT-FR-01 | Sign in (invited account, MFA) and see only the dispatches assigned to my own team. | Done | S2 | `require_field`, `FieldPrincipal`, `GET /field/assignments` |
| FT-FR-02 | Acknowledge or reject a dispatch (a rejection needs a reason). | Done | S2 | `/field/dispatches/{id}/acknowledgement`, `/rejection` |
| FT-FR-03 | Report progress: EN_ROUTE, ON_SCENE, DELAYED. | Done | S2 | `/field/dispatches/{id}/progress` |
| FT-FR-04 | Request backup with a required capability. | Done | S2 | `/field/dispatches/{id}/team-requests` |
| FT-FR-05 | Complete a dispatch. Its resources are released. | Done | S2 | `/field/dispatches/{id}/completion` |

### 3.5 Summary

| Group | Total | Done | Partial | Backlog |
|---|---|---|---|---|
| NU-FR (15 + 2 new) | 17 | 11 | 4 | 2 |
| DM-FR (20 + 8 new) | 28 | 25 | 3 | 0 |
| AM-FR (14 + 2 new) | 16 | 5 | 7 | 4 |
| FT-FR (new) | 5 | 5 | 0 | 0 |
| **Total** | **66** | **46** | **14** | **6** |

## 4. Non-functional requirements

v1 left numeric targets "to be approved". v2 states what was built and the measured value where one exists.

| ID | Name | How ResQ meets it | Status |
|---|---|---|---|
| NU-NFR-01 / DM-NFR-01 | Usability | One form per task. Scenario cards with descriptions. Plain-language status labels on the timeline. The DM console foregrounds pending work ("Your focus"). | Done |
| NU-NFR-02 / DM-NFR-02 | Accessibility | Labels, focus order, keyboard-only flows on citizen and field screens, readable contrast. | Partial: no formal WCAG audit |
| NU-NFR-03 / DM-NFR-03 | Performance | Public map p95 **633 ms** (p50 475 ms, 200 requests at concurrency 5, India to Render Ohio, [load-test.md](../quality/load-test.md)). Hot paths make 1–3 database round trips. | Done |
| NU-NFR-04 / DM-NFR-04 | Availability | The deployment is health-checked. The AI, map and payment services degrade to labelled "unavailable" states. Render's free tier sleeps, and a cron job wakes it every 15 minutes. | Partial: free-tier hosting |
| NU-NFR-05 | Privacy | The public API returns no reporter data and rounds coordinates to 4 decimal places. Only staff can see evidence. PII is removed before AI calls. | Done |
| NU-NFR-06 / AM-NFR-10 | Compatibility | Responsive layout for desktop and mobile browsers; the Playwright e2e specs run in Chromium. The cross-browser matrix is left for the testing documents. | Partial |
| NU-NFR-07 | Payment security | Card data never reaches ResQ. Signatures are checked server-side (HMAC-SHA256). The sandbox gateway is refused in production. | Done |
| NU-NFR-08 | Transaction reliability | Idempotency keys. The webhook is replay-safe (`payment_webhook_events` primary key). Exact amount check. Every path ends on the server (ABANDONED, GATEWAY_DECLINED or EXPIRED). | Done |
| NU-NFR-09 | Transparency | Explicit states throughout; nothing is shown as confirmed without a confirmation event. | Done |
| NU-NFR-10 | Donor privacy | An anonymous-donation option; guest name and email are kept apart from accounts. | Done |
| NU-NFR-11 | Timeliness | The reporter gets an incident reference immediately and a notification on every status change. | Done |
| NU-NFR-12 / AM-NFR-13 | Abuse resistance | Rate limits on sign-up, login, MFA, reports, donations, exports and more. Generic login errors. Lockout. | Partial (in-process limiter) |
| NU-NFR-13 | Content safety | Uploads are checked by their bytes, metadata is removed, user text is never rendered as HTML, and ingested text is sanitised. | Done |
| NU-NFR-14 (Opt) | Offline draft | — | Backlog |
| NU-NFR-15 / AM-NFR-16 | Data retention and user rights | Account deletion. No retention schedule. | Partial |
| DM-NFR-05 | Role-based access | The role and permissions are loaded from the database on **every** request and never cached. The backend re-checks access behind the BFF. Administrators have no operational access. | Done |
| DM-NFR-06 / AM-NFR-09 | Auditability | Append-only `audit_logs` with a SHA-256 hash chain and triggers that block UPDATE and DELETE; verified by `verify-audit`. | Done |
| DM-NFR-07 | Interoperability | REST `/api/v1` with documented contracts ([api_contracts.md](../architecture/api_contracts.md)) and CAP for alerts. | Done |
| DM-NFR-08 / AM-NFR-12 | Resilience | Each external dependency fails into a labelled state; an ingestion failure is recorded per run. | Done |
| DM-NFR-09 | AI explainability | Factors, confidence, uncertainty note and model name are stored with each recommendation. | Done |
| DM-NFR-10 | Human oversight | AI output is stored separately (`ai_recommendations`) and never changes an incident; the human decision is recorded. | Done |
| DM-NFR-11 / AM-NFR-04 | Data integrity | Optimistic `version` on incidents and resources; row locks for allocation; database CHECK constraints (for example, VERIFIED requires a priority). | Done |
| DM-NFR-12 | Analytics transparency | Each metric shows its definition and how pending records are counted. | Done |
| DM-NFR-13 | Dispatch timeliness | Acknowledgement timeout `DISPATCH_ACK_TIMEOUT_MINUTES` with automatic escalation. | Done |
| DM-NFR-14 | Abuse and moderation handling | Moderation queue; quarantine. | Partial (no backlog threshold alert) |
| DM-NFR-15 | Content authority | Only approved, versioned content is public; author and approver are recorded. | Done |
| AM-NFR-01 | Maintainability | Layered routers, services and core modules; ruff lint; 19 forward-only migrations; documentation in `docs/`. | Done |
| AM-NFR-02 | Scalability | Stateless API, connection pool, PostGIS indexes. The rate limiter is per instance. | Partial |
| AM-NFR-03 | Monitoring | Health endpoints and ingestion health. | Partial |
| AM-NFR-05 | Backup and recovery | `pg_dump` script, restore only into a `_restore` or `_test` database, Neon branch before each release. | Partial (drill pending) |
| AM-NFR-06 | Security | Argon2id, TOTP, encrypted MFA secrets, httpOnly cookie, CSRF check on the BFF, gitleaks, bandit, pip-audit, CodeQL, Trivy. | Done |
| AM-NFR-07 | Payment monitoring | Webhook outcome log and audit trail. | Partial |
| AM-NFR-08 | Notification reliability | The in-app notification is the source of truth; an email failure never fails the action. | Done |
| AM-NFR-11 | Compliance | Simulated data and sandbox payments are labelled. | Done |
| AM-NFR-14 | Configuration governance | — | Backlog |
| AM-NFR-15 | Traceability | This document plus the story workbook (FR → story → sprint). The test part follows with the testing documents. | Partial |
| DM-NFR-16 (Opt) | Operational continuity | — | Backlog |

## 5. Error cases (EH) and how they are handled

| ID | Case | Handling in v1.0 |
|---|---|---|
| EH-01 | Missing fields | 422 `VALIDATION_FAILED`, with the fields listed in `details` |
| EH-02 | Invalid login | 401 `INVALID_CREDENTIALS` (generic message); lockout after 5 failures |
| EH-03 | Unsupported upload | 422; type is checked from the bytes, size limit 5 MB, at most 5 photos |
| EH-04 | Duplicate report | Advisory duplicate candidates; the idempotency key prevents double submission |
| EH-05 | Unverified incident | 409 `INCIDENT_NOT_VERIFIED` when dispatching |
| EH-06 | AI uncertainty | `LOW_CONFIDENCE`, `UNAVAILABLE` and `UNSAFE_OUTPUT` states; manual triage continues |
| EH-07 / 08 / 09 | Failed, pending donation; gateway outage | Explicit PENDING and FAILED states with a reason; never a false receipt |
| EH-10 / 14 | Invalid aid; failed delivery | Aid REJECTED status and delivery events (DM side) |
| EH-11 | Unauthorised access | 401 or 403; 404 for records the requester does not own |
| EH-12 | Server or network failure | Retry with the same idempotency key |
| EH-13 | Failed notification | The in-app notification stays; the email error is logged |
| EH-15 / 16 / 17 | Dispatch timeout, rejection, late acknowledgement | Escalation; reason required; 409 `DISPATCH_STATE_CONFLICT`, audited and never applied |
| EH-18 / 19 | Flood, automated abuse | 429 from the rate limiter |
| EH-20 / 21 | Unsafe content, moderation backlog | Quarantine; backlog visible in the queue |
| EH-22 | Unauthorised publish | 403 without the PUBLISHER permission |
| EH-23 | Invalid closure | 409 `OPEN_DEPENDENCIES` unless overridden with a rationale |
| EH-24 | Rejected configuration change | Not applicable (configuration is not editable at runtime) |
| EH-25 | Unsupported scenario | 422 `UNSUPPORTED_SCENARIO`; the UI points to emergency numbers 112 / 101 / 108 |
| EH-26 | Data request failure | Account deletion returns a clear error; export is in the backlog |
| **EH-27** (New) | Location outside Gujarat | 422 `OUTSIDE_GUJARAT` |
| **EH-28** (New) | Concurrent edit | 409 `VERSION_CONFLICT`; the client reloads |

## 6. Constraints and assumptions

- Stack: FastAPI (Python 3.12), Neon PostgreSQL 16 with PostGIS, Next.js 16 (React 19), Leaflet with OpenStreetMap. Hosting is on free tiers: Vercel, Render, Neon and GitHub Actions.
- Authentication is managed by the application itself; no external identity provider holds accounts. Google sign-in only proves the email address.
- Demo incidents and fallback alerts are flagged (`is_simulated`, `is_fallback`). Simulated incidents are hidden from the public map outside development.
- Payments use the sandbox mock gateway or Razorpay test mode. No real money moves.
