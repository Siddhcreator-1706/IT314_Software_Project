import pytest
from fastapi.testclient import TestClient

from db_conn import get_db
from main import app

client = TestClient(app)

def get_admin_token():
    resp = client.post("/api/v1/auth/login", json={
        "email": "admin@drch.gov.in",
        "password": "Admin@123"
    })
    return resp.json()["access_token"]

def test_audit_logs_paginated_and_filtered():
    """AM-FR-05: Protected, searchable, filterable, paginated audit-log access."""
    token = get_admin_token()

    resp = client.get("/api/v1/admin/audit-logs?limit=10&offset=0", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "logs" in data
    assert "total" in data
    assert data["total"] >= 1

    # Verify cryptographic hash fields exist on audit records
    log = data["logs"][0]
    assert "row_hash" in log
    assert "prev_hash" in log
    assert "action" in log
    assert "result" in log

def test_audit_logs_tamper_immutability():
    """AM-FR-05: Direct UPDATE or DELETE statements on audit_logs are blocked by PostgreSQL trigger."""
    with pytest.raises(Exception) as excinfo, get_db() as conn, conn.cursor() as cur:
        cur.execute("UPDATE audit_logs SET rationale = 'tampered' WHERE audit_id = 1;")
    assert "Audit log entries are immutable" in str(excinfo.value)

def test_data_management_list_entities():
    """AM-FR-06: Administrator can inspect manageable system entities."""
    token = get_admin_token()
    resp = client.get("/api/v1/admin/data/entities", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    entities = resp.json()["entities"]
    types = [e["type"] for e in entities]
    assert "agencies" in types
    assert "system_configs" in types

def test_data_management_correction_with_audit_trail():
    """AM-FR-06: Controlled data correction preserves before-and-after states with rationale."""
    token = get_admin_token()

    # List agencies
    agencies_resp = client.get("/api/v1/admin/data/agencies", headers={"Authorization": f"Bearer {token}"})
    assert agencies_resp.status_code == 200
    records = agencies_resp.json()["records"]
    assert len(records) > 0
    target_agency = records[0]

    # Apply a controlled correction
    new_phone = "1078-EXT-01"
    correct_resp = client.put(
        f"/api/v1/admin/data/agencies/{target_agency['id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "field_updates": {"contact_phone": new_phone},
            "rationale": "Updated official NDRF helpline dispatch extension following drill"
        }
    )
    assert correct_resp.status_code == 200
    assert correct_resp.json()["message"] == "Data correction committed successfully."

    # Verify audit log recorded this change
    audit_resp = client.get(
        "/api/v1/admin/audit-logs?entity_type=agencies&action=AGENCIES_CORRECTED",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert audit_resp.status_code == 200
    latest_log = audit_resp.json()["logs"][0]
    assert "NDRF helpline" in latest_log["rationale"]
    assert latest_log["result"] == "SUCCESS"
