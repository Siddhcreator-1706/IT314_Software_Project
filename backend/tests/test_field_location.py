"""A field team's reported position moves its marker on the live map, but only while it has an active dispatch."""

import pytest

pytestmark = pytest.mark.db

FIELD = "/api/v1/field"
DM = "/api/v1/dm"
VADODARA = {"latitude": 22.3072, "longitude": 73.1812}
MUMBAI = {"latitude": 19.0760, "longitude": 72.8777}  # outside Gujarat


def _position(sql, resource_id) -> dict:
    return sql.execute(
        "SELECT ST_Y(current_geom::geometry) AS lat, ST_X(current_geom::geometry) AS lon, position_updated_at, version "
        "FROM resources WHERE resource_id = %s",
        (resource_id,),
    ).fetchone()


def _share(client, field, body=VADODARA):
    return client.post(f"{FIELD}/location", headers=field["headers"], json=body)


def test_a_team_with_an_active_dispatch_moves_its_marker(client, make, sql):
    field = make.field_team_user()
    make.field_dispatch(field, status="REQUESTED")
    before = _position(sql, field["resource_id"])
    assert before["position_updated_at"] is None  # never reported by the team

    response = _share(client, field)
    assert response.status_code == 200, response.text
    assert set(response.json()) == {"recorded_at"}

    after = _position(sql, field["resource_id"])
    assert after["lat"] == pytest.approx(VADODARA["latitude"]) and after["lon"] == pytest.approx(VADODARA["longitude"])
    assert after["position_updated_at"] is not None
    assert after["version"] == before["version"], "a position update must not make a dispatcher's resource edit conflict"


def test_the_dispatcher_map_shows_the_new_position_and_how_fresh_it_is(client, make):
    field = make.field_team_user()
    make.field_dispatch(field, status="ACKNOWLEDGED")
    assert _share(client, field).status_code == 200

    team = next(
        r for r in client.get(f"{DM}/map", headers=make.staff()["headers"]).json()["resources"]
        if r["resource_id"] == str(field["resource_id"])
    )
    assert team["latitude"] == pytest.approx(VADODARA["latitude"]) and team["longitude"] == pytest.approx(VADODARA["longitude"])
    assert team["position_updated_at"] is not None


def test_a_team_that_is_off_duty_is_never_tracked(client, make, sql):
    idle = make.field_team_user()  # no dispatch at all
    finished = make.field_team_user()
    make.field_dispatch(finished, status="COMPLETED")  # its only dispatch is over

    for field in (idle, finished):
        before = _position(sql, field["resource_id"])
        refused = _share(client, field)
        assert refused.status_code == 409 and refused.json()["error"]["code"] == "NO_ACTIVE_DISPATCH"
        after = _position(sql, field["resource_id"])
        assert after["lat"] == before["lat"] and after["position_updated_at"] is None  # nothing was stored


def test_a_position_outside_gujarat_or_out_of_range_is_refused(client, make, sql):
    field = make.field_team_user()
    make.field_dispatch(field, status="REQUESTED")
    before = _position(sql, field["resource_id"])

    outside = _share(client, field, MUMBAI)
    assert outside.status_code == 422 and outside.json()["error"]["code"] == "OUTSIDE_GUJARAT"
    for bad in ({"latitude": 95, "longitude": 73}, {"latitude": 22.3}, {}, {"latitude": "north", "longitude": 73}):
        assert _share(client, field, bad).status_code == 422, bad
    assert _position(sql, field["resource_id"])["lat"] == before["lat"]


def test_a_progress_report_with_coordinates_moves_the_marker(client, make, sql):
    field = make.field_team_user()
    dispatch = make.field_dispatch(field, status="REQUESTED")
    base = f"{FIELD}/dispatches/{dispatch['dispatch_id']}"
    assert client.post(f"{base}/acknowledgement", headers=field["headers"]).status_code == 200

    moved = client.post(f"{base}/progress", headers=field["headers"], json={"status": "EN_ROUTE", **VADODARA})
    assert moved.status_code == 200, moved.text
    now = _position(sql, field["resource_id"])
    assert now["lat"] == pytest.approx(VADODARA["latitude"]) and now["position_updated_at"] is not None


def test_a_progress_report_from_outside_gujarat_still_succeeds_but_does_not_move_the_marker(client, make, sql):
    field = make.field_team_user()
    dispatch = make.field_dispatch(field, status="REQUESTED")
    base = f"{FIELD}/dispatches/{dispatch['dispatch_id']}"
    client.post(f"{base}/acknowledgement", headers=field["headers"])
    before = _position(sql, field["resource_id"])

    report = client.post(f"{base}/progress", headers=field["headers"], json={"status": "EN_ROUTE", **MUMBAI})
    assert report.status_code == 200, report.text  # the report itself is never lost because of a bad position
    after = _position(sql, field["resource_id"])
    assert after["lat"] == before["lat"] and after["position_updated_at"] is None


def test_a_team_only_moves_its_own_marker(client, make, sql):
    mine, other = make.field_team_user(), make.field_team_user()
    make.field_dispatch(mine, status="REQUESTED")
    before = _position(sql, other["resource_id"])
    assert _share(client, mine).status_code == 200
    assert _position(sql, other["resource_id"])["lat"] == before["lat"]


def test_only_field_responders_can_share_a_position(client, make):
    for headers in (
        {},
        make.citizen()["headers"],
        make.staff("DISPATCH", "SUPERVISOR")["headers"],
        make.token(make.user("APP_MGMT")),
    ):
        assert client.post(f"{FIELD}/location", headers=headers, json=VADODARA).status_code in (401, 403)
