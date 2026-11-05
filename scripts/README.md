# ResQ Automated Smoke Test Suite (`scripts/smoke.sh`)

**Owner / Primary Contact:** Siddh (Deployment & DevOps Lead)  
**QA & Test Lead:** Dhruv  

`scripts/smoke.sh` is an end-to-end black-box integration and smoke test suite for the Gujarat Disaster Management Platform (ResQ / DRCH). It validates the complete operational chain against any live backend deployment (local Docker Compose, continuous delivery pipelines, or Render staging environments).

---

## 1. Test Coverage Overview

The suite executes four logical phases:

1. **Core Reporting & Verification Lifecycle:**
   - Service liveness (`/health`) and PostgreSQL readiness (`/api/v1/health`, `database="ok"`).
   - Citizen registration (`POST /api/v1/auth/register`) strictly enforcing password policy (>= 8 chars, 1 digit, 1 special symbol).
   - Gujarat incident submission (`POST /api/v1/incidents`) with `Idempotency-Key` and replay verification.
   - Out-of-state spatial rejection (Jaipur GPS coordinates refused with HTTP 422 `OUTSIDE_GUJARAT`).
   - Public map isolation: Unverified incident is strictly absent from `GET /api/v1/public/incidents`.
   - Dispatcher authentication via password + RFC 6238 TOTP MFA token.
   - Dispatcher incident verification (`POST /api/v1/dm/incidents/{id}/verification`).
   - Public map presence: Verified incident visible with coordinates truncated to <= 4 decimal places and zero reporter PII.
   - Citizen timeline progression: Contains `SUBMITTED` and `VERIFIED` milestones.

2. **AI Advisory Triage Gate (`AI-1`):**
   - **`AI-1`**: Dispatcher triggers AI advisory triage (`POST /api/v1/dm/incidents/{id}/ai-triage`). Validates advisory triage response (`GENERATED` or `LOW_CONFIDENCE`) or graceful `503 AI_UNAVAILABLE` fallback, and confirms that incident status and verified priority remain 100% immutable (strictly advisory, human-in-the-loop invariant).

3. **Field Operations Flow (`F1` – `F4`):**
   - **`F1`**: Dispatcher creates a tactical dispatch for the verified incident to a seeded response team (`POST /api/v1/dm/incidents/{id}/dispatches` with `Idempotency-Key`).
   - **`F2`**: Field team responder authenticates and verifies assignment presence in `GET /api/v1/field/assignments`.
   - **`F3`**: Operational milestone progression:
     - Acknowledge assignment (`POST /api/v1/field/dispatches/{id}/acknowledgement`).
     - Progress update `EN_ROUTE` (`POST /api/v1/field/dispatches/{id}/progress`).
     - Progress update `ON_SCENE` (`POST /api/v1/field/dispatches/{id}/progress`).
     - Mission completion (`POST /api/v1/field/dispatches/{id}/completion`) with summary.
     - State verification: Dispatch is `COMPLETED`, resources released, and incident remains open (`NOT CLOSED`).
   - **`F4`**: Cross-team isolation: A responder from another field unit receives HTTP 404 `NOT_FOUND` (never 403) on that dispatch.

4. **Citizen Donations & Payment Gateway Flow (`D1` – `D4`):**
   - **`D1`**: Citizen creates a donation order (`POST /api/v1/donations` with `Idempotency-Key`); response is labelled `is_sandbox: true` and status is `PENDING`.
   - **`D2`**: Payment verification with HMAC-SHA256 signature calculated from the gateway secret (`POST /api/v1/donations/{id}/verify`); transitions to `CONFIRMED` and receives a receipt number (`REC-YYYY-XXXXXX`).
   - **`D3`**: Idempotent replay: Resending the verification payload returns HTTP 200 with identical receipt number.
   - **`D4`**: Citizen donations feed (`GET /api/v1/me/donations`) reflects the confirmed donation and receipt.

5. **Staging Webhook Probe (`W1`):**
   - Probe staging webhook URL with an invalid signature, verifying that the endpoint is reachable and strictly refuses unauthorized deliveries.

---

## 2. Environment Variables & Credentials Reference

