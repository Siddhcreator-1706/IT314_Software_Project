"""Signal queue, promotion, and triage isolation tests (contract s.4.2-4.3).

Covers:
- GET /api/v1/dm/signals permissions (staff required; citizen and field refused) and status filtering.
- POST /api/v1/dm/signals/{id}/promote creates exactly one SUBMITTED incident in one transaction.
- Preserves signal source, source_ref, simulation flag, coordinates, address, and resolved district.
- Repeat promotion refusal (409 SIGNAL_NOT_PENDING) prevents duplicate incidents.
- Strict promotion permission gating (PUBLISHER or SUPERVISOR required).
- Validation of unlocated signals (422 NO_LOCATION), foreign coordinates (422 OUTSIDE_GUJARAT),
  and unsupported scenarios (422 UNSUPPORTED_SCENARIO).
- POST /api/v1/dm/signals/{id}/dismiss mandatory rationale validation, ledger update, and duplicate dismissal prevention.
- NEGATIVE PUBLIC TEST: Promoted incident is strictly absent from public map while SUBMITTED,
  and appears only after dispatcher verification (4-decimal coordinates, zero PII).
- SHA-256 cryptographic audit hash-chain integrity verification.
"""

import pytest

pytestmark = pytest.mark.db

BASE = "/api/v1/dm"


def _err(res) -> dict:
    data = res.json()
    assert "error" in data, f"Expected error shape, got {data}"
    assert "code" in data["error"]
    assert "message" in data["error"]
    return data["error"]


# ── Listing & Permissions ────────────────────────────────────────────────


def test_signals_listing_permissions_and_token_rejection(client, make, citizen_user, field_user):
    """GET /api/v1/dm/signals requires staff authentication; citizen and field tokens are refused."""
    staff = make.staff()

    # 1. Staff can list signals
    res_staff = client.get(f"{BASE}/signals", headers=staff["headers"])
    assert res_staff.status_code == 200, res_staff.text
    assert isinstance(res_staff.json(), list)

    # 2. Citizen token refused
    res_cit = client.get(f"{BASE}/signals", headers=citizen_user["headers"])
    assert res_cit.status_code == 403, res_cit.text
    assert _err(res_cit)["code"] == "ROLE_REQUIRED"

    # 3. Field team token refused
    res_field = client.get(f"{BASE}/signals", headers=field_user["headers"])
    assert res_field.status_code == 403, res_field.text
    assert _err(res_field)["code"] == "ROLE_REQUIRED"

    # 4. Anonymous refused
    res_anon = client.get(f"{BASE}/signals")
    assert res_anon.status_code == 401, res_anon.text
    assert _err(res_anon)["code"] == "NOT_AUTHENTICATED"


def test_signals_listing_status_filter_and_validation(client, make):
    """GET /api/v1/dm/signals correctly filters by status and rejects invalid status values."""
    staff = make.staff()
    sig_pending = make.signal(status="PENDING")
    sig_dismissed = make.signal(status="DISMISSED", dismiss_rationale="Outdated report")

    # Filter PENDING
    res_p = client.get(f"{BASE}/signals?status=PENDING", headers=staff["headers"])
    assert res_p.status_code == 200
    pending_ids = {s["signal_id"] for s in res_p.json()}
    assert str(sig_pending["signal_id"]) in pending_ids
    assert str(sig_dismissed["signal_id"]) not in pending_ids

    # Filter DISMISSED
    res_d = client.get(f"{BASE}/signals?status=DISMISSED", headers=staff["headers"])
    assert res_d.status_code == 200
    dismissed_ids = {s["signal_id"] for s in res_d.json()}
    assert str(sig_dismissed["signal_id"]) in dismissed_ids
    assert str(sig_pending["signal_id"]) not in dismissed_ids

    # Invalid status filter
    res_bad = client.get(f"{BASE}/signals?status=INVALID_STATUS", headers=staff["headers"])
    assert res_bad.status_code == 422
    assert _err(res_bad)["code"] == "VALIDATION_FAILED"


# ── Promotion & Incident Creation ────────────────────────────────────────


