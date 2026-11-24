# ResQ: Detailed Requirement Specifications (SRS v2, Part B)

Group 30. This is Part B of [01-requirements-srs-v2.md](01-requirements-srs-v2.md). Part A lists every requirement with its status. Part B gives the **full specification of each requirement**: for each functional requirement the description, input, internal processing, expected output, application reaction, success and failure; for each non-functional requirement the explanation, importance and how it is tested.

**Source.** The specifications of the 49 original FRs and 47 NFRs are taken from the mid-evaluation *Final SRS (Revised)* of 29 Sep 2026 (the original PDF stays in git history at `b12ef62^:documents/FR_NFR_API_routes.pdf`). They are unchanged except for typography. Each one now ends with its **v2 status** and, where the built system differs from the original wording, a **v2 note**. Where a note and the original text disagree, the note is correct for v1.0. The 17 FRs added after mid-evaluation are specified in the same format in section 4.

**Global change.** The original text assumes exactly three roles. v1.0 has four: a Field Responder role (`FIELD_TEAM`) was added, and staff accounts can also be invited by a Disaster Management supervisor. See Part A §2.

## 1. Citizen (Normal User) functional requirements

### NU-FR-01: Registration and Login

| Field | Specification |
|---|---|
| Description | Create an account and authenticate securely. Public sign-up creates Normal Users only; staff and admin accounts are created only by Application Management. |
| Input | Credentials, profile, consent |
| Internal processing | Validate; protect credentials; create account/session; assign the Normal User role; enforce RBAC; apply rate limits (AM-FR-11). |
| Expected output | Account and session |
| Application reaction | Show the result; dashboard only after authentication. |
| Success | Valid account and session |
| Failure | Duplicate account; invalid credentials; identity-service failure; rate limit reached |
| **v2 status** | Done (sprint S1 (Google: S3)) |
| **v2 note** | `POST /auth/register`, `/auth/login`, `/auth/google`, `/auth/forgot-password`, `/auth/reset-password` |

### NU-FR-02: Profile Management

| Field | Specification |
|---|---|
| Description | View and update permitted profile data. |
| Input | Profile changes |
| Internal processing | Authenticate; validate; persist; audit where required. A user cannot change their own role. |
| Expected output | Updated profile |
| Application reaction | Show saved values; reject invalid fields. |
| Success | Change committed |
| Failure | Invalid data; stale session; database failure; attempted self-escalation |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `GET/PATCH /me/profile`, `POST /me/password` |

### NU-FR-03: Incident Reporting

| Field | Specification |
|---|---|
| Description | Report an incident. The scenario is a fixed choice of the three supported types (Cyclone, Industrial Fire, Urban Flooding). |
| Input | Scenario, description, urgency indicators, location, people affected |
| Internal processing | Validate; the server rejects any scenario value outside the three; generate ID; timestamp; set Submitted; queue moderation and review; evaluate duplicate candidates. |
| Expected output | Incident record with a unique ID |
| Application reaction | Show the ID and Submitted status; never claim verification or dispatch. |
| Success | Stored with acknowledgement |
| Failure | Missing data; unsupported scenario (EH-25); duplicate suspicion; server failure |
| **v2 status** | Done (sprint S1) |
| **v2 note** | `POST /incidents` with an `Idempotency-Key` header. Reference `INC-YYYY-NNNNNN` |

### NU-FR-04: Location and Details

| Field | Specification |
|---|---|
| Description | Capture a GPS/map point or a manual location and the relevant details. |
| Input | Coordinates, address, details |
| Internal processing | Validate and normalise; store source and accuracy. |
| Expected output | Location-linked details |
| Application reaction | Show a map or address preview; allow correction. |
| Success | Correct location attached |
| Failure | GPS unavailable; invalid or ambiguous location; map service outage |
| **v2 status** | Done (sprint S1) |
| **v2 note** | `geo.is_in_gujarat`, `geo.district_for` |

### NU-FR-05: Evidence Upload

| Field | Specification |
|---|---|
| Description | Attach permitted evidence to a report. |
| Input | Files and incident ID |
| Internal processing | Validate type, size and safety; scan; store; link; mark Pending Moderation where configured (DM-FR-18). |
| Expected output | Evidence reference and moderation state |
| Application reaction | Show per-file state; reject unsafe files; never render unchecked content. |
| Success | Stored and linked |
| Failure | Unsupported, corrupt or malicious file; upload timeout |
| **v2 status** | Done (photos only) (sprint S3) |
| **v2 note** | Up to 5 images of 5 MB each. Type is checked by content, and metadata is removed. Stored in `evidence_blobs` and moderated before staff use |

### NU-FR-06: Report Tracking, History and Receipts

| Field | Specification |
|---|---|
| Description | View own authorised reports, timelines, contribution history and confirmed donation receipts. |
| Input | User session and filters |
| Internal processing | Query permitted records only; build timeline; retrieve receipts for confirmed transactions. |
| Expected output | History, status and receipts |
| Application reaction | Show the current state, verified updates and closure reason where applicable. |
| Success | Accurate authorised history |
| Failure | Access denied; missing record; database failure |
| **v2 status** | Done (sprint S1–S2) |
| **v2 note** | `/me/incidents`, `/my-reports`, `/me/donations` |

### NU-FR-07: Alerts and Notifications

| Field | Specification |
|---|---|
| Description | Receive relevant official alerts and transaction or report updates. |
| Input | Event and user preferences, including opt-out where offered |
| Internal processing | Check eligibility; queue and send; record the provider result; retry per policy. |
| Expected output | Queued / sent / delivered / failed state |
| Application reaction | Show in-app status, which is the source of truth; retry transient failures. |
| Success | Provider accepts, or an in-app status exists |
| Failure | Provider outage; invalid contact; rate limit |
| **v2 status** | Partial (sprint S2) |
| **v2 note** | In-app notifications (the source of truth) plus an optional email copy. No SMS or push |

### NU-FR-08: Safety Information

| Field | Specification |
|---|---|
| Description | Present approved safety guidance for the three supported scenarios. |
| Input | Scenario, location, context |
| Internal processing | Retrieve approved, versioned content published under DM-FR-17. |
| Expected output | Safety guidance |
| Application reaction | Show official status, source and last update time. |
| Success | Approved content visible |
| Failure | Content service outage; stale or unapproved content withheld |
| **v2 status** | Done (sprint S3) |
| **v2 note** | `/safety`, `GET /public/safety-content`. Each guide shows its source |

### NU-FR-09: Monetary Donations

