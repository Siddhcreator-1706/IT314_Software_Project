# Changelog

All notable changes to ResQ, the Disaster Response Coordination Hub for Gujarat.

The layout follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow
[Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).

No version has been released yet. `v1.0.0` is the first planned production release (see
[Versions and releases](README.md#versions-and-releases)). The sprint sections below were written afterwards from
the Git history of `main`. The `sprint-1`, `sprint-2` and `sprint-3` tags are milestones added afterwards, not
releases. Each section lists what was true when it was merged; a later section says what was changed or removed.

| Section | Tag or commit | Merged up to | Planned dates | Summary |
|---|---|---|---|---|
| Unreleased | `d1387fd` | 21 Nov 2026 | Not applicable | Administration, shelters, session security, shared interface |
| Sprint 3 | `sprint-3` (`d813b73`) | 15 Nov 2026 | 3 to 12 Nov 2026 | Hardening, citizen account features, delivery pipeline |
| Sprint 2 | `sprint-2` (`7ca100a`) | 6 Nov 2026 | 29 Oct to 2 Nov 2026 | Field response, ingestion, donations, first text analysis |
| Sprint 1 | `sprint-1` (`40690d6`) | 31 Oct 2026 | 24 to 28 Oct 2026 | Foundation and core loop |

Planned dates come from the three-sprint roadmap that the README held at the time. Work finished later than planned
and neighbouring sprints overlapped, so a sprint section can include work planned for another sprint.

## [Unreleased]

Merged after the Sprint 3 milestone, 16 to 21 November 2026.

### Added

- **Administration:** staff account directory with CSV export; disable and re-enable accounts; reset a sign-in; sign a
  staff member out of every device; edit permissions and details; actions on several accounts at once; active
  session counts, per-account audit history, a "needs attention" summary and a system status page.
- **Sessions and sign-in:** rotating refresh tokens with idle, absolute and session-count limits; authenticator QR
  codes; a `create-admin` command, and MFA reset for administrator recovery.
- **Dispatch:** internal incident notes; CSV export of the incident and dispatch queues; supervisors can add, edit and
  deactivate agencies; agencies are classified by type.
- **Relief shelters:** published to citizens and maintained by dispatchers.
- **Citizens:** photo upload on the dashboard report form, with previews and photo metadata removed; approved photos
  are shown to dispatchers.
- **Field teams:** guided steps from acknowledgement through en route, on scene and completion.
- **AI:** live signals connected to the disaster classifier; class balancing and multilabel metrics in training.
- **Documentation:** class and sequence diagrams, a security policy and a code of conduct.

### Changed

- One staff workspace, navigation bar, account block and light theme shared across roles; wrong-role visits are
  redirected.
- Rebuilt live map with disaster icons, also available inside the dispatcher workspace.
- Rebuilt dispatch assignment dialog.
- Fewer database round trips per request.
- The simulated replay feed is now opt-in, so ingestion health shows only real sources by default.
- Text and image classifiers moved to `models/`, and documentation grouped into purpose folders.
- CI audits production dependencies only.

### Removed

- A database table, views and columns that no code used.
- The old `ai-workers/model` directory.

### Fixed

- A resolved or rejected incident can be reopened into a state where it can be worked, and the citizen progress bar no
  longer overstates closed reports.
- A slow backend no longer signs users out on reload.
- The SOS action no longer sends a made-up location.
- Earthquake is treated as out of scope everywhere.
- Navigation, sign-in redirect, notification bell and emergency banner layout defects.

### Security

- Hardened Google sign-in for staff.

## Sprint 3: hardening (milestone 15 November 2026)

### Added

- **Citizens:** photo attachments and evidence upload; replies to information requests, including a corrected
  location; profile, password change and account page; withdrawal requests and account deletion; email copies of
  notifications; a language selector.
- **Donations:** Razorpay Checkout in test mode, webhook and receipts; declined, abandoned and timed-out states;
  server-side cancellation and expiry; failure reasons for dispatchers.
- **Dispatch:** wording similarity for duplicate candidates, with an explanation; related-signal matching; AI versus
  human decision chart; advisory photo analysis; secondary capability matches in team recommendations.
- **Administration:** invite staff from the interface, and list, resend or revoke invitations.
- **Public:** dispatcher-published safety guidance and public updates.
- **Ingestion:** news and Bluesky signal adapters, and a live social signal pipeline.
- **AI:** optional language-model second opinion and summaries; optional trained scenario model in triage; triage
  rules, model card and evaluation report.
- **Operations and quality:** load-test script, database backup and restore script, automated cyclone scenario, ER
  diagram generator, defect list and final report draft.

### Changed

- The delivery pipeline gained a strict quality gate, staging deployment before production, reuse of CI-built images,
  Playwright tests in CI, Dependabot and CodeQL.
- New logo, favicon and header design.
- Citizen registration is validated; email verification is a placeholder.
- The public map is centred on Gujarat, with closer zoom to districts and incidents.

### Fixed

- The backend returns "unavailable" instead of demo data when the database or team recommendations are unavailable.
- Citizen reports are always stored in the database, and filing one requires an idempotency key.
- A citizen's reply returns the report to the submitted state.
- Accessibility, keyboard use and mobile layout on citizen and field screens.

### Security

- Rate limits against abuse of citizen actions.
- Browser token storage replaced by real session authentication.
- Resolved CodeQL and Dependabot alerts, including cross-site scripting, clear-text logging and slow regular
  expressions.
- Ingestion blocks off-host redirects and limits response size.

## Sprint 2: response and AI (milestone 6 November 2026)

Also includes Sprint 1 work that was merged after the `sprint-1` tag: the payments foundation (3 November), the
public map with its About and How-to pages (4 November) and the text dataset with baselines (5 November).

### Added

- **Field teams:** responder accounts with mandatory TOTP MFA, team-isolated API and responder screens with live
  refresh.
- **Dispatch:** shared state transitions with row locking and audit logging; spatial team recommendations; backup
  team requests with dispatcher decisions; a prompt to confirm resolution after field completion.
- **Accounts:** email invitations, forgotten and reset password pages, Google sign-in and redesigned sign-in screens.
- **Ingestion and alerts:** SACHET (NDMA) alert adapter, scheduled runs, labelled fallback alerts, a signals queue for
  dispatchers and a public alert map layer.
- **Donations:** campaigns, donation orders through a sandbox gateway, donation screens and citizen notifications.
- **Citizens:** respond to information requests.
- **Public:** About, How-to and Gujarat safety guidance pages; district filter and legend on a map limited to Gujarat.
- **AI:** text dataset tools, baseline evaluation and English crisis text analysis; AI suggestions labelled as not
  verified.
- **Testing and operations:** Playwright scenarios for the three disaster types; database tests for field, signals and
  donations; migration and release runbooks.

### Removed

- The earlier demo application that kept its data in the browser.

### Fixed

- Field access requires an active team assignment.
- Alert areas with several or overlapping regions are handled correctly.

### Security

- Hardened Google sign-in, invitations and password reset.
- Trusted proxy addresses and a blocking secret scan in CI.

## Sprint 1: core loop (milestone 31 October 2026)

Includes project setup from 11 September 2026.

### Added

- Project setup with Docker and continuous integration and deployment.
- PostgreSQL with PostGIS schema, versioned migrations, seed data and a hash-chained audit log.
- Disaster Management module: backend API, staff sign-in with MFA, dispatcher workspace and live map layer.
- Citizen registration and sign-in, report form, report timeline and dashboard.
- Public incident API, Gujarat geofence and a team recommendation engine.
- Disaster image classifier with training, evaluation and a service; classifier API tests and reports.
- Core-loop smoke test, database test fixtures and a seed reset command.
- Early prototype sign-up and role dashboards, and an earthquake report category.
- Repository templates and the MIT licence.

### Changed

- Database schema reduced from 42 to 20 core tables.
- Light theme and unified navigation.

### Security

- A strong signing secret is required at start-up.
- Plain-text passwords removed.
- Authentication fails closed on database errors, and account lockout applies to active sessions.
