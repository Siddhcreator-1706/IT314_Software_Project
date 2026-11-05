"""Donation orders, payment verification, and webhook tests (contract s.6, s.7).

Covers:
- POST /api/v1/donations: order creation, order ID generation, Idempotency-Key validation.
- Donation validation: amount <= 0, invalid currency, inactive campaign, unauthenticated guest rules.
- GET /api/v1/public/campaigns: strictly only ACTIVE campaigns listed.
- POST /api/v1/donations/{id}/verify: valid HMAC signature confirms donation, assigns receipt_no
  and receipt_issued_at in a single transaction.
- Rejection of tampered signatures (donation stays PENDING, failure audited).
- Idempotent replaying of verified payment callbacks (no duplicate confirmation or receipt).
- Rejection of wrong order ID, mismatching payment, or non-existent donation.
- Rejection of unverified state transitions: donations remain PENDING until verified.
- Sandbox labeling (is_sandbox=True) and production hiding of mock payment generation.
- Donor isolation and privacy: signed-in citizen donations private from other citizens.
- Webhook handlers: defect notes and xfail coverage for missing webhook routes (Owner: Shlok).
- Donor history: defect note and xfail coverage for missing GET /api/v1/me/donations (Owner: Shlok / Zalak).
- SHA-256 cryptographic audit hash-chain integrity verification across donation lifecycle.
"""

import hashlib
import hmac
import json
import os
import uuid

import pytest

pytestmark = pytest.mark.db

BASE_DONATIONS = "/api/v1/donations"
TEST_MOCK_SECRET = "unit-test-gateway-secret-0123456789"


@pytest.fixture(autouse=True)
def _gateway_secrets(monkeypatch):
    """Configure deterministic gateway test secrets via environment variables."""
    from app.config import get_settings

    monkeypatch.setenv("MOCK_GATEWAY_SECRET", TEST_MOCK_SECRET)
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_mockkey123")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "test-razorpay-key-secret")
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "test-razorpay-webhook-secret")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _sign_mock(order_id: str, payment_id: str) -> str:
    """Deterministic HMAC-SHA256 signature generator mirroring MockGateway."""
    secret = os.getenv("MOCK_GATEWAY_SECRET", "").encode()
    return hmac.new(secret, f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def _sign_webhook(body_bytes: bytes) -> str:
    """Deterministic HMAC-SHA256 signature for webhook payloads."""
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "test-razorpay-webhook-secret").encode()
    return hmac.new(secret, body_bytes, hashlib.sha256).hexdigest()


def _create_donation(client, campaign, key=None, headers=None, **extra):
    """Helper to post a donation order."""
    body = {
        "campaign_id": str(campaign["campaign_id"]),
        "amount": 2500.00,
        "currency": "INR",
        "guest_name": "Suresh Mehta",
        "guest_email": "suresh.mehta@example.in",
        "is_anonymous": False,
        **extra,
    }
    hdrs = {"Idempotency-Key": key or f"idemp-{uuid.uuid4().hex[:12]}", **(headers or {})}
    return client.post(BASE_DONATIONS, json=body, headers=hdrs)


# ── Order Creation & Idempotency ──────────────────────────────────────────