| Field | Specification |
|---|---|
| Description | Donate money securely, independently of incident reporting. |
| Input | Amount, purpose or campaign, donor information, payment method |
| Internal processing | Create Pending; secure gateway handoff; validate the signed callback; reconcile; issue a receipt only after confirmation; idempotency prevents duplicates. |
| Expected output | Pending / Confirmed / Failed, plus a receipt if confirmed |
| Application reaction | Show the exact payment state; never success without confirmation. |
| Success | Gateway-confirmed transaction |
| Failure | Decline; gateway outage; callback delay; duplicate risk |
| **v2 status** | Done (sandbox) (sprint S2–S3) |
| **v2 note** | `POST /donations`, signed verification, webhook, receipts. No real money moves |

### NU-FR-10: Physical Aid Contribution

| Field | Specification |
|---|---|
| Description | Register physical aid independently of incident reporting. |
| Input | Aid type, quantity, condition, location, contact |
| Internal processing | Registered → verification → allocation → delivery tracking. |
| Expected output | Contribution record and status |
| Application reaction | Show each stage separately; no delivery success without confirmation. |
| Success | Verified, allocated and delivery confirmed |
| Failure | Invalid or unavailable aid; no matching need; delivery failure |
| **v2 status** | **Backlog** |
| **v2 note** | DM-side handling of aid exists (DM-FR-13). There is no citizen form or API |

### NU-FR-11: Respond to Information Requests

| Field | Specification |
|---|---|
| Description | Answer a staff request for more information on an own report that is in the Needs Information state. |
| Input | Incident ID, additional description, evidence or corrected location |
| Internal processing | Verify ownership; append the response with actor and timestamp; return the incident to the review queue. |
| Expected output | Updated incident with a response entry |
| Application reaction | Show the request, the response and the resulting state change. |
| Success | Response recorded and the incident re-queued for review |
| Failure | Not the owner; incident already closed; response window expired |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `POST /me/incidents/{id}/information-response` |

### NU-FR-12: Withdraw or Update Own Report

| Field | Specification |
|---|---|
| Description | Correct or withdraw an own report before an operational action depends on it. |
| Input | Incident ID, correction or withdrawal reason |
| Internal processing | Verify ownership and current state; block withdrawal once dispatch has started; preserve the original values in history. |
| Expected output | Updated or Withdrawn incident |
| Application reaction | Show the new state and that staff have been informed; nothing is deleted. |
| Success | Change committed with an auditable history entry |
| Failure | Not the owner; state no longer permits change; concurrent staff update |
| **v2 status** | Partial (sprint S2) |
| **v2 note** | Withdrawal *request* (staff decide); location correction and photos through the information response. No free editing of the text |

### NU-FR-13: Browser Draft and Safe Retry (Optional)

| Field | Specification |
|---|---|
| Description | Save an unsent report draft in the browser and retry submission safely. |
| Input | Partially completed report |
| Internal processing | Store the draft locally; on retry use an idempotency key so no duplicate incident is created. |
| Expected output | Draft marked "Not yet sent" |
| Application reaction | Make clear that a draft is not a submitted report. |
| Success | Draft restored, or submitted exactly once |
| Failure | Local storage unavailable; draft expired; duplicate submission blocked |
| **v2 status** | Partial (sprint S1) |
| **v2 note** | Safe retry is done (idempotency key). Browser drafts are not built |

### NU-FR-14: Data Export and Deletion Request (Optional)

| Field | Specification |
|---|---|
| Description | Request an export or deletion of own personal data. |
| Input | Authenticated request and request type |
| Internal processing | Verify identity; queue for oversight under AM-FR-13; retain records required for audit or finance. |
| Expected output | Request state and outcome |
| Application reaction | Show what can and cannot be removed, and why. |
| Success | Request completed and recorded |
| Failure | Identity not verified; retention obligation prevents deletion; export generation failure |
| **v2 status** | Partial (sprint S3) |
| **v2 note** | Self-service account deletion (`POST /me/account/deletion`). Data export is not built |

### NU-FR-15: Flag Published or Shared Content (Optional)

| Field | Specification |
|---|---|
| Description | Report content that appears unsafe, abusive or incorrect. |
| Input | Content reference and reason |
| Internal processing | Rate-limit the flag; queue it for moderation under DM-FR-18 and AM-FR-12. |
| Expected output | Flag record |
| Application reaction | Confirm receipt without revealing moderation outcomes. |
| Success | Flag queued for review |
| Failure | Duplicate or abusive flagging; content already removed |
| **v2 status** | Backlog |

## 2. Disaster Management functional requirements

### DM-FR-01: Staff Login

| Field | Specification |
|---|---|
| Description | Authenticate authorised staff. |
| Input | Credentials and MFA |
| Internal processing | Authenticate; apply RBAC and the staff member's permissions; create a secure session. |
| Expected output | Operational session |
| Application reaction | Load the dashboard only after authentication. |
| Success | Authorised session with the correct permission set |
| Failure | Invalid or expired account; MFA failure; suspended account |
| **v2 status** | Done (sprint S0) |
| **v2 note** | 5 failures lock the account for 15 minutes; `token_version` revokes sessions |

### DM-FR-02: Incident Dashboard

| Field | Specification |
|---|---|
| Description | Consolidated incidents, priorities, maps, moderation queue and pending actions. |
| Input | Filters |
| Internal processing | Query and aggregate authorised data; refresh; surface overdue dispatches. |
| Expected output | Dashboard |
| Application reaction | Show status and last-updated time. |
| Success | Accurate current data |
| Failure | Stale data; query or integration failure |
| **v2 status** | Done (sprint S0–S1) |
| **v2 note** | `GET /dm/dashboard`, `/dm` |

### DM-FR-03: Review and Verification

| Field | Specification |
|---|---|
| Description | Review evidence and set the authorised verification state. |
| Input | Incident, evidence, decision, rationale |
| Internal processing | Inspect; save decision, actor and time; publish only an approved status. |
| Expected output | Verification state |
| Application reaction | Show the decision; notify the reporter where appropriate. |
| Success | Auditable decision saved |
| Failure | Insufficient evidence; concurrent update; unauthorised action |
| **v2 status** | Done (sprint S0–S1) |
| **v2 note** | `POST /dm/incidents/{id}/verification`, `/information-requests` |

### DM-FR-04: Duplicate Detection

| Field | Specification |
|---|---|
| Description | Surface likely duplicate reports without deleting them automatically. |
| Input | Text, location, time, evidence |
| Internal processing | Rules and AI similarity; present candidates; preserve originals. |
| Expected output | Duplicate candidates |
| Application reaction | Show matches and rationale; a human decides. |
| Success | Relationship recorded |
| Failure | False match; uncertain similarity; service outage |
| **v2 status** | Done (sprint S0, S3) |
| **v2 note** | Rules plus character-trigram text score (`"method": "rules+text"`). The weights are not yet tuned |

