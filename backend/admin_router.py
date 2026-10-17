import datetime
import logging
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from audit_service import log_audit_event
from auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from db_conn import get_db, query_all, query_one
from rate_limiter import abuse_manager

logger = logging.getLogger("drch.admin")
router = APIRouter(prefix="/api/v1")

VALID_ROLES = {"NORMAL_USER", "DISASTER_MGMT", "APP_MGMT"}
VALID_STATUSES = {"ACTIVE", "LOCKED", "DISABLED", "PENDING_VERIFICATION"}

# ==============================================================================
# Pydantic Request / Response Schemas
# ==============================================================================
class LoginRequest(BaseModel):
    email: str
    password: str
    mfa_code: str | None = None

class CreateUserRequest(BaseModel):
    email: str
    full_name: str = Field(min_length=2, max_length=150)
    role: str
    password: str = Field(min_length=8)
    phone: str | None = None
    agency_id: str | None = None
    designation: str | None = None

class UpdateUserRequest(BaseModel):
    full_name: str | None = None
    role: str | None = None
    status: str | None = None
    phone: str | None = None
    agency_id: str | None = None
    designation: str | None = None
    rationale: str | None = None

class DataCorrectionRequest(BaseModel):
    field_updates: dict[str, Any]
    rationale: str = Field(min_length=5, description="Audited explanation for the data correction")

class SecurityPolicyRequest(BaseModel):
    min_password_length: int | None = Field(default=None, ge=8, le=64)
    max_failed_attempts: int | None = Field(default=None, ge=3, le=10)
    lockout_duration_minutes: int | None = Field(default=None, ge=5, le=1440)
    session_expiry_minutes: int | None = Field(default=None, ge=15, le=1440)
    mfa_enforced: bool | None = None

class BlocklistRequest(BaseModel):
    ip: str
    reason: str
    duration_minutes: int | None = 60

class UpdateRateLimitsRequest(BaseModel):
    rules: dict[str, int]

# ==============================================================================
# 1. AM-FR-01: Authentication & Administrator Login
# ==============================================================================
@router.post("/auth/login")
def login(req: LoginRequest, request: Request):
    """
    Authenticate administrator or user, verify credentials and lockout state.
    Returns JWT access token with role information.
    """
    client_ip = abuse_manager.get_client_ip(request)
    email_clean = req.email.strip().lower()

    sql = """
        SELECT u.user_id, u.email, u.full_name, u.status, u.role_id,
               r.code AS role, a.password_hash, a.mfa_enabled,
               a.failed_login_count, a.locked_until, a.token_version
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        LEFT JOIN user_auth a ON u.user_id = a.user_id
        WHERE u.email = %s;
    """
    user = query_one(sql, (email_clean,))

    if not user:
        abuse_manager.log_event(client_ip, "AUTH_FAILURE", f"Non-existent email: {email_clean}", 401)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    user_id = str(user["user_id"])

    # Check brute-force lockout
    if user.get("locked_until"):
        now_tz = datetime.datetime.now(datetime.UTC)
        if user["locked_until"] > now_tz:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is temporarily locked due to repeated failed attempts. Try again after {user['locked_until'].strftime('%H:%M:%S UTC')}."
            )

    # Check status
    if user["status"] in {"DISABLED", "LOCKED"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user['status'].lower()}. Please contact system administration."
        )

    # Validate password
    stored_hash = user.get("password_hash")
    if not verify_password(req.password, stored_hash):
        with get_db() as conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE user_auth
                SET failed_login_count = failed_login_count + 1,
                    locked_until = CASE
                        WHEN failed_login_count + 1 >= 5 THEN now() + INTERVAL '15 minutes'
                        ELSE NULL
                    END
                WHERE user_id = %s;
                """,
                (user_id,)
            )
        log_audit_event(
            action="LOGIN_FAILED",
            entity_type="user",
            entity_id=user_id,
            actor_role=user["role"],
            result="FAILURE",
            rationale=f"Invalid password attempt from {client_ip}",
            ip_address=client_ip
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    # Successful login: reset failed counter and record last_login_at
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE user_auth
            SET failed_login_count = 0,
                locked_until = NULL,
                last_login_at = now()
            WHERE user_id = %s;
            """,
            (user_id,)
        )

    token_ver = user.get("token_version") or 1
    access_token = create_access_token(user_id, user["role"], user["email"], token_version=token_ver)

    log_audit_event(
        action="LOGIN_SUCCESS",
        entity_type="user",
        entity_id=user_id,
        actor_id=user_id,
        actor_role=user["role"],
        result="SUCCESS",
        rationale=f"User authenticated successfully from {client_ip}",
        ip_address=client_ip
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": user["email"],
            "name": user["full_name"],
            "role": user["role"],
            "status": user["status"],
            "mfa_enabled": user.get("mfa_enabled", False),
        }
    }