def test_create_donation_order_and_idempotency(client, campaign):
    """Create-order returns an order ID and gateway details; duplicate key returns same donation."""
    key = f"key-{uuid.uuid4().hex[:12]}"
    res1 = _create_donation(client, campaign, key=key)
    assert res1.status_code == 201, res1.text
    order1 = res1.json()

    assert "donation_id" in order1
    assert order1["gateway_name"] == "MOCK_GATEWAY"
    assert order1["gateway_order_id"].startswith("order_mock_")
    assert float(order1["amount"]) == pytest.approx(2500.00)
    assert order1["currency"] == "INR"
    assert order1["status"] == "PENDING"
    assert order1["is_sandbox"] is True

    # Same Idempotency-Key returns 200 OK with identical donation record
    res2 = _create_donation(client, campaign, key=key)
    assert res2.status_code == 200, res2.text
    order2 = res2.json()
    assert order2["donation_id"] == order1["donation_id"]
    assert order2["gateway_order_id"] == order1["gateway_order_id"]

    # Reusing Idempotency-Key with different amount returns 409 Conflict
    res_conflict = _create_donation(client, campaign, key=key, amount=5000.00)
    assert res_conflict.status_code == 409
    assert res_conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"

    # Missing Idempotency-Key header is rejected with 422
    body = {
        "campaign_id": str(campaign["campaign_id"]),
        "amount": 1000.00,
        "currency": "INR",
        "guest_email": "donor@example.in",
    }
    res_missing_key = client.post(BASE_DONATIONS, json=body)
    assert res_missing_key.status_code == 422
    assert res_missing_key.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"


def test_create_donation_validation_rules(client, campaign):
    """Amount <= 0, wrong currency, inactive campaign, and invalid guests are refused."""
    # Amount <= 0 refused
    res_zero = _create_donation(client, campaign, amount=0)
    assert res_zero.status_code == 422, res_zero.text

    res_neg = _create_donation(client, campaign, amount=-250.00)
    assert res_neg.status_code == 422, res_neg.text

    # Wrong currency refused (only INR permitted)
    res_curr = _create_donation(client, campaign, currency="USD")
    assert res_curr.status_code == 422, res_curr.text

    # Guest without email and not anonymous refused
    res_no_email = client.post(
        BASE_DONATIONS,
        json={"campaign_id": str(campaign["campaign_id"]), "amount": 1000.00, "is_anonymous": False},
        headers={"Idempotency-Key": f"key-{uuid.uuid4().hex[:12]}"},
    )
    assert res_no_email.status_code == 422
    assert res_no_email.json()["error"]["code"] == "VALIDATION_FAILED"

    # Non-existent campaign returns 404
    res_no_camp = _create_donation(client, {"campaign_id": uuid.uuid4()})
    assert res_no_camp.status_code == 404


def test_public_campaigns_lists_only_active_campaigns(client, make):
    """Only ACTIVE campaigns appear in GET /api/v1/public/campaigns."""
    active_c = make.campaign(title="Active Cyclone Relief", status="ACTIVE")
    closed_c = make.campaign(title="Closed Earthquake Drive", status="CLOSED")
    draft_c = make.campaign(title="Draft Flood Initiative", status="DRAFT")

    res = client.get("/api/v1/public/campaigns")
    assert res.status_code == 200, res.text
    campaigns = res.json()
    camp_ids = {c["campaign_id"] for c in campaigns}

    assert str(active_c["campaign_id"]) in camp_ids, "Active campaign not found in public list"
    assert str(closed_c["campaign_id"]) not in camp_ids, "Closed campaign leaked into public list"
    assert str(draft_c["campaign_id"]) not in camp_ids, "Draft campaign leaked into public list"

    # Verify closed campaign rejects donation creations
    res_closed_order = _create_donation(client, closed_c)
    assert res_closed_order.status_code == 409
    assert res_closed_order.json()["error"]["code"] == "CAMPAIGN_NOT_ACTIVE"


# ── Verification & Receipt Generation ────────────────────────────────────