### DM-FR-05: AI Classification and Triage

| Field | Specification |
|---|---|
| Description | Suggest scenario, urgency factors and triage evidence. |
| Input | Report, evidence, location, context |
| Internal processing | AI inference with confidence and uncertainty; guardrails; store the recommendation separately from the human decision. A suggestion outside the three supported scenarios is flagged Out of Scope and staff triage it manually. |
| Expected output | Advisory recommendation |
| Application reaction | Label AI output clearly; the human accepts, modifies or rejects it. |
| Success | Human final decision recorded |
| Failure | Low confidence; missing data; model outage or unsafe output |
| **v2 status** | Done (rules baseline) (sprint S1–S2) |
| **v2 note** | `ai-workers /triage` behind `ai_provider` guardrails. A trained model is not deployed (section 8) |

### DM-FR-06: Prioritisation

| Field | Specification |
|---|---|
| Description | Assign operational priority using facts and approved guidance. |
| Input | Incident, indicators, AI advice |
| Internal processing | Rules plus human judgement; save the rationale. |
| Expected output | Priority |
| Application reaction | Update the queue, map and resource planning. |
| Success | Authorised priority saved |
| Failure | Insufficient or conflicting information |
| **v2 status** | Done (sprint S0) |
| **v2 note** | `PUT /dm/incidents/{id}/priority` |

### DM-FR-07: Mapping

| Field | Specification |
|---|---|
| Description | Map incidents, resources, routes and relevant areas. |
| Input | Geodata and layers |
| Internal processing | Validate coordinates; render map layers. |
| Expected output | Operational map |
| Application reaction | Show pins, status and data freshness. |
| Success | Map reflects authoritative data |
| Failure | Map outage; inaccurate location |
| **v2 status** | Done (sprint S1–S3) |
| **v2 note** | `/dm/live-map`, `GET /dm/map`, `/dm/map/layers` |

### DM-FR-08: Resource Coordination

| Field | Specification |
|---|---|
| Description | Track and assign teams, vehicles, supplies and support resources. |
| Input | Resource data and assignment |
| Internal processing | Check availability; reserve and assign; prevent conflicts. |
| Expected output | Resource assignment |
| Application reaction | Show availability and conflicts. |
| Success | Assignment committed |
| Failure | Unavailable, conflicting or stale resource |
| **v2 status** | Done (sprint S0–S2) |
| **v2 note** | `resources.reserve()` takes a `SELECT … FOR UPDATE` row lock |

### DM-FR-09: Dispatch

| Field | Specification |
|---|---|
| Description | Create and track an authorised emergency dispatch. |
| Input | Verified and prioritised incident plus a resource |
| Internal processing | Check prerequisites; create the order; transmit; await acknowledgement; start the configured timeout and escalation. |
| Expected output | Dispatch state |
| Application reaction | Show Requested / Acknowledged / Dispatched / Rejected / Escalated; never a false success. |
| Success | Receiving confirmation recorded |
| Failure | No resource; rejection; transmission outage; cancellation; timeout |
| **v2 status** | Done (sprint S0–S2) |
| **v2 note** | `DISPATCH_TRANSITIONS`; `escalate_overdue()` runs every 60 s |

### DM-FR-10: Inter-Agency Communication

| Field | Specification |
|---|---|
| Description | Share authorised coordination messages with external agency contacts. Agencies hold no accounts. |
| Input | Message, recipients, context |
| Internal processing | Check authority; route through the messaging or dispatch integration; log delivery. Staff record the agency's acknowledgement or rejection, or a trusted integration reports it, with the timestamp and the recorder stored. |
| Expected output | Message and acknowledgement state |
| Application reaction | Show sent / acknowledged / rejected / failed, and who recorded it. |
| Success | Message accepted, and any acknowledgement attributed to its recorder |
| Failure | Unauthorised recipient; provider failure; no acknowledgement received |
| **v2 status** | Partial (sprint S0) |
| **v2 note** | Messages and their status events are recorded by staff. Nothing is actually sent to the agency |

### DM-FR-11: Verified Public Updates

| Field | Specification |
|---|---|
| Description | Publish authoritative public updates. Requires the Publisher/Approver permission within Disaster Management. |
| Input | Approved text, status, area |
| Internal processing | Validate the publishing permission; version; publish; audit. |
| Expected output | Verified update |
| Application reaction | Timestamped update with an optional notification. |
| Success | Visible through an approved channel |
| Failure | Missing publishing permission; invalid content; notification failure |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `/dm/public-updates` |

### DM-FR-12: Donation and Aid Oversight

| Field | Specification |
|---|---|
| Description | Monitor confirmed money and verified aid. |
| Input | Contribution, campaign and need data |
| Internal processing | Aggregate confirmed and verified states; maintain traceability. |
| Expected output | Oversight view |
| Application reaction | Distinguish pending, confirmed and verified clearly. |
| Success | Reconciled view |
| Failure | Gateway delay; inconsistency |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `/dm/oversight/donations`, `/dm/oversight/aid` |

### DM-FR-13: Aid Allocation

| Field | Specification |
|---|---|
| Description | Allocate verified aid to an approved need and track delivery. Needs come from DM-FR-19 where adopted, otherwise they are entered directly by staff here. |
| Input | Verified aid and a need |
| Internal processing | Check compatibility and quantity; reserve; create a delivery task. |
| Expected output | Allocation and delivery state |
| Application reaction | Show Allocated / In Transit / Delivered / Failed. |
| Success | Delivery confirmed |
| Failure | No match; insufficient quantity; delivery failure |
| **v2 status** | Partial (sprint S0–S2) |
| **v2 note** | The DM workflow is built. It has no citizen intake (NU-FR-10) |

### DM-FR-14: Analytics

| Field | Specification |
|---|---|
| Description | Provide operational and contribution analytics. |
| Input | Filters: time, scenario, region |
| Internal processing | Aggregate authorised data; distinguish unknown and pending; count Out of Scope records separately. |
| Expected output | Charts and tables |
| Application reaction | Show definitions and data freshness. |
| Success | Consistent analytics |
| Failure | Incomplete data; query failure |
| **v2 status** | Done (sprint S2–S3) |
| **v2 note** | `/dm/analytics`, including AI-versus-human agreement and CSV export |

### DM-FR-15: Incident Closure

| Field | Specification |
|---|---|
| Description | Close an incident with a recorded reason. Requires the closure permission. |
| Input | Incident, closure reason, optional public summary |
| Internal processing | Check that no dispatch or allocation is still open, or require an explicit override with rationale; set Closed; freeze further edits; keep the record readable. |
| Expected output | Closed incident with reason |
| Application reaction | Show the closure reason and time to staff and to the reporter. |
| Success | Closed with an auditable reason |
| Failure | Open dependent actions; missing permission; missing reason |
| **v2 status** | Done (sprint S0) |
| **v2 note** | CLOSURE permission |