@router.get("/auth/me")
def get_profile(current_user: Annotated[dict, Depends(get_current_user)]):
    """Return currently authenticated user identity and authorization role."""
    return {
        "id": str(current_user["user_id"]),
        "email": current_user["email"],
        "name": current_user["full_name"],
        "role": current_user["role"],
        "status": current_user["status"],
        "phone": current_user.get("phone"),
    }

@router.post("/auth/logout")
def logout(current_user: Annotated[dict, Depends(get_current_user)], request: Request):
    """Audited user logout."""
    client_ip = abuse_manager.get_client_ip(request)
    log_audit_event(
        action="LOGOUT",
        entity_type="user",
        entity_id=str(current_user["user_id"]),
        actor_id=str(current_user["user_id"]),
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale="User session terminated normally.",
        ip_address=client_ip
    )
    return {"message": "Logged out successfully."}

# ==============================================================================
# 2. AM-FR-02: Account and Role Management
# ==============================================================================
@router.get("/admin/users")
def list_users(
    current_user: Annotated[dict, Depends(get_current_user)],
    search: str | None = None,
    role: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List registered user accounts with filtering, search, and pagination."""
    require_admin(current_user)

    conditions = ["1=1"]
    params = []

    if search:
        conditions.append("(u.full_name ILIKE %s OR u.email ILIKE %s OR u.phone ILIKE %s)")
        term = f"%{search.strip()}%"
        params.extend([term, term, term])

    if role:
        if role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role filter '{role}'.")
        conditions.append("r.code = %s")
        params.append(role)

    if status_filter:
        if status_filter not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status filter '{status_filter}'.")
        conditions.append("u.status = %s")
        params.append(status_filter)

    where_clause = " AND ".join(conditions)

    count_sql = f"""
        SELECT COUNT(*) AS total
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE {where_clause};
    """
    total_records = query_one(count_sql, tuple(params))["total"]

    sql = f"""
        SELECT u.user_id, u.email, u.full_name, u.phone, u.status,
               r.code AS role, a.name AS agency_name, u.designation,
               auth.failed_login_count, auth.locked_until, auth.last_login_at,
               u.created_at, u.updated_at
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        LEFT JOIN agencies a ON u.agency_id = a.agency_id
        LEFT JOIN user_auth auth ON u.user_id = auth.user_id
        WHERE {where_clause}
        ORDER BY u.created_at DESC
        LIMIT %s OFFSET %s;
    """
    params.extend([limit, offset])
    users = query_all(sql, tuple(params))

    for u in users:
        u["user_id"] = str(u["user_id"])
        if u.get("created_at"):
            u["created_at"] = u["created_at"].isoformat()
        if u.get("updated_at"):
            u["updated_at"] = u["updated_at"].isoformat()
        if u.get("last_login_at"):
            u["last_login_at"] = u["last_login_at"].isoformat()
        if u.get("locked_until"):
            u["locked_until"] = u["locked_until"].isoformat()

    return {
        "total": total_records,
        "limit": limit,
        "offset": offset,
        "users": users
    }

@router.get("/admin/users/{user_id}")
def get_user_detail(user_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """Retrieve full account and RBAC profile details for an individual user."""
    require_admin(current_user)

    sql = """
        SELECT u.user_id, u.email, u.full_name, u.phone, u.status,
               r.code AS role, u.agency_id, a.name AS agency_name, u.designation,
               auth.failed_login_count, auth.locked_until, auth.last_login_at,
               auth.mfa_enabled, auth.token_version, u.created_at, u.updated_at
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        LEFT JOIN agencies a ON u.agency_id = a.agency_id
        LEFT JOIN user_auth auth ON u.user_id = auth.user_id
        WHERE u.user_id = %s;
    """
    user = query_one(sql, (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    user["user_id"] = str(user["user_id"])
    if user.get("agency_id"):
        user["agency_id"] = str(user["agency_id"])
    return user

@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
def create_user(req: CreateUserRequest, request: Request, current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Administrator creates a vetted staff, responder, or user account.
    Enforces strictly the 3 approved application roles.
    """
    require_admin(current_user)
    client_ip = abuse_manager.get_client_ip(request)

    if req.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{req.role}'. Only 'NORMAL_USER', 'DISASTER_MGMT', and 'APP_MGMT' are supported."
        )

    existing = query_one("SELECT user_id FROM users WHERE email = %s;", (req.email.strip().lower(),))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    new_id = str(uuid.uuid4())
    pass_hash = hash_password(req.password)

    with get_db() as conn, conn.cursor() as cur:
        cur.execute("SELECT role_id FROM roles WHERE code = %s;", (req.role,))
        r_row = cur.fetchone()
        if not r_row:
            raise HTTPException(status_code=400, detail="Role not configured in database.")
        role_id = r_row[0]

        cur.execute(
            """
            INSERT INTO users (user_id, role_id, email, full_name, phone, designation, agency_id, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'ACTIVE');
            """,
            (new_id, role_id, req.email.strip().lower(), req.full_name.strip(), req.phone, req.designation, req.agency_id)
        )

        cur.execute(
            """
            INSERT INTO user_auth (user_id, password_hash, mfa_enabled)
            VALUES (%s, %s, FALSE);
            """,
            (new_id, pass_hash)
        )

    log_audit_event(
        action="USER_CREATED",
        entity_type="user",
        entity_id=new_id,
        actor_id=str(current_user["user_id"]),
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale=f"Created user with role {req.role}",
        after_state={"user_id": new_id, "email": req.email, "role": req.role, "status": "ACTIVE"},
        ip_address=client_ip
    )

    return {
        "message": "User account created successfully.",
        "user_id": new_id,
        "email": req.email,
        "role": req.role,
        "status": "ACTIVE"
    }

