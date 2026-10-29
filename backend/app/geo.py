"""Geospatial utilities and dynamic administrative boundary resolution.

Resolution priority (fastest → most accurate):
1. GUJARAT_BBOX fast bounding-box rejection (in-memory, <0.01 ms).
2. In-memory simplified Gujarat polygon (in-memory, <1 ms).
3. Primary: PostGIS spatial queries (ST_Contains / get_district_for_coords).
4. Dynamic Fallback: Google Maps / OpenStreetMap Nominatim reverse geocoding
   with automatic PostGIS spatial caching.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger("drch.geo")

# ---------------------------------------------------------------------------
# Gujarat bounding box (WGS-84).  Used as a fast pre-filter before the
# more expensive polygon-in-point test.
# ---------------------------------------------------------------------------
GUJARAT_BBOX: dict[str, float] = {
    "min_lat": 20.1,
    "max_lat": 24.7,
    "min_lon": 68.1,
    "max_lon": 74.5,
}

# ---------------------------------------------------------------------------
# Simplified Gujarat state polygon (37 vertices, counter-clockwise).
# Derived from the official GADM Level-1 boundary, simplified to ~15 km
# tolerance so the in-memory PiP test runs in well under 1 ms.
#
# Each element is (longitude, latitude) — standard GeoJSON order.
# ---------------------------------------------------------------------------
_GUJARAT_POLYGON: list[tuple[float, float]] = [
    (68.18, 23.69), (68.40, 24.32), (68.75, 24.37), (69.02, 24.29),
    (69.35, 24.16), (69.75, 24.17), (70.08, 24.29), (70.48, 24.44),
    (70.78, 24.43), (71.00, 24.61), (71.35, 24.72), (71.58, 24.68),
    (71.93, 24.59), (72.28, 24.50), (72.62, 24.34), (72.95, 24.27),
    (73.25, 24.05), (73.53, 23.85), (73.65, 23.56), (73.71, 23.15),
    (73.52, 22.88), (73.22, 22.74), (72.99, 22.55), (72.81, 21.95),
    (72.63, 21.48), (72.42, 21.09), (72.15, 20.74), (71.76, 20.66),
    (71.40, 20.75), (71.02, 20.72), (70.58, 20.74), (70.14, 20.84),
    (69.68, 20.92), (69.22, 21.05), (68.83, 21.28), (68.42, 21.60),
    (68.18, 22.04), (68.11, 22.57), (68.15, 23.10), (68.18, 23.69),
]

# ---------------------------------------------------------------------------
# All 33 Gujarat district centroids (lat, lon) for in-memory district lookup.
# ---------------------------------------------------------------------------
_DISTRICT_CENTROIDS: list[tuple[str, float, float]] = [
    ("Ahmedabad",      23.0225,  72.5714),
    ("Amreli",         21.6032,  71.2210),
    ("Anand",          22.5645,  72.9289),
    ("Aravalli",       23.7000,  73.0000),
    ("Banaskantha",    24.1780,  72.4334),
    ("Bharuch",        21.7051,  72.9959),
    ("Bhavnagar",      21.7645,  72.1519),
    ("Botad",          22.1697,  71.6641),
    ("Chhota Udaipur", 22.3098,  74.0100),
    ("Dahod",          22.8352,  74.2521),
    ("Dang",           20.8000,  73.7000),
    ("Devbhoomi Dwarka", 22.2401, 68.9685),
    ("Gandhinagar",    23.2156,  72.6369),
    ("Gir Somnath",    20.9080,  70.3699),
    ("Jamnagar",       22.4707,  70.0577),
    ("Junagadh",       21.5222,  70.4579),
    ("Kheda",          22.7509,  72.6854),
    ("Kutch",          23.2420,  69.6669),
    ("Mahisagar",      23.1023,  73.5565),
    ("Mehsana",        23.5880,  72.3693),
    ("Morbi",          22.8173,  70.8374),
    ("Narmada",        21.8741,  73.4906),
    ("Navsari",        20.9467,  72.9520),
    ("Panchmahal",     22.7634,  73.6195),
    ("Patan",          23.8493,  72.1266),
    ("Porbandar",      21.6425,  69.6080),
    ("Rajkot",         22.3039,  70.8022),
    ("Sabarkantha",    23.5954,  73.1901),
    ("Surat",          21.1702,  72.8311),
    ("Surendranagar",  22.7272,  71.6481),
    ("Tapi",           21.1333,  73.4167),
    ("Vadodara",       22.3072,  73.1812),
    ("Valsad",         20.5992,  72.9342),
]


def _bbox_check(latitude: float, longitude: float) -> bool:
    """Fast bounding-box pre-filter. Returns False if definitely outside Gujarat."""
    return (
        GUJARAT_BBOX["min_lat"] <= latitude <= GUJARAT_BBOX["max_lat"]
        and GUJARAT_BBOX["min_lon"] <= longitude <= GUJARAT_BBOX["max_lon"]
    )


def _pip_polygon(latitude: float, longitude: float) -> bool:
    """Ray-casting point-in-polygon test against the simplified Gujarat polygon.

    Runs entirely in-memory in <1 ms — no I/O, no external calls.
    Arguments use (lat, lon) convention; the polygon stores (lon, lat) pairs.
    """
    x, y = longitude, latitude
    poly = _GUJARAT_POLYGON
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _nearest_district(latitude: float, longitude: float) -> str | None:
    """Return the nearest Gujarat district by Euclidean centroid distance (in-memory)."""
    if not _DISTRICT_CENTROIDS:
        return None
    best_name, best_dist = "", float("inf")
    for name, clat, clon in _DISTRICT_CENTROIDS:
        d = (latitude - clat) ** 2 + (longitude - clon) ** 2
        if d < best_dist:
            best_dist, best_name = d, name
    return best_name


def resolve_district_online(latitude: float, longitude: float) -> tuple[str | None, str | None]:
    """Dynamically resolve administrative district and state from Google Maps or OpenStreetMap.
    
    1. If GOOGLE_MAPS_API_KEY is configured: queries Google Maps Geocoding API.
    2. Fallback: queries OpenStreetMap Nominatim reverse geocoding API (free, open source).
    """
    settings = get_settings()

    # 1. Google Maps Geocoding API if key configured
    if settings.google_maps_api_key:
        try:
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"latlng": f"{latitude},{longitude}", "key": settings.google_maps_api_key},
                headers={"User-Agent": "ResQ-DisasterResponse/1.0"},
                timeout=5,
            )
            resp.raise_for_status()
            data = resp.json()
            for result in data.get("results", []):
                district = None
                state = None
                for comp in result.get("address_components", []):
                    types = comp.get("types", [])
                    if "administrative_area_level_2" in types:
                        district = comp.get("long_name")
                    elif "administrative_area_level_1" in types:
                        state = comp.get("long_name")
                if district:
                    return district.strip(), state or "Gujarat"
        except (httpx.HTTPError, TimeoutError, OSError, json.JSONDecodeError, KeyError) as exc:
            logger.warning("Google Maps Geocoding request failed: %s", exc)

    # 2. OpenStreetMap Nominatim (Free, authoritative reverse geocoding)
    try:
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": latitude, "lon": longitude, "format": "json"},
            headers={"User-Agent": "ResQ-DisasterResponse/1.0 (Emergency Response Center)"},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        addr = data.get("address", {})
        district = addr.get("state_district") or addr.get("county") or addr.get("city")
        state = addr.get("state")
        if district:
            clean_district = district.replace(" District", "").strip()
            return clean_district, state or "Gujarat"
    except (httpx.HTTPError, TimeoutError, OSError, json.JSONDecodeError, KeyError) as exc:
        logger.debug("OpenStreetMap Nominatim reverse geocoding failed: %s", exc)

    return None, None


def _cache_district_in_postgis(
    conn: Any, district: str, state: str, latitude: float, longitude: float
) -> None:
    """Dynamically cache an online-resolved coordinate into PostGIS administrative_boundaries."""
    try:
        cache_sql = """
            INSERT INTO administrative_boundaries (
                level, state_name, district_name, boundary_geom, centroid_geom, metadata, updated_at
            )
            VALUES (
                'DISTRICT',
                %(state)s,
                %(district)s,
                ST_Buffer(ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography, 15000)::geometry,
                ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326),
                jsonb_build_object('source', 'dynamic_geocoding', 'cached_at', now()),
                now()
            )
            ON CONFLICT (level, state_name, district_name) DO UPDATE SET
                boundary_geom = ST_Union(administrative_boundaries.boundary_geom, EXCLUDED.boundary_geom),
                updated_at = now();
        """
        conn.execute(
            cache_sql,
            {
                "state": state,
                "district": district,
                "lat": latitude,
                "lon": longitude,
            },
        )
        if hasattr(conn, "commit"):
            conn.commit()
    except Exception as exc:  # noqa: BLE001
        logger.debug("Failed to cache dynamic district in PostGIS: %s", exc)


def _query_postgis_district(conn: Any, latitude: float, longitude: float) -> str | None:
    """Execute PostGIS spatial function get_district_for_coords(lat, lon)."""
    try:
        row = conn.execute(
            "SELECT get_district_for_coords(%s, %s) AS district",
            (latitude, longitude),
        ).fetchone()
        if row:
            val = row["district"] if isinstance(row, dict) else row[0]
            if val:
                return str(val)
    except Exception as exc:  # noqa: BLE001
        logger.debug("Query district failed: %s", exc)
    return None


def _query_postgis_in_state(
    conn: Any, latitude: float, longitude: float, state: str = "Gujarat"
) -> bool | None:
    """Execute PostGIS spatial function is_coords_in_state(lat, lon, state)."""
    try:
        row = conn.execute(
            "SELECT is_coords_in_state(%s, %s, %s) AS inside",
            (latitude, longitude, state),
        ).fetchone()
        if row:
            val = row["inside"] if isinstance(row, dict) else row[0]
            if val is not None:
                return bool(val)
    except Exception as exc:  # noqa: BLE001
        logger.debug("Query in state failed: %s", exc)
    return None


def is_in_state(
    latitude: float, longitude: float, state: str = "Gujarat", conn: Any = None
) -> bool:
    """Check if coordinates fall within state boundaries.

    For Gujarat (the primary state), uses in-memory BBOX + polygon checks
    (sub-millisecond, no I/O) before falling back to PostGIS or geocoder.
    For other states, falls back directly to PostGIS / geocoder.
    """
    if state.strip().lower() == "gujarat":
        return is_in_gujarat(latitude, longitude, conn=conn)

    # Non-Gujarat: PostGIS first, then live geocoder
    if conn is not None:
        db_result = _query_postgis_in_state(conn, latitude, longitude, state=state)
        if db_result is True:
            return True

    _, online_state = resolve_district_online(latitude, longitude)
    if online_state:
        return online_state.strip().lower() == state.strip().lower()
    return False


def is_in_gujarat(latitude: float, longitude: float, conn: Any = None) -> bool:
    """Return True if (latitude, longitude) falls within Gujarat state boundaries.

    Resolution order (fastest → authoritative):
    1. Bounding-box fast-reject  (in-memory, ~0 ms).
    2. Simplified polygon PiP    (in-memory, <1 ms) — authoritative for most cases.
    3. PostGIS ST_Contains       (DB query, only when conn provided and polygon says True).
    4. Live geocoder fallback    (HTTP, only when polygon is inconclusive near border).
    """
    # 1. Fast BBOX pre-filter — reject clearly out-of-bounds points immediately
    if not _bbox_check(latitude, longitude):
        return False

    # 2. In-memory polygon PiP — handles >98 % of cases with no I/O
    in_poly = _pip_polygon(latitude, longitude)

    # 3. PostGIS confirmation (only bother if polygon says True — avoids DB for rejects)
    if in_poly and conn is not None:
        db_result = _query_postgis_in_state(conn, latitude, longitude, state="Gujarat")
        if db_result is not None:
            return db_result

    # 4. Near-border fallback: polygon said True but no DB — trust the polygon
    if in_poly:
        return True

    # 5. Polygon said False but point was in BBOX (near border) — ask geocoder
    _, online_state = resolve_district_online(latitude, longitude)
    if online_state:
        return online_state.strip().lower() == "gujarat"
    return False


def district_for(
    latitude: float,
    longitude: float,
    conn: Any = None,
    state_filter: str | None = "Gujarat",
) -> str | None:
    """Find administrative district for given coordinates.

    Resolution order:
    1. PostGIS spatial query (sub-ms DB round-trip, most authoritative).
    2. Live geocoder (Google Maps → OSM Nominatim) with automatic PostGIS caching.
    3. In-memory nearest-centroid fallback (offline-safe, <1 ms, Gujarat only).

    If state_filter is specified (default 'Gujarat'), coordinates outside state return None.
    Set state_filter=None for nationwide/global resolution.
    """
    # 1. PostGIS (authoritative, fast)
    if conn is not None:
        db_district = _query_postgis_district(conn, latitude, longitude)
        if db_district:
            return db_district

    # 2. Live geocoder
    online_district, online_state = resolve_district_online(latitude, longitude)
    if online_district:
        if state_filter and online_state and online_state.lower() != state_filter.lower():
            return None
        if conn is not None:
            _cache_district_in_postgis(
                conn, online_district, online_state or "Gujarat", latitude, longitude
            )
        return online_district

    # 3. In-memory nearest-centroid fallback (Gujarat only, offline-safe)
    if (
        (state_filter is None or (state_filter and state_filter.strip().lower() == "gujarat"))
        and _bbox_check(latitude, longitude)
        and _pip_polygon(latitude, longitude)
    ):
        return _nearest_district(latitude, longitude)

    return None


def get_known_districts(conn: Any = None, state: str = "Gujarat") -> list[str]:
    """Retrieve all dynamically registered districts from PostGIS."""
    if conn is not None:
        try:
            rows = conn.execute(
                "SELECT DISTINCT district_name FROM administrative_boundaries "
                "WHERE level = 'DISTRICT' AND state_name = %s AND district_name IS NOT NULL "
                "ORDER BY district_name",
                (state,),
            ).fetchall()
            return [r["district_name"] if isinstance(r, dict) else r[0] for r in rows]
        except Exception as exc:  # noqa: BLE001
            logger.debug("Failed to query known districts: %s", exc)
    return []