def test_verify_valid_signature_confirms_donation_and_issues_receipt(client, campaign, sql):
    """Verify with a valid signature sets CONFIRMED, receipt_no, and receipt_issued_at in one transaction."""
    res_order = _create_donation(client, campaign)
    assert res_order.status_code == 201
    order = res_order.json()
    don_id = order["donation_id"]
    order_id = order["gateway_order_id"]

    payment_id = "pay_mock_" + uuid.uuid4().hex[:12]
    valid_sig = _sign_mock(order_id, payment_id)

    res_verify = client.post(
        f"{BASE_DONATIONS}/{don_id}/verify",
        json={"gateway_payment_id": payment_id, "signature": valid_sig},
    )
    assert res_verify.status_code == 200, res_verify.text
    data = res_verify.json()

    assert data["donation_id"] == don_id
    assert data["status"] == "CONFIRMED"
    assert data["receipt_no"].startswith("REC-")
    assert data["receipt_issued_at"] is not None
    receipt_no = data["receipt_no"]

    # Verify DB consistency in a single atomic transaction
    row = sql.execute(
        """
        SELECT status, gateway_payment_id, gateway_txn_ref, receipt_no,
               receipt_issued_at, confirmed_at, verified_at
        FROM donations WHERE donation_id = %s
        """,
        (don_id,),
    ).fetchone()
    assert row["status"] == "CONFIRMED"
    assert row["gateway_payment_id"] == payment_id
    assert row["gateway_txn_ref"] == payment_id
    assert row["receipt_no"] == receipt_no
    assert row["receipt_issued_at"] is not None
    assert row["confirmed_at"] is not None
    assert row["verified_at"] is not None

    # Verify audit row
    audit_row = sql.execute(
        "SELECT action, entity_type, entity_id FROM audit_logs WHERE entity_id = %s AND action = 'DONATION_CONFIRMED'",
        (don_id,),
    ).fetchone()
    assert audit_row is not None
    assert audit_row["entity_type"] == "donation"


def test_tampered_signature_is_rejected_and_donation_stays_pending(client, campaign, sql):
    """Tampered signature is rejected (400 INVALID_SIGNATURE) and the donation stays PENDING."""
    res_order = _create_donation(client, campaign)
    assert res_order.status_code == 201
    order = res_order.json()
    don_id = order["donation_id"]

    # Use explicitly tampered signature
    res_bad = client.post(
        f"{BASE_DONATIONS}/{don_id}/verify",
        json={"gateway_payment_id": "pay_mock_bad_12345", "signature": "0" * 64},
    )
    assert res_bad.status_code == 400
    assert res_bad.json()["error"]["code"] == "INVALID_SIGNATURE"

    # Confirm database row remained strictly PENDING with no receipt issued
    row = sql.execute(
        "SELECT status, receipt_no, confirmed_at FROM donations WHERE donation_id = %s",
        (don_id,),
    ).fetchone()
    assert row["status"] == "PENDING"
    assert row["receipt_no"] is None
    assert row["confirmed_at"] is None

    # Confirm security rejection was audited
    audit_row = sql.execute(
        """
        SELECT action, entity_id, result FROM audit_logs
        WHERE entity_id = %s AND action = 'DONATION_SIGNATURE_REJECTED'
        """,
        (don_id,),
    ).fetchone()
    assert audit_row is not None
    assert audit_row["result"] == "FAILURE"


def test_replay_verified_payment_changes_nothing(client, campaign):
    """Replaying a verified payment is idempotent: returns same receipt and creates no changes."""
    order = _create_donation(client, campaign).json()
    don_id = order["donation_id"]
    order_id = order["gateway_order_id"]

    payment_id = "pay_mock_" + uuid.uuid4().hex[:12]
    sig = _sign_mock(order_id, payment_id)
    verify_payload = {"gateway_payment_id": payment_id, "signature": sig}

    # First verification
    r1 = client.post(f"{BASE_DONATIONS}/{don_id}/verify", json=verify_payload)
    assert r1.status_code == 200
    first_receipt = r1.json()["receipt_no"]
    first_time = r1.json()["receipt_issued_at"]

    # Replay of the exact same payment verification
    r2 = client.post(f"{BASE_DONATIONS}/{don_id}/verify", json=verify_payload)
    assert r2.status_code == 200
    assert r2.json()["receipt_no"] == first_receipt
    assert r2.json()["receipt_issued_at"] == first_time
    assert r2.json()["status"] == "CONFIRMED"


