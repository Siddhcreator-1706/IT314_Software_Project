"""
ResQ AI — SQLite Database Layer for Citizen Module
Provides persistent storage for citizen-submitted disaster reports
and seed data for public incidents, alerts, and shelters.

Uses Python's built-in sqlite3 (no extra dependencies required).
Designed to be compatible with the PostgreSQL schema (01_schema.sql)
while remaining self-contained for demo/evaluation purposes.
"""

import json
import os
import random
import sqlite3
from datetime import UTC, datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resq_citizen.db")


def get_connection() -> sqlite3.Connection:
    """Get a database connection with row_factory set to sqlite3.Row."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_database():
    """Create tables if they don't exist. Safe to call multiple times."""
    conn = get_connection()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS citizen_reports (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                location_name TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                affected_people_count INTEGER DEFAULT 1,
                urgent_needs TEXT DEFAULT '[]',
                reporter_name TEXT DEFAULT 'Anonymous Citizen',
                reporter_phone TEXT DEFAULT '',
                verification_status TEXT DEFAULT 'PENDING',
                linked_incident_id TEXT,
                source TEXT DEFAULT 'CITIZEN_APP',
                submitted_at TEXT NOT NULL,
                photo_urls TEXT DEFAULT '[]',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_reports_user ON citizen_reports(user_id, submitted_at DESC)"
        )
        conn.commit()
    finally:
        conn.close()


def generate_report_id() -> str:
    """Generate a unique report ID matching the existing REP-YYYY-NNNN pattern."""
    seq = random.randint(1000, 9999)
    return f"REP-2026-{seq}"


def create_report(user_id: str, data: dict) -> dict:
    """Insert a new citizen report into the database. Returns the created report."""
    conn = get_connection()
    try:
        report_id = generate_report_id()
        submitted_at = datetime.now(UTC).isoformat()

        conn.execute(
            """
            INSERT INTO citizen_reports
                (id, user_id, category, description, location_name, lat, lon,
                 affected_people_count, urgent_needs, reporter_name, reporter_phone,
                 verification_status, source, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'CITIZEN_APP', ?)
            """,
            (
                report_id,
                user_id,
                data["category"],
                data["description"],
                data["location_name"],
                data["lat"],
                data["lon"],
                data.get("affected_people_count", 1),
                json.dumps(data.get("urgent_needs", [])),
                data.get("reporter_name", "Anonymous Citizen"),
                data.get("reporter_phone", ""),
                submitted_at,
            ),
        )
        conn.commit()

        return {
            "id": report_id,
            "category": data["category"],
            "description": data["description"],
            "location_name": data["location_name"],
            "lat": data["lat"],
            "lon": data["lon"],
            "affected_people_count": data.get("affected_people_count", 1),
            "urgent_needs": data.get("urgent_needs", []),
            "verification_status": "PENDING",
            "submitted_at": submitted_at,
            "linked_incident_id": None,
            "source": "CITIZEN_APP",
        }
    finally:
        conn.close()


def get_reports_by_user(user_id: str) -> list[dict]:
    """Get all reports submitted by a specific user, ordered newest first."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, category, description, location_name, lat, lon,
                   affected_people_count, urgent_needs, verification_status,
                   submitted_at, linked_incident_id, source
            FROM citizen_reports
            WHERE user_id = ?
            ORDER BY submitted_at DESC
            """,
            (user_id,),
        ).fetchall()

        return [_row_to_report(row) for row in rows]
    finally:
        conn.close()


