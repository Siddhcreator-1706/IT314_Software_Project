import uuid

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

def get_admin_token():
    resp = client.post("/api/v1/auth/login", json={
        "email": "admin@drch.gov.in",
        "password": "Admin@123"
    })
    return resp.json()["access_token"]

def test_security_overview():
    """AM-FR-07: Administrator can view security posture and locked accounts."""
    token = get_admin_token()
    resp = client.get("/api/v1/admin/security/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "active_administrators" in data
    assert data["active_administrators"] >= 1
    assert "policies" in data
    assert "min_password_length" in data["policies"]

def test_account_unlock():
    """AM-FR-07: Administrator can unlock a locked account."""
    token = get_admin_token()

    # Create account and simulate lockout
    email = f"locked_{uuid.uuid4().hex[:8]}@drch.gov.in"
    c_resp = client.post("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"}, json={
        "email": email,
        "full_name": "Locked User Tester",
        "role": "NORMAL_USER",
        "password": "UserPass12345"
    })
    user_id = c_resp.json()["user_id"]

    # Lock account
    client.put(f"/api/v1/admin/users/{user_id}", headers={"Authorization": f"Bearer {token}"}, json={
        "status": "LOCKED",
        "rationale": "Excessive failed logins"
    })

    # Unlock account via security management endpoint
    unlock_resp = client.post(f"/api/v1/admin/security/unlock/{user_id}", headers={"Authorization": f"Bearer {token}"})
    assert unlock_resp.status_code == 200
    assert "unlocked" in unlock_resp.json()["message"]

    # Verify user can login
    login_resp = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "UserPass12345"
    })
    assert login_resp.status_code == 200

def test_session_revocation():
    """AM-FR-07: Session revocation increments token_version and invalidates active JWTs."""
    token = get_admin_token()

    # Create user and log in to obtain JWT
    email = f"session_{uuid.uuid4().hex[:8]}@drch.gov.in"
    c_resp = client.post("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"}, json={
        "email": email,
        "full_name": "Session Tester",
        "role": "DISASTER_MGMT",
        "password": "SessionPassword123"
    })
    user_id = c_resp.json()["user_id"]

    login_resp = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "SessionPassword123"
    })
    user_token = login_resp.json()["access_token"]

    # Verify token works
    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    assert me_resp.status_code == 200

    # Revoke sessions for this user
    revoke_resp = client.post(f"/api/v1/admin/security/revoke-sessions/{user_id}", headers={"Authorization": f"Bearer {token}"})
    assert revoke_resp.status_code == 200

    # Verify previous token is now rejected with 401
    me_rejected = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {user_token}"})
    assert me_rejected.status_code == 401
    assert "Session has been revoked" in me_rejected.json()["detail"]

def test_abuse_controls_blocklist():
    """AM-FR-11: Administrator can configure blocklist and blocked IPs receive 403."""
    token = get_admin_token()

    test_ip = "198.51.100.44"

    # Add IP to blocklist
    add_resp = client.post("/api/v1/admin/abuse-controls/blocklist", headers={"Authorization": f"Bearer {token}"}, json={
        "ip": test_ip,
        "reason": "Simulated DDoS probe bot",
        "duration_minutes": 30
    })
    assert add_resp.status_code == 200

    # Request from that IP is blocked
    blocked_resp = client.get("/api/v1/auth/me", headers={"X-Forwarded-For": test_ip})
    assert blocked_resp.status_code == 403
    assert "Access forbidden" in blocked_resp.json()["detail"]

    # Remove IP from blocklist
    remove_resp = client.delete(f"/api/v1/admin/abuse-controls/blocklist/{test_ip}", headers={"Authorization": f"Bearer {token}"})
    assert remove_resp.status_code == 200

    # Unblocked IP can access again
    unblocked_resp = client.get("/health", headers={"X-Forwarded-For": test_ip})
    assert unblocked_resp.status_code == 200

def test_abuse_rate_limit_configuration():
    """AM-FR-11: Administrator can configure rate limit thresholds."""
    token = get_admin_token()

    resp = client.put("/api/v1/admin/abuse-controls/rules", headers={"Authorization": f"Bearer {token}"}, json={
        "rules": {"auth_login": 15, "incident_report": 45}
    })
    assert resp.status_code == 200
    rules = resp.json()["rules"]
    assert rules["auth_login"] == 15
    assert rules["incident_report"] == 45
