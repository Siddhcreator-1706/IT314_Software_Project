import logging
from typing import Any

import psycopg2
from psycopg2.extras import Json

from db_conn import get_db

logger = logging.getLogger("drch.audit")

SENSITIVE_KEYS = {
    "password", "password_hash", "mfa_secret", "secret", "token",
    "jwt_secret", "access_token", "refresh_token", "authorization"
}

def sanitize_state(state: Any) -> Any:
    """Recursively redact sensitive credentials/tokens from audit states."""
    if not isinstance(state, dict):
        return state
    sanitized = {}
    for k, v in state.items():
        if k.lower() in SENSITIVE_KEYS:
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_state(v)
        elif isinstance(v, list):
            sanitized[k] = [sanitize_state(item) if isinstance(item, dict) else item for item in v]
        else:
            sanitized[k] = v
    return sanitized

def log_audit_event(
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    actor_id: str | None = None,
    actor_role: str | None = None,
    result: str = "SUCCESS",
    rationale: str | None = None,
    before_state: dict | None = None,
    after_state: dict | None = None,
    ip_address: str | None = None,
    conn: psycopg2.extensions.connection | None = None,
) -> int:
    """
    Append an immutable, tamper-evident audit record to audit_logs.
    Cryptographic hash chaining is handled by PostgreSQL trigger trg_audit_hash_chain.
    """
    clean_before = Json(sanitize_state(before_state)) if before_state is not None else None
    clean_after = Json(sanitize_state(after_state)) if after_state is not None else None

    # Fallback to local loopback if invalid IP string
    clean_ip = None
    if ip_address and ip_address != "testclient":
        try:
            import ipaddress
            ipaddress.ip_address(ip_address)
            clean_ip = ip_address
        except ValueError:
            clean_ip = "127.0.0.1"

    sql = """
        INSERT INTO audit_logs (
            action, entity_type, entity_id, actor_id, actor_role,
            result, rationale, before_state, after_state, ip_address
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING audit_id;
    """
    params = (
        action, entity_type, entity_id, actor_id, actor_role,
        result, rationale, clean_before, clean_after, clean_ip
    )

    if conn is not None:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return row[0] if row else 0
    else:
        with get_db() as local_conn, local_conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return row[0] if row else 0