def test_verify_wrong_order_or_payment_is_rejected(client, campaign):
    """Wrong order ID in signature or different payment ID on verified donation is refused."""
    order = _create_donation(client, campaign).json()
    don_id = order["donation_id"]
    order_id = order["gateway_order_id"]

    # 1. Signature calculated for an illegitimate/different order ID
    payment_id = "pay_mock_" + uuid.uuid4().hex[:12]
    wrong_order_sig = _sign_mock("order_mock_foreign_order_999", payment_id)

    res_wrong_order = client.post(
        f"{BASE_DONATIONS}/{don_id}/verify",
        json={"gateway_payment_id": payment_id, "signature": wrong_order_sig},
    )
    assert res_wrong_order.status_code == 400
    assert res_wrong_order.json()["error"]["code"] == "INVALID_SIGNATURE"

    # 2. Complete genuine verification first
    valid_sig = _sign_mock(order_id, payment_id)
    res_ok = client.post(
        f"{BASE_DONATIONS}/{don_id}/verify",
        json={"gateway_payment_id": payment_id, "signature": valid_sig},
    )
    assert res_ok.status_code == 200

    # 3. Attempting to verify same confirmed donation with a different payment ID returns 409
    other_pay_id = "pay_mock_different_" + uuid.uuid4().hex[:8]
    other_sig = _sign_mock(order_id, other_pay_id)
    res_conflict = client.post(
        f"{BASE_DONATIONS}/{don_id}/verify",
        json={"gateway_payment_id": other_pay_id, "signature": other_sig},
    )
    assert res_conflict.status_code == 409
    assert res_conflict.json()["error"]["code"] == "ALREADY_CONFIRMED"

    # 4. Verifying non-existent donation returns 404
    res_not_found = client.post(
        f"{BASE_DONATIONS}/{uuid.uuid4()}/verify",
        json={"gateway_payment_id": payment_id, "signature": valid_sig},
    )
    assert res_not_found.status_code == 404


def test_nothing_becomes_confirmed_without_verification(client, campaign, sql):
    """Nothing becomes CONFIRMED without verification; sandbox-payment endpoint does not mutate status."""
    order = _create_donation(client, campaign).json()
    don_id = order["donation_id"]

    # Check database right after order creation
    row = sql.execute("SELECT status, receipt_no, confirmed_at FROM donations WHERE donation_id = %s", (don_id,)).fetchone()
    assert row["status"] == "PENDING"
    assert row["receipt_no"] is None
    assert row["confirmed_at"] is None

    # Request sandbox payment simulation credentials
    pay_res = client.post(f"{BASE_DONATIONS}/{don_id}/sandbox-payment")
    assert pay_res.status_code == 200
    pay_info = pay_res.json()
    assert "gateway_payment_id" in pay_info
    assert "signature" in pay_info

    # Status must strictly remain PENDING until verify is explicitly called
    row2 = sql.execute("SELECT status, receipt_no, confirmed_at FROM donations WHERE donation_id = %s", (don_id,)).fetchone()
    assert row2["status"] == "PENDING"
    assert row2["receipt_no"] is None
    assert row2["confirmed_at"] is None


def test_response_labelled_sandbox_and_production_isolation(client, campaign, monkeypatch):
    """Responses are labeled is_sandbox=True; sandbox-payment endpoint is hidden in production."""
    from app.config import get_settings

    order = _create_donation(client, campaign).json()
    assert order["is_sandbox"] is True
    assert order["gateway_name"] == "MOCK_GATEWAY"

    # In production environment, sandbox-payment simulation endpoint returns 404
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()
    res_prod = client.post(f"{BASE_DONATIONS}/{order['donation_id']}/sandbox-payment")
    assert res_prod.status_code == 404


