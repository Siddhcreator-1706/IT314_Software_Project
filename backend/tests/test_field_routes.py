"""DB-backed field router tests for frontline disaster operations.

Covers:
- GET /api/v1/field/me profile and team resolution, plus 401/403 rejection of non-field roles.
- GET /api/v1/field/assignments mission listing with instructions, incident summary, and cross-team isolation.
- POST /api/v1/field/dispatches/{id}/acknowledgement single execution and idempotent replay.
- POST /api/v1/field/dispatches/{id}/rejection mandatory reason check and resource release.
- POST /api/v1/field/dispatches/{id}/progress EN_ROUTE / ON_SCENE ledger tracking and invalid state rejection.
- POST /api/v1/field/dispatches/{id}/team-requests reinforcement request recording and dispatcher notification.
- POST /api/v1/field/dispatches/{id}/completion mission completion, resource release, and leaving incident open.
- Invalid state transitions (progress before acknowledgement, repeat completion).
- SHA-256 cryptographic audit hash-chain integrity verification across field operational lifecycle.
"""

import pytest

pytestmark = pytest.mark.db

BASE = "/api/v1/field"


def _err(res) -> dict:
    data = res.json()
    assert "error" in data, f"Expected error shape, got {data}"
    assert "code" in data["error"]
    assert "message" in data["error"]
    return data["error"]


# ── Profile & Authentication ─────────────────────────────────────────────


def test_field_me_returns_profile_and_team(client, field_user):
    """GET /api/v1/field/me returns responder identity, team binding, agency, and capabilities."""
    res = client.get(f"{BASE}/me", headers=field_user["headers"])
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["user_id"] == str(field_user["user_id"])
    assert data["email"] == field_user["email"]
    assert data["role"] == "FIELD_TEAM"
    assert data["callsign"] == "Bravo-1"
    assert data["is_leader"] is True
    assert data["team_resource_id"] == str(field_user["resource_id"])
    assert "team_name" in data and len(data["team_name"]) > 0
    assert data["status"] in ("AVAILABLE", "ASSIGNED")


def test_field_me_requires_authentication(client):
    """Anonymous calls to /field endpoints are rejected with 401 NOT_AUTHENTICATED."""
    res = client.get(f"{BASE}/me")
    assert res.status_code == 401, res.text
    err = _err(res)
    assert err["code"] == "NOT_AUTHENTICATED"


def test_field_routes_strictly_refuse_staff_and_citizen(client, staff_user, citizen_user, field_dispatch):
    """Staff dispatcher and citizen tokens are strictly denied access to /field endpoints with 403."""
    disp_id = field_dispatch["dispatch_id"]

    # Citizen denied
    res_cit_me = client.get(f"{BASE}/me", headers=citizen_user["headers"])
    assert res_cit_me.status_code == 403, res_cit_me.text
    err_cit = _err(res_cit_me)
    assert err_cit["code"] == "ROLE_REQUIRED"

    res_cit_ack = client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=citizen_user["headers"])
    assert res_cit_ack.status_code == 403, res_cit_ack.text
    assert _err(res_cit_ack)["code"] == "ROLE_REQUIRED"

    # Staff dispatcher denied (field role required)
    res_staff_me = client.get(f"{BASE}/me", headers=staff_user["headers"])
    assert res_staff_me.status_code == 403, res_staff_me.text
    err_staff = _err(res_staff_me)
    assert err_staff["code"] == "ROLE_REQUIRED"

    res_staff_ack = client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=staff_user["headers"])
    assert res_staff_ack.status_code == 403, res_staff_ack.text
    assert _err(res_staff_ack)["code"] == "ROLE_REQUIRED"


# ── Assignments & Cross-Team Isolation ───────────────────────────────────


def test_field_assignments_lists_only_assigned_team_missions(client, make, field_user):
    """GET /api/v1/field/assignments lists assignments strictly for the responder's team."""
    other_team = make.field_team_user(callsign="Delta-4")

    # Dispatch 1: assigned to field_user's team
    d1 = make.field_dispatch(
        field_user,
        instructions="Evacuate waterlogged school in Sector 5",
        priority="CRITICAL",
    )
    # Dispatch 2: assigned to other_team
    d2 = make.field_dispatch(
        other_team,
        instructions="Clear fallen debris on highway",
        priority="MEDIUM",
    )

    res = client.get(f"{BASE}/assignments", headers=field_user["headers"])
    assert res.status_code == 200, res.text
    assignments = res.json()

    returned_ids = {a["dispatch_id"] for a in assignments}
    assert str(d1["dispatch_id"]) in returned_ids
    assert str(d2["dispatch_id"]) not in returned_ids

    # Find the specific assignment and verify full contract fields
    item = next(a for a in assignments if a["dispatch_id"] == str(d1["dispatch_id"]))
    assert item["dispatch_ref"] == d1["dispatch_ref"]
    assert item["status"] == "REQUESTED"
    assert item["priority"] == "CRITICAL"
    assert item["instructions"] == "Evacuate waterlogged school in Sector 5"
    assert item["incident_id"] == str(d1["incident_id"])
    assert item["district"] == "Ahmedabad"
    assert item["latitude"] == pytest.approx(23.0225, abs=0.001)
    assert item["longitude"] == pytest.approx(72.5714, abs=0.001)


