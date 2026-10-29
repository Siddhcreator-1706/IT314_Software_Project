"""Emergency team recommendation rules and PostGIS spatial ranking engine.

Owned by: Nisarg (Sprint 1: S1-11, Sprint 2: S2-02)

Core capabilities:
1. Scenario-to-capability rules table mapping emergency types to required team competencies.
2. PostGIS spatial query calculating ST_Distance in km for AVAILABLE teams.
3. Multi-factor ranking:
   - Primary: Capability match count and coverage ratio (specialized rescue first).
   - Secondary: Great-circle / PostGIS distance in km (proximity).
4. Explanatory reasoning for dispatchers (matched capabilities, distance, availability).
5. Offline in-memory fallback using authoritative Gujarat seed teams when PostGIS is not running.
"""

from __future__ import annotations

import logging
import math
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app import db
from app.config import get_settings

logger = logging.getLogger("drch.recommendations")

# ─────────────────────────────────────────────────────────────────────────────
# 1. SCENARIO-TO-CAPABILITY RULES TABLE (S1-11 Requirement)
# Standard capability keys agreed with Siddh for Sprint 1
# ─────────────────────────────────────────────────────────────────────────────

SCENARIO_CAPABILITY_RULES: dict[str, list[str]] = {
    "URBAN_FLOODING": ["boat", "water_rescue", "flood_rescue"],
    "FLOOD": ["boat", "water_rescue", "flood_rescue"],
    "INDUSTRIAL_FIRE": ["fire", "water_tender", "hazmat"],
    "FIRE": ["fire", "water_tender", "hazmat"],
    "CYCLONE": ["search_and_rescue", "cyclone_response"],
    "EARTHQUAKE": ["search_and_rescue", "heavy_extrication", "medical"],
}

# Secondary/bonus capability tags that enhance field effectiveness
SECONDARY_CAPABILITIES: dict[str, list[str]] = {
    "URBAN_FLOODING": ["diver_squad", "inflatable_boats", "medical"],
    "INDUSTRIAL_FIRE": ["chemical_foam", "gas_leak", "smoke_extraction", "high_rise_rescue"],
    "CYCLONE": ["boat", "heavy_extrication", "water_rescue", "heavy_machinery"],
    "EARTHQUAKE": ["canine_unit", "triage_support", "critical_care"],
}


def normalize_scenario(scenario: str) -> str:
    """Normalize scenario string to uppercase standard key."""
    s = scenario.strip().upper()
    if s in ("FLOOD", "URBAN_FLOODING"):
        return "URBAN_FLOODING"
    if s in ("FIRE", "INDUSTRIAL_FIRE"):
        return "INDUSTRIAL_FIRE"
    return s


def get_required_capabilities(scenario: str) -> list[str]:
    """Retrieve list of mandatory capability keys for a given scenario."""
    norm = normalize_scenario(scenario)
    return SCENARIO_CAPABILITY_RULES.get(norm, ["search_and_rescue"])


# ─────────────────────────────────────────────────────────────────────────────
# 2. DATA MODELS
# ─────────────────────────────────────────────────────────────────────────────

