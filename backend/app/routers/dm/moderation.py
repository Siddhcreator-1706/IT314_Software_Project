"""Evidence moderation queue (DM-FR-18, s.7.7). Requires the moderator permission.

Moderation states map onto evidence_files.scan_state:
Pending = PENDING (or FAILED scan), Approved = CLEAN, Quarantined = QUARANTINED,
Removed = REJECTED. Decision history (actor, time, reason) is in the audit log.
"""

import uuid
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app import audit, db
from app.auth import Moderator
from app.common import Rationale
from app.errors import conflict, not_found
from app.services.evidence_storage import storage_enabled

router = APIRouter()

_DECISION_STATE = {"APPROVE": "CLEAN", "QUARANTINE": "QUARANTINED", "REMOVE": "REJECTED"}
_MODERATION_LABEL = {
    "PENDING": "PENDING",
    "FAILED": "PENDING",
    "CLEAN": "APPROVED",
    "QUARANTINED": "QUARANTINED",
    "REJECTED": "REMOVED",
}


@router.get("/moderation/queue")
def moderation_queue(principal: Moderator):
    with db.transaction() as conn:
        items = conn.execute(
            """
            SELECT e.evidence_id, e.incident_id, i.incident_ref, lower(i.scenario::text) AS scenario,
                   e.file_name, e.mime_type, e.size_bytes, e.sha256, e.scan_state, e.uploaded_at,
                   EXTRACT(EPOCH FROM (now() - e.uploaded_at))::bigint AS age_seconds,
                   u.full_name AS uploaded_by_name,
                   (SELECT l.rationale FROM audit_logs l
                     WHERE l.entity_type = 'evidence' AND l.entity_id = e.evidence_id
                     ORDER BY l.audit_id DESC LIMIT 1) AS last_reason
            FROM evidence_files e
            JOIN incidents i ON i.incident_id = e.incident_id
            JOIN users u ON u.user_id = e.uploaded_by
            WHERE e.scan_state IN ('PENDING', 'QUARANTINED', 'FAILED')
            ORDER BY e.uploaded_at
            LIMIT 200
            """
        ).fetchall()
    for item in items:
        item["moderation_state"] = _MODERATION_LABEL[item["scan_state"]]
    oldest = max((i["age_seconds"] for i in items), default=0)
    return {
        "items": items,
        "backlog": {"count": len(items), "oldest_age_seconds": oldest},
        "notes": [
            "No automated scanner is connected; items stay Pending until a moderator decides.",
            (
                "Files are stored by the evidence storage service; previews are not shown in this view."
                if storage_enabled()
                else "Citizen photo upload is off because no evidence storage service is configured."
            ),
        ],
    }


class ModerationDecision(BaseModel):
    decision: Literal["APPROVE", "QUARANTINE", "REMOVE"]
    reason: str = Rationale


@router.post("/moderation/{item_id}/decision")
def moderate(
    item_id: uuid.UUID,
    body: ModerationDecision,
    principal: Moderator,
):
    with db.transaction() as conn:
        item = conn.execute(
            "SELECT * FROM evidence_files WHERE evidence_id = %s FOR UPDATE", (item_id,)
        ).fetchone()
        if item is None:
            raise not_found("Evidence")
        if item["scan_state"] == "REJECTED":
            raise conflict("ALREADY_REMOVED", "Removed evidence cannot be restored")
        target = _DECISION_STATE[body.decision]
        if item["scan_state"] == target:
            raise conflict("NO_CHANGE", f"The item is already {_MODERATION_LABEL[target].lower()}")
        conn.execute(
            "UPDATE evidence_files SET scan_state = %s WHERE evidence_id = %s", (target, item_id)
        )
        audit.record(
            conn,
            actor=principal,
            action=f"EVIDENCE_{body.decision}D" if body.decision != "REMOVE" else "EVIDENCE_REMOVED",
            entity_type="evidence",
            entity_id=item_id,
            rationale=body.reason,
            before={"moderation_state": _MODERATION_LABEL[item["scan_state"]]},
            after={"moderation_state": _MODERATION_LABEL[target], "incident_id": str(item["incident_id"])},
            ip=principal.ip,
        )
    return {"evidence_id": item_id, "moderation_state": _MODERATION_LABEL[target]}