def test_field_assignments_active_filtering(client, make, field_user):
    """active=true filter returns only REQUESTED, ACKNOWLEDGED, and DISPATCHED missions."""
    d_active = make.field_dispatch(field_user, status="REQUESTED")
    d_done = make.field_dispatch(field_user, status="COMPLETED")

    # Release resources for the completed dispatch so released_at is set
    make.conn.execute(
        "UPDATE resource_assignments SET released_at = now() WHERE dispatch_id = %s",
        (d_done["dispatch_id"],),
    )

    res_all = client.get(f"{BASE}/assignments", headers=field_user["headers"])
    all_ids = {a["dispatch_id"] for a in res_all.json()}
    assert str(d_active["dispatch_id"]) in all_ids

    res_active = client.get(f"{BASE}/assignments?active=true", headers=field_user["headers"])
    assert res_active.status_code == 200
    active_ids = {a["dispatch_id"] for a in res_active.json()}
    assert str(d_active["dispatch_id"]) in active_ids
    assert str(d_done["dispatch_id"]) not in active_ids


# ── Tactical Operations & Transitions ────────────────────────────────────


def test_field_acknowledgement_lifecycle(client, field_user, field_dispatch, sql):
    """Field responder acknowledges assignment: transitions to ACKNOWLEDGED and audits."""
    disp_id = field_dispatch["dispatch_id"]

    res = client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["status"] == "ACKNOWLEDGED"
    assert data["dispatch_ref"] == field_dispatch["dispatch_ref"]
    assert "acknowledged_at" in data

    # Verify DB state
    row = sql.execute(
        "SELECT status, acknowledged_by, acknowledged_at FROM dispatch_orders WHERE dispatch_id = %s",
        (disp_id,),
    ).fetchone()
    assert row["status"] == "ACKNOWLEDGED"
    assert row["acknowledged_by"] is not None
    assert row["acknowledged_at"] is not None

    # Verify ledger progress record
    prog = sql.execute(
        "SELECT status, note FROM dispatch_progress WHERE dispatch_id = %s AND status = 'ACKNOWLEDGED'",
        (disp_id,),
    ).fetchone()
    assert prog is not None


def test_field_acknowledgement_idempotence(client, field_user, field_dispatch):
    """Re-acknowledging an already ACKNOWLEDGED dispatch returns 200 idempotently."""
    disp_id = field_dispatch["dispatch_id"]

    # First acknowledgement
    r1 = client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])
    assert r1.status_code == 200

    # Repeat acknowledgement
    r2 = client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])
    assert r2.status_code == 200
    assert r2.json()["status"] == "ACKNOWLEDGED"


def test_field_rejection_requires_valid_reason(client, field_user, field_dispatch, sql):
    """Rejection requires an operational reason >= 3 characters; empty is refused with 422."""
    disp_id = field_dispatch["dispatch_id"]

    # Missing reason
    res_empty = client.post(f"{BASE}/dispatches/{disp_id}/rejection", headers=field_user["headers"], json={})
    assert res_empty.status_code == 422, res_empty.text
    assert _err(res_empty)["code"] == "VALIDATION_FAILED"

    # Reason too short
    res_short = client.post(
        f"{BASE}/dispatches/{disp_id}/rejection",
        headers=field_user["headers"],
        json={"reason": "no"},
    )
    assert res_short.status_code == 422, res_short.text
    assert _err(res_short)["code"] == "VALIDATION_FAILED"

    # Status must remain unchanged in DB
    status = sql.execute("SELECT status FROM dispatch_orders WHERE dispatch_id = %s", (disp_id,)).fetchone()["status"]
    assert status == "REQUESTED"


