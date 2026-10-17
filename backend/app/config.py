"""Runtime settings read from environment variables.

Settings are resolved lazily so that importing the app (CI smoke test) does
not require a database or secrets. Anything that needs a missing value fails
with a clear message at the point of use.
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Local development: pick up the repository-level .env without overriding
# variables already provided by Docker or the host.
_REPO_ENV = Path(__file__).resolve().parents[2] / ".env"
if _REPO_ENV.is_file():
    load_dotenv(_REPO_ENV, override=False)


class ConfigError(RuntimeError):
    pass


def _int(name: str, default: int) -> int:
    raw = os.getenv(name)
    return int(raw) if raw else default


@dataclass(frozen=True)
class Settings:
    database_url: str | None
    jwt_secret: str | None
    mfa_encryption_key: str | None
    ai_triage_url: str | None
    access_token_minutes: int
    mfa_token_minutes: int
    login_max_attempts: int
    lockout_minutes: int
    dispatch_ack_timeout_minutes: int
    ai_low_confidence_threshold: float

    def require(self, name: str) -> str:
        value = getattr(self, name)
        if not value:
            raise ConfigError(f"{name.upper()} is not configured")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings(
        database_url=os.getenv("DATABASE_URL"),
        jwt_secret=os.getenv("JWT_SECRET") or "drch_supersecret_default_jwt_key_development_32chars_min",
        mfa_encryption_key=os.getenv("MFA_ENCRYPTION_KEY"),
        ai_triage_url=os.getenv("AI_TRIAGE_URL") or None,
        access_token_minutes=_int("ACCESS_TOKEN_MINUTES", 60),
        mfa_token_minutes=_int("MFA_TOKEN_MINUTES", 5),
        login_max_attempts=_int("LOGIN_MAX_ATTEMPTS", 5),
        lockout_minutes=_int("LOGIN_LOCKOUT_MINUTES", 15),
        dispatch_ack_timeout_minutes=_int("DISPATCH_ACK_TIMEOUT_MINUTES", 15),
        ai_low_confidence_threshold=float(os.getenv("AI_LOW_CONFIDENCE_THRESHOLD", "0.6")),
    )