### DM-FR-16: Campaign Management

| Field | Specification |
|---|---|
| Description | Create and manage approved donation purposes and campaigns. |
| Input | Campaign name, purpose, scenario, period, target |
| Internal processing | Validate; the campaign scenario field accepts only the three supported scenarios; version; activate or close; audit. |
| Expected output | Active or closed campaign |
| Application reaction | Show only active, approved campaigns as donation purposes. |
| Success | Campaign active and selectable |
| Failure | Invalid scenario; duplicate campaign; closed campaign still referenced |
| **v2 status** | Done (sprint S1–S2) |
| **v2 note** | `/dm/campaigns` |

### DM-FR-17: Safety Content Authoring and Approval

| Field | Specification |
|---|---|
| Description | Author, version and approve safety guidance, versioned per scenario. |
| Input | Draft content, scenario, source |
| Internal processing | Draft → review → approval by a holder of the Publisher/Approver permission → publish; keep every version. |
| Expected output | Approved, versioned content |
| Application reaction | Only approved versions are shown under NU-FR-08. |
| Success | Approved version published and attributable |
| Failure | Unapproved draft; missing permission; superseded version still served |
| **v2 status** | Done (sprint S2–S3) |
| **v2 note** | Draft → Approved → Published → Superseded |

### DM-FR-18: Evidence and Content Moderation

| Field | Specification |
|---|---|
| Description | Review uploaded evidence and user text before it is shown beyond the reviewing staff. |
| Input | Evidence item, flag, moderation decision |
| Internal processing | Apply the moderation policy configured in AM-FR-12; set Approved, Quarantined or Removed; record actor, time and reason. |
| Expected output | Moderation state |
| Application reaction | Quarantined content is never rendered publicly; staff see a placeholder with the reason. |
| Success | Decision recorded and enforced |
| Failure | Backlog beyond the configured threshold; unsafe content detected; unauthorised moderation attempt |
| **v2 status** | Done (sprint S3) |
| **v2 note** | `/dm/moderation/queue` (MODERATOR permission) |

### DM-FR-19: Needs Management (Optional)

| Field | Specification |
|---|---|
| Description | Record, prioritise and close operational needs that aid can be allocated against. |
| Input | Need type, quantity, location, priority, linked incident |
| Internal processing | Validate; deduplicate; track fulfilled quantity against the requirement. |
| Expected output | Need record and fulfilment state |
| Application reaction | Show open, partially met and met needs. |
| Success | Need recorded and traceable to allocations |
| Failure | Duplicate need; over-allocation; stale need |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `/dm/needs` |

### DM-FR-20: Agency Directory (Optional)

| Field | Specification |
|---|---|
| Description | Maintain a directory of external agency contacts and assign them to incidents. No accounts are created and no login is granted. |
| Input | Agency name, contact channel, coverage area, assignment |
| Internal processing | Validate the contact; link to incidents; use the directory as the recipient list for DM-FR-10. |
| Expected output | Agency contact records and assignments |
| Application reaction | Show which contacts are assigned to an incident and through which channel. |
| Success | Contact assigned and usable as a dispatch recipient |
| Failure | Invalid contact; unreachable channel; duplicate entry |
| **v2 status** | Done (sprint S3) |
| **v2 note** | `/dm/agencies` |

## 3. Application Management functional requirements

### AM-FR-01: Administrator Login

| Field | Specification |
|---|---|
| Description | Authenticate administrators. |
| Input | Admin credentials and MFA |
| Internal processing | Authenticate; apply RBAC; create a secure session. |
| Expected output | Admin session |
| Application reaction | Load the console only after authentication. |
| Success | Authorised session |
| Failure | Invalid or disabled account; MFA failure |
| **v2 status** | Done (sprint S0) |
| **v2 note** | Same mechanism as DM-FR-01 |

### AM-FR-02: Account and Role Management

| Field | Specification |
|---|---|
| Description | Manage accounts and permissions. Only three roles exist: Normal User, Disaster Management and Application Management. Staff and admin accounts are created only here; public sign-up creates Normal Users only. Publisher/Approver, moderator, closer and supervisor are granted as permissions inside Disaster Management. |
| Input | Account or role request, permission grant, suspension or reactivation |
| Internal processing | Validate authority; apply RBAC; reject any role outside the three; prevent self-escalation; prevent removal of the last active administrator; audit before and after. |
| Expected output | Account, role and permission state |
| Application reaction | Show the effective role, the granted permissions and the audit result. |
| Success | Committed change |
| Failure | Insufficient privilege; invalid role; self-escalation attempt; last-admin protection triggered |
| **v2 status** | Done (sprint S0–S3) |
| **v2 note** | `/admin/accounts/*`, invitations, bulk actions, credential reset |

### AM-FR-03: Configuration Management

| Field | Specification |
|---|---|
| Description | Manage approved scenario, notification and operational settings. |
| Input | Configuration change |
| Internal processing | Validate the schema; version; apply; audit before and after. The scenario setting can only enable or disable the three supported scenarios; it cannot add a fourth. Also covers the dispatch timeout and escalation values and the duplicate-detection switch. |
| Expected output | Active configuration version |
| Application reaction | Show the effective configuration and its history. |
| Success | Valid configuration active |
| Failure | Invalid or unsafe change; attempt to add a scenario or role; service failure |
| **v2 status** | Partial |
| **v2 note** | Environment variables registered in `env-variables.md`. There is no admin screen and no versioned rollback |

### AM-FR-04: System Monitoring

| Field | Specification |
|---|---|
| Description | Monitor services, queues, storage and integrations, including the moderation backlog and the agency/dispatch integration. |
| Input | Telemetry and events |
| Internal processing | Collect metrics and logs; evaluate health; raise alerts. |
| Expected output | Health dashboard |
| Application reaction | Show the current or last-known state and open incidents. |
| Success | Accurate telemetry |
| Failure | Monitoring blind spot or outage |
| **v2 status** | Partial (sprint S2–S3) |
| **v2 note** | `/admin/system`, `/api/v1/health`, ingestion health. No alerting |

### AM-FR-05: Logging and Audit

| Field | Specification |
|---|---|
| Description | Maintain security and operational audit records, including moderation decisions, closures and staff-recorded agency acknowledgements. |
| Input | Events |
| Internal processing | Normalise; timestamp; protect integrity; retain per policy. |
| Expected output | Audit log |
| Application reaction | Search and filter under access controls. |
| Success | Retrievable, protected log |
| Failure | Logging outage; integrity failure |
| **v2 status** | Done (sprint S0, S3) |
| **v2 note** | `/admin/audit`, `POST /admin/audit/verify`, CLI `verify-audit` |