@router.put("/admin/users/{user_id}")
def update_user(user_id: str, req: UpdateUserRequest, request: Request, current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Update user profile, status, or role.
    Strictly prevents self-escalation and protects the last active administrator.
    """
    require_admin(current_user)
    client_ip = abuse_manager.get_client_ip(request)

    sql = """
        SELECT u.user_id, u.email, u.full_name, u.phone, u.status,
               r.code AS role, u.designation, u.agency_id
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE u.user_id = %s;
    """
    target = query_one(sql, (user_id,))
    if not target:
        raise HTTPException(status_code=404, detail="User account not found.")

    target_id_str = str(target["user_id"])
    admin_id_str = str(current_user["user_id"])

    new_role = req.role if req.role is not None else target["role"]
    if req.role is not None and req.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{req.role}'. Only 'NORMAL_USER', 'DISASTER_MGMT', and 'APP_MGMT' are supported."
        )

    new_status = req.status if req.status is not None else target["status"]
    if req.status is not None and req.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid account status '{req.status}'."
        )

    # Self-escalation / modification guard
    if target_id_str == admin_id_str:
        if req.role is not None and req.role != current_user["role"]:
            log_audit_event(
                action="SELF_ESCALATION_BLOCKED",
                entity_type="user",
                entity_id=target_id_str,
                actor_id=admin_id_str,
                actor_role=current_user["role"],
                result="DENIED",
                rationale="Attempted to modify own administrative role",
                ip_address=client_ip
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Self-privilege modification is prohibited. Another administrator must change your role."
            )
        if req.status is not None and req.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot suspend or disable your own active administrator account."
            )

    # Last active administrator guard
    if target["role"] == "APP_MGMT" and (new_role != "APP_MGMT" or new_status in {"LOCKED", "DISABLED"}):
        count_row = query_one(
            """
            SELECT COUNT(*) AS active_admins
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE r.code = 'APP_MGMT' AND u.status = 'ACTIVE';
            """
        )
        if count_row["active_admins"] <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Operation refused: Cannot deactivate, demote, or lock the last active system administrator."
            )

    before_state = {
        "email": target["email"],
        "full_name": target["full_name"],
        "role": target["role"],
        "status": target["status"],
        "designation": target["designation"],
    }

    new_name = req.full_name.strip() if req.full_name else target["full_name"]
    new_phone = req.phone if req.phone is not None else target["phone"]
    new_desig = req.designation if req.designation is not None else target["designation"]
    new_agency = req.agency_id if req.agency_id is not None else target["agency_id"]

    with get_db() as conn, conn.cursor() as cur:
        cur.execute("SELECT role_id FROM roles WHERE code = %s;", (new_role,))
        role_id = cur.fetchone()[0]

        cur.execute(
            """
            UPDATE users
            SET role_id = %s,
                status = %s,
                full_name = %s,
                phone = %s,
                designation = %s,
                agency_id = %s,
                updated_at = now()
            WHERE user_id = %s;
            """,
            (role_id, new_status, new_name, new_phone, new_desig, new_agency, target_id_str)
        )

    after_state = {
        "email": target["email"],
        "full_name": new_name,
        "role": new_role,
        "status": new_status,
        "designation": new_desig,
    }

    log_audit_event(
        action="USER_UPDATED",
        entity_type="user",
        entity_id=target_id_str,
        actor_id=admin_id_str,
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale=req.rationale or f"Admin updated account {target['email']} (role: {new_role}, status: {new_status})",
        before_state=before_state,
        after_state=after_state,
        ip_address=client_ip
    )

    return {"message": "User updated successfully.", "user": after_state}

@router.delete("/admin/users/{user_id}")
def delete_user(user_id: str, request: Request, current_user: Annotated[dict, Depends(get_current_user)]):
    """Deactivate or remove a user account. Strictly protects the last active administrator."""
    require_admin(current_user)
    client_ip = abuse_manager.get_client_ip(request)

    sql = """
        SELECT u.user_id, u.email, u.status, r.code AS role
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE u.user_id = %s;
    """
    target = query_one(sql, (user_id,))
    if not target:
        raise HTTPException(status_code=404, detail="User account not found.")

    target_id_str = str(target["user_id"])
    if target_id_str == str(current_user["user_id"]):
        raise HTTPException(status_code=400, detail="Cannot delete your own administrative account.")

    if target["role"] == "APP_MGMT" and target["status"] == "ACTIVE":
        count_row = query_one(
            """
            SELECT COUNT(*) AS active_admins
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE r.code = 'APP_MGMT' AND u.status = 'ACTIVE';
            """
        )
        if count_row["active_admins"] <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Operation refused: Cannot delete or deactivate the last active system administrator."
            )

    with get_db() as conn, conn.cursor() as cur:
        cur.execute("UPDATE users SET status = 'DISABLED', updated_at = now() WHERE user_id = %s;", (target_id_str,))
        cur.execute("UPDATE user_auth SET token_version = token_version + 1 WHERE user_id = %s;", (target_id_str,))

    log_audit_event(
        action="USER_DEACTIVATED",
        entity_type="user",
        entity_id=target_id_str,
        actor_id=str(current_user["user_id"]),
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale=f"Admin deactivated account {target['email']}",
        before_state={"status": target["status"]},
        after_state={"status": "DISABLED"},
        ip_address=client_ip
    )

    return {"message": f"Account {target['email']} has been deactivated and tokens revoked."}

# ==============================================================================
# 3. AM-FR-05: Logging and Audit
# ==============================================================================
@router.get("/admin/audit-logs")
def get_audit_logs(
    current_user: Annotated[dict, Depends(get_current_user)],
    action: str | None = None,
    entity_type: str | None = None,
    actor_id: str | None = None,
    result: str | None = None,
    search: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """
    Search, filter, and paginate tamper-evident audit records.
    Audit records are protected and cannot be modified or deleted.
    """
    require_admin(current_user)

    conditions = ["1=1"]
    params = []

    if action:
        conditions.append("a.action = %s")
        params.append(action)

    if entity_type:
        conditions.append("a.entity_type = %s")
        params.append(entity_type)

    if actor_id:
        conditions.append("a.actor_id = %s")
        params.append(actor_id)

    if result:
        conditions.append("a.result = %s")
        params.append(result)

    if search:
        conditions.append("(a.action ILIKE %s OR a.rationale ILIKE %s OR u.email ILIKE %s)")
        term = f"%{search.strip()}%"
        params.extend([term, term, term])

    where_clause = " AND ".join(conditions)

    count_sql = f"""
        SELECT COUNT(*) AS total
        FROM audit_logs a
        LEFT JOIN users u ON a.actor_id = u.user_id
        WHERE {where_clause};
    """
    total = query_one(count_sql, tuple(params))["total"]

    sql = f"""
        SELECT a.audit_id, a.occurred_at, a.actor_id, a.actor_role,
               u.full_name AS actor_name, u.email AS actor_email,
               a.action, a.entity_type, a.entity_id, a.result,
               a.rationale, a.before_state, a.after_state,
               a.ip_address, a.prev_hash, a.row_hash
        FROM audit_logs a
        LEFT JOIN users u ON a.actor_id = u.user_id
        WHERE {where_clause}
        ORDER BY a.audit_id DESC
        LIMIT %s OFFSET %s;
    """
    params.extend([limit, offset])
    logs = query_all(sql, tuple(params))

    for log in logs:
        if log.get("occurred_at"):
            log["occurred_at"] = log["occurred_at"].isoformat()
        if log.get("actor_id"):
            log["actor_id"] = str(log["actor_id"])
        if log.get("entity_id"):
            log["entity_id"] = str(log["entity_id"])
        if log.get("ip_address"):
            log["ip_address"] = str(log["ip_address"])

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "logs": logs
    }

# ==============================================================================
# 4. AM-FR-06: Data Management & Controlled Corrections
# ==============================================================================
@router.get("/admin/data/entities")
def get_data_entities(current_user: Annotated[dict, Depends(get_current_user)]):
    """Return overview of manageable system data entities."""
    require_admin(current_user)
    return {
        "entities": [
            {"type": "agencies", "label": "Emergency Response Agencies", "table": "agencies"},
            {"type": "safety_content", "label": "Public Safety & Advisory Content", "table": "safety_content"},
            {"type": "system_configs", "label": "System Baseline Configuration", "table": "system_configs"},
        ]
    }

@router.get("/admin/data/{entity_type}")
def list_entity_data(entity_type: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """List records for an approved entity type for administrative data management."""
    require_admin(current_user)

    if entity_type == "agencies":
        records = query_all("SELECT agency_id, name, agency_type, contact_email, contact_phone, is_active FROM agencies ORDER BY name;")
        for r in records:
            r["id"] = str(r.pop("agency_id"))
        return {"entity_type": entity_type, "records": records}

    if entity_type == "safety_content":
        records = query_all("SELECT content_id, title, scenario, status, language, version FROM safety_content ORDER BY updated_at DESC;")
        for r in records:
            r["id"] = str(r.pop("content_id"))
        return {"entity_type": entity_type, "records": records}

    if entity_type == "system_configs":
        records = query_all("SELECT config_id, config_key, value, version, is_active FROM system_configs ORDER BY config_key;")
        for r in records:
            r["id"] = str(r.pop("config_id"))
        return {"entity_type": entity_type, "records": records}

    raise HTTPException(status_code=400, detail=f"Unsupported entity type '{entity_type}'.")

@router.put("/admin/data/{entity_type}/{record_id}")
def correct_entity_data(
    entity_type: str,
    record_id: str,
    req: DataCorrectionRequest,
    request: Request,
    current_user: Annotated[dict, Depends(get_current_user)]
):
    """
    Perform a controlled, audited data correction preserving traceability.
    Changes execute inside a strict database transaction with rollback.
    """
    require_admin(current_user)
    client_ip = abuse_manager.get_client_ip(request)

    if entity_type == "agencies":
        current_record = query_one("SELECT * FROM agencies WHERE agency_id = %s;", (record_id,))
        if not current_record:
            raise HTTPException(status_code=404, detail="Agency record not found.")

        name = req.field_updates.get("name", current_record["name"])
        agency_type = req.field_updates.get("agency_type", current_record["agency_type"])
        email = req.field_updates.get("contact_email", current_record["contact_email"])
        phone = req.field_updates.get("contact_phone", current_record["contact_phone"])
        is_active = req.field_updates.get("is_active", current_record["is_active"])

        with get_db() as conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE agencies
                SET name = %s,
                    agency_type = %s,
                    contact_email = %s,
                    contact_phone = %s,
                    is_active = %s,
                    updated_at = now()
                WHERE agency_id = %s;
                """,
                (name, agency_type, email, phone, is_active, record_id)
            )
        updates = {"name": name, "agency_type": agency_type, "contact_email": email, "is_active": is_active}

    elif entity_type == "safety_content":
        current_record = query_one("SELECT * FROM safety_content WHERE content_id = %s;", (record_id,))
        if not current_record:
            raise HTTPException(status_code=404, detail="Safety content record not found.")

        title = req.field_updates.get("title", current_record["title"])
        status_val = req.field_updates.get("status", current_record["status"])
        language = req.field_updates.get("language", current_record["language"])

        with get_db() as conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE safety_content
                SET title = %s,
                    status = %s,
                    language = %s,
                    updated_at = now()
                WHERE content_id = %s;
                """,
                (title, status_val, language, record_id)
            )
        updates = {"title": title, "status": status_val, "language": language}

    elif entity_type == "system_configs":
        current_record = query_one("SELECT * FROM system_configs WHERE config_id = %s;", (record_id,))
        if not current_record:
            raise HTTPException(status_code=404, detail="System config record not found.")

        from psycopg2.extras import Json
        new_val = req.field_updates.get("value", current_record["value"])

        with get_db() as conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE system_configs
                SET value = %s,
                    version = version + 1,
                    changed_by = %s,
                    updated_at = now()
                WHERE config_id = %s;
                """,
                (Json(new_val), current_user["user_id"], record_id)
            )
        updates = {"value": new_val}

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported entity type '{entity_type}'.")

    log_audit_event(
        action=f"{entity_type.upper()}_CORRECTED",
        entity_type=entity_type,
        entity_id=record_id,
        actor_id=str(current_user["user_id"]),
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale=req.rationale,
        before_state={"data": {k: current_record.get(k) for k in req.field_updates}},
        after_state={"data": updates},
        ip_address=client_ip
    )

    return {"message": "Data correction committed successfully.", "entity_type": entity_type, "record_id": record_id}

