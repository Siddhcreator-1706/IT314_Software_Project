"""Citizen incident reporting and tracking (NU-FR-03..07).

Contract: docs/api_contracts.md sections 2.3 and 2.4.
Every query is scoped to the authenticated citizen (reporter_id); another
citizen's incident is reported as 404 so its existence is never revealed.
"""

import json
import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Header
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from psycopg import sql
from pydantic import BaseModel, Field, field_validator, model_validator

from app import audit, db
from app.auth import Citizen
from app.common import Page, Priority, Scenario, next_incident_ref, notify, page_body, scenario_db
from app.config import get_settings
from app.errors import ApiError, not_found
from app.geo import district_for, is_in_gujarat
from app.ratelimit import rate_limit

router = APIRouter(prefix="/api/v1", tags=["citizen"])

_MAX_DETAILS_BYTES = 4096
_DEMO_CITIZEN_INCIDENTS: list[dict] = []
_DEMO_INC_SEQ = 100


def _is_demo_mode() -> bool:
    import os
    settings = get_settings()
    return not settings.database_url or os.getenv("DEMO_MODE", "").lower() in ("true", "1")


class IncidentCreate(BaseModel):
    scenario: Scenario
    description: str = Field(min_length=10, max_length=2000)
    reported_urgency: Priority | None = None
    people_affected: int | None = Field(default=None, ge=0, le=1_000_000)
    location_source: Literal["GPS", "MAP_PIN", "MANUAL"] = "GPS"
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=100_000)
    address_text: str | None = Field(default=None, max_length=300)
    landmark: str | None = Field(default=None, max_length=200)
    details: dict = Field(default_factory=dict)

    @field_validator("details")
    @classmethod
    def _small_details(cls, value: dict) -> dict:
        if len(json.dumps(value, default=str)) > _MAX_DETAILS_BYTES:
            raise ValueError("details is too large")
        return value