### AM-FR-06: Data Management

| Field | Specification |
|---|---|
| Description | Control validation, correction, lifecycle and retention. |
| Input | Data-quality or correction task |
| Internal processing | Validate authority; preserve traceability; apply controlled change. |
| Expected output | Data state |
| Application reaction | Show the operation result and affected records. |
| Success | Controlled change complete |
| Failure | Integrity conflict; unauthorised bulk change |
| **v2 status** | Partial (sprint S3) |
| **v2 note** | Exports and account deletion. No retention schedules |

### AM-FR-07: Security Management

| Field | Specification |
|---|---|
| Description | Manage security controls, secrets and incidents. |
| Input | Security configuration or event |
| Internal processing | Apply policy; protect and rotate secrets; monitor and respond. |
| Expected output | Security state |
| Application reaction | Show actionable alerts; audit every change. |
| Success | Control applied and logged |
| Failure | Misconfiguration; secret failure |
| **v2 status** | Partial (sprint S0–S3) |
| **v2 note** | Secrets live only in the hosting consoles; CI scans; "sign out everywhere". No screen for security incidents |

### AM-FR-08: Backup and Recovery

| Field | Specification |
|---|---|
| Description | Create, validate and restore backups. |
| Input | Backup or restore request |
| Internal processing | Protected backup; integrity check; safe restore. |
| Expected output | Backup and recovery state |
| Application reaction | Show backup age, status and restore verification. |
| Success | Restored data verified |
| Failure | Corrupt backup; storage failure; restore conflict |
| **v2 status** | Partial (sprint S3) |
| **v2 note** | `scripts/db_backup.py` and Neon branches. The production restore drill is open |

### AM-FR-09: Notification Configuration

| Field | Specification |
|---|---|
| Description | Configure channels, templates, routing and retry, including the in-app fallback channel. |
| Input | Notification configuration |
| Internal processing | Validate, version, test and activate. |
| Expected output | Active notification configuration |
| Application reaction | Preview and test, with the version shown. |
| Success | Valid active configuration |
| Failure | Provider or template incompatibility |
| **v2 status** | Backlog |
| **v2 note** | Fixed: in-app plus email |

### AM-FR-10: Payment Integration Monitoring

| Field | Specification |
|---|---|
| Description | Monitor the gateway, callbacks and reconciliation. |
| Input | Gateway health and callbacks |
| Internal processing | Verify callbacks; reconcile; flag timeouts and mismatches. |
| Expected output | Integration health and exceptions |
| Application reaction | Show Pending, Confirmed, Failed and mismatches distinctly. |
| Success | Transactions reconciled or safely held |
| Failure | Gateway outage; invalid callback; mismatch |
| **v2 status** | Partial (sprint S3) |
| **v2 note** | Webhook event log, audit, DM oversight. No admin reconciliation screen |

### AM-FR-11: Abuse and Rate-Limit Controls

| Field | Specification |
|---|---|
| Description | Protect public endpoints against spam, bulk automation and abusive submissions. |
| Input | Request patterns, thresholds, block and allow lists |
| Internal processing | Apply per-account, per-IP and per-endpoint limits to sign-up, login, reporting, uploads, flags and donations; throttle, challenge or block; log every action. |
| Expected output | Limit decision and abuse record |
| Application reaction | Explain that a limit was reached without revealing the thresholds; never silently discard a legitimate report. |
| Success | Abuse contained with the legitimate path preserved |
| Failure | Limits too strict and blocking real reports; distributed abuse below the threshold; control service outage |
| **v2 status** | Partial (sprint S1–S3) |
| **v2 note** | Per-endpoint, per-IP limits fixed in code and kept in process memory. No block or allow lists |

### AM-FR-12: Moderation Configuration

| Field | Specification |
|---|---|
| Description | Configure the moderation policy that DM-FR-18 enforces. |
| Input | Allowed file types, scan settings, auto-quarantine rules, backlog thresholds |
| Internal processing | Validate; version; apply; audit; alert when the backlog exceeds its threshold. |
| Expected output | Active moderation policy |
| Application reaction | Show the effective policy and its version to moderators. |
| Success | Policy active and enforced |
| Failure | Unsafe policy; scanner unavailable; backlog threshold breached |
| **v2 status** | Backlog |
| **v2 note** | Allowed types and sizes are constants in code |

### AM-FR-13: Data-Request Oversight (Optional)

| Field | Specification |
|---|---|
| Description | Oversee export and deletion requests raised under NU-FR-14. |
| Input | Request queue and retention rules |
| Internal processing | Verify identity checks; apply retention and legal holds; execute or refuse with a recorded reason. |
| Expected output | Request outcome |
| Application reaction | Show what was exported, removed or retained, and why. |
| Success | Request resolved and auditable |
| Failure | Retention conflict; incomplete export; unverified requester |
| **v2 status** | Backlog |

### AM-FR-14: Configuration Approval (Optional)

| Field | Specification |
|---|---|
| Description | Require a second approver for critical configuration and role changes. |
| Input | Proposed change and approver decision |
| Internal processing | Hold the change pending; require a different administrator to approve; apply only after approval; audit both actors. |
| Expected output | Approved or rejected change |
| Application reaction | Show pending changes and who must approve them. |
| Success | Critical change applied with two recorded approvers |
| Failure | Only one administrator available; approval timeout; self-approval attempt |
| **v2 status** | Backlog |

## 4. Functional requirements added after mid-evaluation

### NU-FR-16: Public map and public information

| Field | Specification |
|---|---|
| Description | View verified incidents, active alerts, open shelters, published updates and active campaigns on a Gujarat map without signing in. |
| Input | Optional bounding box, district or scenario filter |
| Internal processing | Return only VERIFIED, DISPATCHED or RESOLVED incidents that are not simulated; drop reporter fields; round coordinates to 4 decimal places. |
| Expected output | Public incident, alert, shelter, update and campaign lists |
| Application reaction | Draw markers and layers; show sample or fallback data with a label. |
| Success | Map shows verified information without personal data |
| Failure | Map tiles unavailable (list view remains); backend asleep (retry message) |
| **v2 status** | Done (sprint S1–S3) |
| **v2 note** | `GET /public/incidents`, `/alerts`, `/shelters`, `/campaigns`, `/updates`. Coordinates rounded to 4 decimal places |

### NU-FR-17: Multilingual citizen interface

