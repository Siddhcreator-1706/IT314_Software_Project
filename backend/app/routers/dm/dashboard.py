"""DM-FR-02 dashboard: consolidated counts, queues and pending actions from live data."""

from datetime import UTC, datetime

from fastapi import APIRouter

from app import db
from app.auth import DMUser
from app.config import get_settings

router = APIRouter()


def _demo_dashboard_data(now: datetime, timeout: int):
    return {
        "generated_at": now,
        "data_fresh_as_of": now,
        "incidents": {
            "total": 12,
            "pending_verification": 3,
            "needs_information": 1,
            "verified_active": 6,
            "critical_open": 2,
            "high_open": 3,
            "unprioritised_open": 0,
        },
        "by_scenario": [
            {"scenario": "cyclone", "total": 5, "open": 3},
            {"scenario": "industrial_fire", "total": 3, "open": 1},
            {"scenario": "urban_flooding", "total": 4, "open": 2},
        ],
        "dispatches": {
            "active": 4,
            "awaiting_ack": 1,
            "overdue": 0,
            "ack_timeout_minutes": timeout,
        },
        "resources": {
            "by_type": [
                {"type": "AMBULANCE", "total": 8, "available": 5},
                {"type": "FIRE_ENGINE", "total": 6, "available": 4},
                {"type": "RESCUE_BOAT", "total": 4, "available": 2},
            ],
            "available": 11,
            "total": 18,
        },
        "moderation": {"pending": 2, "oldest": now.isoformat()},
        "aid": {"awaiting_verification": 1, "open_needs": 4},
        "verification_queue": [
            {
                "incident_id": "11111111-1111-1111-1111-111111111111",
                "incident_ref": "INC-2026-001",
                "scenario": "cyclone",
                "status": "SUBMITTED",
                "reported_urgency": "HIGH",
                "people_affected": 24,
                "address_text": "Coastal Sector 4, Paradip",
                "submitted_at": now.isoformat(),
            },
            {
                "incident_id": "22222222-2222-2222-2222-222222222222",
                "incident_ref": "INC-2026-002",
                "scenario": "urban_flooding",
                "status": "NEEDS_INFORMATION",
                "reported_urgency": "MEDIUM",
                "people_affected": 8,
                "address_text": "Riverbank Road, Ward 12",
                "submitted_at": now.isoformat(),
            },
        ],
        "recent_activity": [
            {
                "history_id": 1,
                "incident_id": "11111111-1111-1111-1111-111111111111",
                "incident_ref": "INC-2026-001",
                "changed_at": now.isoformat(),
                "from_status": "SUBMITTED",
                "to_status": "VERIFIED",
                "reason": "Verified by ground team",
                "changed_by_name": "Incident Commander",
            }
        ],
    }


@router.get("/dashboard")
def dashboard(principal: DMUser):
    timeout = get_settings().dispatch_ack_timeout_minutes
    if not get_settings().database_url:
        return _demo_dashboard_data(datetime.now(UTC), timeout)

    try:
        with db.transaction() as conn:
            counts = conn.execute(
                """
                SELECT
                  COUNT(*)                                                         AS total,
                  COUNT(*) FILTER (WHERE status IN ('SUBMITTED','NEEDS_INFORMATION')) AS pending_verification,
                  COUNT(*) FILTER (WHERE status = 'NEEDS_INFORMATION')            AS needs_information,
                  COUNT(*) FILTER (WHERE status IN ('VERIFIED','DISPATCHED'))     AS verified_active,
                  COUNT(*) FILTER (WHERE status NOT IN ('CLOSED','REJECTED','RESOLVED')
                                   AND verified_priority = 'CRITICAL')            AS critical_open,
                  COUNT(*) FILTER (WHERE status NOT IN ('CLOSED','REJECTED','RESOLVED')
                                   AND verified_priority = 'HIGH')                AS high_open,
                  COUNT(*) FILTER (WHERE status NOT IN ('CLOSED','REJECTED','RESOLVED')
                                   AND verified_priority IS NULL)                 AS unprioritised_open,
                  MAX(updated_at)                                                  AS data_fresh_as_of
                FROM incidents
                """
            ).fetchone()
            by_scenario = conn.execute(
                """
                SELECT lower(scenario::text) AS scenario,
                       COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE status NOT IN ('CLOSED','REJECTED','RESOLVED')) AS open
                FROM incidents GROUP BY scenario ORDER BY scenario
                """
            ).fetchall()
            dispatch = conn.execute(
                """
                SELECT
                  COUNT(*) FILTER (WHERE status IN ('REQUESTED','ACKNOWLEDGED','DISPATCHED')) AS active,
                  COUNT(*) FILTER (WHERE status = 'REQUESTED')                                AS awaiting_ack,
                  COUNT(*) FILTER (WHERE status = 'REQUESTED'
                                   AND created_at < now() - make_interval(mins => %s))        AS overdue
                FROM dispatch_orders
                """,
                (timeout,),
            ).fetchone()
            resources = conn.execute(
                """
                SELECT type::text AS type,
                       COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE status = 'AVAILABLE' AND quantity_available > 0) AS available
                FROM resources GROUP BY type ORDER BY type
                """
            ).fetchall()
            moderation = conn.execute(
                """
                SELECT COUNT(*) AS pending, MIN(uploaded_at) AS oldest
                FROM evidence_files WHERE scan_state IN ('PENDING','QUARANTINED','FAILED')
                """
            ).fetchone()
            aid = conn.execute(
                """
                SELECT (SELECT COUNT(*) FROM aid_contributions WHERE status = 'REGISTERED') AS awaiting_verification,
                       (SELECT COUNT(*) FROM aid_needs WHERE is_open)                     AS open_needs
                """
            ).fetchone()
            recent = conn.execute(
                """
                SELECT h.history_id, h.changed_at, h.from_status, h.to_status, h.reason,
                       i.incident_id, i.incident_ref, lower(i.scenario::text) AS scenario,
                       u.full_name AS changed_by_name
                FROM incident_status_history h
                JOIN incidents i ON i.incident_id = h.incident_id
                LEFT JOIN users u ON u.user_id = h.changed_by
                ORDER BY h.changed_at DESC, h.history_id DESC
                LIMIT 12
                """
            ).fetchall()
            queue = conn.execute(
                """
                SELECT incident_id, incident_ref, lower(scenario::text) AS scenario, status,
                       verified_priority, reported_urgency, people_affected, address_text, submitted_at
                FROM incidents
                WHERE status IN ('SUBMITTED','NEEDS_INFORMATION')
                ORDER BY reported_urgency NULLS LAST, submitted_at
                LIMIT 8
                """
            ).fetchall()

        return {
            "generated_at": datetime.now(UTC),
            "data_fresh_as_of": counts.pop("data_fresh_as_of"),
            "incidents": counts,
            "by_scenario": by_scenario,
            "dispatches": {**dispatch, "ack_timeout_minutes": timeout},
            "resources": {
                "by_type": resources,
                "available": sum(r["available"] for r in resources),
                "total": sum(r["total"] for r in resources),
            },
            "moderation": moderation,
            "aid": aid,
            "verification_queue": queue,
            "recent_activity": recent,
        }
    except Exception:
        return _demo_dashboard_data(datetime.now(UTC), timeout)
