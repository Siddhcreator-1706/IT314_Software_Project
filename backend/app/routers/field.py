"""Field Operations REST API for frontline disaster response teams.

Provides endpoints for field team profile retrieval, active mission assignments,
operational state transitions (acknowledgement, progress, rejection, completion),
and reinforcement backup team requests with strict cross-team isolation.
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query
from psycopg import sql

from app import audit, db
from app.auth import FieldPrincipal, FieldUser
from app.config import get_settings
from app.errors import ApiError, database_unavailable, not_found
from app.geo import is_in_gujarat
from app.ratelimit import rate_limit
from app.schemas.field import (
    FieldAcknowledgementResponse,
    FieldAssignmentResponse,
    FieldCompletionRequest,
    FieldLocationRequest,
    FieldLocationResponse,
    FieldProfileResponse,
    FieldProgressRequest,
    FieldProgressResponse,
    FieldRejectionRequest,
    FieldTeamRequest,
    FieldTeamRequestItem,
    FieldTeamRequestResponse,
)
from app.services.dispatch import (
    apply_acknowledgement,
    apply_completion,
    apply_progress,
    apply_rejection,
)

logger = logging.getLogger("drch.field")

router = APIRouter(prefix="/api/v1/field", tags=["field-operations"])


def _timeout() -> int:
    return get_settings().dispatch_ack_timeout_minutes


def _get_verified_team_dispatch(
    conn, principal: FieldPrincipal, dispatch_id: uuid.UUID
) -> dict[str, Any]:
    """Validate that the dispatch exists and is strictly assigned to the responder's team.

    Security rule: Requesting another team's dispatch ID returns 404 NOT_FOUND (never 403),
    preventing cross-team information disclosure and enumeration attacks.
    """
    row = conn.execute(
        """
        SELECT d.*
        FROM dispatch_orders d
        WHERE d.dispatch_id = %(dispatch_id)s
          AND EXISTS (
              SELECT 1 FROM resource_assignments ra
              WHERE ra.dispatch_id = d.dispatch_id
                AND ra.resource_id = %(team_id)s
                AND ra.released_at IS NULL
          )
        FOR UPDATE OF d
        """,
        {"dispatch_id": dispatch_id, "team_id": principal.team_resource_id},
    ).fetchone()
    if row is None:
        raise not_found("Dispatch")
    return dict(row)


def _run_field_event(
    dispatch_id: uuid.UUID, principal: FieldPrincipal, handler
) -> Any:
    """Execute a field lifecycle action within a transaction with conflict logging."""
    error: ApiError | None = None
    res = None
    with db.transaction() as conn:
        dispatch = _get_verified_team_dispatch(conn, principal, dispatch_id)
        try:
            res = handler(conn, dispatch)
        except ApiError as exc:
            if exc.code not in ("DISPATCH_NOT_ACKNOWLEDGED", "DISPATCH_STATE_CONFLICT"):
                raise
            error = exc
    if error:
        raise error
    return res


def _record_position(conn, team_resource_id: uuid.UUID, latitude: float, longitude: float) -> datetime:
    """Move the team's marker on the live map. Deliberately does not bump the resource's version, so a
    dispatcher editing the same resource is never forced to reload by a position update."""
    row = conn.execute(
        """
        UPDATE resources
        SET current_geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, position_updated_at = now()
        WHERE resource_id = %s
        RETURNING position_updated_at
        """,
        (longitude, latitude, team_resource_id),
    ).fetchone()
    return row["position_updated_at"]


# ── Profile & Assignments ───────────────────────────────────────────────


@router.get("/me", response_model=FieldProfileResponse)
def get_field_profile(principal: FieldUser) -> FieldProfileResponse:
    """Return responder identity, team metadata, agency, and assigned capabilities."""
    if not get_settings().database_url:
        raise database_unavailable()

    with db.transaction() as conn:
        row = conn.execute(
            """
            SELECT u.user_id, u.email, u.full_name, u.phone, r.code AS role,
                   m.member_id, m.callsign, m.is_leader,
                   res.resource_id AS team_resource_id, res.name AS team_name, res.status, res.capability,
                   a.agency_id, a.name AS agency_name
            FROM users u
            JOIN roles r ON r.role_id = u.role_id
            JOIN field_team_members m ON m.user_id = u.user_id
            JOIN resources res ON res.resource_id = m.resource_id
            LEFT JOIN agencies a ON a.agency_id = res.agency_id
            WHERE u.user_id = %s
            """,
            (principal.user_id,),
        ).fetchone()

    if row is None:
        raise not_found("Field Profile")

    return FieldProfileResponse(
        user_id=row["user_id"],
        email=row["email"],
        full_name=row["full_name"],
        phone=row["phone"],
        role=row["role"],
        callsign=row["callsign"],
        is_leader=bool(row["is_leader"]),
        member_id=row["member_id"],
        team_resource_id=row["team_resource_id"],
        team_name=row["team_name"],
        agency_id=row["agency_id"],
        agency_name=row["agency_name"],
        capabilities=row["capability"] or {},
        status=row["status"],
    )


@router.get("/assignments", response_model=list[FieldAssignmentResponse])
def get_field_assignments(
    principal: FieldUser,
    active: Annotated[bool, Query(description="Filter active operational dispatches only")] = False,
) -> list[FieldAssignmentResponse]:
    """List operational dispatches assigned to the responder's team."""
    if not get_settings().database_url:
        raise database_unavailable()

    query = sql.SQL("""
    SELECT d.dispatch_id, d.dispatch_ref, d.status, d.priority,
           i.incident_id, i.incident_ref, lower(i.scenario::text) AS scenario,
           i.district, i.address_text, i.landmark,
           ST_Y(i.geom::geometry) AS latitude, ST_X(i.geom::geometry) AS longitude,
           d.instructions, d.created_at AS dispatched_at, d.acknowledged_at,
           (d.status = 'REQUESTED' AND d.created_at < now() - make_interval(mins => %(timeout)s)) AS overdue
    FROM dispatch_orders d
    JOIN incidents i ON i.incident_id = d.incident_id
    WHERE EXISTS (
        SELECT 1 FROM resource_assignments ra
        WHERE ra.dispatch_id = d.dispatch_id
          AND ra.resource_id = %(team_id)s
          AND (NOT %(active_only)s OR (ra.released_at IS NULL AND d.status IN ('REQUESTED', 'ACKNOWLEDGED', 'DISPATCHED')))
    )
    ORDER BY (d.status = 'REQUESTED') DESC, d.created_at DESC
    """)
    params: dict[str, Any] = {
        "team_id": principal.team_resource_id,
        "timeout": _timeout(),
        "active_only": active,
    }

    with db.transaction() as conn:
        rows = conn.execute(query, params).fetchall()

    return [
        FieldAssignmentResponse(
            dispatch_id=r["dispatch_id"],
            dispatch_ref=r["dispatch_ref"],
            status=r["status"],
            priority=r["priority"],
            incident_id=r["incident_id"],
            incident_ref=r["incident_ref"],
            scenario=r["scenario"],
            district=r["district"],
            address_text=r["address_text"],
            landmark=r["landmark"],
            latitude=r["latitude"],
            longitude=r["longitude"],
            instructions=r["instructions"] or "",
            dispatched_at=r["dispatched_at"],
            acknowledged_at=r["acknowledged_at"],
            overdue=bool(r["overdue"]),
        )
        for r in rows
    ]


