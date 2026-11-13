<<<<<<< HEAD
# Gujarat Disaster Management Platform (ResQ) — Demo Script

**Document Version:** 1.0.0  
**Author:** Dhruv (QA & Test Lead)  
**Target Audience / Presenter:** Siddh (DevOps & Deployment Lead)  
**Platform Target:** Review & Stakeholder Demonstration  
**Applicable Environments:** Local Docker Compose / Render Staging  
=======
# ResQ — Final Demo Script (Sprint 3)

**Version:** 2.0 (replaces the Sprint 2 script) · **Owner:** Siddh (S2-15, S3-15) · **Draft from the scenario test:** Dhruv
**Environment:** Render staging backend + Vercel frontend (fallback: `docker-compose.prod.yml`, see [release-runbook.md](release-runbook.md))

The demo follows one cyclone incident from a citizen report to closure, with the ingestion, AI,
field and donation parts played by the people who built them. Every step names the screen, the API
call behind it and what the audience should see. The automated version of the same path is
`frontend/e2e/cyclone.spec.ts`; `scripts/smoke.py` checks the citizen → verify → public part after every deploy.

**Rules the demo must show, not just state**

* AI output is advisory. It never verifies, prioritises, dispatches or closes anything; a human decides and the decision is recorded.
* Only verified incidents reach the public map, with coordinates rounded to 4 decimals and no personal data.
* A field team sees only its own dispatches; another team's dispatch answers 404.
* Every state change writes a hash-chained audit row (`python -m app.cli verify-audit`).
* Simulated and sandbox data are labelled on screen (simulated incidents, fallback alerts, SANDBOX payments).
>>>>>>> main

---

## 1. Roles (S3-15)

<<<<<<< HEAD
This script provides a structured, step-by-step operational walkthrough of the **Gujarat Disaster Management Platform (ResQ / DRCH)** for a stakeholder review. It demonstrates the complete crisis lifecycle across all four system personas:
=======
Proposed from each member's rehearsal role in the sprint plan; Siddh confirms before rehearsal 1.
>>>>>>> main

| Role in the demo | Person | Steps |
|---|---|---|
| Presenter and operator (screen, timing, fallbacks) | Siddh | all; owns section 4 |
| Citizen reporter | Zalak | 1–3, 15 |
| Field responder, team 1 | Janvi | 9–12 |
| Field responder, team 2 (isolation check) and recommendation explainer | Nisarg | 8, 11 |
| Dispatcher | Tanishq | 4, 6–8, 10, 13–14 |
| Ingestion and signals | Rudra | 5 |
| AI triage | Neeti | 7a |
| AI-down fallback | Dhruvil | 7b, 7c |
| Donor (sandbox payment) | Shlok | 16 |
| Infrastructure checklist, defect list (S3-17), timer | Dhruv | section 2, rehearsal log |

---

## 2. Before each run (operator checklist)

- [ ] `GET <backend>/api/v1/health` returns `{"status": "ok", "database": "ok"}` and `version` is the commit or tag being demoed. Open it 2 minutes early: the free Render instance sleeps (the ingest cron keeps it warm every 10 minutes).
- [ ] Accounts exist; each command or screen shows the TOTP secret once, so add it to the presenter's authenticator app straight away:
  - dispatcher with `DISPATCH`, `SUPERVISOR` and `CLOSURE` permissions: `python -m app.cli create-staff --email … --name … --permissions DISPATCH,SUPERVISOR,CLOSURE` (password from `RESQ_STAFF_PASSWORD` or the prompt), or **Add Disaster Management Staff** on `/dm/staff` as a supervisor;
  - two field responders on two different TEAM resources (team 1 near Ahmedabad, team 2 elsewhere): `python -m app.cli create-field --email … --name … --team "<team name or resource id>" --callsign …`;
  - the citizen registers live in step 1 (or use a prepared account if time is short).