# ==============================================================================
# 5. AM-FR-07: Security Management
# ==============================================================================
@router.get("/admin/security/overview")
def get_security_overview(current_user: Annotated[dict, Depends(get_current_user)]):
    """Return security posture overview including locked accounts, admins count, and sessions."""
    require_admin(current_user)

    admin_count = query_one(
        "SELECT COUNT(*) AS total FROM users u JOIN roles r ON u.role_id = r.role_id WHERE r.code = 'APP_MGMT' AND u.status = 'ACTIVE';"
    )["total"]

    locked_count = query_one(
        "SELECT COUNT(*) AS total FROM users u LEFT JOIN user_auth a ON u.user_id = a.user_id WHERE u.status = 'LOCKED' OR a.locked_until > now();"
    )["total"]

    disabled_count = query_one("SELECT COUNT(*) AS total FROM users WHERE status = 'DISABLED';")["total"]

    locked_users = query_all(
        """
        SELECT u.user_id, u.email, u.full_name, a.failed_login_count, a.locked_until
        FROM users u
        JOIN user_auth a ON u.user_id = a.user_id
        WHERE u.status = 'LOCKED' OR a.locked_until > now()
        ORDER BY a.locked_until DESC
        LIMIT 10;
        """
    )
    for u in locked_users:
        u["user_id"] = str(u["user_id"])
        if u.get("locked_until"):
            u["locked_until"] = u["locked_until"].isoformat()

    return {
        "active_administrators": admin_count,
        "locked_accounts_count": locked_count,
        "disabled_accounts_count": disabled_count,
        "locked_accounts": locked_users,
        "policies": {
            "min_password_length": 8,
            "max_failed_attempts": 5,
            "lockout_duration_minutes": 15,
            "session_expiry_minutes": 120,
            "mfa_enforced": False
        }
    }