| Field | Specification |
|---|---|
| Description | Use the citizen screens in English, Hindi or Gujarati. |
| Input | Language choice |
| Internal processing | Load the string table for the chosen language; keep scenario values and API data unchanged. |
| Expected output | Translated citizen screens |
| Application reaction | Remember the choice on the device. |
| Success | Screens shown in the chosen language |
| Failure | Missing translation falls back to English |
| **v2 status** | Done (sprint S3) |
| **v2 note** | `LanguageSelector`, `lib/citizenI18n.ts` |

### DM-FR-21: External signal review and promotion

| Field | Specification |
|---|---|
| Description | Review signals ingested from external sources; promote a genuine one to an incident or dismiss it; see related signals. |
| Input | Signal, decision, optional scenario override, reason |
| Internal processing | Require PUBLISHER or SUPERVISOR; require coordinates for promotion; create a SUBMITTED incident attributed to the ingestion system user; mark the signal PROMOTED or DISMISSED; audit. |
| Expected output | New incident or dismissed signal |
| Application reaction | Show the source, language, simulated flag and related-signal group. |
| Success | Decision recorded and, on promotion, incident created |
| Failure | Signal already handled (409); no location (422) |
| **v2 status** | Done (sprint S2–S3) |
| **v2 note** | `/dm/signals`, `/signals/{id}/promote` (PUBLISHER or SUPERVISOR), `/signals/related` |

### DM-FR-22: Team recommendations

| Field | Specification |
|---|---|
| Description | See ranked response teams for an incident, with reasons. Recommendations never create a dispatch. |
| Input | Incident |
| Internal processing | Find available TEAM resources; score capability match and PostGIS distance; rank. |
| Expected output | Ranked list with distance, matched capabilities and reasons |
| Application reaction | Show the list next to the dispatch form. |
| Success | Dispatcher chooses a team with the reasons visible |
| Failure | No available team (empty list with reason) |
| **v2 status** | Done (sprint S1–S2) |
| **v2 note** | `GET /dm/incidents/{id}/team-recommendations` |

### DM-FR-23: Team-request decisions

| Field | Specification |
|---|---|
| Description | Approve or decline backup requests raised by field teams. |
| Input | Request, decision, rationale |
| Internal processing | Require DISPATCH; record decision, rationale and decider; notify the field team; audit. |
| Expected output | Request APPROVED or DECLINED |
| Application reaction | Remove it from the open queue. |
| Success | Decision recorded and communicated |
| Failure | Request already decided (409) |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `POST /dm/team-requests/{id}/decision` (DISPATCH) |

### DM-FR-24: Shelters

| Field | Specification |
|---|---|
| Description | Maintain shelters, relief camps and medical posts with capacity and status. |
| Input | Name, type, location, capacity, occupancy, status |
| Internal processing | Validate occupancy ≤ capacity and location; audit changes. |
| Expected output | Shelter record |
| Application reaction | Open shelters appear on the public map. |
| Success | Shelter saved and published when operational |
| Failure | Occupancy above capacity; invalid location |
| **v2 status** | Done (sprint S3) |
| **v2 note** | `/dm/shelters`; open ones appear on the public map |

### DM-FR-25: Internal incident notes

| Field | Specification |
|---|---|
| Description | Add internal notes to an incident for hand-over between staff. |
| Input | Incident, note text (1–1000 characters) |
| Internal processing | Store with author and time; never expose to the reporter or public. |
| Expected output | Note in the incident's staff timeline |
| Application reaction | Show newest first. |
| Success | Note saved |
| Failure | Rate limit reached; empty note |
| **v2 status** | Done (sprint S3) |
| **v2 note** | `/dm/incidents/{id}/notes` |

### DM-FR-26: CSV exports

| Field | Specification |
|---|---|
| Description | Export the incident and dispatch queues as CSV. |
| Input | Current filters |
| Internal processing | Apply filters; write CSV without reporter contact data; rate-limit to 10 per hour. |
| Expected output | CSV file |
| Application reaction | Download starts. |
| Success | File downloaded |
| Failure | Rate limit reached (429) |
| **v2 status** | Done (sprint S3) |
| **v2 note** | `/dm/incidents/export`, `/dm/dispatches/export` (rate-limited) |

### DM-FR-27: Ingestion health and on-demand poll

| Field | Specification |
|---|---|
| Description | See the last run of each source and trigger a poll. |
| Input | Poll request |
| Internal processing | Take the run lock; run enabled adapters; record each run. |
| Expected output | Run results per source |
| Application reaction | Show status, counts and errors per source. |
| Success | Fresh run recorded |
| Failure | Another run active (SKIPPED); source failure (FAILED run) |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `/dm/ingestion/health`, `/poll` |

### DM-FR-28: Photo analysis (advisory)

| Field | Specification |
|---|---|
| Description | Ask the image classifier for an advisory reading of a scene photo. |
| Input | One JPEG, PNG or WebP image up to 10 MB |
| Internal processing | Check the real file type; send to AI_IMAGE_SERVICE_URL; map classes to the three scenarios or out of scope; audit; never store as verification. |
| Expected output | Suggested class, confidence, scenario mapping |
| Application reaction | Show as advice in the AI panel. |
| Success | Advice shown |
| Failure | Service not configured (503 AI_PHOTO_UNAVAILABLE); unsupported file |
| **v2 status** | Partial (sprint S3) |
| **v2 note** | The endpoint exists. It answers `503 AI_PHOTO_UNAVAILABLE` until the service is configured |

### AM-FR-15: Account invitations

| Field | Specification |
|---|---|
| Description | Invite staff and field responders by email; the invitee sets a password and enrols TOTP. |
| Input | Name, email, role, team (field accounts) |
| Internal processing | Require APP_MGMT or DM SUPERVISOR with MFA; create a pending account; send a single-use expiring link; audit. |
| Expected output | Pending account and invitation |
| Application reaction | List open invitations; allow resend or revoke. |
| Success | Invitee completes set-up and signs in with MFA |
| Failure | Duplicate email (409); expired link (resend) |
| **v2 status** | Done (sprint S1–S3) |
| **v2 note** | `/auth/invitations`, `/setup-account` |

### AM-FR-16: Session control

| Field | Specification |
|---|---|
| Description | Refresh sessions safely and sign a user out of every session. |
| Input | Refresh token, or user and reason |
| Internal processing | Rotate refresh tokens within a family; apply per-role idle and absolute expiry; revoke the family and bump token_version on sign-out everywhere; audit. |
| Expected output | New session, or all sessions revoked |
| Application reaction | The next request of a revoked session is denied. |
| Success | Session continues or is ended everywhere |
| Failure | Reused or expired token (family revoked) |
| **v2 status** | Done (sprint S3) |
| **v2 note** | `services/sessions.py`, `refresh_tokens` |

### FT-FR-01: Field sign-in and own assignments

