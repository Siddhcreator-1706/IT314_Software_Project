# ResQ: Presentation Content (slides S1–S10)

Group 30. This is the content of the 5-minute presentation, in the slide order the course requires. The live demo (10 minutes) follows [demo-script.md](../project/demo-script.md).

---

## S1. Title

**ResQ: Disaster Response Coordination Hub for Gujarat**

- IT314 Software Engineering, Autumn 2026-27, Group 30
- Live: https://it-314-software-project.vercel.app/
- Image: the public Gujarat map

## S2. Group leader and task assignment

- **Leader:** Siddh (tech lead, CI/CD, releases, integration)
- Table of all ten members and their main areas (from [09-contribution.md](09-contribution.md) §1):
  - Zalak: citizen and public backend, MFA, analytics, final report
  - Nisarg: dispatch and field backend, geofence, recommendations
  - Shlok: DM module, payments, signal promotion
  - Janvi: citizen and field UI
  - Tanishq: schema, public site, dispatcher UI
  - Dhruv: QA lead
  - Rudra: ingestion
  - Neeti: AI lead
  - Dhruvil: image and text classifiers
- The detailed task assignment is in the contribution document submitted to the instructor

## S3. Objectives

1. Let citizens report cyclone, industrial-fire and urban-flooding incidents in Gujarat and follow them to closure.
2. Give dispatchers one console to verify, prioritise, dispatch and close, with every decision made and recorded by a human.
3. Close the loop with field teams in real time (acknowledge, progress, backup, complete).
4. Keep the public informed without exposing personal data (verified map, alerts, shelters, safety guidance).
5. Build it as a production-style system: tested, secured, audited and continuously deployed.

## S4. Milestones

Timeline graphic:
- **Sprint 0** (11 Sep – 29 Oct): SRS, 119 stories, schema, CI/CD, staff MFA, DM core, mid-evaluation
- **Sprint 1** (30 Oct – 4 Nov): real core loop (report → verify → public map)
- Buffer 1 (5 – 6 Nov)
- **Sprint 2** (7 – 12 Nov): field teams, recommendations, AI triage, ingestion, donations
- Buffer 2 (13 – 14 Nov)
- **Sprint 3** (15 – 22 Nov): payment hardening, sessions, admin console, security review, load test
- Buffer 3 (23 Nov – 3 Dec): testing documents, rehearsals, release v1.0.0, submission

## S5. Use-case diagram and backlog by sprint

- Left: [use-case diagram](diagrams/png/use-case.png). Five human actors (Citizen, Public, Dispatcher, Field Responder, Administrator) and four external systems.
- Right: stories delivered per sprint: S0 27 · S1 17 · S2 36 · S3 46. Status: **97 done, 30 partial, 11 backlog**, of 138 stories in 18 epics.

## S6. Lessons learnt

- Freeze the database contract and API first. Shared migrations on Day 1 of each sprint unblocked the whole team.
- A strict state machine plus row locks, with an audit trail in the same transaction, is what makes "human in the loop" provable.
- ML depends on data. Labelling is the critical path, so start it in Sprint 0, not Sprint 1.
- A CD pipeline that smoke-tests staging before production catches real deployment mistakes. Our pipeline once reported success with nothing deployed (defect D-01).
- Small pull requests merged daily beat large catch-up merges in the buffer.

## S7. Achievements

- End-to-end flow live: report → verify → recommend → dispatch → field progress → close → public map.
- Security: Argon2id + TOTP MFA, permissions checked against the database on every request, SHA-256 hash-chained immutable audit log, six security scanners in CI.
- Payments that never show false success: signed verification, replay-safe webhook, server-side endings.
- Real SACHET (NDMA) alert ingestion for Gujarat, with a human-gated promotion step.
- In CI: 630 backend test functions (818 test cases collected on 14 Nov) and 11 Playwright e2e specs. Public map p95 633 ms.
- Citizen UI in three languages (English, Hindi, Gujarati).

## S8. Mistakes

- Two parallel prototypes (localStorage/SQLite and the real backend) cost time to reconcile in Sprint 0.
- The text-model target (macro-F1 ≥ 0.75) was missed; the system ships on a transparent rules baseline.
- Catch-up merges in the buffers instead of small daily pull requests.
- The mid-evaluation documents were deleted from the repository in a cleanup and had to be restored.
- Sign-offs, rehearsals and release tags were left to the last buffer.

## S9. Rating of software artefacts (0–5)

| Artefact | Rating | Why |
|---|---|---|
| Requirements (SRS, FR/NFR) | 4.5 | Complete and traced; v2 reconciles them with what was built |
| User stories and backlog | 4.5 | 138 stories with acceptance criteria and status |
| Design (system, object, UML) | 4 | Diagrams for every sprint; contracts documented |
| Source code | 4.5 | Layered, linted, reviewed through PRs |
| Testing | 3.5 | Strong automated suite; formal testing documents in progress |
| Deployment / DevOps | 4.5 | CI quality gate, staging smoke gate, tagged releases |
| AI components | 3 | Advisory design is sound; model quality is below target |

## S10. Overall rating of the project (out of 10)

**8 / 10**. A complete, secure and deployed coordination loop with honest labelling of what is simulated. The marks lost are for the AI model quality and the backlog items in [08-requirements-not-implemented.md](08-requirements-not-implemented.md).

---

**After the slides:**

- Live demo (10 min) following [demo-script.md](../project/demo-script.md).
- Git repository walkthrough: branches and fork PRs, the PR template, the CI Quality Gate, the CD to staging then production, the issue templates, and the conventional commits.
