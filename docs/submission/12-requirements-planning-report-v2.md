# ResQ: Requirements and Agile Planning Report, version 2

Group 30, 23 Nov 2026. This report follows *Report_1.pdf*, the Requirements and Agile Planning Report submitted at mid-evaluation (section 0 says where the original is kept). It does not repeat that report. It records **what changed between the initial scope and the delivered system**, section by section, and how each decision left open at mid-evaluation was finally settled. The current requirements are in [01-requirements-srs-v2.md](01-requirements-srs-v2.md), the backlog in [03-user-stories-backlog.md](03-user-stories-backlog.md) and the sprints in [04-sprint-details.md](04-sprint-details.md).

## 0. Mid-evaluation baseline and what replaced it

The four mid-evaluation files are not committed again. Each has been replaced by a corrected Markdown document, and an unchanged copy of each original stays in git history under `b12ef62^:documents/`.

| Baseline file (`b12ef62^:documents/…`) | Problems found at final review | Replaced by |
|---|---|---|
| `FR_NFR_API_routes.pdf`: Final SRS (Revised), 29 Sep 2026 | Exactly three roles; no Gujarat limit; numeric targets left "to be approved by [named approver]"; open questions (CR-22 to CR-50) unresolved; 17 built features missing; route list out of date | [01-requirements-srs-v2.md](01-requirements-srs-v2.md) (status of every requirement), [01b-detailed-requirement-specifications.md](01b-detailed-requirement-specifications.md) (full FR and NFR specifications with v2 notes), [api_contracts.md](../architecture/api_contracts.md) (routes) |
| `DRCH_User_Stories_SRS_Final_v5.xlsx`: 119 stories, 16 epics | Planned for five sprints; no delivery status; no stories for field teams or ingestion | [03-user-stories-backlog.md](03-user-stories-backlog.md) (v6, 138 stories, 18 epics, status and delivered sprint) |
| `Report_1.pdf`: Requirements and Agile Planning Report | Ten-week plan; stakeholder and domain rules from before the scope change; open decisions | This report, with [04-sprint-details.md](04-sprint-details.md) |
| `DRCH_ER_Diagram.pdf` | Schema at migration 02 (21 tables) | [er-diagram.md](../architecture/er-diagram.md), generated from migrations 01–19 (35 tables) |

## 1. Project overview: initial decisions against the final system

| Item | Initial (Report 1, SRS v1) | Final (v1.0) |
|---|---|---|
| Name | Disaster Response Coordination Hub (DRCH) | **ResQ**, still DRCH in code and database names |
| Geography | Not limited | **Gujarat only.** PostGIS state and district boundaries; reports outside are rejected |
| Scenarios | Cyclone, Industrial Fire, Urban Flooding (closed list) | Unchanged. Earthquake alerts that had entered through the USGS feed were removed (migration 18) |
| Roles | Exactly three: Normal User, Disaster Management, Application Management | **Four:** a **Field Responder** (`FIELD_TEAM`) role was added. It is invited by staff and sees only its own team's dispatches |
| DM permissions | Publisher/Approver, moderator, closer, supervisor (a fifth "dispatch" permission was in question) | **Five:** `PUBLISHER`, `MODERATOR`, `CLOSURE`, `DISPATCH`, `SUPERVISOR` |
| External agencies | Integration only; staff record acknowledgements | Agencies still have no login. Staff record agency messages and events; **field teams acknowledge for themselves** |
| AI | Advisory only | Unchanged. Rules baseline behind guardrails; trained models not in production |
| Contributions | Money and physical aid, both independent of incidents | Money: done (sandbox / test mode). **Physical aid: DM side only; citizen registration not built** |
| Method | Scrum, 5 sprints × 2 weeks (10 weeks), 10 people with assumed roles | Scrum: **Sprint 0 (11 Sep – 29 Oct) plus 3 one-week sprints**, each followed by a buffer. 10 named members |
| Backlog | 119 stories, 16 epics, 107 scheduled in S1–S5, 12 Optional held as conditional | **138 stories, 18 epics** (19 added): 97 done, 30 partial, 11 backlog |
| Requirements | 49 FR, 47 NFR, 26 error cases | 66 FR (17 added), the same 47 NFR, 28 error cases |

## 2. Stakeholders: changes