@router.post(
    "/location",
    response_model=FieldLocationResponse,
    dependencies=[rate_limit("field-location", 240, 3600)],
)
def field_report_location(body: FieldLocationRequest, principal: FieldUser) -> FieldLocationResponse:
    """Share the team's position with dispatchers so its marker on the live map follows the team.

    Accepted only while the team has an active dispatch (409 NO_ACTIVE_DISPATCH otherwise), so a responder
    who is off duty is never tracked, and only inside Gujarat (422 OUTSIDE_GUJARAT). It moves the whole
    team's marker, not an individual's. Position updates are not audited one by one: they are frequent
    and are not a state change.
    """
    if not is_in_gujarat(body.latitude, body.longitude):
        raise ApiError(422, "OUTSIDE_GUJARAT", "The position is outside Gujarat")
    with db.transaction() as conn:
        active = conn.execute(
            """
            SELECT 1 FROM dispatch_orders d
            JOIN resource_assignments ra ON ra.dispatch_id = d.dispatch_id
            WHERE ra.resource_id = %s AND ra.released_at IS NULL
              AND d.status IN ('REQUESTED', 'ACKNOWLEDGED', 'DISPATCHED')
            LIMIT 1
            """,
            (principal.team_resource_id,),
        ).fetchone()
        if active is None:
            raise ApiError(
                409,
                "NO_ACTIVE_DISPATCH",
                "Your location is shared only while your team has an active dispatch.",
            )
        recorded_at = _record_position(conn, principal.team_resource_id, body.latitude, body.longitude)
    return FieldLocationResponse(recorded_at=recorded_at)


