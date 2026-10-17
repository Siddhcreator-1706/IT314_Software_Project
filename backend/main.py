import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from admin_router import router as admin_router
from rate_limiter import AbuseControlMiddleware

logger = logging.getLogger("drch.backend")
logging.basicConfig(level=logging.INFO)

async def ai_workers_background_consumer():
    """
    In-process worker consumer loop:
    Runs concurrently with the FastAPI gateway to handle background AI triage tasks
    without requiring a separate paid cloud worker instance.
    """
    logger.info("Initializing in-process GenAI Triage & Emergency Worker...")
    try:
        while True:
            # Heartbeat / queue worker task placeholder
            await asyncio.sleep(60)
            logger.debug("In-process AI worker heartbeat check.")
    except asyncio.CancelledError:
        logger.info("AI Worker consumer stopped gracefully.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: spawn worker task in background
    worker_task = asyncio.create_task(ai_workers_background_consumer())
    yield
    # Shutdown: cancel worker task
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="DRCH API Gateway & Workers",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Abuse control & Rate Limiting Middleware (AM-FR-11)
app.add_middleware(AbuseControlMiddleware)

# Include Application Management & Authentication Router
app.include_router(admin_router)

@app.get('/')
def read_root():
    return {'message': 'DRCH API Gateway & In-Process AI Worker are running'}

@app.get('/health')
def health_check():
    return {'status': 'healthy', 'service': 'drch-backend'}

