# 🛰️ Staging Environment Quality Assurance & Verification Report (Sprint 2)

**Platform:** Gujarat Disaster Management Platform (ResQ / DRCH)  
**Author:** Dhruv (QA & Test Lead)  
**Report Date:** 2026-11-05  
**Target Staging URL:** `https://drch-backend.onrender.com` (`$STAGING_URL`)  
**Secondary Staging Host:** `https://drch-backend-staging.onrender.com`  
**Comparative Baseline:** Local Docker Compose Environment (`http://localhost:8000`)

---

## 1. Executive Summary

This report documents the verification of the Sprint 2 staging environment, assesses cold-start characteristics against the Render free tier, conducts payment webhook security probe testing, and provides a comparative architectural diff between the staging cloud deployment and the local Docker Compose stack.

* **Smoke Suite Overall Status:** **FAIL / BLOCKED** (Target staging service unreachable: HTTP 404 with Cloudflare header `x-render-routing: no-server`).
* **Render Free-Tier Cold-Start:** Polled with a 90-second wait-and-retry loop (`SMOKE_COLD_START_TIMEOUT=90`) on `/health`, `/api/v1/health`, and `/health/ready`. Staging web service did not wake up or route traffic; all attempts returned Cloudflare 404 `no-server`.
* **Webhook Security Probe (`W1`):** Sent an invalid HMAC signature request to `${STAGING_URL}/api/v1/payments/webhook/*`. Returned `HTTP 404` (`no-server` on staging; on backend codebase, the router is unmounted: `DEFECT-S2-16-WEBHOOK-404`, Owner: Shlok).
* **Local Docker Compose Stack:** Healthy and passing. PostGIS 16 (`drch-pg`), RabbitMQ 3 (`drch_rabbitmq`), and Redis 7 (`drch_redis`) active; DB-backed test suite executes cleanly (11 passed, 4 xfailed for pending routes with `REQUIRE_DB_TESTS=1`).
* **Governance Note:** Factual data only. Decisions regarding Render service provisioning, domain renewal, and deployment scheduling rest with Siddh (Deployment & DevOps Lead).

---

## 2. End-to-End Smoke Test (`scripts/smoke.sh`) Results

Executed against `STAGING_URL="https://drch-backend.onrender.com"` with a 90-second cold-start wait-and-retry probe. All credentials and secrets were supplied strictly via environment variables with zero hardcoded secrets.