- [ ] TOTP apps for the dispatcher and both responders are on the presenters' phones.
- [ ] Teams are `AVAILABLE` on `/dm/resources` (a team left reserved by the last rehearsal will not be recommended).
- [ ] Frontend has `NEXT_PUBLIC_PAYMENT_SANDBOX=true`; backend has `PAYMENT_GATEWAY=mock` and `MOCK_GATEWAY_SECRET`.
- [ ] AI: `AI_TRIAGE_URL` points at the `drch-ai-triage` service (`/triage`) and `AI_TRIAGE_TOKEN` matches on both services. `AI_IMAGE_SERVICE_URL` is set only if the image service is deployed (step 7c otherwise shows the "unavailable" path).
- [ ] Browser tabs: `/` (public map), `/report`, `/my-reports`, `/dm`, `/field` (phone width, second browser profile for team 2), `/donate`.

---

## 3. Walkthrough

### Step 1 — Citizen signs up (Zalak)
* **Screen:** `/signup` · **API:** `POST /api/v1/auth/register`
* Show the password rules (a weak password is refused with 422), then register.
* **Expect:** account created and signed in (session cookie only; no token in `localStorage`).

### Step 2 — Out-of-state report is refused (Zalak)
* **Screen:** `/report` · **API:** `POST /api/v1/incidents` with an `Idempotency-Key`
* Drop the pin in Jaipur (26.9124, 75.7873).
* **Expect:** `422 OUTSIDE_GUJARAT`; nothing is stored.

### Step 3 — Valid cyclone report (Zalak)
* **Screen:** `/report`, then `/my-reports`
* Scenario **Cyclone**, Ahmedabad pin, urgency High, people affected 15, description of trapped residents.
* **Expect:** `201` with an `INC-YYYY-NNNNNN` reference; `/my-reports` shows status **SUBMITTED** (refreshes every 15 s). A retry with the same idempotency key returns the same incident, not a second one.

### Step 4 — Not public yet (Tanishq narrates)
* **Screen:** `/` public map · **API:** `GET /api/v1/public/incidents`
* **Expect:** the new reference is **absent**. Unverified reports never reach the public map.

### Step 5 — Signals from outside sources (Rudra)
* **Screen:** `/dm/ingestion` (source health, "Poll now" = `POST /api/v1/dm/ingestion/poll`), then `/dm/signals`
* Show the USGS / SACHET alerts and replayed social posts in the queue, each with its source and AI pre-label marked as a suggestion. Say out loud that the social posts are a replay fixture (section 6).
* Promote one signal (`POST /api/v1/dm/signals/{id}/promote`) and dismiss another with a rationale.
* **Expect:** the promoted signal becomes a **SUBMITTED** incident (still not public); dismissal needs a reason.

### Step 6 — Dispatcher signs in with MFA (Tanishq)
* **Screen:** `/login` · **API:** `POST /api/v1/auth/login` → `{"mfa_required": true, "mfa_token": …}` → `POST /api/v1/auth/mfa/verify`
* **Expect:** the DM workspace opens only after the TOTP code.

### Step 7 — AI advisory, and what happens when it is down
**7a. Triage (Neeti).** Open the citizen incident (`/dm/incidents/{id}`), press **Run AI triage** (`POST /api/v1/dm/incidents/{id}/ai-triage`).
* **Expect:** a suggestion labelled "AI suggestion, not verified" with scenario, priority, confidence and factors, or **LOW_CONFIDENCE** below the threshold. The incident's status and priority have **not** changed.
* Record the human decision: Accept, Modify or Reject with a rationale (`POST /api/v1/dm/incidents/{id}/ai-recommendations/{rec_id}/decision`, `action` = `ACCEPTED` / `MODIFIED` / `REJECTED`). Nothing changes on the incident unless the dispatcher explicitly applies it. A second decision on the same recommendation is refused (409).