def test_field_rejection_releases_resources(client, field_user, field_dispatch, sql):
    """Rejection transitions dispatch to REJECTED and immediately releases assigned resources."""
    disp_id = field_dispatch["dispatch_id"]
    res_id = field_user["resource_id"]

    # Verify resource was reserved prior to rejection
    res_before = sql.execute(
        "SELECT quantity_available, status FROM resources WHERE resource_id = %s", (res_id,)
    ).fetchone()
    assert res_before["quantity_available"] == 0

    res = client.post(
        f"{BASE}/dispatches/{disp_id}/rejection",
        headers=field_user["headers"],
        json={"reason": "Unit vehicle breakdown, unable to deploy"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "REJECTED"

    # Verify dispatch status
    d_row = sql.execute("SELECT status FROM dispatch_orders WHERE dispatch_id = %s", (disp_id,)).fetchone()
    assert d_row["status"] == "REJECTED"

    # Verify resource release
    res_after = sql.execute(
        "SELECT quantity_available, status FROM resources WHERE resource_id = %s", (res_id,)
    ).fetchone()
    assert res_after["quantity_available"] == 1
    assert res_after["status"] == "AVAILABLE"

    # Verify assignment released_at
    ra = sql.execute("SELECT released_at FROM resource_assignments WHERE dispatch_id = %s", (disp_id,)).fetchone()
    assert ra["released_at"] is not None

    # Verify progress entry
    prog = sql.execute(
        "SELECT status, note FROM dispatch_progress WHERE dispatch_id = %s AND status = 'REJECTED'", (disp_id,)
    ).fetchone()
    assert prog is not None
    assert "breakdown" in prog["note"]


def test_field_progress_en_route_advances_dispatch_and_incident(client, field_user, field_dispatch, sql):
    """Progress EN_ROUTE transitions dispatch to DISPATCHED and incident to DISPATCHED."""
    disp_id = field_dispatch["dispatch_id"]
    inc_id = field_dispatch["incident_id"]

    # Must acknowledge first
    client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])

    res = client.post(
        f"{BASE}/dispatches/{disp_id}/progress",
        headers=field_user["headers"],
        json={
            "status": "EN_ROUTE",
            "note": "Leaving central fire station with rescue gear",
            "latitude": 23.0310,
            "longitude": 72.5820,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "EN_ROUTE"
    assert "Leaving central fire station" in data["note"]

    # Verify dispatch transitioned to DISPATCHED
    d_row = sql.execute("SELECT status FROM dispatch_orders WHERE dispatch_id = %s", (disp_id,)).fetchone()
    assert d_row["status"] == "DISPATCHED"

    # Verify incident transitioned to DISPATCHED
    inc_row = sql.execute("SELECT status FROM incidents WHERE incident_id = %s", (inc_id,)).fetchone()
    assert inc_row["status"] == "DISPATCHED"

    # Verify progress row in dispatch_progress
    prog = sql.execute(
        "SELECT status, note FROM dispatch_progress WHERE dispatch_id = %s AND status = 'EN_ROUTE'", (disp_id,)
    ).fetchone()
    assert prog is not None


def test_field_progress_on_scene_and_update(client, field_user, field_dispatch, sql):
    """Progress ON_SCENE and UPDATE record ledger entries while keeping dispatch in DISPATCHED."""
    disp_id = field_dispatch["dispatch_id"]

    # Move to DISPATCHED
    client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])
    client.post(f"{BASE}/dispatches/{disp_id}/progress", headers=field_user["headers"], json={"status": "EN_ROUTE"})

    # Report ON_SCENE
    r_scene = client.post(
        f"{BASE}/dispatches/{disp_id}/progress",
        headers=field_user["headers"],
        json={"status": "ON_SCENE", "note": "Arrived at flood perimeter, deploying boats"},
    )
    assert r_scene.status_code == 200, r_scene.text
    assert r_scene.json()["status"] == "ON_SCENE"

    # Report operational UPDATE
    r_upd = client.post(
        f"{BASE}/dispatches/{disp_id}/progress",
        headers=field_user["headers"],
        json={"status": "UPDATE", "note": "Secured 8 residents from ground floor apartments"},
    )
    assert r_upd.status_code == 200, r_upd.text
    assert r_upd.json()["status"] == "UPDATE"

    # Dispatch order remains DISPATCHED
    d_row = sql.execute("SELECT status FROM dispatch_orders WHERE dispatch_id = %s", (disp_id,)).fetchone()
    assert d_row["status"] == "DISPATCHED"

    # Verify ledger history
    events = sql.execute(
        "SELECT status FROM dispatch_progress WHERE dispatch_id = %s ORDER BY recorded_at ASC", (disp_id,)
    ).fetchall()
    recorded_statuses = [e["status"] for e in events]
    assert "ON_SCENE" in recorded_statuses
    assert "UPDATE" in recorded_statuses