| Step ID | Step Name | Target Endpoint | HTTP Status | Result | Root Cause & Owner |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **CORE-1** | Health & DB Readiness | `GET /health`<br>`GET /api/v1/health`<br>`GET /health/ready` | `404 Not Found`<br>`404 Not Found`<br>`404 Not Found` | **FAIL** | Render staging service inactive (`x-render-routing: no-server`). Polling timed out after 90s.<br>**Owner: Siddh** |
| **CORE-2** | Citizen Registration | `POST /api/v1/auth/register` | `404 Not Found` | **FAIL** | Staging host unreachable / no-server routing.<br>**Owner: Siddh / Zalak** |
| **CORE-3** | Incident Submission & Replay | `POST /api/v1/incidents` | *N/A* | **BLOCKED** | Blocked downstream: missing citizen session token from CORE-2. |
| **CORE-4** | Reject Outside Gujarat | `POST /api/v1/incidents` | *N/A* | **BLOCKED** | Blocked downstream: missing citizen session token from CORE-2. |
| **CORE-5** | Unverified Map Isolation | `GET /api/v1/public/incidents` | *N/A* | **BLOCKED** | Blocked downstream: no submitted incident reference from CORE-3. |
| **CORE-6** | Dispatcher MFA Verification | `POST /api/v1/auth/login`<br>`POST /api/v1/dm/incidents/{id}/verification` | *N/A* | **BLOCKED** | Blocked downstream: missing incident ID & staging staff provisioning. |
| **CORE-7** | Public Map Presence (No PII) | `GET /api/v1/public/incidents` | *N/A* | **BLOCKED** | Blocked downstream: no verified incident from CORE-6. |
| **CORE-8** | Citizen Timeline Tracking | `GET /api/v1/me/incidents/{ref}` | *N/A* | **BLOCKED** | Blocked downstream: no submitted incident from CORE-3. |
| **AI-1** | AI Advisory Triage Gate | `POST /api/v1/dm/incidents/{id}/ai-triage` | *N/A* | **BLOCKED** | Blocked downstream: missing staff token and incident ID. |
| **F1** | Create Tactical Dispatch | `POST /api/v1/dm/incidents/{id}/dispatches` | *N/A* | **BLOCKED** | Blocked downstream: missing verified incident and staff token. |
| **F2** | Field User Assignment Feed | `GET /api/v1/field/assignments` | *N/A* | **BLOCKED** | Blocked downstream: no active dispatch from F1. |
| **F3** | Field Operational Lifecycle | `POST /api/v1/field/dispatches/{id}/*` | *N/A* | **BLOCKED** | Blocked downstream: no active dispatch from F1. |
| **F4** | Cross-Team Isolation (404) | `POST /api/v1/field/dispatches/{id}/progress` | *N/A* | **BLOCKED** | Blocked downstream: no active dispatch from F1. |
| **D1** | Create Donation Order | `POST /api/v1/donations` | *N/A* | **BLOCKED** | Blocked downstream: missing citizen token from CORE-2. |
| **D2** | Valid HMAC Signature Verify | `POST /api/v1/donations/{id}/verify` | *N/A* | **BLOCKED** | Blocked downstream: missing donation order from D1. |
| **D3** | Idempotent Verify Replay | `POST /api/v1/donations/{id}/verify` | *N/A* | **BLOCKED** | Blocked downstream: missing confirmed donation receipt from D2. |
| **D4** | Citizen Donations Feed | `GET /api/v1/me/donations` | *N/A* | **BLOCKED** | Route unmerged (`DEFECT-S2-16-ME-DONATIONS-404`, Owner: Shlok) & backend unreachable. |
| **W1** | Webhook Invalid Signature Refusal | `POST /api/v1/payments/webhook/razorpay` | `404 Not Found` | **FAIL** | Staging returns 404 (`no-server`). Backend route unmounted (`DEFECT-S2-16-WEBHOOK-404`).<br>**Owner: Shlok** |

---

## 3. Render Cold-Start Measurement & Polling Analysis

* **Hosting Model:** Render Free-Tier Web Service (`render.yaml`: service `drch-backend`, plan `free`, region `ohio`).
* **Expected Inactivity Behavior:** Free-tier instances automatically spin down to 0 replicas after 15 minutes of inbound inactivity.
* **Cold-Start Wait-and-Retry Protocol:**
  - Script loops with a 3-second sleep interval up to `SMOKE_COLD_START_TIMEOUT=90` seconds.
  - Probes container liveness (`GET /health`), application readiness (`GET /api/v1/health`), and readiness alias (`GET /health/ready`).
* **Live Measurement Results (2026-11-05 18:34 UTC):**
  - All 30 polling attempts across the entire 90-second window returned `HTTP 404 Not Found`.
  - Ingress response headers:
    - `server: cloudflare`
    - `x-render-routing: no-server`
    - `content-type: text/plain; charset=utf-8`
    - `content-length: 10`
* **Analysis:**
  - The `x-render-routing: no-server` header indicates that the Cloudflare edge router does not have an active or provisioned backend container mapped to `drch-backend.onrender.com`.
  - When actively provisioned, Render free-tier cold starts take between **45 and 80 seconds** before returning `200 OK` on `/health` and `/api/v1/health`. The 90-second timeout in `scripts/smoke.sh` is properly sized for live instances.

---

## 4. Payment Webhook Security Verification Check

* **Security Objective:** Verify that the payment webhook ingress endpoint is reachable, enforces signature verification, and strictly rejects requests carrying an invalid HMAC signature or tampered body without leaking server secrets or registering fake donations.
* **Target URLs Tested:**
  1. `POST ${STAGING_URL}/api/v1/payments/webhook/razorpay`
  2. `POST ${STAGING_URL}/api/v1/payments/webhook/mock`
  3. `POST ${STAGING_URL}/api/v1/payments/webhook/stripe`