@router.post("/admin/security/unlock/{user_id}")
def unlock_account(user_id: str, request: Request, current_user: Annotated[dict, Depends(get_current_user)]):
    """Unlock a locked account and reset the brute-force failed login counter."""
    require_admin(current_user)
    client_ip = abuse_manager.get_client_ip(request)

    user = query_one("SELECT email, status FROM users WHERE user_id = %s;", (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE users SET status = 'ACTIVE', updated_at = now() WHERE user_id = %s;
            UPDATE user_auth SET failed_login_count = 0, locked_until = NULL WHERE user_id = %s;
            """,
            (user_id, user_id)
        )

    log_audit_event(
        action="ACCOUNT_UNLOCKED",
        entity_type="user",
        entity_id=user_id,
        actor_id=str(current_user["user_id"]),
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale=f"Administrator unlocked account {user['email']}",
        ip_address=client_ip
    )

    return {"message": f"Account {user['email']} has been unlocked and failed attempt count reset."}

@router.post("/admin/security/revoke-sessions/{user_id}")
def revoke_user_sessions(user_id: str, request: Request, current_user: Annotated[dict, Depends(get_current_user)]):
    """Increment user token_version, instantly invalidating all active JWT sessions."""
    require_admin(current_user)
    client_ip = abuse_manager.get_client_ip(request)

    user = query_one("SELECT email FROM users WHERE user_id = %s;", (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    with get_db() as conn, conn.cursor() as cur:
        cur.execute("UPDATE user_auth SET token_version = token_version + 1 WHERE user_id = %s;", (user_id,))

    log_audit_event(
        action="SESSIONS_REVOKED",
        entity_type="user",
        entity_id=user_id,
        actor_id=str(current_user["user_id"]),
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale=f"Admin revoked all active sessions for {user['email']}",
        ip_address=client_ip
    )

    return {"message": f"All active sessions for {user['email']} revoked successfully."}

@router.post("/admin/security/revoke-all-sessions")
def revoke_all_sessions(request: Request, current_user: Annotated[dict, Depends(get_current_user)]):
    """Global emergency session revocation: invalidates all active tokens across all users."""
    require_admin(current_user)
    client_ip = abuse_manager.get_client_ip(request)

    with get_db() as conn, conn.cursor() as cur:
        cur.execute("UPDATE user_auth SET token_version = token_version + 1;")

    log_audit_event(
        action="GLOBAL_SESSIONS_REVOKED",
        entity_type="system",
        actor_id=str(current_user["user_id"]),
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale="Administrator triggered global emergency JWT session invalidation",
        ip_address=client_ip
    )

    return {"message": "All platform sessions across all users have been revoked."}

# ==============================================================================
# 6. AM-FR-11: Abuse and Rate-Limit Controls
# ==============================================================================
@router.get("/admin/abuse-controls")
def get_abuse_controls(current_user: Annotated[dict, Depends(get_current_user)]):
    """Retrieve rate limiting rules, blocklists, allowlists, and recent abuse events."""
    require_admin(current_user)
    return {
        "rules": abuse_manager.rules,
        "blocklist": list(abuse_manager.blocklist.values()),
        "allowlist": list(abuse_manager.allowlist),
        "recent_abuse_events": abuse_manager.abuse_events[:50]
    }

@router.put("/admin/abuse-controls/rules")
def update_rate_limits(req: UpdateRateLimitsRequest, request: Request, current_user: Annotated[dict, Depends(get_current_user)]):
    """Configure rate limiting thresholds safely."""
    require_admin(current_user)
    client_ip = abuse_manager.get_client_ip(request)

    before = dict(abuse_manager.rules)
    for k, v in req.rules.items():
        if k in abuse_manager.rules and v > 0:
            abuse_manager.rules[k] = v

    log_audit_event(
        action="RATE_LIMITS_UPDATED",
        entity_type="system_config",
        actor_id=str(current_user["user_id"]),
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale="Admin updated abuse rate-limiting thresholds",
        before_state={"rules": before},
        after_state={"rules": abuse_manager.rules},
        ip_address=client_ip
    )

    return {"message": "Rate limit rules updated successfully.", "rules": abuse_manager.rules}

@router.post("/admin/abuse-controls/blocklist")
def add_to_blocklist(req: BlocklistRequest, request: Request, current_user: Annotated[dict, Depends(get_current_user)]):
    """Add an IP address to the abuse blocklist."""
    require_admin(current_user)
    client_ip = abuse_manager.get_client_ip(request)

    abuse_manager.block_ip(req.ip.strip(), req.reason.strip(), req.duration_minutes)

    log_audit_event(
        action="IP_BLOCKED",
        entity_type="ip_address",
        actor_id=str(current_user["user_id"]),
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale=f"Blocked IP {req.ip}: {req.reason}",
        after_state={"ip": req.ip, "reason": req.reason, "duration_minutes": req.duration_minutes},
        ip_address=client_ip
    )

    return {"message": f"IP {req.ip} has been added to the blocklist."}

@router.delete("/admin/abuse-controls/blocklist/{ip}")
def remove_from_blocklist(ip: str, request: Request, current_user: Annotated[dict, Depends(get_current_user)]):
    """Lift an IP block after administrative review."""
    require_admin(current_user)
    client_ip = abuse_manager.get_client_ip(request)

    ok = abuse_manager.unblock_ip(ip)
    if not ok:
        raise HTTPException(status_code=404, detail="IP address not found in active blocklist.")

    log_audit_event(
        action="IP_UNBLOCKED",
        entity_type="ip_address",
        actor_id=str(current_user["user_id"]),
        actor_role=current_user["role"],
        result="SUCCESS",
        rationale=f"Admin lifted block for IP {ip}",
        ip_address=client_ip
    )

    return {"message": f"Block for IP {ip} has been lifted."}
