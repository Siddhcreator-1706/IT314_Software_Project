"""Backup requests from the field: a responder sees their team's requests and the dispatcher's decision."""

import pytest

pytestmark = pytest.mark.db

FIELD = "/api/v1/field"
DM = "/api/v1/dm"
LIST = f"{FIELD}/team-requests"


def _ask(client, field, dispatch_id, capability="boat", note="Water is rising fast", expect=201):
    response = client.post(
        f"{FIELD}/dispatches/{dispatch_id}/team-requests",
        headers=field["headers"],
        json={"required_capability": capability, "note": note},
    )
    assert response.status_code == expect, response.text
    return response.json()


def _mine(client, field, **params) -> list[dict]:
    response = client.get(LIST, headers=field["headers"], params=params)
    assert response.status_code == 200, response.text
    return response.json()


def _decide(client, dispatcher, request_id, action="DECLINE", rationale="No boat unit is free right now"):
    return client.post(
        f"{DM}/team-requests/{request_id}/decision",
        headers=dispatcher["headers"],
        json={"action": action, "rationale": rationale},
    )


def test_a_responder_sees_the_requests_their_team_has_made(client, make):
    field = make.field_team_user()
    dispatch = make.field_dispatch(field, status="DISPATCHED")
    request = _ask(client, field, dispatch["dispatch_id"])

    items = _mine(client, field)
    assert len(items) == 1
    item = items[0]
    assert item["request_id"] == request["request_id"] and item["dispatch_ref"] == dispatch["dispatch_ref"]
    assert item["required_capability"] == "boat" and item["status"] == "OPEN"
    assert item["decision_rationale"] is None and item["decided_at"] is None
    assert set(item) == {
        "request_id", "dispatch_id", "dispatch_ref", "required_capability", "note", "status",
        "decision_rationale", "decided_at", "created_at",
    }, "nothing about who decided or other teams leaks"


def test_the_responder_learns_the_dispatchers_decision(client, make):
    dispatcher = make.staff("DISPATCH")
    field = make.field_team_user()
    dispatch = make.field_dispatch(field, status="DISPATCHED")
    declined = _ask(client, field, dispatch["dispatch_id"], "boat")
    approved = _ask(client, field, dispatch["dispatch_id"], "ambulance")

    assert _decide(client, dispatcher, declined["request_id"], "DECLINE", "No boat unit is free right now").status_code == 200
    assert _decide(client, dispatcher, approved["request_id"], "APPROVE", "Ambulance is on the way").status_code == 200

    by_capability = {i["required_capability"]: i for i in _mine(client, field)}
    assert by_capability["boat"]["status"] == "DECLINED"
    assert by_capability["boat"]["decision_rationale"] == "No boat unit is free right now"
    assert by_capability["boat"]["decided_at"] is not None
    assert by_capability["ambulance"]["status"] == "APPROVED" and by_capability["ambulance"]["decided_at"] is not None

    assert [i["required_capability"] for i in _mine(client, field, status="DECLINED")] == ["boat"]
    assert [i["required_capability"] for i in _mine(client, field, status="APPROVED")] == ["ambulance"]
    assert _mine(client, field, status="OPEN") == []


def test_open_requests_come_first_then_newest(client, make):
    dispatcher = make.staff("DISPATCH")
    field = make.field_team_user()
    dispatch = make.field_dispatch(field, status="DISPATCHED")
    oldest = _ask(client, field, dispatch["dispatch_id"], "boat")
    _ask(client, field, dispatch["dispatch_id"], "pump")
    _ask(client, field, dispatch["dispatch_id"], "hazmat")
    assert _decide(client, dispatcher, oldest["request_id"]).status_code == 200  # the oldest is decided, so it drops below the open ones

    assert [i["required_capability"] for i in _mine(client, field)] == ["hazmat", "pump", "boat"]
    assert len(_mine(client, field, limit=1)) == 1


def test_the_same_open_request_cannot_be_filed_twice(client, make):
    dispatcher = make.staff("DISPATCH")
    field = make.field_team_user()
    dispatch = make.field_dispatch(field, status="DISPATCHED")
    first = _ask(client, field, dispatch["dispatch_id"], "boat")

    again = client.post(
        f"{FIELD}/dispatches/{dispatch['dispatch_id']}/team-requests",
        headers=field["headers"],
        json={"required_capability": "  BOAT ", "note": "Filing it a second time"},
    )
    assert again.status_code == 409 and again.json()["error"]["code"] == "DUPLICATE_OPEN_REQUEST"
    _ask(client, field, dispatch["dispatch_id"], "pump")  # a different capability is fine
    assert len(_mine(client, field)) == 2

    assert _decide(client, dispatcher, first["request_id"]).status_code == 200
    _ask(client, field, dispatch["dispatch_id"], "boat")  # once decided, the team may ask again
    assert [i["status"] for i in _mine(client, field, status="OPEN") if i["required_capability"] == "boat"] == ["OPEN"]


def test_the_whole_team_sees_the_requests_but_other_teams_do_not(client, make):
    leader = make.field_team_user(callsign="Bravo-1")
    teammate = make.field_team_user(resource_id=leader["resource_id"], callsign="Bravo-2", is_leader=False)
    rival = make.field_team_user()
    dispatch = make.field_dispatch(leader, status="DISPATCHED")
    rival_dispatch = make.field_dispatch(rival, status="DISPATCHED")
    _ask(client, leader, dispatch["dispatch_id"], "boat")
    _ask(client, rival, rival_dispatch["dispatch_id"], "pump")

    assert [i["required_capability"] for i in _mine(client, teammate)] == ["boat"]  # a teammate sees what the leader asked
    assert [i["required_capability"] for i in _mine(client, rival)] == ["pump"]
    assert [i["required_capability"] for i in _mine(client, leader)] == ["boat"]


def test_a_request_stays_visible_after_the_dispatch_is_completed(client, make):
    field = make.field_team_user()
    dispatch = make.field_dispatch(field, status="DISPATCHED")
    _ask(client, field, dispatch["dispatch_id"], "boat")
    done = client.post(
        f"{FIELD}/dispatches/{dispatch['dispatch_id']}/completion",
        headers=field["headers"],
        json={"summary": "All families were moved to safety"},
    )
    assert done.status_code == 200, done.text
    assert [i["required_capability"] for i in _mine(client, field)] == ["boat"]  # the assignment is released, the history is kept


def test_filters_are_validated(client, make):
    field = make.field_team_user()
    for params in ({"status": "BOGUS"}, {"limit": 0}, {"limit": 101}):
        assert client.get(LIST, headers=field["headers"], params=params).status_code == 422, params


def test_only_field_responders_can_read_their_requests(client, make):
    for headers in (
        {},
        make.citizen()["headers"],
        make.staff("DISPATCH", "SUPERVISOR")["headers"],
        make.token(make.user("APP_MGMT")),
    ):
        assert client.get(LIST, headers=headers).status_code in (401, 403)


def test_a_flood_of_backup_requests_is_rate_limited(client, make, monkeypatch):
    from app import ratelimit

    field = make.field_team_user()
    dispatch = make.field_dispatch(field, status="DISPATCHED")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    ratelimit.reset()
    try:
        for n in range(20):
            _ask(client, field, dispatch["dispatch_id"], f"unit-{n:02d}")
        blocked = client.post(
            f"{FIELD}/dispatches/{dispatch['dispatch_id']}/team-requests",
            headers=field["headers"],
            json={"required_capability": "one-too-many"},
        )
        assert blocked.status_code == 429 and blocked.json()["error"]["code"] == "RATE_LIMITED"
    finally:
        ratelimit.reset()