class RecommendedTeam(BaseModel):
    """Ranked team recommendation with distance and match rationale."""

    resource_id: str
    name: str
    agency_id: str
    agency_name: str
    distance_km: float = Field(description="Distance in kilometers from incident")
    matched_capabilities: list[str] = Field(default_factory=list)
    secondary_matches: list[str] = Field(default_factory=list)
    capability_match_count: int = 0
    total_required: int = 0
    match_percentage: float = 0.0
    rank: int = 0
    quantity_available: int = 1
    reasons: list[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# 3. AUTHORITATIVE GUJARAT SEED TEAMS (In-Memory Fallback)
# Mirrors backend/db/seeds/seed_data.sql for offline, test, and demo resilience.
# ─────────────────────────────────────────────────────────────────────────────

_FALLBACK_TEAMS: list[dict[str, Any]] = [
    {
        "resource_id": "r0000000-0000-0000-0000-000000000001",
        "name": "NDRF 601 Urban Search & Rescue (Vadodara)",
        "agency_id": "a0000000-0000-0000-0000-000000000007",
        "agency_name": "NDRF 6th Battalion (Vadodara)",
        "latitude": 22.3072,
        "longitude": 73.1812,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "search_and_rescue": True,
            "heavy_extrication": True,
            "boat": True,
            "canine_unit": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000002",
        "name": "NDRF 602 Flood & Water Rescue Unit (Ahmedabad Sabarmati)",
        "agency_id": "a0000000-0000-0000-0000-000000000007",
        "agency_name": "NDRF 6th Battalion (Vadodara)",
        "latitude": 23.0225,
        "longitude": 72.5714,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "boat": True,
            "water_rescue": True,
            "flood_rescue": True,
            "inflatable_boats": True,
            "diver_squad": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000003",
        "name": "NDRF 603 Cyclone Coastal Rescue Unit (Jamnagar)",
        "agency_id": "a0000000-0000-0000-0000-000000000007",
        "agency_name": "NDRF 6th Battalion (Vadodara)",
        "latitude": 22.4707,
        "longitude": 70.0577,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "cyclone_response": True,
            "search_and_rescue": True,
            "boat": True,
            "water_rescue": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000004",
        "name": "AFES Fire Tender Unit 1 (Ahmedabad Navrangpura)",
        "agency_id": "a0000000-0000-0000-0000-000000000008",
        "agency_name": "Gujarat Fire and Emergency Services (Ahmedabad HQ)",
        "latitude": 23.0373,
        "longitude": 72.5613,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "fire": True,
            "water_tender": True,
            "high_rise_rescue": True,
            "smoke_extraction": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000005",
        "name": "AFES Fire Tender Unit 2 (Ahmedabad Maninagar)",
        "agency_id": "a0000000-0000-0000-0000-000000000008",
        "agency_name": "Gujarat Fire and Emergency Services (Ahmedabad HQ)",
        "latitude": 22.9784,
        "longitude": 72.6042,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "fire": True,
            "water_tender": True,
            "heavy_extrication": True,
            "smoke_extraction": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000006",
        "name": "Surat Hazira Chemical Hazard & Industrial Fire Team",
        "agency_id": "a0000000-0000-0000-0000-000000000008",
        "agency_name": "Gujarat Fire and Emergency Services (Ahmedabad HQ)",
        "latitude": 21.1025,
        "longitude": 72.6841,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "hazmat": True,
            "chemical_foam": True,
            "gas_leak": True,
            "industrial_fire": True,
            "fire": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000007",
        "name": "Rajkot Fire & Rescue Quick Reaction Unit",
        "agency_id": "a0000000-0000-0000-0000-000000000008",
        "agency_name": "Gujarat Fire and Emergency Services (Ahmedabad HQ)",
        "latitude": 22.3039,
        "longitude": 70.8022,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "fire": True,
            "water_tender": True,
            "high_rise_rescue": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000008",
        "name": "108 ALS Disaster Ambulance Alpha (Ahmedabad Civil)",
        "agency_id": "a0000000-0000-0000-0000-000000000010",
        "agency_name": "EMRI Green Health Services Gujarat (108 Ambulance)",
        "latitude": 23.0525,
        "longitude": 72.6042,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "medical": True,
            "ambulance": True,
            "critical_care": True,
            "triage_support": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000009",
        "name": "108 ALS Disaster Ambulance Beta (Surat New Civil)",
        "agency_id": "a0000000-0000-0000-0000-000000000010",
        "agency_name": "EMRI Green Health Services Gujarat (108 Ambulance)",
        "latitude": 21.1702,
        "longitude": 72.8311,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "medical": True,
            "ambulance": True,
            "emergency_stabilization": True,
            "triage_support": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000010",
        "name": "108 Mobile Triage Unit Gamma (Vadodara SSG)",
        "agency_id": "a0000000-0000-0000-0000-000000000010",
        "agency_name": "EMRI Green Health Services Gujarat (108 Ambulance)",
        "latitude": 22.3072,
        "longitude": 73.1812,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "medical": True,
            "ambulance": True,
            "triage_support": True,
            "critical_care": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000011",
        "name": "SDRF Flood Quick Response Team (Rajkot Aji River)",
        "agency_id": "a0000000-0000-0000-0000-000000000011",
        "agency_name": "SDRF Gujarat Command (State Disaster Response Force)",
        "latitude": 22.3039,
        "longitude": 70.8022,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "boat": True,
            "flood_rescue": True,
            "diver_squad": True,
            "water_rescue": True,
            "inflatable_boats": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000012",
        "name": "SDRF Cyclone & Hazmat Response Unit (Bhuj, Kutch)",
        "agency_id": "a0000000-0000-0000-0000-000000000011",
        "agency_name": "SDRF Gujarat Command (State Disaster Response Force)",
        "latitude": 23.2420,
        "longitude": 69.6669,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "cyclone_response": True,
            "search_and_rescue": True,
            "heavy_extrication": True,
            "canine_unit": True,
            "heavy_machinery": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000013",
        "name": "SDRF River Rescue & Dive Squad (Gandhinagar)",
        "agency_id": "a0000000-0000-0000-0000-000000000011",
        "agency_name": "SDRF Gujarat Command (State Disaster Response Force)",
        "latitude": 23.2156,
        "longitude": 72.6369,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "boat": True,
            "water_rescue": True,
            "flood_rescue": True,
            "diver_squad": True,
        },
    },
    {
        "resource_id": "r0000000-0000-0000-0000-000000000014",
        "name": "SDRF Urban SAR & Medical Support (Surat)",
        "agency_id": "a0000000-0000-0000-0000-000000000011",
        "agency_name": "SDRF Gujarat Command (State Disaster Response Force)",
        "latitude": 21.2000,
        "longitude": 72.8500,
        "status": "AVAILABLE",
        "quantity_available": 1,
        "capability_tags": {
            "search_and_rescue": True,
            "heavy_extrication": True,
            "medical": True,
            "triage_support": True,
        },
    },
]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two coordinates in kilometers."""
    r = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


# ─────────────────────────────────────────────────────────────────────────────
# 4. SCORING & RANKING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def score_and_rank_teams(
    raw_teams: list[dict[str, Any]],
    latitude: float,
    longitude: float,
    scenario: str,
    limit: int = 5,
) -> list[RecommendedTeam]:
    """
    Score and rank available teams based on:
    1. Mandatory capability coverage (higher match count ranks higher).
    2. Secondary capability bonus.
    3. Spatial distance in kilometers (closer teams rank higher).
    """
    norm_scenario = normalize_scenario(scenario)
    required = get_required_capabilities(norm_scenario)
    secondary = SECONDARY_CAPABILITIES.get(norm_scenario, [])

    scored: list[dict[str, Any]] = []

    for t in raw_teams:
        # Strictly exclude unavailable teams or depleted reserves
        if t.get("status") != "AVAILABLE" or (t.get("quantity_available") or 0) <= 0:
            continue

        tags = t.get("capability_tags") or {}
        if isinstance(tags, str):
            import json
            try:
                tags = json.loads(tags)
            except Exception:
                tags = {}

        # 1. Match mandatory capabilities
        matched_req = [cap for cap in required if tags.get(cap) is True]
        matched_sec = [cap for cap in secondary if tags.get(cap) is True]

        match_count = len(matched_req)
        match_pct = round((match_count / len(required)) * 100.0, 1) if required else 0.0

        # Distance
        dist_km = t.get("distance_km")
        if dist_km is None:
            dist_km = haversine_km(latitude, longitude, t["latitude"], t["longitude"])
        dist_km = round(float(dist_km), 2)

        # Build human-readable explanations
        reasons: list[str] = []
        if match_count == len(required):
            reasons.append(f"Full capability match: {', '.join(matched_req)}")
        elif match_count > 0:
            reasons.append(f"Partial capability match ({match_count}/{len(required)}): {', '.join(matched_req)}")
        else:
            reasons.append("Proximity reserve team (no specific capability match)")

        if matched_sec:
            reasons.append(f"Specialized equipment bonus: {', '.join(matched_sec)}")

        reasons.append(f"Distance to scene: {dist_km:.1f} km")
        reasons.append(f"Status: AVAILABLE ({t.get('quantity_available', 1)} unit ready)")

        # Composite multi-factor score:
        # 1. Base bonus for having at least one critical capability match (+100)
        # 2. Mandatory capability matches (+35 per match)
        # 3. Specialized secondary equipment (+5 per match)
        # 4. Spatial distance penalty (-0.15 per km, so 100 km = -15 pts)
        base_match_bonus = 100.0 if match_count > 0 else 0.0
        composite_score = (
            base_match_bonus
            + (match_count * 35.0)
            + (len(matched_sec) * 5.0)
            - (dist_km * 0.15)
        )

        scored.append({
            "resource_id": str(t["resource_id"]),
            "name": t["name"],
            "agency_id": str(t["agency_id"]),
            "agency_name": t["agency_name"],
            "distance_km": dist_km,
            "matched_capabilities": matched_req,
            "secondary_matches": matched_sec,
            "capability_match_count": match_count,
            "total_required": len(required),
            "match_percentage": match_pct,
            "quantity_available": int(t.get("quantity_available", 1)),
            "reasons": reasons,
            "composite_score": composite_score,
        })

    # Sort descending by composite score
    scored.sort(key=lambda x: x["composite_score"], reverse=True)

    results: list[RecommendedTeam] = []
    for rank_idx, item in enumerate(scored[:limit], start=1):
        results.append(
            RecommendedTeam(
                resource_id=item["resource_id"],
                name=item["name"],
                agency_id=item["agency_id"],
                agency_name=item["agency_name"],
                distance_km=item["distance_km"],
                matched_capabilities=item["matched_capabilities"],
                secondary_matches=item["secondary_matches"],
                capability_match_count=item["capability_match_count"],
                total_required=item["total_required"],
                match_percentage=item["match_percentage"],
                rank=rank_idx,
                quantity_available=item["quantity_available"],
                reasons=item["reasons"],
            )
        )

    return results


# ─────────────────────────────────────────────────────────────────────────────
# 5. POSTGIS SPATIAL QUERY (Production Implementation)
# ─────────────────────────────────────────────────────────────────────────────

_POSTGIS_RECOMMEND_SQL = """
SELECT r.resource_id,
       r.name,
       r.agency_id,
       a.name AS agency_name,
       r.status,
       r.quantity_available,
       r.capability_tags,
       ST_Distance(
           r.current_geom,
           ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography
       ) / 1000.0 AS distance_km