def test_signed_in_donor_privacy_and_guest_donation_isolation(client, campaign, make):
    """Donations created by an authenticated citizen are strictly isolated from other users."""
    donor_a = make.citizen()
    donor_b = make.citizen()

    # Donor A creates a donation
    order_a = _create_donation(client, campaign, headers=donor_a["headers"], guest_email=None).json()
    don_id = order_a["donation_id"]

    pay_res = client.post(f"{BASE_DONATIONS}/{don_id}/sandbox-payment", headers=donor_a["headers"])
    assert pay_res.status_code == 200
    pay_data = pay_res.json()

    # Donor B tries to inspect or verify Donor A's donation -> 404 (not found / forbidden leakage guard)
    res_b_verify = client.post(f"{BASE_DONATIONS}/{don_id}/verify", json=pay_data, headers=donor_b["headers"])
    assert res_b_verify.status_code == 404

    res_b_sandbox = client.post(f"{BASE_DONATIONS}/{don_id}/sandbox-payment", headers=donor_b["headers"])
    assert res_b_sandbox.status_code == 404

    # Donor A verifies their own donation -> succeeds
    res_a_verify = client.post(f"{BASE_DONATIONS}/{don_id}/verify", json=pay_data, headers=donor_a["headers"])
    assert res_a_verify.status_code == 200


# ── Webhook Defect Notes & XFAIL Tests (Owner: Shlok) ─────────────────────


@pytest.mark.xfail(
    strict=True,
    reason="DEFECT-S2-16-WEBHOOK-404: POST /api/v1/payments/webhook/{gateway} not implemented by Shlok",
)
def test_payments_webhook_valid_signature_confirms_donation(client, campaign, sql):
    """Defect Note:
    Route: POST /api/v1/payments/webhook/{gateway} (or /payments/webhook/{gateway})
    Input: Valid HMAC-SHA256 signed payment webhook event (payment.captured)
    Expected: 200 OK, donation status updated to CONFIRMED, receipt_no issued
    Actual: 404 Not Found (endpoint not mounted in FastAPI app)
    Owner: Shlok
    """
    order = _create_donation(client, campaign).json()
    don_id = order["donation_id"]
    order_id = order["gateway_order_id"]
    payment_id = "pay_mock_" + uuid.uuid4().hex[:12]

    payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": payment_id,
                    "order_id": order_id,
                    "amount": 250000,
                    "currency": "INR",
                    "status": "captured",
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode()
    signature = _sign_webhook(raw_body)

    res = client.post(
        "/api/v1/payments/webhook/razorpay",
        content=raw_body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
    )
    assert res.status_code == 200, res.text

    # Webhook confirmation should confirm donation in DB
    row = sql.execute("SELECT status, receipt_no FROM donations WHERE donation_id = %s", (don_id,)).fetchone()
    assert row["status"] == "CONFIRMED"
    assert row["receipt_no"] is not None


@pytest.mark.xfail(
    strict=True,
    reason="DEFECT-S2-16-WEBHOOK-404: POST /api/v1/payments/webhook/{gateway} not implemented by Shlok",
)
def test_payments_webhook_idempotent_event_replay_and_tampered_rejection(client, campaign):
    """Defect Note:
    Route: POST /api/v1/payments/webhook/{gateway}
    Input: Repeated event ID or tampered webhook signature
    Expected: Repeated event is idempotent (200 OK); tampered signature is rejected (400)
    Actual: 404 Not Found (endpoint not mounted in FastAPI app)
    Owner: Shlok
    """
    order = _create_donation(client, campaign).json()
    order_id = order["gateway_order_id"]
    payment_id = "pay_mock_" + uuid.uuid4().hex[:12]

    payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": payment_id, "order_id": order_id, "status": "captured"}}},
    }
    raw_body = json.dumps(payload).encode()

    # Tampered signature refused
    res_tampered = client.post(
        "/api/v1/payments/webhook/razorpay",
        content=raw_body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": "invalid-sig-000"},
    )
    assert res_tampered.status_code in (400, 422)