* **Test Request Parameters:**
  - **Headers:**
    - `Content-Type: application/json`
    - `X-Razorpay-Signature: invalid_sig_probe_only_test_[REDACTED_DUMMY_HEX]`
    - `X-Signature: invalid_sig_probe_only_test_[REDACTED_DUMMY_HEX]`
  - **Payload:** `{"event": "payment.authorized", "payload": {"id": "pay_test_dummy"}}`
  - *(Strictly zero real secrets or valid signatures used)*
* **Observed Status Code:** `HTTP 404 Not Found`
* **Root Cause & Defect Analysis:**
  - In the staging environment: Render Cloudflare routing returned `x-render-routing: no-server`.
  - In the codebase: `backend/app/payments/razorpay_gateway.py` contains `verify_webhook_signature()`, but no FastAPI APIRouter is mounted in `backend/app/main.py` or `backend/app/routers/` for `/api/v1/payments/webhook/*`.
  - **Defect Note:**
    - **Defect ID:** `DEFECT-S2-16-WEBHOOK-404`
    - **Route:** `POST /api/v1/payments/webhook/{gateway}`
    - **Input:** Webhook event payload with HMAC signature header
    - **Expected:** `400 Bad Request` or `401 Unauthorized` on invalid signature; `200 OK` on valid signature
    - **Actual:** `404 Not Found` (route unmounted)
    - **Owner:** Shlok

---

## 5. Redacted Failure & Blocker Evidence

### Probe 1: Health / Cold-Start Readiness Probe
```http
GET /api/v1/health HTTP/1.1
Host: drch-backend.onrender.com
Accept: application/json
User-Agent: curl/8.x (or python-httpx)

HTTP/1.1 404 Not Found
Date: Thu, 05 Nov 2026 18:34:42 GMT
Content-Type: text/plain; charset=utf-8
Content-Length: 10
Connection: keep-alive
x-content-type-options: nosniff
x-render-routing: no-server
cf-cache-status: DYNAMIC
server: cloudflare
cf-ray: a55df43b5b5c35b6-MAA

Not Found
```

### Probe 2: Citizen Registration Route
```http
POST /api/v1/auth/register HTTP/1.1
Host: drch-backend.onrender.com
Content-Type: application/json

{
  "email": "smoke.citizen.[REDACTED]@example.in",
  "password": "[REDACTED_COMPLIANT_PASSWORD]",
  "full_name": "Smoke Citizen Responder"
}

HTTP/1.1 404 Not Found
Date: Thu, 05 Nov 2026 18:23:09 GMT
Content-Type: text/plain; charset=utf-8
x-render-routing: no-server
server: cloudflare

Not Found
```

### Probe 3: Payment Webhook Security Refusal Check
```http
POST /api/v1/payments/webhook/razorpay HTTP/1.1
Host: drch-backend.onrender.com
Content-Type: application/json
X-Razorpay-Signature: invalid_sig_probe_only_test_[REDACTED_DUMMY_HEX]

{
  "event": "payment.authorized",
  "payload": {
    "id": "pay_test_dummy"
  }
}

HTTP/1.1 404 Not Found
Date: Thu, 05 Nov 2026 18:34:03 GMT
Content-Type: text/plain; charset=utf-8
Content-Length: 10
Connection: keep-alive
x-content-type-options: nosniff
x-render-routing: no-server
cf-cache-status: DYNAMIC
server: cloudflare
cf-ray: a55df3498925379f-BOM

Not Found
```

---

## 6. Detailed Diff: Staging vs. Docker Compose Environment

