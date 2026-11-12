"""Unit tests for Citizen incident reporting and tracking (in-memory demo mode).

Covers:
1. Incident creation with geofence validation within Gujarat.
2. Rejection of coordinates outside Gujarat (422 OUTSIDE_GUJARAT).
3. Idempotency key returning identical incident without duplication.
4. Citizen reports listing (/api/v1/me/incidents) and single report lookup.
5. Reporter isolation: citizen cannot view another citizen's reported incident (404).
"""

import uuid

import pytest

from app.auth import CITIZEN_ROLE, Principal
from app.common import PageParams
from app.errors import ApiError
from app.routers import citizen as citizen_router
from app.routers.citizen import IncidentCreate


@pytest.fixture(autouse=True)
def _demo_mode(monkeypatch):
    """Demo mode only for this module; a module-level os.environ write would leak into DB-backed tests."""
    monkeypatch.setenv("DEMO_MODE", "true")


# Demo citizen principals
CITIZEN_A = Principal(
    user_id=uuid.UUID("a0000000-0000-0000-0000-000000000003"),
    email="citizen.a@resq.gov.in",
    full_name="Citizen A",
    role=CITIZEN_ROLE,
    mfa_verified=True,
    permissions=frozenset(),
)

CITIZEN_B = Principal(
    user_id=uuid.UUID("b0000000-0000-0000-0000-000000000004"),
    email="citizen.b@resq.gov.in",
    full_name="Citizen B",
    role=CITIZEN_ROLE,
    mfa_verified=True,
    permissions=frozenset(),
)


def _make_payload(lat=23.0225, lon=72.5714, scenario="urban_flooding", description="Water entering ground floor shops near market"):
    return IncidentCreate(
        scenario=scenario,
        description=description,
        reported_urgency="HIGH",
        people_affected=10,
        location_source="GPS",
        latitude=lat,
        longitude=lon,
        address_text="Near Usmanpura Underpass",
        landmark="Opposite Jain Temple",
    )


def test_create_incident_in_gujarat_succeeds():
    payload = _make_payload()
    res = citizen_router.create_incident(payload, CITIZEN_A)
    assert res["status"] == "SUBMITTED"
    assert res["incident_ref"].startswith("INC-")
    assert res["district"] in ("Ahmedabad", "Gujarat")
    assert res["incident_id"] is not None


def test_create_incident_outside_gujarat_rejected():
    # Mumbai (19.0760, 72.8777) is outside Gujarat
    payload = _make_payload(lat=19.0760, lon=72.8777)
    with pytest.raises(ApiError) as exc_info:
        citizen_router.create_incident(payload, CITIZEN_A)
    assert exc_info.value.status == 422
    assert exc_info.value.code == "OUTSIDE_GUJARAT"


def test_idempotent_incident_submission():
    key = str(uuid.uuid4())
    payload = _make_payload(description="Water level rising rapidly on highway")

    first = citizen_router.create_incident(payload, CITIZEN_A, idempotency_key=key)
    second_resp = citizen_router.create_incident(payload, CITIZEN_A, idempotency_key=key)

    # Second response is a JSONResponse(200) with identical content
    assert second_resp.status_code == 200
    import json
    second_body = json.loads(second_resp.body.decode())
    assert str(first["incident_id"]) == str(second_body["incident_id"])
    assert first["incident_ref"] == second_body["incident_ref"]


def test_my_incidents_listing_and_isolation():
    # Citizen A creates an incident
    created = citizen_router.create_incident(_make_payload(description="Isolated report for Citizen A"), CITIZEN_A)
    inc_id = created["incident_id"]

    # Citizen A can list their own incidents
    mine_a = citizen_router.my_incidents(CITIZEN_A, PageParams(page=1, limit=20))
    refs_a = [item["incident_ref"] for item in mine_a["items"]]
    assert created["incident_ref"] in refs_a

    # Citizen A can get single incident detail
    detail = citizen_router.my_incident(inc_id, CITIZEN_A)
    assert detail["incident_id"] == inc_id
    assert len(detail["timeline"]) >= 1

    # Citizen B CANNOT view Citizen A's incident (returns 404)
    with pytest.raises(ApiError) as exc_info:
        citizen_router.my_incident(inc_id, CITIZEN_B)
    assert exc_info.value.status == 404