| # | Stakeholder | Change |
|---|---|---|
| S1 | Normal User | Unchanged, plus Google sign-in and a Hindi/Gujarati UI. Cannot yet register physical aid |
| S2 | Disaster Management staff | Unchanged in authority. Gains signals review, team recommendations, team-request decisions, shelters, notes and exports |
| S2a | Permission holders | The fifth permission `DISPATCH` is now confirmed. `SUPERVISOR` also manages staff and agencies, and can invite users and escalate dispatches. Signal promotion needs `PUBLISHER` or `SUPERVISOR` |
| S3 | Application Management | Now **without operational access** (denied `/dm`, `/field` and `/me`). Uses a dedicated console (`/admin`) |
| **S3b** (new) | **Field Responder** | Primary end user. Receives dispatches for their own team; acknowledges or rejects, reports progress, requests backup, completes |
| S4 | External agencies | Still no accounts. Messages and their status are recorded by staff; nothing is sent to them automatically |
| S5 | Payment gateway | Sandbox mock gateway (default) and Razorpay test mode. Signed webhooks |
| S6 | Map service | OpenStreetMap tiles, Nominatim geocoding (Google optional) |
| S7 | AI classification | Separate triage service (rules baseline); optional image and text classifiers outside production |
| **S8b** (new) | **Official alert feeds** | NDMA SACHET CAP feed for Gujarat. Optional Google News and Bluesky; team-written replay fixture for demos |
| S9 | Notification provider | In-app plus email (SMTP). No SMS or push |
| S12 | Business owner / approver | No named approver was appointed. Numeric targets were replaced by measured values (section 5) |

## 3. Elicitation: what was actually applied

| Technique | Mid-evaluation status | Final status |
|---|---|---|
| Document analysis of the SRS | Applied | Applied; revised again for v2 |
| Cross-document review (SRS, stories, epics, plan) | Applied (68 conflicts logged) | Applied again at the end: every FR and story re-checked against the code (this document set) |
| Prototype walkthroughs | Session guide ready | Done inside the team: the Day-3 demo of each sprint (integration gates S1-19, S2-15) acted as walkthroughs |
| Scenario workshops | Session guide ready | Replaced by scripted end-to-end scenarios: `scripts/smoke.py`, `scripts/scenario_run.py`, and the demo script with on-stage fallbacks |
| Interviews, surveys, observation with real stakeholders | Session guides ready, not run | **Not run.** No disaster-management staff or citizens could be reached. Requirement changes came from team decisions in sprint planning and reviews. This is recorded as a limitation |
| Document analysis of provider documentation | Planned | Applied: NDMA CAP guide (SACHET `If-None-Match` caching), Razorpay signature and webhook rules ([payment-gateway-findings.md](../quality/payment-gateway-findings.md)), [ingestion-sources.md](../operations/ingestion-sources.md) |

## 4. Domain requirements: updated

| ID | Rule (final) | Change |
|---|---|---|
| DR-01 | Only Cyclone, Industrial Fire and Urban Flooding; closed list, validated on the server; anything else gets `422 UNSUPPORTED_SCENARIO` | Unchanged |
| DR-02 | **Four roles**: Normal User, Disaster Management, Application Management, **Field Responder**. Moderation, approval, closure, dispatch and supervision are permissions inside Disaster Management | **Changed** (was three roles) |
| DR-03 | AI is advisory; an authorised human decides and the decision is recorded | Unchanged |
| DR-04 | Explicit states everywhere; nothing is shown as successful without confirmation | Unchanged |
| DR-05 | No false success for payment, dispatch, notification or delivery | Unchanged; enforced with server-side endings for donations |
| DR-06 | Agencies have no login. **Field teams are users and report their own progress** | **Changed** |
| DR-07 | Only verified, approved, versioned content is public | Unchanged |
| DR-08 | Evidence is checked and moderated before staff or public use | Unchanged; photos only |
| DR-09 | Card details never reach the application | Unchanged |
| DR-10 | Donations can start without an incident. Physical aid registration by citizens is **not delivered** | Partly delivered |
| DR-11 | Every incident ends in a clear final state; closure can be reopened with a reason | Reopen added |
| DR-12 | Critical actions record actor, time, record, action, result and rationale in an **append-only, hash-chained** log | Strengthened |
| DR-13 | Deployment follows data-protection, payment, accessibility, retention and security obligations | Partly delivered (see 08) |
| **DR-14** (new) | Incidents must lie inside Gujarat; public coordinates are rounded to 4 decimal places | **New** |
| **DR-15** (new) | Ingested external signals never become incidents without a human promotion | **New** |