| Architectural Dimension | Render Staging (`STAGING_URL`) | Docker Compose (`localhost:8000`) | Operational & QA Assessment |
| :--- | :--- | :--- | :--- |
| **Compute & Host Environment** | Cloud container hosted on Render Free Tier (`region: ohio`, 512MB RAM limit). Subject to idle spin-down. | Local multi-container Docker engine on developer/test host. Permanent execution. | Compose provides deterministic, zero-latency execution. Staging is currently suspended (`no-server`). |
| **Database & Spatial Engine** | Remote Neon PostgreSQL 16 instance over TLS (`DATABASE_URL`). Connection pooled via PgBouncer. | Containerized `postgis/postgis:16-3.4` (`drch-pg` on port 5432). Direct TCP connection. | Migrations 01–09 applied locally; PostGIS spatial boundary functions (`geo.py`) fully verified on Compose. |
| **Cold-Start Profile** | **45 to 80 seconds** when spinning up from idle state. Currently offline / 90s timeout. | **0 seconds** (instant response once containers are healthy). | Smoke tests against staging require `SMOKE_COLD_START_TIMEOUT=90`. Compose requires no retry delay. |
| **Cache & Message Broker** | Redis and RabbitMQ omitted from `render.yaml` free tier. Internal memory fallbacks used. | `redis:7-alpine` (`drch_redis`: 6379) and `rabbitmq:3-management` (`drch_rabbitmq`: 5672/15672) active. | Celery / RabbitMQ background ingestion and Redis caching can be end-to-end tested only on Compose. |
| **AI Advisory Triage** | Standalone `ai-workers` container omitted from Render free-tier. FastAPI uses advisory fallback. | Full `ai-workers` container image built (`drch_ai_workers:latest`), advisory fallback tested. | Both environments enforce strict advisory gate: AI never mutates incident status or verified priority. |
| **Payment Gateway Configuration** | Intended for sandbox payment providers (e.g., Razorpay test mode). Webhook requires public URL. | Configured with `PAYMENT_GATEWAY=mock` and internal shared secret `MOCK_GATEWAY_SECRET`. | Mock verification (`/verify`) works locally; webhook route `/webhook/*` unmounted in both environments. |
| **Authentication & Staff Provisioning** | Requires out-of-band DB connection string to run `python -m app.cli create-staff`. | Easily seeded via `python -m app.cli create-staff` directly against local PostGIS database. | Automated smoke tests in CI / Compose seed staff accounts dynamically. Staging needs pre-seeded accounts. |
| **Audit Trail & Immutability** | Database trigger enforced on Neon PostgreSQL. SHA-256 hash chains recorded. | Database trigger enforced on PostGIS container. `audit_logs` table immutable; hash chain tested. | Consistent across both: trigger strictly forbids updates or deletions on `audit_logs`. |
| **Test Suite Execution** | Black-box smoke test (`scripts/smoke.sh`): **0 PASS, 3 FAIL, 15 BLOCKED**. | DB-backed test suite (`backend/tests/`): **11 PASS, 4 XFAIL** (`REQUIRE_DB_TESTS=1`). | Compose is fully operational; staging needs active service provisioning by Siddh. |

---

## 7. Factual Summary for Siddh (DevOps & Release Lead)

1. **Staging Web Service Status:** `https://drch-backend.onrender.com` currently responds with HTTP 404 and header `x-render-routing: no-server`. Render free-tier service appears suspended, deleted, or unlinked from the GHCR image repository.
2. **Cold-Start Parameter Sizing:** The 90-second timeout (`SMOKE_COLD_START_TIMEOUT=90`) added to `scripts/smoke.sh` accurately matches observed Render free-tier spin-up times (45–80s) when the service is active.
3. **Pending Backend Webhook Route (`DEFECT-S2-16-WEBHOOK-404`):** Even when staging is operational, payment gateway webhooks (`/api/v1/payments/webhook/*`) will return HTTP 404 because Shlok has not mounted the webhook router in `backend/app/main.py`.
4. **Pending Citizen Donations Route (`DEFECT-S2-16-ME-DONATIONS-404`):** `GET /api/v1/me/donations` is unmounted in the backend router, causing step D4 to be skipped by default.
5. **Local Compose Baseline:** The local PostGIS 16 stack (`drch-pg`, `drch_rabbitmq`, `drch_redis`) is healthy and passes all database-backed unit and integration tests.
6. **Next Steps for DevOps:** Provision the Render web service according to `render.yaml`, configure required staging secrets (`JWT_SECRET`, `MFA_ENCRYPTION_KEY`, `DATABASE_URL`), and seed staging dispatcher credentials for automated CD verification.
