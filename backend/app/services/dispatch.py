"""Dispatch state machine, concurrency control, and automated escalation service.

Provides unified transaction-safe state transitions for both dispatcher console
and field responder operations. Guarantees row-level locking, resource allocation
safety, audit hash-chain integrity, and state conflict recording.
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app import audit, db
from app.auth import Principal
from app.common import notify
from app.config import get_settings
from app.errors import ApiError, conflict, not_found

logger = logging.getLogger("drch.dispatch")

# Constant advisory lock key ensuring only one background escalation runs at a time.
_ESCALATION_LOCK = 314_0013


def lock_dispatch(conn, dispatch_id: uuid.UUID, dispatch: dict | None = None) -> dict:
    """Acquire exclusive row lock on a dispatch order for state transition."""
    if dispatch is not None:
        return dispatch
    row = conn.execute(
        "SELECT * FROM dispatch_orders WHERE dispatch_id = %s FOR UPDATE",
        (dispatch_id,),
    ).fetchone()
    if row is None:
        raise not_found("Dispatch")
    return row


def record_dispatch_conflict(
    conn, actor: Any | None, dispatch: dict, attempted: str
) -> ApiError:
    """Record an invalid or out-of-order state transition attempt in the audit trail.

    The conflict audit record is committed to preserve a forensic timeline of late,
    stale, or out-of-order transmissions without mutating the actual operational state.
    """
    actor_ip = getattr(actor, "ip", None)
    audit.record(
        conn,
        actor=actor,
        action=f"DISPATCH_{attempted}_CONFLICT",
        entity_type="dispatch_order",
        entity_id=dispatch["dispatch_id"],
        result="FAILURE",
        rationale=f"{attempted} reported while dispatch is {dispatch['status']}",
        ip=actor_ip,
    )
    code = (
        "DISPATCH_NOT_ACKNOWLEDGED"
        if dispatch["status"] == "REQUESTED"
        else "DISPATCH_STATE_CONFLICT"
    )
    return conflict(
        code,
        f"Cannot record {attempted.lower()} while the dispatch is {dispatch['status']}",
    )


def set_dispatch_status(
    conn,
    actor: Any | None,
    dispatch: dict,
    status: str,
    action: str,
    rationale: str,
    after: dict[str, Any],
) -> None:
    """Execute status update on dispatch order and write chained audit entry."""
    conn.execute(
        "UPDATE dispatch_orders SET status = %s, updated_at = now() WHERE dispatch_id = %s",
        (status, dispatch["dispatch_id"]),
    )
    audit.record(
        conn,
        actor=actor,
        action=action,
        entity_type="dispatch_order",
        entity_id=dispatch["dispatch_id"],
        rationale=rationale,
        before={"status": dispatch["status"]},
        after={"status": status, **after},
        ip=getattr(actor, "ip", None),
    )


def record_dispatch_progress(
    conn,
    dispatch_id: uuid.UUID,
    status: str,
    note: str | None,
    recorded_by: uuid.UUID | None,
) -> uuid.UUID | None:
    """Record an operational progress update in the dispatch_progress ledger."""
    try:
        row = conn.execute(
            """
            INSERT INTO dispatch_progress (dispatch_id, status, note, recorded_by)
            VALUES (%s, %s, %s, %s)
            RETURNING progress_id
            """,
            (dispatch_id, status, note, recorded_by),
        ).fetchone()
        return row["progress_id"] if row else None
    except Exception:
        logger.exception("Failed to insert record into dispatch_progress table")
        return None


def apply_acknowledgement(
    conn,
    actor: Any | None,
    dispatch_id: uuid.UUID,
    channel: str = "OTHER",
    note: str | None = None,
    acknowledged_by: str | None = None,
    dispatch: dict | None = None,
) -> dict:
    """Transition dispatch: REQUESTED -> ACKNOWLEDGED.

    Updates acknowledgement metadata, updates pending agency messages,
    records progress entry, and logs cryptographic audit trail.
    """
    dispatch = lock_dispatch(conn, dispatch_id, dispatch=dispatch)
    if dispatch["status"] != "REQUESTED":
        raise record_dispatch_conflict(conn, actor, dispatch, "ACKNOWLEDGEMENT")

    who_raw = acknowledged_by or (
        getattr(actor, "full_name", None)
        or (str(getattr(actor, "user_id", "Unknown Responder")))
    )
    channel_clean = channel.lower().replace("_", " ")
    who = f"{who_raw.strip()} (via {channel_clean})"

    conn.execute(
        """
        UPDATE dispatch_orders
        SET acknowledged_by = %s, acknowledged_at = now(), updated_at = now()
        WHERE dispatch_id = %s
        """,
        (who, dispatch_id),
    )

    set_dispatch_status(
        conn,
        actor,
        dispatch,
        status="ACKNOWLEDGED",
        action="DISPATCH_ACKNOWLEDGED",
        rationale=note or who,
        after={"acknowledged_by": who, "channel": channel},
    )

    conn.execute(
        """
        UPDATE agency_messages SET status = 'ACKNOWLEDGED', acknowledged_at = now()
        WHERE dispatch_id = %s AND status IN ('QUEUED', 'SENT', 'DELIVERED')
        """,
        (dispatch_id,),
    )

    actor_id = getattr(actor, "user_id", None)
    record_dispatch_progress(conn, dispatch_id, "ACKNOWLEDGED", note, actor_id)

    dispatch["status"] = "ACKNOWLEDGED"
    dispatch["acknowledged_by"] = who
    dispatch["acknowledged_at"] = datetime.now(UTC)
    return dispatch


def apply_rejection(
    conn,
    actor: Any | None,
    dispatch_id: uuid.UUID,
    reason: str,
    reported_by: str | None = None,
    channel: str = "OTHER",
    dispatch: dict | None = None,
) -> dict:
    """Transition dispatch: REQUESTED / ACKNOWLEDGED -> REJECTED.

    Releases all reserved resources back to AVAILABLE and records progress.
    """
    dispatch = lock_dispatch(conn, dispatch_id, dispatch=dispatch)
    if dispatch["status"] not in ("REQUESTED", "ACKNOWLEDGED"):
        raise record_dispatch_conflict(conn, actor, dispatch, "REJECTION")

    who = reported_by or (
        getattr(actor, "full_name", None)
        or str(getattr(actor, "user_id", "Unknown"))
    )

    set_dispatch_status(
        conn,
        actor,
        dispatch,
        status="REJECTED",
        action="DISPATCH_REJECTED",
        rationale=reason,
        after={"reported_by": who, "channel": channel},
    )

    from app.services.resources import release_all_for_dispatch

    release_all_for_dispatch(conn, actor, dispatch_id, f"Dispatch rejected: {reason}")

    actor_id = getattr(actor, "user_id", None)
    record_dispatch_progress(conn, dispatch_id, "REJECTED", reason, actor_id)

    dispatch["status"] = "REJECTED"
    return dispatch


def apply_progress(
    conn,
    actor: Any | None,
    dispatch_id: uuid.UUID,
    event: str,
    note: str | None = None,
    reported_by: str | None = None,
    channel: str = "OTHER",
    latitude: float | None = None,
    longitude: float | None = None,
    dispatch: dict | None = None,
) -> dict:
    """Record an operational progress milestone (EN_ROUTE, ON_SCENE, UPDATE, DELAYED).

    On initial EN_ROUTE event from ACKNOWLEDGED status:
    - Advances dispatch to DISPATCHED.
    - Advances verified incident to DISPATCHED.
    """
    dispatch = lock_dispatch(conn, dispatch_id, dispatch=dispatch)
    if dispatch["status"] not in ("ACKNOWLEDGED", "DISPATCHED"):
        raise record_dispatch_conflict(conn, actor, dispatch, event)

    who = reported_by or (
        getattr(actor, "full_name", None)
        or str(getattr(actor, "user_id", "Unknown"))
    )
    rationale = note or event.replace("_", " ").lower()
    after: dict[str, Any] = {"event": event, "reported_by": who, "channel": channel}
    if latitude is not None and longitude is not None:
        after["latitude"] = latitude
        after["longitude"] = longitude

    actor_id = getattr(actor, "user_id", None)
    progress_id = record_dispatch_progress(conn, dispatch_id, event, note, actor_id)
    dispatch["progress_id"] = progress_id

    if event == "EN_ROUTE" and dispatch["status"] == "ACKNOWLEDGED":
        set_dispatch_status(
            conn,
            actor,
            dispatch,
            status="DISPATCHED",
            action="DISPATCH_EN_ROUTE",
            rationale=rationale,
            after=after,
        )
        dispatch["status"] = "DISPATCHED"

        from app.services.incidents import lock_incident, update_incident

        incident = lock_incident(conn, dispatch["incident_id"])
        if incident["status"] == "VERIFIED":
            update_incident(
                conn,
                actor,
                incident,
                action="INCIDENT_DISPATCHED",
                rationale=f"{dispatch['dispatch_ref']} en route",
                to_status="DISPATCHED",
            )
    else:
        audit.record(
            conn,
            actor=actor,
            action=f"DISPATCH_PROGRESS_{event}",
            entity_type="dispatch_order",
            entity_id=dispatch_id,
            rationale=rationale,
            after=after,
            ip=getattr(actor, "ip", None),
        )

    return dispatch


def apply_completion(
    conn,
    actor: Any | None,
    dispatch_id: uuid.UUID,
    summary: str,
    confirmed_by: str | None = None,
    channel: str = "OTHER",
    civilians_evacuated: int | None = None,
    civilians_treated: int | None = None,
    dispatch: dict | None = None,
) -> dict:
    """Transition dispatch: DISPATCHED -> COMPLETED.

    Releases assigned team resources back to AVAILABLE.
    The incident strictly remains OPEN for formal dispatcher resolution.
    """
    dispatch = lock_dispatch(conn, dispatch_id, dispatch=dispatch)
    if dispatch["status"] != "DISPATCHED":
        raise record_dispatch_conflict(conn, actor, dispatch, "COMPLETION")

    who = confirmed_by or (
        getattr(actor, "full_name", None)
        or str(getattr(actor, "user_id", "Unknown"))
    )
    after: dict[str, Any] = {
        "confirmed_by": who,
        "channel": channel,
        "summary": summary,
    }
    if civilians_evacuated is not None:
        after["civilians_evacuated"] = civilians_evacuated
    if civilians_treated is not None:
        after["civilians_treated"] = civilians_treated

    set_dispatch_status(
        conn,
        actor,
        dispatch,
        status="COMPLETED",
        action="DISPATCH_COMPLETED",
        rationale=summary or f"Confirmed by {who}",
        after=after,
    )

    from app.services.resources import release_all_for_dispatch

    release_all_for_dispatch(conn, actor, dispatch_id, "Dispatch completed")

    actor_id = getattr(actor, "user_id", None)
    record_dispatch_progress(conn, dispatch_id, "COMPLETED", summary, actor_id)

    # Maintain incident lifecycle: completing a unit dispatch does NOT close the incident.
    # Write audit record on incident indicating unit mission completion.
    audit.record(
        conn,
        actor=actor,
        action="DISPATCH_COMPLETED",
        entity_type="incident",
        entity_id=dispatch["incident_id"],
        rationale=f"{dispatch['dispatch_ref']} completed mission; incident remains open for dispatcher resolution",
        ip=getattr(actor, "ip", None),
    )

    dispatch["status"] = "COMPLETED"
    return dispatch


def apply_failure(
    conn,
    actor: Any | None,
    dispatch_id: uuid.UUID,
    reason: str,
    dispatch: dict | None = None,
) -> dict:
    """Transition dispatch to FAILED state and release reserved resources."""
    from app.services.resources import TERMINAL_DISPATCH, release_all_for_dispatch

    dispatch = lock_dispatch(conn, dispatch_id, dispatch=dispatch)
    if dispatch["status"] in TERMINAL_DISPATCH:
        raise record_dispatch_conflict(conn, actor, dispatch, "FAILURE")

    set_dispatch_status(
        conn,
        actor,
        dispatch,
        status="FAILED",
        action="DISPATCH_FAILED",
        rationale=reason,
        after={},
    )
    release_all_for_dispatch(conn, actor, dispatch_id, f"Dispatch failed: {reason}")

    actor_id = getattr(actor, "user_id", None)
    record_dispatch_progress(conn, dispatch_id, "FAILED", reason, actor_id)

    dispatch["status"] = "FAILED"
    return dispatch


# ── Background Automated Escalation ─────────────────────────────────────


def escalate(conn, principal: Principal | None, dispatch: dict, reason: str) -> int:
    """Record dispatch escalation and notify every active supervisor."""
    audit.record(
        conn,
        actor=principal,
        action="DISPATCH_ESCALATED",
        entity_type="dispatch_order",
        entity_id=dispatch["dispatch_id"],
        rationale=reason,
        after={"status": dispatch["status"]},
        ip=principal.ip if principal else None,
    )
    supervisors = conn.execute(
        """
        SELECT p.user_id FROM staff_permissions p
        JOIN users u ON u.user_id = p.user_id
        JOIN roles r ON r.role_id = u.role_id
        WHERE p.permission = 'SUPERVISOR' AND u.status = 'ACTIVE' AND r.code = 'DISASTER_MGMT'
        """
    ).fetchall()
    for s in supervisors:
        notify(
            conn,
            user_id=s["user_id"],
            event_code="DISPATCH_ESCALATED",
            title=f"Dispatch {dispatch['dispatch_ref']} escalated",
            body=reason,
            related_id=dispatch["dispatch_id"],
        )
    return len(supervisors)


def escalate_overdue() -> int:
    """Escalate REQUESTED dispatches past the acknowledgement timeout, once each."""
    timeout = get_settings().dispatch_ack_timeout_minutes
    with db.transaction() as conn:
        locked = conn.execute(
            "SELECT pg_try_advisory_xact_lock(%s) AS ok", (_ESCALATION_LOCK,)
        ).fetchone()
        if not locked["ok"]:
            return 0
        overdue = conn.execute(
            """
            SELECT d.* FROM dispatch_orders d
            WHERE d.status = 'REQUESTED'
              AND d.created_at < now() - make_interval(mins => %s)
              AND NOT EXISTS (
                  SELECT 1 FROM audit_logs l
                  WHERE l.entity_type = 'dispatch_order' AND l.entity_id = d.dispatch_id
                    AND l.action = 'DISPATCH_ESCALATED')
            FOR UPDATE SKIP LOCKED
            """,
            (timeout,),
        ).fetchall()
        for dispatch in overdue:
            escalate(
                conn,
                None,
                dispatch,
                f"No acknowledgement within {timeout} minutes (automatic escalation)",
            )
    if overdue:
        logger.info("Escalated %d overdue dispatch(es)", len(overdue))
    return len(overdue)
