"""S3-01 scenario steps (Nisarg): team assignment and the field flow, end to end over HTTP.

Starts from a VERIFIED incident (the citizen report and verification steps are Zalak's part of
the scenario) and drives the real API against the PostGIS test database:

  1. dispatcher reads advisory team recommendations (no dispatch is created);
  2. dispatcher creates the dispatch with the recommended team;
  3. the reserved team disappears from recommendations (no double booking);
  4. field responder sees the assignment; another team gets 404 on it;
  5. acknowledgement, EN_ROUTE and ON_SCENE progress;
  6. backup team request, dispatcher approval (draft only, still one dispatch);
  7. completion: dispatch COMPLETED, team released, incident stays open for the dispatcher;
  8. every step is in the audit log.

The step helpers are importable so the automated cyclone scenario (S3-01 owner: Dhruv) can
reuse them: ``run_assignment_and_field_flow(client, make, sql, incident)``.
"""

import random
import uuid
from datetime import UTC, datetime

import pytest

pytestmark = pytest.mark.db

DM = "/api/v1/dm"
FIELD = "/api/v1/field"


# --------------------------------------------------------------------------- arrange helpers


def make_team(make, sql, *, latitude: float, longitude: float, capabilities: dict, agency_id=None):
    """A TEAM resource at an exact point with capability tags."""
    team = make.resource(type_="TEAM", agency_id=agency_id)
    sql.execute(
        """
        UPDATE resources
        SET capability_tags = %s::jsonb,
            current_geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
        WHERE resource_id = %s
        """,
        (_json(capabilities), longitude, latitude, team["resource_id"]),
    )
    return team


def make_verified_incident(make, verifier_id, *, scenario: str, latitude: float, longitude: float, district: str):
    return make.incident(
        scenario=scenario,
        status="VERIFIED",
        verified_priority="HIGH",
        verified_by=verifier_id,
        verified_at=datetime.now(UTC),
        latitude=latitude,
        longitude=longitude,
        district=district,
    )


def _json(obj: dict) -> str:
    import json

    return json.dumps(obj)


def _dispatch_count(sql, incident_id) -> int:
    return sql.execute(
        "SELECT count(*) AS n FROM dispatch_orders WHERE incident_id = %s", (incident_id,)
    ).fetchone()["n"]


# ----------------------------------------------------------------------------- scenario steps


