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

def test_list_users_with_filters():
    """AM-FR-02: Administrator can list and filter accounts."""
    token = get_admin_token()
    resp = client.get("/api/v1/admin/users?role=APP_MGMT", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert data["total"] >= 1
    assert all(u["role"] == "APP_MGMT" for u in data["users"])

def test_create_user_strictly_valid_roles():
    """AM-FR-02: Enforce strictly the 3 approved application roles."""
    token = get_admin_token()

    # Supported role: DISASTER_MGMT
    unique_email = f"medic_{uuid.uuid4().hex[:8]}@drch.gov.in"
    resp = client.post("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"}, json={
        "email": unique_email,
        "full_name": "Medic Team Alpha",
        "role": "DISASTER_MGMT",
        "password": "SecurePassword123",
        "designation": "Field Paramedic"
    })
    assert resp.status_code == 201
    assert resp.json()["role"] == "DISASTER_MGMT"

    # Unsupported role: SUPERUSER -> Rejected with 400
    bad_resp = client.post("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"}, json={
        "email": f"hacker_{uuid.uuid4().hex[:8]}@drch.gov.in",
        "full_name": "Invalid Role Tester",
        "role": "SUPERUSER",
        "password": "SecurePassword123"
    })
    assert bad_resp.status_code == 400
    assert "Only 'NORMAL_USER', 'DISASTER_MGMT', and 'APP_MGMT' are supported" in bad_resp.json()["detail"]

def test_self_escalation_prevention():
    """AM-FR-02: Self-privilege modification is strictly refused and audited."""
    token = get_admin_token()

    # Get admin's own ID
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    admin_id = me["id"]

    # Attempt to change own role
    resp = client.put(f"/api/v1/admin/users/{admin_id}", headers={"Authorization": f"Bearer {token}"}, json={
        "role": "NORMAL_USER"
    })
    assert resp.status_code == 403
    assert "Self-privilege modification is prohibited" in resp.json()["detail"]

def test_last_active_administrator_protection():
    """AM-FR-02: Refuse deactivation, demotion, or deletion of the last active administrator."""
    token = get_admin_token()

    # Ensure only 1 active admin exists for this test by checking count
    users_resp = client.get("/api/v1/admin/users?role=APP_MGMT&status=ACTIVE", headers={"Authorization": f"Bearer {token}"}).json()
    active_admins = users_resp["users"]

    # If more than 1 admin, deactivate extras so only 1 remains
    if len(active_admins) > 1:
        for extra in active_admins[1:]:
            client.put(f"/api/v1/admin/users/{extra['user_id']}", headers={"Authorization": f"Bearer {token}"}, json={
                "status": "DISABLED",
                "rationale": "Test isolation"
            })

    sole_admin = active_admins[0]["user_id"]

    # Attempt to disable the last active administrator
    resp = client.put(f"/api/v1/admin/users/{sole_admin}", headers={"Authorization": f"Bearer {token}"}, json={
        "status": "DISABLED"
    })
    assert resp.status_code in {400, 403}
    detail_lower = resp.json()["detail"].lower()
    assert "cannot deactivate" in detail_lower or "cannot suspend" in detail_lower or "cannot delete" in detail_lower

def test_account_status_update_and_audit():
    """AM-FR-02: Account suspension and reactivation are audited and effective immediately."""
    token = get_admin_token()

    # Create a test staff account with unique email
    email = f"staff_{uuid.uuid4().hex[:8]}@drch.gov.in"
    c_resp = client.post("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"}, json={
        "email": email,
        "full_name": "Test Staff Status",
        "role": "DISASTER_MGMT",
        "password": "Password12345"
    })
    user_id = c_resp.json()["user_id"]

    # Suspend user
    suspend_resp = client.put(f"/api/v1/admin/users/{user_id}", headers={"Authorization": f"Bearer {token}"}, json={
        "status": "LOCKED",
        "rationale": "Security hold pending verification"
    })
    assert suspend_resp.status_code == 200
    assert suspend_resp.json()["user"]["status"] == "LOCKED"

    # Suspended user cannot login
    login_resp = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password12345"
    })
    assert login_resp.status_code == 403

    # Reactivate user
    reactivate_resp = client.put(f"/api/v1/admin/users/{user_id}", headers={"Authorization": f"Bearer {token}"}, json={
        "status": "ACTIVE",
        "rationale": "Verification complete"
    })
    assert reactivate_resp.status_code == 200
    assert reactivate_resp.json()["user"]["status"] == "ACTIVE"

    # Reactivated user can now login
    login_ok = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "Password12345"
    })
    assert login_ok.status_code == 200