## 5. Open decisions from mid-evaluation and how they were closed

| Decision (Report 1, §8.1) | CR | Outcome |
|---|---|---|
| Name the approver and approve numeric targets | CR-25 | No approver was named. Targets were replaced by **measured results**: public map p95 633 ms over 200 requests at concurrency 5 ([load-test.md](../quality/load-test.md)); dispatch acknowledgement timeout 15 minutes; login lockout after 5 failures for 15 minutes; donation expiry after 30 minutes |
| Keep or skip needs management (DM-FR-19) | CR-26 | **Kept and built** (`/dm/needs`) |
| Keep or skip the optional data-request set | CR-27 | **Partly kept:** self-service account deletion. Export and admin oversight are not built |
| Keep or skip the browser draft | CR-28 | **Skipped.** Safe retry is covered by the idempotency key |
| Does a fifth "dispatch" permission exist? | CR-46, CR-66 | **Yes.** `DISPATCH` is in the `dm_permission` type and guards dispatch creation, recording and team-request decisions |
| Meaning of "role settings" in AM-NFR-14 | CR-23 | Only an account's role and permission assignment can change, and each change is audited. The role list is fixed. Configuration versioning was not built |
| Error-code mapping in s.15.7 | CR-47 | **Resolved:** `{error:{code,message,details}}` with stable codes ([api_contracts.md](../architecture/api_contracts.md)) |
| Meaning of Escalated; Completed and Failed missing from DM-FR-09 | CR-22, CR-24 | `COMPLETED` and `FAILED` are dispatch states. **Escalated is an audited event** (`DISPATCH_ESCALATED`) on a dispatch still REQUESTED, not a separate state |
| Scenarios 13.12 / 13.13 labelled Optional; idempotency cites optional NU-FR-13 | CR-48, CR-49 | Both treated as core. Evidence moderation and content approval are built, and idempotency is mandatory on reports, dispatches and donations |
| Keep or skip five further Optional items | CR-50 | NU-FR-15 skipped. DM-FR-20 kept (agency directory). AM-FR-14 skipped. DM-NFR-16 partly (demo fallbacks). AM-NFR-15 partly (traceability up to stories and sprints; tests to follow) |
| Backup retention against data deletion | CR-68 | **Still open.** Account deletion removes live rows, but Neon branches and `pg_dump` files keep them until they are deleted. A retention period still has to be set |

## 6. Delivery risks: what happened

| Risk (Report 1, §8.2) | Outcome |
|---|---|
| 20–22 stories per sprint is a very high load; velocity unknown | It materialised. The plan was rebuilt as Sprint 0 plus three one-week sprints with buffers. Delivered stories per sprint: 27 / 17 / 36 / 46 |
| External providers undecided | Settled: OpenStreetMap and Nominatim; sandbox and Razorpay test mode; SACHET; SMTP; our own AI services. SMS was dropped |
| Cross-sprint dependencies | Handled by Day-1 shared work (migrations, dispatch refactor). Large catch-up merges still happened in the buffers |
| Single points (database, integration, DevOps) | The leader stayed the single owner of secrets, CI/CD and merges. This worked, but it concentrated review load (most pull requests were merged by one person) |
| Assumed roles; stack and start date TBD | Resolved: ten named members with fixed areas ([09-contribution.md](09-contribution.md)); stack FastAPI, Neon PostGIS, Next.js 16 |
| *(new)* ML data dependency | It materialised. The labelled dataset target (≥ 600 items) was not reached, so the text-model target was missed and the rules baseline stays in production |

## 7. Conflict register: final state

Report 1 logged 68 conflicts (CR-01 to CR-68): 54 resolved, the rest open or awaiting the SRS owner. With the decisions in section 5, **every one is now closed except CR-68** (backup retention against deletion). The scope changes in section 1 were made by the team during sprint planning. They are recorded as changes C1–C8 in [01-requirements-srs-v2.md §2](01-requirements-srs-v2.md).
