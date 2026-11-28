"""Startup validation outside development, audit-chain integrity under concurrency and the CLI check."""

import argparse
import io
import sys
import threading
from contextlib import nullcontext

import pytest

from app.config import Settings, validate_for_environment


def _settings(**overrides) -> Settings:
    base = {
        "database_url": "postgresql://db", "jwt_secret": "k" * 40, "mfa_encryption_key": "key",
        "ai_triage_url": None, "ai_triage_token": None, "access_token_minutes": 60, "mfa_token_minutes": 5, "login_max_attempts": 5,
        "lockout_minutes": 15, "dispatch_ack_timeout_minutes": 15, "ai_low_confidence_threshold": 0.6,
        "google_maps_api_key": None, "boundary_sync_enabled": True, "boundary_sync_interval_hours": 720,
        "boundary_sync_check_interval_seconds": 86400, "geojson_gujarat_districts_url": "",
        "cors_allowed_origins": ["https://app.example.org"], "ingest_token": "t" * 40,
        "mock_gateway_secret": None, "app_env": "production", "git_sha": "x", "payment_gateway": "mock",
    }
    base.update(overrides)
    return Settings(**base)


def test_development_has_no_requirements():
    assert validate_for_environment(_settings(app_env="development", database_url=None, jwt_secret=None)) == []


def test_production_valid_configuration_passes():
    assert validate_for_environment(_settings()) == []


@pytest.mark.parametrize(
    "overrides",
    [
        {"jwt_secret": None},
        {"jwt_secret": "supersecretkey_change_in_production_32chars_min"},
        {"jwt_secret": "short"},
        {"mfa_encryption_key": None},
        {"ingest_token": None},
        {"database_url": None},
        {"cors_allowed_origins": []},
    ],
)
def test_production_rejects_unsafe_configuration(overrides):
    assert validate_for_environment(_settings(**overrides))


@pytest.mark.db
def test_audit_chain_stays_valid_under_concurrent_writes(sql):
    import psycopg

    from app import audit
    from tests.conftest import TEST_DB_URL

    def write(n):
        with psycopg.connect(TEST_DB_URL, autocommit=True) as c:
            for i in range(10):
                c.execute(
                    "INSERT INTO audit_logs (action, entity_type, rationale) VALUES ('CONCURRENCY_TEST', 'test', %s)",
                    (f"{n}-{i}",),
                )

    threads = [threading.Thread(target=write, args=(n,)) for n in range(8)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    valid, _count, message = audit.verify_audit_chain(sql)
    assert valid, message


@pytest.mark.parametrize("valid", [True, False])
def test_verify_audit_output_fits_a_legacy_windows_encoding(monkeypatch, valid):
    """Redirected output on Windows is cp1252; a character it cannot write must not fail the check."""
    from app import cli

    monkeypatch.setattr(cli.db, "transaction", lambda: nullcontext(None))
    monkeypatch.setattr(cli.audit, "verify_audit_chain", lambda _conn: (valid, 3, "checked 3 records"))
    stream = io.TextIOWrapper(io.BytesIO(), encoding="cp1252")
    monkeypatch.setattr(sys, "stdout", stream)

    if valid:
        cli.verify_audit(argparse.Namespace())
        stream.flush()
        assert b"AUDIT INTEGRITY VERIFIED" in stream.buffer.getvalue()
    else:
        with pytest.raises(SystemExit) as stopped:
            cli.verify_audit(argparse.Namespace())
        message = str(stopped.value.code)
        assert "AUDIT TAMPERING DETECTED" in message
        message.encode("cp1252")