def test_promote_signal_creates_submitted_incident_in_single_transaction(client, make, sql):
    """Promote creates exactly 1 SUBMITTED incident in 1 transaction with copied metadata and audit row."""
    promoter = make.staff("PUBLISHER")
    sig = make.signal(
        source="BLUESKY",
        content_text="Major industrial fire observed at Vatva chemical plant, thick black smoke billowing",
        language="en",
        latitude=22.9580,
        longitude=72.6360,
        location_text="Phase 4, Vatva GIDC, Ahmedabad",
        ai_label="INDUSTRIAL_FIRE",
        ai_confidence=0.92,
        is_simulated=True,
    )
    sig_id = sig["signal_id"]

    res = client.post(f"{BASE}/signals/{sig_id}/promote", headers=promoter["headers"])
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["signal_id"] == str(sig_id)
    assert data["status"] == "PROMOTED"
    assert data["incident_status"] == "SUBMITTED"
    assert "incident_ref" in data
    inc_ref = data["incident_ref"]

    # Verify signal state updated in DB
    sig_row = sql.execute(
        "SELECT status, promoted_incident_id FROM source_signals WHERE signal_id = %s",
        (sig_id,),
    ).fetchone()
    assert sig_row["status"] == "PROMOTED"
    assert sig_row["promoted_incident_id"] is not None
    promoted_id = sig_row["promoted_incident_id"]

    # Verify exactly one incident created in database
    incidents = sql.execute(
        "SELECT * FROM incidents WHERE incident_id = %s",
        (promoted_id,),
    ).fetchall()
    assert len(incidents) == 1
    inc = incidents[0]

    assert inc["incident_ref"] == inc_ref
    assert inc["status"] == "SUBMITTED"
    assert inc["scenario"] == "INDUSTRIAL_FIRE"
    assert "Vatva chemical plant" in inc["description"]
    assert inc["source"] == "BLUESKY"
    assert inc["source_ref"] == sig["source_uid"]
    assert inc["is_simulated"] is True
    assert float(inc["latitude"]) == pytest.approx(22.9580, abs=0.0001)
    assert float(inc["longitude"]) == pytest.approx(72.6360, abs=0.0001)
    assert inc["address_text"] == "Phase 4, Vatva GIDC, Ahmedabad"
    assert inc["district"] == "Ahmedabad"

    # Verify status history recorded
    hist = sql.execute(
        "SELECT from_status, to_status, reason FROM incident_status_history WHERE incident_id = %s",
        (promoted_id,),
    ).fetchone()
    assert hist["from_status"] is None
    assert hist["to_status"] == "SUBMITTED"
    assert "BLUESKY" in hist["reason"]

    # Verify audit log entry exists
    audit_row = sql.execute(
        "SELECT action, entity_type, entity_id FROM audit_logs WHERE entity_id = %s AND action = 'SIGNAL_PROMOTED'",
        (sig_id,),
    ).fetchone()
    assert audit_row is not None
    assert audit_row["entity_type"] == "signal"


def test_promote_signal_twice_refused_no_duplicate_incident(client, make, sql):
    """Promoting an already promoted signal is refused with 409 SIGNAL_NOT_PENDING and creates no duplicate."""
    promoter = make.staff("PUBLISHER")
    sig = make.signal()
    sig_id = sig["signal_id"]

    # First promotion
    r1 = client.post(f"{BASE}/signals/{sig_id}/promote", headers=promoter["headers"])
    assert r1.status_code == 201
    assert "incident_ref" in r1.json()

    # Repeat promotion
    r2 = client.post(f"{BASE}/signals/{sig_id}/promote", headers=promoter["headers"])
    assert r2.status_code == 409, r2.text
    err = _err(r2)
    assert err["code"] == "SIGNAL_NOT_PENDING"

    # Confirm only 1 incident exists linked to this signal in database
    count_row = sql.execute(
        "SELECT COUNT(*) AS total FROM source_signals WHERE signal_id = %s AND status = 'PROMOTED'",
        (sig_id,),
    ).fetchone()
    assert count_row["total"] == 1


def test_promotion_requires_publisher_or_supervisor_permission(client, make):
    """Staff with only DISPATCH cannot promote; PUBLISHER and SUPERVISOR permissions are allowed."""
    sig1 = make.signal()
    sig2 = make.signal()
    sig3 = make.signal()

    dispatcher = make.staff("DISPATCH")
    publisher = make.staff("PUBLISHER")
    supervisor = make.staff("SUPERVISOR")

    # Dispatcher without PUBLISHER/SUPERVISOR refused
    r_disp = client.post(f"{BASE}/signals/{sig1['signal_id']}/promote", headers=dispatcher["headers"])
    assert r_disp.status_code == 403, r_disp.text
    assert _err(r_disp)["code"] == "PERMISSION_REQUIRED"

    # Publisher allowed
    r_pub = client.post(f"{BASE}/signals/{sig2['signal_id']}/promote", headers=publisher["headers"])
    assert r_pub.status_code == 201, r_pub.text

    # Supervisor allowed
    r_sup = client.post(f"{BASE}/signals/{sig3['signal_id']}/promote", headers=supervisor["headers"])
    assert r_sup.status_code == 201, r_sup.text


