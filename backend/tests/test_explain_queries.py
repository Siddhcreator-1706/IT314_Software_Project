"""S3-13: scripts/explain_queries.py report rendering, safety guard and query parity."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

import explain_queries

from app.routers.public import build_public_incident_query


def test_report_flags_seq_scans_and_disk_sorts():
    plan = "Seq Scan on incidents i\nSort Method: external merge  Disk: 900kB\nExecution Time: 12.5 ms"
    report = explain_queries.render([("public incidents: no filter", plan)], {"incidents": 9, "teams": 2}, 0)
    assert "Execution time: 12.5 ms" in report
    assert "sequential scan on a large table" in report
    assert "sort spilled to disk" in report


def test_report_has_no_findings_for_index_scans():
    plan = "Index Scan using idx_incidents_public_verified on incidents i\nExecution Time: 0.4 ms"
    report = explain_queries.render([("x", plan)], {"incidents": 9, "teams": 2}, 50000)
    assert "Findings: none." in report
    assert "50000 synthetic incidents, rolled back" in report


def test_synthetic_rows_are_refused_on_a_cloud_database():
    res = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "explain_queries.py"),
         "--database-url", "postgresql://u:p@ep-example.neon.tech/drch", "--synthetic", "10"],
        capture_output=True, text=True, timeout=60, check=False,
    )
    assert res.returncode != 0
    assert "Refusing --synthetic" in res.stderr


def test_public_query_builder_keeps_privacy_filters_and_binds_filters_as_parameters():
    query, params = build_public_incident_query(district="Surat", scenario="cyclone", bbox="72,21,73,22")
    text = query.as_string(None)
    assert "%(district)s" in text and "Surat" not in text  # bound, never interpolated
    assert "i.status IN ('VERIFIED', 'DISPATCHED', 'RESOLVED')" in text
    assert "i.verified_by IS NOT NULL" in text
    assert "ROUND(i.latitude::numeric, 4)" in text
    assert params["district"] == "Surat" and params["scenario"] == "CYCLONE"
    assert (params["x1"], params["y1"], params["x2"], params["y2"]) == (72.0, 21.0, 73.0, 22.0)