**7b. AI down (Dhruvil).** With the triage service stopped (or `AI_TRIAGE_URL` unset on a spare environment), run triage again.
* **Expect:** `503 AI_UNAVAILABLE`, recorded as UNAVAILABLE; the dispatcher carries on manually. The rest of the console keeps working.

**7c. Photo analysis (Dhruvil, optional).** Upload a JPEG/PNG/WebP on the incident (`POST /api/v1/dm/incidents/{id}/photo-analyse`).
* **Expect:** an advisory label with confidence, never stored as verification. Without `AI_IMAGE_SERVICE_URL`: `503 AI_PHOTO_UNAVAILABLE` and a clear message.

### Step 8 — Verify, then see recommendations (Tanishq, Nisarg explains)
* Verify the incident with priority **High** and a rationale (`POST /api/v1/dm/incidents/{id}/verification`, `decision: VERIFIED`, current `version`).
* Show the public map (`/`): the incident now appears, coordinates rounded to 4 decimals, no reporter data.
* Open **Create dispatch**: the panel lists recommended teams (`GET /api/v1/dm/incidents/{id}/team-recommendations`) with distance, matched and supporting capabilities and the reason; the label says it needs dispatcher confirmation.
* **Expect:** recommendations never create a dispatch. Nisarg explains the ranking (capability groups first, then distance).

### Step 9 — Dispatcher assigns team 1 (Tanishq)
* Choose the receiving agency, team 1 and instructions; submit (`POST /api/v1/dm/incidents/{id}/dispatches` with an `Idempotency-Key`).
* **Expect:** dispatch `DISP-YYYY-NNNNNN` in **REQUESTED**; team 1 is reserved and disappears from the recommendations (no double booking). A double click does not create a second dispatch.

### Step 10 — Field team 1 works the assignment (Janvi, phone width)
* **Screen:** `/field` (signed in with MFA; assignments refresh every 15 s)
* Acknowledge → **ACKNOWLEDGED**; progress **EN_ROUTE** with a note → dispatch **DISPATCHED** and the incident **DISPATCHED**; then **ON_SCENE**.
* Request backup: capability `boat`, note "water rising in the lane" (`POST /api/v1/field/dispatches/{id}/team-requests`).
* **Expect:** each step appears on the dispatcher's dispatch timeline; progress before acknowledgement is refused (409).

### Step 11 — Another team cannot see it (Nisarg as team 2)
* Team 2's `/field` does not list the dispatch. Calling team 1's dispatch id directly (for example `POST /api/v1/field/dispatches/{id}/acknowledgement`) answers **404**, not 403, so ids cannot be probed.

### Step 12 — Backup request decision (Tanishq)
* **Screen:** `/dm/team-requests` · **API:** `POST /api/v1/dm/team-requests/{id}/decision`
* Approve with a rationale.
* **Expect:** status **APPROVED** and a **pre-filled dispatch draft** (suggested team with the boat capability). No dispatch is created until the dispatcher submits it. Declining requires a rationale.

### Step 13 — Field completion does not close the incident (Janvi → Tanishq)
* Janvi completes the dispatch with a summary (`POST /api/v1/field/dispatches/{id}/completion`).
* **Expect:** dispatch **COMPLETED**, team released; the incident stays open and the dispatcher is prompted to confirm resolution.

### Step 14 — Resolution and closure (Tanishq)
* Resolve (`POST /api/v1/dm/incidents/{id}/resolution`). Resolution is refused while a dispatch is still active (`409 OPEN_DEPENDENCIES`).
* Close with a reason and a public summary (`POST /api/v1/dm/incidents/{id}/closure`, needs the `CLOSURE` permission).
* **Expect:** **CLOSED**; the incident leaves the public map (it lists VERIFIED, DISPATCHED and RESOLVED incidents only); every step is in the audit trail.

### Step 15 — The citizen sees the outcome (Zalak)
* `/my-reports`: timeline SUBMITTED → VERIFIED → DISPATCHED → RESOLVED → CLOSED, and any information request the dispatcher sent (the citizen can answer it in the same view).

