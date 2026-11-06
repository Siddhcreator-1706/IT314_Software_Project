"""S3-14 team-recommendation tuning: benchmark regression tests.

Runs the 10 benchmark incidents from scripts/evaluate_team_recommendations.py against the TEAM
rows of the demo seed (parsed from SQL, no database needed) and locks in the tuned ranking.
If a rule or weight change moves a top-1 team, regenerate the review sheet and get it
re-reviewed before updating EXPECTED_TOP1.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from evaluate_team_recommendations import (
    BENCHMARK_INCIDENTS,
    _SeedConnection,
    load_seed_teams,
    rank_benchmark,
    render_review_sheet,
)

from app.services.recommendations import (
    build_reasons,
    get_capability_groups,
    recommend_candidate_teams,
)

EXPECTED_TOP1 = {
    "F1": "NDRF 602 Flood & Water Rescue Unit (Ahmedabad Sabarmati)",
    "F2": "NDRF 602 Flood & Water Rescue Unit (Ahmedabad Sabarmati)",
    "F3": "NDRF 601 Urban Search & Rescue (Vadodara)",
    "F4": "SDRF Flood Quick Response Team (Rajkot Aji River)",
    "I1": "Surat Hazira Chemical Hazard & Industrial Fire Team",
    "I2": "AFES Fire Tender Unit 1 (Ahmedabad Navrangpura)",
    "I3": "Surat Hazira Chemical Hazard & Industrial Fire Team",
    "C1": "SDRF Cyclone & Hazmat Response Unit (Bhuj, Kutch)",
    "C2": "NDRF 603 Cyclone Coastal Rescue Unit (Jamnagar)",
    "C3": "NDRF 603 Cyclone Coastal Rescue Unit (Jamnagar)",
}


@pytest.fixture(scope="module")
def seed_teams():
    return load_seed_teams()


@pytest.fixture(scope="module")
def results(seed_teams):
    return {inc.key: (inc, recs) for inc, recs in rank_benchmark(_SeedConnection(seed_teams))}


def test_seed_parser_reads_every_demo_team(seed_teams):
    assert len(seed_teams) == 14
    assert all(t["status"] == "AVAILABLE" and t["capabilities"] for t in seed_teams)


def test_benchmark_covers_ten_incidents_over_supported_scenarios():
    assert len(BENCHMARK_INCIDENTS) == 10
    assert {i.scenario for i in BENCHMARK_INCIDENTS} == {"cyclone", "industrial_fire", "urban_flooding"}


@pytest.mark.parametrize("key", sorted(EXPECTED_TOP1))
def test_benchmark_top1_is_the_reviewed_team(results, key):
    _, recs = results[key]
    assert len(recs) == 3
    assert recs[0].team_name == EXPECTED_TOP1[key]
    assert recs[0].capability_match, "the top team must have at least one primary capability"


def test_capable_teams_always_rank_above_teams_without_primary_match(results):
    for _, recs in results.values():
        flags = [bool(r.capability_match) for r in recs]
        assert flags == sorted(flags, reverse=True)


def test_local_fire_tenders_outrank_distant_hazmat_specialist_for_gidc_fire(results):
    """Per-tag scoring put this on a 0.5-point knife edge (and flipped it once the seed's
    industrial_fire tag counted); per-group scoring keeps local tenders first by a wide margin."""
    _, recs = results["I2"]
    names = [r.team_name for r in recs]
    assert names[:2] == [
        "AFES Fire Tender Unit 1 (Ahmedabad Navrangpura)",
        "AFES Fire Tender Unit 2 (Ahmedabad Maninagar)",
    ]
    assert names[2] == "Surat Hazira Chemical Hazard & Industrial Fire Team"


def test_cyclone_top3_has_no_team_without_cyclone_capability(results):
    """Before S3-14 a Rajkot fire tender with no cyclone capability ranked third for C1 and C2."""
    for key in ("C1", "C2", "C3"):
        _, recs = results[key]
        assert all(r.capability_match for r in recs), (key, [r.team_name for r in recs])


def test_local_capable_team_is_ranked_first_for_vadodara_flood(results):
    """Before S3-14 the local Vadodara boat team (1 km) was not even in the top 3."""
    _, recs = results["F3"]
    assert recs[0].team_name == "NDRF 601 Urban Search & Rescue (Vadodara)"
    assert recs[0].distance_km < 5


def test_only_the_nearest_capable_team_is_called_nearest(results):
    for _, recs in results.values():
        nearest = [r for r in recs if "nearest capable team" in r.reasons]
        assert len(nearest) <= 1
        for r in nearest:
            assert r.distance_km == min(x.distance_km for x in recs if x.capability_match)


def test_synonym_tags_in_one_group_score_once():
    groups = get_capability_groups("industrial_fire")
    assert set(groups) == {"firefighting", "hazmat"}
    rows = [
        {"resource_id": "a", "name": "Tag-rich far", "agency_id": None, "agency_name": "X",
         "status": "AVAILABLE", "quantity_available": 1, "distance_km": 50.0,
         "capabilities": {"fire": True, "fire_tender": True, "water_tender": True}},
        {"resource_id": "b", "name": "Single-tag near", "agency_id": None, "agency_name": "X",
         "status": "AVAILABLE", "quantity_available": 1, "distance_km": 5.0,
         "capabilities": {"fire": True}},
    ]

    class Conn:
        def execute(self, *_):
            return self

        def fetchall(self):
            return rows

    recs = recommend_candidate_teams(23.0, 72.6, "industrial_fire", conn=Conn())
    assert [r.team_name for r in recs] == ["Single-tag near", "Tag-rich far"]
    assert recs[0].score == 10 - 5 * 0.08


def test_unavailable_seed_teams_are_never_recommended(seed_teams):
    busy = [{**t, "status": "DEPLOYED"} if "NDRF 602" in t["name"] else t for t in seed_teams]
    recs = recommend_candidate_teams(23.0373, 72.5613, "urban_flooding", limit=14, conn=_SeedConnection(busy))
    assert all("NDRF 602" not in r.team_name for r in recs)


def test_reasons_text_is_accurate():
    assert build_reasons(["boat"], [], 1, 1, 3.04, True) == (
        "Exact capability match (boat) - 3.0 km away (nearest capable team)"
    )
    assert build_reasons(["fire"], ["medical"], 1, 2, 12.0, False) == (
        "Partial capability match (fire; covers 1 of 2 required capability groups); also offers medical - 12.0 km away"
    )
    assert build_reasons([], ["medical"], 0, 2, 1.0, False).startswith("Supporting capabilities only (medical)")


def test_review_sheet_has_two_reviewer_rows_per_incident(results):
    sheet = render_review_sheet(list(results.values()), "demo seed")
    assert sheet.count("| Reviewer 1:") == 10
    assert sheet.count("| Reviewer 2:") == 10