def get_report_by_id(report_id: str, user_id: str) -> dict | None:
    """Get a single report by ID, enforcing ownership via user_id."""
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT id, category, description, location_name, lat, lon,
                   affected_people_count, urgent_needs, verification_status,
                   submitted_at, linked_incident_id, source
            FROM citizen_reports
            WHERE id = ? AND user_id = ?
            """,
            (report_id, user_id),
        ).fetchone()

        return _row_to_report(row) if row else None
    finally:
        conn.close()


def _row_to_report(row: sqlite3.Row) -> dict:
    """Convert a database row to a report dict with parsed JSON fields."""
    d = dict(row)
    if isinstance(d.get("urgent_needs"), str):
        try:
            d["urgent_needs"] = json.loads(d["urgent_needs"])
        except (json.JSONDecodeError, TypeError):
            d["urgent_needs"] = []
    return d


# ═══════════════════════════════════════════════════════════════════
# Seed / Public Data
# Mirrors the demo data in frontend/src/services/resqStorage.ts
# to provide consistent data across frontend and backend.
# ═══════════════════════════════════════════════════════════════════

SEED_INCIDENTS = [
    {
        "id": "INC-2026-081",
        "category": "Flood / Urban Flood",
        "title": "Severe Inundation & Flash Flooding — Wayanad Hill Basin",
        "lat": 11.5542,
        "lon": 76.1264,
        "location_name": "Meppadi Ward 4, Wayanad, Kerala",
        "severity": "CRITICAL",
        "lifecycle_status": "RESPONSE IN PROGRESS",
        "detected_at": "2026-10-12T16:20:00Z",
        "affected_people_estimate": 65,
    },
    {
        "id": "INC-2026-082",
        "category": "Major Urban / Building Fire",
        "title": "Commercial Godown & Multistory Fire — Chandni Chowk",
        "lat": 28.6506,
        "lon": 77.2303,
        "location_name": "Katra Neel, Chandni Chowk, Delhi",
        "severity": "CRITICAL",
        "lifecycle_status": "DISPATCHED",
        "detected_at": "2026-10-12T17:05:00Z",
        "affected_people_estimate": 28,
    },
    {
        "id": "INC-2026-083",
        "category": "Cyclone / Coastal Flooding",
        "title": "Cyclone Impact & Coastal Sea Surge — Paradip Port",
        "lat": 20.2644,
        "lon": 86.6712,
        "location_name": "Nehru Bangla Coastal Belt, Paradip, Odisha",
        "severity": "HIGH",
        "lifecycle_status": "VERIFIED",
        "detected_at": "2026-10-12T15:10:00Z",
        "affected_people_estimate": 210,
    },
]

SEED_ALERTS = [
    {
        "id": "ALT-01",
        "type": "CRITICAL_SEVERITY",
        "severity": "CRITICAL",
        "title": "Flash Flood Alert — Wayanad Level 3",
        "description": "Rapid water level spike in Chaliyar basin. 24 rooftop rescues underway. NDRF & EMS dispatched.",
        "timestamp": "2026-10-12T16:20:00Z",
        "related_incident_id": "INC-2026-081",
    },
    {
        "id": "ALT-02",
        "type": "CRITICAL_SEVERITY",
        "severity": "CRITICAL",
        "title": "Structural Commercial Fire — Chandni Chowk",
        "description": "Multi-alarm fire at Katra Neel. Smoke plume hazard. Avoid Nai Sarak and Main Road.",
        "timestamp": "2026-10-12T17:05:00Z",
        "related_incident_id": "INC-2026-082",
    },
    {
        "id": "ALT-03",
        "type": "BLOCKED_ROAD",
        "severity": "WARNING",
        "title": "Road Inundation — Meppadi-Chooralmala Bridge",
        "description": "Bridge deck submerged by flood torrents. Emergency vehicles diverting via Vythiri bypass.",
        "timestamp": "2026-10-12T16:45:00Z",
        "related_incident_id": "INC-2026-081",
    },
    {
        "id": "ALT-05",
        "type": "PUBLIC_WARNING",
        "severity": "WARNING",
        "title": "Cyclone Warning — Odisha Coast (IMD Advisory)",
        "description": "Severe cyclonic storm expected to make landfall near Paradip by 03:00 AM. Stay indoors, stock supplies.",
        "timestamp": "2026-10-12T18:00:00Z",
        "related_incident_id": "INC-2026-083",
    },
]

SEED_SHELTERS = [
    {
        "id": "INFRA-01",
        "name": "Wayanad Government District Hospital",
        "type": "HOSPITAL",
        "lat": 11.6050,
        "lon": 76.0820,
        "address": "Mananthavady, Wayanad, Kerala",
        "total_capacity": 350,
        "current_occupancy": 280,
        "available_beds": 70,
        "contact_number": "+91 4935 240223",
        "status": "OPERATIONAL",
        "notes": "Emergency burn/trauma triage ward active. Blood bank stocked.",
    },
    {
        "id": "INFRA-02",
        "name": "Lok Nayak Jai Prakash (LNJP) Hospital",
        "type": "HOSPITAL",
        "lat": 28.6385,
        "lon": 77.2422,
        "address": "Jawaharlal Nehru Marg, Delhi Gate, Delhi",
        "total_capacity": 2000,
        "current_occupancy": 1750,
        "available_beds": 250,
        "contact_number": "+91 11 2323 3000",
        "status": "OPERATIONAL",
        "notes": "Designated burn trauma referral center for Chandni Chowk incident.",
    },
    {
        "id": "INFRA-03",
        "name": "Meppadi Higher Secondary School Relief Camp",
        "type": "SHELTER",
        "lat": 11.5580,
        "lon": 76.1310,
        "address": "School Road, Meppadi, Wayanad",
        "total_capacity": 400,
        "current_occupancy": 310,
        "available_beds": None,
        "contact_number": "+91 94470 11223",
        "status": "OPERATIONAL",
        "notes": "Has potable water, emergency kitchen, and female privacy enclosure.",
    },
    {
        "id": "INFRA-04",
        "name": "Paradip Multi-Purpose Cyclone Shelter #4",
        "type": "SHELTER",
        "lat": 20.2710,
        "lon": 86.6620,
        "address": "Near Port Township, Paradip, Odisha",
        "total_capacity": 1200,
        "current_occupancy": 680,
        "available_beds": None,
        "contact_number": "+91 6722 222105",
        "status": "OPERATIONAL",
        "notes": "Concrete reinforced, solar backup, high ground 12m above sea level.",
    },
]


def get_public_incidents() -> list[dict]:
    """Return active, verified incidents approved for public visibility."""
    return [
        inc for inc in SEED_INCIDENTS
        if inc["lifecycle_status"] not in ("CLOSED", "RESOLVED", "REJECTED")
    ]


def get_public_alerts() -> list[dict]:
    """Return safety alerts visible to the public."""
    return list(SEED_ALERTS)


def get_shelters() -> list[dict]:
    """Return shelter and hospital information."""
    return [s for s in SEED_SHELTERS if s["status"] != "HAZARD_BLOCKED"]