### Step 16 — Sandbox donation (Shlok)
* **Screen:** `/donate` (SANDBOX banner visible) · **API:** `POST /api/v1/donations` (`Idempotency-Key`) → `POST /api/v1/donations/{id}/sandbox-payment` → `POST /api/v1/donations/{id}/verify`
* **Expect:** a receipt `REC-YYYY-NNNNNN` only after the server checks the signature; repeating the verification returns the same receipt.
* Show the ending screens with the sandbox preview buttons: **Preview Decline**, **Preview Timeout** and **Cancel & Abandon Order**. They are labelled "SANDBOX PREVIEW — nothing was sent to the gateway"; the server is not told about these endings yet (see section 5).

### Closing (Siddh)
* Run `python -m app.cli verify-audit` (or show its last CI result): the hash chain is intact.
* One slide: what is real and what is simulated (section 6).

---

## 4. If something goes wrong on stage

| Problem | What the operator does |
|---|---|
| Backend cold (first request slow or 502) | Wait for `/api/v1/health`; narrate step 4 meanwhile. Next time open health 2 minutes early. |
| AI triage times out | That is step 7b: show the 503 path and continue manually. |
| Image service not deployed | Skip 7c or show the 503 message. |
| A team is still reserved from the last run | Complete, reject or fail the leftover dispatch on `/dm/dispatches` (that releases the team), then note it in the rehearsal log. |
| TOTP rejected | Check the phone clock; a code is valid for one 30 s window. |
| Staging unusable | Switch to the compose fallback on the demo laptop (release-runbook section 1). |

---

## 5. Known gaps on 11 Nov 2026 (do not click into these)

| Gap | Owner | Demo workaround |
|---|---|---|
| Gateway webhook (`POST /api/v1/payments/webhook/{gateway}`), `GET /api/v1/me/donations` and server-side cancel/expiry are in Shlok's open S2-12 / S3-11 work, not on `main` | Shlok | Show the receipt on the confirmation screen; use the preview buttons for the endings. |
| `/triage` uses the rules baseline; the trained text model (S2-05) and `InProcessProvider` (S2-06) are pending the frozen dataset (S1-10) | Neeti, Dhruvil | Present triage as the rules baseline with guardrails. |
| LLM adapter (S2-08) not built; `LLM_ENABLED` stays off | Zalak | Do not mention an LLM step. |
| Duplicate grouping uses the rules method (`"method": "rules"`) until S2-07 | Dhruvil, Zalak | Show the candidate list and the human link/merge/dismiss decision only. |

---

## 6. Real vs simulated (say it out loud)

| Part | Status |
|---|---|
| Accounts, MFA, RBAC, audit chain, geofence, dispatch locking, field isolation | Real |
| USGS and SACHET alerts | Real feeds; fallback alerts are labelled `is_fallback` |
| Social posts | Replayed fixture (`social_replay.jsonl`), labelled as replay |
| Demo incidents from the seed | `is_simulated = TRUE`, hidden from the public map outside development |
| AI triage | Rules baseline, advisory only |
| Payments | Sandbox mock gateway; no real money |

---

## 7. Rehearsal log (S3-15)

<<<<<<< HEAD
- **Actor:** Anonymous Public / Citizen
- **Interface / Screen:** Public Live Disaster Map
- **API Endpoint:** `GET /api/v1/public/incidents`
- **Action:** Search public incidents feed for the newly created incident reference.
- **Expected Result:** HTTP 200 OK. The unverified incident is **completely absent** from the public feed.
- **Narrative for Siddh:** *"To prevent panic and misinformation, unverified community reports are strictly segregated until vetted by authorized emergency staff."*

---

### Step 5: Dispatcher Authentication with RFC 6238 TOTP MFA

- **Actor:** Staff Dispatcher (Hasmukh Patel)
- **Interface / Screen:** Dispatcher Operations Console — Secure Sign In
- **API Endpoint:**
  1. `POST /api/v1/auth/login`
  2. `POST /api/v1/auth/mfa/verify`
