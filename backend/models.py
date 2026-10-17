"""
ResQ AI — Citizen API Pydantic Models
Request validation and response serialization for citizen-facing endpoints.
Aligned with the DRCH PostgreSQL schema (db/migrations/01_schema.sql)
and the frontend TypeScript types (types/resq.ts).
"""


from pydantic import BaseModel, Field

# ── Request Models ──────────────────────────────────────────────

class CreateReportRequest(BaseModel):
    """Schema for creating a new citizen disaster report."""
    category: str = Field(
        ...,
        description="Disaster type: 'Flood / Urban Flood', 'Cyclone / Coastal Flooding', or 'Major Urban / Building Fire'",
    )
    description: str = Field(
        ..., min_length=10, max_length=2000,
        description="Detailed description of the emergency situation",
    )
    location_name: str = Field(
        ..., min_length=2, max_length=200,
        description="Name or landmark of the incident location",
    )
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    affected_people_count: int = Field(
        default=1, ge=1, le=100000,
        description="Approximate number of affected people",
    )
    urgent_needs: list[str] = Field(
        default_factory=list,
        description="List of immediate needs (e.g., Rescue Boats, Medical Evacuation)",
    )
    reporter_name: str = Field(
        default="Anonymous Citizen", max_length=100,
        description="Name of the person reporting",
    )
    reporter_phone: str = Field(
        default="", max_length=20,
        description="Contact phone number for first responders",
    )


# ── Response Models ─────────────────────────────────────────────

class ReportResponse(BaseModel):
    """Public-facing response for a citizen report (no internal/private fields)."""
    id: str
    category: str
    description: str
    location_name: str
    lat: float
    lon: float
    affected_people_count: int
    urgent_needs: list[str]
    verification_status: str
    submitted_at: str
    linked_incident_id: str | None = None
    source: str = "CITIZEN_APP"


class PublicIncidentResponse(BaseModel):
    """Publicly visible active incident for the citizen compact map."""
    id: str
    category: str
    title: str
    lat: float
    lon: float
    location_name: str
    severity: str
    lifecycle_status: str
    detected_at: str
    affected_people_estimate: int


class PublicAlertResponse(BaseModel):
    """Public safety alert visible to citizens."""
    id: str
    type: str
    severity: str
    title: str
    description: str
    timestamp: str
    related_incident_id: str | None = None


class ShelterResponse(BaseModel):
    """Shelter or hospital information for citizens."""
    id: str
    name: str
    type: str
    lat: float
    lon: float
    address: str
    total_capacity: int | None = None
    current_occupancy: int | None = None
    available_beds: int | None = None
    contact_number: str
    status: str
    notes: str | None = None
