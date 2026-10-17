import logging
import time
from collections import defaultdict

from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("drch.rate_limiter")

class AbuseControlManager:
    """
    In-memory, fail-safe rate limiting and abuse prevention manager (AM-FR-11).
    Safely throttles attacks while guaranteeing legitimate emergency traffic is never lost.
    """
    def __init__(self):
        # Default rate limits: max requests per 60 seconds
        self.rules = {
            "auth_login": 10,       # 10 attempts / min
            "auth_signup": 5,       # 5 signups / min
            "incident_report": 30,  # 30 reports / min
            "data_mutation": 20,    # 20 admin edits / min
            "general_api": 120,     # 120 req / min
        }
        # IP and Account blocklists: {identifier: {"reason": str, "blocked_at": float, "expires_at": float | None}}
        self.blocklist = {}
        # Allowlist: set of exempt IPs
        self.allowlist = {"127.0.0.1", "localhost", "::1", "testclient"}
        # Sliding window buckets: {key: list of timestamps}
        self.windows = defaultdict(list)
        # Audit/Violation history (in-memory circular buffer for administrative UI)
        self.abuse_events = []

    def get_client_ip(self, request: Request) -> str:
        """Extract client IP, inspecting proxy headers safely."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "127.0.0.1"

    def is_blocked(self, ip: str) -> tuple[bool, str | None]:
        """Check if an IP is currently blocked."""
        entry = self.blocklist.get(ip)
        if not entry:
            return False, None
        if entry.get("expires_at") and time.time() > entry["expires_at"]:
            del self.blocklist[ip]
            return False, None
        return True, entry.get("reason", "Administrative block")

    def block_ip(self, ip: str, reason: str, duration_minutes: int | None = 60):
        """Add an IP to the blocklist."""
        expires = time.time() + (duration_minutes * 60) if duration_minutes else None
        self.blocklist[ip] = {
            "ip": ip,
            "reason": reason,
            "blocked_at": time.time(),
            "expires_at": expires,
        }
        self.log_event(ip, "ADMIN_BLOCK", reason, 403)
        logger.warning(f"IP {ip} blocked: {reason}")

    def unblock_ip(self, ip: str) -> bool:
        """Lift a block after administrative review."""
        if ip in self.blocklist:
            del self.blocklist[ip]
            logger.info(f"IP {ip} unblocked by administrator.")
            return True
        return False

    def log_event(self, ip: str, action: str, details: str, status_code: int):
        """Record an abuse event for admin visibility."""
        event = {
            "id": len(self.abuse_events) + 1,
            "ip": ip,
            "action": action,
            "details": details,
            "status_code": status_code,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
        }
        self.abuse_events.insert(0, event)
        if len(self.abuse_events) > 200:
            self.abuse_events.pop()

    def check_rate_limit(self, ip: str, endpoint_category: str) -> bool:
        """
        Evaluate sliding window for rate limiting.
        Returns True if allowed, False if exceeded.
        """
        if ip in self.allowlist:
            return True

        limit = self.rules.get(endpoint_category, self.rules["general_api"])
        window_seconds = 60
        now = time.time()
        bucket_key = f"{ip}:{endpoint_category}"

        # Clean timestamps older than window
        timestamps = [ts for ts in self.windows[bucket_key] if now - ts < window_seconds]
        if len(timestamps) >= limit:
            self.windows[bucket_key] = timestamps
            return False

        timestamps.append(now)
        self.windows[bucket_key] = timestamps
        return True

abuse_manager = AbuseControlManager()

class AbuseControlMiddleware(BaseHTTPMiddleware):
    """
    Middleware applying IP blocking and rate limiting to requests.
    Designed with a strict fail-safe: if any error occurs in limiter logic,
    the request proceeds to guarantee legitimate emergency reports are never dropped.
    """
    async def dispatch(self, request: Request, call_next):
        try:
            ip = abuse_manager.get_client_ip(request)
            path = request.url.path

            # Skip rate limiting for static/docs and local health probes
            if path in {"/health", "/docs", "/openapi.json"} or path.startswith("/static"):
                return await call_next(request)

            # 1. Check IP blocklist
            blocked, reason = abuse_manager.is_blocked(ip)
            if blocked:
                logger.warning(f"Blocked IP {ip} attempted access to {path}")
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": f"Access forbidden: {reason}"},
                )

            # 2. Categorize endpoint
            category = "general_api"
            if "/auth/login" in path:
                category = "auth_login"
            elif "/auth/signup" in path:
                category = "auth_signup"
            elif "/reports" in path or "/incidents" in path:
                category = "incident_report"
            elif "/admin/data" in path or "/admin/users" in path:
                category = "data_mutation"

            # 3. Check rate limits
            if not abuse_manager.check_rate_limit(ip, category):
                msg = "Rate limit threshold exceeded. Please try again shortly."
                abuse_manager.log_event(ip, "RATE_LIMIT_EXCEEDED", f"Exceeded {category} limit on {path}", 429)
                logger.warning(f"Rate limit exceeded for IP {ip} on {category}")
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": msg},
                )

        except Exception as exc:  # noqa: BLE001 - Deliberate fail-safe: never drop emergency traffic on limiter exception
            logger.error(f"Rate limiter exception (failing open): {exc}")

        return await call_next(request)