- **Action:**
  - Step 5a: Submit email and password. Backend issues `mfa_required: true` and temporary `mfa_token`.
  - Step 5b: Generate 6-digit TOTP code using secret `JBSWY3DPEHPK3PXP` and exchange for session JWT token (`DISPATCHER` scope).
- **Expected Result:** HTTP 200 OK with `access_token`. Staff dashboard unlocks.

---

### Step 6: Dispatcher Verification & Audit Log Hash-Chaining

- **Actor:** Staff Dispatcher (Hasmukh)
- **Interface / Screen:** Incident Detail & Verification Drawer
- **API Endpoint:** `POST /api/v1/dm/incidents/{incident_id}/verification`
- **Action:** Vetting the report: assign verified priority `HIGH`, provide rationale, and confirm current incident `version: 1`.
- **Payload:**
  ```json
  {
    "decision": "VERIFIED",
    "priority": "HIGH",
    "rationale": "Verified through municipal CCTV and municipal control room confirmation",
    "version": 1
  }
  ```
- **Expected Result:** HTTP 200 OK.
  - Incident status updates to `VERIFIED`.
  - Immutable audit entry created in `audit_logs` with SHA-256 hash chaining linking to previous entry (`prev_hash` → `curr_hash`), preventing any silent tampering.

---

### Step 7: Public Map Verification & PII Stripping Verification

- **Actor:** Anonymous Public
- **Interface / Screen:** Public Live Disaster Map
- **API Endpoint:** `GET /api/v1/public/incidents`
- **Action:** Refresh the public incident feed.
- **Expected Result:**
  - The incident is now visible on the public map.
  - Coordinates are truncated to 4 decimal places (`23.0225`, `72.5714`), obfuscating exact home addresses to within ~11 meters.
  - All reporter PII (`reporter_name`, `reporter_phone`, `address_text`, `description`) is 100% stripped from the public API schema.

---

### Step 8: AI Advisory Triage & Human Guardrail Demonstration

- **Actor:** Staff Dispatcher (Hasmukh)
- **Interface / Screen:** AI Decision Support Panel
- **API Endpoint:** `POST /api/v1/dm/incidents/{incident_id}/ai-triage`
- **Action:** Click "Run AI Triage". Inspect the generated recommendations.
- **Expected Result:** HTTP 200 OK.
  ```json
  {
    "recommendation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "status": "GENERATED",
    "suggested_scenario": "cyclone",
    "suggested_priority": "CRITICAL",
    "confidence": 0.88,
    "uncertainty_note": null,
    "factors": {
      "people_at_risk": 15,
      "flood_depth_estimated": "rising",
      "out_of_scope": false
    }
  }
  ```