class InformationReply(BaseModel):
    """Answer to a DM information request: text, a corrected location, or both (S2-13)."""

    message: str | None = Field(default=None, min_length=3, max_length=2000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    address_text: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def _needs_content(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be given together")
        if not (self.message and self.message.strip()) and self.latitude is None:
            raise ValueError("Provide a message or a corrected location")
        return self


# Readable timeline labels so clients never show raw status codes (S2-13).
STATUS_LABELS = {
    "SUBMITTED": "Report submitted",
    "NEEDS_INFORMATION": "More information requested",
    "VERIFIED": "Verified by the response team",
    "REJECTED": "Report not accepted",
    "DISPATCHED": "Help is on the way",
    "IN_PROGRESS": "Response in progress",
    "RESOLVED": "Incident resolved",
    "CLOSED": "Report closed",
}


def _readable(item: dict) -> dict:
    """Add a human-readable label to the incident status and every timeline entry."""
    item["status_label"] = STATUS_LABELS.get(item["status"], item["status"].replace("_", " ").capitalize())
    for entry in item.get("timeline") or []:
        code = entry.get("status", "")
        entry["label"] = STATUS_LABELS.get(code, code.replace("_", " ").capitalize())
    return item


def _created_body(row: dict) -> dict:
    return {
        "incident_id": row["incident_id"],
        "incident_ref": row["incident_ref"],
        "status": row["status"],
        "district": row["district"],
        "created_at": row["submitted_at"],
    }


@router.post("/incidents", status_code=201, dependencies=[rate_limit("report", 30, 3600)])
def create_incident(
    body: IncidentCreate,
    principal: Citizen,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key", max_length=100)] = None,
):
    global _DEMO_INC_SEQ
    if not is_in_gujarat(body.latitude, body.longitude):
        raise ApiError(422, "OUTSIDE_GUJARAT", "The reported location is outside Gujarat")
    district = district_for(body.latitude, body.longitude)
    if _is_demo_mode():
        if idempotency_key:
            for inc in _DEMO_CITIZEN_INCIDENTS:
                if inc["reporter_id"] == principal.user_id and inc.get("idempotency_key") == idempotency_key:
                    return JSONResponse(status_code=200, content=jsonable_encoder(_created_body(inc)))
        _DEMO_INC_SEQ += 1
        now_iso = datetime.now(UTC).isoformat()
        demo_id = uuid.uuid4()
        ref = f"INC-{datetime.now(UTC).year}-{_DEMO_INC_SEQ:06d}"
        demo_record = {
            "incident_id": demo_id,
            "incident_ref": ref,
            "reporter_id": principal.user_id,
            "scenario": body.scenario,
            "description": body.description.strip(),
            "reported_urgency": body.reported_urgency,
            "people_affected": body.people_affected,
            "location_source": body.location_source,
            "latitude": body.latitude,
            "longitude": body.longitude,
            "address_text": body.address_text.strip() if body.address_text else None,
            "landmark": body.landmark.strip() if body.landmark else None,
            "details": body.details,
            "idempotency_key": idempotency_key,
            "status": "SUBMITTED",
            "district": district or "Ahmedabad",
            "submitted_at": now_iso,
            "updated_at": now_iso,
            "timeline": [{"status": "SUBMITTED", "timestamp": now_iso, "message": "Report submitted"}],
        }
        _DEMO_CITIZEN_INCIDENTS.append(demo_record)
        return _created_body(demo_record)

    with db.transaction() as conn:
        if idempotency_key:
            existing = conn.execute(
                """
                SELECT incident_id, incident_ref, status, district, submitted_at
                FROM incidents WHERE reporter_id = %s AND idempotency_key = %s
                """,
                (principal.user_id, idempotency_key),
            ).fetchone()
            if existing:
                return JSONResponse(status_code=200, content=jsonable_encoder(_created_body(existing)))
        ref = next_incident_ref(conn)
        row = conn.execute(
            """
            INSERT INTO incidents
                (incident_ref, reporter_id, scenario, description, reported_urgency, people_affected,
                 location_source, latitude, longitude, accuracy_m, address_text, landmark, details,
                 idempotency_key, district, source)
            VALUES (%s, %s, %s::scenario_type, %s, %s::priority_level, %s,
                    %s::location_source, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, 'CITIZEN')
            ON CONFLICT (reporter_id, idempotency_key) DO NOTHING
            RETURNING incident_id, incident_ref, status, district, submitted_at
            """,
            (
                ref,
                principal.user_id,
                scenario_db(body.scenario),
                body.description.strip(),
                body.reported_urgency,
                body.people_affected,
                body.location_source,
                body.latitude,
                body.longitude,
                body.accuracy_m,
                body.address_text.strip() if body.address_text else None,
                body.landmark.strip() if body.landmark else None,
                json.dumps(body.details),
                idempotency_key,
                district,
            ),
        ).fetchone()
        if row is None:  # lost a race with a concurrent request using the same key
            row = conn.execute(
                """
                SELECT incident_id, incident_ref, status, district, submitted_at
                FROM incidents WHERE reporter_id = %s AND idempotency_key = %s
                """,
                (principal.user_id, idempotency_key),
            ).fetchone()
            return JSONResponse(status_code=200, content=jsonable_encoder(_created_body(row)))
        conn.execute(
            """
            INSERT INTO incident_status_history (incident_id, from_status, to_status, changed_by, reason)
            VALUES (%s, NULL, 'SUBMITTED', %s, 'Report submitted')
            """,
            (row["incident_id"], principal.user_id),
        )
        audit.record(
            conn,
            actor=principal,
            action="INCIDENT_SUBMITTED",
            entity_type="incident",
            entity_id=row["incident_id"],
            rationale=f"{row['incident_ref']} submitted by citizen",
            ip=principal.ip,
        )
        notify(
            conn,
            user_id=principal.user_id,
            event_code="INCIDENT_RECEIVED",
            title=f"Report received ({row['incident_ref']})",
            body="Your report was received and is waiting for verification by the response team.",
            related_id=row["incident_id"],
        )
        return _created_body(row)


_MY_COLUMNS = """
    i.incident_id, i.incident_ref, lower(i.scenario::text) AS scenario, i.status, i.district,
    i.description, i.address_text, i.landmark, i.people_affected, i.submitted_at, i.updated_at,
    i.latitude::float AS latitude, i.longitude::float AS longitude,
    COALESCE((
        SELECT jsonb_agg(
                   jsonb_build_object(
                       'status', h.to_status,
                       'timestamp', h.changed_at,
                       'message', CASE WHEN h.to_status IN ('NEEDS_INFORMATION', 'REJECTED') THEN h.reason END
                   ) ORDER BY h.changed_at, h.history_id)
        FROM incident_status_history h WHERE h.incident_id = i.incident_id
    ), '[]'::jsonb) AS timeline
"""


@router.get("/me/incidents")
def my_incidents(principal: Citizen, page: Page):
    if _is_demo_mode():
        mine = [
            {
                "incident_id": inc["incident_id"],
                "incident_ref": inc["incident_ref"],
                "scenario": inc["scenario"],
                "status": inc["status"],
                "district": inc["district"],
                "description": inc["description"],
                "address_text": inc["address_text"],
                "landmark": inc["landmark"],
                "people_affected": inc["people_affected"],
                "submitted_at": inc["submitted_at"],
                "updated_at": inc["updated_at"],
                "latitude": inc["latitude"],
                "longitude": inc["longitude"],
                "timeline": inc["timeline"],
            }
            for inc in _DEMO_CITIZEN_INCIDENTS
            if inc["reporter_id"] == principal.user_id
        ]
        return page_body([_readable(i) for i in mine[page.offset : page.offset + page.limit]], len(mine), page)

    with db.transaction() as conn:
        total = conn.execute(
            "SELECT COUNT(*) AS n FROM incidents WHERE reporter_id = %s", (principal.user_id,)
        ).fetchone()["n"]
        items = conn.execute(
            sql.SQL(
                "SELECT {} FROM incidents i WHERE i.reporter_id = %s "
                "ORDER BY i.submitted_at DESC LIMIT %s OFFSET %s"
            ).format(sql.SQL(_MY_COLUMNS)),
            (principal.user_id, page.limit, page.offset),
        ).fetchall()
    return page_body([_readable(i) for i in items], total, page)


def _own_incident(conn, incident_id: uuid.UUID, user_id: uuid.UUID) -> dict:
    row = conn.execute(
        sql.SQL("SELECT {} FROM incidents i WHERE i.incident_id = %s AND i.reporter_id = %s").format(
            sql.SQL(_MY_COLUMNS)
        ),
        (incident_id, user_id),
    ).fetchone()
    if row is None:
        raise not_found("Incident")
    return row


@router.get("/me/incidents/{incident_id}")
def my_incident(incident_id: uuid.UUID, principal: Citizen):
    if _is_demo_mode():
        for inc in _DEMO_CITIZEN_INCIDENTS:
            if inc["incident_id"] == incident_id and inc["reporter_id"] == principal.user_id:
                return _readable({
                    "incident_id": inc["incident_id"],
                    "incident_ref": inc["incident_ref"],
                    "scenario": inc["scenario"],
                    "status": inc["status"],
                    "district": inc["district"],
                    "description": inc["description"],
                    "address_text": inc["address_text"],
                    "landmark": inc["landmark"],
                    "people_affected": inc["people_affected"],
                    "submitted_at": inc["submitted_at"],
                    "updated_at": inc["updated_at"],
                    "latitude": inc["latitude"],
                    "longitude": inc["longitude"],
                    "timeline": inc["timeline"],
                })
        raise not_found("Incident")

    with db.transaction() as conn:
        return _readable(_own_incident(conn, incident_id, principal.user_id))


@router.post(
    "/me/incidents/{incident_id}/information-response",
    status_code=201,
    dependencies=[rate_limit("information-response", 20, 3600)],
)
@router.post(
    "/me/incidents/{incident_id}/information",  # earlier path, kept for existing clients
    status_code=201,
    dependencies=[rate_limit("information-response", 20, 3600)],
)
def reply_to_information_request(incident_id: uuid.UUID, body: InformationReply, principal: Citizen):
    """The reporter answers a DM information request (own incident, NEEDS_INFORMATION only).

    Stores the text and/or a corrected Gujarat location, returns the incident to SUBMITTED for
    the dispatcher to review again, and writes status history plus an audit entry.
    """
    if body.latitude is not None and not is_in_gujarat(body.latitude, body.longitude):
        raise ApiError(422, "OUTSIDE_GUJARAT", "The corrected location is outside Gujarat")
    with db.transaction() as conn:
        _own_incident(conn, incident_id, principal.user_id)
        row = conn.execute(
            "SELECT status FROM incidents WHERE incident_id = %s FOR UPDATE", (incident_id,)
        ).fetchone()
        if row["status"] != "NEEDS_INFORMATION":
            raise ApiError(409, "NOT_AWAITING_INFORMATION", "No information has been requested for this report")
        reason_parts = []
        if body.message and body.message.strip():
            reason_parts.append("Reporter reply: " + body.message.strip())
        if body.latitude is not None:
            district = district_for(body.latitude, body.longitude)
            conn.execute(
                """
                UPDATE incidents
                SET latitude = %s, longitude = %s,
                    geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                    district = COALESCE(%s, district),
                    address_text = COALESCE(%s, address_text),
                    location_source = 'MANUAL'
                WHERE incident_id = %s
                """,
                (
                    body.latitude, body.longitude, body.longitude, body.latitude,
                    district, body.address_text.strip() if body.address_text else None, incident_id,
                ),
            )
            reason_parts.append("Reporter corrected the location")
        conn.execute(
            """
            UPDATE incidents SET status = 'SUBMITTED', version = version + 1, updated_at = now()
            WHERE incident_id = %s
            """,
            (incident_id,),
        )
        conn.execute(
            """
            INSERT INTO incident_status_history (incident_id, from_status, to_status, changed_by, reason)
            VALUES (%s, 'NEEDS_INFORMATION', 'SUBMITTED', %s, %s)
            """,
            (incident_id, principal.user_id, "; ".join(reason_parts)),
        )
        audit.record(
            conn,
            actor=principal,
            action="INFORMATION_PROVIDED",
            entity_type="incident",
            entity_id=incident_id,
            rationale="Reporter replied to an information request",
            ip=principal.ip,
        )
    return {"incident_id": incident_id, "status": "SUBMITTED", "status_label": STATUS_LABELS["SUBMITTED"]}


@router.get("/me/notifications")
def my_notifications(principal: Citizen, page: Page):
    with db.transaction() as conn:
        total = conn.execute(
            "SELECT COUNT(*) AS n FROM notifications WHERE user_id = %s AND channel = 'IN_APP'",
            (principal.user_id,),
        ).fetchone()["n"]
        items = conn.execute(
            """
            SELECT notification_id, event_code, title, body, related_id, created_at, read_at
            FROM notifications WHERE user_id = %s AND channel = 'IN_APP'
            ORDER BY created_at DESC LIMIT %s OFFSET %s
            """,
            (principal.user_id, page.limit, page.offset),
        ).fetchall()
    return page_body(items, total, page)


@router.post("/me/notifications/{notification_id}/read", status_code=200)
def mark_notification_read(notification_id: uuid.UUID, principal: Citizen):
    with db.transaction() as conn:
        row = conn.execute(
            """
            UPDATE notifications SET read_at = COALESCE(read_at, now()), status = 'READ'
            WHERE notification_id = %s AND user_id = %s RETURNING notification_id, read_at
            """,
            (notification_id, principal.user_id),
        ).fetchone()
        if row is None:
            raise not_found("Notification")
    return row
