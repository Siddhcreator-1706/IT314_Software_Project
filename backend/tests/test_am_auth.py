import uuid

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

def get_admin_token():
    resp = client.post("/api/v1/auth/login", json={
        "email": "admin@drch.gov.in",
        "password": "Admin@123"
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]

def test_admin_login_success():
    """AM-FR-01: Valid admin credentials return JWT access token and user identity."""
    resp = client.post("/api/v1/auth/login", json={
        "email": "admin@drch.gov.in",
        "password": "Admin@123"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@drch.gov.in"
    assert data["user"]["role"] == "APP_MGMT"
    assert data["user"]["status"] == "ACTIVE"

def test_admin_login_invalid_password():
    """AM-FR-01: Incorrect credentials return 401 Unauthorized."""
    resp = client.post("/api/v1/auth/login", json={
        "email": "admin@drch.gov.in",
        "password": "WrongPassword999!"
    })
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]

def test_admin_login_nonexistent_user():
    """AM-FR-01: Unknown accounts return 401 Unauthorized."""
    resp = client.post("/api/v1/auth/login", json={
        "email": "nobody@drch.gov.in",
        "password": "SomePassword123"
    })
    assert resp.status_code == 401

def test_get_profile_me():
    """AM-FR-01: Authenticated session returns profile details."""
    token = get_admin_token()
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "admin@drch.gov.in"
    assert data["role"] == "APP_MGMT"

def test_unauthenticated_request_rejected():
    """AM-FR-01: Access without token returns 401 Unauthorized."""
    resp = client.get("/api/v1/admin/users")
    assert resp.status_code == 401

def test_unauthorized_role_rejected():
    """AM-FR-01: Non-admin users cannot access administrative endpoints."""
    # Create or login as NORMAL_USER
    admin_token = get_admin_token()
    user_email = f"regular_citizen_{uuid.uuid4().hex[:8]}@drch.gov.in"
    client.post("/api/v1/admin/users", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "email": user_email,
        "full_name": "Citizen Jane",
        "role": "NORMAL_USER",
        "password": "CitizenPassword123"
    })

    # Login as citizen
    login_resp = client.post("/api/v1/auth/login", json={
        "email": user_email,
        "password": "CitizenPassword123"
    })
    citizen_token = login_resp.json()["access_token"]

    # Attempt to access admin users list
    resp = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {citizen_token}"})
    assert resp.status_code == 403
    assert "APP_MGMT administrator privileges required" in resp.json()["detail"]

def test_logout():
    """AM-FR-01: Audited logout terminates session."""
    token = get_admin_token()
    resp = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["message"] == "Logged out successfully."