> [!IMPORTANT]
> **Zero Hardcoded Secrets Policy:** All credentials and secrets must be supplied through environment variable names. No defaults exist for passwords, TOTP shared secrets, or webhook secrets.
> Tokens, keys, and secrets are strictly excluded from console logs and terminal output.

| Environment Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `SMOKE_BASE_URL` | No | `http://localhost:8000` | Target URL of the backend API gateway. |
| `STAGING_URL` | No | *None* | Staging target override (used by CD & staging verification). |
| `SMOKE_COLD_START_TIMEOUT` | No | `90` | Cold-start timeout in seconds for Render spin-up. |
| `SMOKE_STAFF_EMAIL` | **Yes** | *None* | Email address of the seeded staff dispatcher. |
| `SMOKE_STAFF_PASSWORD` | **Yes** | *None* | Password for the staff dispatcher account. |
| `SMOKE_STAFF_TOTP_SECRET` | **Yes** | *None* | Base32 RFC 6238 TOTP secret for staff MFA sign-in. |
| `SMOKE_FIELD_EMAIL` | Optional* | *None* | Email for primary seeded field responder (Team 1). |
| `SMOKE_FIELD_PASSWORD` | Optional* | *None* | Password for primary field responder. |
| `SMOKE_FIELD_TOTP_SECRET` | No | *None* | TOTP secret if field account has MFA enabled. |
| `SMOKE_FIELD2_EMAIL` | Optional* | *None* | Email for secondary field responder (Team 2, for `F4` test). |
| `SMOKE_FIELD2_PASSWORD` | Optional* | *None* | Password for secondary field responder. |
| `SMOKE_FIELD2_TOTP_SECRET`| No | *None* | TOTP secret for secondary field responder. |
| `SMOKE_TEAM_RESOURCE_ID` | No | *Auto-resolved* | UUID of the assigned field team resource. |
| `SMOKE_TEAM_AGENCY_ID` | No | *Auto-resolved* | UUID of the receiving emergency response agency. |
| `SMOKE_MOCK_GATEWAY_SECRET` | No | *dev-only default* | HMAC-SHA256 secret for mock payment gateway signing. |
| `SMOKE_DONATION_WEBHOOK_SECRET` | No | *None* | Shared secret for staging donation webhook signing. |
| `SMOKE_STAGING_WEBHOOK_URL` | No | *None* | Target webhook URL for invalid signature probe (`W1`). |

*\* Note: Required to execute field flow steps `F1`–`F4` without skipping.*

---

## 3. Contract Skip Switches (`SMOKE_SKIP_<STEP>`)

For staging environments or branches where particular backend endpoints are still undergoing implementation, individual steps can be safely bypassed by setting the corresponding skip switch to `1`.

| Switch Variable | Step Covered | Associated Endpoint / Route | Default | Responsible Module Owner |
| :--- | :--- | :--- | :---: | :--- |
| `SMOKE_SKIP_REGISTER` | CORE-2 | `POST /api/v1/auth/register` | `0` | Zalak |
| `SMOKE_SKIP_INCIDENT_SUBMIT` | CORE-3 | `POST /api/v1/incidents` | `0` | Zalak |
| `SMOKE_SKIP_OUTSIDE_GUJARAT` | CORE-4 | `POST /api/v1/incidents` | `0` | Zalak |
| `SMOKE_SKIP_PUBLIC_UNVERIFIED` | CORE-5 | `GET /api/v1/public/incidents` | `0` | Nisarg |
| `SMOKE_SKIP_PUBLIC_VERIFIED` | CORE-7 | `GET /api/v1/public/incidents` | `0` | Nisarg |
| `SMOKE_SKIP_AI` | AI-1 | `POST /api/v1/dm/incidents/{id}/ai-triage` | `0` | Nisarg / Dhruv |
| `SMOKE_SKIP_F1` | F1 | `POST /api/v1/dm/incidents/{id}/dispatches` | `0` | Shlok |
| `SMOKE_SKIP_F2` | F2 | `GET /api/v1/field/assignments` | `0` | Dhruv |
| `SMOKE_SKIP_F3` | F3 | `POST /api/v1/field/dispatches/{id}/*` | `0` | Dhruv |
| `SMOKE_SKIP_F4` | F4 | `POST /api/v1/field/dispatches/{id}/*` (404) | `0` | Dhruv |
| `SMOKE_SKIP_D1` | D1 | `POST /api/v1/donations` | `0` | Shlok |
| `SMOKE_SKIP_D2` | D2 | `POST /api/v1/donations/{id}/verify` | `0` | Shlok |
| `SMOKE_SKIP_D3` | D3 | `POST /api/v1/donations/{id}/verify` (Replay) | `0` | Shlok |
| `SMOKE_SKIP_D4` | D4 | `GET /api/v1/me/donations` | **`1`** | Shlok / Zalak (`DEFECT-S2-16-ME-DONATIONS-404`) |
| `SMOKE_SKIP_W1` | W1 | Webhook Signature Probe | `0` | Shlok |