@pytest.mark.xfail(
    strict=True,
    reason="DEFECT-S2-16-WEBHOOK-404: Webhook handler not implemented by Shlok",
)
def test_webhook_before_client_callback_race_condition(client, campaign):
    """Defect Note:
    Route: POST /api/v1/payments/webhook/{gateway} -> POST /api/v1/donations/{id}/verify
    Input: Webhook arrives before client browser callback
    Expected: Webhook confirms donation, subsequent client callback succeeds without double confirmation (same receipt)
    Actual: 404 Not Found on webhook step
    Owner: Shlok
    """
    order = _create_donation(client, campaign).json()
    don_id = order["donation_id"]
    order_id = order["gateway_order_id"]
    payment_id = "pay_mock_" + uuid.uuid4().hex[:12]

    # Step 1: Webhook arrives first
    payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": payment_id, "order_id": order_id, "status": "captured"}}},
    }
    raw_body = json.dumps(payload).encode()
    sig = _sign_webhook(raw_body)
    res_hook = client.post(
        "/api/v1/payments/webhook/razorpay",
        content=raw_body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
    )
    assert res_hook.status_code == 200

    # Step 2: Browser returns with callback
    mock_sig = _sign_mock(order_id, payment_id)
    res_callback = client.post(
        f"{BASE_DONATIONS}/{don_id}/verify",
        json={"gateway_payment_id": payment_id, "signature": mock_sig},
    )
    assert res_callback.status_code == 200
    assert res_callback.json()["status"] == "CONFIRMED"


@pytest.mark.xfail(
    strict=True,
    reason="DEFECT-S2-16-ME-DONATIONS-404: GET /api/v1/me/donations not implemented",
)
def test_me_donations_shows_caller_donations_and_receipts(client, campaign, make):
    """Defect Note:
    Route: GET /api/v1/me/donations (or /api/v1/donations/me)
    Input: Authenticated citizen bearer token
    Expected: 200 OK returning list of caller's donations and receipt_no
    Actual: 404 Not Found (endpoint not mounted in FastAPI app)
    Owner: Shlok / Zalak
    """
    citizen = make.citizen()
    order = _create_donation(client, campaign, headers=citizen["headers"], guest_email=None).json()
    don_id = order["donation_id"]
    order_id = order["gateway_order_id"]

    # Verify donation
    payment_id = "pay_mock_" + uuid.uuid4().hex[:12]
    sig = _sign_mock(order_id, payment_id)
    client.post(
        f"{BASE_DONATIONS}/{don_id}/verify",
        json={"gateway_payment_id": payment_id, "signature": sig},
        headers=citizen["headers"],
    )

    # Fetch citizen donation history
    res = client.get("/api/v1/me/donations", headers=citizen["headers"])
    assert res.status_code == 200
    items = res.json().get("items", res.json())
    don_ids = {item["donation_id"] for item in items}
    assert don_id in don_ids


# ── Audit Hash Chain Integrity ───────────────────────────────────────────


def test_donations_audit_hash_chain_integrity(client, campaign, sql):
    """Donation creation, failed verification, and confirmation preserve audit SHA-256 hash-chain integrity."""
    from app import audit

    # 1. Create donation
    order = _create_donation(client, campaign).json()
    don_id = order["donation_id"]
    order_id = order["gateway_order_id"]

    # 2. Tampered signature attempt (audited failure)
    client.post(
        f"{BASE_DONATIONS}/{don_id}/verify",
        json={"gateway_payment_id": "pay_mock_fake", "signature": "0" * 64},
    )

    # 3. Successful verification (audited success)
    payment_id = "pay_mock_" + uuid.uuid4().hex[:12]
    sig = _sign_mock(order_id, payment_id)
    client.post(
        f"{BASE_DONATIONS}/{don_id}/verify",
        json={"gateway_payment_id": payment_id, "signature": sig},
    )

    # Verify cryptographic hash-chain integrity across all written entries
    is_valid, count, message = audit.verify_audit_chain(sql)
    assert is_valid is True, f"Audit hash chain compromised: {message}"
    assert count > 0
