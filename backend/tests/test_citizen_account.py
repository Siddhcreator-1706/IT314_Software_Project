"""Citizen account functions: profile, language and alert preferences, password change, read-all notifications."""

import pytest

pytestmark = pytest.mark.db

PROFILE = "/api/v1/me/profile"
PASSWORD = "/api/v1/me/password"
CURRENT = "citizen-test-pass"  # the default password make.citizen() creates


def test_profile_shows_own_details_and_defaults(client, make):
    citizen = make.citizen()
    r = client.get(PROFILE, headers=citizen["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] and body["preferred_language"] == "en"
    assert body["alerts"]["in_app"] is True
    assert not {"password_hash", "token_version", "mfa_secret"} & set(body)


def test_profile_update_changes_fields_and_cannot_turn_off_in_app_alerts(client, make, sql):
    citizen = make.citizen()
    r = client.patch(PROFILE, headers=citizen["headers"], json={
        "full_name": "Asha Patel", "phone": "+919876543210", "preferred_language": "gu",
        "email_alerts": False, "sms_alerts": True,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["full_name"] == "Asha Patel" and body["phone"] == "+919876543210" and body["preferred_language"] == "gu"
    assert body["alerts"] == {"in_app": True, "email": False, "sms": True}
    assert client.get(PROFILE, headers=citizen["headers"]).json()["preferred_language"] == "gu"
    row = sql.execute(
        "SELECT result FROM audit_logs WHERE entity_id = %s AND action = 'PROFILE_UPDATED'", (citizen["user_id"],)
    ).fetchone()
    assert row["result"] == "SUCCESS"


def test_profile_update_only_touches_what_is_sent_and_never_the_email(client, make):
    citizen = make.citizen()
    before = client.get(PROFILE, headers=citizen["headers"]).json()
    r = client.patch(PROFILE, headers=citizen["headers"], json={"preferred_language": "hi", "email": "other@example.in"})
    assert r.status_code == 200
    after = r.json()
    assert after["email"] == before["email"] and after["full_name"] == before["full_name"]
    assert after["preferred_language"] == "hi"


@pytest.mark.parametrize("payload", [{"preferred_language": "fr"}, {"phone": "abc"}, {"full_name": "   "}])
def test_profile_rejects_invalid_values(client, make, payload):
    citizen = make.citizen()
    assert client.patch(PROFILE, headers=citizen["headers"], json=payload).status_code == 422


def test_password_change_ends_sessions_and_new_password_works(client, make):
    citizen = make.citizen()
    r = client.post(PASSWORD, headers=citizen["headers"], json={"current_password": CURRENT, "new_password": "Brand-new1!pass"})
    assert r.status_code == 200 and r.json() == {"changed": True, "sign_in_required": True}
    assert client.get(PROFILE, headers=citizen["headers"]).status_code == 401  # old token revoked
    email = citizen["email"]
    assert client.post("/api/v1/auth/login", json={"email": email, "password": CURRENT}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "Brand-new1!pass"}).status_code == 200


def test_password_change_checks_current_password_and_policy(client, make, sql):
    citizen = make.citizen()
    wrong = client.post(PASSWORD, headers=citizen["headers"], json={"current_password": "nope", "new_password": "Brand-new1!pass"})
    assert wrong.status_code == 400 and wrong.json()["error"]["code"] == "INVALID_CURRENT_PASSWORD"
    failed = sql.execute(
        "SELECT result FROM audit_logs WHERE entity_id = %s AND action = 'PASSWORD_CHANGE_FAILED'", (citizen["user_id"],)
    ).fetchone()
    assert failed["result"] == "FAILURE"
    weak = client.post(PASSWORD, headers=citizen["headers"], json={"current_password": CURRENT, "new_password": "short"})
    assert weak.status_code == 422 and weak.json()["error"]["code"] == "WEAK_PASSWORD"
    assert client.get(PROFILE, headers=citizen["headers"]).status_code == 200  # nothing changed, session still valid


def test_new_password_must_differ_from_the_current_one(client, make):
    citizen = make.citizen(password="Valid-pass1!")
    same = client.post(PASSWORD, headers=citizen["headers"], json={"current_password": "Valid-pass1!", "new_password": "Valid-pass1!"})
    assert same.status_code == 422 and same.json()["error"]["code"] == "PASSWORD_UNCHANGED"


def test_account_routes_need_a_citizen(client, make):
    assert client.get(PROFILE).status_code == 401
    assert client.post(PASSWORD, json={"current_password": "a", "new_password": "b"}).status_code == 401
    staff = make.staff()
    assert client.get(PROFILE, headers=staff["headers"]).status_code == 403


def test_mark_all_notifications_read(client, make):
    citizen = make.citizen()
    payload = {
        "scenario": "urban_flooding", "description": "Severe waterlogging on the main market road.",
        "latitude": 23.0225, "longitude": 72.5714,
    }
    assert client.post("/api/v1/incidents", json=payload, headers=citizen["headers"]).status_code == 201
    unread = client.get("/api/v1/me/notifications", headers=citizen["headers"]).json()["items"]
    assert unread and all(n["read_at"] is None for n in unread)
    done = client.post("/api/v1/me/notifications/read-all", headers=citizen["headers"])
    assert done.status_code == 200 and done.json()["marked_read"] == len(unread)
    assert all(n["read_at"] for n in client.get("/api/v1/me/notifications", headers=citizen["headers"]).json()["items"])
    assert client.post("/api/v1/me/notifications/read-all", headers=citizen["headers"]).json()["marked_read"] == 0
