"""Citizen incident reporting and tracking (NU-FR-03..07).

Contract: docs/api_contracts.md sections 2.3 and 2.4.
Every query is scoped to the authenticated citizen (reporter_id); another
citizen's incident is reported as 404 so its existence is never revealed.
"""

import hashlib
import json
import logging
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Header, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from psycopg import sql
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool

from app import audit, db
from app.auth import Citizen
from app.common import Page, Priority, Scenario, next_incident_ref, notify, page_body, scenario_db
from app.errors import ApiError, not_found
from app.geo import district_for, is_in_gujarat
from app.ratelimit import rate_limit
from app.services.evidence_storage import EvidenceStorageUnavailable, get_evidence_storage, storage_enabled
from app.uploads import read_capped_body, safe_filename, sniff_image_type

logger = logging.getLogger("drch.citizen")

router = APIRouter(prefix="/api/v1", tags=["citizen"])

_MAX_DETAILS_BYTES = 4096

# Evidence upload (issue #68): photos only, small enough for mobile networks.
EVIDENCE_MAX_BYTES = 5 * 1024 * 1024
EVIDENCE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
_EVIDENCE_CLOSED_STATUSES = ("CLOSED", "REJECTED")


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
    message: str = Field(min_length=3, max_length=2000)


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
    # Required (docs/api_contracts.md s.2.3): without a key, every client retry of the same
    # emergency would create another report. Same rule and error code as POST /donations.
    if not idempotency_key or not idempotency_key.strip():
        raise ApiError(422, "IDEMPOTENCY_KEY_REQUIRED", "The Idempotency-Key header is required")
    idempotency_key = idempotency_key.strip()
    if not is_in_gujarat(body.latitude, body.longitude):
        raise ApiError(422, "OUTSIDE_GUJARAT", "The reported location is outside Gujarat")
    district = district_for(body.latitude, body.longitude)
    with db.transaction() as conn:
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
                       -- Staff questions/rejections, and the reporter's own replies; never internal notes.
                       'message', CASE WHEN h.to_status IN ('NEEDS_INFORMATION', 'REJECTED')
                                         OR h.changed_by = i.reporter_id THEN h.reason END
                   ) ORDER BY h.changed_at, h.history_id)
        FROM incident_status_history h WHERE h.incident_id = i.incident_id
    ), '[]'::jsonb) AS timeline
