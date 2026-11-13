"""Incident evidence upload (issue #68): owner-only, 5 MB, JPEG/PNG, SHA-256, moderation queue."""

import hashlib
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.config import get_settings
from app.services.evidence_storage import LocalDiskStorage, evidence_storage_problems

JPEG = b"\xff\xd8\xff\xe0" + b"\x00\x10JFIF" + b"\x01" * 2048
PNG = b"\x89PNG\r\n\x1a\n" + b"\x02" * 1024


@pytest.fixture
def local_storage(monkeypatch, tmp_path):
    monkeypatch.setenv("EVIDENCE_STORAGE", "local")
    monkeypatch.setenv("EVIDENCE_STORAGE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()


def _upload(client, citizen, incident_id, data=JPEG, content_type="image/jpeg", name="flood%20photo.jpg"):
    return client.post(
        f"/api/v1/incidents/{incident_id}/evidence",
        content=data,
        headers={**citizen["headers"], "Content-Type": content_type, "X-Filename": name},
    )


# ── storage adapter (no database) ───────────────────────────────────────


def test_local_storage_never_overwrites_and_stays_in_its_directory(tmp_path):
    storage = LocalDiskStorage(tmp_path)
    storage.put("incidents/a/b.jpg", b"one", "image/jpeg")
    with pytest.raises(FileExistsError):
        storage.put("incidents/a/b.jpg", b"two", "image/jpeg")
    assert (tmp_path / "incidents/a/b.jpg").read_bytes() == b"one"
    with pytest.raises(ValueError):
        storage.put("../outside.jpg", b"x", "image/jpeg")
    storage.delete("incidents/a/b.jpg")
    assert not (tmp_path / "incidents/a/b.jpg").exists()


def test_unknown_or_incomplete_storage_configuration_stops_startup(monkeypatch):
    from dataclasses import replace

    settings = get_settings()
    assert evidence_storage_problems(replace(settings, evidence_storage="disabled")) == []
    assert evidence_storage_problems(replace(settings, evidence_storage="dropbox"))
    assert evidence_storage_problems(replace(settings, evidence_storage="local", evidence_storage_dir=None))


# ── endpoint (database) ─────────────────────────────────────────────────


@pytest.mark.db
def test_upload_is_unavailable_until_storage_is_configured(client, make, monkeypatch):
    monkeypatch.delenv("EVIDENCE_STORAGE", raising=False)
    get_settings.cache_clear()
    citizen = make.citizen()
    incident = make.incident(reporter_id=citizen["user_id"])
    policy = client.get("/api/v1/incidents/evidence-policy", headers=citizen["headers"]).json()
    assert policy == {"enabled": False, "max_bytes": 5 * 1024 * 1024, "allowed_types": ["image/jpeg", "image/png"]}
    resp = _upload(client, citizen, incident["incident_id"])
    assert resp.status_code == 503 and resp.json()["error"]["code"] == "EVIDENCE_STORAGE_UNAVAILABLE"


@pytest.mark.db
def test_owner_upload_is_stored_hashed_and_queued_for_moderation(client, make, sql, local_storage):
    citizen = make.citizen()
    incident = make.incident(reporter_id=citizen["user_id"])

    resp = _upload(client, citizen, incident["incident_id"])
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["moderation_state"] == "PENDING" and body["scan_state"] == "PENDING"
    assert body["sha256"] == hashlib.sha256(JPEG).hexdigest()
    assert body["file_name"] == "flood photo.jpg" and body["mime_type"] == "image/jpeg"

    row = sql.execute("SELECT storage_key FROM evidence_files WHERE evidence_id = %s", (body["evidence_id"],)).fetchone()
    assert (Path(local_storage) / row["storage_key"]).read_bytes() == JPEG

    moderator = make.staff("MODERATOR")
    queue = client.get("/api/v1/dm/moderation/queue", headers=moderator["headers"]).json()
    assert body["evidence_id"] in [item["evidence_id"] for item in queue["items"]]

    png = _upload(client, citizen, incident["incident_id"], data=PNG, content_type="image/png", name="x.png")
    assert png.status_code == 201 and png.json()["mime_type"] == "image/png"


@pytest.mark.db
def test_non_owner_gets_404_and_staff_get_403(client, make, local_storage):
    owner, other = make.citizen(), make.citizen()
    incident = make.incident(reporter_id=owner["user_id"])
    assert _upload(client, other, incident["incident_id"]).status_code == 404
    staff = make.staff("MODERATOR")
    assert _upload(client, staff, incident["incident_id"]).status_code == 403


@pytest.mark.db
@pytest.mark.parametrize(
    "data,content_type,status,code",
    [
        (JPEG, "image/gif", 415, "UNSUPPORTED_MEDIA_TYPE"),
        (b"%PDF-1.7 not a photo" * 10, "image/jpeg", 415, "INVALID_IMAGE"),
        (b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 64, "image/png", 415, "INVALID_IMAGE"),
        (b"\xff\xd8\xff" + b"\x00" * (5 * 1024 * 1024), "image/jpeg", 413, "FILE_TOO_LARGE"),
    ],
)
def test_wrong_type_or_too_large_is_refused_and_nothing_is_stored(
    client, make, sql, local_storage, data, content_type, status, code
):
    citizen = make.citizen()
    incident = make.incident(reporter_id=citizen["user_id"])
    resp = _upload(client, citizen, incident["incident_id"], data=data, content_type=content_type)
    assert resp.status_code == status and resp.json()["error"]["code"] == code
    count = sql.execute(
        "SELECT COUNT(*) AS n FROM evidence_files WHERE incident_id = %s", (incident["incident_id"],)
    ).fetchone()["n"]
    assert count == 0 and not any(Path(local_storage).rglob("*.*"))


@pytest.mark.db
def test_closed_report_does_not_accept_evidence(client, make, local_storage):
    citizen = make.citizen()
    incident = make.incident(reporter_id=citizen["user_id"], status="CLOSED", closed_at=datetime.now(UTC))
    resp = _upload(client, citizen, incident["incident_id"])
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "INCIDENT_CLOSED"


@pytest.mark.db
def test_failed_database_write_removes_the_stored_file(client, make, local_storage, monkeypatch):
    from app.routers import citizen as citizen_router

    def fail(*_args, **_kwargs):
        raise RuntimeError("insert failed")

    monkeypatch.setattr(citizen_router, "_record_evidence", fail)
    citizen = make.citizen()
    incident = make.incident(reporter_id=citizen["user_id"])
    with pytest.raises(RuntimeError, match="insert failed"):
        _upload(client, citizen, incident["incident_id"])
    assert not any(Path(local_storage).rglob("*.jpg"))