| Field | Specification |
|---|---|
| Description | Sign in with an invited account and MFA; see only the dispatches of my own team. |
| Input | Credentials, TOTP |
| Internal processing | Load the field principal with its team resources; filter dispatches by team. |
| Expected output | Assignment list |
| Application reaction | Show active assignments first. |
| Success | Only own team's dispatches visible |
| Failure | Another team's dispatch (404) |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `require_field`, `FieldPrincipal`, `GET /field/assignments` |

### FT-FR-02: Acknowledge or reject a dispatch

| Field | Specification |
|---|---|
| Description | Acknowledge a dispatch or reject it with a reason. |
| Input | Dispatch, decision, reason |
| Internal processing | Run the shared dispatch transition under a row lock; on rejection release resources; audit; notify the dispatcher. |
| Expected output | ACKNOWLEDGED or REJECTED dispatch |
| Application reaction | Update the assignment card. |
| Success | State changed and recorded |
| Failure | Dispatch not in REQUESTED (409, audited) |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `/field/dispatches/{id}/acknowledgement`, `/rejection` |

### FT-FR-03: Report progress

| Field | Specification |
|---|---|
| Description | Report EN_ROUTE, ON_SCENE, DELAYED or an update. |
| Input | Dispatch, status, note |
| Internal processing | EN_ROUTE moves ACKNOWLEDGED to DISPATCHED; store a dispatch_progress row; audit. |
| Expected output | Progress entry |
| Application reaction | Show it on the incident timeline. |
| Success | Progress recorded |
| Failure | Dispatch not acknowledged (409) |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `/field/dispatches/{id}/progress` |

### FT-FR-04: Request backup

| Field | Specification |
|---|---|
| Description | Request another team with a required capability. |
| Input | Dispatch, capability, note |
| Internal processing | Create an OPEN team request; notify dispatchers. |
| Expected output | Team request |
| Application reaction | Show its status until decided. |
| Success | Request queued for a decision |
| Failure | Dispatch finished (409) |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `/field/dispatches/{id}/team-requests` |

### FT-FR-05: Complete a dispatch

| Field | Specification |
|---|---|
| Description | Mark a dispatch as completed. |
| Input | Dispatch |
| Internal processing | Move to COMPLETED; release all resource assignments; notify the dispatcher; audit. |
| Expected output | Completed dispatch |
| Application reaction | Remove it from active assignments. |
| Success | Dispatch completed and resources free |
| Failure | Dispatch not in DISPATCHED (409) |
| **v2 status** | Done (sprint S2) |
| **v2 note** | `/field/dispatches/{id}/completion` |

## 5. Non-functional requirements

The explanation, importance and test method are from the original SRS; numeric targets there were "proposed until approved". The v2 status and the measured values are in Part A §4.

### 5.1 Citizen

| ID | Name | Explanation | Importance | How it is tested | v2 status |
|---|---|---|---|---|---|
| NU-NFR-01 | Usability | Forms and status flows should be clear, consistent and easy to learn. The three supported scenarios are described clearly on the report form, so a user can tell at once whether their situation fits. | High | Scenario-based task tests and usability review. | Done |
| NU-NFR-02 | Accessibility | Keyboard access, readable contrast, labels, focus order and accessible status messages are supported across the website. | High | Accessibility audit and assistive-technology tests. | Partial: no formal WCAG audit |
| NU-NFR-03 | Performance | Common user actions provide timely feedback; numerical targets are proposed only after workload analysis. | High | Load and response-time tests against approved targets. | Done |
| NU-NFR-04 | Availability | Core functions remain usable during normal service periods, with graceful degradation when a dependency fails. | High | Availability and dependency-outage tests. | Partial: free-tier hosting |
| NU-NFR-05 | Privacy | Profile, location, evidence and contact data are restricted to authorised Disaster Management staff only. Agencies receive only what staff choose to share in dispatch messages. (If NU-FR-14 is adopted, users may also request an export or deletion.) | Critical | RBAC and privacy tests, plus penetration testing. | Done |
| NU-NFR-06 | Compatibility | Supported modern browsers and desktop and mobile form factors are documented and tested. | Medium | Compatibility matrix. | Partial |
| NU-NFR-07 | Payment security | Sensitive payment credentials are handled by secure gateway mechanisms; any application storage follows the approved design. | Critical | Security review, gateway tests and penetration testing. | Done |
| NU-NFR-08 | Transaction reliability | Retries, callbacks, timeouts and duplicate attempts preserve the correct donation state. | Critical | Fault injection, idempotency and reconciliation tests. | Done |
| NU-NFR-09 | Transparency | Users can distinguish submitted, moderated, verified, pending, confirmed, closed and out-of-scope states. | High | State-transition and UI tests. | Done |
| NU-NFR-10 | Donor privacy | Donor identity and visibility follow approved privacy rules and least privilege. | High | Privacy and access tests. | Done |
| NU-NFR-11 | Timeliness | Incident acknowledgements and updates are designed for rapid feedback; targets require approval. | High | End-to-end timing tests. | Done |
| NU-NFR-12 | Abuse resistance | Spam and automated submissions are contained without blocking genuine emergency reporting (AM-FR-11). | Critical | Rate-limit, bot-simulation and false-positive tests. | Partial (in-process limiter) |
| NU-NFR-13 | Content safety | User text and uploaded files are never rendered unsafely; evidence is moderated before wider visibility (pairs with DM-FR-18). | Critical | Injection and upload-safety tests; moderation workflow tests. | Done |
| NU-NFR-14 | Offline draft | An unsent report draft is saved in the browser and shown in a clear "Not yet sent" state. | Medium | Browser-storage and retry tests. | Backlog |
| NU-NFR-15 | Data retention and user rights | Users can request an export or deletion of their data within retention limits. Depends on NU-FR-14. | High | Data-request workflow and retention tests. | Partial |

### 5.2 Disaster Management