- **Key Safety Invariants to Demonstrate:**
  1. Query `GET /api/v1/dm/incidents/{incident_id}` immediately after triage:
     - Incident status is **still `VERIFIED`** (not mutated to CRITICAL or closed).
     - Incident priority is **still `HIGH`** (the human dispatcher's vetted priority).
  2. **Advisory Decision Recording:** The dispatcher clicks "Accept Advisory Recommendation" (`POST /api/v1/dm/incidents/{id}/ai-recommendations/{rec_id}/decision` with `human_action: "ACCEPTED"`). The action is recorded for model governance and can only be submitted once (duplicate submissions return HTTP 409 `ALREADY_DECIDED`).

---

### Step 9: AI Provider Failure / Graceful Degradation Demo

- **Actor:** Staff Dispatcher (Hasmukh)
- **Scenario:** External AI worker service unreachable or timing out.
- **API Endpoint:** `POST /api/v1/dm/incidents/{incident_id}/ai-triage` (with AI mock down or invalid URL)
- **Action:** Trigger AI triage when provider network is interrupted.
- **Expected Result:** HTTP 503 Service Unavailable.
  ```json
  {
    "error": {
      "code": "AI_UNAVAILABLE",
      "message": "AI triage provider unreachable or timed out",
      "details": {
        "recommendation_id": "..."
      }
    }
  }
  ```
- **Narrative for Siddh:** *"If our machine learning inference cluster goes down, the ResQ platform never crashes or blocks emergency operations. The failure is recorded in the audit trail, and dispatchers proceed seamlessly with manual triage."*

---

### Step 10: Multi-Agency Team Request Approval (Draft Only)

- **Actor:** Staff Dispatcher (Hasmukh)
- **Interface / Screen:** Multi-Agency Request Coordination
- **API Endpoint:** `POST /api/v1/dm/incidents/{incident_id}/team-requests/{request_id}/decision`
- **Action:** Approve an incoming SDRF assistance request (`decision: "APPROVED"`).
- **Expected Result:** HTTP 200 OK.
  - Team request transitions to `APPROVED`.
  - Returns `dispatch_draft` structure.
  - **Crucial Rule:** Zero records are inserted into `dispatch_orders`. The human dispatcher retains sole control over when tactical units are dispatched.

---

### Step 11: Tactical Field Dispatch Assignment

- **Actor:** Staff Dispatcher (Hasmukh)
- **Interface / Screen:** Tactical Dispatch Modal
- **API Endpoint:** `POST /api/v1/dm/incidents/{incident_id}/dispatches`
- **Headers:** `Idempotency-Key: <UUID>`
- **Payload:**
  ```json
  {
    "team_resource_id": "<NDRF_TEAM_1_UUID>",
    "priority": "HIGH",
    "operational_notes": "Deploy rubber inflatable boats to Riverfront lower walkway."
  }
  ```
- **Expected Result:** HTTP 201 Created with `dispatch_id` and initial status `ASSIGNED`.

---

### Step 12: Field Responder Execution Lifecycle

- **Actor:** Field Responder (Vikram Rathod, NDRF Team 1)
- **Interface / Screen:** Tactical Mobile / Field Dashboard
- **Sequence of Actions:**
  1. **Login & Assignment Fetch:**
     - `POST /api/v1/auth/login` → Obtain responder JWT.
     - `GET /api/v1/field/assignments` → Displays newly assigned Riverfront dispatch.
  2. **Acknowledge Assignment:**
     - `POST /api/v1/field/dispatches/{dispatch_id}/acknowledgement`
     - Status transitions from `ASSIGNED` → `ACKNOWLEDGED`.
  3. **Progress Update: EN_ROUTE:**
     - `POST /api/v1/field/dispatches/{dispatch_id}/progress` with `status: "EN_ROUTE"`, GPS location, and ETA.
  4. **Progress Update: ON_SCENE:**
     - `POST /api/v1/field/dispatches/{dispatch_id}/progress` with `status: "ON_SCENE"`.
  5. **Mission Completion:**
     - `POST /api/v1/field/dispatches/{dispatch_id}/completion` with `summary: "15 citizens evacuated safely to municipal shelter."`
- **Expected Result:** Dispatch status transitions to `COMPLETED`. The incident remains in `IN_PROGRESS` / `VERIFIED` (field units cannot close incidents without dispatcher review).

---

### Step 13: Cross-Team Security Isolation (Zero-Knowledge 404)

- **Actor:** Field Responder 2 (Amit Shah, SDRF Team 2)
- **Interface / Screen:** Tactical Mobile
- **API Endpoint:** `GET /api/v1/field/dispatches/<TEAM_1_DISPATCH_ID>` or progress post.
- **Action:** Team 2 responder attempts to read or mutate Team 1's dispatch order.
- **Expected Result:** HTTP 404 Not Found (strictly **NOT** 403 Forbidden).
- **Narrative for Siddh:** *"To prevent operational reconnaissance or ID enumeration between disparate response agencies, cross-team requests return strict 404 Not Found as mandated by the ResQ security architecture."*

---

### Step 14: Citizen Donations & Sandbox Gateway Payment

- **Actor:** Citizen / Donor (Priya Sharma)
- **Interface / Screen:** Gujarat Relief Fund / Donation Portal
- **Sequence of Actions:**
  1. **Create Donation Intent:**
     - `POST /api/v1/donations` with `amount_inr: 5000` and `Idempotency-Key`.
     - Returns `donation_id`, `gateway_order_id`, and explicit `is_sandbox: true` marker.
  2. **Payment Gateway HMAC-SHA256 Verification:**
     - `POST /api/v1/donations/{donation_id}/verify` with signed gateway payload:
       ```json
       {
         "gateway_payment_id": "pay_mock_12345678",
         "signature": "<HMAC_SHA256_HEX>"
       }
       ```
     - Backend verifies signature against `MOCK_GATEWAY_SECRET`.
     - Status transitions to `CONFIRMED` and issues official receipt `REC-2026-XXXXXX`.
  3. **Idempotency Replay Check:**
     - Resending the verification payload returns HTTP 200 with the exact same receipt number without double-crediting.

---

## 4. Known Limitations

> [!WARNING]
> During the demo, navigate around the following endpoints which are pending merge or feature completion:

### 1. Donor History Feed (`GET /api/v1/me/donations`)
- **Status:** Unmerged / 404 Route Not Registered.
- **Defect Tracking:** `DEFECT-S2-16-ME-DONATIONS-404`
- **Responsible Owner:** **Shlok / Zalak**
- **Presenter Workaround:** Show successful receipt generation in the verification modal response (Step 14). Do not click the "My Donation History" tab in the citizen portal until merged.
- **Smoke Flag:** Default skipped in CI via `SMOKE_SKIP_D4=1`.

### 2. Inbound Payment Gateway Webhooks (`POST /api/v1/payments/webhook/*`)
- **Status:** Gateway callback webhook route undergoing HMAC replay protection review.
- **Responsible Owner:** **Shlok**
- **Presenter Workaround:** Demonstrate client-side gateway signature verification (`POST /api/v1/donations/{id}/verify`) which is fully functional and cryptographically guarded.

---

## 5. Quick Demo Execution Checklist

Use this checklist during your staging rehearsal:

- [ ] Docker Compose backend running with PostGIS 16 (`docker compose ps`).
- [ ] Database migrated to Revision 09 (`python -m app.migrate`).
- [ ] Staff dispatcher account created with known TOTP secret.
- [ ] Field Responder accounts created for Team 1 and Team 2.
- [ ] Run automated smoke suite before presentation:
  ```bash
  SMOKE_STAFF_EMAIL="hasmukh.patel@gujarat.gov.in" \
  SMOKE_STAFF_PASSWORD="DisasterPassword@2026" \
  SMOKE_STAFF_TOTP_SECRET="JBSWY3DPEHPK3PXP" \
  SMOKE_FIELD_EMAIL="vikram.rathod@ndrf.gov.in" \
  SMOKE_FIELD_PASSWORD="FieldPassword@2026" \
  SMOKE_FIELD2_EMAIL="amit.shah@sdrf.gov.in" \
  SMOKE_FIELD2_PASSWORD="FieldPassword@2026" \
  bash scripts/smoke.sh
  ```
- [ ] Confirm all steps show `[SMOKE PASS]` with zero unexpected failures.
- [ ] Open browser tabs to Citizen Portal (`:3000`), Dispatch Console (`:3000/dm`), and Swagger Docs (`:8000/docs`).
=======
| Run | Date | Duration | Steps that failed | Defects raised (P0 / P1 / P2) | Fixed before next run? |
|---|---|---|---|---|---|
| Rehearsal 1 | | | | | |
| Rehearsal 2 | | | | | |
| Final demo | | | | | |
>>>>>>> main

Dhruv records each defect in the S3-17 list; Siddh approves which P0s block the release tag.