> [!NOTE]
> `SMOKE_SKIP_D4` defaults to `1` because `GET /api/v1/me/donations` is unmerged in Sprint 2 (`DEFECT-S2-16-ME-DONATIONS-404`). When Siddh merges that route, export `SMOKE_SKIP_D4=0` to activate validation.

---

## 4. Provisioning Test Accounts with `app.cli`

Before running against a fresh database, provision the dispatcher and field accounts:

### 1. Provision Staff Dispatcher
```bash
python -m app.cli create-staff \
    --email "smoke-dispatcher@drch.gov.in" \
    --name "Smoke Test Dispatcher" \
    --permissions "DISPATCH,CLOSURE,PUBLISHER,MODERATOR,SUPERVISOR"
```
*Note the generated password and Base32 TOTP secret printed during account creation.*

### 2. Provision Field Responders
```bash
# Responder 1 (108 ALS Ambulance Alpha, Ahmedabad)
python -m app.cli create-field \
    --email "smoke-field1@drch.gov.in" \
    --name "Ahmedabad Field Unit Lead" \
    --team "108 ALS Disaster Ambulance Alpha (Ahmedabad Civil)" \
    --callsign "ALS-Alpha-1" \
    --leader

# Responder 2 (SDRF Flood QRT, Rajkot - for cross-team isolation F4)
python -m app.cli create-field \
    --email "smoke-field2@drch.gov.in" \
    --name "Rajkot SDRF Responder" \
    --team "SDRF Flood Quick Response Team (Rajkot Aji River)" \
    --callsign "SDRF-Rajkot-2"
```

---

## 5. Execution Instructions

### Local Execution (Git Bash / Linux / macOS)
```bash
export SMOKE_BASE_URL="http://localhost:8000"
export SMOKE_STAFF_EMAIL="smoke-dispatcher@drch.gov.in"
export SMOKE_STAFF_PASSWORD="<GENERATED_PASSWORD>"
export SMOKE_STAFF_TOTP_SECRET="<BASE32_TOTP_SECRET>"

export SMOKE_FIELD_EMAIL="smoke-field1@drch.gov.in"
export SMOKE_FIELD_PASSWORD="<FIELD1_PASSWORD>"
export SMOKE_FIELD_TOTP_SECRET="<FIELD1_TOTP_SECRET>"

export SMOKE_FIELD2_EMAIL="smoke-field2@drch.gov.in"
export SMOKE_FIELD2_PASSWORD="<FIELD2_PASSWORD>"

./scripts/smoke.sh
```

### Windows Execution (PowerShell)
```powershell
$env:SMOKE_BASE_URL="http://localhost:8000"
$env:SMOKE_STAFF_EMAIL="smoke-dispatcher@drch.gov.in"
$env:SMOKE_STAFF_PASSWORD="<GENERATED_PASSWORD>"
$env:SMOKE_STAFF_TOTP_SECRET="<BASE32_TOTP_SECRET>"

$env:SMOKE_FIELD_EMAIL="smoke-field1@drch.gov.in"
$env:SMOKE_FIELD_PASSWORD="<FIELD1_PASSWORD>"

$env:SMOKE_FIELD2_EMAIL="smoke-field2@drch.gov.in"
$env:SMOKE_FIELD2_PASSWORD="<FIELD2_PASSWORD>"

& "C:\Program Files\Git\bin\bash.exe" ./scripts/smoke.sh
```

### Output Format
The script exits with code `0` on success and prints the summary line:
```text
N passed, M failed
```

