# Gujarat Disaster Management Platform (ResQ) — Sprint 2 Demo Script

**Document Version:** 1.0.0  
**Author:** Dhruv (QA & Test Lead)  
**Target Audience / Presenter:** Siddh (DevOps & Deployment Lead)  
**Platform Target:** Sprint 2 Review & Stakeholder Demonstration  
**Applicable Environments:** Local Docker Compose / Render Staging  

---

## 1. Overview & Demonstration Goals

This script provides a structured, step-by-step operational walkthrough of the **Gujarat Disaster Management Platform (ResQ / DRCH)** for Sprint 2. It demonstrates the complete crisis lifecycle across all four system personas:

1. **Citizen / Reporter:** Registers securely, reports emergency incidents within Gujarat boundaries, tracks status timeline, and issues crisis donations.
2. **Staff Dispatcher:** Authenticates via RFC 6238 TOTP MFA, reviews unverified queues, requests advisory AI triage, verifies incidents, evaluates multi-agency team requests, and dispatches field teams.
3. **Field Team Responder:** Authenticates from tactical mobile/field interfaces, retrieves assigned dispatches, progresses through real-time operational milestones (`ACKNOWLEDGED` → `EN_ROUTE` → `ON_SCENE` → `COMPLETED`), maintaining cross-team data isolation.
4. **Donor:** Issues transparent sandbox donations, receives cryptographically verified receipts (`REC-YYYY-XXXXXX`), and tracks disaster fund allocations.

> [!IMPORTANT]
> **Advisory AI Invariant:** AI models in ResQ are strictly advisory. The platform guarantees that AI outputs can never mutate incident state, priority, or field dispatches without explicit human dispatcher authorization.

---

## 2. Test Personas & Environment Setup

### 2.1 Demo Accounts & Roles

| Role | Name | Email | Auth Method | Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Staff Dispatcher** | Hasmukh Patel | `hasmukh.patel@gujarat.gov.in` | Password + TOTP MFA | Verify incidents, request AI triage, approve team requests, create tactical dispatches. |
| **Field Responder (Team 1)** | Vikram Rathod | `vikram.rathod@ndrf.gov.in` | Password (+ TOTP MFA) | View Team 1 assignments, acknowledge, report GPS en route, mark on-scene, complete dispatches. |
| **Field Responder (Team 2)** | Amit Shah | `amit.shah@sdrf.gov.in` | Password (+ TOTP MFA) | Team 2 assignments; demonstrates cross-team 404 security isolation. |
| **Citizen Reporter** | Priya Sharma | Dynamic / `priya.sharma@example.in` | Password (Contract: >= 8 chars, 1 digit, 1 special) | Report incidents in Gujarat, view citizen timeline, make crisis relief donations. |

### 2.2 Environment Prerequisites

Ensure backend API and PostGIS database services are healthy:

```bash
# Check service health and database readiness
curl -s http://localhost:8000/health | jq .
curl -s http://localhost:8000/api/v1/health | jq .
# Expected: {"status": "ok", "database": "ok", "version": "..."}
```

If provisioning test accounts prior to the demo:

```bash
# Provision staff dispatcher with TOTP MFA
python -m app.cli create-staff \
  --email hasmukh.patel@gujarat.gov.in \
  --full-name "Hasmukh Patel" \
  --role DISPATCHER \
  --totp-secret "JBSWY3DPEHPK3PXP"

# Provision NDRF field responder
python -m app.cli create-field-user \
  --email vikram.rathod@ndrf.gov.in \
  --full-name "Vikram Rathod" \
  --team-code "NDRF-TEAM-01"
```

---

## 3. End-to-End Walkthrough Script

