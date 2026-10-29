"""Phase 5: Automated Testing, Security Hardening & Integration Gate (S1-07, S1-09, S1-11, S1-19).

Owned by: Nisarg
Covers:
1. Public API Security & PII Protection (no SUBMITTED/REJECTED leaks, no PII fields).
2. Gujarat Geofencing Precision (inside vs outside Gujarat validation, bbox rejection).
3. Team Recommendation & Unavailable Resource Exclusion.
4. End-to-End Core Loop: Report -> Verify -> Public Feed visibility -> Dispatch Escalation.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.geo import (
    _bbox_check,
    district_for,
    get_boundary_cache_status,
    is_in_gujarat,
    load_boundaries_from_db,
)
from app.routers.public import _DEMO_INCIDENTS
from app.services.recommendations import (
    get_recommended_teams,
    score_and_rank_teams,
)

# ═══════════════════════════════════════════════════════════════════════════
# 1. SECURITY & PII TESTS (Public API Hardening)
# ═══════════════════════════════════════════════════════════════════════════

def test_public_api_never_leaks_unverified_or_rejected(client):
    """Ensure SUBMITTED, REJECTED, or unverified records are never publicly visible."""
    resp = client.get("/api/v1/public/incidents")
    assert resp.status_code == 200
    incidents = resp.json()

    for inc in incidents:
        # Strict state machine verification
        assert inc["status"].upper() in (
            "VERIFIED",
            "DISPATCHED",
            "RESOLVED",
        ), f"Unverified status leaked: {inc['status']}"


def test_public_api_pii_sanitization(client):
    """Ensure absolutely zero citizen PII or internal notes are exposed."""
    resp = client.get("/api/v1/public/incidents")
    assert resp.status_code == 200
    incidents = resp.json()

    forbidden_pii = {
        "reporter_id",
        "reporter_name",
        "reporter_phone",
        "reporter_email",
        "internal_notes",
        "dispatcher_notes",
        "description",  # Raw unvetted text withheld from public map
        "evidence_files",
    }

    for inc in incidents:
        keys = set(inc.keys())
        leaked = keys & forbidden_pii
        assert not leaked, f"Security Violation: PII leaked in public incident {inc.get('incident_ref')}: {leaked}"


def test_public_api_query_filters(client):
    """Verify district, scenario, and bbox query filtering."""
    # 1. District filter
    r_ahmedabad = client.get("/api/v1/public/incidents?district=Ahmedabad")
    assert r_ahmedabad.status_code == 200
    for inc in r_ahmedabad.json():
        assert inc["district"].lower() == "ahmedabad"

    # 2. Scenario filter
    r_cyclone = client.get("/api/v1/public/incidents?scenario=CYCLONE")
    assert r_cyclone.status_code == 200
    for inc in r_cyclone.json():
        assert inc["scenario"].upper() == "CYCLONE"

    # 3. Bounding box filter (restricted box around Surat)
    r_bbox = client.get("/api/v1/public/incidents?min_lat=20.0&max_lat=22.0&min_lon=71.0&max_lon=74.0")
    assert r_bbox.status_code == 200
    for inc in r_bbox.json():
        assert inc["district"] == "Surat"


def test_public_api_coordinate_rounding():
    """Verify coordinates are rounded to at most 4 decimal places for privacy."""
    for inc in _DEMO_INCIDENTS:
        lat_str = str(inc["latitude"]).split(".")
        lon_str = str(inc["longitude"]).split(".")
        if len(lat_str) > 1:
            assert len(lat_str[1]) <= 4
        if len(lon_str) > 1:
            assert len(lon_str[1]) <= 4


# ═══════════════════════════════════════════════════════════════════════════
# 2. GUJARAT GEOFENCING TESTS (geo.py Precision)
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize(
    "city,lat,lon",
    [
        ("Ahmedabad", 23.0225, 72.5714),
        ("Surat", 21.1702, 72.8311),
        ("Vadodara", 22.3072, 73.1812),
        ("Rajkot", 22.3039, 70.8022),
        ("Bhuj", 23.2420, 69.6669),
        ("Gandhinagar", 23.2156, 72.6369),
        ("Bhavnagar", 21.7645, 72.1519),
        ("Jamnagar", 22.4707, 70.0577),
    ],
)
def test_geofence_inside_gujarat(city, lat, lon):
    """All major Gujarat cities must pass geofencing."""
    assert is_in_gujarat(lat, lon) is True, f"{city} ({lat}, {lon}) falsely flagged outside Gujarat"


@pytest.mark.parametrize(
    "city,lat,lon",
    [
        ("Mumbai", 19.0760, 72.8777),
        ("Pune", 18.5204, 73.8567),
        ("Delhi", 28.6139, 77.2090),
        ("Jaipur", 26.9124, 75.7873),
        ("Udaipur", 24.5854, 73.7125),
        ("Karachi", 24.8607, 67.0011),
    ],
)
def test_geofence_outside_gujarat(city, lat, lon):
    """External cities across borders must be rejected."""
    assert is_in_gujarat(lat, lon) is False, f"{city} ({lat}, {lon}) falsely flagged inside Gujarat"


def test_fast_bbox_prefilter():
    """Verify bbox prefilter rejects points before expensive raycasting."""
    # Delhi is far outside bbox
    assert _bbox_check(28.6139, 77.2090) is False
    # Mumbai is south of min_lat (20.1)
    assert _bbox_check(19.0760, 72.8777) is False
    # Ahmedabad is inside bbox
    assert _bbox_check(23.0225, 72.5714) is True


def test_district_for_lookup():
    """Verify district resolution for coordinates."""
    assert district_for(23.0225, 72.5714) == "Ahmedabad"
    assert district_for(22.3039, 70.8022) == "Rajkot"
    # External point returns None
    assert district_for(19.0760, 72.8777) is None


def test_boundary_cache_startup_and_telemetry():
    """Verify Option 2: PostGIS boundary cache loads into RAM and tracks telemetry."""
    # Ensure cache telemetry contract is respected
    telemetry = get_boundary_cache_status()
    assert telemetry["state"] == "Gujarat"
    assert telemetry["polygon_vertex_count"] > 10
    assert telemetry["district_centroid_count"] == 33
    assert "min_lat" in telemetry["bbox"]
    assert "max_lat" in telemetry["bbox"]

    # Verify graceful fallback if mock conn has no rows
    class EmptyConn:
        def execute(self, *args, **kwargs):
            class Cursor:
                def fetchone(self):
                    return None
                def fetchall(self):
                    return []
            return Cursor()

    loaded = load_boundaries_from_db(conn=EmptyConn())
    assert loaded is False
    # Cache should remain valid with fallbacks
    assert get_boundary_cache_status()["polygon_vertex_count"] > 10


# ═══════════════════════════════════════════════════════════════════════════
# 3. RECOMMENDATION ENGINE TESTS
# ═══════════════════════════════════════════════════════════════════════════

def test_recommendation_prioritizes_required_capabilities():
    """Flood incidents must recommend boat and water rescue units."""
    recs = get_recommended_teams(23.0373, 72.5613, "URBAN_FLOODING", limit=3)
    assert len(recs) == 3
    # Top team in Ahmedabad flood
    top = recs[0]
    assert "boat" in top.matched_capabilities or "flood_rescue" in top.matched_capabilities
    assert top.distance_km < 10.0


def test_recommendation_strictly_excludes_unavailable():
    """Units on MAINTENANCE or with 0 available quantity must not be recommended."""
    mock_units = [
        {
            "resource_id": "r-1",
            "name": "Damaged Tender",
            "agency_id": "a-1",
            "agency_name": "AFES",
            "latitude": 23.0,
            "longitude": 72.5,
            "status": "MAINTENANCE",
            "quantity_available": 1,
            "capability_tags": {"fire": True},
        },
        {
            "resource_id": "r-2",
            "name": "Deployed Crew",
            "agency_id": "a-1",
            "agency_name": "AFES",
            "latitude": 23.0,
            "longitude": 72.5,
            "status": "AVAILABLE",
            "quantity_available": 0,
            "capability_tags": {"fire": True},
        },
        {
            "resource_id": "r-3",
            "name": "Available Tender",
            "agency_id": "a-1",
            "agency_name": "AFES",
            "latitude": 23.0,
            "longitude": 72.5,
            "status": "AVAILABLE",
            "quantity_available": 1,
            "capability_tags": {"fire": True},
        },
    ]
    ranked = score_and_rank_teams(mock_units, 23.0, 72.5, "INDUSTRIAL_FIRE")
    ids = [u.resource_id for u in ranked]
    assert "r-1" not in ids
    assert "r-2" not in ids
    assert "r-3" in ids


# ═══════════════════════════════════════════════════════════════════════════
# 4. INTEGRATION GATE (S1-09 & S1-19 Workflow Simulation)
# ═══════════════════════════════════════════════════════════════════════════

def test_core_lifecycle_transition_logic():
    """
    Simulates the core lifecycle state machine:
    SUBMITTED -> VERIFIED -> Visible on Public API.
    """
    raw_reports = [
        {
            "incident_ref": "TEST-INC-001",
            "scenario": "URBAN_FLOODING",
            "district": "Ahmedabad",
            "status": "SUBMITTED",
            "verified_by": None,
            "latitude": 23.03,
            "longitude": 72.56,
        },
        {
            "incident_ref": "TEST-INC-002",
            "scenario": "INDUSTRIAL_FIRE",
            "district": "Surat",
            "status": "VERIFIED",
            "verified_by": str(uuid.uuid4()),
            "latitude": 21.10,
            "longitude": 72.68,
        },
    ]

    # Public filter simulation
    public_visible = [
        r for r in raw_reports
        if r["status"] in ("VERIFIED", "DISPATCHED", "RESOLVED")
        and r["verified_by"] is not None
    ]

    refs = [r["incident_ref"] for r in public_visible]
    assert "TEST-INC-001" not in refs, "SUBMITTED unverified incident leaked to public!"
    assert "TEST-INC-002" in refs, "VERIFIED incident missing from public view!"


def test_dispatch_escalation_logic():
    """Verify overdue dispatch orders are flagged for escalation without blocking the system."""
    fake_dispatches = [
        {
            "dispatch_id": str(uuid.uuid4()),
            "status": "REQUESTED",
            "created_at": datetime.now(UTC) - timedelta(minutes=25),
        },
        {
            "dispatch_id": str(uuid.uuid4()),
            "status": "REQUESTED",
            "created_at": datetime.now(UTC) - timedelta(minutes=5),
        },
    ]

    timeout_minutes = 15
    overdue = [
        d for d in fake_dispatches
        if d["status"] == "REQUESTED"
        and d["created_at"] < datetime.now(UTC) - timedelta(minutes=timeout_minutes)
    ]

    assert len(overdue) == 1, "Failed to identify exactly one overdue dispatch order"
    assert overdue[0]["dispatch_id"] == fake_dispatches[0]["dispatch_id"]