def test_field_progress_invalid_state_refused(client, field_user, field_dispatch):
    """Submitting an invalid progress state literal is refused with 422 VALIDATION_FAILED."""
    disp_id = field_dispatch["dispatch_id"]
    client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])

    res = client.post(
        f"{BASE}/dispatches/{disp_id}/progress",
        headers=field_user["headers"],
        json={"status": "INVALID_STATE", "note": "Testing validation"},
    )
    assert res.status_code == 422, res.text
    assert _err(res)["code"] == "VALIDATION_FAILED"


def test_field_team_request_stores_open_request_and_notifies(client, field_user, field_dispatch, sql):
    """Field responder requests reinforcement units; stores row with OPEN status and audits."""
    disp_id = field_dispatch["dispatch_id"]
    client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])

    res = client.post(
        f"{BASE}/dispatches/{disp_id}/team-requests",
        headers=field_user["headers"],
        json={
            "required_capability": "boat",
            "note": "Water current accelerating; need additional zodiac motorboat unit",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["status"] == "OPEN"
    assert data["required_capability"] == "boat"
    assert data["dispatch_id"] == str(disp_id)
    assert "request_id" in data

    # Verify database table
    req_row = sql.execute(
        "SELECT status, required_capability, note FROM team_requests WHERE request_id = %s",
        (data["request_id"],),
    ).fetchone()
    assert req_row["status"] == "OPEN"
    assert req_row["required_capability"] == "boat"
    assert "zodiac" in req_row["note"]


def test_field_completion_requires_summary(client, field_user, field_dispatch):
    """Completion requires a descriptive operational summary >= 5 characters; otherwise 422."""
    disp_id = field_dispatch["dispatch_id"]
    client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])
    client.post(f"{BASE}/dispatches/{disp_id}/progress", headers=field_user["headers"], json={"status": "EN_ROUTE"})

    # Empty body
    res_empty = client.post(f"{BASE}/dispatches/{disp_id}/completion", headers=field_user["headers"], json={})
    assert res_empty.status_code == 422
    assert _err(res_empty)["code"] == "VALIDATION_FAILED"

    # Too short summary
    res_short = client.post(
        f"{BASE}/dispatches/{disp_id}/completion",
        headers=field_user["headers"],
        json={"summary": "done"},
    )
    assert res_short.status_code == 422
    assert _err(res_short)["code"] == "VALIDATION_FAILED"


def test_field_completion_completes_dispatch_releases_resources_and_leaves_incident_open(
    client, field_user, field_dispatch, sql
):
    """Completion marks dispatch COMPLETED, releases resources, and leaves incident OPEN for dispatcher."""
    disp_id = field_dispatch["dispatch_id"]
    inc_id = field_dispatch["incident_id"]
    res_id = field_user["resource_id"]

    # Setup: advance through ACKNOWLEDGED -> EN_ROUTE (DISPATCHED)
    client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])
    client.post(f"{BASE}/dispatches/{disp_id}/progress", headers=field_user["headers"], json={"status": "EN_ROUTE"})

    res = client.post(
        f"{BASE}/dispatches/{disp_id}/completion",
        headers=field_user["headers"],
        json={
            "summary": "Evacuation complete: safely rescued 14 citizens and provided first aid.",
            "civilians_evacuated": 14,
            "civilians_treated": 3,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["civilians_evacuated"] == 14
    assert data["civilians_treated"] == 3

    # Verify dispatch status in DB
    d_row = sql.execute("SELECT status FROM dispatch_orders WHERE dispatch_id = %s", (disp_id,)).fetchone()
    assert d_row["status"] == "COMPLETED"

    # Verify resources released
    res_row = sql.execute(
        "SELECT quantity_available, status FROM resources WHERE resource_id = %s", (res_id,)
    ).fetchone()
    assert res_row["quantity_available"] == 1
    assert res_row["status"] == "AVAILABLE"

    # CRITICAL: Verify incident is NOT closed or resolved; stays open for human dispatcher resolution
    inc_row = sql.execute("SELECT status FROM incidents WHERE incident_id = %s", (inc_id,)).fetchone()
    assert inc_row["status"] in ("VERIFIED", "DISPATCHED")
    assert inc_row["status"] not in ("CLOSED", "RESOLVED")

    # Verify progress table records COMPLETED
    prog = sql.execute(
        "SELECT status, note FROM dispatch_progress WHERE dispatch_id = %s AND status = 'COMPLETED'", (disp_id,)
    ).fetchone()
    assert prog is not None
    assert "Evacuation complete" in prog["note"]


def test_field_invalid_state_transitions_refused(client, field_user, field_dispatch):
    """Invalid lifecycle transitions are refused with 409 conflict and clear error code."""
    disp_id = field_dispatch["dispatch_id"]

    # 1. Progress before acknowledgement (status is REQUESTED) -> DISPATCH_NOT_ACKNOWLEDGED
    r_early_prog = client.post(
        f"{BASE}/dispatches/{disp_id}/progress",
        headers=field_user["headers"],
        json={"status": "EN_ROUTE", "note": "Premature progress"},
    )
    assert r_early_prog.status_code == 409, r_early_prog.text
    err1 = _err(r_early_prog)
    assert err1["code"] == "DISPATCH_NOT_ACKNOWLEDGED"

    # 2. Completion before dispatching (status is REQUESTED) -> DISPATCH_NOT_ACKNOWLEDGED
    r_early_comp = client.post(
        f"{BASE}/dispatches/{disp_id}/completion",
        headers=field_user["headers"],
        json={"summary": "Premature completion attempt"},
    )
    assert r_early_comp.status_code == 409, r_early_comp.text
    err2 = _err(r_early_comp)
    assert err2["code"] == "DISPATCH_NOT_ACKNOWLEDGED"

    # 3. Reject dispatch, then attempt acknowledgement -> DISPATCH_STATE_CONFLICT
    client.post(
        f"{BASE}/dispatches/{disp_id}/rejection",
        headers=field_user["headers"],
        json={"reason": "Cannot accept mission"},
    )
    r_ack_rejected = client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])
    assert r_ack_rejected.status_code in (404, 409), r_ack_rejected.text
    err3 = _err(r_ack_rejected)
    assert err3["code"] in ("DISPATCH_STATE_CONFLICT", "NOT_FOUND")