FROM resources r
JOIN agencies a ON a.agency_id = r.agency_id
WHERE r.type = 'TEAM'
  AND r.status = 'AVAILABLE'
  AND r.quantity_available > 0
ORDER BY distance_km ASC;
"""


def fetch_available_teams_postgis(
    conn: Any,
    latitude: float,
    longitude: float,
) -> list[dict[str, Any]]:
    """Execute PostGIS spatial distance query against active TEAM resources."""
    rows = conn.execute(
        _POSTGIS_RECOMMEND_SQL,
        {"lat": latitude, "lon": longitude},
    ).fetchall()

    teams: list[dict[str, Any]] = []
    for r in rows:
        teams.append({
            "resource_id": r["resource_id"],
            "name": r["name"],
            "agency_id": r["agency_id"],
            "agency_name": r["agency_name"],
            "status": r["status"],
            "quantity_available": r["quantity_available"],
            "capability_tags": r["capability_tags"],
            "distance_km": float(r["distance_km"]),
        })
    return teams


# ─────────────────────────────────────────────────────────────────────────────
# 6. UNIFIED ENTRYPOINT
# ─────────────────────────────────────────────────────────────────────────────

def get_recommended_teams(
    latitude: float,
    longitude: float,
    scenario: str,
    limit: int = 5,
    conn: Any = None,
) -> list[RecommendedTeam]:
    """
    Recommend and rank response teams for a verified emergency incident.

    - Uses PostGIS ST_Distance if database connection is available.
    - Falls back to in-memory haversine calculation if offline / demo mode.
    - Ranks by capability match count (primary) and proximity in km (secondary).
    """
    settings = get_settings()

    # Try PostGIS query if database is configured
    if conn is not None:
        try:
            db_teams = fetch_available_teams_postgis(conn, latitude, longitude)
            if db_teams:
                return score_and_rank_teams(db_teams, latitude, longitude, scenario, limit=limit)
        except Exception:
            logger.exception("PostGIS team query failed; falling back to in-memory seed teams")
    elif settings.database_url:
        try:
            with db.transaction() as auto_conn:
                db_teams = fetch_available_teams_postgis(auto_conn, latitude, longitude)
                if db_teams:
                    return score_and_rank_teams(db_teams, latitude, longitude, scenario, limit=limit)
        except Exception:
            logger.exception("Database pool query failed; falling back to in-memory seed teams")

    # In-memory authoritative seed fallback
    return score_and_rank_teams(_FALLBACK_TEAMS, latitude, longitude, scenario, limit=limit)
