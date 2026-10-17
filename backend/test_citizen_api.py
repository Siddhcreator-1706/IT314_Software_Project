"""
ResQ AI — Citizen Module Integration Tests
Validates all backend endpoints for the Citizen module:
- Authentication & ownership enforcement
- Public data endpoints (incidents, alerts, shelters)
- Citizen disaster report creation, listing, and retrieval
"""
from fastapi.testclient import TestClient

from database import init_database
from main import app

client = TestClient(app)

def setup_module():
    """Ensure database is initialized before tests."""
    init_database()


def test_public_incidents():
    """Verify public incidents endpoint returns active, verified incidents."""
    response = client.get("/api/public/incidents")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    # Check schema
    first = data[0]
    assert "id" in first
    assert "category" in first
    assert "title" in first
    assert "lat" in first
    assert "lon" in first
    assert "severity" in first
    assert "lifecycle_status" in first
    # Verify no closed or rejected incidents are returned
    for inc in data:
        assert inc["lifecycle_status"] not in ("CLOSED", "RESOLVED", "REJECTED")


def test_public_alerts():
    """Verify public alerts endpoint returns safety notices."""
    response = client.get("/api/public/alerts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first = data[0]
    assert "id" in first
    assert "severity" in first
    assert "title" in first
    assert "description" in first


def test_public_shelters():
    """Verify shelters endpoint returns operational relief infrastructure."""
    response = client.get("/api/public/shelters")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first = data[0]
    assert "id" in first
    assert "name" in first
    assert "type" in first
    assert "status" in first


def test_create_report_unauthorized():
    """Ensure report creation fails when no auth header is provided."""
    payload = {
        "category": "Flood / Urban Flood",
        "description": "Severe road waterlogging near station area",
        "location_name": "MG Road Station",
        "lat": 19.0760,
        "lon": 72.8777,
        "affected_people_count": 10,
        "urgent_needs": ["Rescue Boats"],
    }
    response = client.post("/api/citizen/reports", json=payload)
    # Missing X-User-Id header -> 422 or 401
    assert response.status_code in (401, 422)


def test_create_report_invalid_category():
    """Ensure report creation rejects invalid disaster categories."""
    payload = {
        "category": "Alien Invasion",
        "description": "Unidentified flying objects spotted",
        "location_name": "Unknown",
        "lat": 19.0760,
        "lon": 72.8777,
    }
    headers = {"X-User-Id": "USR-CITIZEN-001", "X-User-Role": "Public / Citizen"}
    response = client.post("/api/citizen/reports", json=payload, headers=headers)
    assert response.status_code == 422


def test_create_and_retrieve_citizen_report():
    """Full lifecycle: create a report, list citizen reports, get single report by ID."""
    headers = {"X-User-Id": "USR-CITIZEN-TEST", "X-User-Role": "Public / Citizen"}
    payload = {
        "category": "Major Urban / Building Fire",
        "description": "Dense black smoke and visible flames from commercial complex 3rd floor",
        "location_name": "Cyber Hub Tower B, Sector 24",
        "lat": 28.4900,
        "lon": 77.0880,
        "affected_people_count": 15,
        "urgent_needs": ["Water Tenders (Fire)", "Medical Evacuation"],
        "reporter_name": "Test Citizen",
        "reporter_phone": "+91-9876543210",
    }
    # 1. Create
    create_res = client.post("/api/citizen/reports", json=payload, headers=headers)
    assert create_res.status_code == 201
    report = create_res.json()
    assert report["id"].startswith("REP-2026-")
    assert report["category"] == payload["category"]
    assert report["verification_status"] == "PENDING"
    assert report["affected_people_count"] == 15
    report_id = report["id"]

    # 2. List
    list_res = client.get("/api/citizen/reports", headers=headers)
    assert list_res.status_code == 200
    my_reports = list_res.json()
    assert any(r["id"] == report_id for r in my_reports)

    # 3. Get by ID (authorized owner)
    get_res = client.get(f"/api/citizen/reports/{report_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == report_id

    # 4. Get by ID (different citizen -> 404 ownership isolation)
    other_headers = {"X-User-Id": "USR-OTHER-CITIZEN", "X-User-Role": "Public / Citizen"}
    unauth_res = client.get(f"/api/citizen/reports/{report_id}", headers=other_headers)
    assert unauth_res.status_code == 404