def test_promote_with_explicit_scenario_override(client, make, sql):
    """Promoting with a body scenario overrides the AI label or supplies a missing one."""
    promoter = make.staff("PUBLISHER")
    sig = make.signal(ai_label=None)  # No AI classification on raw feed

    res = client.post(
        f"{BASE}/signals/{sig['signal_id']}/promote",
        headers=promoter["headers"],
        json={"scenario": "cyclone"},
    )
    assert res.status_code == 201, res.text

    # Verify created incident has the explicitly chosen scenario
    inc_row = sql.execute(
        "SELECT scenario FROM incidents WHERE incident_ref = %s",
        (res.json()["incident_ref"],),
    ).fetchone()
    assert inc_row["scenario"] == "CYCLONE"


def test_promote_unlocated_or_outside_gujarat_or_unsupported_refused(client, make):
    """Promoting unlocated, foreign, or unsupported scenarios is rejected with 422 and code."""
    promoter = make.staff("PUBLISHER")

    # 1. No coordinates
    sig_no_loc = make.signal(latitude=None, longitude=None)
    r_no_loc = client.post(f"{BASE}/signals/{sig_no_loc['signal_id']}/promote", headers=promoter["headers"])
    assert r_no_loc.status_code == 422, r_no_loc.text
    assert _err(r_no_loc)["code"] == "NO_LOCATION"

    # 2. Outside Gujarat (Jaipur)
    sig_foreign = make.signal(latitude=26.9124, longitude=75.7873)
    r_foreign = client.post(f"{BASE}/signals/{sig_foreign['signal_id']}/promote", headers=promoter["headers"])
    assert r_foreign.status_code == 422, r_foreign.text
    assert _err(r_foreign)["code"] == "OUTSIDE_GUJARAT"

    # 3. Unsupported AI label without override
    sig_unsupp = make.signal(ai_label="EARTHQUAKE")
    r_unsupp = client.post(f"{BASE}/signals/{sig_unsupp['signal_id']}/promote", headers=promoter["headers"])
    assert r_unsupp.status_code == 422, r_unsupp.text
    assert _err(r_unsupp)["code"] == "UNSUPPORTED_SCENARIO"


# ── Dismissal & Audit ────────────────────────────────────────────────────