"""


@router.get("/me/incidents")
def my_incidents(principal: Citizen, page: Page):
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
    return page_body(items, total, page)


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
    with db.transaction() as conn:
        return _own_incident(conn, incident_id, principal.user_id)


@router.post("/me/incidents/{incident_id}/information", status_code=201)
def reply_to_information_request(incident_id: uuid.UUID, body: InformationReply, principal: Citizen):
    """The reporter answers a DM information request.

    The reply is stored on the incident timeline and the report returns to SUBMITTED, so it is
    back in the dispatcher's verification queue instead of waiting on the citizen forever.
    """
    message = body.message.strip()
    if len(message) < 3:
        raise ApiError(422, "VALIDATION_FAILED", "The reply must be at least 3 characters")
    with db.transaction() as conn:
        _own_incident(conn, incident_id, principal.user_id)
        row = conn.execute(
            "SELECT status FROM incidents WHERE incident_id = %s FOR UPDATE", (incident_id,)
        ).fetchone()
        if row["status"] != "NEEDS_INFORMATION":
            raise ApiError(409, "NOT_AWAITING_INFORMATION", "No information has been requested for this report")
        conn.execute(
            """
            INSERT INTO incident_status_history (incident_id, from_status, to_status, changed_by, reason)
            VALUES (%s, 'NEEDS_INFORMATION', 'SUBMITTED', %s, %s)
            """,
            (incident_id, principal.user_id, "Reporter reply: " + message),
        )
        conn.execute(
            "UPDATE incidents SET status = 'SUBMITTED', version = version + 1 WHERE incident_id = %s",
            (incident_id,),
        )
        audit.record(
            conn,
            actor=principal,
            action="INFORMATION_PROVIDED",
            entity_type="incident",
            entity_id=incident_id,
            rationale="Reporter replied to an information request",
            before={"status": "NEEDS_INFORMATION"},
            after={"status": "SUBMITTED"},
            ip=principal.ip,
        )
    return {"incident_id": incident_id, "status": "SUBMITTED"}


# ── Evidence upload (issue #68) ─────────────────────────────────────────


@router.get("/incidents/evidence-policy")
def evidence_policy(principal: Citizen):
    """What the report form may offer: whether uploads work, and the size and type limits."""
    return {
        "enabled": storage_enabled(),
        "max_bytes": EVIDENCE_MAX_BYTES,
        "allowed_types": sorted(EVIDENCE_TYPES),
    }


def _own_open_incident_for_evidence(incident_id: uuid.UUID, user_id: uuid.UUID) -> None:
    with db.transaction() as conn:
        row = conn.execute(
            "SELECT status FROM incidents WHERE incident_id = %s AND reporter_id = %s",
            (incident_id, user_id),
        ).fetchone()
    # Another citizen's incident is "not found", never "forbidden" (no existence leak).
    if row is None:
        raise not_found("Incident")
    if row["status"] in _EVIDENCE_CLOSED_STATUSES:
        raise ApiError(409, "INCIDENT_CLOSED", "Evidence cannot be added to a closed or rejected report")


def _record_evidence(principal, incident_id, evidence_id, file_name, mime_type, size, key, digest) -> dict:
    with db.transaction() as conn:
        row = conn.execute(
            """
            INSERT INTO evidence_files
                (evidence_id, incident_id, uploaded_by, file_name, mime_type, size_bytes, storage_key, sha256)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING evidence_id, incident_id, file_name, mime_type, size_bytes, sha256, scan_state, uploaded_at
            """,
            (evidence_id, incident_id, principal.user_id, file_name, mime_type, size, key, digest),
        ).fetchone()
        audit.record(
            conn,
            actor=principal,
            action="EVIDENCE_UPLOADED",
            entity_type="evidence",
            entity_id=evidence_id,
            rationale="Photo attached by the reporter; awaiting moderation",
            after={"incident_id": str(incident_id), "sha256": digest, "size_bytes": size, "mime_type": mime_type},
            ip=principal.ip,
        )
    return row


@router.post(
    "/incidents/{incident_id}/evidence",
    status_code=201,
    dependencies=[rate_limit("evidence", 20, 3600)],
)
async def upload_evidence(incident_id: uuid.UUID, request: Request, principal: Citizen):
    """Attach a photo to the caller's own report.

    Send the image as the raw request body with Content-Type image/jpeg or image/png (max 5 MB)
    and the original name in a percent-encoded X-Filename header. The type is checked from the
    bytes, the SHA-256 is stored, and the item enters the DM moderation queue as PENDING.
    """
    if not storage_enabled():
        raise ApiError(503, "EVIDENCE_STORAGE_UNAVAILABLE", "Photo upload is not available right now")
    declared_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if declared_type not in EVIDENCE_TYPES:
        raise ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send a JPEG or PNG image as the request body")
    await run_in_threadpool(_own_open_incident_for_evidence, incident_id, principal.user_id)

    content = await read_capped_body(request, EVIDENCE_MAX_BYTES)
    mime_type = sniff_image_type(content)
    if mime_type not in EVIDENCE_TYPES:
        raise ApiError(415, "INVALID_IMAGE", "The file is not a JPEG or PNG image")

    evidence_id = uuid.uuid4()
    key = f"incidents/{incident_id}/{evidence_id}{EVIDENCE_TYPES[mime_type]}"
    digest = hashlib.sha256(content).hexdigest()
    file_name = safe_filename(request.headers.get("x-filename"))
    try:
        storage = get_evidence_storage()
        await run_in_threadpool(storage.put, key, content, mime_type)
    except (EvidenceStorageUnavailable, OSError) as exc:
        logger.exception("Evidence storage write failed")
        raise ApiError(503, "EVIDENCE_STORAGE_UNAVAILABLE", "Photo upload is not available right now") from exc

    try:
        row = await run_in_threadpool(
            _record_evidence, principal, incident_id, evidence_id, file_name, mime_type, len(content), key, digest
        )
    except Exception:
        # Never leave an orphan object that no moderator can see.
        await run_in_threadpool(storage.delete, key)
        raise
    return {**row, "moderation_state": "PENDING"}


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