# ── Tactical Operations & State Transitions ─────────────────────────────


@router.post(
    "/dispatches/{dispatch_id}/acknowledgement",
    response_model=FieldAcknowledgementResponse,
)
def field_acknowledge_dispatch(
    dispatch_id: uuid.UUID,
    principal: FieldUser,
) -> FieldAcknowledgementResponse:
    """Field responder acknowledges receipt and deployment for an assignment."""
    def handler(conn, dispatch):
        note = f"Acknowledged by {principal.full_name}"
        if principal.callsign:
            note += f" [{principal.callsign}]"
        updated = apply_acknowledgement(
            conn,
            principal,
            dispatch_id,
            channel="MOBILE_APP",
            note=note,
            acknowledged_by=principal.full_name,
            dispatch=dispatch,
        )
        return FieldAcknowledgementResponse(
            status="ACKNOWLEDGED",
            dispatch_ref=updated["dispatch_ref"],
            acknowledged_at=datetime.now(UTC),
        )

    return _run_field_event(dispatch_id, principal, handler)


@router.post("/dispatches/{dispatch_id}/rejection")
def field_reject_dispatch(
    dispatch_id: uuid.UUID,
    body: FieldRejectionRequest,
    principal: FieldUser,
) -> dict[str, Any]:
    """Field responder refuses assignment with mandatory operational reason."""
    def handler(conn, dispatch):
        updated = apply_rejection(
            conn,
            principal,
            dispatch_id,
            reason=body.reason,
            reported_by=principal.full_name,
            channel="MOBILE_APP",
            dispatch=dispatch,
        )
        return {
            "status": "REJECTED",
            "dispatch_ref": updated["dispatch_ref"],
            "updated_at": datetime.now(UTC),
        }

    return _run_field_event(dispatch_id, principal, handler)


@router.post(
    "/dispatches/{dispatch_id}/progress",
    response_model=FieldProgressResponse,
)
def field_report_progress(
    dispatch_id: uuid.UUID,
    body: FieldProgressRequest,
    principal: FieldUser,
) -> FieldProgressResponse:
    """Field responder reports operational progress milestone (EN_ROUTE, ON_SCENE, UPDATE, DELAYED)."""
    def handler(conn, dispatch):
        updated = apply_progress(
            conn,
            principal,
            dispatch_id,
            event=body.status,
            note=body.note,
            reported_by=principal.full_name,
            channel="MOBILE_APP",
            latitude=body.latitude,
            longitude=body.longitude,
            dispatch=dispatch,
        )
        # A progress report that carries coordinates also moves the team's marker. A position outside
        # Gujarat is ignored here rather than failing the report itself.
        if body.latitude is not None and body.longitude is not None and is_in_gujarat(body.latitude, body.longitude):
            _record_position(conn, principal.team_resource_id, body.latitude, body.longitude)
        return FieldProgressResponse(
            progress_id=updated.get("progress_id") or uuid.uuid4(),
            dispatch_id=dispatch_id,
            status=body.status,
            note=body.note,
            recorded_at=datetime.now(UTC),
        )

    return _run_field_event(dispatch_id, principal, handler)