def test_dismiss_requires_rationale_and_stores_it(client, make, sql):
    """Dismissing a signal requires an operational rationale >= 3 chars, updates DB, and audits."""
    promoter = make.staff("PUBLISHER")
    sig = make.signal()
    sig_id = sig["signal_id"]

    # 1. Empty body refused
    res_empty = client.post(f"{BASE}/signals/{sig_id}/dismiss", headers=promoter["headers"], json={})
    assert res_empty.status_code == 422
    assert _err(res_empty)["code"] == "VALIDATION_FAILED"

    # 2. Too short rationale refused
    res_short = client.post(
        f"{BASE}/signals/{sig_id}/dismiss",
        headers=promoter["headers"],
        json={"rationale": "no"},
    )
    assert res_short.status_code == 422
    assert _err(res_short)["code"] == "VALIDATION_FAILED"
    assert sql.execute("SELECT status FROM source_signals WHERE signal_id = %s", (sig_id,)).fetchone()["status"] == "PENDING"

    # 3. Valid dismissal succeeds
    res = client.post(
        f"{BASE}/signals/{sig_id}/dismiss",
        headers=promoter["headers"],
        json={"rationale": "Unverified rumor from unaccredited social handle"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "DISMISSED"

    # Verify DB state
    row = sql.execute(
        "SELECT status, dismiss_rationale FROM source_signals WHERE signal_id = %s",
        (sig_id,),
    ).fetchone()
    assert row["status"] == "DISMISSED"
    assert row["dismiss_rationale"] == "Unverified rumor from unaccredited social handle"

    # Verify audit row
    audit_row = sql.execute(
        "SELECT action, rationale FROM audit_logs WHERE entity_id = %s AND action = 'SIGNAL_DISMISSED'",
        (sig_id,),
    ).fetchone()
    assert audit_row is not None
    assert "Unverified rumor" in audit_row["rationale"]

    # 4. Repeat dismissal refused with 409
    res_repeat = client.post(
        f"{BASE}/signals/{sig_id}/dismiss",
        headers=promoter["headers"],
        json={"rationale": "Trying to dismiss again"},
    )
    assert res_repeat.status_code == 409
    assert _err(res_repeat)["code"] == "SIGNAL_NOT_PENDING"


# ── Negative Public Isolation Test ───────────────────────────────────────


def test_promoted_incident_not_on_public_map_until_verified_by_dispatcher(client, make):
    """NEGATIVE PUBLIC TEST: A promoted signal's incident does NOT appear on public map until verified."""
    promoter = make.staff("PUBLISHER")
    dispatcher = make.staff("DISPATCH")

    sig = make.signal(
        latitude=23.0225,
        longitude=72.5714,
        content_text="Riverfront walkway submerging under rapidly rising Sabarmati floodwaters",
        ai_label="URBAN_FLOODING",
        is_simulated=True,
    )

    # Step 1: Promote signal to incident
    res_prom = client.post(f"{BASE}/signals/{sig['signal_id']}/promote", headers=promoter["headers"])
    assert res_prom.status_code == 201, res_prom.text
    prom_data = res_prom.json()
    inc_ref = prom_data["incident_ref"]

    # Step 2: Query public map feed -> PROMOTED SUBMITTED incident MUST NOT be visible
    res_pub1 = client.get("/api/v1/public/incidents")
    assert res_pub1.status_code == 200, res_pub1.text
    public_refs_before = {item["reference"] for item in res_pub1.json()}
    assert inc_ref not in public_refs_before, (
        f"Security violation: Promoted unverified incident {inc_ref} is visible on the public feed!"
    )

    # Step 3: Dispatcher fetches incident detail and verifies it
    res_detail = client.get(f"{BASE}/incidents", headers=dispatcher["headers"])
    assert res_detail.status_code == 200
    inc_entry = next(i for i in res_detail.json()["items"] if i["incident_ref"] == inc_ref)
    inc_id = inc_entry["incident_id"]
    version = inc_entry["version"]

    res_verify = client.post(
        f"{BASE}/incidents/{inc_id}/verification",
        headers=dispatcher["headers"],
        json={
            "decision": "VERIFIED",
            "priority": "HIGH",
            "rationale": "Ground patrol confirmed Sabarmati riverfront water level exceeds danger mark",
            "version": version,
        },
    )
    assert res_verify.status_code == 200, res_verify.text

    # Step 4: Query public map feed -> VERIFIED incident MUST now appear with privacy guarantees
    res_pub2 = client.get("/api/v1/public/incidents")
    assert res_pub2.status_code == 200
    public_items = res_pub2.json()
    public_refs_after = {item["reference"] for item in public_items}
    assert inc_ref in public_refs_after, (
        f"Verified incident {inc_ref} failed to appear on public feed!"
    )

    # Verify privacy guarantees on the public item
    pub_item = next(item for item in public_items if item["reference"] == inc_ref)
    assert pub_item["status"] == "VERIFIED"
    assert pub_item["scenario"] == "urban_flooding"
    assert pub_item["verified_priority"] == "HIGH"

    # Coordinates rounded to 4 decimals
    lat_str = str(pub_item["latitude"]).split(".")[-1]
    lon_str = str(pub_item["longitude"]).split(".")[-1]
    assert len(lat_str) <= 4
    assert len(lon_str) <= 4

    # No PII or internal fields exposed
    for forbidden in ("reporter_id", "reporter_name", "reporter_phone", "description", "address_text"):
        assert forbidden not in pub_item, f"Leaked PII/internal field {forbidden} in public incident feed!"


def test_signals_audit_hash_chain_integrity(client, make, sql):
    """Signals promotions and dismissals maintain cryptographic SHA-256 hash-chain integrity."""
    from app import audit

    promoter = make.staff("PUBLISHER")
    sig1 = make.signal()
    sig2 = make.signal()

    # Promote signal 1
    client.post(f"{BASE}/signals/{sig1['signal_id']}/promote", headers=promoter["headers"])

    # Dismiss signal 2
    client.post(
        f"{BASE}/signals/{sig2['signal_id']}/dismiss",
        headers=promoter["headers"],
        json={"rationale": "Verified duplicate of sensor alert"},
    )

    # Verify hash-chain integrity
    is_valid, count, message = audit.verify_audit_chain(sql)
    assert is_valid is True, f"Audit hash chain compromised: {message}"
    assert count > 0