| ID | Name | Explanation | Importance | How it is tested | v2 status |
|---|---|---|---|---|---|
| DM-NFR-01 | Usability | Dashboards minimise cognitive load and foreground urgent and pending actions, including the moderation queue and overdue dispatches. | High | Expert review and task tests. | Done |
| DM-NFR-02 | Accessibility | Operational screens meet the selected accessibility baseline where applicable. | Medium | Accessibility audit. | Partial: no formal WCAG audit |
| DM-NFR-03 | Performance | Search, dashboard and map operations remain responsive under approved operational load. | High | Load and stress tests. | Done |
| DM-NFR-04 | Availability | Core operations degrade safely when non-critical integrations fail. | Critical | Dependency outage and failover tests. | Partial: free-tier hosting |
| DM-NFR-05 | Role-based access | Only authorised staff can moderate, verify, prioritise, dispatch, publish, close or access restricted data. Only three roles exist. Publisher/Approver, closure, moderation and supervisor are separate permissions inside Disaster Management. No self-escalation. | Critical | RBAC matrix and penetration tests. | Done |
| DM-NFR-06 | Auditability | Critical decisions, including closures and moderation outcomes, are attributable to a human operator with time and rationale where required. | Critical | Audit completeness and integrity tests. | Done |
| DM-NFR-07 | Interoperability | Dispatch, map and notification integrations use documented interfaces and state mappings. Agency acknowledge, reject and progress states, whether staff-recorded or reported by a trusted integration, map to internal dispatch states. | High | API contract and integration tests. | Done |
| DM-NFR-08 | Resilience | Loss of AI, map, notification or agency services must not corrupt records or falsely advance state. | Critical | Chaos and fault-injection tests. | Done |
| DM-NFR-09 | AI explainability | Recommendations show understandable factors, uncertainty and version metadata where feasible. A suggestion outside the three scenarios is flagged Out of Scope. | Critical | Explainability review against representative cases. | Done |
| DM-NFR-10 | Human oversight | Critical decisions cannot be finalised solely by AI. | Critical | Workflow enforcement and negative tests. | Done |
| DM-NFR-11 | Data integrity | Concurrent updates preserve incident, dispatch, resource and aid consistency. Metrics identify definitions, freshness and the treatment of pending and unknown records. Analytics cover only the three scenarios; out-of-scope and unknown records are counted separately. An unacknowledged dispatch reaches a configured timeout and escalates to a staff member holding the supervisor permission, rather than waiting indefinitely (DM-FR-09, AM-FR-03). Staff can triage flagged and rate-limited submissions, and the moderation backlog stays within its configured threshold (DM-FR-18, AM-FR-11, AM-FR-12). Only approved, versioned content is published publicly, and every published item is attributable to its author and approver (DM-FR-11, DM-FR-17). | Critical | Concurrency and transaction tests. | Done |
| DM-NFR-12 | Analytics transparency | Metrics identify definitions, freshness and the treatment of pending and unknown records. Analytics cover only the three scenarios; out-of-scope and unknown records are counted separately. | High | Metric reconciliation tests. | Done |
| DM-NFR-13 | Dispatch timeliness and escalation | An unacknowledged dispatch reaches a configured timeout and escalates to a staff member holding the supervisor permission, rather than waiting indefinitely (DM-FR-09, AM-FR-03). | Critical | Timeout, escalation and notification tests. | Done |
| DM-NFR-14 | Abuse and moderation handling | Staff can triage flagged and rate-limited submissions, and the moderation backlog stays within its configured threshold (DM-FR-18, AM-FR-11, AM-FR-12). | High | Queue-load, backlog-alert and moderation workflow tests. | Partial (no backlog threshold alert) |
| DM-NFR-15 | Content authority | Only approved, versioned content is published publicly, and every published item is attributable to its author and approver (DM-FR-11, DM-FR-17). | Critical | Publishing permission and version-integrity tests. | Done |
| DM-NFR-16 | Operational continuity | Documented manual fallbacks let staff continue verification, dispatch recording and closure during an extended integration outage. | High | Tabletop exercise and degraded-mode drills. | Backlog |

### 5.3 Application Management

| ID | Name | Explanation | Importance | How it is tested | v2 status |
|---|---|---|---|---|---|
| AM-NFR-01 | Maintainability | Services and configuration are modular, documented and testable. The configuration surface covers scenarios (enable/disable only), notification settings, timeouts, escalation, duplicate detection, abuse thresholds and moderation policy. | High | Architecture, code and change-impact review. | Done |
| AM-NFR-02 | Scalability | Growth in users, incidents, evidence and contributions is supported without redesigning core workflows. | High | Capacity and load tests using approved assumptions. | Partial |
| AM-NFR-03 | Monitoring | Critical services and integrations emit actionable telemetry and alerts, including the moderation backlog and the agency/dispatch integration. | Critical | Monitoring coverage and alert simulations. | Partial |
| AM-NFR-04 | Data integrity | Administrative changes use validation, controlled transactions and audit records. | Critical | Mutation and rollback tests. | Done |
| AM-NFR-05 | Backup and recovery | Backups are protected, verifiable and restorable under an approved recovery plan. | Critical | Restore drills and integrity tests. | Partial (drill pending) |
| AM-NFR-06 | Security | Admin interfaces use strong authentication, least privilege, secure sessions and protected secrets. Staff and admin accounts require MFA. Only three roles exist. The role list and the scenario list are fixed, and adding to either needs a formal change. Critical changes need a second approver (AM-FR-14, if adopted). | Critical | Security tests, secret scanning and penetration testing. | Done |
| AM-NFR-07 | Payment integration monitoring | Gateway health, callback authenticity, reconciliation mismatches and pending transactions are observable. | Critical | Outage, callback and reconciliation simulations. | Partial |
| AM-NFR-08 | Notification reliability | Failed notifications retry safely and remain visible without duplicate spam, with the in-app status as the fallback source of truth. (Opt-out handling applies only if NU-FR-07 keeps it.) | High | Provider-outage and duplicate-prevention tests. | Done |
| AM-NFR-09 | Auditability | Admin, security and configuration actions are retained and protected from unauthorised alteration, including staff-recorded agency acknowledgements. | Critical | Audit access and integrity tests. | Done |
| AM-NFR-10 | Compatibility and interoperability | Supported platform and external interface versions are documented, including the terms of any agency messaging or dispatch integration contract. | Medium | Compatibility and contract tests. | Partial |
| AM-NFR-11 | Compliance | Deployment follows applicable data-protection, payment, accessibility, retention and security obligations. | Critical | Compliance evidence checklist and review. | Done |
| AM-NFR-12 | Resilience | Component failure triggers safe degradation, recovery or operator escalation rather than silent data loss. | Critical | Failure-injection and recovery tests. | Done |
| AM-NFR-13 | Abuse resistance | Rate limits and abuse controls hold under load without suppressing genuine emergency traffic. Depends on AM-FR-11. | Critical | Attack simulation and false-positive measurement. | Partial (in-process limiter) |
| AM-NFR-14 | Configuration governance | Scenario, role, timeout and moderation settings are versioned, attributable and reversible. Depends on AM-FR-03 and, if adopted, AM-FR-14. | Critical | Configuration audit, rollback and approval tests. | Backlog |
| AM-NFR-15 | Traceability | Every FR and NFR traces to a design component and at least one test case. | High | Traceability matrix review. | Partial |
| AM-NFR-16 | Data lifecycle | Retention, archival and deletion schedules are defined per data class and enforced. Depends on AM-FR-13. | High | Retention-policy and deletion-job tests. | Partial |