@router.get("/team-requests", response_model=list[FieldTeamRequestItem])
def list_my_team_requests(
    principal: FieldUser,
    status: Annotated[
        Literal["OPEN", "APPROVED", "DECLINED", "ALL"], Query(description="Only requests in this state")
    ] = "ALL",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[FieldTeamRequestItem]:
    """Backup requests on the responder's team's dispatches, with the dispatcher's decision once made.

    Open requests come first, then newest first. Requests are visible to the whole team, not only the
    member who filed them. A team never sees another team's requests: they are matched through the
    dispatches the team is assigned to.
    """
    if not get_settings().database_url:
        raise database_unavailable()

    with db.transaction() as conn:
        rows = conn.execute(
            """
            SELECT tr.request_id, tr.dispatch_id, d.dispatch_ref, tr.required_capability, tr.note, tr.status,
                   tr.decision_rationale, tr.decided_at, tr.created_at
            FROM team_requests tr
            JOIN dispatch_orders d ON d.dispatch_id = tr.dispatch_id
            WHERE EXISTS (
                SELECT 1 FROM resource_assignments ra
                WHERE ra.dispatch_id = d.dispatch_id AND ra.resource_id = %(team_id)s
            )
              AND (%(status)s = 'ALL' OR tr.status = %(status)s)
            ORDER BY (tr.status = 'OPEN') DESC, tr.created_at DESC
            LIMIT %(limit)s
            """,
            {"team_id": principal.team_resource_id, "status": status, "limit": limit},
        ).fetchall()
    return [FieldTeamRequestItem(**r) for r in rows]


@router.post(
    "/dispatches/{dispatch_id}/team-requests",
    response_model=FieldTeamRequestResponse,
    status_code=201,
    dependencies=[rate_limit("field-backup", 20, 3600)],
)
def field_request_team(
    dispatch_id: uuid.UUID,
    body: FieldTeamRequest,
    principal: FieldUser,
) -> FieldTeamRequestResponse:
    """Field responder requests specialized reinforcement or backup units.

    A team cannot have two open requests for the same capability on one dispatch (409
    DUPLICATE_OPEN_REQUEST); once a dispatcher has decided, a new request is allowed.
    """
    with db.transaction() as conn:
        dispatch = _get_verified_team_dispatch(conn, principal, dispatch_id)  # also locks the dispatch row
        if conn.execute(
            "SELECT 1 FROM team_requests WHERE dispatch_id = %s AND lower(required_capability) = lower(%s) AND status = 'OPEN'",
            (dispatch_id, body.required_capability.strip()),
        ).fetchone():
            raise ApiError(
                409,
                "DUPLICATE_OPEN_REQUEST",
                "Your team already has an open request for this capability on this dispatch. Wait for the dispatcher's decision.",
            )

        row = conn.execute(
            """
            INSERT INTO team_requests (dispatch_id, requested_by, required_capability, note, status)
            VALUES (%s, %s, %s, %s, 'OPEN')
            RETURNING request_id, created_at
            """,
            (
                dispatch_id,
                principal.user_id,
                body.required_capability.strip(),
                body.note,
            ),
        ).fetchone()

        audit.record(
            conn,
            actor=principal,
            action="TEAM_BACKUP_REQUESTED",
            entity_type="dispatch_order",
            entity_id=dispatch_id,
            rationale=f"Requested {body.required_capability}: {body.note or 'No notes'}",
            after={
                "required_capability": body.required_capability,
                "team_name": principal.team_name,
            },
            ip=principal.ip,
        )

        # Notify every active dispatcher in one statement. This used to insert one notification per dispatcher
        # in a loop, which cost two database round trips each and held the dispatch row locked for the whole
        # fan-out. Staff accounts never receive the email copy notify() can add, so the rows are identical.
        conn.execute(
            """
            INSERT INTO notifications (user_id, event_code, channel, title, body, related_id, status)
            SELECT DISTINCT p.user_id, 'TEAM_BACKUP_REQUESTED', 'IN_APP'::notif_channel, %s, %s, %s, 'QUEUED'::notif_status
            FROM staff_permissions p
            JOIN users u ON u.user_id = p.user_id
            WHERE p.permission = 'DISPATCH' AND u.status = 'ACTIVE'
            """,
            (
                f"Backup requested for {dispatch['dispatch_ref']}"[:200],
                f"Team {principal.team_name} requests capability '{body.required_capability}'.",
                dispatch_id,
            ),
        )

        return FieldTeamRequestResponse(
            request_id=row["request_id"],
            dispatch_id=dispatch_id,
            required_capability=body.required_capability,
            note=body.note,
            status="OPEN",
            created_at=row["created_at"],
        )


@router.post("/dispatches/{dispatch_id}/completion")
def field_complete_dispatch(
    dispatch_id: uuid.UUID,
    body: FieldCompletionRequest,
    principal: FieldUser,
) -> dict[str, Any]:
    """Field responder submits final mission summary and completes the tactical assignment."""
    def handler(conn, dispatch):
        updated = apply_completion(
            conn,
            principal,
            dispatch_id,
            summary=body.summary,
            confirmed_by=principal.full_name,
            channel="MOBILE_APP",
            civilians_evacuated=body.civilians_evacuated,
            civilians_treated=body.civilians_treated,
            dispatch=dispatch,
        )
        return {
            "status": "COMPLETED",
            "dispatch_ref": updated["dispatch_ref"],
            "civilians_evacuated": body.civilians_evacuated,
            "civilians_treated": body.civilians_treated,
            "updated_at": datetime.now(UTC),
        }

    return _run_field_event(dispatch_id, principal, handler)