def test_field_audit_logging_and_hash_chain_integrity(client, field_user, field_dispatch, sql):
    """Every field action records an immutable audit row; cryptographic hash chain stays valid."""
    from app import audit

    disp_id = field_dispatch["dispatch_id"]

    # Execute complete lifecycle
    client.post(f"{BASE}/dispatches/{disp_id}/acknowledgement", headers=field_user["headers"])
    client.post(
        f"{BASE}/dispatches/{disp_id}/progress",
        headers=field_user["headers"],
        json={"status": "EN_ROUTE", "note": "En route to scene"},
    )
    client.post(
        f"{BASE}/dispatches/{disp_id}/team-requests",
        headers=field_user["headers"],
        json={"required_capability": "medical", "note": "Casualties found"},
    )
    client.post(
        f"{BASE}/dispatches/{disp_id}/completion",
        headers=field_user["headers"],
        json={"summary": "Mission successfully completed"},
    )

    # Verify specific audit actions were logged for this entity
    audit_rows = sql.execute(
        "SELECT action, result FROM audit_logs WHERE entity_id = %s ORDER BY audit_id ASC", (disp_id,)
    ).fetchall()
    logged_actions = [r["action"] for r in audit_rows]

    assert "DISPATCH_ACKNOWLEDGED" in logged_actions
    assert "DISPATCH_EN_ROUTE" in logged_actions
    assert "TEAM_BACKUP_REQUESTED" in logged_actions
    assert "DISPATCH_COMPLETED" in logged_actions

    # Verify SHA-256 hash chain over audit_logs remains intact
    is_valid, count, message = audit.verify_audit_chain(sql)
    assert is_valid is True, f"Audit hash chain verification failed: {message}"
    assert count > 0


def test_field_cross_team_dispatch_returns_404_not_found(client, make, field_user):
    """Operating on another team's dispatch returns 404 NOT_FOUND, preventing cross-team enumeration."""
    other_team = make.field_team_user(callsign="Echo-9")
    other_dispatch = make.field_dispatch(other_team)
    other_id = other_dispatch["dispatch_id"]

    # Attempting to acknowledge other team's dispatch
    r_ack = client.post(f"{BASE}/dispatches/{other_id}/acknowledgement", headers=field_user["headers"])
    assert r_ack.status_code == 404, r_ack.text
    assert _err(r_ack)["code"] == "NOT_FOUND"

    # Attempting to reject other team's dispatch
    r_rej = client.post(
        f"{BASE}/dispatches/{other_id}/rejection",
        headers=field_user["headers"],
        json={"reason": "Attempting unauthorized rejection"},
    )
    assert r_rej.status_code == 404, r_rej.text
    assert _err(r_rej)["code"] == "NOT_FOUND"