```
+----------------------------------------------------------------------------------------------------+
|                                     SPRINT 2 DEMO FLOW OVERVIEW                                    |
|                                                                                                    |
|  [Citizen] --------> [Spatial Gate] --------> [Dispatcher MFA] ------> [Advisory AI Triage]        |
|  Register &          Reject Jaipur (422)      Sign in with TOTP        Scrubbed PII, Safe Schema,  |
|  Submit Incident     Accept Ahmedabad         Review Unverified        503 Fallback Demonstration  |
|                             |                                                    |                 |
|                             v                                                    v                 |
|                      [Public Map Feed]                                 [Dispatcher Decision]       |
|                      Unverified: Hidden                                Human verifies incident     |
|                      Verified: 4 decimals, no PII                      Approves team draft         |
|                                                                                  |                 |
|                                                                                  v                 |
|  [Donor] <----------- [Field Unit Isolation] <------- [Field Unit] <----- [Tactical Dispatch]      |
|  Sandbox Donation     Team 2 blocked (404)            Acknowledge -> En Route -> Dispatch created  |
|  HMAC Verification    Zero leakage of ID              On Scene -> Complete       Idempotency-Key   |
+----------------------------------------------------------------------------------------------------+
```

---

### Step 1: Citizen Registration & Security Policy Enforcement

- **Actor:** Citizen (Priya)
- **Interface / Screen:** Citizen Portal / Registration Form
- **API Endpoint:** `POST /api/v1/auth/register`
- **Action:** Register with a compliant password (`Disaster@2026`). Demonstrate that passwords lacking special symbols or digits are rejected with HTTP 422.
- **Payload:**
  ```json
  {
    "full_name": "Priya Sharma",
    "email": "priya.sharma@example.in",
    "phone": "+919876543210",
    "password": "Disaster@2026"
  }
  ```
- **Expected Result:** HTTP 201 Created. Returns `user_id`, `access_token`, and user profile.

---

### Step 2: Boundary Enforcement — Out-of-State Rejection

- **Actor:** Citizen (Priya)
- **Interface / Screen:** Incident Submission Modal
- **API Endpoint:** `POST /api/v1/incidents`
- **Action:** Attempt to submit an emergency incident located in Jaipur, Rajasthan (`latitude: 26.9124, longitude: 75.7873`).
- **Headers:** `Authorization: Bearer <CITIZEN_TOKEN>`, `Idempotency-Key: <UUID>`
- **Expected Result:** HTTP 422 Unprocessable Entity.
  ```json
  {
    "error": {
      "code": "OUTSIDE_GUJARAT",
      "message": "Incident location is outside Gujarat operational boundary"
    }
  }
  ```
- **Narrative for Siddh:** *"ResQ strictly enforces Gujarat territorial boundaries at the database/spatial tier using PostGIS polygons, preventing dispatch resource exhaustion from misdirected or out-of-jurisdiction reports."*

---

### Step 3: Valid Incident Submission & Idempotent Replay

- **Actor:** Citizen (Priya)
- **Interface / Screen:** Incident Submission
- **API Endpoint:** `POST /api/v1/incidents`
- **Action:** Submit an urgent cyclone/flood hazard report in Ahmedabad, Gujarat (`latitude: 23.0225, longitude: 72.5714`). Re-send the exact request with the same `Idempotency-Key` to demonstrate deduplication.
- **Payload:**
  ```json
  {
    "scenario": "CYCLONE",
    "title": "Severe flooding near Sabarmati Riverfront",
    "description": "Rising water levels trapped 15 people on lower floor",
    "reported_urgency": "HIGH",
    "people_affected": 15,
    "latitude": 23.022543,
    "longitude": 72.571421,
    "address_text": "Riverfront West, Ahmedabad"
  }
  ```
- **Expected Result:**
  - Initial request returns HTTP 201 Created with `incident_id` and `incident_ref` (e.g., `INC-2026-XXXX`).
  - Replay request returns HTTP 200 or 201 with identical payload and reference, without creating duplicate incident rows in PostgreSQL.

---

### Step 4: Public Feed Privacy Protection (Pre-Verification)

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

## 4. Pending Sprint 2 Features & Known Defects

> [!WARNING]
> During the demo, navigate around the following endpoints which are pending merge or feature completion in Sprint 2:

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

