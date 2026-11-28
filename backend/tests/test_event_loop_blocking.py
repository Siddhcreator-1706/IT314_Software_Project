"""Async request handlers must keep blocking database work off the event loop.

The server handles every request on one event loop. A synchronous database call made directly inside
an `async def` handler stalls all other requests until it returns, so it must run in a worker thread.
"""

import asyncio
import uuid

import pytest

from app.config import get_settings
from app.routers import auth as auth_router
from app.routers import donations as donations_router


def _on_event_loop() -> bool:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return False
    return True


@pytest.fixture
def google_identity(monkeypatch):
    async def verified(_credential):
        return {"email": "citizen@example.in", "name": "Citizen", "sub": "google-subject"}

    monkeypatch.setattr(auth_router, "_verify_google_token", verified)


@pytest.fixture
def mock_gateway(monkeypatch):
    monkeypatch.setenv("PAYMENT_GATEWAY", "mock")
    monkeypatch.setenv("MOCK_GATEWAY_SECRET", "unit-test-gateway-secret-0123456789")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _sign_in(client):
    return client.post("/api/v1/auth/google", json={"credential": "a-google-id-token"})


def test_google_sign_in_database_work_runs_off_the_event_loop(client, google_identity, monkeypatch):
    calls = []

    def sign_in(*_args):
        calls.append(_on_event_loop())
        return {"access_token": "token"}

    monkeypatch.setattr(auth_router, "_google_sign_in", sign_in)

    assert _sign_in(client).status_code == 200
    assert calls == [False]


def test_google_staff_refusal_is_audited_off_the_event_loop(client, google_identity, monkeypatch):
    calls = []

    def refuse(*_args):
        raise auth_router._GoogleStaffRefused(uuid.uuid4())

    monkeypatch.setattr(auth_router, "_google_sign_in", refuse)
    monkeypatch.setattr(auth_router.audit, "record_standalone", lambda **_: calls.append(_on_event_loop()))

    response = _sign_in(client)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "GOOGLE_STAFF_NOT_ALLOWED"
    assert calls == [False]


def test_rejected_payment_webhook_is_audited_off_the_event_loop(client, mock_gateway, monkeypatch):
    calls = []
    monkeypatch.setattr(donations_router.audit, "record_standalone", lambda **_: calls.append(_on_event_loop()))

    response = client.post(
        "/api/v1/payments/webhook/mock",
        content=b"{}",
        headers={"Content-Type": "application/json", "X-Mock-Signature": "not-a-signature"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_SIGNATURE"
    assert calls == [False]