def step_recommend(client, dispatcher, incident_id) -> list[dict]:
    res = client.get(f"{DM}/incidents/{incident_id}/team-recommendations", params={"limit": 20},
                     headers=dispatcher["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["requires_confirmation"] is True
    return body["recommendations"]


def step_create_dispatch(client, dispatcher, incident_id, agency_id, team_id) -> dict:
    res = client.post(
        f"{DM}/incidents/{incident_id}/dispatches",
        headers={**dispatcher["headers"], "Idempotency-Key": f"s3-01-{uuid.uuid4()}"},
        json={
            "receiving_agency_id": str(agency_id),
            "instructions": "Scenario step: deploy the recommended team to the flooded junction.",
            "resources": [{"resource_id": str(team_id), "quantity": 1}],
        },
    )
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "REQUESTED"
    return res.json()


def step_field_progress(client, field, dispatch_id) -> None:
    url = f"{FIELD}/dispatches/{dispatch_id}"
    ack = client.post(f"{url}/acknowledgement", headers=field["headers"])
    assert ack.status_code == 200, ack.text
    assert ack.json()["status"] == "ACKNOWLEDGED"
    for event in ("EN_ROUTE", "ON_SCENE"):
        res = client.post(f"{url}/progress", headers=field["headers"],
                          json={"status": event, "note": f"Scenario step: {event}"})
        assert res.status_code == 200, res.text
        assert res.json()["status"] == event


def step_backup_request_and_approval(client, dispatcher, field, dispatch_id) -> dict:
    req = client.post(f"{FIELD}/dispatches/{dispatch_id}/team-requests", headers=field["headers"],
                      json={"required_capability": "dewatering_pump", "note": "Basement still filling"})
    assert req.status_code == 201, req.text
    request_id = req.json()["request_id"]
    assert req.json()["status"] == "OPEN"

    queue = client.get(f"{DM}/team-requests", params={"status": "OPEN", "limit": 100},
                       headers=dispatcher["headers"])
    assert queue.status_code == 200, queue.text
    assert request_id in {r["request_id"] for r in queue.json()}

    decision = client.post(f"{DM}/team-requests/{request_id}/decision", headers=dispatcher["headers"],
                           json={"action": "APPROVE", "rationale": "Pumps needed for the basement"})
    assert decision.status_code == 200, decision.text
    body = decision.json()
    assert body["status"] == "APPROVED"
    assert body["dispatch_draft"]["required_capability"] == "dewatering_pump"

    again = client.post(f"{DM}/team-requests/{request_id}/decision", headers=dispatcher["headers"],
                        json={"action": "DECLINE", "rationale": "Changed my mind"})
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "TEAM_REQUEST_ALREADY_DECIDED"
    return body


def step_complete(client, field, dispatch_id) -> None:
    res = client.post(f"{FIELD}/dispatches/{dispatch_id}/completion", headers=field["headers"],
                      json={"summary": "Scenario step: 12 people moved to the relief camp.",
                            "civilians_evacuated": 12})
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "COMPLETED"


def run_assignment_and_field_flow(client, make, sql, incident, *, dispatcher, agency, team, field) -> dict:
    """Steps 1-7 for one verified incident; returns ids for further assertions."""
    incident_id = incident["incident_id"]

    recs = step_recommend(client, dispatcher, incident_id)
    assert recs and recs[0]["resource_id"] == str(team["resource_id"]), recs[:3]
    assert _dispatch_count(sql, incident_id) == 0, "a recommendation must never create a dispatch"

    dispatch = step_create_dispatch(client, dispatcher, incident_id, agency["agency_id"], team["resource_id"])
    dispatch_id = dispatch["dispatch_id"]
    assert str(team["resource_id"]) not in {r["resource_id"] for r in step_recommend(client, dispatcher, incident_id)}

    me = client.get(f"{FIELD}/me", headers=field["headers"])
    assert me.status_code == 200, me.text
    assert me.json()["team_resource_id"] == str(team["resource_id"])
    assignments = client.get(f"{FIELD}/assignments", params={"active": True}, headers=field["headers"])
    assert assignments.status_code == 200, assignments.text
    assert dispatch_id in {a["dispatch_id"] for a in assignments.json()}

    early = client.post(f"{FIELD}/dispatches/{dispatch_id}/progress", headers=field["headers"],
                        json={"status": "EN_ROUTE"})
    assert early.status_code == 409, "progress before acknowledgement must be refused"

    step_field_progress(client, field, dispatch_id)
    assert sql.execute("SELECT status FROM incidents WHERE incident_id = %s",
                       (incident_id,)).fetchone()["status"] == "DISPATCHED"

    decision = step_backup_request_and_approval(client, dispatcher, field, dispatch_id)
    assert _dispatch_count(sql, incident_id) == 1, "approving a backup request only drafts a dispatch"

    step_complete(client, field, dispatch_id)
    return {"dispatch_id": dispatch_id, "decision": decision}


# ------------------------------------------------------------------------------------- tests


@pytest.fixture
def scenario(make, sql, field_user):  # field_user skips cleanly when the field schema is absent
    dispatcher = make.staff("DISPATCH", "SUPERVISOR")
    agency = make.agency()
    # A unique point per run so teams left by earlier runs never tie with this one.
    lat, lon = 23.0 + random.uniform(-0.05, 0.05), 72.55 + random.uniform(-0.05, 0.05)
    team = make_team(make, sql, latitude=lat, longitude=lon, agency_id=agency["agency_id"],
                     capabilities={"boat": True, "flood_rescue": True, "dewatering_pump": True})
    field = make.field_team_user(resource_id=team["resource_id"], callsign="S3-01")
    incident = make_verified_incident(make, dispatcher["user_id"], scenario="URBAN_FLOODING",
                                      latitude=lat, longitude=lon, district="Ahmedabad")
    return {"dispatcher": dispatcher, "agency": agency, "team": team, "field": field, "incident": incident}


def test_assignment_and_field_flow_end_to_end(client, make, sql, scenario):
    out = run_assignment_and_field_flow(
        client, make, sql, scenario["incident"],
        dispatcher=scenario["dispatcher"], agency=scenario["agency"],
        team=scenario["team"], field=scenario["field"],
    )
    incident_id = scenario["incident"]["incident_id"]

    # Completion leaves the incident open: only a dispatcher resolves or closes it.
    assert sql.execute("SELECT status FROM incidents WHERE incident_id = %s",
                       (incident_id,)).fetchone()["status"] not in ("RESOLVED", "CLOSED")
    team = sql.execute("SELECT status, quantity_available FROM resources WHERE resource_id = %s",
                       (scenario["team"]["resource_id"],)).fetchone()
    assert team["status"] == "AVAILABLE" and team["quantity_available"] == 1

    progress = sql.execute("SELECT status FROM dispatch_progress WHERE dispatch_id = %s",
                           (out["dispatch_id"],)).fetchall()
    assert {"EN_ROUTE", "ON_SCENE"} <= {p["status"] for p in progress}

    actions = {r["action"] for r in sql.execute(
        "SELECT action FROM audit_logs WHERE entity_id::text IN (%s, %s)",
        (str(out["dispatch_id"]), str(incident_id)),
    ).fetchall()}
    assert {"DISPATCH_CREATED", "TEAM_BACKUP_REQUESTED", "DISPATCH_COMPLETED"} <= actions


def test_other_team_cannot_see_or_act_on_the_dispatch(client, make, sql, scenario):
    incident_id = scenario["incident"]["incident_id"]
    dispatch = step_create_dispatch(client, scenario["dispatcher"], incident_id,
                                    scenario["agency"]["agency_id"], scenario["team"]["resource_id"])
    other = make.field_team_user(callsign="OTHER-1")

    listed = client.get(f"{FIELD}/assignments", headers=other["headers"])
    assert listed.status_code == 200
    assert dispatch["dispatch_id"] not in {a["dispatch_id"] for a in listed.json()}
    for path, body in (
        ("acknowledgement", None),
        ("progress", {"status": "EN_ROUTE"}),
        ("team-requests", {"required_capability": "boat"}),
        ("completion", {"summary": "Not my dispatch at all"}),
    ):
        res = client.post(f"{FIELD}/dispatches/{dispatch['dispatch_id']}/{path}", headers=other["headers"], json=body)
        assert res.status_code == 404, (path, res.text)


def test_dispatcher_role_is_required_for_team_request_decisions(client, make, scenario):
    viewer = make.staff()  # DISASTER_MGMT without DISPATCH
    res = client.post(f"{DM}/team-requests/{uuid.uuid4()}/decision", headers=viewer["headers"],
                      json={"action": "APPROVE"})
    assert res.status_code == 403
    field_call = client.get(f"{DM}/team-requests", headers=scenario["field"]["headers"])
    assert field_call.status_code == 403
