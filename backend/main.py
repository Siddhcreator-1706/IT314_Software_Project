import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.config import get_settings
from app.errors import install_error_handlers
from app.routers import auth
from app.routers.dm import router as dm_router
from app.services.dispatch import escalate_overdue
from database import (
    create_report,
    get_public_alerts,
    get_public_incidents,
    get_report_by_id,
    get_reports_by_user,
    get_shelters,
    init_database,
)
from models import (
    CreateReportRequest,
    PublicAlertResponse,
    PublicIncidentResponse,
    ReportResponse,
    ShelterResponse,
)

logger = logging.getLogger("drch.backend")
logging.basicConfig(level=logging.INFO)

# ═══════════════════════════════════════════════════════════════════
# Auth dependency — extracts user identity from request headers.
# The frontend sends X-User-Id and X-User-Role after client-side login.
# In production this would validate a JWT; for demo evaluation we
# trust the client-supplied identity header.
# ═══════════════════════════════════════════════════════════════════

async def get_current_citizen(
    x_user_id: str = Header(..., alias="X-User-Id"),
    x_user_role: str = Header(default="Public / Citizen", alias="X-User-Role"),
) -> dict:
    """Validate that the caller is an authenticated citizen."""
    if not x_user_id or x_user_id in ("GUEST-000", "public", ""):
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")
    return {"user_id": x_user_id, "role": x_user_role}


CurrentCitizen = Annotated[dict, Depends(get_current_citizen)]


# ═══════════════════════════════════════════════════════════════════
# Background worker configuration
# ═══════════════════════════════════════════════════════════════════

WORKER_INTERVAL_SECONDS = 60
async def ai_workers_background_consumer():
    """
    In-process worker consumer loop:
    Runs concurrently with the FastAPI gateway to handle background tasks
    without requiring a separate paid cloud worker instance.
    Currently: escalates dispatches left unacknowledged past the timeout (DM-NFR-13).
    """
    logger.info("Initializing in-process GenAI Triage & Emergency Worker...")
    try:
        while True:
            await asyncio.sleep(WORKER_INTERVAL_SECONDS)
            if not get_settings().database_url:
                continue
            try:
                await asyncio.to_thread(escalate_overdue)
            except Exception:
                logger.exception("Dispatch escalation check failed; will retry")
    except asyncio.CancelledError:
        logger.info("AI Worker consumer stopped gracefully.")


# ═══════════════════════════════════════════════════════════════════
# Application Lifespan (startup / shutdown)
# ═══════════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database and spawn worker task
    init_database()
    logger.info("SQLite citizen database initialized.")

    # Startup: ensure database schema migrations are applied
    if get_settings().database_url:
        try:
            from app.migrate import apply_migrations
            await asyncio.to_thread(apply_migrations)
        except Exception:
            logger.exception("Database migration failed on startup")

    # Startup: spawn worker task in background
    worker_task = asyncio.create_task(ai_workers_background_consumer())
    yield
    # Shutdown: cancel worker task
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    db.close_pool()



app = FastAPI(
    title="DRCH API Gateway & Workers",
    version="1.0.0",
    lifespan=lifespan
)
install_error_handlers(app)
app.include_router(auth.router)
app.include_router(dm_router)


# CORS — allow frontend dev server and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════
# Existing root & health endpoints (preserved)
# ═══════════════════════════════════════════════════════════════════

@app.get('/')
def read_root():
    return {'message': 'DRCH API Gateway & In-Process AI Worker are running'}


@app.get('/health')
def health_check():
    return {'status': 'healthy', 'service': 'drch-backend'}


# ═══════════════════════════════════════════════════════════════════
# CITIZEN REPORT ENDPOINTS (authenticated)
# ═══════════════════════════════════════════════════════════════════

@app.post(
    "/api/citizen/reports",
    response_model=ReportResponse,
    status_code=201,
    summary="Submit a new citizen disaster report",
)
async def submit_citizen_report(
    payload: CreateReportRequest,
    citizen: CurrentCitizen,
):
    """
    Creates a new disaster report from an authenticated citizen.
    The report is persisted in the SQLite database with PENDING verification status.
    Returns the created report including the generated report ID.
    """
    # Validate disaster category
    allowed_categories = [
        "Flood / Urban Flood",
        "Cyclone / Coastal Flooding",
        "Major Urban / Building Fire",
    ]
    if payload.category not in allowed_categories:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid disaster category. Must be one of: {', '.join(allowed_categories)}",
        )

    try:
        report = create_report(
            user_id=citizen["user_id"],
            data=payload.model_dump(),
        )
        logger.info(f"Citizen report {report['id']} created by user {citizen['user_id']}")
        return report
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to create report: {e}")
        raise HTTPException(status_code=500, detail="Failed to save report. Please try again.")


@app.get(
    "/api/citizen/reports",
    response_model=list[ReportResponse],
    summary="Get all reports for the authenticated citizen",
)
async def list_citizen_reports(
    citizen: CurrentCitizen,
):
    """
    Returns all disaster reports submitted by the currently authenticated citizen.
    Reports are ordered by submission date (newest first).
    Ownership is enforced server-side using the authenticated user ID.
    """
    try:
        reports = get_reports_by_user(citizen["user_id"])
        return reports
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to fetch reports: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve reports.")


@app.get(
    "/api/citizen/reports/{report_id}",
    response_model=ReportResponse,
    summary="Get a single report by ID (ownership enforced)",
)
async def get_citizen_report(
    report_id: str,
    citizen: CurrentCitizen,
):
    """
    Returns a single disaster report by ID.
    Only returns the report if it belongs to the authenticated citizen.
    """
    report = get_report_by_id(report_id, citizen["user_id"])
    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found or you do not have permission to view it.",
        )
    return report


# ═══════════════════════════════════════════════════════════════════
# PUBLIC DATA ENDPOINTS (no auth required)
# ═══════════════════════════════════════════════════════════════════

@app.get(
    "/api/public/incidents",
    response_model=list[PublicIncidentResponse],
    summary="Get active verified incidents for public map",
)
async def list_public_incidents():
    """
    Returns currently active, verified incidents approved for public visibility.
    Used by the citizen compact map. Does not expose unverified reports,
    private responder data, or resolved/closed incidents.
    """
    return get_public_incidents()


@app.get(
    "/api/public/alerts",
    response_model=list[PublicAlertResponse],
    summary="Get public safety alerts",
)
async def list_public_alerts():
    """
    Returns public safety alerts and warnings.
    Includes flood warnings, fire hazard notices, road closures, and IMD advisories.
    """
    return get_public_alerts()


@app.get(
    "/api/public/shelters",
    response_model=list[ShelterResponse],
    summary="Get shelter and hospital information",
)
async def list_shelters():
    """
    Returns operational shelters, relief camps, and hospitals
    with capacity and contact information.
    """
    return get_shelters()


@app.get('/api/v1/health')
def api_health():
    """Liveness plus database reachability (SRS s.15.6)."""
    database = "not_configured"
    if get_settings().database_url:
        try:
            with db.transaction() as conn:
                conn.execute("SELECT 1")
            database = "ok"
        except Exception:
            logger.exception("Database health check failed")
            database = "unavailable"
    return {'status': 'healthy', 'service': 'drch-backend', 'database': database}
